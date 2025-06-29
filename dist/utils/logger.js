"use strict";
/*
 * Ligero wrapper sobre console.* para permitir niveles y fácil mock.
 * Durante los tests (NODE_ENV === 'test') los métodos debug/info están silenciados
 * para evitar ruido. warn/error siguen mostrando salida.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const isTest = process.env.NODE_ENV === "test";
function baseLog(method, ...args) {
    // Silenciar debug/info en tests
    if (isTest && (method === "log" || method === "info"))
        return;
    // eslint-disable-next-line no-console
    console[method](...args);
}
exports.logger = {
    debug: (...a) => baseLog("log", ...a),
    info: (...a) => baseLog("info", ...a),
    warn: (...a) => baseLog("warn", ...a),
    error: (...a) => baseLog("error", ...a),
};
