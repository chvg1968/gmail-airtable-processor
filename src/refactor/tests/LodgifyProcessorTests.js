/* global Logger */

// === PRUEBAS UNITARIAS PARA LODGIFY PROCESSOR ===
// Casos específicos de procesamiento de emails de Lodgify

const { TestFramework, Assert } = require("./TestFramework");
const LodgifyProcessor = require("../processors/LodgifyProcessor");

function runLodgifyProcessorTests() {
  const test = new TestFramework();

  // === ¿QUÉ PASA SI... detectamos emails de Lodgify? ===

  test.test("¿Qué pasa si el email viene de lodgify.com?", () => {
    const result = LodgifyProcessor.isLodgifyEmail("noreply@lodgify.com");
    Assert.isTrue(result, "Debería detectar emails de lodgify.com");
  });

  test.test("¿Qué pasa si el email tiene 'Lodgify' en mayúsculas?", () => {
    const result = LodgifyProcessor.isLodgifyEmail("notifications@LODGIFY.com");
    Assert.isTrue(result, "Debería detectar Lodgify en mayúsculas");
  });

  test.test("¿Qué pasa si NO es de Lodgify?", () => {
    const result = LodgifyProcessor.isLodgifyEmail("user@airbnb.com");
    Assert.isFalse(result, "NO debería detectar emails que no son de Lodgify");
  });

  // === ¿QUÉ PASA SI... extraemos nombres de subjects? ===

  test.test("¿Qué pasa con 'New Confirmed Booking - John arrives Jan 15'?", () => {
    const subject = "New Confirmed Booking - John arrives Jan 15, 2024";
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(subject);
    Assert.equals(result, "John", "Debería extraer 'John' del subject");
  });

  test.test("¿Qué pasa con 'Reservation confirmed - Maria, arrives Dec 25'?", () => {
    const subject = "Reservation confirmed - Maria, arrives Dec 25, 2024";
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(subject);
    Assert.equals(result, "Maria", "Debería extraer 'Maria' del subject");
  });

  test.test("¿Qué pasa con 'Instant booking - Carlos arrives tomorrow'?", () => {
    const subject = "Instant booking - Carlos arrives tomorrow";
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(subject);
    Assert.equals(result, "Carlos", "Debería extraer 'Carlos' del subject");
  });

  test.test("¿Qué pasa si el subject no tiene el formato esperado?", () => {
    const subject = "Random email about something else";
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(subject);
    Assert.isNull(result, "Debería retornar null para subjects sin formato esperado");
  });

  test.test("¿Qué pasa si el subject es null?", () => {
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(null);
    Assert.isNull(result, "Debería manejar subject null");
  });

  // === ¿QUÉ PASA SI... extraemos fechas de subjects? ===

  test.test("¿Qué pasa con 'arrives Jan 15, 2024'?", () => {
    const subject = "New Confirmed Booking - John arrives Jan 15, 2024";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.equals(result, "2024-01-15", "Debería convertir 'Jan 15, 2024' a ISO");
  });

  test.test("¿Qué pasa con 'arrives December 25, 2024'?", () => {
    const subject = "Reservation confirmed - Maria arrives December 25, 2024";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.equals(result, "2024-12-25", "Debería convertir nombre completo del mes");
  });

  test.test("¿Qué pasa con formato sin coma 'arrives Feb 5 2024'?", () => {
    const subject = "Instant booking - Carlos arrives Feb 5 2024";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.equals(result, "2024-02-05", "Debería manejar formato sin coma");
  });

  test.test("¿Qué pasa si ya hay fecha en formato ISO en el subject?", () => {
    const subject = "Booking update for 2024-03-15 arrival";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.equals(result, "2024-03-15", "Debería detectar fecha ISO directamente");
  });

  test.test("¿Qué pasa si no hay fecha en el subject?", () => {
    const subject = "General booking inquiry";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.isNull(result, "Debería retornar null si no hay fecha");
  });

  // === ¿QUÉ PASA SI... validamos emails para procesamiento? ===

  test.test("¿Qué pasa con una confirmación válida de Lodgify?", () => {
    const result = LodgifyProcessor.shouldProcessLodgifyEmail(
      "noreply@lodgify.com",
      "New Confirmed Booking - John arrives Jan 15, 2024"
    );
    Assert.isTrue(result, "Debería procesar confirmación válida");
  });

  test.test("¿Qué pasa con 'Reservation confirmed' de Lodgify?", () => {
    const result = LodgifyProcessor.shouldProcessLodgifyEmail(
      "noreply@lodgify.com", 
      "Reservation confirmed - Maria arrives Dec 25, 2024"
    );
    Assert.isTrue(result, "Debería procesar 'Reservation confirmed'");
  });

  test.test("¿Qué pasa con 'Instant booking' de Lodgify?", () => {
    const result = LodgifyProcessor.shouldProcessLodgifyEmail(
      "noreply@lodgify.com",
      "Instant booking - Carlos arrives tonight"
    );
    Assert.isTrue(result, "Debería procesar 'Instant booking'");
  });

  test.test("¿Qué pasa si es de Lodgify pero NO es confirmación?", () => {
    const result = LodgifyProcessor.shouldProcessLodgifyEmail(
      "noreply@lodgify.com",
      "Booking update for tomorrow"
    );
    Assert.isFalse(result, "NO debería procesar actualizaciones que no son confirmaciones");
  });

  test.test("¿Qué pasa si NO es de Lodgify?", () => {
    const result = LodgifyProcessor.shouldProcessLodgifyEmail(
      "noreply@airbnb.com",
      "New Confirmed Booking - John arrives Jan 15, 2024"
    );
    Assert.isFalse(result, "NO debería procesar emails que no son de Lodgify");
  });

  // === ¿QUÉ PASA SI... extraemos información completa? ===

  test.test("¿Qué pasa al extraer info completa de subject válido?", () => {
    const subject = "New Confirmed Booking - John arrives Jan 15, 2024";
    const result = LodgifyProcessor.extractLodgifyReservationInfo(subject);
    
    Assert.isNotNull(result, "Debería retornar objeto con información");
    Assert.equals(result.firstName, "John", "Debería extraer firstName correcto");
    Assert.equals(result.arrivalDate, "2024-01-15", "Debería extraer fecha correcta");
  });

  test.test("¿Qué pasa si falta el nombre en el subject?", () => {
    const subject = "New Confirmed Booking arrives Jan 15, 2024";
    const result = LodgifyProcessor.extractLodgifyReservationInfo(subject);
    Assert.isNull(result, "Debería retornar null si falta información");
  });

  test.test("¿Qué pasa si falta la fecha en el subject?", () => {
    const subject = "New Confirmed Booking - John arrives soon";
    const result = LodgifyProcessor.extractLodgifyReservationInfo(subject);
    Assert.isNull(result, "Debería retornar null si falta fecha");
  });

  // === ¿QUÉ PASA SI... validamos emails completos? ===

  test.test("¿Qué pasa al validar email completamente válido?", () => {
    const subject = "New Confirmed Booking - John arrives Jan 15, 2024";
    const result = LodgifyProcessor.validateLodgifyEmail(subject);
    
    Assert.isTrue(result.isValid, "Email debería ser válido");
    Assert.arrayLength(result.missingFields, 0, "No debería haber campos faltantes");
  });

  test.test("¿Qué pasa al validar email sin firstName?", () => {
    const subject = "New Confirmed Booking arrives Jan 15, 2024";
    const result = LodgifyProcessor.validateLodgifyEmail(subject);
    
    Assert.isFalse(result.isValid, "Email debería ser inválido");
    Assert.contains(result.missingFields.join(","), "firstName", "Debería reportar firstName faltante");
  });

  test.test("¿Qué pasa al validar email sin fecha?", () => {
    const subject = "New Confirmed Booking - John arrives soon";
    const result = LodgifyProcessor.validateLodgifyEmail(subject);
    
    Assert.isFalse(result.isValid, "Email debería ser inválido");
    Assert.contains(result.missingFields.join(","), "arrivalDate", "Debería reportar arrivalDate faltante");
  });

  // === ¿QUÉ PASA SI... procesamos emails completos? ===

  test.test("¿Qué pasa al procesar email válido de Lodgify?", () => {
    const result = LodgifyProcessor.processLodgifyEmail(
      "noreply@lodgify.com",
      "New Confirmed Booking - John arrives Jan 15, 2024",
      "Email body content here"
    );
    
    Assert.isNotNull(result, "Debería retornar objeto procesado");
    Assert.equals(result.platform, "Lodgify", "Debería identificar plataforma");
    Assert.equals(result.firstName, "John", "Debería extraer firstName");
    Assert.equals(result.arrivalDate, "2024-01-15", "Debería extraer fecha");
    Assert.hasProperty(result, "rawSubject", "Debería incluir subject original");
    Assert.hasProperty(result, "rawFrom", "Debería incluir from original");
    Assert.hasProperty(result, "rawBody", "Debería incluir body original");
  });

  test.test("¿Qué pasa al procesar email inválido?", () => {
    const result = LodgifyProcessor.processLodgifyEmail(
      "noreply@lodgify.com",
      "Random update message",
      "Email body"
    );
    
    Assert.isNull(result, "Debería retornar null para email inválido");
  });

  test.test("¿Qué pasa al procesar email que no es de Lodgify?", () => {
    const result = LodgifyProcessor.processLodgifyEmail(
      "noreply@airbnb.com",
      "New Confirmed Booking - John arrives Jan 15, 2024",
      "Email body"
    );
    
    Assert.isNull(result, "Debería retornar null para email que no es de Lodgify");
  });

  // Ejecutar pruebas
  test.runAll();
}

