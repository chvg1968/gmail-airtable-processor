/* global Logger */

// === PRUEBAS UNITARIAS PARA EMAIL FILTERS ===
// Explorando casos edge con la metodología "¿Qué pasa si...?"

const { TestFramework, Assert } = require("./TestFramework");
const EmailFilters = require("../filters/EmailFilters");

function runEmailFiltersTests() {
  const test = new TestFramework();

  // === ¿QUÉ PASA SI... recibimos emails de soporte? ===
  
  test.test("¿Qué pasa si llega un email de help@lodgify.com?", () => {
    const result = EmailFilters.shouldSkipSupportEmail(
      "help@lodgify.com",
      "There is an update for your request"
    );
    Assert.isTrue(result, "Debería omitir emails de help@lodgify.com");
  });

  test.test("¿Qué pasa si el email tiene 'How would you rate the support'?", () => {
    const result = EmailFilters.shouldSkipSupportEmail(
      "help@lodgify.com", 
      "How would you rate the support we provided?"
    );
    Assert.isTrue(result, "Debería omitir emails de rating de soporte");
  });

  test.test("¿Qué pasa si llega un email de cuenta de Airbnb?", () => {
    const result = EmailFilters.shouldSkipSupportEmail(
      "automated@airbnb.com",
      "Actividad de la cuenta - inicio de sesión detectado"
    );
    Assert.isTrue(result, "Debería omitir emails de actividad de cuenta");
  });

  // === ¿QUÉ PASA SI... llegan emails con casos edge de soporte? ===

  test.test("¿Qué pasa si el subject tiene 'RE: Lodgify'?", () => {
    const result = EmailFilters.isSupportOrUpdateEmail("RE: Lodgify - Update request");
    Assert.isTrue(result, "Debería identificar RE: Lodgify como soporte");
  });

  test.test("¿Qué pasa si hay un typo en 'Lodgify' como '[Lodgify]'?", () => {
    const result = EmailFilters.isSupportOrUpdateEmail("re: [lodgify] help request");
    Assert.isTrue(result, "Debería manejar [Lodgify] entre corchetes");
  });

  test.test("¿Qué pasa si el email dice 'unable to send'?", () => {
    const result = EmailFilters.isSupportOrUpdateEmail("Unable to send notification");
    Assert.isTrue(result, "Debería omitir emails de errores de envío");
  });

  // === ¿QUÉ PASA SI... hay emails que NO son reservas? ===

  test.test("¿Qué pasa si alguien hace una 'question' sobre la propiedad?", () => {
    const result = EmailFilters.isNonReservationEmail("Guest question about amenities");
    Assert.isTrue(result, "Debería omitir preguntas generales");
  });

  test.test("¿Qué pasa si es una 'inquiry' pero menciona 'reservation'?", () => {
    const result = EmailFilters.isNonReservationEmail("Inquiry about reservation policy");
    Assert.isFalse(result, "NO debería omitir si menciona reservation");
  });

  test.test("¿Qué pasa si es 'support' pero también 'booking confirmed'?", () => {
    const result = EmailFilters.isNonReservationEmail("Support: booking confirmed");
    Assert.isFalse(result, "NO debería omitir si menciona booking confirmed");
  });

  // === ¿QUÉ PASA SI... llegan emails reenviados problemáticos? ===

  test.test("¿Qué pasa si reenvían un email de Airbnb con 'FWD:'?", () => {
    const result = EmailFilters.shouldSkipForwardedEmail(
      "user@example.com",
      "FWD: Reservation confirmed - John arrives Jan 15"
    );
    Assert.isTrue(result, "Debería omitir FWD de confirmaciones");
  });

  test.test("¿Qué pasa si hay un número de reserva pero es FWD?", () => {
    const result = EmailFilters.shouldSkipForwardedEmail(
      "user@example.com",
      "FWD: Booking details #ABC123 for tonight"
    );
    Assert.isTrue(result, "Debería omitir FWD con números de reserva");
  });

  test.test("¿Qué pasa si es 'RE:' en lugar de 'FWD:'?", () => {
    const result = EmailFilters.shouldSkipForwardedEmail(
      "user@example.com", 
      "RE: Reservation #ABC123 question"
    );
    Assert.isTrue(result, "Debería omitir RE: con números de reserva");
  });

  // === ¿QUÉ PASA SI... llegan emails de Lodgify edge cases? ===

  test.test("¿Qué pasa si Lodgify envía algo que NO es 'New Confirmed Booking'?", () => {
    const result = EmailFilters.shouldSkipLodgifyEmail(
      "noreply@lodgify.com",
      "Booking update for tonight"
    );
    Assert.isTrue(result, "Debería omitir emails de Lodgify que no son confirmaciones");
  });

  test.test("¿Qué pasa si ES 'New Confirmed Booking' original?", () => {
    const result = EmailFilters.shouldSkipLodgifyEmail(
      "noreply@lodgify.com",
      "New Confirmed Booking - John arrives Jan 15"
    );
    Assert.isFalse(result, "NO debería omitir confirmaciones originales válidas");
  });

  test.test("¿Qué pasa si es 'Instant booking' de Lodgify?", () => {
    const result = EmailFilters.shouldSkipLodgifyEmail(
      "noreply@lodgify.com",
      "Instant booking - Sarah arrives tomorrow"
    );
    Assert.isFalse(result, "NO debería omitir instant bookings válidos");
  });

  // === ¿QUÉ PASA SI... usamos la función unificada? ===

  test.test("¿Qué pasa si aplicamos todos los filtros a un email válido?", () => {
    const result = EmailFilters.applyEmailFilters(
      "noreply@lodgify.com",
      "New Confirmed Booking - Maria arrives Dec 25"
    );
    Assert.isFalse(result.shouldSkip, "Email válido NO debería ser omitido");
    Assert.equals(result.reason, "", "No debería haber razón para omitir");
  });

  test.test("¿Qué pasa si aplicamos filtros a email de soporte?", () => {
    const result = EmailFilters.applyEmailFilters(
      "help@lodgify.com",
      "How would you rate our service?"
    );
    Assert.isTrue(result.shouldSkip, "Email de soporte debería ser omitido");
    Assert.equals(result.reason, "correo de soporte/seguridad", "Debería tener razón específica");
  });

  // === ¿QUÉ PASA SI... hay casos extremos de entrada? ===

  test.test("¿Qué pasa si 'from' es null?", () => {
    Assert.throws(() => {
      EmailFilters.shouldSkipSupportEmail(null, "Test subject");
    }, null, "Debería manejar 'from' null graciosamente");
  });

  test.test("¿Qué pasa si 'subject' es undefined?", () => {
    const result = EmailFilters.isSupportOrUpdateEmail(undefined);
    Assert.isFalse(result, "Debería manejar subject undefined");
  });

  test.test("¿Qué pasa si tanto 'from' como 'subject' están vacíos?", () => {
    const result = EmailFilters.applyEmailFilters("", "");
    Assert.isFalse(result.shouldSkip, "Strings vacíos NO deberían ser omitidos por defecto");
  });

  // === ¿QUÉ PASA SI... hay emails con caracteres especiales? ===

  test.test("¿Qué pasa si hay acentos en 'sesión'?", () => {
    const result = EmailFilters.shouldSkipSupportEmail(
      "automated@airbnb.com",
      "inicio de sesión desde nueva ubicación"
    );
    Assert.isTrue(result, "Debería manejar acentos en español");
  });

  test.test("¿Qué pasa si 'Check-in' tiene guión?", () => {
    const result = EmailFilters.shouldSkipSupportEmail(
      "propertymanagers.lodgify.com",
      "Check-in completed for tonight"
    );
    Assert.isTrue(result, "Debería manejar 'Check-in' con guión");
  });

  test.test("¿Qué pasa si es 'Checkin' sin guión?", () => {
    const result = EmailFilters.shouldSkipSupportEmail(
      "propertymanagers.lodgify.com", 
      "Checkin reminder for guest"
    );
    Assert.isTrue(result, "Debería manejar 'Checkin' sin guión");
  });

  // Ejecutar todas las pruebas
  test.runAll();
}

