/* eslint-disable */
/* prettier-ignore-file */
/* global Utilities */
const SharedUtils = (globalThis.SharedUtils) || (typeof require !== 'undefined' && require("../shared/SharedUtils").SharedUtils);

/**
 * Lógica para detección y manejo de duplicados
 */

/**
 * Determina si una reserva de Lodgify ya existe en Airtable para evitar duplicados
 * @param {Object} reservation - Objeto con datos de la reserva (arrivalDate, firstName)
 * @param {Array} existingRecords - Array de registros existentes en Airtable
 * @returns {boolean} - true si se debe omitir la reserva de Lodgify
 */
function shouldSkipLodgifyDuplicate(reservation, existingRecords) {
  if (!reservation || !existingRecords || existingRecords.length === 0) {
    return false;
  }

  const { arrivalDate, firstName } = reservation;

  if (!arrivalDate || !firstName) {
    return false;
  }

  const hasMatch = existingRecords.some((existingRecord) => {
    if (!existingRecord.fields) {
      return false;
    }

    const existingCheckin = existingRecord.fields["Check-in"];
    const existingFirstName = existingRecord.fields["First Name"];

    if (!existingCheckin || !existingFirstName) {
      return false;
    }

    // Normalizar fechas para comparación
  const normalizedExistingCheckin = SharedUtils.normalizeDate(existingCheckin);
  const normalizedArrivalDate = SharedUtils.normalizeDate(arrivalDate);

    // Normalizar nombres para comparación
  const normalizedExistingFirstName = SharedUtils.normalizeName(existingFirstName);
  const normalizedFirstName = SharedUtils.normalizeName(firstName);

    const matchesFirstName = normalizedExistingFirstName === normalizedFirstName;
    const matchesDate = normalizedExistingCheckin === normalizedArrivalDate;

    if (matchesFirstName && matchesDate) {
      Logger.log(
        `Omitiendo Lodgify: encontrada reserva existente - ${firstName} llegando ${arrivalDate}`,
      );
      return true;
    }

    return false;
  });

  return hasMatch;
}

/**
 * Normaliza una fecha a formato ISO para comparación consistente
 * @param {string|Date} dateInput - Fecha en cualquier formato
 * @returns {string|null} - Fecha en formato YYYY-MM-DD o null si inválida
 */
function normalizeDate(dateInput) {
  return SharedUtils.normalizeDate(dateInput);
}

/**
 * Normaliza un nombre para comparación consistente
 * @param {string} name - Nombre a normalizar
 * @returns {string} - Nombre normalizado (lowercase, sin espacios extra)
 */
function normalizeName(name) {
  return SharedUtils.normalizeName(name);
}

/**
 * Busca duplicados por múltiples criterios
 * @param {Object} newReservation - Nueva reserva a verificar
 * @param {Array} existingRecords - Registros existentes
 * @param {Array} criteria - Array de criterios de comparación ['firstName', 'arrivalDate', etc.]
 * @returns {Object|null} - Registro duplicado encontrado o null
 */
function findDuplicateBy(newReservation, existingRecords, criteria) {
  if (!newReservation || !existingRecords || !criteria || criteria.length === 0) {
    return null;
  }

  return existingRecords.find((existing) => {
    if (!existing.fields) return false;

    return criteria.every((criterion) => {
      switch (criterion) {
        case "firstName":
          return (
            normalizeName(newReservation.firstName) ===
            normalizeName(existing.fields["First Name"])
          );
        case "arrivalDate":
          return (
            normalizeDate(newReservation.arrivalDate) ===
            normalizeDate(existing.fields["Check-in"])
          );
        case "reservationNumber":
          return (
            newReservation.reservationNumber &&
            existing.fields["Reservation Number"] &&
            newReservation.reservationNumber === existing.fields["Reservation Number"]
          );
        case "email":
          return (
            newReservation.email &&
            existing.fields["Email"] &&
            newReservation.email.toLowerCase() === existing.fields["Email"].toLowerCase()
          );
        default:
          return false;
      }
    });
  });
}

/**
 * Genera un ID único para una reserva basado en criterios específicos
 * @param {Object} reservation - Objeto de reserva
 * @param {Array} criteria - Criterios para generar el ID
 * @returns {string} - ID único generado
 */
function generateReservationId(reservation, criteria = ["firstName", "arrivalDate"]) {
  const parts = criteria.map((criterion) => {
    switch (criterion) {
      case "firstName":
        return normalizeName(reservation.firstName || "");
      case "arrivalDate":
        return normalizeDate(reservation.arrivalDate) || "";
      case "reservationNumber":
        return reservation.reservationNumber || "";
      case "email":
        return (reservation.email || "").toLowerCase();
      default:
        return "";
    }
  }).filter(part => part !== "");

  return parts.join("|");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    shouldSkipLodgifyDuplicate,
    normalizeDate,
    normalizeName,
    findDuplicateBy,
    generateReservationId,
  };
} else {
  // Solo declarar si no existe ya (evita errores de declaración duplicada en GAS)
  if (typeof globalThis.DuplicateDetector === 'undefined') {
    globalThis.DuplicateDetector = {
      shouldSkipLodgifyDuplicate,
      normalizeDate,
      normalizeName,
      findDuplicateBy,
      generateReservationId,
    };
  }
}
