/**
 * Parser simplificado para correos de Lodgify → Airtable
 */
const Parser = {
  parseEmail: function (rawEmail, subject) {
    // Debug: Log del email crudo para análisis
    Logger.log("[Parser] Subject: %s", subject || "NO_SUBJECT");
    Logger.log(
      "[Parser] Email crudo (primeros 500 chars): %s",
      rawEmail.substring(0, 500)
    );

    // Limpiar HTML entities y tags más agresivamente
    const cleanEmail = rawEmail
      // Primero limpiar HTML entities
      .replace(/&#x2B;/g, "+")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      // Convertir breaks y párrafos a saltos de línea ANTES de remover tags
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/g, "\n")
      .replace(/<p>/g, "\n")
      // Remover todos los demás tags HTML
      .replace(/<[^>]*>/g, "")
      // Limpiar espacios múltiples pero MANTENER saltos de línea
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Debug: Log del email limpio
    Logger.log(
      "[Parser] Email limpio (primeros 500 chars): %s",
      cleanEmail.substring(0, 500)
    );

    const patterns = {
      // Patrones actualizados para el formato real de Lodgify
      Reservation_number: /(?:Reservation number|#)\s*:?\s*(B?\d+)/i,
      Full_Name: [
        /Name:\s*([^\n]+?)(?:\n|$)/i,
        /Guest:\s*([^\n]+?)(?:\n|$)/i,
        /Guest Name:\s*([^\n]+?)(?:\n|$)/i,
        /Name\s*:\s*([^\n]+?)(?:\n|<|$)/i,
      ],
      Phone_Number: [
        /Phone:\s*([^\n]+?)(?:\n|$)/i,
        /Phone Number:\s*([^\n]+?)(?:\n|$)/i,
        /Tel:\s*([^\n]+?)(?:\n|$)/i,
        /Telephone:\s*([^\n]+?)(?:\n|$)/i,
      ],
      E_mail: [
        /Email:\s*([^\n\s]+@[^\n\s]+)(?:\n|$)/i,
        /E-mail:\s*([^\n\s]+@[^\n\s]+)(?:\n|$)/i,
        /Email Address:\s*([^\n\s]+@[^\n\s]+)(?:\n|$)/i,
        /Mail:\s*([^\n\s]+@[^\n\s]+)(?:\n|$)/i,
      ],
      Property: [
        /Property:\s*(.+?)(?:\n|$)/i,
        /Accommodation:\s*(.+?)(?:\n|$)/i,
        /Property Name:\s*(.+?)(?:\n|$)/i,
      ],
      Arrival: [
        /Arrival:\s*([^\n]+?)(?:\n|$)/i,
        /Check-in:\s*([^\n]+?)(?:\n|$)/i,
        /Arrival Date:\s*([^\n]+?)(?:\n|$)/i,
        /Check in:\s*([^\n]+?)(?:\n|$)/i,
      ],
      Departure_Date: [
        /Departure:\s*([^\n]+?)(?:\n|$)/i,
        /Check-out:\s*([^\n]+?)(?:\n|$)/i,
        /Departure Date:\s*([^\n]+?)(?:\n|$)/i,
        /Check out:\s*([^\n]+?)(?:\n|$)/i,
      ],
      Total_Guests: /Guests?:\s*(\d+)/i,
      Accommodation: /(?:RENT|Accommodation)[\s\n]*USD\s*([\d.,]+)/i,
      Cleaning_Fee: /Cleaning Fee[\s\n]*USD\s*([\d.,]+)/i,
      Guest_Service: /Guest Service[\s\n]*USD\s*([\d.,]+)/i,
      Taxes: /(?:TAX|Taxes)[\s\n]*USD\s*([\d.,]+)/i,
      Resort_Fee: /Resort Fee[\s\n]*USD\s*([\d.,]+)/i,
      Total_Payment: /Total booking amount[\s\n]*USD\s*([\d.,]+)/i,
    };

    let result = {};
    for (let field in patterns) {
      let match = null;
      let matchedPattern = null;

      // Si el patrón es un array, probar cada uno
      if (Array.isArray(patterns[field])) {
        for (let pattern of patterns[field]) {
          match = cleanEmail.match(pattern);
          if (match) {
            matchedPattern = pattern.toString();
            break;
          }
        }
      } else {
        match = cleanEmail.match(patterns[field]);
        matchedPattern = patterns[field].toString();
      }

      result[field] = match ? match[1].trim() : "";

      // Debug: Log de cada campo importante
      if (
        [
          "Full_Name",
          "Arrival",
          "Departure_Date",
          "Property",
          "E_mail",
          "Phone_Number",
        ].includes(field)
      ) {
        Logger.log(
          "[Parser] Campo %s: pattern=%s, match=%s, result='%s'",
          field,
          matchedPattern || "MULTIPLE_PATTERNS",
          match ? "FOUND" : "NOT_FOUND",
          result[field]
        );
      }
    }

    // Fallback: extraer datos del subject si no se encontraron en el body
    if (subject && (!result.Full_Name || !result.Arrival)) {
      // Patrón para subject: "New Confirmed Booking: Steven (4 Nights, Arrival: Oct 16 2025) - #B15831191"
      const subjectMatch = subject.match(
        /New Confirmed Booking:\s*([^(]+)\s*\([^,]+,\s*Arrival:\s*([^)]+)\)/i
      );
      if (subjectMatch) {
        if (!result.Full_Name && subjectMatch[1]) {
          result.Full_Name = subjectMatch[1].trim();
          Logger.log(
            "[Parser] Nombre extraído del subject: '%s'",
            result.Full_Name
          );
        }
        if (!result.Arrival && subjectMatch[2]) {
          result.Arrival = subjectMatch[2].trim();
          Logger.log(
            "[Parser] Fecha de llegada extraída del subject: '%s'",
            result.Arrival
          );
        }
      }
    }

    const propertyNorm = PropertyService.normalizePropertyName(result.Property);
    const checkIn = normalizeDate(result.Arrival);
    const checkOut = normalizeDate(result.Departure_Date);

    return {
      reservationNumber: result.Reservation_number,
      platform: "Vrbo",
      guestName: result.Full_Name,
      guestPhone: result.Phone_Number,
      guestEmail: result.E_mail,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      Property: propertyNorm,
      accommodationPrice: Utils.sanitizeMoneyUSD(result.Accommodation || 0),
      adults: parseInt(result.Total_Guests || 0) || 0,
      children: 0,
      bookingDate: new Date().toISOString().slice(0, 10),
      cleaningFee: Utils.sanitizeMoneyUSD(result.Cleaning_Fee || 0),
      guestService: Utils.sanitizeMoneyUSD(result.Guest_Service || 0),
      taxesAmount: Utils.sanitizeMoneyUSD(result.Taxes || 0),
      clubFee: Utils.sanitizeMoneyUSD(result.Resort_Fee || 0),
      discount: 0,
      gmailMessageId:
        "lodgify-" + (result.Reservation_number || new Date().getTime()),
    };
  },

  // Parser específico para Airbnb que extrae Guest service fee y Host service fee
  parseAirbnbEmail: function (rawEmail) {
    let result = {};

    // Patrones regex más simples y directos para Airbnb
    const patterns = {
      guestService: /Guest service fee\s+\$([0-9.,]+)/i,
      cleaningFee: /Cleaning fee\s+\$([0-9.,]+)/i,
      taxesAmount: /Occupancy taxes\s+\$([0-9.,]+)/i,
      hostServiceFee: /Host service fee \([^)]+\)\s+-?\$([0-9.,]+)/i,
      // Para accommodation, capturamos el total (segundo valor)
      accommodationTotal: /\$([0-9.,]+) x \d+ nights\s+\$([0-9.,]+)/i,
      // Para accommodation rate (primer valor)
      accommodationRate: /\$([0-9.,]+) x \d+ nights/i,
    };

    // Extraer Guest service fee
    const guestServiceMatch = rawEmail.match(patterns.guestService);
    if (guestServiceMatch) {
      result.guestService = Utils.sanitizeMoneyUSD(guestServiceMatch[1]);
    }

    // Extraer Cleaning fee (solo de la sección Guest paid, no Host payout)
    const guestPaidSection = rawEmail.split("Host payout")[0];
    const cleaningFeeMatch = guestPaidSection.match(patterns.cleaningFee);
    if (cleaningFeeMatch) {
      result.cleaningFee = Utils.sanitizeMoneyUSD(cleaningFeeMatch[1]);
    }

    // Extraer Occupancy taxes
    const taxesMatch = rawEmail.match(patterns.taxesAmount);
    if (taxesMatch) {
      result.taxesAmount = Utils.sanitizeMoneyUSD(taxesMatch[1]);
    }

    // Extraer Host service fee
    const hostServiceMatch = rawEmail.match(patterns.hostServiceFee);
    if (hostServiceMatch) {
      result.baseCommissionOrHostFee = Utils.sanitizeMoneyUSD(
        hostServiceMatch[1]
      );
    }

    // Extraer accommodation price (rate per night, no el total)
    const accommodationMatch = rawEmail.match(patterns.accommodationRate);
    if (accommodationMatch) {
      result.accommodationPrice = Utils.sanitizeMoneyUSD(accommodationMatch[1]);
    }

    return result;
  },
};

/**
 * Normalizador de fechas → "YYYY-MM-DD"
 */
function normalizeDate(str) {
  if (!str) return "";
  let d = new Date(str);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}
