/* global Logger */

/**
 * Servicio para mejorar la extracción de nombres de huéspedes
 * Especialmente útil para corregir nombres truncados de Airbnb
 */
var NameEnhancementService = {
  /**
   * Extrae el nombre del huésped desde el asunto del email.
   * @param {string} subject El asunto del email.
   * @returns {string|null} El nombre extraído o null.
   */
  extractGuestNameFromSubject: function (subject) {
    // Vrbo: "Instant Booking from Natasha Schooling: ..."
    const vrboMatch = subject.match(/from\s+([^:]+):/i);
    if (vrboMatch && vrboMatch[1]) {
      return this.toTitleCase(vrboMatch[1].trim());
    }

    // Airbnb: "Reservation confirmed - Rosemary Vega-Chang arrives Aug 3"
    const parts = subject.split(" - ");
    if (parts.length > 1) {
      const potentialNameAndDate = parts[1];
      const nameParts = potentialNameAndDate.split(/ (?:arrives|llega)/i);
      if (nameParts.length > 0) {
        return this.toTitleCase(nameParts[0].trim());
      }
    }

    return null;
  },

  /**
   * Mejora los datos extraídos con información adicional del email.
   * @param {Object} extractedData Los datos extraídos por Gemini.
   * @param {Object} message El mensaje de Gmail.
   * @returns {Object} Los datos mejorados.
   */
  enhanceExtractedData: function (extractedData, message) {
    const subject = message.getSubject();
    const nameFromSubject = this.extractGuestNameFromSubject(subject);
    const fromHeader = message.getFrom() || "";
    const isAirbnb =
      fromHeader.toLowerCase().includes("airbnb.com") ||
      (extractedData.platform &&
        Array.isArray(extractedData.platform) &&
        extractedData.platform[0] === "Airbnb");

    // Mejorar el nombre del huésped
    if (!extractedData.guestName && nameFromSubject) {
      extractedData.guestName = nameFromSubject;
      Logger.log(
        `[NameEnhancementService] ✅ Caso 1: No había guestName, usando nameFromSubject: "${nameFromSubject}"`
      );
    } else if (
      extractedData.guestName &&
      !extractedData.guestName.includes(" ") &&
      nameFromSubject &&
      nameFromSubject
        .toLowerCase()
        .startsWith(extractedData.guestName.toLowerCase()) &&
      nameFromSubject.includes(" ")
    ) {
      extractedData.guestName = nameFromSubject;
      Logger.log(
        `[NameEnhancementService] ✅ Caso 2: guestName solo primer nombre, mejorando con nameFromSubject completo: "${nameFromSubject}"`
      );
    } else if (isAirbnb && nameFromSubject && extractedData.guestName) {
      // Para Airbnb, si tenemos un nombre del asunto y un guestName existente,
      // preferir el del asunto si es más completo
      if (
        nameFromSubject.includes(" ") &&
        !extractedData.guestName.includes(" ")
      ) {
        extractedData.guestName = nameFromSubject;
        Logger.log(
          `[NameEnhancementService] ✅ Caso 3: Airbnb - Prefiriendo nombre completo del asunto: "${nameFromSubject}"`
        );
      } else if (nameFromSubject.length > extractedData.guestName.length) {
        extractedData.guestName = nameFromSubject;
        Logger.log(
          `[NameEnhancementService] ✅ Caso 4: Airbnb - Prefiriendo nombre más largo del asunto: "${nameFromSubject}"`
        );
      }
    }

    // Mejorar la fecha de reserva si no existe
    if (!extractedData.bookingDate) {
      const headerDate = message.getDate();
      if (headerDate && !isNaN(headerDate.getTime())) {
        extractedData.bookingDate = headerDate.toISOString().slice(0, 10);
      }
    }

    return extractedData;
  },

  /**
   * Convierte una cadena a formato título (primera letra de cada palabra en mayúscula).
   * @param {string} str La cadena a convertir.
   * @returns {string} La cadena en formato título.
   */
  toTitleCase: function (str) {
    if (!str) return str;
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  },
};
