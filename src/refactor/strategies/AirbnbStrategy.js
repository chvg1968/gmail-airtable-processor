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
 * Estrategia específica para procesar emails de Airbnb
 * Strategy Pattern: Implementa lógica específica para Airbnb
 */
class AirbnbStrategy extends EmailProcessingStrategy {

  canProcess(from, subject) {
    if (!from || !subject) return false;

    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();

    // Verificar remitente
    const isFromAirbnb = fromLower.includes('airbnb') ||
                        fromLower.includes('automated-noreply@airbnb.com');

    // Verificar asunto (confirmaciones de reserva)
    const isReservationConfirmation = subjectLower.includes('reservation confirmed') ||
                                     subjectLower.includes('instant booking') ||
                                     subjectLower.includes('booking confirmed');

    return isFromAirbnb && isReservationConfirmation;
  }

  process(from, subject, body) {
    // Obtener dependencias
    const DateUtils = this.getDateUtils();
    const SimpleLogger = this.getSimpleLogger();

    if (!this.canProcess(from, subject)) {
      return null;
    }

    try {
      SimpleLogger?.debug('Procesando email Airbnb', { subject });

      // Extraer información básica del asunto
      const basicInfo = DateUtils.extractReservationInfo(subject);

      let result = {
        platform: 'Airbnb',
        guestName: basicInfo.firstName || '',
        checkInDate: basicInfo.arrivalDate || '',
        checkOutDate: '', // Airbnb no siempre incluye checkout en el asunto
        reservationNumber: basicInfo.reservationNumber || '',
        rawSubject: subject,
        rawFrom: from,
        rawBody: body,
        _processingInfo: {
          strategy: 'AirbnbStrategy',
          extractedFrom: 'subject',
          timestamp: new Date().toISOString()
        }
      };

      // Si faltan datos críticos, intentar extraer del body usando Gemini
      if (this.needsBodyProcessing(result)) {
        result = this.enrichWithBodyData(result, body);
      }

      // Validar resultado final
      if (this.validateDTO(result)) {
        SimpleLogger?.info('Email Airbnb procesado exitosamente', {
          guestName: result.guestName,
          checkInDate: result.checkInDate
        });
        return result;
      } else {
        SimpleLogger?.warn('DTO Airbnb inválido después del procesamiento', { subject });
        return null;
      }

    } catch (error) {
      SimpleLogger?.error('Error procesando email Airbnb', {
        error: error.message,
        subject
      });
      return null;
    }
  }

  needsBodyProcessing(dto) {
    return !dto.checkInDate ||
           !dto.reservationNumber ||
           !dto.guestName ||
           dto.guestName.trim().length === 0;
  }

  enrichWithBodyData(dto, body) {
    const GeminiService = this.getGeminiService();
    const SimpleLogger = this.getSimpleLogger();

    if (!GeminiService || !body) {
      return dto;
    }

    try {
      SimpleLogger?.info('Enriqueciendo datos Airbnb con Gemini', { subject: dto.rawSubject });

      const currentYear = new Date().getFullYear();
      const apiKey = this.getGeminiApiKey();
      const geminiData = GeminiService.extract(body, apiKey, currentYear);

      if (geminiData) {
        return {
          ...dto,
          guestName: geminiData.guestName || dto.guestName,
          checkInDate: geminiData.checkInDate || dto.checkInDate,
          checkOutDate: geminiData.checkOutDate || dto.checkOutDate,
          reservationNumber: geminiData.reservationNumber || dto.reservationNumber,
          _processingInfo: {
            ...dto._processingInfo,
            extractedFrom: 'body:gemini'
          }
        };
      }
    } catch (error) {
      SimpleLogger?.warn('Error usando Gemini para Airbnb', { error: error.message });
    }

    return dto;
  }

  getPlatformName() {
    return 'Airbnb';
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

  getGeminiService() {
    if (__IS_NODE__) {
      return require('../GeminiService');
    } else {
      return globalThis.GeminiService;
    }
  }

  getGeminiApiKey() {
    const CONFIG = this.getConfig();
    return CONFIG?.geminiApiKey;
  }

  getConfig() {
    if (__IS_NODE__) {
      return require('../Config');
    } else {
      return globalThis.CONFIG;
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AirbnbStrategy };
} else if (typeof globalThis !== 'undefined') {
  globalThis.AirbnbStrategy = AirbnbStrategy;
}