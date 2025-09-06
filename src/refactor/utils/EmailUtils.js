/* eslint-disable */
/* prettier-ignore-file */
/* global Logger */
const SharedUtils = (globalThis.SharedUtils) || (typeof require !== 'undefined' && require("../shared/SharedUtils").SharedUtils);
const __CONST_REF__ = (globalThis.CONSTANTS) || (typeof require !== 'undefined' && require("../shared/Constants").CONSTANTS);

/**
 * Utilidades para procesamiento de emails
 */

/**
 * Extrae el primer nombre de un nombre completo normalizado
 * @param {string} fullName - Nombre completo
 * @returns {string} Primer nombre en minúsculas
 */
function getFirstName(fullName) {
  return fullName ? fullName.trim().split(" ")[0].toLowerCase() : "";
}

/**
 * Normaliza una fecha a formato ISO (YYYY-MM-DD)
 * @param {string|Date} date - Fecha a normalizar
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function normalizeToISODate(date) {
  if (!date) return "";
  return String(date).slice(0, 10);
}

/**
 * Verifica si un correo es de una plataforma específica
 * @param {string} from - Remitente del correo
 * @param {string} subject - Asunto del correo
 * @param {string} platform - Plataforma a verificar (airbnb, lodgify, vrbo)
 * @returns {boolean}
 */
function isEmailFromPlatform(from, subject, platform) {
  const platformRegex = new RegExp(platform, "i");
  return (
    platformRegex.test(from) ||
  (platform === __CONST_REF__.PLATFORMS.AIRBNB &&
      platformRegex.test(subject) &&
      /reservation confirmed/i.test(subject))
  );
}

/**
 * Extrae el número de reserva desde subject/body por plataforma
 * @param {string} platform - Plataforma
 * @param {string} subject - Asunto del correo
 * @param {string} body - Cuerpo del correo
 * @returns {string} Número de reserva o cadena vacía
 */
function extractReservationNumber(platform, subject, body) {
  return SharedUtils.extractReservationNumber(platform, subject, body);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getFirstName,
    normalizeToISODate,
    isEmailFromPlatform,
    extractReservationNumber,
  };
} else {
  globalThis.EmailUtils = {
    getFirstName,
    normalizeToISODate,
    isEmailFromPlatform,
    extractReservationNumber,
  };
}
