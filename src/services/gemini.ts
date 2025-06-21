import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, GenerativeModel } from '@google/generative-ai';
import { getInitializedConfig } from '../config';

export interface ExtractedBookingData {
    guestName?: string | null;
    platform?: string[] | null;
    reservationNumber?: string | null;
    checkInDate?: string | null;
    checkOutDate?: string | null;
    propertyAddress?: string | null;
    ownerName?: string | null;
    propertyCodeVrbo?: string | null;
    accommodationPrice?: number | null;
    adults?: number | null;
    children?: number | null;
    bookingDate?: string | null; // YYYY-MM-DD
    discountAmount?: number | null;
    cleaningFee?: number | null;
    guestServiceFee?: number | null;
    taxesAmount?: number | null;
    damageProtectionFee?: number | null;
    baseCommissionOrHostFee?: number | 'TBD' | null;
    paymentProcessingFee?: number | 'TBD' | null;
    clubFee?: number | null;
    NeedsDateReview?: boolean;
    error?: string | null;
    accommodationName?: string | null;
}

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

async function initializeGeminiClient(apiKey: string): Promise<void> {
  if (genAI && model) {
    return;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
}

const generationConfig: GenerationConfig = {
    temperature: 0.2,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export function buildPrompt(emailBody: string, referenceYear: number): string {
    return `
    Analyze the following email content to extract booking details. The current year is ${referenceYear} for context, which should be used for any dates where the year is not specified.

    Email Content:
    --- BEGIN EMAIL ---
    ${emailBody}
    --- END EMAIL ---

    Extract the following fields and return them in a single, flat JSON object. Do not use nested objects.
    - guestName: The full name of the primary guest.
    - platform: The booking platform (e.g., "Airbnb", "Vrbo", "HomeAway"). Should be an array with one string.
    - reservationNumber: The unique confirmation code or reservation ID.
    - checkInDate: The arrival date in YYYY-MM-DD format.
    - checkOutDate: The departure date in YYYY-MM-DD format.
    - accommodationName: The full address or name of the property. For Airbnb, try to extract the text that comes after the last hyphen in the property line (e.g., from "Reservation at Villa Palacio - Tainos", extract "Tainos"). For Vrbo, extract the textual property name (e.g., "Villa Clara", "Ocean Grace Villa").
    - propertyCodeVrbo: The unique property identifier code for Vrbo bookings, often found near the property name or details (e.g., "3456633", "4574967"). This is NOT the reservation ID (like HA-XXXXXX). Null for other platforms.
    - accommodationPrice: The total price for the entire stay, before any fees or taxes. For Airbnb, if you see a pattern like '$X.XX x N nights' or 'Accommodation: $X.XX x N nights', multiply to get the total (e.g., $894.00 x 4 nights = $3,576.00). If both total and per-night prices are present, always return the total. If only per-night and number of nights are present, multiply them.
    - adults: The number of adults.
    - children: The number of children.
    - bookingDate: The date when the booking confirmation email was originally sent by Airbnb. If the email is a forward, search for a header block that starts with '---------- Forwarded message ---------' and extract the line starting with 'Date:' (e.g., 'Date: Wed, May 21, 2025 at 2:56 PM'). Use this as the bookingDate in YYYY-MM-DD format. If not found, use the oldest date present in the email body. Prioritize the original Airbnb header date over any forward date or processing date.
    - discountAmount: Any discount applied.
    - cleaningFee: The cleaning fee.
    - guestServiceFee: The service fee charged to the guest.
    - taxesAmount: The total amount of taxes.
    - damageProtectionFee: The fee for damage protection, insurance, or damage deposit.
    - clubFee: The 'Club' fee, if present in the Vrbo pricing breakdown. Null if not present.
    - baseCommissionOrHostFee: The base commission for Vrbo or host fee for Airbnb. This is often labeled as 'Host fee' on Airbnb or might be part of a 'Payout' calculation on Vrbo. If not found, return null.
    - paymentProcessingFee: The payment processing fee, often a percentage of the total or a fixed amount. For Vrbo, this might be explicitly listed or sometimes marked as 'TBD' if not yet calculated. If 'TBD', return the string 'TBD'. If not found, return null.

    IMPORTANT RULES:
    1.  If the email is from Vrbo/HomeAway and does NOT contain a detailed pricing structure (e.g., lines for 'nights', 'cleaning fee', 'taxes'), return a JSON object with a single key: {"error": "No detailed pricing structure found in Vrbo email"}. Do not attempt to extract other fields.
    2.  For dates, if the year is missing, use the provided reference year (${referenceYear}).
    3.  All monetary values should be numbers, without currency symbols or commas, except for 'paymentProcessingFee' which can be the string 'TBD'.
    4.  If a field is not found, its value should be null.
    5.  The 'platform' field must always be an array containing a single string.
    Return the extracted fields as a flat JSON object. If any field is missing, set it to null or an empty string.
    `;
}

export async function extractBookingInfoFromEmail(
    emailBody: string,
    apiKey: string,
    referenceYear: number
): Promise<ExtractedBookingData | null> {
    await initializeGeminiClient(apiKey);
    if (!model) {
        throw new Error('Gemini model not initialized');
    }

    const prompt = buildPrompt(emailBody, referenceYear);

    try {
        console.log('\nEnviando texto a Gemini para extracción...');
        const chatSession = model.startChat({
            generationConfig,
            safetySettings,
            history: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const result = await chatSession.sendMessage("Genera el JSON.");
        
        const responseText = result.response.text();
        if (responseText) {
            console.log('Respuesta JSON de Gemini recibida.');
            const jsonData = JSON.parse(responseText) as ExtractedBookingData;

            // --- Fallback: calcular total si Gemini solo devuelve nightly rate y noches ---
            // Vrbo: sumar Club a accommodationPrice si ambos existen
            if (jsonData.platform && jsonData.platform[0]?.toLowerCase() === 'vrbo') {
                if (typeof jsonData.accommodationPrice === 'number' && typeof jsonData.clubFee === 'number') {
                    jsonData.accommodationPrice += jsonData.clubFee;
                }
            }

            if (jsonData.platform && jsonData.platform[0]?.toLowerCase() === 'airbnb') {
                // Buscar patrón de nightly rate y noches en el cuerpo del email
                const nightsMatch = emailBody.match(/(\d+)\s+nights?/i);
                const nightlyRateMatch = emailBody.match(/\$([\d,]+(?:\.\d{2})?)\s*(?:x|×)\s*\d+\s+nights?/i);
                if (nightsMatch && nightlyRateMatch) {
                    const nights = parseInt(nightsMatch[1], 10);
                    const nightlyRate = parseFloat(nightlyRateMatch[1].replace(/,/g, ''));
                    const calculatedTotal = nightlyRate * nights;
                    if (
                        (!jsonData.accommodationPrice || Math.abs(jsonData.accommodationPrice - nightlyRate) < 1) &&
                        calculatedTotal > 0
                    ) {
                        jsonData.accommodationPrice = calculatedTotal;
                    }
                }
            }
            
            if (jsonData.error) {
                return jsonData;
            }
            
            if (jsonData.platform && !Array.isArray(jsonData.platform)) {
                jsonData.platform = [String(jsonData.platform)];
            } else if (!jsonData.platform) { 
                jsonData.platform = ["Unknown"];
            }
            return jsonData;
        } else {
            console.error('Respuesta vacía de Gemini.');
            return null;
        }
    } catch (error) {
        console.error('Error al interactuar con Gemini API:', error);
        if ((error as any).response?.candidates) {
            console.error('Detalles del error de Gemini (candidates):', JSON.stringify((error as any).response.candidates, null, 2));
        } else if ((error as any).message?.includes('SAFETY')) {
             console.error('La respuesta fue bloqueada por configuración de seguridad.');
        }
        return null;
    }
}
