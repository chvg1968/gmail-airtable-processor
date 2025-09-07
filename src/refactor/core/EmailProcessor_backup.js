/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG EmailService AirtableService */

/  /**
   * Verifica si un email es de Airbnb - SIMPLIFICADO
   * @param {string} from - Remitente
   * @param {string} subject - Asunto
   * @returns {boolean}
   */
  isAirbnbMessage(from, subject) {
    ensureDependencies();
    
    // Usar SimpleEmailProcessor para identificación unificada
    return SimpleEmailProcessor.identifyPlatform(from) === 'airbnb';
  }rincipal para el procesamiento de emails
 * Refactorización de MainRefactored.js en módulos más pequeños y manejables
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

// Lazy loading de dependencias SIMPLIFICADAS
let EmailFilters, DuplicateDetector, SharedUtils, SimpleLogger, SimpleEmailProcessor;

function ensureDependencies() {
  if (__IS_NODE__) {
    if (!EmailFilters) EmailFilters = require("../filters/EmailFilters");
    if (!DuplicateDetector) DuplicateDetector = require("../duplicates/DuplicateDetector");
    if (!SharedUtils) SharedUtils = require("../shared/SharedUtils").SharedUtils;
    if (!SimpleLogger) SimpleLogger = require("../utils/SimpleLogger").SimpleLogger;
    if (!SimpleEmailProcessor) SimpleEmailProcessor = require("../processors/SimpleEmailProcessor");
  } else {
    // GAS environment
    if (!EmailFilters) EmailFilters = globalThis.EmailFilters;
    if (!DuplicateDetector) DuplicateDetector = globalThis.DuplicateDetector;
    if (!SharedUtils) SharedUtils = globalThis.SharedUtils;
    if (!SimpleLogger) SimpleLogger = globalThis.SimpleLogger;
    if (!SimpleEmailProcessor) SimpleEmailProcessor = globalThis.SimpleEmailProcessor;
  }
}

/**
 * Clase para manejar el procesamiento de emails con separación clara de responsabilidades
 */
class EmailProcessor {
  constructor() {
    this.processedReservations = new Set();
    this.airbnbReservations = new Set();
    this.processedCount = 0;
    this.skippedCount = 0;
    
    ensureDependencies();
  }

