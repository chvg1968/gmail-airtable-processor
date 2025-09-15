/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG EmailService AirtableService SimpleLogger EmailFilters SharedUtils SimpleEmailProcessor */

/**
 * EmailProcessor - VERSIÓN SIMPLIFICADA
 * Resuelve recursión sin agregar complejidad
 */

class EmailProcessor {
  constructor() {
    this.processedReservations = new Set();
    this.airbnbReservations = new Set();
    this.processedCount = 0;
    this.skippedCount = 0;
  }

  async processEmails() {
    try {
      this.logProcessingStart();

      const messages = await this.fetchMessages();
      const sortedMessages = this.sortMessagesByPlatform(messages);

      await this.processAllMessages(sortedMessages);

      const result = this.getProcessingSummary();
      this.logProcessingFinish(result);
      return result;

    } catch (error) {
      this.logProcessingError(error);
      throw error;
    }
  }

  logProcessingStart() {
    const logger = this.getLogger();
    const config = this.getConfig();
    logger?.start("procesamiento de emails", { SAFE_MODE: config?.SAFE_MODE });
  }

  async fetchMessages() {
    const emailService = this.getEmailService();
    const logger = this.getLogger();

    const messages = emailService.fetch();
    logger?.gmail("Mensajes obtenidos", messages.length);
    return messages;
  }

  async processAllMessages(messages) {
    for (const msg of messages) {
      await this.processMessage(msg);
    }
  }

  logProcessingFinish(result) {
    const logger = this.getLogger();
    logger?.finish("procesamiento de emails", result);
  }

  logProcessingError(error) {
    const logger = this.getLogger();
    logger?.error("Error crítico en procesamiento", { error: error.message });
  }

  sortMessagesByPlatform(messages) {
    const airbnbMessages = [];
    const otherMessages = [];

    for (const msg of messages) {
      const from = msg.getFrom();
      if (this.isAirbnbMessage(from)) {
        airbnbMessages.push(msg);
      } else {
        otherMessages.push(msg);
      }
    }

    return [...airbnbMessages, ...otherMessages];
  }

  isAirbnbMessage(from) {
    const fromLower = from.toLowerCase();
    return fromLower.includes('airbnb') || fromLower.includes('automated-noreply@airbnb.com');
  }

