/* eslint-disable */
/* prettier-ignore-file */

/**
 * Interfaz base para estrategias de procesamiento de emails
 * Strategy Pattern: Define contrato común para procesar emails de diferentes plataformas
 */

class EmailProcessingStrategy {
  /**
   * Determina si esta estrategia puede procesar el email dado
   * @param {string} from - Remitente del email
   * @param {string} subject - Asunto del email
   * @returns {boolean} true si puede procesar este email
   */
  canProcess(from, subject) {
    throw new Error('canProcess debe ser implementado por la subclase');
  }

  /**
   * Procesa el email y extrae la información de reserva
   * @param {string} from - Remitente del email
   * @param {string} subject - Asunto del email
   * @param {string} body - Cuerpo del email
   * @returns {Object|null} DTO con información de reserva o null si no puede procesar
   */
  process(from, subject, body) {
    throw new Error('process debe ser implementado por la subclase');
  }

  /**
   * Valida que el DTO tenga la información mínima requerida
   * @param {Object} dto - DTO a validar
   * @returns {boolean} true si es válido
   */
  validateDTO(dto) {
    return dto &&
           typeof dto.guestName === 'string' &&
           dto.guestName.trim().length > 0 &&
           dto.checkInDate &&
           dto.checkOutDate &&
           dto.platform;
  }

  /**
   * Obtiene el nombre de la plataforma que maneja esta estrategia
   * @returns {string} Nombre de la plataforma
   */
  getPlatformName() {
    throw new Error('getPlatformName debe ser implementado por la subclase');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailProcessingStrategy };
} else if (typeof globalThis !== 'undefined') {
  globalThis.EmailProcessingStrategy = EmailProcessingStrategy;
}