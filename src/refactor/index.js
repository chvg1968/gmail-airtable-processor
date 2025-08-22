/**
 * Índice de todos los servicios del sistema
 * Este archivo facilita la importación de todos los servicios en Google Apps Script
 */

// Exportar todos los servicios
if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = {
    CONFIG: require('./Config.js'),
    EmailService: require('./EmailService.js'),
    AirtableService: require('./AirtableService.js'),
    Parser: require('./Parser.js'),
    GeminiService: require('./GeminiService.js'),
    PropertyService: require('./PropertyService.js'),
    NameEnhancementService: require('./NameEnhancementService.js'),
    Utils: require('./Utils.js'),
    Main: require('./Main.js')
  };
} else {
  // Google Apps Script - los servicios ya están disponibles globalmente
  // Este archivo sirve como documentación de la estructura
}
