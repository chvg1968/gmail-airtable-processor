
/**
 * @OnlyCurrentDoc
 */

// =================================================================================
// SECTION 1: CONFIGURATION & SETUP
// =================================================================================

/**
 * Carga y valida las variables de entorno desde las propiedades del script.
 * Estas propiedades deben ser configuradas en Google Apps Script:
 * File > Project Properties > Script Properties.
 *
 * Propiedades requeridas:
 * - AIRTABLE_API_KEY: Tu clave de API de Airtable.
 * - AIRTABLE_BASE_ID: El ID de tu base de Airtable.
 * - AIRTABLE_TABLE_NAME: El nombre de la tabla en Airtable.
 * - GEMINI_API_KEY: Tu clave de API para la API de Gemini.
 */
function getConfiguration() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = {
    airtableApiKey: scriptProperties.getProperty('AIRTABLE_API_KEY'),
    airtableBaseId: scriptProperties.getProperty('AIRTABLE_BASE_ID'),
    airtableTableName: scriptProperties.getProperty('AIRTABLE_TABLE_NAME'),
    geminiApiKey: scriptProperties.getProperty('GEMINI_API_KEY'),
  };

  for (const key in config) {
    if (!config[key]) {
      throw new Error(`Missing script property: ${key}`);
    }
  }
  return config;
}

// =================================================================================
// SECTION 2: DATA MAPPINGS
// =================================================================================

/**
 * Mapeos de propiedades para Vrbo y Airbnb.
 * Estos datos se utilizan para normalizar los nombres de las propiedades
 * extraídos de los correos electrónicos.
 */
const VRBO_PROPERTY_MAPPINGS = [
  { code: "4574967", name: "2-105 Ocean Grace Villa" },
  { code: "4591129", name: "2-101 Ocean Serenity Villa" },
  { code: "4616588", name: "315 Ocean View Villa" },
  { code: "3205468", name: "3325 Villa Clara" },
  { code: "3207445", name: "10180 Villa Flora" },
  { code: "3121707", name: "7256 Villa Palacio" },
  { code: "3456633", name: "5138 Villa Paloma" },
  { code: "3131031", name: "10389 Villa Tiffany" },
  { code: "3204279", name: "Atl. G7 Casa Prestige" },
  { code: "4302592", name: "2-102 Ocean Bliss Villa" },
  { code: "4414516", name: "2-208 Ocean Haven Villa" },
  { code: "4507742", name: "2-103 Ocean Sound Villa" },
];

const AIRBNB_PROPERTY_MAPPINGS = [
  { alias: "Villa Clara", name: "3325 Villa Clara" },
  { alias: "Villa Palacio", name: "7256 Villa Palacio" },
  { alias: "Casa Paraiso", name: "Est. 24 Casa Paraiso" },
  { alias: "Villa Flora", name: "10180 Villa Flora" },
  { alias: "Casa Prestige", name: "Atl. G7 Casa Prestige" },
  { alias: "Villa Paloma", name: "5138 Villa Paloma" },
  { alias: "Temporal", name: "Temporal" },
  { alias: "Ocean Bliss", name: "2-102 Ocean Bliss Villa" },
  { alias: "Villa Tiffany", name: "10389 Villa Tiffany" },
  { alias: "Ocean Haven Villa", name: "2-208 Ocean Haven Villa" },
  { alias: "Ocean Sound Villa", name: "2-103 Ocean Sound Villa" },
  { alias: "Ocean Grace Villa", name: "2-105 Ocean Grace Villa" },
  { alias: "Ocean Serenity Villa", name: "2-101 Ocean Serenity Villa" },
  { alias: "Ocean View Villa", name: "315 Ocean View Villa" },
];

// =================================================================================
// SECTION 3: UTILITY FUNCTIONS
// =================================================================================

/**
 * Convierte una cadena a "Title Case".
 * @param {string | null | undefined} str La cadena a convertir.
 * @returns {string | null | undefined} La cadena en Title Case.
 */
function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Extrae un valor numérico de un texto usando una expresión regular.
 * @param {string} text El texto de entrada.
 * @param {RegExp} regex La expresión regular a usar.
 * @returns {number | null} El valor numérico o null.
 */
