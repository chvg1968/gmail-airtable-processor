// Test temporal para verificar el parser de Lodgify
const testEmail = `
BOOKING (#B15831191)

Status: Booked

Arrival: Oct 16 2025

Departure: Oct 20 2025

Nights: 4

Property: Bahia Beach Steps from Ocean 2BDRM-Ocean Serenity

Guests: 5 guest(s)

QUOTE (#14169118)

Status: Agreed

PRICE

RENT    USD 3919.94

Cleaning Fee    USD 299.00

Resort Fee    USD 780.00

TAX    USD 295.30

Total booking amount    USD 5293.94

Guest details

Name: Steven Kopel

Phone: +1 (787) 548-5153

Email: stevenkopelb@gmail.com

Country: Puerto Rico
`;

// Simular las funciones necesarias
const Utils = {
  sanitizeMoneyUSD: function (v) {
    if (v === null || v === undefined || v === "") return 0;
    let n =
      typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  },
};

const PropertyService = {
  normalizePropertyName: function (input) {
    console.log("PropertyService input:", input);
    // Simulación simple
    if (input && input.includes("Ocean Serenity")) {
      return "2-101 Ocean Serenity Villa";
    }
    return input || "Temporal";
  },
};

function normalizeDate(str) {
  if (!str) return "";
  let d = new Date(str);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}

// Parser actualizado
const Parser = {
  parseEmail: function (rawEmail) {
    // Limpiar HTML entities y tags
    const cleanEmail = rawEmail
      .replace(/&#x2B;/g, "+")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/<\/p>/g, "")
      .replace(/<p>/g, "")
      .replace(/<br\s*\/?>/gi, "\n");

    const patterns = {
      // Patrones actualizados para el formato real de Lodgify
      Reservation_number: /(?:Reservation number|#)\s*:?\s*(B?\d+)/i,
      Full_Name: /Name:\s*(.+?)(?:\n|$)/i,
      Phone_Number: /Phone:\s*(.+?)(?:\n|$)/i,
      E_mail: /Email:\s*(.+?)(?:\n|$)/i,
      Property: /Property:\s*(.+?)(?:\n|$)/i,
      Arrival: /Arrival:\s*(.+?)(?:\n|$)/i,
      Departure_Date: /Departure:\s*(.+?)(?:\n|$)/i,
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
      let match = cleanEmail.match(patterns[field]);
      if (field === "Property") {
        console.log("Property pattern:", patterns[field]);
        console.log("Property match:", match);
      }
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
};

// Ejecutar test
console.log("Testing Lodgify Parser...");
console.log("Raw email for debugging:");
console.log(testEmail);
console.log("\n--- Parsing ---");
const result = Parser.parseEmail(testEmail);
console.log("Result:", JSON.stringify(result, null, 2));

// Verificar campos críticos
console.log("\nVerification:");
console.log("Reservation Number:", result.reservationNumber);
console.log("Guest Name:", result.guestName);
console.log("Check In:", result.checkInDate);
console.log("Check Out:", result.checkOutDate);
console.log("Property:", result.Property);
console.log("Phone:", result.guestPhone);
console.log("Email:", result.guestEmail);
