/* eslint-disable */
/* prettier-ignore-file */

/**
 * Tests básicos para EmailProcessor refactorizado
 * Asegura que la funcionalidad se preserva después de la refactorización
 */

// Mock básico de Logger para Node
global.Logger = { log: console.log };
global.console = console;

const { TestFramework, Assert } = require("./TestFramework");

/**
 * Tests de funcionalidad básica del EmailProcessor
 */
function runEmailProcessorTests() {
  const test = new TestFramework();

  test.test("EmailProcessor debe cargar sin errores", () => {
    const { EmailProcessor } = require("../core/EmailProcessor");
    Assert.isNotNull(EmailProcessor, "EmailProcessor debería estar disponible");
    
    const processor = new EmailProcessor();
    Assert.isNotNull(processor, "Se debería poder crear una instancia");
    Assert.equals(processor.processedCount, 0, "Contador inicial debe ser 0");
    Assert.equals(processor.skippedCount, 0, "Contador de omitidos inicial debe ser 0");
  });

  test.test("EmailProcessor debe manejar mensajes vacíos", () => {
    // Mock CONFIG
    global.CONFIG = {
      SAFE_MODE: true,
      CONSTANTS: {
        AIRTABLE: { DEFAULT_CHECKIN_TIME: "16:00:00Z" },
        DATE_REVIEW: { MAX_DAYS_AHEAD: 365 },
      }
    };

    // Mock EmailService
    global.EmailService = {
      fetch: () => [],
    };

        // Mock SimpleLogger
    global.SimpleLogger = {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {}
    };

    const { EmailProcessor } = require("../core/EmailProcessor");
    const processor = new EmailProcessor();
    
    // Esto debería funcionar sin errores
    const messages = processor.fetchMessages();
    Assert.arrayLength(messages, 0, "Debería retornar array vacío");
  });

  test.test("EmailProcessor debe clasificar mensajes por plataforma", () => {
    const { EmailProcessor } = require("../core/EmailProcessor");
    const processor = new EmailProcessor();

    // Mock de mensajes
    const messages = [
      {
        getFrom: () => "noreply@airbnb.com",
        getSubject: () => "Reservation confirmed - John arrives Dec 25",
      },
      {
        getFrom: () => "noreply@lodgify.com", 
        getSubject: () => "New Confirmed Booking - Jane arrives Jan 15",
      },
      {
        getFrom: () => "other@example.com",
        getSubject: () => "Random email",
      }
    ];

    const sorted = processor.sortMessagesByPlatform(messages);
    Assert.arrayLength(sorted, 3, "Debería mantener todos los mensajes");
    
    // Airbnb debería estar primero
    Assert.contains(
      sorted[0].getFrom(), 
      "airbnb", 
      "Primer mensaje debería ser de Airbnb"
    );
  });

  test.test("EmailProcessor debe detectar plataforma Airbnb correctamente", () => {
    const { EmailProcessor } = require("../core/EmailProcessor");
    const processor = new EmailProcessor();

    // Test casos positivos
    const isAirbnb1 = processor.isEmailFromPlatform(
      "noreply@airbnb.com", 
      "Reservation confirmed", 
      "airbnb"
    );
    Assert.isTrue(isAirbnb1, "Debería detectar Airbnb por remitente");

    const isAirbnb2 = processor.isEmailFromPlatform(
      "other@domain.com", 
      "Airbnb reservation confirmed", 
      "airbnb"
    );
    Assert.isTrue(isAirbnb2, "Debería detectar Airbnb por asunto");

    // Test caso negativo
    const isNotAirbnb = processor.isEmailFromPlatform(
      "other@domain.com", 
      "Random subject", 
      "airbnb"
    );
    Assert.isFalse(isNotAirbnb, "No debería detectar Airbnb en email random");
  });

  test.test("Main.js debe mantener compatibilidad", () => {
    // Asegurar que las funciones legacy siguen disponibles
    const MainNew = require("../Main");
    
    Assert.hasProperty(MainNew, "processEmails", "Función principal debe existir");
    Assert.hasProperty(MainNew, "processAirbnbEmail", "Función legacy debe existir");
    Assert.hasProperty(MainNew, "hasValidReservationData", "Función legacy debe existir");
    Assert.hasProperty(MainNew, "healthCheck", "Función healthCheck debe existir");

    // Test health check
    const health = MainNew.healthCheck();
    Assert.hasProperty(health, "EmailProcessor", "Health check debe reportar EmailProcessor");
    Assert.hasProperty(health, "environment", "Health check debe reportar environment");
    Assert.equals(health.environment, "Node.js", "Environment debería ser Node.js en tests");
  });

  test.runAll();
}

