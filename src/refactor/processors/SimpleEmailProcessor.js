/* eslint-disable */
/* prettier-ignore-file */

/**
 * Procesador SIMPLIFICADO para todos los emails de reservas
 * Reemplaza AirbnbProcessor y LodgifyProcessor con lógica unificada
 * 
 * Filosofía: Email → Identificar → Extraer → Validar (SIMPLE)
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

// Lazy loading de dependencias
let DateUtils, SimpleLogger, GeminiService;

function ensureDependencies() {
  if (__IS_NODE__) {
    if (!DateUtils) DateUtils = require('../utils/DateUtils');
    if (!SimpleLogger) SimpleLogger = require('../utils/SimpleLogger').SimpleLogger;
    if (!GeminiService) GeminiService = require('../GeminiService');
  } else {
    // GAS environment - reintenta cargar hasta que funcione
    if (!DateUtils) DateUtils = globalThis.DateUtils;
    if (!SimpleLogger) SimpleLogger = globalThis.SimpleLogger;
    if (!GeminiService) GeminiService = globalThis.GeminiService;
  }
}

// Función auxiliar para obtener DateUtils de forma segura (SIN recursión)
function getDateUtils() {
  // Acceso directo y simple - NO lazy loading
  if (typeof globalThis !== 'undefined' && globalThis.DateUtils) {
    return globalThis.DateUtils;
  }
  
  // Log de error simple
  if (typeof Logger !== 'undefined') {
    Logger.log('[SimpleEmailProcessor] ERROR: DateUtils no disponible');
  }
  
  return null;
}

// Función auxiliar para obtener SimpleLogger de forma segura (SIN recursión)
function getSimpleLogger() {
  // Acceso directo y simple - NO lazy loading
  if (typeof globalThis !== 'undefined' && globalThis.SimpleLogger) {
    return globalThis.SimpleLogger;
  }
  
  return null;
}

// Función auxiliar para obtener GeminiService de forma segura
function getGeminiService() {
  if (typeof globalThis !== 'undefined' && globalThis.GeminiService) {
    return globalThis.GeminiService;
  }
  return null;
}

/**
 * Identifica la plataforma desde el remitente del email
 * @param {string} from - Remitente del email
 * @returns {string} - 'airbnb', 'lodgify', 'vrbo' o 'unknown'
 */
function identifyPlatform(from) {
  if (!from) return 'unknown';
  
  const fromLower = from.toLowerCase();
  
  if (fromLower.includes('airbnb')) return 'airbnb';
  if (fromLower.includes('lodgify')) return 'lodgify';  
  if (fromLower.includes('vrbo') || fromLower.includes('homeaway')) return 'vrbo';
  
  return 'unknown';
}

/**
 * Verifica si es un email de confirmación de reserva válido
 * @param {string} subject - Asunto del email
 * @returns {boolean}
 */
