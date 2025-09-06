/* eslint-disable */
/* prettier-ignore-file */
/* global Logger */
const __CONST_REF__ = (globalThis.CONSTANTS) || (typeof require !== 'undefined' && require("./Constants").CONSTANTS);

/**
 * Sistema de logging centralizado con diferentes niveles
 */
class AppLogger {
  static log(level, message, context = {}) {
    const ts = new Date().toISOString();
    const ctx = Object.keys(context).length ? ` | ${JSON.stringify(context)}` : "";
    Logger.log(`[${ts}][${level}] ${message}${ctx}`);
  }

  static info(message, context = {}) {
  this.log(__CONST_REF__.LOGGING.LEVELS.INFO, message, context);
  }

  static warn(message, context = {}) {
  this.log(__CONST_REF__.LOGGING.LEVELS.WARN, message, context);
  }

  static error(message, context = {}) {
  this.log(__CONST_REF__.LOGGING.LEVELS.ERROR, message, context);
  }

  static debug(message, context = {}) {
  this.log(__CONST_REF__.LOGGING.LEVELS.DEBUG, message, context);
  }

  static airtableOperation(operation, reservationId, data = {}) {
    this.info(`[Airtable] ${operation}`, { reservationId, ...data });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppLogger };
}
if (!globalThis.AppLogger) {
  globalThis.AppLogger = AppLogger;
}
