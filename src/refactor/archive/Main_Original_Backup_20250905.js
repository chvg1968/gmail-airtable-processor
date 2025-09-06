/* global Logger CONFIG EmailService AirtableService Parser GeminiService PropertyService NameEnhancementService */

// === IMPORTS ===
const EmailUtils = require('./utils/EmailUtils');
const EmailFilters = require('./filters/EmailFilters');
const DuplicateDetector = require('./duplicates/DuplicateDetector');
const LodgifyProcessor = require('./processors/LodgifyProcessor');
const AirbnbProcessor = require('./processors/AirbnbProcessor');

// === LEGACY UTILITY FUNCTIONS (TO BE DEPRECATED) ===

// Helper a nivel de módulo: extracción de Reservation number desde subject/body por plataforma
function extractReservationNumber(pf, subj, bod) {
  try {
    const s = subj || "";
    const b = bod || "";
    const text = `${s}\n${b}`;
    const patterns = [];
    if (/airbnb/i.test(pf)) {
      patterns.push(
        /(?:Reservation|Confirmation)\s*(?:code|number|#)?[:\s-]*([A-Z0-9]{6,10})/i,
      );
      patterns.push(/Code[:\s-]*([A-Z0-9]{6,10})/i);
    } else if (/vrbo|homeaway/i.test(pf)) {
      // Permit optional leading letter and optional '#'
      patterns.push(
        /(?:Reservation|Itinerary|Confirmation)\s*#?[:\s-]*([A-Z]?[0-9]{6,})/i,
      );
    } else if (/lodgify/i.test(pf)) {
      // Formats like "#B15695014" or "( #B15695014 )"
      patterns.push(
        /(?:Reservation|Booking)\s*(?:ID|Number)?\s*#?[:\s-]*([A-Z]?[0-9]{6,})/i,
      );
      patterns.push(/reservation\s+#?\s*([A-Z]?[0-9]{6,})/i);
    }
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m && m[1]) return m[1].trim();
    }
    return "";
  } catch (_) {
    return "";
  }
}

// === EMAIL FILTERS ===

/**
 * Verifica si el correo debe ser omitido por ser de soporte/help
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @returns {boolean}
 */
function shouldSkipSupportEmail(from, subject) {
  if (/help@lodgify\.com/i.test(from)) {
    return true;
  }

  const nonBooking =
    (/help@lodgify\.com/i.test(from) &&
      /There is an update for your request|How would you rate the support/i.test(subject)) ||
    (/automated@airbnb\.com/i.test(from) &&
      /Actividad de la cuenta|Account activity|inicio de sesi[oó]n/i.test(subject)) ||
    (/propertymanagers\.lodgify\.com/i.test(from) &&
      /Check-?in completed|Check-?out completed|Check-?in reminder/i.test(subject));

  return nonBooking;
}

/**
 * Verifica si el correo es de soporte/actualización
 * @param {string} subject - Asunto del correo
 * @returns {boolean}
 */
function isSupportOrUpdateEmail(subject) {
  return (
    /re:\s*(?:lodgify|\[lodgify\])/i.test(subject) ||
    /update.*request/i.test(subject) ||
    /pending request/i.test(subject) ||
    /unable to send/i.test(subject) ||
    /will deleting photos/i.test(subject) ||
    /support.*ticket/i.test(subject) ||
    /help.*request/i.test(subject)
  );
}

/**
 * Verifica si el correo es claramente no relacionado con reservas
 * @param {string} subject - Asunto del correo
 * @returns {boolean}
 */
function isNonReservationEmail(subject) {
  const isNonReservation =
    /question/i.test(subject) ||
    /inquiry/i.test(subject) ||
    /support/i.test(subject) ||
    /help/i.test(subject) ||
    /issue/i.test(subject) ||
    /problem/i.test(subject);

  return isNonReservation && !/reservation|booking|confirmed/i.test(subject);
}

/**
 * Verifica si el correo es un reenvío que debe ser omitido
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @returns {boolean}
 */
