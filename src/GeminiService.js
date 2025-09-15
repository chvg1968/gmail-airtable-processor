/* global UrlFetchApp, CONFIG, Utils, Logger */

var GeminiService = {
  /**
   * Compara el primer nombre y las fechas entre dos DTOs (uno de Lodgify y otro de Airbnb).
   * Si coinciden, retorna true para indicar que se debe descartar la reserva de Lodgify.
   * @param {Object} lodgifyDto - DTO de Lodgify
   * @param {Object} airbnbDto - DTO de Airbnb
   * @returns {boolean}
   */
  shouldDiscardLodgifyByFirstNameAndDates: function (lodgifyDto, airbnbDto) {
    if (!lodgifyDto || !airbnbDto) return false;
    // Extraer primer nombre (ignorando mayúsculas/minúsculas y espacios)
    const getFirstName = name => {
      if (!name) return '';
      return name.trim().split(' ')[0].toLowerCase();
    };
    const lodgifyFirst = getFirstName(lodgifyDto.guestName);
    const airbnbFirst = getFirstName(airbnbDto.guestName);
    // Comparar fechas
    const sameCheckIn = String(lodgifyDto.checkInDate).slice(0,10) === String(airbnbDto.checkInDate).slice(0,10);
    const sameCheckOut = String(lodgifyDto.checkOutDate).slice(0,10) === String(airbnbDto.checkOutDate).slice(0,10);
    return lodgifyFirst && airbnbFirst && (lodgifyFirst === airbnbFirst) && sameCheckIn && sameCheckOut;
  },
  buildPrompt: function (emailBody, year, messageId, subject, from, origin, platform, bookingDate) {
    return `You are a data extraction system. Extract booking information from the email data and return ONLY a valid JSON object. Do not include markdown, code blocks, or explanatory text.

CRITICAL: Your response must start with { and end with }. No \`\`\`json or other formatting.

EMAIL DATA TO EXTRACT FROM:
ID: ${messageId || ''}
SUBJECT: ${subject || ''}
TEXT: ${emailBody || ''}
FROM: ${from || ''}
ORIGIN: ${origin || null}
PLATFORM: ${platform || null}
BOOKING_DATE: ${bookingDate || null}
CURRENT_TIME: ${(new Date()).toISOString()}

Extract the following JSON structure:

{
  "guestName": "Extract guest name from email content",
  "firstName": "First word of guestName in lowercase",
  "platform": "Use PLATFORM value wrapped in array if not null",
  "origin": "Use ORIGIN value",
  "reservationNumber": "Extract reservation/booking number",
  "checkInDate": "Convert arrival date to ISO format YYYY-MM-DDTHH:MM:SSZ",
  "checkOutDate": "Convert departure date to ISO format YYYY-MM-DDTHH:MM:SSZ",
  "accommodationName": "Map property name using rules below",
  "propertyCodeVrbo": null,
  "accommodationPrice": "Extract RENT amount as number",
  "resortFee": null,
  "adults": "Extract number of people",
  "children": null,
  "guestPhone": null,
  "guestEmail": null,
  "bookingDate": "Use BOOKING_DATE value",
  "discountAmount": null,
  "cleaningFee": null,
  "guestService": null,
  "taxesAmount": null,
  "damageProtectionFee": null,
  "clubFee": null,
  "baseCommissionOrHostFee": null,
  "paymentProcessingFee": null,
  "id": "Use ID value",
  "dupKey": "Create as: firstName|checkInDate|checkOutDate",
  "discardBecauseDuplicate": false,
  "needsDateReview": false
}

PROPERTY NAME MAPPING RULES:
If email text contains "Villa Palacio" or "Palacio" → return "7256 Villa Palacio"
If email text contains "Ocean Grace" or "Grace" → return "2-105 Ocean Grace Villa"
If email text contains "Ocean Serenity" or "Serenity" → return "2-101 Ocean Serenity Villa"
If email text contains "Ocean Haven" or "Haven" → return "2-208 Ocean Haven Villa"
If email text contains "Ocean Sound" or "Sound" → return "2-103 Ocean Sound Villa"
If email text contains "Ocean View" or "View" → return "315 Ocean View Villa"
If email text contains "Villa Clara" or "Clara" → return "3325 Villa Clara"
If email text contains "Villa Flora" or "Flora" → return "10180 Villa Flora"
If email text contains "Villa Paloma" or "Paloma" → return "5138 Villa Paloma"
If email text contains "Villa Tiffany" or "Tiffany" → return "10389 Villa Tiffany"
If email text contains "Casa Prestige" or "Prestige" → return "Atl. G7 Casa Prestige"
If email text contains "Casa Paraiso" or "Paraiso" → return "Est. 24 Casa Paraiso"
Otherwise return the property name as found in the email.

EXTRACTION RULES:
- Guest name: Look for "payment from [NAME]" or "[NAME]," in subject
- Reservation number: Look for "Id:B" followed by numbers or "#B" followed by numbers
- Dates: Look for "Arrival:" and "Departure:" followed by dates, convert to ISO format with T00:00:00Z
- Accommodation price: Look for "USD" followed by numbers in quote section
- People count: Look for "People:" followed by number
- Platform array: If PLATFORM is not null, wrap in array like ["Vrbo"]

Remember: Return ONLY the JSON object with no additional formatting or text.`;
  },

  extract: function (emailBody, apiKey, year, messageId, subject, from, origin, platform, bookingDate) {
    // Adaptar el prompt para usar los datos disponibles en GAS
    const prompt = this.buildPrompt(emailBody, year, messageId, subject, from, origin, platform, bookingDate);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: CONFIG.CONSTANTS.GEMINI.TEMPERATURE,
        maxOutputTokens: CONFIG.CONSTANTS.GEMINI.MAX_OUTPUT_TOKENS,
        topP: CONFIG.CONSTANTS.GEMINI.TOP_P,
        topK: CONFIG.CONSTANTS.GEMINI.TOP_K,
        responseMimeType: "application/json"
      },
    };

    try {
      const res = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify(payload) });
      const data = JSON.parse(res.getContentText());
      const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!text) return null;

      let parsed = null;
      try { parsed = JSON.parse(text); } catch (_) { return null; }
      if (!parsed || typeof parsed !== 'object') return null;

      // Si Gemini indica que debe descartarse por duplicado, retornar null
      if (parsed.discardBecauseDuplicate) {
        Logger.log(`[GeminiService] Email descartado por duplicado según Gemini: ${parsed.dupKey}`);
        return null;
      }

      // Normalización del DTO con campos de n8n
      const platformArray = Array.isArray(parsed.platform) ? parsed.platform : [parsed.platform || 'Vrbo'];
      const platformStr = platformArray[0] || 'Vrbo';

      return {
        platform: /airbnb/i.test(platformStr) ? 'Airbnb' : 'Vrbo',
        reservationNumber: parsed.reservationNumber || '',
        guestName: parsed.guestName || '',
        firstName: parsed.firstName || '',
        guestEmail: parsed.guestEmail || '',
        guestPhone: parsed.guestPhone || '',
        checkInDate: parsed.checkInDate || '',
        checkOutDate: parsed.checkOutDate || '',
        bookingDate: parsed.bookingDate || '',
        Property: parsed.accommodationName || '',
        accommodationPrice: Utils.sanitizeMoneyUSD(parsed.accommodationPrice || 0),
        resortFee: Utils.sanitizeMoneyUSD(parsed.resortFee || 0),
        cleaningFee: Utils.sanitizeMoneyUSD(parsed.cleaningFee || 0),
        guestService: Utils.sanitizeMoneyUSD(parsed.guestService || 0),
        taxesAmount: Utils.sanitizeMoneyUSD(parsed.taxesAmount || 0),
        clubFee: Utils.sanitizeMoneyUSD(parsed.clubFee || 0),
        discount: Utils.sanitizeMoneyUSD(parsed.discountAmount || 0),
        adults: Number(parsed.adults || 0),
        children: Number(parsed.children || 0),
        baseCommissionOrHostFee: Utils.sanitizeMoneyUSD(parsed.baseCommissionOrHostFee || 0),
        paymentProcessingFee: parsed.paymentProcessingFee === 'TBD' ? 'TBD' : Utils.sanitizeMoneyUSD(parsed.paymentProcessingFee || 0),
        dupKey: parsed.dupKey || '',
        discardBecauseDuplicate: parsed.discardBecauseDuplicate || false,
        needsDateReview: parsed.needsDateReview || false,
        id: parsed.id || messageId || '',
        origin: parsed.origin || origin || '',
      };
    } catch (e) {
      // Log ligero en consola de GAS
      Logger.log(`[GeminiService] Error: ${e}`);
      return null;
    }
  }
};