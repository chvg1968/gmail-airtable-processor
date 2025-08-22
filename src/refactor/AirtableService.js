/**
 * Servicio seguro e idempotente para Airtable (GAS)
 * - Respeta nombres de campos de producción
 * - SAFE_MODE evita escrituras reales
 * - Busca por Reservation number + Platform para decidir PATCH vs POST
 * - Suma Resort Fee (clubFee) a Accommodation en Vrbo/Lodgify
 */
/* global UrlFetchApp, Logger, CONFIG, Utils */

const AirtableService = (() => {
  // --- Utils locales (alineadas a googlescript.js) ---
  function sanitizeMoneyUSD(v) {
    if (v === null || v === undefined || v === "") return 0;
    let n =
      typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
    if (!isFinite(n)) return 0;
    if (n >= 100000) {
      const div = n / 100;
      if (div < 100000) n = div;
    }

    return Math.round(n * 100) / 100;
  }

  function formatDateForAirtable(dateString, hourString) {
    if (!dateString) return null;
    try {
      const datePart = String(dateString).split("T")[0];
      const [y, m, d] = datePart.split("-").map(Number);
      if (!y || !m || !d) throw new Error("Invalid date format");
      const utc = new Date(Date.UTC(y, m - 1, d));
      if (isNaN(utc.getTime())) return null;
      const yyyy = utc.getUTCFullYear();
      const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(utc.getUTCDate()).padStart(2, "0");
      return hourString
        ? `${yyyy}-${mm}-${dd}T${hourString}`
        : `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      Logger.log(
        `[AirtableService] formatDateForAirtable error for '${dateString}': ${e}`
      );
      return null;
    }
  }

  function normalizePlatform(p) {
    const s = Array.isArray(p) ? p[0] : p;
    const v = (s || "").toLowerCase();
    if (v.includes("vrbo") || v.includes("homeaway")) return "Vrbo";
    if (v.includes("airbnb")) return "Airbnb";
    return "Desconocido";
  }

  function buildAirtableOptions(apiKey, method, payload) {
    const opt = {
      method,
      headers: { Authorization: `Bearer ${apiKey}` },
      muteHttpExceptions: true,
    };
    if (payload) {
      opt.contentType = "application/json";
      opt.payload = JSON.stringify(payload);
    }
    return opt;
  }

  function httpJson(url, options, context) {
    try {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      const text = res.getContentText();
      if (code >= 400) {
        Logger.log(`[AirtableService] HTTP ${code} in ${context}: ${text}`);
        return null;
      }
      return JSON.parse(text);
    } catch (e) {
      Logger.log(`[AirtableService] Error in ${context}: ${e}`);
      return null;
    }
  }

  // --- Lecturas de solo consulta ---
  function isMessageProcessed(config, messageId) {
    const formula = `{Gmail Message ID} = "${messageId}"`;
    const url = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
    const opt = buildAirtableOptions(config.airtableApiKey, "get");
    const data = httpJson(url, opt, `isMessageProcessed ${messageId}`);
    return !!(data && Array.isArray(data.records) && data.records.length > 0);
  }

  function existsAirbnbForGuestDates(
    config,
    guestName,
    checkInDate,
    checkOutDate
  ) {
    if (!guestName || !checkInDate || !checkOutDate) return false;
    const formula = `AND({Platform} = "Airbnb", IS_SAME({Arrival}, "${checkInDate}", 'day'), IS_SAME({Departure Date}, "${checkOutDate}", 'day'))`;
    const url = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=50`;
    const opt = buildAirtableOptions(config.airtableApiKey, "get");
    const data = httpJson(url, opt, `existsAirbnbForGuestDates`);
    if (!data || !Array.isArray(data.records)) return false;
    const normalize = (s) =>
      String(s || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}+/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const target = normalize(guestName);
    for (const rec of data.records) {
      const fn =
        rec.fields &&
        (rec.fields["Full Name"] ||
          rec.fields["Full name"] ||
          rec.fields["Guest name"]);
      if (fn && normalize(fn) === target) return true;
    }
    return false;
  }

  // --- Upsert idempotente ---
  function upsert(dto, config, messageId) {
    const platform = normalizePlatform(dto.platform);

    // Resolver property: el llamador debe pasar el nombre final, pero aceptamos compatibilidad
    const propertyName =
      dto.Property || dto.property || dto.accommodationName || "Temporal";

    // Accommodation base y Resort/Club Fee por separado (para fórmulas Vrbo)
    const accommodationBaseRaw =
      dto.Accommodation ?? dto.accommodation ?? dto.accommodationPrice ?? 0;
    const accommodationBase = sanitizeMoneyUSD(accommodationBaseRaw);
    const clubFee = sanitizeMoneyUSD(
      dto.clubFee ?? dto.resortFee ?? dto.Resort_Fee ?? 0
    );
    const accommodation =
      platform === "Vrbo"
        ? sanitizeMoneyUSD(accommodationBase + clubFee) // mostrado en Airtable
        : accommodationBase;

    // Campos opcionales que pueden no venir en correos
    const discount = sanitizeMoneyUSD(
      dto.Discount ?? dto.discount ?? dto.discountAmount ?? 0
    );
    const cleaningFee = sanitizeMoneyUSD(
      dto["Cleaning Fee"] ?? dto.cleaningFee ?? 0
    );
    const guestService = sanitizeMoneyUSD(
      dto["Guest Service"] ?? dto.guestService ?? dto.guestServiceFee ?? 0
    );
    const taxes = sanitizeMoneyUSD(
      dto.Taxes ?? dto.taxes ?? dto.taxesAmount ?? 0
    );
    const dProtection = sanitizeMoneyUSD(
      dto["D. Protection"] ?? dto.damageProtectionFee ?? 0
    );

    // Comisiones y fees: lógica requerida
    const airbnbHostServiceFee = sanitizeMoneyUSD(
      dto.baseCommissionOrHostFee ?? 0
    );
    const vrboValue1 = sanitizeMoneyUSD(
      (accommodationBase + clubFee + cleaningFee + taxes) * 0.03
    );
    const vrboValue2 = sanitizeMoneyUSD(
      (accommodationBase + clubFee + cleaningFee) * 0.05
    );

    // Fechas con horas por defecto
    const arrival = formatDateForAirtable(
      dto.checkInDate || dto.Arrival,
      CONFIG.CONSTANTS.AIRTABLE.DEFAULT_CHECKIN_TIME
    );
    const departure = formatDateForAirtable(
      dto.checkOutDate || dto["Departure Date"],
      CONFIG.CONSTANTS.AIRTABLE.DEFAULT_CHECKOUT_TIME
    );

    const needsDateReview =
      platform === "Airbnb"
        ? Utils.calculateNeedsDateReview(
            dto.checkInDate,
            dto.checkOutDate,
            CONFIG.CONSTANTS.DATE_REVIEW.MAX_DAYS_AHEAD
          )
        : false;

    const airtableFields = {
      "Gmail Message ID": messageId || dto["Gmail Message ID"] || "",
      "Full Name": dto.guestName || dto["Full Name"] || "",
      Arrival: arrival,
      "Departure Date": departure,
      Property: propertyName || null,
      "Phone Number": dto.guestPhone || dto["Phone Number"] || null,
      "E-mail": dto.guestEmail || dto["E-mail"] || null,
      Adults: dto.adults ?? dto.Adults ?? 0,
      Children: dto.children ?? dto.Children ?? 0,
      "Booking Date": dto.bookingDate || dto["Booking Date"] || null,
      Platform: platform,
      "Reservation number":
        dto.reservationNumber || dto["Reservation number"] || "",
      Accommodation: accommodation,
      Discount: discount,
      "Cleaning Fee": cleaningFee,
      "Guest Service": guestService,
      Taxes: taxes,
      "D. Protection": dProtection,
      "Needs Date Review": needsDateReview,
      "Vrbo value 1 or Airbnb value":
        platform === "Vrbo" ? vrboValue1 : airbnbHostServiceFee,
      "Vrbo value 2": platform === "Vrbo" ? vrboValue2 : 0,
    };

    // Limpiar nulos/undefined
    for (const k in airtableFields) {
      if (airtableFields[k] === null || airtableFields[k] === undefined)
        delete airtableFields[k];
    }

    const reservationNumber = airtableFields["Reservation number"];
    if (!reservationNumber || !String(reservationNumber).trim()) {
      Logger.log(
        `[AirtableService] Invalid reservation number: '${reservationNumber}'`
      );
      return { ok: false, reason: "invalid_reservation_number" };
    }

    const baseUrl = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}`;
    const filterFormula = `AND({Reservation number} = "${String(reservationNumber).replace(/"/g, '\\"')}", {Platform} = "${platform}")`;
    const getUrl = `${baseUrl}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    // Read-only GET permitido aún en SAFE_MODE
    const existing = httpJson(
      getUrl,
      buildAirtableOptions(config.airtableApiKey, "get"),
      "search existing by reservation+platform"
    );
    const exists = !!(
      existing &&
      Array.isArray(existing.records) &&
      existing.records.length > 0
    );

    if (CONFIG.SAFE_MODE) {
      const op = exists ? "PATCH" : "POST";
      Logger.log(
        `[AirtableService][SAFE_MODE] Would ${op} ${exists ? existing.records[0].id : "<new>"} with fields: ${JSON.stringify(airtableFields)}`
      );
      return {
        ok: true,
        safeMode: true,
        wouldUpdate: exists,
        recordId: exists ? existing.records[0].id : null,
        fields: airtableFields,
      };
    }

    if (exists) {
      const recId = existing.records[0].id;
      Logger.log(
        `[AirtableService] Updating existing reservation: ${reservationNumber} - ${platform}`
      );
      const patchUrl = `${baseUrl}/${recId}`;
      const patchRes = httpJson(
        patchUrl,
        buildAirtableOptions(config.airtableApiKey, "patch", {
          fields: airtableFields,
        }),
        "update reservation"
      );
      return { ok: !!patchRes, updated: true, id: recId };
    } else {
      Logger.log(
        `[AirtableService] Creating new reservation: ${reservationNumber} - ${platform}`
      );
      const postRes = httpJson(
        baseUrl,
        buildAirtableOptions(config.airtableApiKey, "post", {
          records: [{ fields: airtableFields }],
        }),
        "create reservation"
      );
      return {
        ok: !!postRes,
        created: true,
        id: postRes && postRes.records && postRes.records[0]?.id,
      };
    }
  }

  return {
    upsert,
    isMessageProcessed,
    existsAirbnbForGuestDates,
  };
})();
