/* global Logger */

/**
 * Procesamiento específico para emails de Lodgify
 */

/**
 * Verifica si el email es de la plataforma Lodgify
 * @param {string} from - Remitente del correo
 * @returns {boolean}
 */
function isLodgifyEmail(from) {
  return /lodgify/i.test(from);
}

/**
 * Extrae el primer nombre del asunto de un email de Lodgify
 * @param {string} subject - Asunto del correo
 * @returns {string|null} - Primer nombre extraído o null si no se encuentra
 */
function extractFirstNameFromLodgifySubject(subject) {
  if (!subject) return null;

  // Patrón para "New Confirmed Booking - FirstName LastName arrives..."
  const newBookingMatch = subject.match(/New Confirmed Booking - ([^,\s]+)/i);
  if (newBookingMatch) {
    return newBookingMatch[1].trim();
  }

  // Patrón para "Reservation confirmed - FirstName LastName, arrives..."
  const reservationMatch = subject.match(/Reservation confirmed - ([^,\s]+)/i);
  if (reservationMatch) {
    return reservationMatch[1].trim();
  }

  // Patrón para "Instant booking - FirstName LastName arrives..."
  const instantMatch = subject.match(/Instant booking - ([^,\s]+)/i);
  if (instantMatch) {
    return instantMatch[1].trim();
  }

  return null;
}

/**
 * Extrae la fecha de llegada del asunto de un email de Lodgify
 * @param {string} subject - Asunto del correo
 * @returns {string|null} - Fecha en formato ISO o null si no se encuentra
 */
function extractArrivalDateFromLodgifySubject(subject) {
  if (!subject) return null;

  // Patrón para "arrives Jan 15, 2024" o "arrives January 15, 2024"
  const arrivesMatch = subject.match(
    /arrives\s+([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i,
  );

  if (arrivesMatch) {
    const [, month, day, year] = arrivesMatch;
    
    // Mapeo de nombres de mes a números
    const monthMap = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      september: "09",
      sept: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };

    const monthNumber = monthMap[month.toLowerCase()];
    if (monthNumber) {
      const paddedDay = day.padStart(2, "0");
      const candidate = `${year}-${monthNumber}-${paddedDay}`;
      // Rechazar 29 Feb en año no bisiesto
      if (monthNumber === "02" && paddedDay === "29") {
        const y = parseInt(year, 10);
        const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        if (!isLeap) return null;
      }
      return candidate;
    }
  }

  // Patrón alternativo para formato de fecha diferente
  const dateMatch = subject.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }

  return null;
}

/**
 * Determina si un email de Lodgify debe ser procesado
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @returns {boolean}
 */
function shouldProcessLodgifyEmail(from, subject) {
  if (!isLodgifyEmail(from)) {
    return false;
  }

  // Solo procesar confirmaciones de reserva
  const isValidLodgifyBooking =
    /^New Confirmed Booking/i.test(subject) ||
    /^Reservation confirmed/i.test(subject) ||
    /^Instant booking/i.test(subject);

  return isValidLodgifyBooking;
}

/**
 * Extrae información completa de la reserva desde el asunto de Lodgify
 * @param {string} subject - Asunto del correo
 * @returns {Object|null} - Objeto con firstName y arrivalDate o null
 */
function extractLodgifyReservationInfo(subject) {
  const firstName = extractFirstNameFromLodgifySubject(subject);
  const arrivalDate = extractArrivalDateFromLodgifySubject(subject);

  if (!firstName || !arrivalDate) {
    Logger.log(
      `No se pudo extraer información completa de Lodgify del asunto: ${subject}`,
    );
    return null;
  }

  return {
    firstName,
    arrivalDate,
  };
}

/**
 * Valida que el email de Lodgify contenga la información necesaria
 * @param {string} subject - Asunto del correo
 * @returns {Object} - { isValid: boolean, missingFields: Array }
 */
function validateLodgifyEmail(subject) {
  const result = {
    isValid: true,
    missingFields: [],
  };

  const firstName = extractFirstNameFromLodgifySubject(subject);
  const arrivalDate = extractArrivalDateFromLodgifySubject(subject);

  if (!firstName) {
    result.isValid = false;
    result.missingFields.push("firstName");
  }

  if (!arrivalDate) {
    result.isValid = false;
    result.missingFields.push("arrivalDate");
  }

  return result;
}

/**
 * Procesa un email de Lodgify y extrae toda la información relevante
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @param {string} body - Cuerpo del correo
 * @returns {Object|null} - Información procesada o null si no es válido
 */
function processLodgifyEmail(from, subject, body) {
  if (!shouldProcessLodgifyEmail(from, subject)) {
    return null;
  }

  const validation = validateLodgifyEmail(subject);
  if (!validation.isValid) {
    Logger.log(
      `Email de Lodgify inválido - faltan campos: ${validation.missingFields.join(", ")} - Asunto: ${subject}`,
    );
    return null;
  }

  const reservationInfo = extractLodgifyReservationInfo(subject);
  if (!reservationInfo) {
    return null;
  }

  return {
    platform: "Lodgify",
    ...reservationInfo,
    rawSubject: subject,
    rawFrom: from,
    rawBody: body,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isLodgifyEmail,
    extractFirstNameFromLodgifySubject,
    extractArrivalDateFromLodgifySubject,
    shouldProcessLodgifyEmail,
    extractLodgifyReservationInfo,
    validateLodgifyEmail,
    processLodgifyEmail,
  };
} else {
  globalThis.LodgifyProcessor = {
    isLodgifyEmail,
    extractFirstNameFromLodgifySubject,
    extractArrivalDateFromLodgifySubject,
    shouldProcessLodgifyEmail,
    extractLodgifyReservationInfo,
    validateLodgifyEmail,
    processLodgifyEmail,
  };
}
