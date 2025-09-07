/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG */

/**
 * Main SIMPLIFICADO - Versión moderna usando SimpleEmailProcessor
 * Arquitectura simplificada: Email → SimpleEmailProcessor → Airtable
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

// Lazy loading para compatibilidad GAS/Node - SIMPLIFICADO
let EmailProcessor, SimpleLogger, SimpleEmailProcessor, SharedUtils;

function ensureDependencies() {
  if (__IS_NODE__) {
    if (!EmailProcessor) {
      const { EmailProcessor: EP } = require("./core/EmailProcessor");
      EmailProcessor = EP;
    }
    if (!SimpleLogger) {
      const { SimpleLogger: SL } = require("./utils/SimpleLogger");
      SimpleLogger = SL;
    }
    if (!SimpleEmailProcessor) {
      SimpleEmailProcessor = require("./processors/SimpleEmailProcessor");
    }
    if (!SharedUtils) {
      const { SharedUtils: SU } = require("./shared/SharedUtils");
      SharedUtils = SU;
    }
  } else {
    // GAS environment
    if (!EmailProcessor) EmailProcessor = globalThis.EmailProcessor;
    if (!SimpleLogger) SimpleLogger = globalThis.SimpleLogger;
    if (!SimpleEmailProcessor) SimpleEmailProcessor = globalThis.SimpleEmailProcessor;
    if (!SharedUtils) SharedUtils = globalThis.SharedUtils;
  }
}

/**
 * Función principal de procesamiento - PUNTO DE ENTRADA SIMPLIFICADO
 * Mantiene la misma interfaz que Main.js original para compatibilidad
 */
async function processEmails() {
  try {
    ensureDependencies();
    
    // Log de inicio usando SimpleLogger
    SimpleLogger.start("PROCESAMIENTO DE EMAILS", {
      safeMode: CONFIG.SAFE_MODE,
      environment: __IS_NODE__ ? 'Node.js' : 'Google Apps Script'
    });

    // Crear instancia del procesador y ejecutar
    const processor = new EmailProcessor();
    const result = await processor.processEmails();

    // Log del resumen final
    SimpleLogger.finish("PROCESAMIENTO DE EMAILS", {
      total: result.total,
      processedInAirtable: result.processedInAirtable,
      skipped: result.skipped,
      successRate: `${((result.processedInAirtable / result.total) * 100).toFixed(1)}%`
    });

    // Compatibilidad con logging legacy de Google Apps Script
    if (typeof Logger !== 'undefined') {
      Logger.log(`
[PROCESSING SUMMARY - SIMPLIFIED]
----------------------------------------
Emails Found: ${result.total}
Reservations Processed in Airtable: ${result.processedInAirtable}
Skipped Emails/Reservations: ${result.skipped}
Success Rate: ${((result.processedInAirtable / result.total) * 100).toFixed(1)}%
----------------------------------------`);
    }

    return result;

  } catch (error) {
    const errorMsg = `ERROR CRÍTICO en processEmails: ${error.message}`;
    
    if (SimpleLogger) {
      SimpleLogger.error(errorMsg, { 
        stack: error.stack,
        environment: __IS_NODE__ ? 'Node.js' : 'Google Apps Script'
      });
    }
    
    if (typeof Logger !== 'undefined') {
      Logger.log(errorMsg);
    }
    
    throw error;
  }
}

/**
 * Funciones de compatibilidad SIMPLIFICADAS
 * Usan SimpleEmailProcessor para mantener compatibilidad con código legacy
 */

// Función legacy usando SimpleEmailProcessor
function processAirbnbEmail(msg, body, subject, from) {
  ensureDependencies();
  
  SimpleLogger.debug("Procesando Airbnb via función legacy", { subject });
  
  // Usar SimpleEmailProcessor directamente
  return SimpleEmailProcessor.processAirbnbEmail(from, subject, body);
}

function hasValidReservationData(dto) {
  ensureDependencies();
  return SharedUtils.hasValidReservationData(dto);
}

function extractReservationNumber(platform, subject, body) {
  ensureDependencies();
  
  // Usar SimpleEmailProcessor para extraer número de reserva
  const quickInfo = SimpleEmailProcessor.getQuickReservationInfo(subject);
  return quickInfo ? quickInfo.reservationNumber : null;
}

/**
 * Función de health check SIMPLIFICADA
 * Verifica todas las dependencias modernas
 */
function healthCheck() {
  ensureDependencies();
  
  const checks = {
    EmailProcessor: !!EmailProcessor,
    SimpleLogger: !!SimpleLogger,
    SimpleEmailProcessor: !!SimpleEmailProcessor,
    SharedUtils: !!SharedUtils,
    CONFIG: typeof CONFIG !== 'undefined',
    environment: __IS_NODE__ ? 'Node.js' : 'Google Apps Script',
    timestamp: new Date().toISOString()
  };

  SimpleLogger.info("Health Check Main.js", checks);
  
  return checks;
}

/**
 * Función de fallback SIMPLIFICADA
 * Solo mantiene funcionalidad básica sin dependencias complejas
 */
function processEmailsWithFallback() {
  try {
    return processEmails();
  } catch (error) {
    SimpleLogger.error("Error en Main.js simplificado", { error: error.message });
    
    if (typeof Logger !== 'undefined') {
      Logger.log(`[Main] Error en procesador simplificado: ${error.message}`);
    }
    
    throw error; // Ya no hay fallback - debe funcionar el código simplificado
  }
}

// === EXPORTS SIMPLIFICADOS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Función principal
    processEmails,
    
    // Funciones de compatibilidad
    processAirbnbEmail,
    hasValidReservationData,
    extractReservationNumber,
    
    // Utilidades
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