  async processMessage(msg) {
    const messageId = msg.getId();
    const from = msg.getFrom();
    const subject = msg.getSubject();

    try {
      if (await this.shouldSkipMessage(from, subject, messageId)) {
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
      const logger = this.getLogger();
      logger?.error("Error procesando mensaje", { subject, error: error.message });
      this.skippedCount++;
    }
  }

  processMessageByPlatform(msg) {
    const from = msg.getFrom();
    const subject = msg.getSubject();
    const body = EmailService.getCleanBody(msg);

    const result = SimpleEmailProcessor.processReservationEmail(from, subject, body);
    
    if (!result) {
      SimpleLogger?.email("No se pudo procesar", subject, { from });
      return null;
    }

    return {
      ...result,
      messageId: msg.getId(),
      subject: msg.getSubject(),
      from: msg.getFrom(),
      timestamp: new Date().toISOString()
    };
  }

  async shouldSkipMessage(from, subject, messageId) {
    const logger = this.getLogger();
    const config = this.getConfig();

    // Aplicar filtros de email
    const emailFilters = this.getEmailFilters();
    const filterResult = emailFilters?.applyEmailFilters(from, subject);
    if (filterResult?.shouldSkip) {
      logger?.email("Skip por filtro", subject, { reason: filterResult.reason, from });
      return true;
    }

    // Verificar si ya fue procesado
    const airtableService = this.getAirtableService();
    if (airtableService?.isMessageProcessed(config, messageId)) {
      logger?.email("Skip por mensaje ya procesado", subject, { messageId });
      return true;
    }

    return false;
  }

  shouldProcessDTO(dto) {
    if (!SharedUtils?.hasValidReservationData(dto)) {
      SimpleLogger?.error("DTO no tiene datos válidos");
      return false;
    }

    const key = SharedUtils.createReservationKey(dto);
    if (this.processedReservations.has(key)) {
      SimpleLogger?.email("Skip duplicado en ejecución", "", { key });
      return false;
    }

    if (this.shouldSkipForAirbnb(dto)) {
      return false;
    }

    return true;
  }

  shouldSkipForAirbnb(dto) {
    const platform = dto.platform?.toLowerCase();
    
    if (platform === 'lodgify' || platform === 'vrbo') {
      const key = SharedUtils?.createReservationKey(dto);
      if (this.airbnbReservations.has(key)) {
        SimpleLogger?.email("Skip: ya existe Airbnb equivalente", dto.subject, { platform: dto.platform, key });
        return true;
      }
    }

    return false;
  }

  saveReservation(dto, messageId) {
    if (CONFIG?.SAFE_MODE) {
      SimpleLogger?.info("SAFE_MODE: Simulando guardado", { guestName: dto.guestName });
      return;
    }

    dto = PropertyService?.enrichPropertyIfNeeded(dto) || dto;
    const success = this.saveToAirtable(dto, messageId);
    
    if (success) {
      SimpleLogger?.airtable("Reserva guardada", "success", { messageId, guestName: dto.guestName });
    } else {
      SimpleLogger?.error("Error guardando en Airtable", { guestName: dto.guestName, messageId });
    }
  }

  saveToAirtable(dto, messageId) {
    try {
      // Si es Airbnb, verificar si hay Lodgify/Vrbo para actualizar
      if (dto.platform === 'Airbnb') {
        const existingLodgify = AirtableService.findExistingReservation(CONFIG, dto.guestName, dto.checkInDate);

        if (existingLodgify?.id) {
          SimpleLogger?.airtable("Upgrade Lodgify->Airbnb", "iniciando", { guestName: dto.guestName, existingId: existingLodgify.id });
          const upRes = AirtableService.updateReservation(CONFIG, existingLodgify.id, dto, messageId);
          return !!(upRes?.ok);
        }
      }

      const result = AirtableService.saveReservation(CONFIG, dto, messageId);
      return !!(result?.ok);

    } catch (error) {
      SimpleLogger?.error("Error en saveToAirtable", { error: error.message, guestName: dto.guestName });
      return false;
    }
  }

  trackProcessedReservation(dto) {
    const key = SharedUtils?.createReservationKey(dto);
    if (key) {
      this.processedReservations.add(key);
      if (dto.platform === 'Airbnb') {
        this.airbnbReservations.add(key);
      }
    }
  }

  getProcessingSummary() {
    return {
      total: this.processedCount + this.skippedCount,
      processedInAirtable: this.processedCount,
      skipped: this.skippedCount,
      successRate: this.processedCount + this.skippedCount > 0 ?
        ((this.processedCount / (this.processedCount + this.skippedCount)) * 100).toFixed(1) : 0
    };
  }

  // Métodos auxiliares para obtener dependencias
  getLogger() {
    const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');
    if (__IS_NODE__) {
      try {
        return require('../utils/SimpleLogger').SimpleLogger;
      } catch {
        return null;
      }
    } else {
      return globalThis.SimpleLogger;
    }
  }

  getEmailService() {
    const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');
    if (__IS_NODE__) {
      try {
        return require('../EmailService');
      } catch {
        return null;
      }
    } else {
      return globalThis.EmailService;
    }
  }

  getConfig() {
    const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');
    if (__IS_NODE__) {
      try {
        return require('../Config');
      } catch {
        return null;
      }
    } else {
      return globalThis.CONFIG;
    }
  }

  getEmailFilters() {
    const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');
    if (__IS_NODE__) {
      try {
        return require('../filters/EmailFilters');
      } catch {
        return null;
      }
    } else {
      return globalThis.EmailFilters;
    }
  }

  getAirtableService() {
    const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');
    if (__IS_NODE__) {
      try {
        return require('../AirtableService');
      } catch {
        return null;
      }
    } else {
      return globalThis.AirtableService;
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailProcessor };
} else if (typeof globalThis !== 'undefined') {
  globalThis.EmailProcessor = EmailProcessor;
}
