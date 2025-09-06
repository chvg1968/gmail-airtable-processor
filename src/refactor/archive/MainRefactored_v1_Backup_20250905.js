/* eslint-disable */
/* prettier-ignore-file */
/* global Logger CONFIG EmailService AirtableService Parser GeminiService PropertyService NameEnhancementService */

// === IMPORTS (Compat Node + Google Apps Script) ===
// En GAS el orden de carga de archivos puede hacer que todavía no existan las dependencias
// cuando se evalúa este archivo. Para evitar errores, usamos inicialización diferida.
const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

let EmailUtils;
let EmailFilters;
let DuplicateDetector;
let LodgifyProcessor;
let AirbnbProcessor;
let PlatformRegistry;
let SharedUtils;
let AppLogger;
let CONSTANTS;
let Parser;
let GeminiService;
let PropertyService;
let NameEnhancementService;

if (__IS_NODE__) {
  // Carga inmediata en Node (tests / desarrollo)
  EmailUtils = require("./utils/EmailUtils");
  EmailFilters = require("./filters/EmailFilters");
  DuplicateDetector = require("./duplicates/DuplicateDetector");
  LodgifyProcessor = require("./processors/LodgifyProcessor");
  AirbnbProcessor = require("./processors/AirbnbProcessor");
  PlatformRegistry = require("./processors/PlatformRegistry").PlatformRegistry;
  SharedUtils = require("./shared/SharedUtils").SharedUtils;
  AppLogger = require("./shared/AppLogger").AppLogger;
  CONSTANTS = require("./shared/Constants").CONSTANTS;
  // Dependencias adicionales usadas directamente en este módulo (permitir stubs previos)
  Parser = globalThis.Parser || require("./Parser");
  GeminiService = globalThis.GeminiService || require("./GeminiService");
  PropertyService = globalThis.PropertyService || require("./PropertyService");
  NameEnhancementService = globalThis.NameEnhancementService || require("./NameEnhancementService");
}

function ensureDeps() {
  if (!__IS_NODE__) {
    // Resolver solo si aún no están asignadas (GAS)
    if (!EmailUtils) EmailUtils = globalThis.EmailUtils;
    if (!EmailFilters) EmailFilters = globalThis.EmailFilters;
    if (!DuplicateDetector) DuplicateDetector = globalThis.DuplicateDetector;
    if (!LodgifyProcessor) LodgifyProcessor = globalThis.LodgifyProcessor;
    if (!AirbnbProcessor) AirbnbProcessor = globalThis.AirbnbProcessor;
    if (!PlatformRegistry) PlatformRegistry = globalThis.PlatformRegistry;
    if (!SharedUtils) SharedUtils = globalThis.SharedUtils;
    if (!AppLogger) AppLogger = globalThis.AppLogger;
    if (!CONSTANTS) CONSTANTS = globalThis.CONSTANTS;
  if (!Parser) Parser = globalThis.Parser;
  if (!GeminiService) GeminiService = globalThis.GeminiService;
  if (!PropertyService) PropertyService = globalThis.PropertyService;
  if (!NameEnhancementService) NameEnhancementService = globalThis.NameEnhancementService;
  }
}

// === LEGACY UTILITY FUNCTIONS (TO BE DEPRECATED) ===

// Helper a nivel de módulo: extracción de Reservation number desde subject/body por plataforma
function extractReservationNumber(pf, subj, bod) {
  return SharedUtils.extractReservationNumber(pf, subj, bod);
}

// === DTO PROCESSING ===

/**
 * Procesa datos específicos de Airbnb usando Parser y Gemini
 * @param {Object} msg - Mensaje de Gmail
 * @param {string} body - Cuerpo del correo
 * @param {string} subject - Asunto del correo
 * @param {string} from - Remitente del correo
 * @returns {Object|null} - DTO procesado o null
 */
function processAirbnbEmail(msg, body, subject, _from) {
  try {
  ensureDeps();
    let dto = Parser.parseEmail(body, subject);
    
    if (!dto) {
      Logger.log("[Main] Parser retornó null para Airbnb: %s", subject);
      return null;
    }

    // Mejorar los datos con Gemini si es necesario
    const needsGemini =
      !dto.accommodationPrice || !dto.cleaningFee || !dto.taxesAmount;
    
    if (needsGemini) {
      Logger.log(
        "[Main] Aplicando Gemini para completar datos de Airbnb: %s",
        subject,
      );
      const airbnbData = GeminiService.extractAirbnbData(body, subject);
      
      if (airbnbData) {
        if (airbnbData.accommodationPrice)
          dto.accommodationPrice = airbnbData.accommodationPrice;
        if (airbnbData.cleaningFee) dto.cleaningFee = airbnbData.cleaningFee;
        if (airbnbData.taxesAmount) dto.taxesAmount = airbnbData.taxesAmount;
        Logger.log(
          "[Main] Datos combinados: parser específico + Gemini para: %s",
          subject,
        );
      }
    }

    // Mejorar los datos extraídos con información del asunto del email
    dto = NameEnhancementService.enhanceExtractedData(dto, msg);
    Logger.log(
      "[Main] Datos mejorados con NameEnhancementService para: %s",
      subject,
    );
    
    return dto;
  } catch (error) {
    Logger.log(
      "[Main] Error procesando email de Airbnb: %s - %s",
      subject,
      error.message,
    );
    return null;
  }
}

