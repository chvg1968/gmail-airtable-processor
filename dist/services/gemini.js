"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBookingInfoFromEmail = void 0;
const generative_ai_1 = require("@google/generative-ai");
let genAI = null;
let model = null;
async function initializeGeminiClient(apiKey) {
    if (genAI && model) {
        return;
    }
    genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
}
const generationConfig = {
    temperature: 0.2,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
};
const safetySettings = [
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
function buildPrompt(emailBody, referenceYear) {
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
    - accommodationPrice: The base price for the stay, before any fees or taxes. Look for patterns like 'X nights $Y' or similar pricing lines.
    - adults: The number of adults.
    - children: The number of children.
    - bookingDate: The date the reservation was made, in YYYY-MM-DD format.
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
    `;
}
async function extractBookingInfoFromEmail(emailBody, apiKey, referenceYear) {
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
            const jsonData = JSON.parse(responseText);
            if (jsonData.error) {
                return jsonData;
            }
            if (jsonData.platform && !Array.isArray(jsonData.platform)) {
                jsonData.platform = [String(jsonData.platform)];
            }
            else if (!jsonData.platform) {
                jsonData.platform = ["Unknown"];
            }
            return jsonData;
        }
        else {
            console.error('Respuesta vacía de Gemini.');
            return null;
        }
    }
    catch (error) {
        console.error('Error al interactuar con Gemini API:', error);
        if (error.response?.candidates) {
            console.error('Detalles del error de Gemini (candidates):', JSON.stringify(error.response.candidates, null, 2));
        }
        else if (error.message?.includes('SAFETY')) {
            console.error('La respuesta fue bloqueada por configuración de seguridad.');
        }
        return null;
    }
}
exports.extractBookingInfoFromEmail = extractBookingInfoFromEmail;
