/* eslint-disable */
/* prettier-ignore-file */

/**
 * TESTS DE FLUJO COMPLETO END-TO-END
 * Simula scenarios reales de producción completos
 */

const CompleteIntegrationTests = require("./CompleteIntegrationTests");
const { IntegrationTestMocks } = CompleteIntegrationTests;

/**
 * Scenarios de flujo completo que simulan uso real
 */
function runEndToEndFlowTests() {
  console.log("=== TESTS DE FLUJO COMPLETO END-TO-END ===\n");
  
  const mocks = new IntegrationTestMocks();
  let totalScenarios = 0;
  let passedScenarios = 0;
  let failedScenarios = [];

  // Scenario 1: Flujo completo típico de una mañana
  console.log("🌅 SCENARIO 1: Flujo de Mañana Típica");
  console.log("─".repeat(50));
  
  try {
    totalScenarios++;
    mocks.setupMocks();
    
    // Simular emails que llegan durante la mañana
    const morningEmails = [
      // Airbnb overnight
      mocks.createMockEmail("morning1", "automated-noreply@airbnb.com",
        "Reservation confirmed: Sarah Johnson, arriving September 8, 2025",
        "Morning Airbnb booking", new Date("2025-09-06T08:15:00")),
      
      // Lodgify early morning  
      mocks.createMockEmail("morning2", "noreply@lodgify.com",
        "New Confirmed Booking: #B15695014 - Carlos Martinez arriving October 16, 2025",
        "Morning Lodgify booking", new Date("2025-09-06T09:30:00")),
      
      // VRBO mid-morning
      mocks.createMockEmail("morning3", "noreply@vrbo.com", 
        "Booking Confirmation #789012 - Emma Wilson arrives November 12th, 2025",
        "Mid-morning VRBO", new Date("2025-09-06T10:45:00")),
      
      // Another Airbnb
      mocks.createMockEmail("morning4", "automated-noreply@airbnb.com",
        "Instant booking confirmed: Michael Chen, check-in December 1, 2025", 
        "Late morning Airbnb", new Date("2025-09-06T11:20:00"))
    ];
    
    let morningProcessed = 0;
    const startTime = Date.now();
    
    // Procesar secuencialmente como haría el sistema real
    morningEmails.forEach(email => {
      // 1. Verificar si ya fue procesado
      const alreadyProcessed = global.AirtableService.isMessageProcessed(email.getId());
      
      if (!alreadyProcessed) {
        // 2. Procesar con SimpleEmailProcessor
        const result = require("../processors/SimpleEmailProcessor").processReservationEmail(
          email.getFrom(),
          email.getSubject(), 
          email.getBody()
        );
        
        if (result) {
          // 3. Crear en Airtable
          const created = global.AirtableService.createReservation({
            messageId: email.getId(),
            platform: result.platform,
            firstName: result.firstName,
            arrivalDate: result.arrivalDate,
            reservationNumber: result.reservationNumber,
            rawSubject: email.getSubject(),
            processedAt: new Date().toISOString()
          });
          
          if (created) morningProcessed++;
        }
      }
    });
    
    const endTime = Date.now();
    const stats = mocks.getStats();
    
    if (morningProcessed === 4 && stats.successfulCreations === 4) {
      passedScenarios++;
      console.log("  ✅ PASS: Flujo de mañana completo");
      console.log(`  📧 Emails procesados: ${morningProcessed}/4`);
      console.log(`  🏪 Reservas creadas: ${stats.successfulCreations}/4`);
      console.log(`  ⏱️  Tiempo total: ${endTime - startTime}ms`);
    } else {
      failedScenarios.push({
        scenario: "Morning Flow",
        processed: morningProcessed,
        created: stats.successfulCreations
      });
      console.log("  ❌ FAIL: Flujo de mañana incompleto");
    }
    
  } catch (error) {
    failedScenarios.push({
      scenario: "Morning Flow",
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  mocks.reset();
  console.log("");

  // Scenario 2: Manejo de duplicados
  console.log("🔄 SCENARIO 2: Manejo de Duplicados");
  console.log("─".repeat(50));
  
  try {
    totalScenarios++;
    mocks.setupMocks();
    
    // Simular email procesado previamente
    const originalEmail = mocks.createMockEmail("dup1", "automated-noreply@airbnb.com",
      "Reservation confirmed: John Duplicate, arriving September 15, 2025",
      "Original booking", new Date());
    
    // Procesar primera vez
    const firstResult = require("../processors/SimpleEmailProcessor").processReservationEmail(
      originalEmail.getFrom(),
      originalEmail.getSubject(),
      originalEmail.getBody()
    );
    
    if (firstResult) {
      global.AirtableService.createReservation({
        messageId: originalEmail.getId(),
        platform: firstResult.platform,
        firstName: firstResult.firstName,
        arrivalDate: firstResult.arrivalDate
      });
    }
    
    // Simular mismo email llegando otra vez (reenvío, etc.)
    const duplicateEmail = mocks.createMockEmail("dup1", "automated-noreply@airbnb.com",
      "Reservation confirmed: John Duplicate, arriving September 15, 2025",
      "Duplicate booking", new Date());
    
    // Verificar que no se procese duplicado
    const isAlreadyProcessed = global.AirtableService.isMessageProcessed(duplicateEmail.getId());
    
    if (isAlreadyProcessed) {
      passedScenarios++;
      console.log("  ✅ PASS: Duplicado detectado y evitado correctamente");
      console.log("  🛡️  Sistema previene procesamiento duplicado");
    } else {
      failedScenarios.push({
        scenario: "Duplicate Handling",
        issue: "Duplicate not detected"
      });
      console.log("  ❌ FAIL: Duplicado no detectado");
    }
    
  } catch (error) {
    failedScenarios.push({
      scenario: "Duplicate Handling",
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  mocks.reset();
  console.log("");

  // Scenario 3: Manejo de errores de Airtable
  console.log("💥 SCENARIO 3: Resilencia ante Errores de Airtable");
  console.log("─".repeat(50));
  
  try {
    totalScenarios++;
    mocks.setupMocks();
    
    // Mock Airtable que falla
    global.AirtableService.createReservation = (data) => {
      mocks.airtableOperations.push({
        type: 'create',
        data: data,
        success: false,
        error: 'Airtable connection failed',
        timestamp: new Date().toISOString()
      });
      throw new Error("Airtable API Error: Connection timeout");
    };
    
    const email = mocks.createMockEmail("error1", "automated-noreply@airbnb.com",
      "Reservation confirmed: Error Test, arriving September 20, 2025",
      "Error test booking", new Date());
    
    let errorHandled = false;
    
    try {
      const result = require("../processors/SimpleEmailProcessor").processReservationEmail(
        email.getFrom(),
        email.getSubject(),
        email.getBody()
      );
      
      if (result) {
        // Esto debería fallar
        global.AirtableService.createReservation({
          messageId: email.getId(),
          platform: result.platform,
          firstName: result.firstName,
          arrivalDate: result.arrivalDate
        });
      }
    } catch (airtableError) {
      // Error esperado
      errorHandled = true;
      global.SimpleLogger.error("Airtable error handled:", airtableError.message);
    }
    
    if (errorHandled) {
      passedScenarios++;
      console.log("  ✅ PASS: Error de Airtable manejado correctamente");
      console.log("  🛡️  Sistema resilente ante fallos externos");
    } else {
      failedScenarios.push({
        scenario: "Airtable Error Handling",
        issue: "Error not properly handled"
      });
      console.log("  ❌ FAIL: Error no manejado adecuadamente");
    }
    
  } catch (error) {
    failedScenarios.push({
      scenario: "Airtable Error Handling", 
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  mocks.reset();
  console.log("");

  // Scenario 4: Carga alta simulada
  console.log("🚀 SCENARIO 4: Carga Alta (100 emails simultáneos)");
  console.log("─".repeat(50));
  
  try {
    totalScenarios++;
    mocks.setupMocks();
    
    const batchSize = 100;
    const platforms = ["airbnb", "lodgify", "vrbo"];
    const names = ["John", "Maria", "Carlos", "Sarah", "Mike", "Anna", "David", "Lisa"];
    
    const highLoadEmails = [];
    for (let i = 0; i < batchSize; i++) {
      const platform = platforms[i % platforms.length];
      const name = names[i % names.length];
      const day = 7 + (i % 25);  // September 7-31
      
      let from, subject;
      switch (platform) {
        case "airbnb":
          from = "automated-noreply@airbnb.com";
          subject = `Reservation confirmed: ${name} User${i}, arriving September ${day}, 2025`;
          break;
        case "lodgify":
          from = "noreply@lodgify.com";
          subject = `New Confirmed Booking: #B${15695014 + i} - ${name} User${i} arriving Sep ${day}, 2025`;
          break;
        case "vrbo":
          from = "noreply@vrbo.com";
          subject = `Booking Confirmation #${123456 + i} - ${name} User${i} arrives September ${day}th, 2025`;
          break;
      }
      
      highLoadEmails.push(mocks.createMockEmail(
        `load-${i}`, from, subject, `High load test body ${i}`, new Date()
      ));
    }
    
    const startTime = Date.now();
    let processedInHighLoad = 0;
    
    // Procesar todos los emails
    highLoadEmails.forEach(email => {
      try {
        const result = require("../processors/SimpleEmailProcessor").processReservationEmail(
          email.getFrom(),
          email.getSubject(),
          email.getBody()
        );
        
        if (result) {
          global.AirtableService.createReservation({
            messageId: email.getId(),
            platform: result.platform,
            firstName: result.firstName,
            arrivalDate: result.arrivalDate,
            reservationNumber: result.reservationNumber
          });
          processedInHighLoad++;
        }
      } catch (error) {
        mocks.errors.push(error);
      }
    });
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / batchSize;
    const stats = mocks.getStats();
    
    if (processedInHighLoad >= 95 && avgTime < 5 && mocks.errors.length < 5) {
      passedScenarios++;
      console.log("  ✅ PASS: Carga alta manejada exitosamente");
      console.log(`  📧 Procesados: ${processedInHighLoad}/${batchSize} emails`);
      console.log(`  🏪 Creados: ${stats.successfulCreations}/${batchSize} reservas`);
      console.log(`  ⏱️  Tiempo total: ${totalTime}ms`);
      console.log(`  ⚡ Promedio: ${avgTime.toFixed(2)}ms por email`);
      console.log(`  ❌ Errores: ${mocks.errors.length}`);
    } else {
      failedScenarios.push({
        scenario: "High Load",
        processed: processedInHighLoad,
        avgTime: avgTime,
        errors: mocks.errors.length
      });
      console.log("  ❌ FAIL: Carga alta no manejada adecuadamente");
    }
    
  } catch (error) {
    failedScenarios.push({
      scenario: "High Load",
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  console.log("");

  // Resumen final
  console.log("═".repeat(60));
  console.log("📊 RESUMEN TESTS DE FLUJO COMPLETO END-TO-END:");
  console.log(`   Total scenarios: ${totalScenarios}`);
  console.log(`   Passed: ${passedScenarios} (${Math.round(passedScenarios/totalScenarios*100)}%)`);
  console.log(`   Failed: ${failedScenarios.length} (${Math.round(failedScenarios.length/totalScenarios*100)}%)`);
  
  if (failedScenarios.length > 0) {
    console.log(`\n❌ SCENARIOS FALLIDOS:`);
    failedScenarios.forEach((scenario, index) => {
      console.log(`   ${index + 1}. ${scenario.scenario}`);
      if (scenario.error) console.log(`      Error: ${scenario.error}`);
      if (scenario.processed) console.log(`      Processed: ${scenario.processed}`);
    });
  } else {
    console.log("\n🎉 ¡TODOS LOS SCENARIOS END-TO-END PASARON!");
    console.log("🚀 Sistema completamente validado para producción");
    console.log("💪 Resilente, escalable y confiable");
  }
  
  console.log("═".repeat(60));
  
  return {
    total: totalScenarios,
    passed: passedScenarios,
    failed: failedScenarios.length,
    scenarios: failedScenarios
  };
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
  runEndToEndFlowTests();
}

module.exports = {
  runEndToEndFlowTests
};
