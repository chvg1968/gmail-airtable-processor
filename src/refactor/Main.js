/* global Logger CONFIG EmailService AirtableService Parser GeminiService PropertyService NameEnhancementService */

// Helper a nivel de módulo: extracción de Reservation number desde subject/body por plataforma
function extractReservationNumber(pf, subj, bod) {
  try {
    const s = subj || "";
    const b = bod || "";
    const text = `${s}\n${b}`;
    const patterns = [];
    if (/airbnb/i.test(pf)) {
      patterns.push(
        /(?:Reservation|Confirmation)\s*(?:code|number|#)?[:\s-]*([A-Z0-9]{6,10})/i
      );
      patterns.push(/Code[:\s-]*([A-Z0-9]{6,10})/i);
    } else if (/vrbo|homeaway/i.test(pf)) {
      // Permit optional leading letter and optional '#'
      patterns.push(
        /(?:Reservation|Itinerary|Confirmation)\s*#?[:\s-]*([A-Z]?[0-9]{6,})/i
      );
    } else if (/lodgify/i.test(pf)) {
      // Formats like "#B15695014" or "( #B15695014 )"
      patterns.push(
        /(?:Reservation|Booking)\s*(?:ID|Number)?\s*#?[:\s-]*([A-Z]?[0-9]{6,})/i
      );
      patterns.push(/reservation\s+#?\s*([A-Z]?[0-9]{6,})/i);
    }
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m && m[1]) return m[1].trim();
    }
    return "";
  } catch (_) {
    return "";
  }
}

