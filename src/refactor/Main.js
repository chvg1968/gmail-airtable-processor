/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG */

/**
 * Main refactorizado - Versión simplificada usando EmailProcessor
 * Reemplaza la funcionalidad monolítica de Main.js con arquitectura modular
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

// Lazy loading para compatibilidad GAS/Node
let EmailProcessor, AppLogger;

function ensureDependencies() {
  if (__IS_NODE__) {
    if (!EmailProcessor) {
      const { EmailProcessor: EP } = require("./core/EmailProcessor");
      EmailProcessor = EP;
    }
    if (!AppLogger) {
      const { AppLogger: AL } = require("./shared/AppLogger");
      AppLogger = AL;
    }
  } else {
    // GAS environment
    if (!EmailProcessor) EmailProcessor = globalThis.EmailProcessor;
    if (!AppLogger) AppLogger = globalThis.AppLogger;
  }
}

/**
 * Función principal de procesamiento - PUNTO DE ENTRADA
 * Mantiene la misma interfaz que Main.js original para compatibilidad
 */
async function processEmails() {
  try {
    ensureDependencies();
    
    // Log de inicio usando el sistema centralizado
    AppLogger.info("[Main] === INICIANDO PROCESAMIENTO DE EMAILS ===", {
      timestamp: new Date().toISOString(),
      safeMode: CONFIG.SAFE_MODE,
    });

    // Crear instancia del procesador y ejecutar
    const processor = new EmailProcessor();
    const result = await processor.processEmails();

    // Log del resumen final
    AppLogger.info("[Main] === PROCESAMIENTO COMPLETADO ===", {
      ...result,
      timestamp: new Date().toISOString(),
    });

    // Compatibilidad con logging legacy
    if (typeof Logger !== 'undefined') {
      Logger.log(`
[PROCESSING SUMMARY - REFACTORED]
----------------------------------------
Emails Found: ${result.total}
Reservations Processed in Airtable: ${result.processedInAirtable}
Skipped Emails/Reservations: ${result.skipped}
Success Rate: ${((result.processedInAirtable / result.total) * 100).toFixed(1)}%
----------------------------------------`);
    }

    return result;

  } catch (error) {
    const errorMsg = `[Main] ERROR CRÍTICO en processEmails: ${error.message}`;
    
    if (AppLogger) {
      AppLogger.error(errorMsg, { 
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
    
    if (typeof Logger !== 'undefined') {
      Logger.log(errorMsg);
    }
    
    throw error;
  }
}

/**
 * Función de compatibilidad - mantiene funciones legacy disponibles
 * para que el código existente no se rompa
 */

// Re-exportar funciones legacy para compatibilidad con MainRefactored
function processAirbnbEmail(msg, body, subject, from) {
  ensureDependencies();
  
  // Delegar al MainRefactored original temporalmente
  // hasta que toda la migración esté completa
  if (__IS_NODE__) {
    const MainRefactored = require("./MainRefactored");
    return MainRefactored.processAirbnbEmail(msg, body, subject, from);
  } else {
    return globalThis.processAirbnbEmail(msg, body, subject, from);
  }
}

function hasValidReservationData(dto) {
  ensureDependencies();
  
  if (__IS_NODE__) {
    const { SharedUtils } = require("./shared/SharedUtils");
    return SharedUtils.hasValidReservationData(dto);
  } else {
    return globalThis.SharedUtils.hasValidReservationData(dto);
  }
}

function extractReservationNumber(platform, subject, body) {
  ensureDependencies();
  
  if (__IS_NODE__) {
    const { SharedUtils } = require("./shared/SharedUtils");
    return SharedUtils.extractReservationNumber(platform, subject, body);
  } else {
    return globalThis.SharedUtils.extractReservationNumber(platform, subject, body);
  }
}

/**
 * Función de health check para verificar que todas las dependencias están disponibles
 * Útil para debugging y tests
 */
function healthCheck() {
  ensureDependencies();
  
  const checks = {
    EmailProcessor: !!EmailProcessor,
    AppLogger: !!AppLogger,
    CONFIG: typeof CONFIG !== 'undefined',
    environment: __IS_NODE__ ? 'Node.js' : 'Google Apps Script',
    timestamp: new Date().toISOString()
  };

  if (AppLogger) {
    AppLogger.info("[Main] Health Check", checks);
  }
  
  return checks;
}

/**
 * Función de utilidad para migración gradual
 * Permite cambiar entre el procesador legacy y el nuevo
 */
function processEmailsWithFallback() {
  try {
    // Intentar usar el nuevo procesador
    return processEmails();
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log(`[Main] Error en nuevo procesador, fallback a legacy: ${error.message}`);
    }
    
    // Fallback al MainRefactored original
    if (__IS_NODE__) {
      const MainRefactored = require("./MainRefactored");
      return MainRefactored.processEmails();
    } else {
      // En GAS, usar función global
      return globalThis.processEmails();
    }
  }
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processEmails,
    processAirbnbEmail,
    hasValidReservationData,
    extractReservationNumber,
    healthCheck,
    processEmailsWithFallback,
  };
} else {
  // Entorno GAS: exponer funciones globalmente
  globalThis.processEmails = processEmails;
  globalThis.processAirbnbEmail = processAirbnbEmail;
  globalThis.hasValidReservationData = hasValidReservationData;
  globalThis.extractReservationNumber = extractReservationNumber;
  globalThis.healthCheck = healthCheck;
  globalThis.processEmailsWithFallback = processEmailsWithFallback;
}