function extractFee(text, regex) {
  const match = text.match(regex);
  if (match && match[1]) {
    const numericValue = parseFloat(match[1].replace(/,/g, ""));
    return Math.abs(numericValue);
  }
  return null;
}

/**
 * Extrae la tarifa de procesamiento de pagos.
 * @param {string} text El texto de entrada.
 * @param {RegExp} regex La expresión regular a usar.
 * @returns {number | "TBD" | null} El valor numérico, "TBD", o null.
 */
function extractPaymentProcessingFee(text, regex) {
  const match = text.match(regex);
  if (match && match[1]) {
    const value = match[1].trim();
    if (value.toUpperCase() === "TBD") return "TBD";
    return parseFloat(value.replace(/,/g, ""));
  }
  return null;
}

/**
 * Elimina los encabezados de reenvío de un correo.
 * @param {string} body El cuerpo del correo.
 * @returns {string} El cuerpo del correo sin encabezados de reenvío.
 */
function stripForwardHeaders(body) {
  const forwardMarker = "---------- Forwarded message ---------";
  const markerIndex = body.lastIndexOf(forwardMarker);
  if (markerIndex === -1) return body;

  const headerEndIndex = body.indexOf("\n\n", markerIndex);
  if (headerEndIndex === -1) return body;

  return body.substring(headerEndIndex).trim();
}

/**
 * Ajusta el año de una fecha de llegada para que no sea anterior a la fecha de reserva.
 * @param {string} arrivalDate La fecha de llegada (ej. "Jul 15").
 * @param {string} bookingDate La fecha de reserva (formato YYYY-MM-DD).
 * @returns {string} La fecha de llegada con el año ajustado (formato YYYY-MM-DD).
 */
function adjustArrivalYear(arrivalDate, bookingDate) {
  if (/\d{4}/.test(arrivalDate)) return arrivalDate;
  const booking = new Date(bookingDate);
  const arrivalThisYear = new Date(`${arrivalDate} ${booking.getFullYear()}`);
  if (arrivalThisYear < booking) {
    const arrivalNextYear = new Date(`${arrivalDate} ${booking.getFullYear() + 1}`);
    return arrivalNextYear.toISOString().slice(0, 10);
  }
  return arrivalThisYear.toISOString().slice(0, 10);
}

/**
 * Formatea una fecha para Airtable.
 * @param {string | null | undefined} dateString La fecha a formatear.
 * @param {string} [hourString] La hora a agregar.
 * @returns {string | null} La fecha formateada o null.
 */
function formatDateForAirtable(dateString, hourString) {
  if (!dateString) return null;
  try {
    const datePart = dateString.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) throw new Error("Invalid date format.");

    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(utcDate.getTime())) {
      Logger.log(`Invalid date: ${dateString}`);
      return null;
    }

    const finalYear = utcDate.getUTCFullYear();
    const finalMonth = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
    const finalDay = String(utcDate.getUTCDate()).padStart(2, "0");
    return hourString
      ? `${finalYear}-${finalMonth}-${finalDay}T${hourString}`
      : `${finalYear}-${finalMonth}-${finalDay}`;
  } catch (error) {
    Logger.log(`Error formatting date '${dateString}': ${error}`);
    return null;
  }
}

/**
 * Normaliza el nombre de la plataforma.
 * @param {string | undefined | null} platform La plataforma extraída.
 * @returns {string} El nombre normalizado de la plataforma.
 */
function normalizePlatform(platform) {
  const p = platform?.toLowerCase() || "desconocido";
  if (p.includes("vrbo") || p.includes("homeaway")) return "Vrbo";
  if (p.includes("airbnb")) return "Airbnb";
  return "Desconocido";
}

/**
 * Busca el nombre de la propiedad mapeada.
 * @param {string | null | undefined} accommodationNameFromGemini El nombre de la propiedad extraído.
 * @param {string | null | undefined} propertyCodeVrboFromGemini El código de la propiedad de Vrbo.
 * @param {string | null | undefined} platform La plataforma.
 * @returns {string | null} El nombre de la propiedad mapeado o null.
 */
