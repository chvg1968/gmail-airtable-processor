"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEmailsHandler = void 0;
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
// --- INICIO: Bloque de extracción con RegEx para tarifas ---
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
        if (value.toUpperCase() === 'TBD') {
            return 'TBD';
        }
        return parseFloat(value.replace(/,/g, ''));
    }
    return null;
};
const airbnbHostFeeRegex = /Host service fee \(3\.0%\)[\s\S]*?-\$([\d,]+\.\d{2})/;
const vrboBaseCommissionRegex = /Base commission[\s\S]*?\$([\d,]+\.\d{2})/;
const vrboPaymentProcessingFeeRegex = /Payment processing fees\*[\s\S]*?\$?([\d,]+\.\d{2}|TBD)/;
// --- FIN: Bloque de extracción con RegEx para tarifas ---
// --- INICIO: Lógica de mapeo de propiedades ---
function findPropertyMapping(platformFromGemini, accommodationNameFromGemini, // Corrected: Was propertyNameFromGemini, now maps to ExtractedBookingData.accommodationName
propertyCodeVrboFromGemini) {
    if (platformFromGemini && (platformFromGemini.toLowerCase() === 'vrbo' || platformFromGemini.toLowerCase() === 'homeaway')) {
        console.log(`DEBUG findPropertyMapping: Received propertyCodeVrboFromGemini: '${propertyCodeVrboFromGemini}' for platform: ${platformFromGemini}`);
        if (propertyCodeVrboFromGemini) {
            const codeToSearch = propertyCodeVrboFromGemini.replace(/^#/, '').toLowerCase(); // Eliminar # y asegurar minúsculas
            const property = propertyMappings_1.vrboPropertyMappings.find((p) => p.code.toLowerCase() === codeToSearch);
            if (property) {
                console.log(`DEBUG findPropertyMapping: Vrbo mapping found: Code '${propertyCodeVrboFromGemini}' maps to Name '${property.name}'`);
                console.log(`DEBUG findPropertyMapping: EXITING with Vrbo Name: '${property.name}'`);
                return property.name;
            }
            else {
                console.log(`DEBUG findPropertyMapping: Vrbo mapping NOT found for Code '${propertyCodeVrboFromGemini}' in Vrbo_properties list.`);
                console.log(`DEBUG findPropertyMapping: EXITING with null (Vrbo property not found by code)`);
                return null;
            }
        }
        else {
            console.log(`DEBUG findPropertyMapping: propertyCodeVrboFromGemini is null or undefined for Vrbo/Homeaway platform.`);
            console.log(`DEBUG findPropertyMapping: EXITING with null (Vrbo code was null)`);
            return null;
        }
    }
    if (!platformFromGemini)
        return null;
    const platform = platformFromGemini.toLowerCase();
    if (platform === 'airbnb') {
        console.log(`DEBUG findPropertyMapping: Received accommodationNameFromGemini: '${accommodationNameFromGemini}' for platform: Airbnb`);
        if (!accommodationNameFromGemini) {
            console.log(`DEBUG findPropertyMapping: accommodationNameFromGemini is null. EXITING with null.`);
            return null;
        }
        const nameToSearch = accommodationNameFromGemini.toLowerCase();
        const found = propertyMappings_1.airbnbPropertyMappings.find((p) => nameToSearch.includes(p.alias.toLowerCase()));
        if (found) {
            console.log(`DEBUG findPropertyMapping: Airbnb mapping found: Name '${accommodationNameFromGemini}' includes alias '${found.alias}'. Returning mapped name '${found.name}'`);
        }
        else {
            console.log(`DEBUG findPropertyMapping: No Airbnb mapping found for '${accommodationNameFromGemini}'`);
        }
        return found ? found.name : null;
    }
    else if (platform === 'vrbo' || platform === 'homeaway') {
        if (!propertyCodeVrboFromGemini)
            return null;
        const codeToSearch = propertyCodeVrboFromGemini.toLowerCase();
        // Corrected: VrboProperty uses 'code' for matching and 'name' for the value to return
        const found = propertyMappings_1.vrboPropertyMappings.find((p) => p.code.toLowerCase() === codeToSearch);
        return found ? found.name : null; // Corrected: Return p.name as per VrboProperty interface
    }
    return null;
}
// --- FIN: Lógica de mapeo de propiedades ---
async function processEmailsHandler(req, res) {
    let config;
    try {
        config = await (0, config_1.getInitializedConfig)();
    }
    catch (error) {
        console.error('Error al inicializar la configuración:', error);
        res.status(500).send('Error al inicializar la configuración: ' + (error instanceof Error ? error.message : String(error)));
        return;
    }
    console.log('¡Hola desde el procesador de correos Gmail-Airtable!');
    try {
        console.log('Intentando conectar a Gmail...');
        await (0, gmail_1.getGmailProfile)();
        console.log('Conexión a Gmail exitosa.');
        // Calcula la fecha de hace ~24 horas para la búsqueda de correos
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);
        const year = twentyFourHoursAgo.getFullYear();
        const month = (twentyFourHoursAgo.getMonth() + 1).toString().padStart(2, '0');
        const day = twentyFourHoursAgo.getDate().toString().padStart(2, '0');
        const searchSinceDateString = `${year}/${month}/${day}`; // Formato YYYY/MM/DD
        console.log(`INFO: Buscando correos desde ${searchSinceDateString} (últimas ~24 horas)`);
        const query = `({from:no-reply@airbnb.com subject:("Reservation confirmed" OR "Booking Confirmation")} OR {from:(no-reply@vrbo.com OR no-reply@homeaway.com OR luxeprbahia@gmail.com) (subject:("Instant Booking") "Your booking is confirmed" OR subject:("Reservation from"))}) after:${searchSinceDateString}`;
        console.log(`Buscando correos con query: ${query}`);
        const messages = await (0, gmail_1.searchEmails)(query);
        console.log(`Se encontraron ${messages ? messages.length : 0} correos.`);
        const successfulAirtableUpserts = new Set();
        let processedEmailCount = 0;
        let skippedCount = 0;
        if (messages && messages.length > 0) {
            for (const messageMeta of messages) {
                processedEmailCount++;
                console.log(`--- Procesando correo ${processedEmailCount} de ${messages.length} (ID: ${messageMeta.id}) ---`);
                if (!messageMeta.id) {
                    console.log('[PROCESO] OMITIDO: Se encontró un mensaje sin ID.');
                    skippedCount++;
                    continue;
                }
                const emailContent = await (0, gmail_1.getEmailContent)(messageMeta.id);
                if (emailContent && emailContent.body) {
                    let originalFrom = emailContent.from || 'desconocido';
                    const emailMatch = originalFrom.match(/<([^>]+)>/);
                    if (emailMatch && emailMatch[1]) {
                        originalFrom = emailMatch[1];
                    }
                    let originalBody = emailContent.body;
                    // --- INICIO: Lógica mejorada para correos reenviados ---
                    let isForwarded = false;
                    let headerEndPosition = -1;
                    if (originalBody.startsWith('---------- Forwarded message ---------')) {
                        isForwarded = true;
                        // El final de las cabeceras es el doble <br>
                        headerEndPosition = originalBody.indexOf('<br><br>');
                    }
                    else if (originalBody.startsWith('Begin forwarded message:')) {
                        isForwarded = true;
                        // El final de las cabeceras es la línea Reply-To:
                        const replyToPosition = originalBody.indexOf('Reply-To:');
                        if (replyToPosition > -1) {
                            const endOfLine = originalBody.indexOf('<br>', replyToPosition);
                            headerEndPosition = endOfLine > -1 ? endOfLine : -1;
                        }
                    }
                    if (isForwarded && headerEndPosition > -1) {
                        console.log('INFO: Correo reenviado detectado. Extrayendo contenido original...');
                        const headerBlock = originalBody.substring(0, headerEndPosition);
                        const fromHeaderMatchInForward = headerBlock.match(/From:\s*.*<([^>]+)>/);
                        if (fromHeaderMatchInForward && fromHeaderMatchInForward[1]) {
                            originalFrom = fromHeaderMatchInForward[1].trim();
                        }
                        console.log(`INFO: Contenido original extraído. Remitente (posiblemente reenviado) limpio: ${originalFrom}`);
                        originalBody = originalBody.substring(headerEndPosition).replace(/^(<br>\s*)+/, '');
                    }
                    // --- FIN: Lógica mejorada para correos reenviados ---
                    if (originalBody) {
                        const currentYear = new Date().getFullYear();
                        console.log('Enviando texto a Gemini para extracción...');
                        let extractedData = await (0, gemini_1.extractBookingInfoFromEmail)(originalBody, config.geminiApiKey, currentYear);
                        // console.log(`DEBUG: Raw extracted data from Gemini for message ${message.id}:`, JSON.stringify(extractedData, null, 2)); // Corrected and temporarily commented out
                        console.log('Respuesta JSON de Gemini recibida.');
                        if (extractedData && extractedData.error) {
                            console.log(`INFO: Gemini omitió el correo: ${extractedData.error}`);
                            extractedData = null;
                        }
                        if (extractedData && extractedData.reservationNumber) {
                            // Fallback for Booking Date for Vrbo using email's internalDate
                            if (emailContent && (!extractedData.bookingDate || extractedData.bookingDate.trim() === '') &&
                                extractedData.platform && (extractedData.platform.includes('Vrbo') || extractedData.platform.includes('HomeAway'))) {
                                if (emailContent.internalDate) {
                                    const dateFromTimestamp = new Date(parseInt(emailContent.internalDate, 10));
                                    extractedData.bookingDate = dateFromTimestamp.toISOString().split('T')[0]; // Formato YYYY-MM-DD
                                    console.log(`INFO: Using email reception date (${extractedData.bookingDate}) as Booking Date for Vrbo reservation ${extractedData.reservationNumber}`);
                                }
                            }
                            let extractedBaseOrHostFee = 0;
                            let extractedPaymentProcessingFee = 0;
                            if (extractedData.platform && extractedData.platform.length > 0) {
                                const platform = extractedData.platform[0].toLowerCase();
                                console.log(`DEBUG: Plataforma detectada por Gemini: ${platform}. Buscando tarifas...`);
                                if (platform === 'airbnb') {
                                    extractedBaseOrHostFee = extractFee(originalBody, airbnbHostFeeRegex) ?? 0;
                                    console.log(`DEBUG: \"Host service fee\" de Airbnb extraído: ${extractedBaseOrHostFee}`);
                                }
                                else if (platform === 'vrbo' || platform === 'homeaway') {
                                    extractedBaseOrHostFee = extractFee(originalBody, vrboBaseCommissionRegex) ?? 0;
                                    console.log(`DEBUG: \"Base commission\" de Vrbo extraída: ${extractedBaseOrHostFee}`);
                                    extractedPaymentProcessingFee = extractPaymentProcessingFee(originalBody, vrboPaymentProcessingFeeRegex) ?? 0;
                                    console.log(`DEBUG: \"Payment processing fees\" de Vrbo extraído: ${extractedPaymentProcessingFee}`);
                                }
                            }
                            else {
                                console.log('DEBUG: Gemini no detectó una plataforma, no se pueden extraer tarifas adicionales.');
                            }
                            // Corrected: Use extractedData.accommodationName for the property name from Gemini
                            const propertyMapping = findPropertyMapping((extractedData.platform && extractedData.platform.length > 0) ? extractedData.platform[0] : null, extractedData.accommodationName || null, // Forcing type for persistent error
                            extractedData.propertyCodeVrbo || null);
                            const guestNameToSave = toTitleCase(extractedData.guestName);
                            let finalCheckInDate = extractedData.checkInDate;
                            let finalCheckOutDate = extractedData.checkOutDate;
                            let needsDateReview = false;
                            if (extractedData.platform && extractedData.platform[0]?.toLowerCase() === 'airbnb' && extractedData.checkInDate && emailContent.internalDate) {
                                const emailReceivedDate = new Date(parseInt(emailContent.internalDate, 10));
                                emailReceivedDate.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparar solo fechas
                                const checkInParts = extractedData.checkInDate.split('-'); // YYYY-MM-DD
                                const checkInMonth = parseInt(checkInParts[1], 10) - 1; // Meses son 0-indexados
                                const checkInDay = parseInt(checkInParts[2], 10);
                                const emailYear = emailReceivedDate.getFullYear();
                                let candidate1CheckIn = new Date(emailYear, checkInMonth, checkInDay);
                                let candidate2CheckIn = new Date(emailYear + 1, checkInMonth, checkInDay);
                                let chosenCheckInDate;
                                if (candidate1CheckIn >= emailReceivedDate) {
                                    chosenCheckInDate = candidate1CheckIn;
                                }
                                else {
                                    chosenCheckInDate = candidate2CheckIn;
                                }
                                // Actualizar extractedData con el año correcto para checkIn y checkOut
                                const chosenYear = chosenCheckInDate.getFullYear();
                                finalCheckInDate = `${chosenYear}-${(checkInMonth + 1).toString().padStart(2, '0')}-${checkInDay.toString().padStart(2, '0')}`;
                                if (extractedData.checkOutDate) {
                                    const checkOutParts = extractedData.checkOutDate.split('-');
                                    finalCheckOutDate = `${chosenYear}-${checkOutParts[1]}-${checkOutParts[2]}`;
                                    // Ajuste para checkouts que cruzan al siguiente año (ej. check-in Dic, check-out Ene)
                                    const tempFinalCheckOut = new Date(chosenYear, parseInt(checkOutParts[1], 10) - 1, parseInt(checkOutParts[2], 10));
                                    if (tempFinalCheckOut < chosenCheckInDate) { // Si checkout es anterior a checkin, significa que es del año siguiente
                                        finalCheckOutDate = `${chosenYear + 1}-${checkOutParts[1]}-${checkOutParts[2]}`;
                                    }
                                }
                                extractedData.checkInDate = finalCheckInDate;
                                extractedData.checkOutDate = finalCheckOutDate;
                                // Detección del caso límite (más de ~11 meses en el futuro)
                                const diffTime = Math.abs(chosenCheckInDate.getTime() - emailReceivedDate.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                if (diffDays > 330) {
                                    console.log(`INFO: Caso límite detectado para Airbnb. Reserva ${extractedData.reservationNumber} con check-in ${finalCheckInDate} recibida el ${emailReceivedDate.toISOString().split('T')[0]}. Marcando para revisión.`);
                                    needsDateReview = true;
                                }
                            }
                            // Append specific times for Airtable
                            if (extractedData.checkInDate && !extractedData.checkInDate.includes('T')) {
                                extractedData.checkInDate += "T15:00:00.000Z";
                            }
                            if (extractedData.checkOutDate && !extractedData.checkOutDate.includes('T')) {
                                extractedData.checkOutDate += "T10:00:00.000Z";
                            }
                            // Sumar clubFee a accommodationPrice si existe
                            if (typeof extractedData.clubFee === 'number') {
                                extractedData.accommodationPrice = (extractedData.accommodationPrice || 0) + extractedData.clubFee;
                            }
                            const dataForAirtable = {
                                ...extractedData,
                                guestName: guestNameToSave,
                                accommodationName: propertyMapping || extractedData.accommodationName,
                                baseCommissionOrHostFee: extractedBaseOrHostFee,
                                paymentProcessingFee: extractedPaymentProcessingFee,
                                NeedsDateReview: needsDateReview,
                            };
                            const success = await (0, airtable_1.upsertBookingToAirtable)(dataForAirtable, config);
                            if (success && extractedData.reservationNumber) {
                                successfulAirtableUpserts.add(extractedData.reservationNumber);
                            }
                            else {
                                // Si success es false, upsertBookingToAirtable ya habrá logueado un error
                                // o es un caso donde no se pudo determinar el reservationNumber antes de llamar a upsert.
                                // skippedCount se calculará al final
                            }
                        }
                        else {
                            console.log(`[PROCESO] OMITIDO: No se pudieron extraer datos con Gemini para el mensaje ID: ${messageMeta.id}`);
                            skippedCount++;
                        }
                    }
                    else {
                        console.log(`[PROCESO] OMITIDO: No se pudo obtener el contenido o el cuerpo para el mensaje ID: ${messageMeta.id}`);
                        skippedCount++;
                    }
                }
                else {
                    console.log(`[PROCESO] OMITIDO: No se pudo obtener el contenido completo (body) para el mensaje ID: ${messageMeta.id}`);
                    skippedCount++;
                }
            }
        }
        const totalMessagesFound = messages ? messages.length : 0;
        const processedInAirtableCount = successfulAirtableUpserts.size;
        const summaryMessage = `
\n[RESUMEN DE PROCESAMIENTO]
----------------------------------------
Correos encontrados en Gmail: ${totalMessagesFound}
Registros únicos en Airtable (creados/actualizados): ${processedInAirtableCount}
Correos omitidos (sin cuerpo, sin ID, o sin datos extraíbles): ${skippedCount}
----------------------------------------
`;
        console.log(summaryMessage);
        res.status(200).send('Procesamiento de correos completado. Revisa los logs para el resumen.');
    }
    catch (error) {
        console.error('Error en la ejecución principal:', error);
        res.status(500).send('Error en la ejecución principal: ' + (error instanceof Error ? error.message : String(error)));
    }
}
exports.processEmailsHandler = processEmailsHandler;
if (require.main === module) {
    console.log("<<<<< INICIANDO EJECUCIÓN LOCAL (npm run dev) >>>>>");
    const mockReq = {};
    const mockRes = {
        status: (code) => {
            console.log(`[Local Execution] res.status: ${code}`);
            return {
                send: (message) => { }
            };
        },
        send: (message) => { }
    };
    processEmailsHandler(mockReq, mockRes)
        .then(() => {
        console.log("<<<<< EJECUCIÓN LOCAL COMPLETADA (npm run dev) >>>>>");
    })
        .catch(error => {
        console.error("<<<<< ERROR EN EJECUCIÓN LOCAL (npm run dev) >>>>>", error);
        process.exit(1);
    });
}
