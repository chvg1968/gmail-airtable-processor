/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG EmailService AirtableService */

/**
 * EmailProcessor SIMPLIFICADO
 * Usa SimpleEmailProcessor como procesador unificado
 * Arquitectura: Email → SimpleEmailProcessor → Airtable
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
 * Clase SIMPLIFICADA para manejar el procesamiento de emails
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
      SimpleLogger.start("EMAIL PROCESSING");

      const messages = EmailService.getMessages(CONFIG);
      SimpleLogger.gmail("Mensajes obtenidos", messages.length);

      for (const msg of messages) {
        await this.processMessage(msg);
      }

      const summary = this.getProcessingSummary();
      SimpleLogger.finish("EMAIL PROCESSING", summary);
      
      return summary;

    } catch (error) {
      SimpleLogger.error("Error en processEmails", { error: error.message });
      throw error;
    }
  }

  /**
   * Procesa un mensaje individual
   * @param {Object} msg - Mensaje de Gmail
   */
  async processMessage(msg) {
    const messageId = msg.getId();
    const from = msg.getFrom();
    const subject = msg.getSubject();

    try {
      if (this.shouldSkipMessage(from, subject, messageId)) {
        this.skippedCount++;
        return;
      }

      const dto = await this.processMessageByPlatform(msg);
      
      if (dto && this.shouldProcessDTO(dto)) {
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
   * Procesa mensaje usando SimpleEmailProcessor unificado
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
   * Verifica si un mensaje debe ser saltado
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
   * Verifica si un DTO debe ser procesado
   * @param {Object} dto - DTO a verificar
   * @returns {boolean}
   */
  shouldProcessDTO(dto) {
    ensureDependencies();
    
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
   * Verifica si debe omitir por tener Airbnb equivalente
   * @param {Object} dto - DTO a verificar
   * @returns {boolean}
   */
  shouldSkipForAirbnb(dto) {
    const platform = dto.platform?.toLowerCase();
    
    if (platform === 'lodgify' || platform === 'vrbo') {
      const key = SharedUtils.createReservationKey(dto);
      if (this.airbnbReservations.has(key)) {
        SimpleLogger.email("Skip: ya existe Airbnb equivalente", dto.subject, {
          platform: dto.platform,
          key
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Guarda reserva en Airtable
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
        guestName: dto.guestName,
        messageId
      });
    }
  }

  /**
   * Guarda en Airtable con lógica de upgrade si es necesario
   * @param {Object} dto - DTO a guardar
   * @param {string} messageId - ID del mensaje
   * @returns {boolean} - Éxito del guardado
   */
  async saveToAirtable(dto, messageId) {
    try {
      // Si es Airbnb, verificar si hay Lodgify/Vrbo para actualizar
      if (dto.platform === 'Airbnb') {
        const existingLodgify = AirtableService.findExistingReservation(
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

      // Guardar nuevo registro
      const result = AirtableService.saveReservation(CONFIG, dto, messageId);
      return !!(result && result.ok);

    } catch (error) {
      SimpleLogger.error("Error en saveToAirtable", {
        error: error.message,
        guestName: dto.guestName
      });
      return false;
    }
  }

  /**
   * Hace seguimiento de reservas procesadas
   * @param {Object} dto - DTO procesado
   */
  trackProcessedReservation(dto) {
    ensureDependencies();
    
    const key = SharedUtils.createReservationKey(dto);
    this.processedReservations.add(key);

    if (dto.platform?.toLowerCase() === 'airbnb') {
      this.airbnbReservations.add(key);
    }
  }

  /**
   * Obtiene resumen del procesamiento
   * @returns {Object} Resumen
   */
  getProcessingSummary() {
    return {
      total: this.processedCount + this.skippedCount,
      processedInAirtable: this.processedCount,
      skipped: this.skippedCount,
      successRate: this.processedCount + this.skippedCount > 0 ? 
        ((this.processedCount / (this.processedCount + this.skippedCount)) * 100).toFixed(1) : 0
    };
  }

  /**
   * Obtiene servicio de propiedades - SIMPLIFICADO
   */
  getPropertyService() {
    return __IS_NODE__ ? 
      require("../PropertyService") : 
      globalThis.PropertyService;
  }
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailProcessor };
} else {
  globalThis.EmailProcessor = EmailProcessor;
}