function findPropertyMapping(accommodationNameFromGemini, propertyCodeVrboFromGemini, platform) {
  if (!platform) {
    return accommodationNameFromGemini || propertyCodeVrboFromGemini || null;
  }

  const lowerPlatform = platform.toLowerCase();

  if (lowerPlatform.includes("airbnb")) {
    if (!accommodationNameFromGemini) return null;
    const lowerAccommodationName = accommodationNameFromGemini.toLowerCase();
    const mapping = AIRBNB_PROPERTY_MAPPINGS.find((m) => {
      const aliasLower = m.alias.toLowerCase();
      return (
        lowerAccommodationName.includes(aliasLower) ||
        aliasLower.includes(lowerAccommodationName)
      );
    });
    return mapping ? mapping.name : accommodationNameFromGemini;
  } else if (
    lowerPlatform.includes("vrbo") ||
    lowerPlatform.includes("homeaway")
  ) {
    let candidate = null;
    let cleanPropertyCode = null;
    if (propertyCodeVrboFromGemini) {
      cleanPropertyCode = propertyCodeVrboFromGemini.replace("#", "");
      const mappingByCode = VRBO_PROPERTY_MAPPINGS.find((m) => m.code === cleanPropertyCode);
      candidate = mappingByCode ? mappingByCode.name : null;
    }
    if (!candidate && accommodationNameFromGemini) {
      const lowerName = accommodationNameFromGemini.toLowerCase();
      const matchByAlias = AIRBNB_PROPERTY_MAPPINGS.find((m) => {
        const aliasLower = m.alias.toLowerCase();
        return (
          lowerName.includes(aliasLower) || aliasLower.includes(lowerName)
        );
      });
      candidate = matchByAlias ? matchByAlias.name : null;
    }
    return candidate ?? cleanPropertyCode;
  }

  return accommodationNameFromGemini || propertyCodeVrboFromGemini || null;
}

// =================================================================================
// SECTION 4: EXTERNAL API SERVICES (GEMINI & AIRTABLE)
// =================================================================================

/**
 * Construye el prompt para la API de Gemini.
 * @param {string} emailBody El cuerpo del correo.
 * @param {number} referenceYear El año de referencia.
 * @returns {string} El prompt para Gemini.
 */
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
    - accommodationPrice: The total price for the entire stay, before any fees or taxes. For Airbnb, if you see a pattern like '$X.XX x N nights' or 'Accommodation: $X.XX x N nights', multiply to get the total (e.g., $894.00 x 4 nights = $3,576.00). If both total and per-night prices are present, always return the total. If only per-night and number of nights are present, multiply them.
    - adults: The number of adults.
    - children: The number of children.
    - bookingDate: The date when the booking confirmation email was originally sent. For Airbnb, if the email is a forward, search for a header block that starts with '---------- Forwarded message ---------' and extract the line starting with 'Date:'. For Vrbo, use the earliest date present in the email body that looks like a confirmation or booking date (e.g., from a header or from the booking details section). Always return the date in YYYY-MM-DD format. If not found, use the oldest date present in the email body. Prioritize the original Airbnb header date over any forward date or processing date.
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

/**
 * Extrae la información de la reserva de un correo electrónico usando la API de Gemini.
 * @param {string} emailBody El cuerpo del correo.
 * @param {string} apiKey La clave de API de Gemini.
 * @param {number} referenceYear El año de referencia.
 * @returns {Object | null} Los datos extraídos o null.
 */
function extractBookingInfoFromEmail(emailBody, apiKey, referenceYear) {
  const prompt = buildPrompt(emailBody, referenceYear);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    Logger.log("Sending request to Gemini...");
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    const responseData = JSON.parse(responseText);

    if (responseData.candidates && responseData.candidates.length > 0) {
      const content = responseData.candidates[0].content.parts[0].text;
      const jsonData = JSON.parse(content);
      Logger.log("Received JSON from Gemini.");
      return jsonData;
    } else {
      Logger.log(`Gemini API error: ${responseText}`);
      return null;
    }
  } catch (error) {
    Logger.log(`Error calling Gemini API: ${error.toString()}`);
    return null;
  }
}

