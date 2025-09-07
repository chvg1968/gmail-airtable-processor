/* eslint-disable */
/* prettier-ignore-file */
/* global Logger */

// === SUITE PRINCIPAL DE PRUEBAS UNITARIAS ===
// Runner para ejecutar todas las pruebas del sistema refactorizado

const EmailFiltersTests = require("./EmailFiltersTests");
const DuplicateDetectorTests = require("./DuplicateDetectorTests");
const SharedUtilsTests = require("./SharedUtilsTests");
const RealEmailPatternsTest = require("./RealEmailPatternsTest");
const OptimizedPatternsIntegrationTest = require("./OptimizedPatternsIntegrationTest");
const CompleteIntegrationTests = require("./CompleteIntegrationTests");
const EndToEndFlowTests = require("./EndToEndFlowTests");
const MasterIntegrationSuite = require("./MasterIntegrationSuite");

/**
 * Ejecuta todas las suites de pruebas
 */
function runAllTests() {
  Logger.log("🚀 INICIANDO SUITE COMPLETA DE PRUEBAS UNITARIAS");
  Logger.log("📅 Fecha: " + new Date().toISOString());
  Logger.log("═".repeat(60));

  try {
    // === PRUEBAS DE EMAIL FILTERS ===
    Logger.log("\n📧 EJECUTANDO PRUEBAS DE EMAIL FILTERS");
    Logger.log("─".repeat(40));
    EmailFiltersTests.runEmailFiltersTests();
    
    Logger.log("\n🔍 EJECUTANDO CASOS EDGE DE EMAIL FILTERS");
    Logger.log("─".repeat(40));
    EmailFiltersTests.runEdgeCaseTests();

    // === PRUEBAS DE DUPLICATE DETECTOR ===
    Logger.log("\n🔄 EJECUTANDO PRUEBAS DE DUPLICATE DETECTOR");
    Logger.log("─".repeat(40));
    DuplicateDetectorTests.runDuplicateDetectorTests();
    
    Logger.log("\n⚠️  EJECUTANDO CASOS EXTREMOS DE DUPLICATE DETECTOR");
    Logger.log("─".repeat(40));
    DuplicateDetectorTests.runExtremeEdgeCases();

  // === PRUEBAS DE SHARED UTILS ===
  Logger.log("\n🧰 EJECUTANDO PRUEBAS DE SHARED UTILS");
  Logger.log("─".repeat(40));
  SharedUtilsTests.runSharedUtilsTests();

  // === PRUEBAS DE PATRONES REALES OPTIMIZADOS ===
  Logger.log("\n🎯 EJECUTANDO PRUEBAS DE PATRONES REALES");
  Logger.log("─".repeat(40));
  RealEmailPatternsTest.runRealEmailPatternsTest();

  Logger.log("\n🚀 EJECUTANDO PRUEBAS DE INTEGRACIÓN OPTIMIZADA");
  Logger.log("─".repeat(40));
  OptimizedPatternsIntegrationTest.runSimpleEmailProcessorIntegrationTest();

  // === PRUEBAS DE INTEGRACIÓN COMPLETA (PASO 9) ===
  Logger.log("\n🎯 EJECUTANDO MASTER INTEGRATION SUITE");
  Logger.log("─".repeat(40));
  MasterIntegrationSuite.runMasterIntegrationSuite();

    Logger.log("\n" + "═".repeat(60));
    Logger.log("✅ SUITE DE PRUEBAS COMPLETADA EXITOSAMENTE");
    Logger.log("═".repeat(60));

  } catch (error) {
    Logger.log("\n" + "═".repeat(60));
    Logger.log("❌ ERROR CRÍTICO EN SUITE DE PRUEBAS:");
    Logger.log(error.message);
    Logger.log("Stack trace: " + error.stack);
    Logger.log("═".repeat(60));
    throw error;
  }
}

/**
 * Ejecuta solo pruebas básicas (smoke tests)
 */
function runSmokeTests() {
  Logger.log("💨 EJECUTANDO SMOKE TESTS BÁSICOS");
  Logger.log("─".repeat(30));

  try {
    // Solo las funciones más críticas
    EmailFiltersTests.runEmailFiltersTests();
    DuplicateDetectorTests.runDuplicateDetectorTests();
    LodgifyProcessorTests.runLodgifyProcessorTests();
  SharedUtilsTests.runSharedUtilsTests();
    
    Logger.log("✅ SMOKE TESTS COMPLETADOS");
  } catch (error) {
    Logger.log("❌ SMOKE TESTS FALLARON: " + error.message);
    throw error;
  }
}

/**
 * Ejecuta pruebas enfocadas en casos específicos mencionados en el bug original
 */