/**
 * Tests de regresión para asegurar que la funcionalidad crítica se mantiene
 */
function runRegressionTests() {
  const test = new TestFramework();

  test.test("REGRESIÓN: Funciones legacy deben seguir funcionando", () => {
    // Test de SharedUtils (usado por funciones legacy)
    const { SharedUtils } = require("../shared/SharedUtils");
    
    const testDto = {
      guestName: "John Smith",
      checkInDate: "2024-12-25",
      checkOutDate: "2024-12-28"
    };

    const isValid = SharedUtils.hasValidReservationData(testDto);
    Assert.isTrue(isValid, "SharedUtils debe validar DTO correctamente");

    const key = SharedUtils.createReservationKey(testDto);
    Assert.contains(key, "John Smith", "Key debe contener nombre del huésped");
    Assert.contains(key, "2024-12-25", "Key debe contener fecha de llegada");
  });

  test.test("REGRESIÓN: Constants deben estar disponibles", () => {
    const { CONSTANTS } = require("../shared/Constants");
    
    Assert.hasProperty(CONSTANTS, "PLATFORMS", "Debe tener plataformas definidas");
    Assert.hasProperty(CONSTANTS.PLATFORMS, "AIRBNB", "Debe tener Airbnb definido");
    Assert.hasProperty(CONSTANTS.PLATFORMS, "LODGIFY", "Debe tener Lodgify definido");
    Assert.hasProperty(CONSTANTS, "LOGGING", "Debe tener niveles de logging");
  });

  test.test("REGRESIÓN: EmailFilters debe funcionar igual", () => {
    const EmailFilters = require("../filters/EmailFilters");
    
    // Test caso que debe ser omitido
    const result1 = EmailFilters.applyEmailFilters(
      "help@lodgify.com", 
      "Support ticket #123"
    );
    Assert.isTrue(result1.shouldSkip, "Debe omitir correos de soporte");

    // Test caso que NO debe ser omitido 
    const result2 = EmailFilters.applyEmailFilters(
      "noreply@lodgify.com",
      "New Confirmed Booking - John arrives Dec 25"
    );
    Assert.isFalse(result2.shouldSkip, "NO debe omitir confirmaciones válidas");
  });

  test.runAll();
}

/**
 * Tests de integración que verifican que todo el sistema funciona junto
 */
function runIntegrationTests() {
  const test = new TestFramework();

  test.test("INTEGRACIÓN: Main.js con mocks completos", () => {
    // Setup completo de mocks
    global.CONFIG = {
      SAFE_MODE: true,
      CONSTANTS: {
        AIRTABLE: { DEFAULT_CHECKIN_TIME: "16:00:00Z" },
        DATE_REVIEW: { MAX_DAYS_AHEAD: 365 },
      }
    };

    global.EmailService = {
      fetch: () => [],
      getCleanBody: () => "",
    };

    global.AirtableService = {
      isMessageProcessed: () => false,
      getReservations: () => [],
      createReservation: () => true,
    };

    global.SimpleLogger = {
      info: () => {},
      error: () => {},
      airtableOperation: () => {},
    };

    const MainNew = require("../Main");
    
    // Test que no falle la ejecución básica
    const result = MainNew.processEmails();
    Assert.isNotNull(result, "processEmails debería retornar resultado");
  });

  test.runAll();
}

/**
 * Suite completa de tests para EmailProcessor refactorizado
 */
function runFullTestSuite() {
  console.log("🧪 EJECUTANDO SUITE COMPLETA DE TESTS - EmailProcessor");
  console.log("=" .repeat(60));

  try {
    console.log("\n📋 TESTS BÁSICOS DE EmailProcessor");
    console.log("-".repeat(40));
    runEmailProcessorTests();

    console.log("\n🐛 TESTS DE REGRESIÓN");
    console.log("-".repeat(40));
    runRegressionTests();

    console.log("\n🧩 TESTS DE INTEGRACIÓN");
    console.log("-".repeat(40));
    runIntegrationTests();

    console.log("\n" + "=".repeat(60));
    console.log("✅ SUITE DE TESTS COMPLETADA EXITOSAMENTE");
    console.log("=".repeat(60));

  } catch (error) {
    console.log("\n" + "=".repeat(60));
    console.log("❌ ERROR CRÍTICO EN SUITE DE TESTS:");
    console.log(error.message);
    console.log("Stack trace:", error.stack);
    console.log("=".repeat(60));
    throw error;
  }
}

module.exports = {
  runEmailProcessorTests,
  runRegressionTests, 
  runIntegrationTests,
  runFullTestSuite,
};