  /**
   * Procesa todos los emails obtenidos del servicio de email
   * @returns {Object} Resultado del procesamiento
   */
  async processEmails() {
    try {
      ensureDependencies();
      SimpleLogger.start("procesamiento de emails", {
        SAFE_MODE: CONFIG.SAFE_MODE,
      });

      const messages = this.fetchMessages();
      const sortedMessages = this.sortMessagesByPlatform(messages);
      
      for (const msg of sortedMessages) {
        await this.processMessage(msg);
      }

      const result = this.getProcessingSummary();
      SimpleLogger.finish("procesamiento de emails", result);
      return result;
      
    } catch (error) {
      SimpleLogger.error("Error crítico en procesamiento", { error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene mensajes del servicio de email
   * @returns {Array} Lista de mensajes
   */
  fetchMessages() {
    const messages = EmailService.fetch();
    SimpleLogger.gmail("Mensajes obtenidos", messages.length);
    return messages;
  }

  /**
   * Ordena mensajes por plataforma, priorizando Airbnb
   * @param {Array} messages - Mensajes a ordenar
   * @returns {Array} Mensajes ordenados
   */
  sortMessagesByPlatform(messages) {
    const airbnbMessages = [];
    const otherMessages = [];

    for (const msg of messages) {
      const from = msg.getFrom();
      const subject = msg.getSubject();

      if (this.isAirbnbMessage(from, subject)) {
        airbnbMessages.push(msg);
      } else {
        otherMessages.push(msg);
      }
    }

    // Airbnb primero para manejar duplicados correctamente
    return [...airbnbMessages, ...otherMessages];
  }

  /**
   * Determina si un mensaje es de Airbnb
   * @param {string} from - Remitente
   * @param {string} subject - Asunto
   * @returns {boolean}
   */
  isAirbnbMessage(from, subject) {
    ensureDependencies();
    const AirbnbProcessor = this.getAirbnbProcessor();
    
    return AirbnbProcessor.isAirbnbEmail(from) || 
           this.isEmailFromPlatform(from, subject, CONSTANTS.PLATFORMS.AIRBNB);
  }

  /**
   * Verifica si un email es de una plataforma específica
   * @param {string} from - Remitente
   * @param {string} subject - Asunto  
   * @param {string} platform - Plataforma
   * @returns {boolean}
   */
  isEmailFromPlatform(from, subject, platform) {
    // Lógica simplificada para determinar plataforma
    const text = `${from} ${subject}`.toLowerCase();
    return text.includes(platform.toLowerCase());
  }

  /**
   * Procesa un mensaje individual
   * @param {Object} msg - Mensaje de Gmail
   */
  async processMessage(msg) {
    try {
      const messageId = msg.getId();
      const subject = msg.getSubject();
      const from = msg.getFrom();

      // 1. Aplicar filtros tempranos
      if (this.shouldSkipMessage(from, subject, messageId)) {
        this.skippedCount++;
        return;
      }

      // 2. Procesar según plataforma
      const dto = await this.processMessageByPlatform(msg);
      if (!dto) {
        this.skippedCount++;
        return;
      }

      // 3. Validar y procesar DTO
      if (this.shouldProcessDTO(dto)) {
        await this.saveReservation(dto, messageId);
        this.trackProcessedReservation(dto);
        this.processedCount++;
      } else {
        this.skippedCount++;
      }

    } catch (error) {
      SimpleLogger.error("Error procesando mensaje", {
        subject: msg.getSubject(),
        error: error.message,
      });
      this.skippedCount++;
    }
  }

  /**
   * Determina si un mensaje debe ser omitido
   * @param {string} from - Remitente
   * @param {string} subject - Asunto
   * @param {string} messageId - ID del mensaje
   * @returns {boolean}
   */
  shouldSkipMessage(from, subject, messageId) {
    ensureDependencies();
    
    // Aplicar filtros de email
    const filterResult = EmailFilters.applyEmailFilters(from, subject);
    if (filterResult.shouldSkip) {
      SimpleLogger.email("Skip por filtro", subject, {
        reason: filterResult.reason,
        from
      });
      return true;
    }

    // Verificar si ya fue procesado
    if (AirtableService.isMessageProcessed(CONFIG, messageId)) {
      SimpleLogger.email("Skip por mensaje ya procesado", subject, {
        messageId
      });
      return true;
    }

    return false;
  }

  /**
   * Procesa mensaje según su plataforma detectada usando SimpleEmailProcessor
   * @param {Object} msg - Mensaje de Gmail
   * @returns {Object|null} DTO procesado o null
   */
  async processMessageByPlatform(msg) {
    ensureDependencies();
    
    const from = msg.getFrom();
    const subject = msg.getSubject();
    const body = EmailService.getCleanBody(msg);

    // Usar SimpleEmailProcessor para procesamiento unificado
    const result = SimpleEmailProcessor.processReservationEmail(from, subject, body);
    
    if (!result) {
      SimpleLogger.email("No se pudo procesar", subject, {
        from,
        platform: SimpleEmailProcessor.identifyPlatform(from)
      });
      return null;
    }

    // Convertir el resultado del SimpleEmailProcessor al formato DTO esperado
    const dto = this.convertToDTO(result, msg);
    return dto;
  }

  /**
   * Convierte el resultado del SimpleEmailProcessor al formato DTO esperado
   * @param {Object} result - Resultado del SimpleEmailProcessor
   * @param {Object} msg - Mensaje de Gmail original
   * @returns {Object} DTO en formato esperado
   */
  convertToDTO(result, msg) {
    return {
      // Campos principales de la reserva
      guestName: result.firstName,
      firstName: result.firstName,
      lastName: "", // SimpleEmailProcessor no extrae apellido por ahora
      checkInDate: result.arrivalDate,
      platform: result.platform,
      reservationNumber: result.reservationNumber || "",
      
      // Metadatos del mensaje
      messageId: msg.getId(),
      subject: result.rawSubject,
      from: result.rawFrom,
      body: result.rawBody,
      
      // Información de procesamiento
      processedAt: new Date(),
      extractedBy: "SimpleEmailProcessor",
      
      // Campos adicionales que pueden ser necesarios para compatibilidad
      checkOutDate: "", // No extraído por SimpleEmailProcessor aún
      propertyName: "", // Se enriquecerá más tarde por PropertyService
      
      // Información de debugging
      _processingInfo: result._processingInfo
    };
  }

  /**
   * Procesa mensaje de Lodgify (DEPRECATED - usar processMessageByPlatform)
   * Mantenido por compatibilidad hacia atrás
   * @param {string} subject - Asunto
   * @param {string} body - Cuerpo del mensaje
   * @returns {Object|null} DTO procesado
   */
  async processLodgifyMessage(subject, body) {
    ensureDependencies();
    
    // Usar SimpleEmailProcessor
    const result = SimpleEmailProcessor.processLodgifyEmail("lodgify@example.com", subject, body);
    
    if (!result) {
      SimpleLogger.email("No se pudo procesar mensaje Lodgify", subject);
      return null;
    }

    // Convertir a formato DTO legacy
    return {
      guestName: result.firstName,
      firstName: result.firstName,
      checkInDate: result.arrivalDate,
      platform: result.platform,
      reservationNumber: result.reservationNumber || "",
      subject: subject,
      body: body,
      processedAt: new Date(),
      extractedBy: "SimpleEmailProcessor (legacy compatibility)"
    };
  }

  /**
   * Procesa mensaje de Airbnb (DEPRECATED - usar processMessageByPlatform)
   * Mantenido por compatibilidad hacia atrás
   * @param {Object} msg - Mensaje
   * @param {string} body - Cuerpo
   * @param {string} subject - Asunto
   * @param {string} from - Remitente
   * @returns {Object|null} DTO procesado
   */
  async processAirbnbMessage(msg, body, subject, from) {
    ensureDependencies();
    
    // Usar SimpleEmailProcessor
    const result = SimpleEmailProcessor.processAirbnbEmail(from, subject, body);
    
    if (!result) {
      SimpleLogger.email("No se pudo procesar mensaje Airbnb", subject);
      return null;
    }

    // Convertir a formato DTO legacy
    return {
      guestName: result.firstName,
      firstName: result.firstName,
      checkInDate: result.arrivalDate,
      platform: result.platform,
      reservationNumber: result.reservationNumber || "",
      messageId: msg.getId(),
      subject: subject,
      body: body,
      from: from,
      processedAt: new Date(),
      extractedBy: "SimpleEmailProcessor (legacy compatibility)"
    };
  }

  /**
   * Verifica si debe omitir duplicado de Lodgify
   * @param {Object} lodgifyInfo - Información extraída de Lodgify
   * @returns {boolean}
   */
  shouldSkipLodgifyDuplicate(lodgifyInfo) {
    ensureDependencies();
    const existingRecords = AirtableService.getReservations(CONFIG) || [];
    return DuplicateDetector.shouldSkipLodgifyDuplicate(lodgifyInfo, existingRecords);
  }

  /**
   * Determina si un DTO debe ser procesado
   * @param {Object} dto - DTO a validar
   * @returns {boolean}
   */
  shouldProcessDTO(dto) {
    if (!dto) return false;

    // Validar datos mínimos
    if (!SharedUtils.hasValidReservationData(dto)) {
      SimpleLogger.error("DTO no tiene datos válidos");
      return false;
    }

    // Verificar duplicados en ejecución actual
    if (this.processedReservations.has(SharedUtils.createReservationKey(dto))) {
      SimpleLogger.email("Skip duplicado en ejecución", "", {
        key: SharedUtils.createReservationKey(dto)
      });
      return false;
    }

    // Verificar si Lodgify/Vrbo debe ser omitido por Airbnb
    if (this.shouldSkipForAirbnb(dto)) {
      return false;
    }

    return true;
  }

  /**
   * Verifica si debe omitir por existir Airbnb
   * @param {Object} dto - DTO a verificar
   * @returns {boolean}
   */
  shouldSkipForAirbnb(dto) {
    const platform = SharedUtils.normalizePlatform(dto.platform);
    if (!/vrbo|lodgify/i.test(String(platform))) {
      return false;
    }

    // Lógica simplificada para verificar duplicados con Airbnb
    const dtoKey = `${dto.guestName}::${dto.checkInDate}`;
    return this.airbnbReservations.has(dtoKey);
  }

  /**
   * Guarda una reserva en Airtable
   * @param {Object} dto - DTO a guardar
   * @param {string} messageId - ID del mensaje
   */
  async saveReservation(dto, messageId) {
    if (CONFIG.SAFE_MODE) {
      SimpleLogger.info("SAFE_MODE: Simulando guardado", {
        guestName: dto.guestName
      });
      return;
    }

    // Enriquecer propiedad
    dto = this.getPropertyService().enrichPropertyIfNeeded(dto);

    const success = await this.saveToAirtable(dto, messageId);
    if (success) {
      SimpleLogger.airtable("Reserva guardada", "success", {
        messageId,
        guestName: dto.guestName
      });
    } else {
      SimpleLogger.error("Error guardando en Airtable", {
        guestName: dto.guestName
      });
    }
  }

  /**
   * Guarda en Airtable manejando upgrades de Lodgify a Airbnb
   * @param {Object} dto - DTO a guardar
   * @param {string} messageId - ID del mensaje  
   * @returns {boolean} Éxito de la operación
   */
  async saveToAirtable(dto, messageId) {
    const platform = SharedUtils.normalizePlatform(dto.platform);
    
    // Si es Airbnb, verificar si existe Lodgify para upgrade
    if (/airbnb/i.test(String(platform))) {
      const existingLodgify = AirtableService.findLodgifyRecordByGuestArrival(
        CONFIG,
        dto.guestName,
        dto.checkInDate
      );

      if (existingLodgify && existingLodgify.id) {
        SimpleLogger.airtable("Upgrade Lodgify->Airbnb", "iniciando", {
          recordId: existingLodgify.id,
          guestName: dto.guestName
        });
        
        const upRes = AirtableService.upgradeRecordToAirbnb(
          CONFIG,
          existingLodgify.id,
          dto,
          messageId
        );
        return !!(upRes && upRes.ok);
      }
    }

    // Crear nueva reserva
    return AirtableService.createReservation(CONFIG, dto, messageId);
  }

  /**
   * Rastrea una reserva procesada para evitar duplicados
   * @param {Object} dto - DTO procesado
   */
  trackProcessedReservation(dto) {
    this.processedReservations.add(SharedUtils.createReservationKey(dto));
    
    const platform = SharedUtils.normalizePlatform(dto.platform);
    if (/airbnb/i.test(String(platform))) {
      this.airbnbReservations.add(SharedUtils.createAirbnbKey(dto));
    }
  }

  /**
   * Obtiene resumen del procesamiento
   * @returns {Object} Estadísticas de procesamiento
   */
  getProcessingSummary() {
    return {
      processedInAirtable: this.processedCount,
      skipped: this.skippedCount,
      total: this.processedCount + this.skippedCount,
    };
  }

  // === HELPERS PARA OBTENER DEPENDENCIAS ===

  getAirbnbProcessor() {
    return __IS_NODE__ 
      ? require("../processors/AirbnbProcessor")
      : globalThis.AirbnbProcessor;
  }

  getLodgifyProcessor() {
    return __IS_NODE__ 
      ? require("../processors/LodgifyProcessor")
      : globalThis.LodgifyProcessor;
  }

  getParser() {
    return __IS_NODE__ 
      ? require("../Parser")
      : globalThis.Parser;
  }

  getPropertyService() {
    return __IS_NODE__ 
      ? require("../PropertyService")
      : globalThis.PropertyService;
  }

  getAirbnbMessageProcessor() {
    // Retornar el procesador de mensajes de Airbnb existente
    return __IS_NODE__ 
      ? require("../MainRefactored")
      : globalThis;
  }
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailProcessor };
} else {
  globalThis.EmailProcessor = EmailProcessor;
}