/**
 * Verifica si un mensaje ya ha sido procesado en Airtable.
 * @param {string} messageId El ID del mensaje de Gmail.
 * @param {Object} config La configuración de la aplicación.
 * @returns {boolean} True si el mensaje ya fue procesado.
 */
function isMessageProcessed(messageId, config) {
  const formula = `{Gmail Message ID} = "${messageId}"`;
  const url = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}?filterByFormula=${encodeURIComponent(formula)}`;
  const options = {
    method: 'get',
    headers: {
      Authorization: `Bearer ${config.airtableApiKey}`,
    },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode >= 400) {
      Logger.log(`Error checking Airtable (HTTP ${responseCode}): ${responseBody}`);
      return false; // Asumir que no está procesado si hay un error de API
    }

    const data = JSON.parse(responseBody);
    return data.records && data.records.length > 0;
  } catch (error) {
    Logger.log(`Error during Airtable check for messageId ${messageId}: ${error.toString()}`);
    return false; // Asumir que no está procesado si hay un error
  }
}

/**
 * Inserta o actualiza una reserva en Airtable.
 * @param {Object} rawData Los datos extraídos de la reserva.
 * @param {Object} config La configuración de la aplicación.
 * @param {string} messageId El ID del mensaje de Gmail.
 * @returns {boolean} True si la operación fue exitosa.
 */
function upsertBookingToAirtable(rawData, config, messageId) {
  const platform = normalizePlatform(rawData.platform?.[0]);
  const propertyName = findPropertyMapping(
    rawData.accommodationName,
    rawData.propertyCodeVrbo,
    platform
  );

  const clubFee = typeof rawData.clubFee === 'number' ? rawData.clubFee : 0;
  let accommodationPrice = rawData.accommodationPrice ?? 0;
  if (platform === "Vrbo") {
    accommodationPrice += clubFee;
  }

  const baseCommission = typeof rawData.baseCommissionOrHostFee === 'number' ? rawData.baseCommissionOrHostFee : null;
  const paymentProcessingFees = typeof rawData.paymentProcessingFee === 'number' ? rawData.paymentProcessingFee : null;
  const vrboReviewNeeded = platform === "Vrbo" && !(baseCommission && paymentProcessingFees);

  const airtableFields = {
    "Full Name": rawData.guestName,
    Platform: platform,
    "Reservation number": rawData.reservationNumber,
    Arrival: formatDateForAirtable(rawData.checkInDate, "15:00:00"),
    "Departure Date": formatDateForAirtable(rawData.checkOutDate, "10:00:00"),
    Property: propertyName,
    Accommodation: accommodationPrice,
    Adults: rawData.adults ?? 0,
    Children: rawData.children ?? 0,
    "Booking Date": rawData.bookingDate || null,
    Discount: rawData.discountAmount ?? 0,
    "Cleaning Fee": rawData.cleaningFee ?? 0,
    "Guest Service": rawData.guestServiceFee ?? 0,
    Taxes: rawData.taxesAmount ?? 0,
    "D. Protection": rawData.damageProtectionFee ?? 0,
    "Vrbo value 1 or Airbnb value": baseCommission ?? 0,
    "Vrbo value 2": rawData.paymentProcessingFee === "TBD" ? 0 : (paymentProcessingFees ?? 0),
    "Gmail Message ID": messageId,
    "Needs Date Review": (() => {
      try {
        if (platform.toLowerCase() !== "airbnb") return false;
        if (!rawData.checkInDate) return false;
        const checkIn = new Date(rawData.checkInDate);
        const bookingDate = rawData.bookingDate ? new Date(rawData.bookingDate) : new Date();
        const days = Math.ceil((checkIn.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days < 0 || checkIn.getFullYear() === 2026 || days > 330) return true;
        return false;
      } catch (error) {
        return false;
      }
    })(),
    "Vrbo Review": vrboReviewNeeded,
  };

  for (const key in airtableFields) {
    if (airtableFields[key] === null || airtableFields[key] === undefined) {
      delete airtableFields[key];
    }
  }

  const reservationNumberToSearch = rawData.reservationNumber;
  if (!reservationNumberToSearch?.trim()) {
    Logger.log(`Invalid reservation number: '${reservationNumberToSearch}'`);
    return false;
  }

  const filterFormula = `AND({Reservation number} = "${reservationNumberToSearch.replace(/"/g, '\\"')}", {Platform} = "${platform}")`;
  const getUrl = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}?filterByFormula=${encodeURIComponent(filterFormula)}`;
  const getOptions = {
    method: 'get',
    headers: { Authorization: `Bearer ${config.airtableApiKey}` },
    muteHttpExceptions: true,
  };

  try {
    const getResponse = UrlFetchApp.fetch(getUrl, getOptions);
    const existingRecords = JSON.parse(getResponse.getContentText()).records;

    if (existingRecords && existingRecords.length > 0) {
      const recordId = existingRecords[0].id;
      Logger.log(`Updating existing reservation in Airtable: ${reservationNumberToSearch}`);
      const patchUrl = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}/${recordId}`;
      const patchOptions = {
        method: 'patch',
        contentType: 'application/json',
        headers: { Authorization: `Bearer ${config.airtableApiKey}` },
        payload: JSON.stringify({ fields: airtableFields }),
      };
      UrlFetchApp.fetch(patchUrl, patchOptions);
      Logger.log("Update successful.");
    } else {
      Logger.log(`Creating new reservation in Airtable: ${reservationNumberToSearch}`);
      const postUrl = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}`;
      const postOptions = {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: `Bearer ${config.airtableApiKey}` },
        payload: JSON.stringify({ records: [{ fields: airtableFields }] }),
      };
      UrlFetchApp.fetch(postUrl, postOptions);
      Logger.log("Creation successful.");
    }
    return true;
  } catch (error) {
    Logger.log(`Error upserting to Airtable for ${reservationNumberToSearch}: ${error}`);
    return false;
  }
}

// =================================================================================
// SECTION 5: MAIN PROCESSING LOGIC
// =================================================================================

/**
 * Función principal que se ejecuta para procesar los correos electrónicos.
 */
function processEmails() {
  let config;
  try {
    config = getConfiguration();
  } catch (error) {
    Logger.log(`Error initializing config: ${error.message}`);
    return;
  }

  Logger.log("Starting Gmail-Airtable email processor...");

  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const searchSinceDateString = `${twoDaysAgo.getFullYear()}/${String(twoDaysAgo.getMonth() + 1).padStart(2, "0")}/${String(twoDaysAgo.getDate()).padStart(2, "0")}`;

    Logger.log(`Searching emails since ${searchSinceDateString}`);
    const query = `({from:no-reply@airbnb.com subject:("Reservation confirmed" OR "Booking Confirmation")} OR {from:(no-reply@vrbo.com OR no-reply@homeaway.com OR luxeprbahia@gmail.com) (subject:("Instant Booking") "Your booking is confirmed" OR subject:("Reservation from"))}) after:${searchSinceDateString}`;
    
    const threads = GmailApp.search(query);
    const messages = threads.flatMap(thread => thread.getMessages());
    Logger.log(`Found ${messages.length} emails.`);

    const processedReservations = new Set();
    let skippedCount = 0;
    let processedInAirtableCount = 0;

    if (messages.length === 0) {
      Logger.log("No new emails to process.");
    } else {
      for (const message of messages) {
        const messageId = message.getId();
        Logger.log(`--- Processing email (ID: ${messageId}) ---`);

        if (isMessageProcessed(messageId, config)) {
          Logger.log(`SKIPPED: Email already processed (messageId=${messageId}).`);
          skippedCount++;
          continue;
        }

        const emailBody = message.getBody();
        const cleanedBody = stripForwardHeaders(emailBody);
        
        const extractedData = extractBookingInfoFromEmail(cleanedBody, config.geminiApiKey, new Date().getFullYear());

        if (extractedData) {
          const subject = message.getSubject();
          const extractNameFromSubject = (subject) => {
            const vrboMatch = subject.match(/from\s+([^:]+):/i);
            if (vrboMatch && vrboMatch[1]) return toTitleCase(vrboMatch[1].trim());
            const airbnbMatch = subject.match(/ - (.+?) (?:arrives|llega)/i) || subject.match(/ - (.+)$/i);
            return airbnbMatch && airbnbMatch[1] ? toTitleCase(airbnbMatch[1].trim()) : null;
          };
          const nameFromSubject = extractNameFromSubject(subject);

          if (!extractedData.guestName && nameFromSubject) {
            extractedData.guestName = nameFromSubject;
          } else if (extractedData.guestName && !extractedData.guestName.includes(" ") && nameFromSubject && nameFromSubject.toLowerCase().startsWith(extractedData.guestName.toLowerCase()) && nameFromSubject.includes(" ")) {
            extractedData.guestName = nameFromSubject;
          }

          if (!extractedData.bookingDate) {
            const headerDate = message.getDate();
            if (headerDate && !isNaN(headerDate.getTime())) {
              extractedData.bookingDate = headerDate.toISOString().slice(0, 10);
            }
          }
        }

        if (!extractedData || !extractedData.reservationNumber) {
          Logger.log(`SKIPPED: Could not extract reservation number from messageId=${messageId}.`);
          skippedCount++;
          continue;
        }

        const platformStr = Array.isArray(extractedData.platform) ? extractedData.platform[0] : extractedData.platform;
        if (platformStr && typeof platformStr === 'string' && platformStr.toLowerCase() === 'airbnb' && extractedData.checkInDate && extractedData.bookingDate) {
          if (!/\d{4}/.test(extractedData.checkInDate)) {
            extractedData.checkInDate = adjustArrivalYear(extractedData.checkInDate, extractedData.bookingDate);
          }
        }

        const platform = extractedData.platform?.[0] || "Desconocido";
        const reservationKey = `${extractedData.reservationNumber}::${platform}`;

        if (processedReservations.has(reservationKey)) {
          Logger.log(`SKIPPED: Duplicate reservation detected in this run: ${reservationKey}.`);
          skippedCount++;
          continue;
        }
        processedReservations.add(reservationKey);

        const airbnbHostFeeRegex = /Host service fee \(3\.0%\)[\s\S]*?-\$([\d,]+\.\d{2})/;
        const vrboBaseCommissionRegex = /Base commission[\s\S]*?\$([\d,]+\.\d{2})/;
        const vrboPaymentProcessingFeeRegex = /Payment processing fees\*[\s\S]*?\$?([\d,]+\.\d{2}|TBD)/;

        extractedData.baseCommissionOrHostFee = platform.toLowerCase() === "airbnb" ? extractFee(emailBody, airbnbHostFeeRegex) : extractFee(emailBody, vrboBaseCommissionRegex);
        extractedData.paymentProcessingFee = platform.toLowerCase().startsWith("vrbo") ? extractPaymentProcessingFee(emailBody, vrboPaymentProcessingFeeRegex) : 0;

        let bookingDateFinal = extractedData.bookingDate;
        if (platform.toLowerCase() === "vrbo") {
          const headerDate = message.getDate();
          if (headerDate && !isNaN(headerDate.getTime())) {
            bookingDateFinal = headerDate.toISOString().slice(0, 10);
          }
        }

        const dataForAirtable = {
          ...extractedData,
          bookingDate: bookingDateFinal,
          guestName: toTitleCase(extractedData.guestName),
        };

        const success = upsertBookingToAirtable(dataForAirtable, config, messageId);
        if (success) {
          processedInAirtableCount++;
        } else {
          skippedCount++;
        }
      }
    }

    Logger.log(`
[PROCESSING SUMMARY]
----------------------------------------
Emails Found: ${messages.length}
Reservations Processed in Airtable: ${processedInAirtableCount}
Skipped Emails/Reservations: ${skippedCount}
----------------------------------------
`);

  } catch (error) {
    Logger.log(`Error in main execution: ${error.toString()}`);
  }
}
