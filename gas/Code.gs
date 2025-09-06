/**
 * Orquestación para Google Apps Script (GAS)
 *
 * Requisitos:
 * - Pega los archivos JS del proyecto en tu script de GAS en este orden aproximado:
 *   shared/*, utils/*, filters/*, duplicates/*, processors/*, servicios (AirtableService, EmailService), MainRefactored.js y Config.js.
 * - `CONFIG` debe estar disponible globalmente (definido en Config.js) y `processEmails` en MainRefactored.js.
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

// Opcional: inicializa Script Properties para Airtable y Gemini
function setupScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  var current = props.getProperties();
  var desired = {
    AIRTABLE_API_KEY: current.AIRTABLE_API_KEY || 'REEMPLAZA_AQUI',
    AIRTABLE_BASE_ID: current.AIRTABLE_BASE_ID || 'REEMPLAZA_AQUI',
    AIRTABLE_TABLE_NAME: current.AIRTABLE_TABLE_NAME || 'REEMPLAZA_AQUI',
    GEMINI_API_KEY: current.GEMINI_API_KEY || 'REEMPLAZA_AQUI',
  };
  props.setProperties(desired, true);
  Logger.log('[GAS] Script Properties guardadas. Actualiza los valores REEMPLAZA_AQUI.');
}
