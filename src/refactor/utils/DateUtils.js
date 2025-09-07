/* eslint-disable */
/* prettier-ignore-file */

/**
 * Utilidades de fechas SIMPLIFICADAS
 * Eliminan la duplicación entre AirbnbProcessor y LodgifyProcessor
 * 
 * Filosofía: Email → Procesar → Airtable (SIMPLE)
 */

/**
 * Mapeo único de meses - usado por ambas plataformas
 */
const MONTH_MAP = {
  // Nombres cortos
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  
  // Nombres completos
  january: "01", february: "02", march: "03", april: "04",
  june: "06", july: "07", august: "08", september: "09", 
  october: "10", november: "11", december: "12",
  
  // Variaciones
  sept: "09"
};

/**
 * Extrae fecha de llegada desde el asunto del email
 * Funciona para Airbnb, Lodgify y Vrbo
 * 
 * @param {string} subject - Asunto del email
 * @returns {string|null} - Fecha en formato YYYY-MM-DD o null
 */
function extractArrivalDate(subject) {
  if (!subject) return null;

  // Patrones múltiples para mayor flexibilidad (ordenados por especificidad)
  const patterns = [
    // "arrives Jan 15, 2024" o "arriving January 15, 2024"
    /(?:arrives?|arriving)\s+([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i,
    
    // "check-in September 10, 2025"
    /check-in\s+([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i,
    
    // "arrives July 4th, 2025" (con ordinal)
    /arrives\s+([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th),?\s+(\d{4})/i,
    
    // Formato directo: "January 15, 2024"
    /([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/i
  ];
  
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      const [, monthName, day, year] = match;
      const monthNumber = MONTH_MAP[monthName.toLowerCase()];
      
      if (monthNumber) {
        const paddedDay = day.padStart(2, "0");
        return `${year}-${monthNumber}-${paddedDay}`;
      }
    }
  }

  // Fallback: buscar fecha ISO directamente
  const isoMatch = subject.match(/(\d{4}-\d{2}-\d{2})/);
  return isoMatch ? isoMatch[1] : null;
}

/**
 * Extrae primer nombre desde el asunto del email  
 * Funciona para todos los formatos de plataformas
 * 
 * @param {string} subject - Asunto del email
 * @returns {string|null} - Primer nombre o null
 */
function extractFirstName(subject) {
  if (!subject) return null;

  // Patrones optimizados ordenados por especificidad:
  const patterns = [
    // "Your reservation #ABC123 is confirmed - Mike arriving..."
    /(?:Your reservation|reservation)\s+[#]?[A-Z0-9]+\s+(?:is\s+)?confirmed\s*[-–]\s*([^,\s]+)/i,
    
    // "Booking confirmed for Robert Wilson, check-in..."  
    /(?:Booking|booking)\s+confirmed\s+for\s+([^,\s]+)/i,
    
    // "New Confirmed Booking: #B15695014 - Carlos arriving..."
    /New Confirmed Booking:\s*[#]?[A-Z0-9]+\s*[-–]\s*([^,\s]+)/i,
    
    // "BOOKING (#B15831191) - Steven Kopel arriving..." 
    /BOOKING\s*\([#]?[A-Z0-9]+\)\s*[-–]\s*([^,\s]+)/i,
    
    // "Booking Confirmation #123456 - David Lee arrives..."
    /Booking Confirmation\s+[#]?[A-Z0-9]+\s*[-–]\s*([^,\s]+)/i,
    
    // "Your VRBO reservation B987654 confirmed - Lisa arriving..."
    /Your VRBO reservation\s+[A-Z0-9]+\s+confirmed\s*[-–]\s*([^,\s]+)/i,
    
    // "Reservation confirmed: John Smith, arriving..." (original)
    /(?:Reservation confirmed|Instant booking confirmed|New Confirmed Booking):\s*([^,\s]+)/i,
    
    // "Reservation confirmed - John Smith" (original)
    /(?:New Confirmed Booking|Reservation confirmed|Instant booking)\s*[:-]\s*([^,\s]+)/i,
    
    // Patrón más general: "confirmed: Name" (original)
    /confirmed:\s*([^,\s]+)/i,
    
    // Patrón más general: "booking confirmed Name" (original)
    /booking\s+confirmed\s+([^,\s]+)/i
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extrae número de reserva desde el asunto
 * Funciona para todas las plataformas
 * 
 * @param {string} subject - Asunto del email
 * @returns {string|null} - Número de reserva o null
 */
function extractReservationNumber(subject) {
  if (!subject) return null;

  // Patrones optimizados para diferentes plataformas:
  const patterns = [
    // BOOKING (#B15831191) - Lodgify con paréntesis
    /BOOKING\s*\(#?([A-Z0-9]+)\)/i,
    
    // "Your reservation #ABC123" o "reservation #ABC123"
    /(?:Your\s+)?reservation\s+#([A-Z0-9]+)/i,
    
    // "Booking Confirmation #123456" - VRBO
    /Booking Confirmation\s+#([A-Z0-9]+)/i,
    
    // "Your VRBO reservation B987654" - VRBO sin #
    /Your VRBO reservation\s+([A-Z0-9]+)/i,
    
    // "New Confirmed Booking: #B15695014" - Lodgify
    /New Confirmed Booking:\s*#([A-Z0-9]+)/i,
    
    // Patrones generales (mantener para compatibilidad)
    /#([A-Z0-9]+)/i,           // Airbnb: #ABC123
    /([A-Z]?\d{6,})/i,         // Vrbo: 123456 o B123456
    /#?([A-Z]\d{7,})/i         // Lodgify: B15695014 o #B15695014
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Valida que una fecha sea válida y no sea fecha imposible
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @returns {boolean} - Si la fecha es válida
 */
function isValidDate(dateString) {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  
  // Verificar que la fecha no sea muy en el pasado o futuro extremo
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1);
  const twoYearsAhead = new Date(now.getFullYear() + 2, 11, 31);
  
  return date >= twoYearsAgo && date <= twoYearsAhead;
}

/**
 * Extrae toda la información básica de una reserva desde el asunto
 * SIMPLIFICADO: Una función para todas las plataformas
 * 
 * @param {string} subject - Asunto del email
 * @returns {Object} - { firstName, arrivalDate, reservationNumber }
 */
function extractReservationInfo(subject) {
  return {
    firstName: extractFirstName(subject),
    arrivalDate: extractArrivalDate(subject), 
    reservationNumber: extractReservationNumber(subject)
  };
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MONTH_MAP,
    extractArrivalDate,
    extractFirstName,
    extractReservationNumber,
    extractReservationInfo,
    isValidDate
  };
} else {
  // Solo declarar si no existe ya (evita errores de declaración duplicada en GAS)
  if (typeof globalThis.DateUtils === 'undefined') {
    globalThis.DateUtils = {
      MONTH_MAP,
      extractArrivalDate,
      extractFirstName,
      extractReservationNumber,
      extractReservationInfo,
      isValidDate
    };
  }
}
