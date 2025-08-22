/* global UrlFetchApp, CONFIG, Utils */

var GeminiService = {
  buildPrompt: function (emailBody, year) {
    return `
      Analyze the following email content to extract booking details. The current year is ${year} for context, which should be used for any dates where the year is not specified.

      Email Content:
      --- BEGIN EMAIL ---
      ${emailBody}
      --- END EMAIL ---

      Extract the following fields and return them in a single, flat JSON object. Do not use nested objects.
      
      CRITICAL INSTRUCTION FOR GUEST NAMES:
      - guestName: The FULL name of the primary guest (first name + last name(s)). 
      - For Airbnb emails: ALWAYS extract the complete name from the email subject line. The subject typically follows the pattern "Reservation confirmed - [FULL NAME] arrives [DATE]". Extract the complete name including all last names.
      - For Lodgify emails: take the full value after 'Name:' (e.g., 'Name:  Karen Roberts' -> 'Karen Roberts'). Do not shorten to first name.
      - For Vrbo emails: extract the full name from "Instant Booking from [FULL NAME]: ..."
      - NEVER truncate or shorten names to just the first name. Always include the complete name as it appears in the email.
      
      - platform: The booking platform (e.g., "Airbnb", "Vrbo", "HomeAway"). Should be an array with one string. If the email comes from Lodgify (e.g., mentions Lodgify or follows Lodgify's format), set platform to ["Vrbo"].
      - reservationNumber: The unique confirmation code or reservation ID.
      - checkInDate: The arrival date in YYYY-MM-DD format.
      - checkOutDate: The departure date in YYYY-MM-DD format.
      - accommodationName: The full address or name of the property. For Airbnb, this is CRITICAL - extract the property name from the email. Look for lines like "Reservation at [PROPERTY NAME]" or property addresses. For Vrbo, extract the textual property name (e.g., "Villa Clara", "Ocean Grace Villa"). For Lodgify emails, read the 'Property:' line and preserve the text after the last hyphen (e.g., 'Property: Bahia Beach Steps from Ocean 2BDRM- Ocean Haven' -> return 'Bahia Beach Steps from Ocean 2BDRM- Ocean Haven'). If you cannot find a specific property name, return the most descriptive location information available.
      - propertyCodeVrbo: The unique property identifier code for Vrbo bookings, often found near the property name or details (e.g., "3456633", "4574967"). This is NOT the reservation ID (like HA-XXXXXX). Null for other platforms.
      - accommodationPrice: The total price for the entire stay, before fees or taxes. For Airbnb, if you see a pattern like '$X.XX x N nights' or 'Accommodation: $X.XX x N nights', multiply to get the total. If both total and per-night prices are present, always return the total. If only per-night and number of nights are present, multiply them. For Lodgify emails, STRICTLY map the line starting with 'RENT' to this field (numeric only, no currency symbol or commas). Do NOT use 'Total booking amount' for this field.
      - adults: The number of adults.
      - children: The number of children.
      - guestPhone: The phone number of the guest. For Vrbo emails, look for "Traveler Phone". For Airbnb, extract the phone in guest contact info. For Lodgify, map the 'Phone' line.
      - guestEmail: The email address of the guest. For Lodgify, map the 'Email' line.
      - bookingDate: The date when the booking confirmation email was originally sent. For Airbnb, if the email is a forward, search for a header block that starts with '---------- Forwarded message ---------' and extract the line starting with 'Date:'. For Vrbo, use the earliest date present in the email body that looks like a confirmation or booking date (e.g., from a header or from the booking details section). Always return the date in YYYY-MM-DD format. If not found, use the oldest date present in the email body. Prioritize the original Airbnb header date over any forward date or processing date.
      - discountAmount: Any discount applied.
      - cleaningFee: The cleaning fee. For Lodgify, map 'Cleaning Fee' to a numeric value (no currency symbols or commas).
      - guestService: For Airbnb, map from 'Guest service fee' if present. This is the fee charged to the guest for Airbnb's service. For Vrbo, map from any guest service fee lines. For Lodgify emails, map 'Guest Service' to this field (numeric only, no currency symbol or commas).
      - taxesAmount: Any taxes applied. For Airbnb, map from 'Occupancy taxes' if present. For Vrbo, map from the taxes lines present in the details. For Lodgify emails, map 'TAX' to this field (numeric, no currency symbol or commas).
      - damageProtectionFee: The fee for damage protection, insurance, or damage deposit.
      - clubFee: The 'Club' fee, if present in the Vrbo pricing breakdown. For Lodgify emails, map 'Resort Fee' to this field. Null if not present.
      - baseCommissionOrHostFee: The base commission for Vrbo or host fee for Airbnb. For Airbnb, this is the 'Host service fee (3.0%)' which is a deduction from the host's payout. For Vrbo, this might be part of a 'Payout' calculation. If not found, return null.
      - paymentProcessingFee: The payment processing fee, often a percentage of the total or a fixed amount. For Vrbo, this might be explicitly listed or sometimes marked as 'TBD' if not yet calculated. If 'TBD', return the string 'TBD'. If not found, return null.

      IMPORTANT RULES:
      1.  CRITICAL: This email may originate directly from Airbnb or Vrbo/HomeAway, or via Lodgify acting as an intermediary for Vrbo listings. If the content corresponds to a Vrbo reservation but comes via Lodgify, treat it as Vrbo (platform: ["Vrbo"]) and proceed with extraction using the Lodgify field mappings described above.
      2.  If the email is from Vrbo/HomeAway and does NOT contain a detailed pricing structure (e.g., lines for 'nights', 'cleaning fee', 'taxes'), return a JSON object with a single key: {"error": "No detailed pricing structure found in Vrbo email"}. Do not attempt to extract other fields.
      3.  For dates, if the year is missing, use the provided reference year (${year}).
      4.  All monetary values should be numbers, without currency symbols or commas, except for 'paymentProcessingFee' which can be the string 'TBD'.
      5.  If a field is not found, its value should be null.
      6.  The 'platform' field must always be an array containing a single string.
      7.  MOST IMPORTANT: For guest names, always extract the COMPLETE name including all last names. Never truncate names to just the first name.
      
      Return the extracted fields as a flat JSON object. If any field is missing, set it to null or an empty string.
      `;
  },

  extract: function (emailBody, apiKey, year) {
    const prompt = this.buildPrompt(emailBody, year);
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

      // Normalización mínima del DTO
      const platform = String(parsed.platform || '').trim();
      return {
        platform: /airbnb/i.test(platform) ? 'Airbnb' : 'Vrbo',
        reservationNumber: parsed.reservationNumber || '',
        guestName: parsed.guestName || '',
        guestEmail: parsed.guestEmail || '',
        guestPhone: parsed.guestPhone || '',
        checkInDate: parsed.checkInDate || '',
        checkOutDate: parsed.checkOutDate || '',
        bookingDate: parsed.bookingDate || '',
        Property: parsed.accommodationName || parsed.property || '',
        accommodationPrice: Utils.sanitizeMoneyUSD(parsed.accommodationPrice || 0),
        cleaningFee: Utils.sanitizeMoneyUSD(parsed.cleaningFee || 0),
        guestService: Utils.sanitizeMoneyUSD(parsed.guestService || 0),
        taxesAmount: Utils.sanitizeMoneyUSD(parsed.taxesAmount || 0),
        clubFee: Utils.sanitizeMoneyUSD(parsed.clubFee || 0),
        discount: Utils.sanitizeMoneyUSD(parsed.discount || 0),
        adults: Number(parsed.adults || 0),
        children: Number(parsed.children || 0),
        baseCommissionOrHostFee: Utils.sanitizeMoneyUSD(parsed.baseCommissionOrHostFee || 0),
        paymentProcessingFee: parsed.paymentProcessingFee === 'TBD' ? 'TBD' : Utils.sanitizeMoneyUSD(parsed.paymentProcessingFee || 0),
      };
    } catch (e) {
      // Log ligero en consola de GAS
      Logger.log(`[GeminiService] Error: ${e}`);
      return null;
    }
  }
};