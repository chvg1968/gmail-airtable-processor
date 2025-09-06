/* global Logger */

// === EJEMPLO DE EJECUCIÓN DE PRUEBAS ===
// Script para demostrar cómo ejecutar las pruebas unitarias

const TestRunner = require("./TestRunner");

/**
 * Función principal para ejecutar las pruebas
 * Esta función puede ser llamada desde Google Apps Script
 */
function ejecutarPruebas() {
  try {
    Logger.log("🎯 INICIANDO DEMOSTRACIÓN DE PRUEBAS UNITARIAS");
    Logger.log("═══════════════════════════════════════════════");
    
    // Mostrar menú disponible
    TestRunner.testMenu();
    
    Logger.log("\n🏃‍♂️ EJECUTANDO PRUEBAS DE REGRESIÓN...");
    TestRunner.runRegressionTests();
    
    Logger.log("\n🐛 PROBANDO ESCENARIO ESPECÍFICO DEL BUG...");
    TestRunner.testOriginalBugScenario();
    
    Logger.log("\n✅ DEMOSTRACIÓN COMPLETADA");
    
  } catch (error) {
    Logger.log("❌ ERROR EN DEMOSTRACIÓN: " + error.message);
    Logger.log("Stack: " + error.stack);
  }
}

/**
 * Ejecutar solo las pruebas más críticas
 */
function ejecutarPruebasRapidas() {
  try {
    Logger.log("⚡ EJECUTANDO PRUEBAS RÁPIDAS");
    TestRunner.runSmokeTests();
    Logger.log("✅ PRUEBAS RÁPIDAS COMPLETADAS");
  } catch (error) {
    Logger.log("❌ ERROR EN PRUEBAS RÁPIDAS: " + error.message);
  }
}

/**
 * Ejecutar suite completa de pruebas
 */
function ejecutarTodasLasPruebas() {
  try {
    Logger.log("🎯 EJECUTANDO SUITE COMPLETA");
    TestRunner.runAllTests();
    Logger.log("🎉 SUITE COMPLETA FINALIZADA");
  } catch (error) {
    Logger.log("❌ ERROR EN SUITE COMPLETA: " + error.message);
  }
}

/**
 * Función de desarrollo para probar casos específicos mientras desarrollamos
 */
function pruebasDeDesarrollo() {
  Logger.log("🔧 PRUEBAS DE DESARROLLO");
  
  // Aquí puedes agregar pruebas específicas mientras desarrollas
  const { TestFramework, Assert } = require("./TestFramework");
  const test = new TestFramework();
  
  test.test("Desarrollo: Verificar que los módulos se cargan correctamente", () => {
    const EmailFilters = require("../filters/EmailFilters");
    const DuplicateDetector = require("../duplicates/DuplicateDetector");
    const LodgifyProcessor = require("../processors/LodgifyProcessor");
    
    // Verificar que las funciones principales existen
    Assert.equals(typeof EmailFilters.applyEmailFilters, "function", "EmailFilters debe tener applyEmailFilters");
    Assert.equals(typeof DuplicateDetector.shouldSkipLodgifyDuplicate, "function", "DuplicateDetector debe tener shouldSkipLodgifyDuplicate");
    Assert.equals(typeof LodgifyProcessor.processLodgifyEmail, "function", "LodgifyProcessor debe tener processLodgifyEmail");
  });
  
  test.test("Desarrollo: Verificar integración básica", () => {
    const EmailFilters = require("../filters/EmailFilters");
    
    // Caso simple que debe funcionar
    const result = EmailFilters.applyEmailFilters(
      "noreply@lodgify.com",
      "New Confirmed Booking - Test arrives Jan 1, 2024"
    );
    
    Assert.isFalse(result.shouldSkip, "Email válido no debe ser omitido");
  });
  
  test.runAll();
}

// === CASOS DE PRUEBA INTERACTIVOS ===

/**
 * Función para que el usuario pueda probar escenarios específicos
 */
function probarEscenario(descripcion, emailFrom, emailSubject) {
  Logger.log(`\n🧪 PROBANDO ESCENARIO: ${descripcion}`);
  Logger.log(`📧 From: ${emailFrom}`);
  Logger.log(`📝 Subject: ${emailSubject}`);
  Logger.log("─".repeat(50));
  
  try {
    const EmailFilters = require("../filters/EmailFilters");
    const LodgifyProcessor = require("../processors/LodgifyProcessor");
    
    // 1. Verificar filtros
    const filterResult = EmailFilters.applyEmailFilters(emailFrom, emailSubject);
    Logger.log(`🔍 Filtros: ${filterResult.shouldSkip ? '❌ OMITIDO' : '✅ PROCESADO'}`);
    if (filterResult.shouldSkip) {
      Logger.log(`   Razón: ${filterResult.reason}`);
      return;
    }
    
    // 2. Verificar si Lodgify debe procesarlo
    if (LodgifyProcessor.isLodgifyEmail(emailFrom)) {
      const shouldProcess = LodgifyProcessor.shouldProcessLodgifyEmail(emailFrom, emailSubject);
      Logger.log(`🏨 Lodgify: ${shouldProcess ? '✅ PROCESAR' : '❌ OMITIR'}`);
      
      if (shouldProcess) {
        const info = LodgifyProcessor.extractLodgifyReservationInfo(emailSubject);
        if (info) {
          Logger.log(`   👤 Guest: ${info.firstName}`);
          Logger.log(`   📅 Arrival: ${info.arrivalDate}`);
        } else {
          Logger.log(`   ⚠️ No se pudo extraer información`);
        }
      }
    }
    
    Logger.log("✅ Escenario completado");
    
  } catch (error) {
    Logger.log(`❌ ERROR en escenario: ${error.message}`);
  }
}

/**
 * Ejemplos de uso de la función probarEscenario
 */
function ejemplosDeEscenarios() {
  Logger.log("📚 EJEMPLOS DE ESCENARIOS PARA PROBAR");
  Logger.log("═══════════════════════════════════════");
  
  // Escenario 1: Email válido de Lodgify
  probarEscenario(
    "Email válido de confirmación de Lodgify",
    "noreply@lodgify.com",
    "New Confirmed Booking - John arrives Dec 25, 2024"
  );
  
  // Escenario 2: Email de soporte que debe ser omitido
  probarEscenario(
    "Email de soporte que debe ser omitido",
    "help@lodgify.com",
    "How would you rate our support?"
  );
  
  // Escenario 3: Email reenviado que debe ser omitido
  probarEscenario(
    "Email reenviado que debe ser omitido",
    "user@example.com",
    "FWD: Reservation confirmed - John arrives Jan 15"
  );
  
  // Escenario 4: Email de Lodgify pero no confirmación
  probarEscenario(
    "Email de Lodgify que no es confirmación",
    "noreply@lodgify.com",
    "Booking update for tonight"
  );
}

// Exportar funciones para uso en Google Apps Script
module.exports = {
  ejecutarPruebas,
  ejecutarPruebasRapidas,
  ejecutarTodasLasPruebas,
  pruebasDeDesarrollo,
  probarEscenario,
  ejemplosDeEscenarios
};
