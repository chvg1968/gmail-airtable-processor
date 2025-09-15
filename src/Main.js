/* global Logger CONFIG EmailService AirtableService GeminiService PropertyService */

/**
 * Procesa correos de Gmail para extraer reservas usando flujo simplificado inspirado en n8n:
 * 1. Filtra correos con EmailService (basado en trigger de n8n)
 * 2. Etiqueta por plataforma (Airbnb/Vrbo)
 * 3. Extrae datos con Gemini usando prompt de n8n
 * 4. Verifica duplicados con dupKey
 * 5. Mapea propiedades y guarda en Airtable
 */
function processEmails() {
  try {
    Logger.log("[Main] Inicio de proceso simplificado SAFE_MODE=%s", CONFIG.SAFE_MODE);

    const messages = EmailService.fetch();
    Logger.log("[Main] Mensajes obtenidos: %s", messages.length);

    let processedInAirtableCount = 0;
    let skippedCount = 0;

    // Set para detectar duplicados en esta ejecución usando dupKey
    const processedReservations = new Set();

    // Etiquetado simple por plataforma (similar al Switch de n8n)
    const taggedMessages = messages.map(msg => {
      const from = msg.getFrom();
      const subject = msg.getSubject();

      let platform = null;
      let origin = null;

      if (/@airbnb\.com/i.test(from)) {
        platform = 'Airbnb';
        origin = 'Airbnb';
      } else if (/messaging\.lodgify\.com/i.test(from)) {
        platform = 'Vrbo';
        origin = 'Lodgify';
      } else if (/@homeaway\.com|@vrbo\.com/i.test(from)) {
        platform = 'Vrbo';
        origin = 'Vrbo';
      }

      return { message: msg, platform, origin };
    });

    for (const taggedMsg of taggedMessages) {
      const msg = taggedMsg.message;
      const platform = taggedMsg.platform;
      const origin = taggedMsg.origin;
      try {
        const messageId = msg.getId();
        const subject = msg.getSubject();
        const from = msg.getFrom();

        // FILTRADO SIMPLIFICADO - Solo verificaciones críticas
        // =====================================================

        // 1. Evitar reprocesar si ya existe por Gmail Message ID
        if (AirtableService.isMessageProcessed(CONFIG, messageId)) {
          Logger.log("[Main] Skip: La reserva con Gmail Message ID %s ya está registrada. Subject: %s", messageId, subject);
          skippedCount++;
          continue;
        }

        // 2. Verificar que tenemos plataforma identificada
        if (!platform) {
          Logger.log("[Main] Skip: Plataforma no identificada. From: %s, Subject: %s", from, subject);
          skippedCount++;
          continue;
        }

        // =====================================================
        // FIN DEL FILTRADO
        // =====================================================

        const body = EmailService.getCleanBody(msg);

        // Procesamiento simplificado: usar Gemini con prompt de n8n
        Logger.log("[Main] Procesando con Gemini: %s", subject);
        const year = new Date().getFullYear();
        const bookingDate = msg.getDate().toISOString().slice(0, 10);

        const dto = GeminiService.extract(
          body,
          CONFIG.geminiApiKey,
          year,
          messageId,
          subject,
          from,
          origin,
          platform,
          bookingDate
        );

        if (!dto) {
          Logger.log("[Main] Gemini no pudo extraer datos o detectó duplicado: %s", subject);
          skippedCount++;
          continue;
        }

        // DTO ya validado por Gemini, solo verificar campos críticos
        Logger.log("[Main] DTO procesado exitosamente: %s", JSON.stringify(dto));

        // Usar dupKey de Gemini para detectar duplicados en esta ejecución
        if (dto.dupKey && processedReservations.has(dto.dupKey)) {
          Logger.log("[Main] Skip duplicado detectado por dupKey: %s", dto.dupKey);
          skippedCount++;
          continue;
        }

        if (dto.dupKey) {
          processedReservations.add(dto.dupKey);
        }

        // Asegurar el messageId en DTO
        dto["Gmail Message ID"] = messageId;

        // Mapear propiedad usando PropertyService
        const propertyInput = dto.accommodationName || subject;
        const mapped = PropertyService.findPropertyMapping(dto.platform, propertyInput);
        dto.Property = mapped.name;
        Logger.log("[Main] Propiedad mapeada: %s -> %s", propertyInput, mapped.name);

        // Validación final: campos requeridos
        if (!dto.reservationNumber || !dto.guestName || !dto.checkInDate || !dto.checkOutDate) {
          Logger.log("[Main] Skip: faltan campos requeridos en DTO");
          skippedCount++;
          continue;
        }

        // Solo procesar si no fue registrado antes (ya validado arriba)
        const res = AirtableService.upsert(dto, CONFIG, messageId);
        Logger.log("[Main] Upsert resultado: %s", JSON.stringify(res));
        if (res && res.ok) {
          processedInAirtableCount++;
        }
      } catch (perMsgErr) {
        Logger.log("[Main][ERROR mensaje] %s", perMsgErr);
      }
    }

    Logger.log(`
[PROCESSING SUMMARY]
----------------------------------------
Emails Found: ${messages.length}
Reservations Processed in Airtable: ${processedInAirtableCount}
Skipped Emails/Reservations: ${skippedCount}
----------------------------------------
`);
    Logger.log("[Main] Fin de proceso");
  } catch (err) {
    Logger.log(`Error in main execution: ${err.toString()}`);
  }
}