function processEmails() {
  try {
    Logger.log("[Main] Inicio de proceso SAFE_MODE=%s", CONFIG.SAFE_MODE);

    const messages = EmailService.fetch();
    Logger.log("[Main] Mensajes obtenidos: %s", messages.length);

    let processedInAirtableCount = 0;
    let skippedCount = 0;

    // Set para detectar duplicados en esta ejecución
    const processedReservations = new Set();

    // Set para rastrear reservas de Airbnb procesadas en esta ejecución
    const airbnbReservations = new Set();

    // Separar mensajes por plataforma para procesar Airbnb primero
    const airbnbMessages = [];
    const otherMessages = [];

    for (const msg of messages) {
      const from = msg.getFrom();
      const subject = msg.getSubject();

      if (
        /airbnb/i.test(from) ||
        (/airbnb/i.test(subject) && /reservation confirmed/i.test(subject))
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

        // FILTRADO TEMPRANO - ANTES de cualquier procesamiento
        // =====================================================

        // 1. Salvaguarda adicional: ignorar help@lodgify.com
        if (/help@lodgify\.com/i.test(from)) {
          Logger.log(
            "[Main] Skip por remitente Lodgify help: from=%s subject=%s",
            from,
            subject
          );
          skippedCount++;
          continue;
        }

        // 2. Heurística: ignorar correos de soporte o actividad de cuenta (no reservas)
        const nonBooking =
          (/help@lodgify\.com/i.test(from) &&
            /There is an update for your request|How would you rate the support/i.test(
              subject
            )) ||
          (/automated@airbnb\.com/i.test(from) &&
            /Actividad de la cuenta|Account activity|inicio de sesi[oó]n/i.test(
              subject
            )) ||
          (/propertymanagers\.lodgify\.com/i.test(from) &&
            /Check-?in completed|Check-?out completed|Check-?in reminder/i.test(
              subject
            ));
        if (nonBooking) {
          Logger.log(
            "[Main] Skip por no-booking (soporte/seguridad). from=%s subject=%s",
            from,
            subject
          );
          skippedCount++;
          continue;
        }

        // 3. Evitar reprocesar si ya existe por Gmail Message ID
        if (AirtableService.isMessageProcessed(CONFIG, messageId)) {
          Logger.log("[Main] Skip (ya procesado): %s - %s", messageId, subject);
          skippedCount++;
          continue;
        }

        // 4. Detectar correos de soporte/actualización que no son reservas reales
        const isSupportOrUpdateEmail =
          /re:\s*(?:lodgify|\[lodgify\])/i.test(subject) ||
          /update.*request/i.test(subject) ||
          /pending request/i.test(subject) ||
          /unable to send/i.test(subject) ||
          /will deleting photos/i.test(subject) ||
          /support.*ticket/i.test(subject) ||
          /help.*request/i.test(subject);

        if (isSupportOrUpdateEmail) {
          Logger.log(
            "[Main] Skip correo de soporte/actualización: %s",
            subject
          );
          skippedCount++;
          continue;
        }

        // 5. Detectar correos que claramente no son reservas
        const isNonReservationEmail =
          /question/i.test(subject) ||
          /inquiry/i.test(subject) ||
          /support/i.test(subject) ||
          /help/i.test(subject) ||
          /issue/i.test(subject) ||
          /problem/i.test(subject);

        if (
          isNonReservationEmail &&
          !/reservation|booking|confirmed/i.test(subject)
        ) {
          Logger.log(
            "[Main] Skip correo no relacionado con reservas: %s",
            subject
          );
          skippedCount++;
          continue;
        }

        // 6. CRÍTICO: Detectar correos reenviados que contienen información de reservas
        const isForwardedWithReservationInfo =
          /^fwd:/i.test(subject) &&
          /reservation|booking|arrives|nights|arrival/i.test(subject) &&
          !/confirmed|new confirmed|instant booking/i.test(subject);

        if (isForwardedWithReservationInfo) {
          Logger.log(
            "[Main] Skip correo reenviado con info de reserva (posible falso positivo): %s",
            subject
          );
          skippedCount++;
          continue;
        }

        // 7. CRÍTICO: Detectar correos con números de reserva pero NO confirmaciones
        const hasReservationNumberButNotConfirmation =
          /#[A-Z0-9]+/i.test(subject) && // Contiene número de reserva (#B15690205)
          !/confirmed|new confirmed|instant booking/i.test(subject) &&
          /^fwd:|^re:/i.test(subject);

        if (hasReservationNumberButNotConfirmation) {
          Logger.log(
            "[Main] Skip correo con número de reserva pero no es confirmación original: %s",
            subject
          );
          skippedCount++;
          continue;
        }

        // 8. Detectar correos de reenvío que no son confirmaciones originales
        const isForwardedNonConfirmation =
          /^fwd:/i.test(subject) &&
          !/reservation confirmed|new confirmed booking|instant booking/i.test(
            subject
          );

        if (isForwardedNonConfirmation) {
          Logger.log(
            "[Main] Skip correo reenviado que no es confirmación: %s",
            subject
          );
          skippedCount++;
          continue;
        }

        // 9. Detectar correos de Lodgify que NO son confirmaciones de reserva
        const isLodgifyNonReservation =
          /lodgify/i.test(from) &&
          !/^New Confirmed Booking/i.test(subject) &&
          !/^Reservation confirmed/i.test(subject) &&
          !/^Instant booking/i.test(subject);

        if (isLodgifyNonReservation) {
          Logger.log(
            "[Main] Skip correo de Lodgify que no es confirmación de reserva: %s",
            subject
          );
          skippedCount++;
          continue;
        }

        // 10. Detectar correos que contienen información de reservas pero NO son confirmaciones originales
        const isReservationInfoButNotOriginal =
          /reservation|booking|arrives|nights|arrival/i.test(subject) &&
          !/confirmed|new confirmed|instant booking/i.test(subject) &&
          (/^fwd:|^re:/i.test(subject) || /lodgify/i.test(from));

        if (isReservationInfoButNotOriginal) {
          Logger.log(
            "[Main] Skip correo con info de reserva pero no es confirmación original: %s",
            subject
          );
          skippedCount++;
          continue;
        }

        // =====================================================
        // FIN DEL FILTRADO TEMPRANO
        // =====================================================

        // Detectar correos que contienen información de reservas pero NO son confirmaciones
        const containsReservationInfoButNotConfirmation =
          /reservation|booking|arrives|nights|arrival/i.test(subject) &&
          !/confirmed|new confirmed|instant booking/i.test(subject) &&
          /^fwd:|^re:/i.test(subject);

        if (containsReservationInfoButNotConfirmation) {
          Logger.log(
            "[Main] Skip correo con info de reserva pero no es confirmación: %s",
            subject
          );
          skippedCount++;
          continue;
        }

        const body = EmailService.getCleanBody(msg);

        // Heurística rápida: usar Parser (Lodgify/Vrbo) solo para confirmaciones reales
        let dto = null;
        const isLodgifyConfirmed =
          /no-reply@messaging\.lodgify\.com/i.test(from) &&
          /^New Confirmed Booking/i.test(subject) &&
          !/^fwd:|^re:/i.test(subject); // Solo confirmaciones originales, no reenviadas

        if (isLodgifyConfirmed) {
          Logger.log(
            "[Main] Procesando confirmación real de Lodgify: %s",
            subject
          );
          dto = Parser.parseEmail(body);
        } else if (/lodgify/i.test(from)) {
          Logger.log(
            "[Main] Skip Lodgify (no es confirmación 'New Confirmed Booking' o es reenviada): from=%s subject=%s",
            from,
            subject
          );
          skippedCount++;
          continue;
        } else {
          // Airbnb (u otros): intentar primero con parser específico, luego Gemini

          // Usar Gemini para extraer datos (simplificado por ahora)
          Logger.log("[Main] Usando Gemini para extraer datos: %s", subject);
          const year = new Date().getFullYear();
          dto = GeminiService.extract(body, CONFIG.geminiApiKey, year);
          if (!dto) {
            Logger.log("[Main] Gemini no pudo extraer DTO: %s", subject);
            skippedCount++;
            continue;
          }

          // Si es Airbnb y tenemos datos del parser específico, combinarlos
          if (/airbnb/i.test(from) || /airbnb/i.test(subject)) {
            Logger.log(
              "[Main] Intentando enriquecer datos de Airbnb para: %s",
              subject
            );
            const airbnbData = Parser.parseAirbnbEmail(body);

            // Si el parser de Airbnb extrajo datos útiles, combinarlos
            if (
              airbnbData &&
              (airbnbData.guestService || airbnbData.baseCommissionOrHostFee)
            ) {
              Logger.log(
                "[Main] Parser de Airbnb extrajo datos: guestService=%s, hostFee=%s",
                airbnbData.guestService,
                airbnbData.baseCommissionOrHostFee
              );

              if (airbnbData.guestService)
                dto.guestService = airbnbData.guestService;
              if (airbnbData.baseCommissionOrHostFee)
                dto.baseCommissionOrHostFee =
                  airbnbData.baseCommissionOrHostFee;
              if (airbnbData.accommodationPrice)
                dto.accommodationPrice = airbnbData.accommodationPrice;
              if (airbnbData.cleaningFee)
                dto.cleaningFee = airbnbData.cleaningFee;
              if (airbnbData.taxesAmount)
                dto.taxesAmount = airbnbData.taxesAmount;

              Logger.log(
                "[Main] Datos combinados: parser específico + Gemini para: %s",
                subject
              );
            }
          }

          // Mejorar los datos extraídos con información del asunto del email
          // Especialmente útil para corregir nombres truncados de Airbnb
          dto = NameEnhancementService.enhanceExtractedData(dto, msg);
          Logger.log(
            "[Main] Datos mejorados con NameEnhancementService para: %s",
            subject
          );
        }

        // Validar que el DTO se haya creado correctamente
        if (!dto) {
          Logger.log("[Main] ERROR: DTO es null para el mensaje: %s", subject);
          skippedCount++;
          continue;
        }

        Logger.log("[Main] DTO creado exitosamente para: %s", subject);
        Logger.log("[Main] DTO contenido: %s", JSON.stringify(dto));

        // Debug específico del campo Property
        Logger.log(
          "[Main] Campo Property en DTO: '%s'",
          dto.Property || "UNDEFINED"
        );
        Logger.log(
          "[Main] Campo property en DTO: '%s'",
          dto.property || "UNDEFINED"
        );
        Logger.log(
          "[Main] Campo accommodationName en DTO: '%s'",
          dto.accommodationName || "UNDEFINED"
        );

        // Detección de duplicados inteligente
        const hasValidReservationData =
          dto.guestName && dto.checkInDate && dto.checkOutDate;
        if (!hasValidReservationData) {
          Logger.log(
            "[Main] Skip DTO sin datos de reserva válidos: guestName='%s', checkIn='%s', checkOut='%s'",
            dto.guestName || "MISSING",
            dto.checkInDate || "MISSING",
            dto.checkOutDate || "MISSING"
          );
          skippedCount++;
          continue;
        }

        // Verificar duplicados por nombre + fechas + plataforma
        const duplicateKey = `${dto.guestName}::${dto.checkInDate}::${dto.checkOutDate}::${dto.platform}`;
        if (processedReservations.has(duplicateKey)) {
          Logger.log(
            "[Main] Skip duplicado detectado: %s (ya procesado en esta ejecución)",
            duplicateKey
          );
          skippedCount++;
          continue;
        }

        // Verificar duplicados por número de reserva si está disponible
        if (dto.reservationNumber && dto.reservationNumber.trim()) {
          const reservationKey = `${dto.reservationNumber}::${dto.platform}`;
          if (processedReservations.has(reservationKey)) {
            Logger.log(
              "[Main] Skip duplicado por número de reserva: %s (ya procesado en esta ejecución)",
              reservationKey
            );
            skippedCount++;
            continue;
          }
          processedReservations.add(reservationKey);
        }

        processedReservations.add(duplicateKey);

        // Asegurar el messageId en DTO
        dto["Gmail Message ID"] = messageId;

        // Normalizar Property con estrategia por plataforma
        const platform = Array.isArray(dto.platform)
          ? dto.platform[0]
          : dto.platform;

        // Debug del mapeo de propiedades
        const propertyInput = dto.Property || dto.property || subject;
        Logger.log(
          "[Main] Mapeo de propiedad - Platform: %s, Input: '%s'",
          platform,
          propertyInput
        );

        const mapped = PropertyService.findPropertyMapping(
          platform,
          propertyInput
        );
        Logger.log(
          "[Main] Mapeo de propiedad - Resultado: %s (alias: %s)",
          mapped.name,
          mapped.aliasMatched
        );

        dto.Property = mapped.name;

        // NUEVA LÓGICA: Regla de preferencia mejorada
        if (/vrbo|lodgify/i.test(String(platform))) {
          const ci = dto.checkInDate;
          const co = dto.checkOutDate;
          const g = dto.guestName;

          // Verificar si ya procesamos una reserva de Airbnb para este huésped+fechas en esta ejecución
          const airbnbKey = `${g}::${ci}::${co}::Airbnb`;
          if (airbnbReservations.has(airbnbKey)) {
            Logger.log(
              "[Main] Skip Vrbo/Lodgify por preferencia Airbnb (ya procesado en esta ejecución): %s - %s → %s",
              g,
              ci,
              co
            );
            skippedCount++;
            continue;
          }

          // También verificar en Airtable por si acaso
          if (AirtableService.existsAirbnbForGuestDates(CONFIG, g, ci, co)) {
            Logger.log(
              "[Main] Skip Vrbo/Lodgify por preferencia Airbnb (existe en Airtable): %s - %s → %s",
              g,
              ci,
              co
            );
            skippedCount++;
            continue;
          }

          // Guard: evitar upsert parcial sin fechas base
          if (!ci || !co) {
            Logger.log(
              "[Main] Skip Vrbo/Lodgify por falta de check-in/check-out. from=%s subject=%s",
              from,
              subject
            );
            skippedCount++;
            continue;
          }
        }

        // Si es Airbnb, registrarlo para evitar duplicados de Vrbo/Lodgify
        if (/airbnb/i.test(String(platform))) {
          const airbnbKey = `${dto.guestName}::${dto.checkInDate}::${dto.checkOutDate}::Airbnb`;
          airbnbReservations.add(airbnbKey);
          Logger.log(
            "[Main] Registrada reserva Airbnb para evitar duplicados: %s",
            airbnbKey
          );
        }

        // Fallback: intentar extraer Reservation Number de subject/body si falta

        if (!dto.reservationNumber && !dto["Reservation number"]) {
          const guessed = extractReservationNumber(
            String(platform || ""),
            subject,
            body
          );
          if (guessed) {
            dto.reservationNumber = guessed;
            Logger.log(
              "[Main] Reservation number inferido: %s (platform=%s)",
              guessed,
              String(platform)
            );
          }
        }

        // Validación crítica: Reservation number requerido
        const reservationNumber = (
          dto.reservationNumber ||
          dto["Reservation number"] ||
          ""
        )
          .toString()
          .trim();
        if (!reservationNumber || reservationNumber === "0") {
          Logger.log(
            "[Main] Skip por reservationNumber vacío/0. from=%s subject=%s platform=%s",
            from,
            subject,
            String(platform)
          );
          skippedCount++;
          continue;
        }

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