// === CASOS EDGE ADICIONALES ESPECÍFICOS ===

function runEdgeCaseTests() {
  const test = new TestFramework();

  test.test("🤔 ¿Qué pasa si un guest se llama 'Support'?", () => {
    // ¿Sería filtrado incorrectamente?
    const result = EmailFilters.applyEmailFilters(
      "noreply@lodgify.com",
      "New Confirmed Booking - Support arrives Jan 15"
    );
    Assert.isFalse(result.shouldSkip, "Guest llamado 'Support' NO debería ser filtrado");
  });

  test.test("🤔 ¿Qué pasa si el subject tiene 'Help' pero es una confirmación?", () => {
    const result = EmailFilters.applyEmailFilters(
      "noreply@lodgify.com", 
      "New Confirmed Booking - Help Center Guest arrives tonight"
    );
    Assert.isFalse(result.shouldSkip, "Confirmación con 'Help' en nombre NO debería ser filtrada");
  });

  test.test("🤔 ¿Qué pasa si hay 'FWD:' en el nombre del guest?", () => {
    const result = EmailFilters.shouldSkipForwardedEmail(
      "noreply@lodgify.com",
      "New Confirmed Booking - FWD Smith arrives tomorrow"
    );
    Assert.isFalse(result.shouldSkip, "'FWD' en nombre de guest NO debería activar filtro de reenvío");
  });

  test.test("🤔 ¿Qué pasa si un email es de múltiples categorías conflictivas?", () => {
    // Email que cumple múltiples criterios de filtrado
    const result = EmailFilters.applyEmailFilters(
      "help@lodgify.com",
      "FWD: RE: Support question about confirmed booking"
    );
    Assert.isTrue(result.shouldSkip, "Múltiples criterios deberían resultar en filtrado");
    Assert.contains(result.reason, "soporte", "Razón debería mencionar soporte");
  });

  test.runAll();
}

module.exports = {
  runEmailFiltersTests,
  runEdgeCaseTests
};
