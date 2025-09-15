/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG */

/**
 * Main SIMPLIFICADO - Versión moderna usando SimpleEmailProcessor
 * Arquitectura simplificada: Email → SimpleEmailProcessor → Airtable
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

// Contenedor de dependencias centralizado
let container;

function getContainer() {
  if (!container) {
    if (__IS_NODE__) {
      container = require("./DependencyContainer").DependencyContainer;
    } else {
      container = globalThis.DependencyContainer;
    }
  }
  return container;
}

/**
 * Función principal de procesamiento - PUNTO DE ENTRADA SIMPLIFICADO
 * Mantiene la misma interfaz que Main.js original para compatibilidad
 */
async function processEmails() {
  try {
    const container = getContainer();
    const SimpleLogger = container.get('SimpleLogger');
    const EmailProcessor = container.get('EmailProcessor');
    const CONFIG = container.get('CONFIG');

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
    const container = getContainer();
    const SimpleLogger = container.get('SimpleLogger');
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
 * Funciones de compatibilidad - Delegan a módulos especializados
 */

// Función legacy usando SimpleEmailProcessor
function processAirbnbEmail(msg, body, subject, from) {
  const container = getContainer();
  const SimpleLogger = container.get('SimpleLogger');
  const SimpleEmailProcessor = container.get('SimpleEmailProcessor');

  SimpleLogger.debug("Procesando Airbnb via función legacy", { subject });

  // Usar SimpleEmailProcessor directamente
  return SimpleEmailProcessor.processAirbnbEmail(from, subject, body);
}

/**
 * Función de health check SIMPLIFICADA
 * Verifica todas las dependencias modernas
 */
function healthCheck() {
  const container = getContainer();
  const SimpleLogger = container.get('SimpleLogger');

  const checks = {
    DependencyContainer: !!container,
    environment: __IS_NODE__ ? 'Node.js' : 'Google Apps Script',
    timestamp: new Date().toISOString(),
    ...container.healthCheck()
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
    const container = getContainer();
    const SimpleLogger = container.get('SimpleLogger');

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

    // Utilidades
    healthCheck,
    processEmailsWithFallback,
  };
} else {
  // Entorno GAS: exponer funciones globalmente (con protección contra duplicados)
  if (typeof globalThis.processEmails === 'undefined') {
    globalThis.processEmails = processEmails;
  }
  if (typeof globalThis.processAirbnbEmail === 'undefined') {
    globalThis.processAirbnbEmail = processAirbnbEmail;
  }
  if (typeof globalThis.healthCheck === 'undefined') {
    globalThis.healthCheck = healthCheck;
  }
  if (typeof globalThis.processEmailsWithFallback === 'undefined') {
    globalThis.processEmailsWithFallback = processEmailsWithFallback;
  }
}