function shouldSkipForwardedEmail(from, subject) {
  // Correos reenviados de Airbnb
  const isForwardedAirbnb =
    /^fwd:/i.test(subject) &&
    (/airbnb/i.test(from) || /reservation confirmed.*arrives/i.test(subject));

  // Correos reenviados con información de reservas
  const isForwardedWithReservationInfo =
    /^fwd:/i.test(subject) &&
    /reservation|booking|arrives|nights|arrival/i.test(subject) &&
    !/confirmed|new confirmed|instant booking/i.test(subject);

  // Correos con números de reserva pero NO confirmaciones
  const hasReservationNumberButNotConfirmation =
    /#[A-Z0-9]+/i.test(subject) &&
    !/confirmed|new confirmed|instant booking/i.test(subject) &&
    /^fwd:|^re:/i.test(subject);

  // Correos de reenvío que no son confirmaciones originales
  const isForwardedNonConfirmation =
    /^fwd:/i.test(subject) &&
    !/reservation confirmed|new confirmed booking|instant booking/i.test(subject);

  return (
    isForwardedAirbnb ||
    isForwardedWithReservationInfo ||
    hasReservationNumberButNotConfirmation ||
    isForwardedNonConfirmation
  );
}

/**
 * Verifica si el correo de Lodgify debe ser omitido
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @returns {boolean}
 */
// === LODGIFY PROCESSING ===

/**
 * Extrae primer nombre y fecha de arrival del subject de Lodgify
 * @param {string} subject - Asunto del correo de Lodgify
 * @returns {Object} { firstName: string, arrivalDate: string }
 */