/**
 * Valida si el DTO tiene los datos mínimos requeridos
 * @param {Object} dto - DTO a validar
 * @returns {boolean}
 */
function hasValidReservationData(dto) {
  return SharedUtils.hasValidReservationData(dto);
}

/**
 * Verifica si hay duplicados en la ejecución actual
 * @param {Object} dto - DTO a verificar
 * @param {Set} processedReservations - Set de reservas procesadas
 * @returns {boolean}
 */
function isDuplicateInCurrentExecution(dto, processedReservations) {
  return processedReservations.has(SharedUtils.createReservationKey(dto));
}

/**
 * Verifica si una reserva de Lodgify/Vrbo debe ser omitida por existir reserva de Airbnb
 * @param {Object} dto - DTO de la reserva
 * @param {Set} airbnbReservations - Set de reservas de Airbnb procesadas
 * @returns {boolean}
 */
function shouldSkipLodgifyVrboForAirbnb(dto, airbnbReservations) {
  const platform = Array.isArray(dto.platform) ? dto.platform[0] : dto.platform;
  
  if (!/vrbo|lodgify/i.test(String(platform))) {
    return false;
  }

  const checkInDate = dto.checkInDate;
  // const checkOutDate = dto.checkOutDate; // no utilizado
  const guestName = dto.guestName;

  for (const abKey of airbnbReservations) {
    const [abName, abCi] = abKey.split("::");
    const airbnbFirst = abName ? EmailUtils.getFirstName(abName) : "";
    const airbnbCheckIn = abCi ? EmailUtils.normalizeToISODate(abCi) : "";
    
    const dtoFirst = guestName ? EmailUtils.getFirstName(guestName) : "";
    const dtoCheckIn =
      checkInDate ? EmailUtils.normalizeToISODate(checkInDate) : "";
    
    if (dtoFirst && airbnbFirst && dtoCheckIn && airbnbCheckIn) {
      if (dtoFirst === airbnbFirst && dtoCheckIn === airbnbCheckIn) {
        Logger.log(
          "[Main] Omitiendo %s: encontrada reserva de Airbnb con mismo primer nombre y check-in - %s %s",
          platform,
          dtoFirst,
          dtoCheckIn,
        );
        return true;
      }
    }
  }

  return false;
}

/**
 * Función principal de procesamiento de emails
 */
