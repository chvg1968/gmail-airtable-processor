/**
 * Configuración general
 */
/* global PropertiesService */
/* cSpell:ignore Configuración, Carga, configuración, desde, constantes, compartidas, Constantes, alineadas, googlescript, escrituras, reales, Lectura, Claves, servicios, externos, airtable */

// Carga configuración desde Script Properties (GAS) + constantes compartidas
const CONFIG = (() => {
  function getScriptProperty(key) {
    try {
      const sp = PropertiesService.getScriptProperties();
      return sp.getProperty(key);
    } catch (e) {
      return null;
    }
  }

  // Constantes alineadas con src/googlescript.js
  const CONSTANTS = {
    DATE_REVIEW: {
      MAX_DAYS_AHEAD: 180, // ~6 meses (más realista para vacaciones)
      FUTURE_YEAR_THRESHOLD: 2027, // Actualizado para 2025
    },
    EMAIL_SEARCH: {
      DAYS_BACK: 3,
    },
    AIRTABLE: {
      DEFAULT_CHECKIN_TIME: "15:00:00",
      DEFAULT_CHECKOUT_TIME: "10:00:00",
    },
    GEMINI: {
      TEMPERATURE: 0.2,
      TOP_P: 0.9,
      TOP_K: 40,
      MAX_OUTPUT_TOKENS: 1024,
    },
  };

  // SAFE_MODE: evita escrituras reales a Airtable
  const SAFE_MODE = false;

  // Lectura de variables desde Script Properties
  const airtableApiKey = getScriptProperty("AIRTABLE_API_KEY") || "";
  const airtableBaseId = getScriptProperty("AIRTABLE_BASE_ID") || "";
  const airtableTableName = getScriptProperty("AIRTABLE_TABLE_NAME") || "";
  const geminiApiKey = getScriptProperty("GEMINI_API_KEY") || "";

  return {
    // Claves para servicios externos
    airtableApiKey,
    airtableBaseId,
    airtableTableName,
    geminiApiKey,

    // Flags y constantes
    SAFE_MODE,
    CONSTANTS,
  };
})();

// CONFIG está disponible globalmente para Google Apps Script
