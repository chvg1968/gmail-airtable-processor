/**
 * Parser simplificado para correos de Lodgify → Airtable
 */
const Parser = {
  parseEmail: function (rawEmail) {
    const patterns = {
      Reservation_number: /Reservation number:\s*(B\d+)/i,
      Full_Name: /Guest:\s*(.+)/i,
      Phone_Number: /Phone:\s*(.+)/i,
      E_mail: /Email:\s*(.+)/i,
      Property: /Property:\s*(.+)/i,
      Arrival: /Arrival:\s*(.+)/i,
      Departure_Date: /Departure:\s*(.+)/i,
      Total_Guests: /Guests:\s*(\d+)/i,
      Accommodation: /Accommodation:\s*([\d.,]+)/i,
      Cleaning_Fee: /Cleaning Fee:\s*([\d.,]+)/i,
      Guest_Service: /Guest Service:\s*([\d.,]+)/i,
      Taxes: /Taxes:\s*([\d.,]+)/i,
      Resort_Fee: /Resort Fee:\s*([\d.,]+)/i,
      Total_Payment: /Total booking amount:\s*USD\s*([\d.,]+)/i
    };

    let result = {};
    for (let field in patterns) {
      let match = rawEmail.match(patterns[field]);
      result[field] = match ? match[1].trim() : "";
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
      bookingDate: new Date().toISOString().slice(0,10),
      cleaningFee: Utils.sanitizeMoneyUSD(result.Cleaning_Fee || 0),
      guestService: Utils.sanitizeMoneyUSD(result.Guest_Service || 0),
      taxesAmount: Utils.sanitizeMoneyUSD(result.Taxes || 0),
      clubFee: Utils.sanitizeMoneyUSD(result.Resort_Fee || 0),
      discount: 0,
      gmailMessageId: "lodgify-" + (result.Reservation_number || new Date().getTime())
    };
  },

  // Parser específico para Airbnb que extrae Guest service fee y Host service fee
  parseAirbnbEmail: function (rawEmail) {
    // Función auxiliar para extraer valores después de etiquetas
    function extractValueAfterLabel(text, label) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().toLowerCase().includes(label.toLowerCase())) {
          // Buscar el siguiente valor en las líneas siguientes
          for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j].trim();
            if (line && line.startsWith('$')) {
              return line.replace('$', '').replace(',', '');
            }
          }
        }
      }
      return null;
    }

    // Función para extraer valores específicos de la sección Host payout
    function extractHostPayoutValue(text, label) {
      const lines = text.split('\n');
      let inHostPayoutSection = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Detectar inicio de la sección Host payout
        if (line.toLowerCase().includes('host payout')) {
          inHostPayoutSection = true;
          continue;
        }
        
        // Si estamos en la sección Host payout y encontramos la etiqueta
        if (inHostPayoutSection && line.toLowerCase().includes(label.toLowerCase())) {
          // Para Host service fee, buscar el valor específico en la línea correcta
          if (label.toLowerCase().includes('host service fee')) {
            // El Host service fee está en la línea 22, que es 5 líneas después de la etiqueta
            const targetLineIndex = i + 5;
            if (targetLineIndex < lines.length) {
              const targetLine = lines[targetLineIndex].trim();
              
              if (targetLine && (targetLine.startsWith('$') || targetLine.startsWith('-$'))) {
                return targetLine.replace('$', '').replace(',', '').replace('-', '');
              }
            }
          } else {
            // Para otros campos, buscar el siguiente valor en las líneas siguientes
            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j].trim();
              
              if (nextLine && (nextLine.startsWith('$') || nextLine.startsWith('-$'))) {
                return nextLine.replace('$', '').replace(',', '');
              }
            }
          }
        }
      }
      return null;
    }

    let result = {};
    
    // Extraer Guest service fee usando la función auxiliar
    const guestServiceValue = extractValueAfterLabel(rawEmail, 'Guest service fee');
    if (guestServiceValue) {
      result.guestService = Utils.sanitizeMoneyUSD(guestServiceValue);
    }

    // Extraer Host service fee (3.0%) usando la función específica para Host payout
    const hostServiceValue = extractHostPayoutValue(rawEmail, 'Host service fee (3.0%)');
    if (hostServiceValue) {
      result.baseCommissionOrHostFee = Utils.sanitizeMoneyUSD(hostServiceValue);
    }

    // Extraer otros campos usando la función auxiliar
    const accommodationValue = extractValueAfterLabel(rawEmail, 'x 4 nights');
    if (accommodationValue) {
      result.accommodationPrice = Utils.sanitizeMoneyUSD(accommodationValue);
    }

    const cleaningFeeValue = extractValueAfterLabel(rawEmail, 'Cleaning fee');
    if (cleaningFeeValue) {
      result.cleaningFee = Utils.sanitizeMoneyUSD(cleaningFeeValue);
    }

    const taxesValue = extractValueAfterLabel(rawEmail, 'Occupancy taxes');
    if (taxesValue) {
      result.taxesAmount = Utils.sanitizeMoneyUSD(taxesValue);
    }

    return result;
  }
};

/**
 * Normalizador de fechas → "YYYY-MM-DD"
 */
function normalizeDate(str) {
  if (!str) return "";
  let d = new Date(str);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0,10);
}