function processEmails() {
  try {
  ensureDeps();
  AppLogger.info("[Main] Inicio de proceso", {
    SAFE_MODE: CONFIG.SAFE_MODE,
  });

    const messages = EmailService.fetch();
  AppLogger.info("[Main] Mensajes obtenidos", {
    count: messages.length,
  });

    let processedInAirtableCount = 0;
    let skippedCount = 0;

    // Sets para detectar duplicados y rastrear reservas
    const processedReservations = new Set();
    const airbnbReservations = new Set();

    // Separar mensajes por plataforma para procesar Airbnb primero
    const airbnbMessages = [];
    const otherMessages = [];

    for (const msg of messages) {
      const from = msg.getFrom();
      const subject = msg.getSubject();

      if (
        AirbnbProcessor.isAirbnbEmail(from) ||
        EmailUtils.isEmailFromPlatform(
          from,
          subject,
          CONSTANTS.PLATFORMS.AIRBNB,
        )
      ) {
        airbnbMessages.push(msg);
      } else {
        otherMessages.push(msg);
      }
    }

    // Procesar Airbnb primero, luego otros
    const sortedMessages = [...airbnbMessages, ...otherMessages];

  for (const msg of sortedMessages) {
      try {
        const messageId = msg.getId();
        const subject = msg.getSubject();
        const from = msg.getFrom();

        // FILTRADO TEMPRANO usando módulos especializados
        const filterResult = EmailFilters.applyEmailFilters(from, subject);
        if (filterResult.shouldSkip) {
          AppLogger.info("[Main] Skip por filtro", {
            reason: filterResult.reason,
            from,
            subject,
          });
          skippedCount++;
          continue;
        }

        // Evitar reprocesar si ya existe por Gmail Message ID
        if (AirtableService.isMessageProcessed(CONFIG, messageId)) {
          AppLogger.info("[Main] Skip por mensaje ya procesado", {
            messageId,
            subject,
          });
          skippedCount++;
          continue;
        }

        const body = EmailService.getCleanBody(msg);

  // Procesamiento por plataforma usando módulos especializados
  let dto = null;
  const detected = PlatformRegistry.detect(from, subject);

  if (detected === CONSTANTS.PLATFORMS.LODGIFY) {
          // Verificar duplicados usando el detector modular
          const lodgifyInfo =
            LodgifyProcessor.extractLodgifyReservationInfo(subject);
          if (lodgifyInfo) {
            // Obtener registros existentes para verificar duplicados
            const existingRecords =
              AirtableService.getReservations(CONFIG) || [];
            if (
              DuplicateDetector.shouldSkipLodgifyDuplicate(
                lodgifyInfo,
                existingRecords,
              )
            ) {
              AppLogger.info("[Main] Skip Lodgify por coincidencia", {
                firstName: lodgifyInfo.firstName,
                arrivalDate: lodgifyInfo.arrivalDate,
              });
              skippedCount++;
              continue;
            }
          }
          
          AppLogger.info("[Main] Procesando confirmación de Lodgify", {
            subject,
          });
          dto = Parser.parseEmail(body, subject);
        } else if (detected === CONSTANTS.PLATFORMS.AIRBNB) {
          const processAirbnbFn =
            (typeof module !== 'undefined' && module.exports && module.exports.processAirbnbEmail)
              || (typeof globalThis !== 'undefined' && globalThis.processAirbnbEmail)
              || processAirbnbEmail;
          dto = processAirbnbFn(msg, body, subject, from);
        } else {
          AppLogger.info("[Main] Skip: email no es de plataforma válida", {
            from,
            subject,
          });
          skippedCount++;
          continue;
        }

        // Validar que el DTO se haya creado correctamente
        if (!dto) {
          AppLogger.error("[Main] DTO es null para el mensaje", { subject });
          skippedCount++;
          continue;
        }

        AppLogger.info("[Main] DTO creado", { subject });

        // Validar datos mínimos requeridos
        if (!hasValidReservationData(dto)) {
          AppLogger.error("[Main] DTO no tiene datos de reserva válidos", { subject });
          skippedCount++;
          continue;
        }

        // Verificar duplicados en ejecución actual
        if (isDuplicateInCurrentExecution(dto, processedReservations)) {
          AppLogger.info("[Main] Skip duplicado en ejecución actual", {
            key: SharedUtils.createReservationKey(dto),
          });
          skippedCount++;
          continue;
        }

        // Verificar si Lodgify/Vrbo debe ser omitido por existir Airbnb
  if (shouldSkipLodgifyVrboForAirbnb(dto, airbnbReservations)) {
          skippedCount++;
          continue;
        }

        // Enriquecer propiedad si es necesario
        dto = PropertyService.enrichPropertyIfNeeded(dto);

        // Procesar reserva en Airtable
        if (CONFIG.SAFE_MODE) {
          AppLogger.info("[Main] SAFE_MODE: Simulando envío a Airtable", { subject });
        } else {
          let success = false;
          const platform = SharedUtils.normalizePlatform(dto.platform);
          // Si es Airbnb y existe una Lodgify equivalente, actualizamos ese registro (prioridad Airbnb)
          if (/airbnb/i.test(String(platform))) {
            const existingLodgify = AirtableService.findLodgifyRecordByGuestArrival(
              CONFIG,
              dto.guestName,
              dto.checkInDate,
            );
            if (existingLodgify && existingLodgify.id) {
              AppLogger.info("[Main] Upgrade Lodgify->Airbnb por prioridad", {
                recordId: existingLodgify.id,
                guestName: dto.guestName,
                checkInDate: dto.checkInDate,
              });
              const upRes = AirtableService.upgradeRecordToAirbnb(
                CONFIG,
                existingLodgify.id,
                dto,
                messageId,
              );
              success = !!(upRes && upRes.ok);
            } else {
              success = AirtableService.createReservation(CONFIG, dto, messageId);
            }
          } else {
            success = AirtableService.createReservation(CONFIG, dto, messageId);
          }
          if (success) {
            processedInAirtableCount++;
            AppLogger.airtableOperation("Reserva creada exitosamente", messageId, { subject });
          } else {
            AppLogger.error("[Main] No se pudo enviar a Airtable", { subject });
          }
        }

        // Agregar a sets de seguimiento
  processedReservations.add(SharedUtils.createReservationKey(dto));

        // Si es Airbnb, agregar al set específico
        const platform = SharedUtils.normalizePlatform(dto.platform);
        if (/airbnb/i.test(String(platform))) {
          airbnbReservations.add(SharedUtils.createAirbnbKey(dto));
        }

      } catch (error) {
        AppLogger.error("[Main] Error procesando mensaje", {
          subject: msg.getSubject(),
          error: error.message,
        });
        skippedCount++;
      }
    }

    AppLogger.info("[Main] Proceso completado", {
      processedInAirtable: processedInAirtableCount,
      skipped: skippedCount,
    });

  } catch (error) {
    AppLogger.error("[Main] ERROR CRÍTICO en processEmails", { error: error.message });
    throw error;
  }
}

// === EXPORTS ===
// Exportar para Node o exponer como globals para GAS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processEmails,
    processAirbnbEmail,
    hasValidReservationData,
    extractReservationNumber,
  };
} else {
  // Entorno GAS: adjuntar al objeto global
  globalThis.processEmails = processEmails;
  globalThis.processAirbnbEmail = processAirbnbEmail;
  globalThis.hasValidReservationData = hasValidReservationData;
  globalThis.extractReservationNumber = extractReservationNumber;
}
