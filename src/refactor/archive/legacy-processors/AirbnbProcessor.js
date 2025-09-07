/* global Logger */

/**
 * Procesamiento específico para emails de Airbnb
 */

/**
 * Verifica si el email es de la plataforma Airbnb
 * @param {string} from - Remitente del correo
 * @returns {boolean}
 */
function isAirbnbEmail(from) {
  return /airbnb/i.test(from);
}

/**
 * Determina si un email de Airbnb debe ser procesado
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @returns {boolean}
 */
function shouldProcessAirbnbEmail(from, subject) {
  if (!isAirbnbEmail(from)) {
    return false;
  }

  // Verificar que sea una confirmación de reserva válida
  const isValidAirbnbBooking =
    /reservation confirmed/i.test(subject) ||
    /instant booking/i.test(subject) ||
    /new confirmed booking/i.test(subject);

  // Excluir correos reenviados que no son confirmaciones originales
  const isForwarded = /^fwd:/i.test(subject);
  
  return isValidAirbnbBooking && !isForwarded;
}

/**
 * Extrae el número de reserva de Airbnb del asunto
 * @param {string} subject - Asunto del correo
 * @returns {string|null} - Número de reserva o null si no se encuentra
 */
function extractAirbnbReservationNumber(subject) {
  if (!subject) return null;

  // Patrón para números de reserva de Airbnb (generalmente #XXXXXXXX)
  const match = subject.match(/#([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Extrae información del huésped del asunto de Airbnb
 * @param {string} subject - Asunto del correo
 * @returns {Object|null} - Información del huésped o null
 */
function extractAirbnbGuestInfo(subject) {
  if (!subject) return null;

  // Patrón para "Reservation confirmed - FirstName arrives..."
  const confirmationMatch = subject.match(/Reservation confirmed - ([^,\s]+)/i);
  if (confirmationMatch) {
    return {
      firstName: confirmationMatch[1].trim(),
    };
  }

  // Patrón para "Instant booking - FirstName arrives..."
  const instantMatch = subject.match(/Instant booking - ([^,\s]+)/i);
  if (instantMatch) {
    return {
      firstName: instantMatch[1].trim(),
    };
  }

  return null;
}

/**
 * Extrae la fecha de llegada del asunto de Airbnb
 * @param {string} subject - Asunto del correo
 * @returns {string|null} - Fecha en formato ISO o null
 */
function extractAirbnbArrivalDate(subject) {
  if (!subject) return null;

  // Patrón para "arrives Jan 15, 2024"
  const arrivesMatch = subject.match(
    /arrives\s+([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i,
  );

  if (arrivesMatch) {
    const [, month, day, year] = arrivesMatch;
    
    const monthMap = {
      jan: "01", january: "01",
      feb: "02", february: "02", 
      mar: "03", march: "03",
      apr: "04", april: "04",
      may: "05",
      jun: "06", june: "06",
      jul: "07", july: "07",
      aug: "08", august: "08",
      sep: "09", september: "09",
      oct: "10", october: "10",
      nov: "11", november: "11",
      dec: "12", december: "12",
    };

    const monthNumber = monthMap[month.toLowerCase()];
    if (monthNumber) {
      const paddedDay = day.padStart(2, "0");
      return `${year}-${monthNumber}-${paddedDay}`;
    }
  }

  return null;
}

/**
 * Valida que el email de Airbnb contenga la información necesaria
 * @param {string} subject - Asunto del correo
 * @returns {Object} - { isValid: boolean, missingFields: Array }
 */
function validateAirbnbEmail(subject) {
  const result = {
    isValid: true,
    missingFields: [],
  };

  const guestInfo = extractAirbnbGuestInfo(subject);
  const arrivalDate = extractAirbnbArrivalDate(subject);
  const reservationNumber = extractAirbnbReservationNumber(subject);

  if (!guestInfo || !guestInfo.firstName) {
    result.isValid = false;
    result.missingFields.push("firstName");
  }

  if (!arrivalDate) {
    result.isValid = false;
    result.missingFields.push("arrivalDate");
  }

  if (!reservationNumber) {
    result.isValid = false;
    result.missingFields.push("reservationNumber");
  }

  return result;
}

/**
 * Procesa un email de Airbnb y extrae toda la información relevante
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @param {string} body - Cuerpo del correo
 * @returns {Object|null} - Información procesada o null si no es válido
 */
function processAirbnbEmail(from, subject, body) {
  if (!shouldProcessAirbnbEmail(from, subject)) {
    return null;
  }

  const validation = validateAirbnbEmail(subject);
  if (!validation.isValid) {
    Logger.log(
      `Email de Airbnb inválido - faltan campos: ${validation.missingFields.join(", ")} - Asunto: ${subject}`,
    );
    return null;
  }

  const guestInfo = extractAirbnbGuestInfo(subject);
  const arrivalDate = extractAirbnbArrivalDate(subject);
  const reservationNumber = extractAirbnbReservationNumber(subject);

  return {
    platform: "Airbnb",
    firstName: guestInfo.firstName,
    arrivalDate,
    reservationNumber,
    rawSubject: subject,
    rawFrom: from,
    rawBody: body,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isAirbnbEmail,
    shouldProcessAirbnbEmail,
    extractAirbnbReservationNumber,
    extractAirbnbGuestInfo,
    extractAirbnbArrivalDate,
    validateAirbnbEmail,
    processAirbnbEmail,
  };
} else {
  globalThis.AirbnbProcessor = {
    isAirbnbEmail,
    shouldProcessAirbnbEmail,
    extractAirbnbReservationNumber,
    extractAirbnbGuestInfo,
    extractAirbnbArrivalDate,
    validateAirbnbEmail,
    processAirbnbEmail,
  };
}
