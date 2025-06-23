/*
 * Ligero wrapper sobre console.* para permitir niveles y fácil mock.
 * Durante los tests (NODE_ENV === 'test') los métodos debug/info están silenciados
 * para evitar ruido. warn/error siguen mostrando salida.
 */

const isTest = process.env.NODE_ENV === 'test';

function baseLog(method: 'log' | 'info' | 'warn' | 'error', ...args: any[]) {
  // Silenciar debug/info en tests
  if (isTest && (method === 'log' || method === 'info')) return;
  // eslint-disable-next-line no-console
  console[method](...args);
}

export const logger = {
  debug: (...a: any[]) => baseLog('log', ...a),
  info: (...a: any[]) => baseLog('info', ...a),
  warn: (...a: any[]) => baseLog('warn', ...a),
  error: (...a: any[]) => baseLog('error', ...a),
};
