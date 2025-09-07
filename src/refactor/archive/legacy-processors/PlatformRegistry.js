/* eslint-disable */
/* prettier-ignore-file */
const AirbnbProcessor = (globalThis.AirbnbProcessor) || (typeof require !== 'undefined' && require("./AirbnbProcessor"));
const LodgifyProcessor = (globalThis.LodgifyProcessor) || (typeof require !== 'undefined' && require("./LodgifyProcessor"));

const PlatformRegistry = {
  /**
   * Detecta la plataforma del email en base a remitente y asunto.
   * @returns {"airbnb"|"lodgify"|"unknown"}
   */
  detect(from, subject) {
    try {
      if (AirbnbProcessor.shouldProcessAirbnbEmail(from, subject)) return "airbnb";
      if (LodgifyProcessor.shouldProcessLodgifyEmail(from, subject)) return "lodgify";
      return "unknown";
    } catch (_) {
      return "unknown";
    }
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PlatformRegistry };
} else {
  globalThis.PlatformRegistry = PlatformRegistry;
}
