/* eslint-disable */
/* prettier-ignore-file */
/**
 * Constantes centralizadas para evitar magic numbers y strings
 */
// Evita redeclaraciones en GAS: si ya existe globalThis.CONSTANTS, reutilizarlo
const CONSTANTS = globalThis.CONSTANTS || {
  PLATFORMS: {
    AIRBNB: "airbnb",
    VRBO: "vrbo",
    LODGIFY: "lodgify",
    HOMEAWAY: "homeaway",
  },

  PATTERNS: {
    AIRBNB_RESERVATION: [
      /(?:Reservation|Confirmation)\s*(?:code|number|#)?[:\s-]*([A-Z0-9]{6,10})/i,
      /Code[:\s-]*([A-Z0-9]{6,10})/i,
    ],
  VRBO_RESERVATION: [/([A-Z]?\d{7,10})/],
  },

  VALIDATION: {
    MIN_GUEST_NAME_LENGTH: 2,
  },

  LOGGING: {
    LEVELS: {
      INFO: "INFO",
      WARN: "WARN",
      ERROR: "ERROR",
      DEBUG: "DEBUG",
    },
  },
};

// Export / exposición global segura
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONSTANTS };
}
// Asegurar global sólo si no existe
if (!globalThis.CONSTANTS) {
  globalThis.CONSTANTS = CONSTANTS;
}
