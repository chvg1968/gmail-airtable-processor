/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG EmailService AirtableService */

/**
 * Clase principal para el procesamiento de emails
 * Refactorización de MainRefactored.js en módulos más pequeños y manejables
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

// Lazy loading de dependencias para compatibilidad GAS/Node
let EmailFilters, DuplicateDetector, PlatformRegistry, SharedUtils, AppLogger, CONSTANTS;

function ensureDependencies() {
  if (__IS_NODE__) {
    if (!EmailFilters) EmailFilters = require("../filters/EmailFilters");
    if (!DuplicateDetector) DuplicateDetector = require("../duplicates/DuplicateDetector");
    if (!PlatformRegistry) PlatformRegistry = require("../processors/PlatformRegistry").PlatformRegistry;
    if (!SharedUtils) SharedUtils = require("../shared/SharedUtils").SharedUtils;
    if (!AppLogger) AppLogger = require("../shared/AppLogger").AppLogger;
    if (!CONSTANTS) CONSTANTS = require("../shared/Constants").CONSTANTS;
  } else {
    // GAS environment
    if (!EmailFilters) EmailFilters = globalThis.EmailFilters;
    if (!DuplicateDetector) DuplicateDetector = globalThis.DuplicateDetector;
    if (!PlatformRegistry) PlatformRegistry = globalThis.PlatformRegistry;
    if (!SharedUtils) SharedUtils = globalThis.SharedUtils;
    if (!AppLogger) AppLogger = globalThis.AppLogger;
    if (!CONSTANTS) CONSTANTS = globalThis.CONSTANTS;
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
      AppLogger.info("[EmailProcessor] Iniciando procesamiento", {
        SAFE_MODE: CONFIG.SAFE_MODE,
      });

      const messages = this.fetchMessages();
      const sortedMessages = this.sortMessagesByPlatform(messages);
      
      for (const msg of sortedMessages) {
        await this.processMessage(msg);
      }

      const result = this.getProcessingSummary();
      AppLogger.info("[EmailProcessor] Procesamiento completado", result);
      return result;
      
    } catch (error) {
      AppLogger.error("[EmailProcessor] ERROR CRÍTICO", { error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene mensajes del servicio de email
   * @returns {Array} Lista de mensajes
   */
  fetchMessages() {
    const messages = EmailService.fetch();
    AppLogger.info("[EmailProcessor] Mensajes obtenidos", { count: messages.length });
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
      AppLogger.error("[EmailProcessor] Error procesando mensaje", {
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
      AppLogger.info("[EmailProcessor] Skip por filtro", {
        reason: filterResult.reason,
        from,
        subject,
      });
      return true;
    }

    // Verificar si ya fue procesado
    if (AirtableService.isMessageProcessed(CONFIG, messageId)) {
      AppLogger.info("[EmailProcessor] Skip por mensaje ya procesado", {
        messageId,
        subject,
      });
      return true;
    }

    return false;
  }

  /**
   * Procesa mensaje según su plataforma detectada
   * @param {Object} msg - Mensaje de Gmail
   * @returns {Object|null} DTO procesado o null
   */
  async processMessageByPlatform(msg) {
    ensureDependencies();
    
    const from = msg.getFrom();
    const subject = msg.getSubject();
    const body = EmailService.getCleanBody(msg);
    const detected = PlatformRegistry.detect(from, subject);

    if (detected === CONSTANTS.PLATFORMS.LODGIFY) {
      return await this.processLodgifyMessage(subject, body);
    } else if (detected === CONSTANTS.PLATFORMS.AIRBNB) {
      return await this.processAirbnbMessage(msg, body, subject, from);
    } else {
      AppLogger.info("[EmailProcessor] Skip: plataforma no válida", {
        from,
        subject,
        detected,
      });
      return null;
    }
  }

  /**
   * Procesa mensaje de Lodgify
   * @param {string} subject - Asunto
   * @param {string} body - Cuerpo del mensaje
   * @returns {Object|null} DTO procesado
   */
  async processLodgifyMessage(subject, body) {
    ensureDependencies();
    const LodgifyProcessor = this.getLodgifyProcessor();
    
    // Verificar duplicados
    const lodgifyInfo = LodgifyProcessor.extractLodgifyReservationInfo(subject);
    if (lodgifyInfo && this.shouldSkipLodgifyDuplicate(lodgifyInfo)) {
      AppLogger.info("[EmailProcessor] Skip Lodgify por coincidencia", {
        firstName: lodgifyInfo.firstName,
        arrivalDate: lodgifyInfo.arrivalDate,
      });
      return null;
    }

    AppLogger.info("[EmailProcessor] Procesando Lodgify", { subject });
    return this.getParser().parseEmail(body, subject);
  }

  /**
   * Procesa mensaje de Airbnb
   * @param {Object} msg - Mensaje
   * @param {string} body - Cuerpo
   * @param {string} subject - Asunto
   * @param {string} from - Remitente
   * @returns {Object|null} DTO procesado
   */
  async processAirbnbMessage(msg, body, subject, from) {
    // Delegar al procesador de Airbnb existente
    const AirbnbMessageProcessor = this.getAirbnbMessageProcessor();
    return AirbnbMessageProcessor.processAirbnbEmail(msg, body, subject, from);
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
      AppLogger.error("[EmailProcessor] DTO no tiene datos válidos");
      return false;
    }

    // Verificar duplicados en ejecución actual
    if (this.processedReservations.has(SharedUtils.createReservationKey(dto))) {
      AppLogger.info("[EmailProcessor] Skip duplicado en ejecución", {
        key: SharedUtils.createReservationKey(dto),
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
      AppLogger.info("[EmailProcessor] SAFE_MODE: Simulando guardado", {
        guestName: dto.guestName
      });
      return;
    }

    // Enriquecer propiedad
    dto = this.getPropertyService().enrichPropertyIfNeeded(dto);

    const success = await this.saveToAirtable(dto, messageId);
    if (success) {
      AppLogger.airtableOperation("Reserva guardada", messageId, {
        guestName: dto.guestName
      });
    } else {
      AppLogger.error("[EmailProcessor] Error guardando en Airtable", {
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
        AppLogger.info("[EmailProcessor] Upgrade Lodgify->Airbnb", {
          recordId: existingLodgify.id,
          guestName: dto.guestName,
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
