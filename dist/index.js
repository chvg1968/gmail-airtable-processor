"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailAirtableProcessor = exports.processEmailsHandler = void 0;
const config_1 = require("./config");
const gmail_1 = require("./services/gmail");
const gemini_1 = require("./services/gemini");
const propertyMappings_1 = require("./data/propertyMappings");
const airtable_1 = require("./services/airtable");
function toTitleCase(str) {
    if (!str)
        return str;
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
// --- Bloques de utilidades (sin cambios) ---
const extractFee = (text, regex) => {
    const match = text.match(regex);
    if (match && match[1]) {
        const numericValue = parseFloat(match[1].replace(/,/g, ''));
        return Math.abs(numericValue);
    }
    return null;
};
const extractPaymentProcessingFee = (text, regex) => {
    const match = text.match(regex);
    if (match && match[1]) {
        const value = match[1].trim();
        if (value.toUpperCase() === 'TBD')
            return 'TBD';
        return parseFloat(value.replace(/,/g, ''));
    }
    return null;
};
const airbnbHostFeeRegex = /Host service fee \(3\.0%\)[\s\S]*?-\$([\d,]+\.\d{2})/;
const vrboBaseCommissionRegex = /Base commission[\s\S]*?\$([\d,]+\.\d{2})/;
const vrboPaymentProcessingFeeRegex = /Payment processing fees\*[\s\S]*?\$?([\d,]+\.\d{2}|TBD)/;
function findPropertyMapping(platformFromGemini, accommodationNameFromGemini, propertyCodeVrboFromGemini) {
    if (platformFromGemini && (platformFromGemini.toLowerCase() === 'vrbo' || platformFromGemini.toLowerCase() === 'homeaway')) {
        if (propertyCodeVrboFromGemini) {
            const codeToSearch = propertyCodeVrboFromGemini.replace(/^#/, '').toLowerCase();
            const property = propertyMappings_1.vrboPropertyMappings.find((p) => p.code.toLowerCase() === codeToSearch);
            return property ? property.name : null;
        }
        return null;
    }
    if (!platformFromGemini)
        return null;
    const platform = platformFromGemini.toLowerCase();
    if (platform === 'airbnb') {
        if (!accommodationNameFromGemini)
            return null;
        const nameToSearch = accommodationNameFromGemini.toLowerCase();
        const found = propertyMappings_1.airbnbPropertyMappings.find((p) => nameToSearch.includes(p.alias.toLowerCase()));
        return found ? found.name : null;
    }
    return null;
}
// --- Handler Principal Refactorizado ---
async function processEmailsHandler(req, res) {
    let config;
    try {
        config = await (0, config_1.getInitializedConfig)();
    }
    catch (error) {
        console.error('Error initializing config:', error);
        res.status(500).send('Error initializing config: ' + (error instanceof Error ? error.message : String(error)));
        return;
    }
    console.log('Starting Gmail-Airtable email processor...');
    try {
        await (0, gmail_1.getGmailProfile)();
        console.log('Gmail connection successful.');
        const now = new Date();
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setDate(fortyEightHoursAgo.getDate() - 2);
        const searchSinceDateString = `${fortyEightHoursAgo.getFullYear()}/${String(fortyEightHoursAgo.getMonth() + 1).padStart(2, '0')}/${String(fortyEightHoursAgo.getDate()).padStart(2, '0')}`;
        console.log(`Searching emails since ${searchSinceDateString}`);
        const query = `({from:no-reply@airbnb.com subject:("Reservation confirmed" OR "Booking Confirmation")} OR {from:(no-reply@vrbo.com OR no-reply@homeaway.com OR luxeprbahia@gmail.com) (subject:("Instant Booking") "Your booking is confirmed" OR subject:("Reservation from"))}) after:${searchSinceDateString}`;
        const messages = await (0, gmail_1.searchEmails)(query);
        console.log(`Found ${messages ? messages.length : 0} emails.`);
        const processedReservations = new Set();
        let skippedCount = 0;
        let processedInAirtableCount = 0;
        if (!messages || messages.length === 0) {
            console.log("No new emails to process.");
        }
        else {
            for (const messageMeta of messages) {
                const messageId = messageMeta.id;
                console.log(`--- Processing email (ID: ${messageId}) ---`);
                if (!messageId) {
                    console.log('⚠️ SKIPPED: Message found without an ID.');
                    skippedCount++;
                    continue;
                }
                if (await (0, airtable_1.isMessageProcessed)(messageId, config)) {
                    console.log(`📬 SKIPPED: Email already processed (messageId=${messageId}).`);
                    skippedCount++;
                    continue;
                }
                const emailContent = await (0, gmail_1.getEmailContent)(messageId);
                if (!emailContent || !emailContent.body) {
                    console.log(`⚠️ SKIPPED: Could not retrieve full content for message ID: ${messageId}`);
                    skippedCount++;
                    continue;
                }
                const originalBody = emailContent.body;
                // Helper function to clean forwarded email headers and noise.
                const cleanForwardedBody = (body) => {
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
                const extractedData = await (0, gemini_1.extractBookingInfoFromEmail)(cleanedBody, config.geminiApiKey, new Date().getFullYear());
                // --- Fallbacks when Gemini does not return Guest Name or Booking Date ---
                if (extractedData) {
                    // 1. Guest Name from email subject (Airbnb)
                    const extractNameFromSubject = (subject) => {
                        const match = subject.match(/ - ([^-]+?) (?:arrives|llega)/i) ||
                            subject.match(/ - ([^-]+)$/i);
                        return match && match[1] ? (toTitleCase(match[1].trim()) ?? null) : null;
                    };
                    const nameFromSubject = emailContent.subject ? extractNameFromSubject(emailContent.subject) : null;
                    // 1a. If Gemini did NOT return guestName, use subject.
                    if (!extractedData.guestName && nameFromSubject) {
                        extractedData.guestName = nameFromSubject;
                    }
                    // 1b. If Gemini returned only first name (single token) and subject has more, prefer subject.
                    else if (extractedData.guestName &&
                        !extractedData.guestName.includes(' ') &&
                        nameFromSubject &&
                        nameFromSubject.toLowerCase().startsWith(extractedData.guestName.toLowerCase()) &&
                        nameFromSubject.includes(' ')) {
                        extractedData.guestName = nameFromSubject;
                    }
                    // 2. Booking Date from Gmail header 'Date'
                    if (!extractedData.bookingDate && emailContent.date) {
                        const headerDate = new Date(emailContent.date);
                        if (!isNaN(headerDate.getTime())) {
                            const yyyy = headerDate.getFullYear();
                            const mm = String(headerDate.getMonth() + 1).padStart(2, '0');
                            const dd = String(headerDate.getDate()).padStart(2, '0');
                            extractedData.bookingDate = `${yyyy}-${mm}-${dd}`;
                        }
                    }
                }
                if (!extractedData || !extractedData.reservationNumber) {
                    console.log(`⚠️ SKIPPED: Could not extract reservation number from messageId=${messageId}.`);
                    skippedCount++;
                    continue;
                }
                // --- AJUSTE DE AÑO EN CHECKIN PARA AIRBNB ---
                const platformStr = Array.isArray(extractedData.platform)
                    ? extractedData.platform[0]
                    : extractedData.platform;
                if (platformStr &&
                    typeof platformStr === 'string' &&
                    platformStr.toLowerCase() === 'airbnb' &&
                    extractedData.checkInDate &&
                    extractedData.bookingDate) {
                    // Si checkInDate no tiene año explícito (formato YYYY-MM-DD vs MM-DD)
                    if (!/\d{4}/.test(extractedData.checkInDate)) {
                        const { adjustArrivalYear } = await Promise.resolve().then(() => __importStar(require('./utils/adjustArrivalYear')));
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
                const dataForAirtable = {
                    ...extractedData,
                    bookingDate: bookingDateFinal,
                    guestName: toTitleCase(extractedData.guestName),
                    accommodationName: propertyMapping || extractedData.accommodationName,
                };
                const success = await (0, airtable_1.upsertBookingToAirtable)(dataForAirtable, config, messageId);
                if (success) {
                    processedInAirtableCount++;
                }
                else {
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
    }
    catch (error) {
        console.error('Error in main execution:', error);
        res.status(500).json({
            message: 'Error in main execution',
            error: (error instanceof Error ? error.message : String(error))
        });
    }
}
exports.processEmailsHandler = processEmailsHandler;
// Exporta la función como entry point para Google Cloud Functions
async function mailAirtableProcessor(req, res) {
    await processEmailsHandler(req, res);
}
exports.mailAirtableProcessor = mailAirtableProcessor;
// Para pruebas locales con mocks, ejecuta manualmente otro script o descomenta el bloque original si lo necesitas.