function isBookingConfirmation(subject) {
  if (!subject) return false;

  const confirmationPatterns = [
    /reservation confirmed/i,
    /instant booking/i,
    /new confirmed booking/i,
    /booking confirmed/i,
    /booking confirmation/i,    // Para VRBO "Booking Confirmation #123456"
    /reservation.*is confirmed/i, // Para "Your reservation #ABC123 is confirmed"
    /BOOKING\s*\(/i,           // Para "BOOKING (#B15831191)"
    /vrbo reservation.*confirmed/i // Para "Your VRBO reservation B987654 confirmed"
  ];

  return confirmationPatterns.some(pattern => pattern.test(subject));
}

/**
 * Verifica si es un email reenviado que debe ignorarse
 * @param {string} subject - Asunto del email
 * @returns {boolean}
 */
function isForwardedEmail(subject) {
  return /^fwd:/i.test(subject);
}

/**
 * Verifica si el email debe procesarse
 * @param {string} from - Remitente
 * @param {string} subject - Asunto
 * @returns {boolean}
 */
function shouldProcessEmail(from, subject) {
  const platform = identifyPlatform(from);
  
  // Solo procesar plataformas conocidas
  if (platform === 'unknown') return false;
  
  // Solo confirmaciones de reserva
  if (!isBookingConfirmation(subject)) return false;
  
  // No procesar emails reenviados
  if (isForwardedEmail(subject)) return false;
  
  return true;
}

/**
 * Extrae y valida información de reserva desde el asunto
 * @param {string} subject - Asunto del email
 * @returns {Object|null} - Información extraída o null si es inválida
 */
function extractReservationData(subject) {
  const dateUtils = getDateUtils();
  
  // Verificación crítica de dependencias
  if (!dateUtils) {
    const errorMsg = 'DateUtils no está disponible en SimpleEmailProcessor';
    if (typeof Logger !== 'undefined') {
      Logger.log(`[SimpleEmailProcessor] ERROR: ${errorMsg} - Subject: ${subject}`);
    }
    const logger = getSimpleLogger();
    if (logger) {
      logger.error(errorMsg, { subject });
    }
    return null;
  }
  
  const data = dateUtils.extractReservationInfo(subject);
  
  // Validar que tenemos la información mínima necesaria
  if (!data.firstName || !data.arrivalDate) {
    const logger = getSimpleLogger();
    if (logger) {
      logger.warn("Información incompleta en asunto", { subject });
    }
    return null;
  }

  // Validar que la fecha sea válida
  if (!dateUtils.isValidDate(data.arrivalDate)) {
    const logger = getSimpleLogger();
    if (logger) {
      logger.warn("Fecha inválida", { arrivalDate: data.arrivalDate, subject });
    }
    return null;
  }

  return data;
}

/**
 * Procesa cualquier email de reserva de forma unificada
 * PUNTO DE ENTRADA PRINCIPAL
 * 
 * @param {string} from - Remitente del email
 * @param {string} subject - Asunto del email
 * @param {string} body - Cuerpo del email
 * @returns {Object|null} - Datos procesados o null
 */
function processReservationEmail(from, subject, body) {
  const logger = getSimpleLogger();

  // 1. Verificar si debe procesarse
  if (!shouldProcessEmail(from, subject)) {
    return null;
  }

  // 2. Identificar plataforma
  const platform = identifyPlatform(from);
  
  // 3. Extraer datos básicos desde el asunto (intento rápido)
  let reservationData = extractReservationData(subject);

  // 4. Si los datos del asunto son insuficientes y es Airbnb, usar Gemini como fallback
  if (platform === 'airbnb' && (!reservationData || !reservationData.reservationNumber)) {
    const geminiService = getGeminiService();
    if (geminiService) {
      logger.info("Datos insuficientes en asunto de Airbnb, usando Gemini en el cuerpo.", { subject });
      
      // Gemini necesita el año para interpretar fechas sin año
      const currentYear = new Date().getFullYear();
      const geminiData = geminiService.extract(body, CONFIG.geminiApiKey, currentYear); // API Key se gestiona dentro de GeminiService
      
      if (geminiData && geminiData.reservationNumber) {
        // Combinar datos: los de Gemini son más completos
        reservationData = {
          firstName: geminiData.guestName,
          arrivalDate: geminiData.checkInDate,
          reservationNumber: geminiData.reservationNumber,
          // ... otros campos que Gemini pueda devolver
        };
        logger.info("Datos extraídos con Gemini", { reservationNumber: geminiData.reservationNumber });
      } else {
        logger.warn("Gemini no pudo extraer los datos necesarios.", { subject });
        return null; // Si ni el asunto ni Gemini funcionan, no se puede procesar
      }
    }
  }

  // Si después de todos los intentos no hay datos, no continuar
  if (!reservationData) {
    logger.warn("No se pudieron extraer datos de la reserva.", { subject });
    return null;
  }

  // 5. Crear resultado unificado
  const result = {
    platform: platform.charAt(0).toUpperCase() + platform.slice(1), // Capitalize
    firstName: reservationData.firstName,
    arrivalDate: reservationData.arrivalDate,
    reservationNumber: reservationData.reservationNumber,
    rawSubject: subject,
    rawFrom: from,
    rawBody: body,
    
    // Metadata para debugging
    _processingInfo: {
      extractedFrom: reservationData._extractedFrom || 'subject', // Indicar si vino de gemini
      platform: platform,
      timestamp: new Date().toISOString()
    }
  };

  if (logger) {
    logger.info("Procesado email de reserva", {
      platform,
      firstName: reservationData.firstName,
      arrivalDate: reservationData.arrivalDate
    });
  }
  
  return result;
}

/**
 * Función de compatibilidad para Airbnb (mantiene API existente)
 */
function processAirbnbEmail(from, subject, body) {
  if (identifyPlatform(from) !== 'airbnb') {
    return null;
  }
  return processReservationEmail(from, subject, body);
}

/**
 * Función de compatibilidad para Lodgify (mantiene API existente)
 */
function processLodgifyEmail(from, subject, body) {
  if (identifyPlatform(from) !== 'lodgify') {
    return null;
  }
  return processReservationEmail(from, subject, body);
}

/**
 * Función de utilidad para obtener información rápida sin procesar completamente
 */
function getQuickReservationInfo(subject) {
  const dateUtils = getDateUtils();
  if (!dateUtils) {
    if (typeof Logger !== 'undefined') {
      Logger.log('[SimpleEmailProcessor] ERROR: DateUtils no disponible en getQuickReservationInfo');
    }
    return null;
  }
  return dateUtils.extractReservationInfo(subject);
}

/**
 * Health check del procesador
 */
function healthCheck() {
  return {
    dateUtilsAvailable: !!(typeof globalThis !== 'undefined' && globalThis.DateUtils),
    simpleLoggerAvailable: !!(typeof globalThis !== 'undefined' && globalThis.SimpleLogger),
    supportedPlatforms: ['airbnb', 'lodgify', 'vrbo'],
    status: 'ready'
  };
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Función principal
    processReservationEmail,
    
    // Funciones de compatibilidad
    processAirbnbEmail,
    processLodgifyEmail,
    
    // Utilidades
    identifyPlatform,
    shouldProcessEmail,
    extractReservationData,
    getQuickReservationInfo,
    isBookingConfirmation,
    healthCheck
  };
} else {
  // Solo declarar si no existe ya (evita errores de declaración duplicada en GAS)
  if (typeof globalThis.SimpleEmailProcessor === 'undefined') {
    globalThis.SimpleEmailProcessor = {
      processReservationEmail,
      processAirbnbEmail,
      processLodgifyEmail,
      identifyPlatform,
      shouldProcessEmail,
      extractReservationData,
      getQuickReservationInfo,
      isBookingConfirmation,
      healthCheck
    };
  }
}
