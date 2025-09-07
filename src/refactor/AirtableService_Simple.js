/* eslint-disable */
/* prettier-ignore-file */
/* global UrlFetchApp Logger CONFIG Utils */

/**
 * AirtableService - VERSIÓN SIMPLIFICADA
 * Funciones esenciales sin complejidad innecesaria
 */

const AirtableService = (() => {
  
  function buildOptions(apiKey, method, payload) {
    const options = {
      method,
      headers: { Authorization: `Bearer ${apiKey}` },
      muteHttpExceptions: true,
    };
    if (payload) {
      options.contentType = "application/json";
      options.payload = JSON.stringify(payload);
    }
    return options;
  }

  function httpRequest(url, options, context) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      const text = response.getContentText();
      
      if (code >= 400) {
        Logger?.log(`[AirtableService] HTTP ${code} in ${context}: ${text}`);
        return { ok: false, error: text };
      }
      
      return { ok: true, data: JSON.parse(text) };
    } catch (error) {
      Logger?.log(`[AirtableService] Error in ${context}: ${error}`);
      return { ok: false, error: error.message };
    }
  }

  function normalizePlatform(platform) {
    const p = Array.isArray(platform) ? platform[0] : platform;
    const lower = (p || "").toLowerCase();
    
    if (lower.includes("vrbo") || lower.includes("homeaway")) return "Vrbo";
    if (lower.includes("airbnb")) return "Airbnb";
    if (lower.includes("lodgify")) return "Lodgify";
    return "Desconocido";
  }

  function buildReservationFields(dto) {
    const platform = normalizePlatform(dto.platform);
    
    // Campos básicos
    const fields = {
      "Reservation Number": dto.reservationNumber || "",
      "Guest Name": dto.guestName || "",
      "Check-in Date": Utils?.formatDateForAirtable(dto.checkInDate) || dto.checkInDate,
      "Check-out Date": Utils?.formatDateForAirtable(dto.checkOutDate) || dto.checkOutDate,
      "Property": dto.Property || "Temporal",
      "Platform": platform,
      "Adults": dto.adults || 0,
      "Children": dto.children || 0,
      "Pets": dto.pets || 0,
      "Accommodation": Utils?.sanitizeMoneyUSD(dto.accommodation) || 0,
      "Taxes": Utils?.sanitizeMoneyUSD(dto.taxes) || 0,
      "Total": Utils?.sanitizeMoneyUSD(dto.total) || 0,
    };

    // Campos opcionales
    if (dto.nights) fields["Nights"] = dto.nights;
    if (dto.phone) fields["Phone"] = dto.phone;
    if (dto.email) fields["Email"] = dto.email;
    if (dto.clubFee) fields["Resort Fee"] = Utils?.sanitizeMoneyUSD(dto.clubFee) || 0;

    return fields;
  }

  function saveReservation(config, dto, messageId) {
    if (config?.SAFE_MODE) {
      Logger?.log(`[AirtableService] SAFE_MODE: Simulando guardado de ${dto.guestName}`);
      return { ok: true, simulated: true };
    }

    const url = `https://api.airtable.com/v0/${config.AIRTABLE_BASE_ID}/${config.AIRTABLE_TABLE_NAME}`;
    const fields = buildReservationFields(dto);
    
    // Agregar messageId para tracking
    fields["Message ID"] = messageId;
    fields["Processed Date"] = new Date().toISOString();

    const payload = { fields };
    const options = buildOptions(config.AIRTABLE_API_KEY, "POST", payload);
    
    Logger?.log(`[AirtableService] Guardando reserva: ${dto.guestName} (${dto.platform})`);
    return httpRequest(url, options, "saveReservation");
  }

  function updateReservation(config, recordId, dto, messageId) {
    if (config?.SAFE_MODE) {
      Logger?.log(`[AirtableService] SAFE_MODE: Simulando actualización de ${dto.guestName}`);
      return { ok: true, simulated: true };
    }

    const url = `https://api.airtable.com/v0/${config.AIRTABLE_BASE_ID}/${config.AIRTABLE_TABLE_NAME}/${recordId}`;
    const fields = buildReservationFields(dto);
    
    // Mantener tracking
    fields["Message ID"] = messageId;
    fields["Updated Date"] = new Date().toISOString();

    const payload = { fields };
    const options = buildOptions(config.AIRTABLE_API_KEY, "PATCH", payload);
    
    Logger?.log(`[AirtableService] Actualizando reserva: ${dto.guestName} (${dto.platform})`);
    return httpRequest(url, options, "updateReservation");
  }

  function findExistingReservation(config, guestName, checkInDate) {
    const formula = `AND({Guest Name} = "${guestName}", {Check-in Date} = "${checkInDate}")`;
    const url = `https://api.airtable.com/v0/${config.AIRTABLE_BASE_ID}/${config.AIRTABLE_TABLE_NAME}?filterByFormula=${encodeURIComponent(formula)}`;
    
    const options = buildOptions(config.AIRTABLE_API_KEY, "GET");
    const result = httpRequest(url, options, "findExistingReservation");
    
    if (result?.ok && result.data?.records?.length > 0) {
      return {
        id: result.data.records[0].id,
        fields: result.data.records[0].fields
      };
    }
    
    return null;
  }

  function isMessageProcessed(config, messageId) {
    if (!messageId) return false;
    
    const formula = `{Message ID} = "${messageId}"`;
    const url = `https://api.airtable.com/v0/${config.AIRTABLE_BASE_ID}/${config.AIRTABLE_TABLE_NAME}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
    
    const options = buildOptions(config.AIRTABLE_API_KEY, "GET");
    const result = httpRequest(url, options, "isMessageProcessed");
    
    return result?.ok && result.data?.records?.length > 0;
  }

  return {
    saveReservation,
    updateReservation,
    findExistingReservation,
    isMessageProcessed
  };
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AirtableService;
} else if (typeof globalThis !== 'undefined') {
  globalThis.AirtableService = AirtableService;
}
