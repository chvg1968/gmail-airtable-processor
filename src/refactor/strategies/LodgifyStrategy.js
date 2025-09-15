/* eslint-disable */
/* prettier-ignore-file */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

// Importar la interfaz base
let EmailProcessingStrategy;
if (__IS_NODE__) {
  EmailProcessingStrategy = require('./EmailProcessingStrategy').EmailProcessingStrategy;
} else {
  EmailProcessingStrategy = globalThis.EmailProcessingStrategy;
}

/**
 * Estrategia específica para procesar emails de Lodgify
 * Strategy Pattern: Implementa lógica específica para Lodgify
 */
class LodgifyStrategy extends EmailProcessingStrategy {

  canProcess(from, subject) {
    if (!from || !subject) return false;

    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();

    // Verificar remitente
    const isFromLodgify = fromLower.includes('lodgify') ||
                         fromLower.includes('no-reply@messaging.lodgify.com');

    // Verificar asunto (solo confirmaciones de reserva)
    const isReservationConfirmation = subjectLower.startsWith('new confirmed booking') ||
                                     subjectLower.includes('reservation confirmed');

    return isFromLodgify && isReservationConfirmation;
  }

  process(from, subject, body) {
    // Obtener dependencias
    const DateUtils = this.getDateUtils();
    const SimpleLogger = this.getSimpleLogger();

    if (!this.canProcess(from, subject)) {
      return null;
    }

    try {
      SimpleLogger?.debug('Procesando email Lodgify', { subject });

      // Extraer información del asunto
      const basicInfo = DateUtils.extractReservationInfo(subject);

      const result = {
        platform: 'Lodgify',
        guestName: basicInfo.firstName || '',
        checkInDate: basicInfo.arrivalDate || '',
        checkOutDate: '', // Intentar extraer del body si es necesario
        reservationNumber: basicInfo.reservationNumber || '',
        rawSubject: subject,
        rawFrom: from,
        rawBody: body,
        _processingInfo: {
          strategy: 'LodgifyStrategy',
          extractedFrom: 'subject',
          timestamp: new Date().toISOString()
        }
      };

      // Para Lodgify, la información normalmente está completa en el asunto
      // pero podemos enriquecer con el body si es necesario
      const enrichedResult = this.enrichWithBodyData(result, body);

      // Validar resultado
      if (this.validateDTO(enrichedResult)) {
        SimpleLogger?.info('Email Lodgify procesado exitosamente', {
          guestName: enrichedResult.guestName,
          checkInDate: enrichedResult.checkInDate
        });
        return enrichedResult;
      } else {
        SimpleLogger?.warn('DTO Lodgify inválido', { subject });
        return null;
      }

    } catch (error) {
      SimpleLogger?.error('Error procesando email Lodgify', {
        error: error.message,
        subject
      });
      return null;
    }
  }

  enrichWithBodyData(dto, body) {
    // Para Lodgify, normalmente tenemos toda la info del asunto
    // Pero podemos intentar extraer checkout si falta
    if (!dto.checkOutDate && body) {
      const checkOutMatch = body.match(/check.?out[:\s]+([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i);
      if (checkOutMatch) {
        const DateUtils = this.getDateUtils();
        const extracted = DateUtils.extractArrivalDate(checkOutMatch[1]);
        if (extracted) {
          dto.checkOutDate = extracted;
        }
      }
    }

    return dto;
  }

  getPlatformName() {
    return 'Lodgify';
  }

  // Métodos auxiliares para obtener dependencias
  getDateUtils() {
    if (__IS_NODE__) {
      return require('../utils/DateUtils');
    } else {
      return globalThis.DateUtils;
    }
  }

  getSimpleLogger() {
    if (__IS_NODE__) {
      return require('../utils/SimpleLogger').SimpleLogger;
    } else {
      return globalThis.SimpleLogger;
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LodgifyStrategy };
} else if (typeof globalThis !== 'undefined') {
  globalThis.LodgifyStrategy = LodgifyStrategy;
}