// === CASOS EDGE ESPECÍFICOS DE LODGIFY ===

function runLodgifyEdgeCases() {
  const test = new TestFramework();

  test.test("🏨 ¿Qué pasa con nombres compuestos como 'Jean-Pierre'?", () => {
    const subject = "New Confirmed Booking - Jean-Pierre arrives Jan 15, 2024";
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(subject);
    Assert.equals(result, "Jean-Pierre", "Debería manejar nombres con guión");
  });

  test.test("🏨 ¿Qué pasa con nombres con apostrofe como 'O'Connor'?", () => {
    const subject = "Reservation confirmed - O'Connor arrives Dec 25, 2024";
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(subject);
    Assert.equals(result, "O'Connor", "Debería manejar nombres con apostrofe");
  });

  test.test("🏨 ¿Qué pasa con fechas de febrero en año bisiesto?", () => {
    const subject = "Instant booking - Maria arrives Feb 29, 2024";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.equals(result, "2024-02-29", "Debería manejar año bisiesto");
  });

  test.test("🏨 ¿Qué pasa con fechas de febrero 29 en año NO bisiesto?", () => {
    const subject = "New Confirmed Booking - John arrives Feb 29, 2023";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    // Esta debería fallar en la validación de fecha
    Assert.isNull(result, "Debería rechazar Feb 29 en año no bisiesto");
  });

  test.test("🏨 ¿Qué pasa con abreviaciones de mes poco comunes?", () => {
    const subject = "Reservation confirmed - Anna arrives Sept 15, 2024";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.equals(result, "2024-09-15", "Debería manejar 'Sept' como September");
  });

  test.test("🏨 ¿Qué pasa si el guest name tiene números?", () => {
    const subject = "New Confirmed Booking - User123 arrives Jan 15, 2024";
    const result = LodgifyProcessor.extractFirstNameFromLodgifySubject(subject);
    Assert.equals(result, "User123", "Debería manejar nombres con números");
  });

  test.test("🏨 ¿Qué pasa con fechas del año siguiente?", () => {
    const subject = "Instant booking - Future arrives Jan 1, 2026";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    Assert.equals(result, "2026-01-01", "Debería manejar fechas futuras");
  });

  test.test("🏨 ¿Qué pasa si hay múltiples patrones de fecha en el subject?", () => {
    const subject = "Booking from 2024-01-01 - John arrives Jan 15, 2024";
    const result = LodgifyProcessor.extractArrivalDateFromLodgifySubject(subject);
    // Debería preferir el patrón "arrives X"
    Assert.equals(result, "2024-01-15", "Debería preferir patrón 'arrives'");
  });

  test.runAll();
}

module.exports = {
  runLodgifyProcessorTests,
  runLodgifyEdgeCases
};
