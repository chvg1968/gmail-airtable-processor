import { getInitializedConfig, AppConfig } from './config';
// Define GmailMessageMeta locally
interface GmailMessageMeta {
    id: string;
    threadId: string;
}
import { getGmailProfile, searchEmails, getEmailContent, EmailContent } from './services/gmail';
import { extractBookingInfoFromEmail, ExtractedBookingData } from './services/gemini';
import { vrboPropertyMappings as Vrbo_properties, airbnbPropertyMappings as Airbnb_properties, AirbnbProperty, VrboProperty } from './data/propertyMappings';
import { upsertBookingToAirtable, isMessageProcessed } from './services/airtable';

function toTitleCase(str: string | null | undefined): string | null | undefined {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

import type { Request, Response } from 'express';

// --- Bloques de utilidades (sin cambios) ---
const extractFee = (text: string, regex: RegExp): number | null => {
    const match = text.match(regex);
    if (match && match[1]) {
        const numericValue = parseFloat(match[1].replace(/,/g, ''));
        return Math.abs(numericValue);
    }
    return null;
};
const extractPaymentProcessingFee = (text: string, regex: RegExp): number | 'TBD' | null => {
    const match = text.match(regex);
    if (match && match[1]) {
        const value = match[1].trim();
        if (value.toUpperCase() === 'TBD') return 'TBD';
        return parseFloat(value.replace(/,/g, ''));
    }
    return null;
};
const airbnbHostFeeRegex = /Host service fee \(3\.0%\)[\s\S]*?-\$([\d,]+\.\d{2})/;
const vrboBaseCommissionRegex = /Base commission[\s\S]*?\$([\d,]+\.\d{2})/;
const vrboPaymentProcessingFeeRegex = /Payment processing fees\*[\s\S]*?\$?([\d,]+\.\d{2}|TBD)/;
function findPropertyMapping(platformFromGemini: string | null, accommodationNameFromGemini: string | null, propertyCodeVrboFromGemini: string | null): string | null {
    if (platformFromGemini && (platformFromGemini.toLowerCase() === 'vrbo' || platformFromGemini.toLowerCase() === 'homeaway')) {
        if (propertyCodeVrboFromGemini) {
            const codeToSearch = propertyCodeVrboFromGemini.replace(/^#/, '').toLowerCase();
            const property = Vrbo_properties.find((p: VrboProperty) => p.code.toLowerCase() === codeToSearch);
            return property ? property.name : null;
        }
        return null;
    }
    if (!platformFromGemini) return null;
    const platform = platformFromGemini.toLowerCase();
    if (platform === 'airbnb') {
        if (!accommodationNameFromGemini) return null;
        const nameToSearch = accommodationNameFromGemini.toLowerCase();
        const found: AirbnbProperty | undefined = Airbnb_properties.find((p: AirbnbProperty) => nameToSearch.includes(p.alias.toLowerCase()));
        return found ? found.name : null;
    }
    return null;
}

// --- Handler Principal Refactorizado ---
export async function processEmailsHandler(req: Request, res: Response) {
    let config: AppConfig;
    try {
        config = await getInitializedConfig();
    } catch (error) {
        console.error('Error initializing config:', error);
        res.status(500).send('Error initializing config: ' + (error instanceof Error ? error.message : String(error)));
        return;
    }

    console.log('Starting Gmail-Airtable email processor...');

    try {
        await getGmailProfile();
        console.log('Gmail connection successful.');

        const now = new Date();
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setDate(fortyEightHoursAgo.getDate() - 2);
        const searchSinceDateString = `${fortyEightHoursAgo.getFullYear()}/${String(fortyEightHoursAgo.getMonth() + 1).padStart(2, '0')}/${String(fortyEightHoursAgo.getDate()).padStart(2, '0')}`;
        
        console.log(`Searching emails since ${searchSinceDateString}`);
        const query = `({from:no-reply@airbnb.com subject:("Reservation confirmed" OR "Booking Confirmation")} OR {from:(no-reply@vrbo.com OR no-reply@homeaway.com OR luxeprbahia@gmail.com) (subject:("Instant Booking") "Your booking is confirmed" OR subject:("Reservation from"))}) after:${searchSinceDateString}`;
        const messages: GmailMessageMeta[] = await searchEmails(query) as GmailMessageMeta[];
        console.log(`Found ${messages ? messages.length : 0} emails.`);

        const processedReservations = new Set<string>();
        let skippedCount = 0;
        let processedInAirtableCount = 0;

        if (!messages || messages.length === 0) {
            console.log("No new emails to process.");
        } else {
            for (const messageMeta of messages) {
                const messageId = messageMeta.id;
                console.log(`--- Processing email (ID: ${messageId}) ---`);

                if (!messageId) {
                    console.log('⚠️ SKIPPED: Message found without an ID.');
                    skippedCount++;
                    continue;
                }

                if (await isMessageProcessed(messageId, config)) {
                    console.log(`📬 SKIPPED: Email already processed (messageId=${messageId}).`);
                    skippedCount++;
                    continue;
                }

                const emailContent = await getEmailContent(messageId);
                if (!emailContent || !emailContent.body) {
                    console.log(`⚠️ SKIPPED: Could not retrieve full content for message ID: ${messageId}`);
                    skippedCount++;
                    continue;
                }

                const originalBody = emailContent.body;

                // Helper function to clean forwarded email headers and noise.
                const cleanForwardedBody = (body: string): string => {
                    const forwardMarker = '---------- Forwarded message ---------';
                    const markerIndex = body.lastIndexOf(forwardMarker);

                    if (markerIndex !== -1) {
                        // Find the end of the header block for the last forwarded message
                        const headerEndIndex = body.indexOf('\n\n', markerIndex);
                        if (headerEndIndex !== -1) {
                            return body.substring(headerEndIndex).trim();
                        }
                    }
                    return body; // Return original body if not a forwarded email
                };

                const cleanedBody = cleanForwardedBody(originalBody);

                const extractedData = await extractBookingInfoFromEmail(cleanedBody, config.geminiApiKey, new Date().getFullYear());

                if (!extractedData || !extractedData.reservationNumber) {
                    console.log(`⚠️ SKIPPED: Could not extract reservation number from messageId=${messageId}.`);
                    skippedCount++;
                    continue;
                }

                // --- AJUSTE DE AÑO EN CHECKIN PARA AIRBNB ---
                const platformStr = Array.isArray(extractedData.platform)
                  ? extractedData.platform[0]
                  : extractedData.platform;
                if (
                  platformStr &&
                  typeof platformStr === 'string' &&
                  platformStr.toLowerCase() === 'airbnb' &&
                  extractedData.checkInDate &&
                  extractedData.bookingDate
                ) {
                  // Si checkInDate no tiene año explícito (formato YYYY-MM-DD vs MM-DD)
                  if (!/\d{4}/.test(extractedData.checkInDate)) {
                    const { adjustArrivalYear } = await import('./utils/adjustArrivalYear');
                    extractedData.checkInDate = adjustArrivalYear(extractedData.checkInDate, extractedData.bookingDate);
                  }
                }

                const platform = extractedData.platform?.[0] || 'Desconocido';
                const reservationKey = `${extractedData.reservationNumber}::${platform}`;

                if (processedReservations.has(reservationKey)) {
                    console.log(`🔁 SKIPPED: Duplicate reservation detected in this run: ${reservationKey}.`);
                    skippedCount++;
                    continue;
                }
                processedReservations.add(reservationKey);

                // --- Enriquecimiento de datos (Tarifas, Fechas, etc.) ---
                const platformLower = platform.toLowerCase();
                extractedData.baseCommissionOrHostFee = platformLower === 'airbnb' ? extractFee(originalBody, airbnbHostFeeRegex) : extractFee(originalBody, vrboBaseCommissionRegex);
                extractedData.paymentProcessingFee = platformLower.startsWith('vrbo') ? extractPaymentProcessingFee(originalBody, vrboPaymentProcessingFeeRegex) : 0;
                
                const propertyMapping = findPropertyMapping(platform, extractedData.accommodationName ?? null, extractedData.propertyCodeVrbo ?? null);

                // --- Usar siempre la fecha del header para Vrbo ---
                let bookingDateFinal = extractedData.bookingDate;
                if (platform.toLowerCase() === 'vrbo' && emailContent.date) {
                    // Convertir a YYYY-MM-DD
                    const parsed = new Date(emailContent.date);
                    if (!isNaN(parsed.getTime())) {
                        const yyyy = parsed.getFullYear();
                        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                        const dd = String(parsed.getDate()).padStart(2, '0');
                        bookingDateFinal = `${yyyy}-${mm}-${dd}`;
                    }
                }
                
                const dataForAirtable: ExtractedBookingData = {
                    ...extractedData,
                    bookingDate: bookingDateFinal,
                    guestName: toTitleCase(extractedData.guestName),
                    accommodationName: propertyMapping || extractedData.accommodationName,
                };

                const success = await upsertBookingToAirtable(dataForAirtable, config, messageId);
                if (success) {
                    processedInAirtableCount++;
                } else {
                    skippedCount++;
                }
            }
            }

            const summaryLog = `
[PROCESSING SUMMARY]
----------------------------------------
Emails Found: ${messages?.length || 0}
Reservations Processed in Airtable: ${processedInAirtableCount}
Skipped Emails/Reservations: ${skippedCount}
----------------------------------------
`;
            console.log(summaryLog);

            res.status(200).json({
            message: "Email processing completed.",
            details: {
            emailsFound: messages?.length || 0,
            recordsUpserted: processedInAirtableCount,
            emailsSkipped: skippedCount
            }
            });
    } catch (error) {
        console.error('Error in main execution:', error);
        res.status(500).json({ 
            message: 'Error in main execution', 
            error: (error instanceof Error ? error.message : String(error)) 
        });
    }
}

// Exporta la función como entry point para Google Cloud Functions
export async function mailAirtableProcessor(req: Request, res: Response) {
  await processEmailsHandler(req, res);
}

// Para pruebas locales con mocks, ejecuta manualmente otro script o descomenta el bloque original si lo necesitas.