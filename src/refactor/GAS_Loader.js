/* eslint-disable */
/**
 * GAS_Loader.js
 * ---------------------------------------------
 * Objetivo:
 *  Permitir una vía sencilla de reutilizar los módulos existentes en Google Apps Script (GAS)
 *  sin necesidad inmediata de un bundler. En entorno Node rellena globalThis con las
 *  exportaciones de cada módulo mediante require. En GAS puedes copiar/pegar los módulos
 *  (adaptados a globals) y este loader no rompe nada.
 *
 * Modos de uso:
 *  1) NODE (desarrollo / pruebas):
 *     - Simplemente require este archivo antes de usar processEmails.
 *       require('./src/refactor/GAS_Loader').initGlobals();
 *
 *  2) GAS (simple sin bundling):
 *     - Crea un archivo por cada módulo en el editor de Apps Script.
 *     - En cada uno elimina 'require' y 'module.exports' y sustituye por asignaciones:
 *         globalThis.EmailUtils = { ... }  ó  var EmailUtils = { ... };
 *         globalThis.SharedUtils = { ... };
 *       (Puedes dejar ambos para seguridad.)
 *     - Pega este archivo (loader) al final y opcionalmente borra las partes Node.
 *     - Asegúrate que el archivo con processEmails (MainRefactored) está al final para que vea todos los globals.
 *
 *  3) GAS con generación automática (opcional futuro):
 *     - Crear un pequeño script de concatenación o usar esbuild para producir un único Code.js.
 *
 * Nota: Este loader NO transforma los módulos; sólo ayuda a normalizar acceso global.
 */

function attachGlobal(name, value) {
  if (!value) return;
  if (!globalThis[name]) {
    globalThis[name] = value;
  }
}

function safeRequire(path) {
  try {
    if (typeof require === 'undefined') return null; // Entorno GAS
    return require(path);
  } catch (e) {
    // Silencioso: en GAS es normal que falle.
    return null;
  }
}

function initGlobals() {
  // Utils
  attachGlobal('Utils', safeRequire('./Utils'));
  attachGlobal('EmailUtils', safeRequire('./utils/EmailUtils'));
  attachGlobal('Parser', safeRequire('./Parser'));
  attachGlobal('GeminiService', safeRequire('./GeminiService'));
  attachGlobal('PropertyService', safeRequire('./PropertyService'));
  attachGlobal('NameEnhancementService', safeRequire('./NameEnhancementService'));
  // Filters
  attachGlobal('EmailFilters', safeRequire('./filters/EmailFilters'));
  // Duplicate Detector
  attachGlobal('DuplicateDetector', safeRequire('./duplicates/DuplicateDetector'));
  // Processors
  attachGlobal('LodgifyProcessor', safeRequire('./processors/LodgifyProcessor'));
  attachGlobal('AirbnbProcessor', safeRequire('./processors/AirbnbProcessor'));
  const pr = safeRequire('./processors/PlatformRegistry');
  if (pr && pr.PlatformRegistry) attachGlobal('PlatformRegistry', pr.PlatformRegistry);
  // Shared
  const su = safeRequire('./shared/SharedUtils');
  if (su && su.SharedUtils) attachGlobal('SharedUtils', su.SharedUtils);
  const al = safeRequire('./shared/AppLogger');
  if (al && al.AppLogger) attachGlobal('AppLogger', al.AppLogger);
  const ct = safeRequire('./shared/Constants');
  if (ct && ct.CONSTANTS) attachGlobal('CONSTANTS', ct.CONSTANTS);

  // Main (no ejecuta nada, sólo prepara globals si fuera necesario)
  // Al requerir MainRefactored se registran las funciones de export si estamos en Node.
  const main = safeRequire('./MainRefactored');
  if (main) {
    // Exponer por claridad en entorno Node
    attachGlobal('processEmails', main.processEmails);
    attachGlobal('processAirbnbEmail', main.processAirbnbEmail);
  }
  return true;
}

// Auto-init en Node para comodidad (si se carga directamente)
if (typeof module !== 'undefined' && module.parent == null) {
  initGlobals();
  console.log('[GAS_Loader] Globals inicializados.');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initGlobals };
} else {
  // Entorno GAS: exponer initGlobals opcionalmente
  globalThis.initGlobals = initGlobals;
}
