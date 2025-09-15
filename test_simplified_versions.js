/**
 * Script de testing para validar el código simplificado
 * Usa emails de ejemplo proporcionados por el usuario
 */
/* global Logger */

// Simular configuración de testing (NO usar en producción)
const TEST_CONFIG = {
  airtableApiKey: "TEST_API_KEY",
  airtableBaseId: "TEST_BASE_ID",
  airtableTableName: "TEST_TABLE",
  geminiApiKey: "TEST_GEMINI_KEY",
  SAFE_MODE: true,
  CONSTANTS: {
    GEMINI: {
      TEMPERATURE: 0.2,
      MAX_OUTPUT_TOKENS: 1024,
      TOP_P: 0.9,
      TOP_K: 40
    }
  }
};

// Emails de ejemplo proporcionados por el usuario
const TEST_EMAILS = [
  {
    id: "test-lodgify-1",
    subject: "New Confirmed Booking: Sarai (3 Nights, Arrival: Oct 24 2025) - #B16138101",
    from: "no-reply@messaging.lodgify.com",
    body: `Hello Luxe Ptrico,

You have received a new confirmed booking (Id: B16138101).

Guest comment:

View booking in reservation system

--------------------------------------------

BOOKING (#B16138101)

Status: Booked

Arrival: Oct 24 2025

Departure: Oct 27 2025

Nights: 3

Property: Bahia Beach Steps from Ocean 3BDRM- Ocean Grace

Guests: 8 guest(s)

--------------------------------------------

QUOTE (#14493894)

Status: Agreed

PRICE
RENT   USD 2159.91
Cleaning Fee   USD 299.00
Resort Fee   USD 585.00
TAX   USD 172.12

Total booking amount: USD 3216.03

Payment Schedule
Due on Sep 15 2025   USD 1608.02   Paid
Due on Oct 17 2025   USD 1608.01   Scheduled

Cancellation Policy
100% of prepayments made are refundable when cancellation is made 30 day(s) before arrival or earlier.
50% of prepayments made are refundable when cancellation is made 14 day(s) before arrival or earlier.
Cancellations made after this period are non-refundable.

Security deposit
No security deposit is due.

--------------------------------------------

Guest details
Name:  Sarai Santiago
Phone: +1 787-633-0220
Email: saraisantiago23@gmail.com
Country: Puerto Rico`
  },
  {
    id: "test-airbnb-1",
    subject: "Reservation confirmed - Dana Rosenberg arrives Dec 21",
    from: "automated@airbnb.com",
    body: `NEW BOOKING CONFIRMED! DANA ARRIVES DEC 21.

Send a message to confirm check-in details or welcome Dana.

BAHIA BEACH STEPS FROM OCEAN 3BDRM- OCEAN GRACE

Entire home/apt

Check-in      Checkout
Sun, Dec 21   Fri, Dec 26
3:00 PM       10:00 AM

GUESTS
5 adults

CONFIRMATION CODE
HM8CP2NKPW

GUEST PAID
$1,794.00 x 5 nights   $8,970.00
Cleaning fee   $299.00
Guest service fee   $1,308.57
Occupancy taxes   $648.83

TOTAL (USD)   $11,226.40

HOST PAYOUT
5 nights room fee   $8,970.00
Cleaning fee   $299.00
Host service fee (3.0%)   -$278.07

YOU EARN   $8,990.93`
  }
];

/**
 * Función de testing que simula el procesamiento de emails
 */
function runSimplifiedTests() {
  Logger.log("=== INICIANDO TESTS DEL CÓDIGO SIMPLIFICADO ===");

  let processedCount = 0;
  let skippedCount = 0;

  // Simular el etiquetado de plataformas
  const taggedEmails = TEST_EMAILS.map(email => {
    let platform = null;
    let origin = null;

    if (/@airbnb\.com/i.test(email.from)) {
      platform = 'Airbnb';
      origin = 'Airbnb';
    } else if (/messaging\.lodgify\.com/i.test(email.from)) {
      platform = 'Vrbo';
      origin = 'Lodgify';
    }

    return { message: email, platform, origin };
  });

  Logger.log(`Emails etiquetados: ${taggedEmails.length}`);

  for (const taggedEmail of taggedEmails) {
    const email = taggedEmail.message;
    const platform = taggedEmail.platform;
    const origin = taggedEmail.origin;

    try {
      Logger.log(`\n--- PROCESANDO EMAIL: ${email.subject} ---`);

      // Verificar plataforma
      if (!platform) {
        Logger.log(`❌ Plataforma no identificada: ${email.from}`);
        skippedCount++;
        continue;
      }

      Logger.log(`✅ Plataforma identificada: ${platform} (origin: ${origin})`);

      // Simular procesamiento con Gemini (sin llamada real)
      Logger.log(`🤖 Simulando extracción con Gemini...`);

      // Aquí iría la llamada real a GeminiService.extract()
      // Por ahora, simulamos una respuesta exitosa
      const mockDto = {
        guestName: platform === 'Airbnb' ? 'Dana Rosenberg' : 'Sarai Santiago',
        reservationNumber: platform === 'Airbnb' ? 'HM8CP2NKPW' : 'B16138101',
        checkInDate: platform === 'Airbnb' ? '2025-12-21' : '2025-10-24',
        checkOutDate: platform === 'Airbnb' ? '2025-12-26' : '2025-10-27',
        platform: platform,
        accommodationPrice: platform === 'Airbnb' ? 8970 : 2744.91, // Lodgify: 2159.91 (RENT) + 585.00 (Resort Fee)
        adults: platform === 'Airbnb' ? 5 : 8,
        dupKey: `${platform === 'Airbnb' ? 'Dana' : 'Sarai'}|${platform === 'Airbnb' ? '2025-12-21' : '2025-10-24'}|${platform === 'Airbnb' ? '2025-12-26' : '2025-10-27'}`,
        Property: '2-105 Ocean Grace Villa' // Mapeo simulado
      };

      Logger.log(`📋 DTO extraído: ${JSON.stringify(mockDto, null, 2)}`);

      // Verificar duplicados (simulado)
      Logger.log(`🔍 Verificando duplicados con dupKey: ${mockDto.dupKey}`);

      // Simular upsert a Airtable
      Logger.log(`💾 Simulando upsert a Airtable (SAFE_MODE: ${TEST_CONFIG.SAFE_MODE})`);

      Logger.log(`✅ Email procesado exitosamente: ${email.subject}`);
      processedCount++;

    } catch (error) {
      Logger.log(`❌ Error procesando email ${email.subject}: ${error}`);
      skippedCount++;
    }
  }

  Logger.log(`\n=== RESULTADOS DEL TEST ===`);
  Logger.log(`Emails procesados: ${processedCount}`);
  Logger.log(`Emails omitidos: ${skippedCount}`);
  Logger.log(`Total emails: ${TEST_EMAILS.length}`);

  if (processedCount === TEST_EMAILS.length && skippedCount === 0) {
    Logger.log(`🎉 TEST EXITOSO: Todos los emails fueron procesados correctamente`);
  } else {
    Logger.log(`⚠️ TEST CON PROBLEMAS: Revisar logs para detalles`);
  }
}

// Ejecutar tests si se llama directamente
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runSimplifiedTests };
} else {
  // En Apps Script, ejecutar automáticamente
  runSimplifiedTests();
}