function runRegressionTests() {
  Logger.log("🐛 EJECUTANDO PRUEBAS DE REGRESIÓN");
  Logger.log("Enfoque: Duplicados Lodgify vs Airbnb");
  Logger.log("─".repeat(40));

  const { TestFramework, Assert } = require("./TestFramework");
  const test = new TestFramework();

  // === CASO ORIGINAL DEL BUG ===
  test.test("🐛 REGRESIÓN: Lodgify no debería crear duplicado si Airbnb existe", () => {
    const DuplicateDetector = require("../duplicates/DuplicateDetector");
    
    // Simular reserva de Airbnb existente
    const existingAirbnbRecord = {
      fields: {
        "First Name": "John",
        "Check-in": "2024-12-25"
      }
    };

    // Nueva reserva de Lodgify con mismo guest/fecha
    const lodgifyReservation = {
      firstName: "John",
      arrivalDate: "2024-12-25"
    };

    const shouldSkip = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      [existingAirbnbRecord]
    );

    Assert.isTrue(shouldSkip, "Lodgify debería ser omitido cuando ya existe Airbnb");
  });

  test.test("🐛 REGRESIÓN: Caso con variaciones de nombre", () => {
    const DuplicateDetector = require("../duplicates/DuplicateDetector");
    
    const existingRecord = {
      fields: {
        "First Name": "JOHN SMITH",  // Mayúsculas
        "Check-in": "2024-12-25"
      }
    };

    const lodgifyReservation = {
      firstName: "john",  // Minúsculas, solo primer nombre
      arrivalDate: "2024-12-25"
    };

    const shouldSkip = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      [existingRecord]
    );

    Assert.isTrue(shouldSkip, "Debería detectar duplicado a pesar de variaciones en el nombre");
  });

  test.test("🐛 REGRESIÓN: EmailFilters debe permitir confirmaciones válidas", () => {
    const EmailFilters = require("../filters/EmailFilters");
    
    const result = EmailFilters.applyEmailFilters(
      "noreply@lodgify.com",
      "New Confirmed Booking - John arrives Dec 25, 2024"
    );

    Assert.isFalse(result.shouldSkip, "Confirmaciones válidas NO deben ser filtradas");
  });

  test.test("🐛 REGRESIÓN: LodgifyProcessor debe extraer datos correctos", () => {
    const LodgifyProcessor = require("../processors/LodgifyProcessor");
    
    const info = LodgifyProcessor.extractLodgifyReservationInfo(
      "New Confirmed Booking - John arrives Dec 25, 2024"
    );

    Assert.isNotNull(info, "Debe extraer información de subject válido");
    Assert.equals(info.firstName, "John", "Debe extraer firstName correcto");
    Assert.equals(info.arrivalDate, "2024-12-25", "Debe extraer fecha correcta");
  });

  test.runAll();
}

/**
 * Menu interactivo para ejecutar diferentes tipos de pruebas
 */
function testMenu() {
  Logger.log("🧪 MENU DE PRUEBAS UNITARIAS");
  Logger.log("════════════════════════════");
  Logger.log("Para ejecutar pruebas, llama a una de estas funciones:");
  Logger.log("");
  Logger.log("1. runAllTests()        - Suite completa de pruebas");
  Logger.log("2. runSmokeTests()      - Pruebas básicas rápidas");
  Logger.log("3. runRegressionTests() - Pruebas del bug original");
  Logger.log("");
  Logger.log("Ejemplo: runSmokeTests();");
}

// === CASOS DE PRUEBA ESPECÍFICOS PARA EL BUG REPORTADO ===

/**
 * Prueba del escenario exacto reportado en el bug
 */
function testOriginalBugScenario() {
  Logger.log("🔬 PROBANDO ESCENARIO EXACTO DEL BUG ORIGINAL");
  
  const { TestFramework, Assert } = require("./TestFramework");
  const test = new TestFramework();

  test.test("Escenario exacto: Lodgify después de Airbnb", () => {
    // Este es el escenario que causaba el problema original
    const EmailFilters = require("../filters/EmailFilters");
    const LodgifyProcessor = require("../processors/LodgifyProcessor");
    const DuplicateDetector = require("../duplicates/DuplicateDetector");

    // 1. Email de Airbnb llega primero
    const airbnbFrom = "noreply@airbnb.com";
    const airbnbSubject = "Reservation confirmed - John arrives Dec 25, 2024";
    
    const airbnbFilter = EmailFilters.applyEmailFilters(airbnbFrom, airbnbSubject);
    Assert.isFalse(airbnbFilter.shouldSkip, "Airbnb no debe ser filtrado");

    // 2. Simular que Airbnb se procesó y está en Airtable
    const existingAirbnbRecord = {
      fields: {
        "First Name": "John",
        "Check-in": "2024-12-25",
        "Platform": "Airbnb"
      }
    };

    // 3. Email de Lodgify llega después
    const lodgifyFrom = "noreply@lodgify.com";
    const lodgifySubject = "New Confirmed Booking - John arrives Dec 25, 2024";
    
    const lodgifyFilter = EmailFilters.applyEmailFilters(lodgifyFrom, lodgifySubject);
    Assert.isFalse(lodgifyFilter.shouldSkip, "Lodgify no debe ser filtrado por EmailFilters");

    // 4. Verificar que LodgifyProcessor puede procesar
    const shouldProcess = LodgifyProcessor.shouldProcessLodgifyEmail(lodgifyFrom, lodgifySubject);
    Assert.isTrue(shouldProcess, "LodgifyProcessor debe querer procesar");

    // 5. Extraer información de Lodgify
    const lodgifyInfo = LodgifyProcessor.extractLodgifyReservationInfo(lodgifySubject);
    Assert.isNotNull(lodgifyInfo, "Debe extraer información de Lodgify");

    // 6. AQUÍ ESTÁ LA CLAVE: DuplicateDetector debe detectar el duplicado
    const shouldSkipDuplicate = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyInfo,
      [existingAirbnbRecord]
    );
    
    Assert.isTrue(shouldSkipDuplicate, "🎯 CLAVE: Debe detectar y omitir duplicado de Lodgify");

    Logger.log("✅ Escenario del bug original: RESUELTO");
  });

  test.runAll();
}

module.exports = {
  runAllTests,
  runSmokeTests,
  runRegressionTests,
  testMenu,
  testOriginalBugScenario
};
