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
 * Estrategia específica para procesar emails de Vrbo/HomeAway
 * Strategy Pattern: Implementa lógica específica para Vrbo
 */
class VrboStrategy extends EmailProcessingStrategy {

  canProcess(from, subject) {
    if (!from || !subject) return false;

    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();

    // Verificar remitente
    const isFromVrbo = fromLower.includes('vrbo') ||
                      fromLower.includes('homeaway') ||
                      fromLower.includes('noreply@vrbo.com');

    // Verificar asunto (confirmaciones de reserva)
    const isReservationConfirmation = subjectLower.includes('booking confirmed') ||
                                     subjectLower.includes('reservation confirmed') ||
                                     subjectLower.includes('booking confirmation');

    return isFromVrbo && isReservationConfirmation;
  }

  process(from, subject, body) {
    // Obtener dependencias
    const DateUtils = this.getDateUtils();
    const SimpleLogger = this.getSimpleLogger();

    if (!this.canProcess(from, subject)) {
      return null;
    }

    try {
      SimpleLogger?.debug('Procesando email Vrbo', { subject });

      // Extraer información del asunto
      const basicInfo = DateUtils.extractReservationInfo(subject);

      const result = {
        platform: 'Vrbo',
        guestName: basicInfo.firstName || '',
        checkInDate: basicInfo.arrivalDate || '',
        checkOutDate: '', // Vrbo normalmente incluye checkout en el asunto
        reservationNumber: basicInfo.reservationNumber || '',
        rawSubject: subject,
        rawFrom: from,
        rawBody: body,
        _processingInfo: {
          strategy: 'VrboStrategy',
          extractedFrom: 'subject',
          timestamp: new Date().toISOString()
        }
      };

      // Enriquecer con datos del body si es necesario
      const enrichedResult = this.enrichWithBodyData(result, body);

      // Validar resultado
      if (this.validateDTO(enrichedResult)) {
        SimpleLogger?.info('Email Vrbo procesado exitosamente', {
          guestName: enrichedResult.guestName,
          checkInDate: enrichedResult.checkInDate
        });
        return enrichedResult;
      } else {
        SimpleLogger?.warn('DTO Vrbo inválido', { subject });
        return null;
      }

    } catch (error) {
      SimpleLogger?.error('Error procesando email Vrbo', {
        error: error.message,
        subject
      });
      return null;
    }
  }

  enrichWithBodyData(dto, body) {
    // Para Vrbo, intentar extraer checkout del body si no está en el asunto
    if (!dto.checkOutDate && body) {
      // Buscar patrones comunes de checkout en Vrbo
      const checkOutPatterns = [
        /check.?out[:\s]+([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
        /departure[:\s]+([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
        /end[:\s]+([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i
      ];

      for (const pattern of checkOutPatterns) {
        const match = body.match(pattern);
        if (match) {
          const DateUtils = this.getDateUtils();
          const extracted = DateUtils.extractArrivalDate(match[1]);
          if (extracted) {
            dto.checkOutDate = extracted;
            break;
          }
        }
      }
    }

    return dto;
  }

  getPlatformName() {
    return 'Vrbo';
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
  module.exports = { VrboStrategy };
} else if (typeof globalThis !== 'undefined') {
  globalThis.VrboStrategy = VrboStrategy;
}