function extractLodgifySubjectData(subject) {
  const lodgifySubjectMatch = subject.match(
    /New Confirmed Booking:\s*(\w+)\s*\(.*Arrival:\s*([A-Za-z]{3} \d{2} \d{4})/i,
  );
  
  let lodgifyFirst = "";
  let lodgifyArrival = "";
  
  if (lodgifySubjectMatch) {
    lodgifyFirst = lodgifySubjectMatch[1].toLowerCase();
    lodgifyArrival = lodgifySubjectMatch[2]; // Ej: Sep 04 2025
  }
  
  // Normalizar fecha a YYYY-MM-DD
  let lodgifyArrivalISO = "";
  if (lodgifyArrival) {
    const d = new Date(lodgifyArrival);
    if (!isNaN(d.getTime())) {
      lodgifyArrivalISO = d.toISOString().slice(0, 10);
    }
  }
  
  return {
    firstName: lodgifyFirst,
    arrivalDate: lodgifyArrivalISO,
  };
}

/**
 * Verifica si un correo de Lodgify debe ser omitido por existir reserva de Airbnb coincidente
 * @param {string} subject - Asunto del correo de Lodgify
 * @param {Set} airbnbReservations - Set de reservas de Airbnb procesadas
 * @returns {boolean}
 */
function shouldSkipLodgifyDuplicate(subject, airbnbReservations) {
  const { firstName: lodgifyFirst, arrivalDate: lodgifyArrivalISO } = 
    extractLodgifySubjectData(subject);
  
  // Buscar coincidencia en reservas de Airbnb
  for (const abKey of airbnbReservations) {
    const [abName, abCi] = abKey.split("::");
    const airbnbFirst = abName ? getFirstName(abName) : "";
    const airbnbArrivalISO = abCi ? normalizeToISODate(abCi) : "";
    
    if (
      lodgifyFirst &&
      airbnbFirst &&
      lodgifyFirst === airbnbFirst &&
      lodgifyArrivalISO &&
      airbnbArrivalISO &&
      lodgifyArrivalISO === airbnbArrivalISO
    ) {
      return true;
    }
  }
  
  return false;
}

// === DTO PROCESSING ===

/**
 * Procesa un correo de Airbnb para extraer el DTO
 * @param {Object} msg - Mensaje de Gmail
 * @param {string} body - Cuerpo del correo
 * @param {string} subject - Asunto del correo
 * @param {string} from - Remitente del correo
 * @returns {Object|null} DTO procesado o null si falla
 */
function processAirbnbEmail(msg, body, subject, from) {
  Logger.log("[Main] Usando Gemini para extraer datos: %s", subject);
  const year = new Date().getFullYear();
  let dto = GeminiService.extract(body, CONFIG.geminiApiKey, year);
  
  if (!dto) {
    Logger.log("[Main] Gemini no pudo extraer DTO: %s", subject);
    return null;
  }

  // Si es Airbnb y tenemos datos del parser específico, combinarlos
  if (isEmailFromPlatform(from, subject, "airbnb")) {
    Logger.log("[Main] Intentando enriquecer datos de Airbnb para: %s", subject);
    const airbnbData = Parser.parseAirbnbEmail(body);

    // Si el parser de Airbnb extrajo datos útiles, combinarlos
    if (airbnbData && (airbnbData.guestService || airbnbData.baseCommissionOrHostFee)) {
      Logger.log(
        "[Main] Parser de Airbnb extrajo datos: guestService=%s, hostFee=%s",
        airbnbData.guestService,
        airbnbData.baseCommissionOrHostFee,
      );

      if (airbnbData.guestService) dto.guestService = airbnbData.guestService;
      if (airbnbData.baseCommissionOrHostFee)
        dto.baseCommissionOrHostFee = airbnbData.baseCommissionOrHostFee;
      if (airbnbData.accommodationPrice)
        dto.accommodationPrice = airbnbData.accommodationPrice;
      if (airbnbData.cleaningFee) dto.cleaningFee = airbnbData.cleaningFee;
      if (airbnbData.taxesAmount) dto.taxesAmount = airbnbData.taxesAmount;

      Logger.log("[Main] Datos combinados: parser específico + Gemini para: %s", subject);
    }
  }

  // Mejorar los datos extraídos con información del asunto del email
  dto = NameEnhancementService.enhanceExtractedData(dto, msg);
  Logger.log("[Main] Datos mejorados con NameEnhancementService para: %s", subject);
  
  return dto;
}

/**
 * Valida si el DTO tiene los datos mínimos requeridos
 * @param {Object} dto - DTO a validar
 * @returns {boolean}
 */
function hasValidReservationData(dto) {
  return dto && dto.guestName && dto.checkInDate && dto.checkOutDate;
}

/**
 * Verifica si hay duplicados en la ejecución actual
 * @param {Object} dto - DTO a verificar
 * @param {Set} processedReservations - Set de reservas procesadas
 * @returns {boolean}
 */
// === DUPLICATE DETECTION ===

/**
 * Verifica si una reserva de Lodgify/Vrbo debe ser omitida por existir reserva de Airbnb
 * @param {Object} dto - DTO de la reserva
 * @param {Set} airbnbReservations - Set de reservas de Airbnb procesadas
 * @returns {boolean}
 */
function shouldSkipLodgifyVrboForAirbnb(dto, airbnbReservations) {
  const platform = Array.isArray(dto.platform) ? dto.platform[0] : dto.platform;
  
  if (!/vrbo|lodgify/i.test(String(platform))) {
    return false;
  }

  const checkInDate = dto.checkInDate;
  const checkOutDate = dto.checkOutDate;
  const guestName = dto.guestName;

  // Buscar DTO de Airbnb en la ejecución actual con mismo primer nombre y fechas
  for (const abKey of airbnbReservations) {
    const [abName, abCi, abCo] = abKey.split("::");
    const lodgifyFirst = getFirstName(dto.guestName);
    const airbnbFirst = getFirstName(abName);
    const sameCheckIn = normalizeToISODate(dto.checkInDate) === normalizeToISODate(abCi);
    const sameCheckOut = normalizeToISODate(dto.checkOutDate) === normalizeToISODate(abCo);
    
    if (
      lodgifyFirst &&
      airbnbFirst &&
      lodgifyFirst === airbnbFirst &&
      sameCheckIn &&
      sameCheckOut
    ) {
      return true;
    }
  }

  // También verificar en Airtable por si acaso
  if (AirtableService.existsAirbnbForGuestDates(CONFIG, guestName, checkInDate, checkOutDate)) {
    return true;
  }

  // Guard: evitar upsert parcial sin fechas base
  if (!checkInDate || !checkOutDate) {
    return true;
  }

  return false;
}

function isDuplicateInCurrentExecution(dto, processedReservations) {
  const duplicateKey = `${dto.guestName}::${dto.checkInDate}::${dto.checkOutDate}::${dto.platform}`;
  if (processedReservations.has(duplicateKey)) {
    return true;
  }

  // Verificar duplicados por número de reserva si está disponible
  if (dto.reservationNumber && dto.reservationNumber.trim()) {
    const reservationKey = `${dto.reservationNumber}::${dto.platform}`;
    if (processedReservations.has(reservationKey)) {
      return true;
    }
    processedReservations.add(reservationKey);
  }

  processedReservations.add(duplicateKey);
  return false;
}

function shouldSkipLodgifyEmail(from, subject) {
  // Correos de Lodgify que NO son confirmaciones de reserva
  const isLodgifyNonReservation =
    /lodgify/i.test(from) &&
    !/^New Confirmed Booking/i.test(subject) &&
    !/^Reservation confirmed/i.test(subject) &&
    !/^Instant booking/i.test(subject);

  // Correos que contienen información de reservas pero NO son confirmaciones originales
  const isReservationInfoButNotOriginal =
    /reservation|booking|arrives|nights|arrival/i.test(subject) &&
    !/confirmed|new confirmed|instant booking/i.test(subject) &&
    (/^fwd:|^re:/i.test(subject) || /lodgify/i.test(from));

  return isLodgifyNonReservation || isReservationInfoButNotOriginal;
}

function processEmails() {
  try {
    Logger.log("[Main] Inicio de proceso SAFE_MODE=%s", CONFIG.SAFE_MODE);

    const messages = EmailService.fetch();
    Logger.log("[Main] Mensajes obtenidos: %s", messages.length);

    let processedInAirtableCount = 0;
    let skippedCount = 0;

    // Set para detectar duplicados en esta ejecución
    const processedReservations = new Set();

    // Set para rastrear reservas de Airbnb procesadas en esta ejecución
    const airbnbReservations = new Set();

    // Separar mensajes por plataforma para procesar Airbnb primero
    const airbnbMessages = [];
    const otherMessages = [];

    for (const msg of messages) {
      const from = msg.getFrom();
      const subject = msg.getSubject();

      if (
        /airbnb/i.test(from) ||
        (/airbnb/i.test(subject) && /reservation confirmed/i.test(subject))
      ) {
        airbnbMessages.push(msg);
      } else {
        otherMessages.push(msg);
      }
    }

    // Procesar Airbnb primero, luego otros
    const sortedMessages = [...airbnbMessages, ...otherMessages];

    for (const msg of sortedMessages) {
      try {
        const messageId = msg.getId();
        const subject = msg.getSubject();
        const from = msg.getFrom();

        // FILTRADO TEMPRANO - ANTES de cualquier procesamiento
        // =====================================================

        // Aplicar todos los filtros usando el módulo EmailFilters
        const filterResult = EmailFilters.applyEmailFilters(from, subject);
        if (filterResult.shouldSkip) {
          Logger.log(
            "[Main] Skip: %s - from=%s subject=%s",
            filterResult.reason,
            from,
            subject,
          );
          skippedCount++;
          continue;
        }

        // 2. Evitar reprocesar si ya existe por Gmail Message ID
        if (AirtableService.isMessageProcessed(CONFIG, messageId)) {
          Logger.log(
            "[Main] Skip: La reserva con Gmail Message ID %s ya está registrada. No se procesa nuevamente. Subject: %s",
            messageId,
            subject,
          );
          skippedCount++;
          continue;
        }

        // =====================================================
        // FIN DEL FILTRADO TEMPRANO
        // =====================================================

        const body = EmailService.getCleanBody(msg);

        // Procesamiento por plataforma usando módulos especializados
        let dto = null;
        
        if (LodgifyProcessor.shouldProcessLodgifyEmail(from, subject)) {
          // Verificar duplicados usando el nuevo detector
          const lodgifyInfo = LodgifyProcessor.extractLodgifyReservationInfo(subject);
          if (lodgifyInfo && DuplicateDetector.shouldSkipLodgifyDuplicate(lodgifyInfo, [/* get existing records */])) {
            Logger.log(
              "[Main] Skip Lodgify por coincidencia: %s - %s",
              lodgifyInfo.firstName,
              lodgifyInfo.arrivalDate,
            );
            skippedCount++;
            continue;
          }
          
          Logger.log("[Main] Procesando confirmación de Lodgify: %s", subject);
          dto = Parser.parseEmail(body, subject);
        } else if (AirbnbProcessor.shouldProcessAirbnbEmail(from, subject)) {
          // Procesar Airbnb usando el módulo especializado
          const airbnbInfo = AirbnbProcessor.processAirbnbEmail(from, subject, body);
          if (airbnbInfo) {
            dto = processAirbnbEmail(msg, body, subject, from);
          }
        } else {
          Logger.log(
            "[Main] Skip: email no es de plataforma válida - from=%s subject=%s",
            from,
            subject,
          );
          skippedCount++;
          continue;
        }

        // Validar que el DTO se haya creado correctamente
        if (!dto) {
          Logger.log("[Main] ERROR: DTO es null para el mensaje: %s", subject);
          skippedCount++;
          continue;
        }

        Logger.log("[Main] DTO creado exitosamente para: %s", subject);
        Logger.log("[Main] DTO contenido: %s", JSON.stringify(dto));

        // Debug específico del campo Property
        Logger.log("[Main] Campo Property en DTO: '%s'", dto.Property || "UNDEFINED");
        Logger.log("[Main] Campo property en DTO: '%s'", dto.property || "UNDEFINED");
        Logger.log("[Main] Campo accommodationName en DTO: '%s'", dto.accommodationName || "UNDEFINED");

        // Detección de duplicados inteligente
        if (!hasValidReservationData(dto)) {
          Logger.log(
            "[Main] Skip DTO sin datos de reserva válidos: guestName='%s', checkIn='%s', checkOut='%s'",
            dto.guestName || "MISSING",
            dto.checkInDate || "MISSING",
            dto.checkOutDate || "MISSING",
          );
          skippedCount++;
          continue;
        }

        // Verificar duplicados en esta ejecución
        if (isDuplicateInCurrentExecution(dto, processedReservations)) {
          Logger.log(
            "[Main] Skip duplicado detectado en esta ejecución: %s::%s::%s::%s",
            dto.guestName,
            dto.checkInDate,
            dto.checkOutDate,
            dto.platform,
          );
          skippedCount++;
          continue;
        }

        // Asegurar el messageId en DTO
        dto["Gmail Message ID"] = messageId;

        // Normalizar Property con estrategia por plataforma
        const platform = Array.isArray(dto.platform)
          ? dto.platform[0]
          : dto.platform;

        // Debug del mapeo de propiedades
        const propertyInput = dto.Property || dto.property || subject;
        Logger.log(
          "[Main] Mapeo de propiedad - Platform: %s, Input: '%s'",
          platform,
          propertyInput,
        );

        const mapped = PropertyService.findPropertyMapping(
          platform,
          propertyInput,
        );
        Logger.log(
          "[Main] Mapeo de propiedad - Resultado: %s (alias: %s)",
          mapped.name,
          mapped.aliasMatched,
        );

        dto.Property = mapped.name;

        // NUEVA LÓGICA: Regla de preferencia mejorada
        if (shouldSkipLodgifyVrboForAirbnb(dto, airbnbReservations)) {
          const platform = Array.isArray(dto.platform) ? dto.platform[0] : dto.platform;
          Logger.log(
            "[Main] Skip %s por preferencia Airbnb: %s - %s → %s",
            platform,
            dto.guestName,
            dto.checkInDate,
            dto.checkOutDate,
          );
          skippedCount++;
          continue;
        }

        // Si es Airbnb, registrarlo para evitar duplicados de Vrbo/Lodgify
        if (/airbnb/i.test(String(platform))) {
          const airbnbKey = `${dto.guestName}::${dto.checkInDate}::${dto.checkOutDate}::Airbnb`;
          airbnbReservations.add(airbnbKey);
          Logger.log(
            "[Main] Registrada reserva Airbnb para evitar duplicados: %s",
            airbnbKey,
          );
        }

        // Fallback: intentar extraer Reservation Number de subject/body si falta

        if (!dto.reservationNumber && !dto["Reservation number"]) {
          const guessed = extractReservationNumber(
            String(platform || ""),
            subject,
            body,
          );
          if (guessed) {
            dto.reservationNumber = guessed;
            Logger.log(
              "[Main] Reservation number inferido: %s (platform=%s)",
              guessed,
              String(platform),
            );
          }
        }

        // Validación crítica: Reservation number requerido
        const reservationNumber = (
          dto.reservationNumber ||
          dto["Reservation number"] ||
          ""
        )
          .toString()
          .trim();
        if (!reservationNumber || reservationNumber === "0") {
          Logger.log(
            "[Main] Skip por reservationNumber vacío/0. from=%s subject=%s platform=%s",
            from,
            subject,
            String(platform),
          );
          skippedCount++;
          continue;
        }

        // Solo procesar si no fue registrado antes (ya validado arriba)
        const res = AirtableService.upsert(dto, CONFIG, messageId);
        Logger.log("[Main] Upsert resultado: %s", JSON.stringify(res));
        if (res && res.ok) {
          processedInAirtableCount++;
        }
      } catch (perMsgErr) {
        Logger.log("[Main][ERROR mensaje] %s", perMsgErr);
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
    Logger.log("[Main] Fin de proceso");
  } catch (err) {
    Logger.log(`Error in main execution: ${err.toString()}`);
  }
}

// === EXPORTS ===
// Exportar la función principal para uso externo
if (typeof module !== "undefined" && module.exports) {
  module.exports = { processEmails };
}
