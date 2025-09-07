/* global Logger */

/**
 * Filtros para determinar qué emails deben ser omitidos
 */

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
      /There is an update for your request|How would you rate the support/i.test(
        subject,
      )) ||
    (/automated@airbnb\.com/i.test(from) &&
      /Actividad de la cuenta|Account activity|inicio de sesi[oó]n/i.test(
        subject,
      )) ||
    (/propertymanagers\.lodgify\.com/i.test(from) &&
      /Check-?in completed|Check-?out completed|Check-?in reminder/i.test(
        subject,
      ));

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
    !/reservation confirmed|new confirmed booking|instant booking/i.test(
      subject,
    );

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

/**
 * Aplica todos los filtros de email en secuencia
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @returns {Object} { shouldSkip: boolean, reason: string }
 */
function applyEmailFilters(from, subject) {
  if (shouldSkipSupportEmail(from, subject)) {
    return { shouldSkip: true, reason: "correo de soporte/seguridad" };
  }

  if (isSupportOrUpdateEmail(subject)) {
    return { shouldSkip: true, reason: "correo de soporte/actualización" };
  }

  if (isNonReservationEmail(subject)) {
    return { shouldSkip: true, reason: "correo no relacionado con reservas" };
  }

  if (shouldSkipForwardedEmail(from, subject)) {
    return { shouldSkip: true, reason: "correo reenviado" };
  }

  if (shouldSkipLodgifyEmail(from, subject)) {
    return { shouldSkip: true, reason: "correo de Lodgify no válido" };
  }

  return { shouldSkip: false, reason: "" };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    shouldSkipSupportEmail,
    isSupportOrUpdateEmail,
    isNonReservationEmail,
    shouldSkipForwardedEmail,
    shouldSkipLodgifyEmail,
    applyEmailFilters,
  };
} else {
  // Solo declarar si no existe ya (evita errores de declaración duplicada en GAS)
  if (typeof globalThis.EmailFilters === 'undefined') {
    globalThis.EmailFilters = {
      shouldSkipSupportEmail,
      isSupportOrUpdateEmail,
      isNonReservationEmail,
      shouldSkipForwardedEmail,
      shouldSkipLodgifyEmail,
      applyEmailFilters,
    };
  }
}
