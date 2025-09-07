/* eslint-disable */
/* prettier-ignore-file */
/* global Logger console */

/**
 * Logger SIMPLIFICADO y unificado
 * Reemplaza la mezcla inconsistente de Logger.log, console.log y AppLogger
 * 
 * Filosofía: Un solo logger, logging consistente y simple
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

/**
 * Logger simple unificado que funciona en Node.js y Google Apps Script
 */
class SimpleLogger {
  
  /**
   * Log básico que funciona en ambos entornos
   * @param {string} level - Nivel del log (INFO, WARN, ERROR)
   * @param {string} message - Mensaje a loggear
   * @param {Object} data - Datos adicionales opcionales
   */
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}][${level}]`;
    
    let logMessage = `${prefix} ${message}`;
    
    // Agregar datos si existen
    if (data && typeof data === 'object') {
      logMessage += ` | ${JSON.stringify(data)}`;
    }
    
    // Usar el logger disponible en el entorno
    if (typeof Logger !== 'undefined') {
      // Google Apps Script
      Logger.log(logMessage);
    } else if (typeof console !== 'undefined') {
      // Node.js
      console.log(logMessage);
    }
  }
  
  /**
   * Log de información (nivel más común)
   */
  static info(message, data = null) {
    this.log('INFO', message, data);
  }
  
  /**
   * Log de advertencia
   */
  static warn(message, data = null) {
    this.log('WARN', message, data);
  }
  
  /**
   * Log de error
   */
  static error(message, data = null) {
    this.log('ERROR', message, data);
  }
  
  /**
   * Log específico para operaciones de Airtable
   */
  static airtable(operation, result, data = null) {
    this.info(`[Airtable] ${operation}`, { result, ...data });
  }
  
  /**
   * Log específico para procesamiento de emails
   */
  static email(action, subject, data = null) {
    this.info(`[Email] ${action}`, { subject, ...data });
  }
  
  /**
   * Log específico para operaciones de Gmail
   */
  static gmail(action, count, data = null) {
    this.info(`[Gmail] ${action}`, { count, ...data });
  }
  
  /**
   * Log de inicio de proceso
   */
  static start(process, config = null) {
    this.info(`=== INICIANDO ${process.toUpperCase()} ===`, config);
  }
  
  /**
   * Log de fin de proceso
   */
  static finish(process, summary = null) {
    this.info(`=== COMPLETADO ${process.toUpperCase()} ===`, summary);
  }
  
  /**
   * Log de debugging condicional (solo si está en modo debug)
   */
  static debug(message, data = null) {
    // Solo log si estamos en modo debug
    if (this.isDebugMode()) {
      this.log('DEBUG', message, data);
    }
  }
  
  /**
   * Verifica si estamos en modo debug
   */
  static isDebugMode() {
    // En Node.js, usar variable de entorno
    if (__IS_NODE__) {
      return process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
    }
    
    // En GAS, usar CONFIG si está disponible
    if (typeof CONFIG !== 'undefined' && CONFIG.DEBUG) {
      return CONFIG.DEBUG;
    }
    
    return false;
  }
  
  /**
   * Función de compatibilidad con el AppLogger existente
   */
  static airtableOperation(operation, messageId, data = null) {
    this.airtable(operation, 'success', { messageId, ...data });
  }
  
  /**
   * Health check del logger
   */
  static healthCheck() {
    const hasLogger = typeof Logger !== 'undefined';
    const hasConsole = typeof console !== 'undefined';
    
    return {
      environment: __IS_NODE__ ? 'Node.js' : 'Google Apps Script',
      hasGoogleLogger: hasLogger,
      hasConsole: hasConsole,
      debugMode: this.isDebugMode(),
      status: (hasLogger || hasConsole) ? 'ready' : 'no_logger_available'
    };
  }
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimpleLogger };
} else {
  // Solo declarar si no existe ya (evita errores de declaración duplicada en GAS)
  if (typeof globalThis.SimpleLogger === 'undefined') {
    globalThis.SimpleLogger = SimpleLogger;
  }
}
