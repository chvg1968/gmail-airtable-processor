/**
 * Orquestación para Google Apps Script (GAS) - VERSIÓN REFACTORIZADA
 *
 * Requisitos MÍNIMOS (sin GeminiService):
 * - Pega los archivos JS del proyecto en tu script de GAS en este orden EXACTO:
 *   1. Config.js
 *   2. Utils.js
 *   3. SimpleLogger.js
 *   4. DateUtils.js
 *   5. SharedUtils.js (en /shared/)
 *   6. EmailFilters.js (en /filters/)
 *   7. DuplicateDetector.js (en /duplicates/)
 *   8. SimpleEmailProcessor.js (en /processors/)
 *   9. EmailService.js
 *   10. AirtableService.js
 *   11. PropertyService.js
 *   12. EmailProcessor.js (en /core/)
 *   13. Main.js
 * - `CONFIG` debe estar disponible globalmente (definido en Config.js) y `processEmails` en Main.js.
 * - GeminiService.js NO es necesario para funcionalidad básica
 * 
 * IMPORTANTE: Los archivos deben pegarse en el orden exacto listado arriba para evitar errores de dependencias.
 */

// Ejecuta una corrida en modo seguro (no escribe en Airtable)
function runSafeOnce() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) {
      CONFIG.SAFE_MODE = true;
    }
    processEmails();
  } catch (e) {
    Logger.log('[GAS] Error en runSafeOnce: %s', e && e.message);
    throw e;
  }
}

// Ejecuta una corrida normal (escribe en Airtable)
function runOnce() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) {
      CONFIG.SAFE_MODE = false;
    }
    processEmails();
  } catch (e) {
    Logger.log('[GAS] Error en runOnce: %s', e && e.message);
    throw e;
  }
}

// Trigger programado (ajusta SAFE_MODE si quieres pruebas en producción)
function onTimeTrigger() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG) {
      CONFIG.SAFE_MODE = false; // Cambia a true si quieres validar sin escribir
    }
    processEmails();
  } catch (e) {
    Logger.log('[GAS] Error en onTimeTrigger: %s', e && e.message);
    throw e;
  }
}

// Crea un trigger de tiempo cada 15 minutos (ajusta a tu preferencia)
function createTriggers() {
  // Elimina triggers previos de este proyecto para evitar duplicados del mismo handler
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onTimeTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('onTimeTrigger')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('[GAS] Trigger creado: onTimeTrigger cada 15 minutos');
}

// Opcional: inicializa Script Properties para Airtable (GeminiService NO requerido)
function setupScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  var current = props.getProperties();
  var desired = {
    AIRTABLE_API_KEY: current.AIRTABLE_API_KEY || 'REEMPLAZA_AQUI',
    AIRTABLE_BASE_ID: current.AIRTABLE_BASE_ID || 'REEMPLAZA_AQUI',
    AIRTABLE_TABLE_NAME: current.AIRTABLE_TABLE_NAME || 'REEMPLAZA_AQUI'
    // GEMINI_API_KEY eliminado - no necesario para funcionalidad básica
  };
  props.setProperties(desired, true);
  Logger.log('[GAS] Script Properties guardadas. Actualiza los valores REEMPLAZA_AQUI.');
}
