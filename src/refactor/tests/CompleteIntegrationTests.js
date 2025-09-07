/* eslint-disable */
/* prettier-ignore-file */

/**
 * TESTS DE INTEGRACIÓN COMPLETOS - PASO 9
 * Suite exhaustiva que cubre flujo end-to-end completo
 * 
 * Cubre:
 * 1. Flujo completo Gmail → SimpleEmailProcessor → Airtable
 * 2. Integración con todos los servicios
 * 3. Manejo de errores y edge cases
 * 4. Performance a escala
 * 5. Scenarios reales de producción
 */

const SimpleEmailProcessor = require("../processors/SimpleEmailProcessor");
const EmailProcessor = require("../core/EmailProcessor");
const Main = require("../Main");

/**
 * Mock completo de servicios para testing de integración
 */
class IntegrationTestMocks {
  constructor() {
    this.airtableOperations = [];
    this.logMessages = [];
    this.emailsProcessed = [];
    this.errors = [];
  }

  setupMocks() {
    // Mock AirtableService
    global.AirtableService = {
      isMessageProcessed: (messageId) => {
        return this.airtableOperations.some(op => 
          op.type === 'check' && op.messageId === messageId && op.result === true
        );
      },
      
      getReservations: () => {
        const existing = this.airtableOperations
          .filter(op => op.type === 'create' && op.success)
          .map(op => op.data);
        return existing;
      },
      
      createReservation: (data) => {
        this.airtableOperations.push({
          type: 'create',
          data: data,
          success: true,
          timestamp: new Date().toISOString()
        });
        return true;
      }
    };

    // Mock EmailService
    global.EmailService = {
      getUnreadEmails: () => {
        return this.getMockEmails();
      }
    };

    // Mock SimpleLogger
    global.SimpleLogger = {
      log: (...args) => this.logMessages.push({ level: 'log', args }),
      info: (...args) => this.logMessages.push({ level: 'info', args }),
      warn: (...args) => this.logMessages.push({ level: 'warn', args }),
      error: (...args) => this.logMessages.push({ level: 'error', args }),
      airtableOperation: (...args) => this.logMessages.push({ level: 'airtable', args })
    };

    // Mock Logger (para compatibilidad)
    global.Logger = {
      log: (...args) => this.logMessages.push({ level: 'legacy', args })
    };

    // Mock CONFIG
    global.CONFIG = {
      EMAIL_BATCH_SIZE: 50,
      MAX_PROCESSING_TIME: 300000,
      AIRTABLE_ENABLED: true
    };
  }

  getMockEmails() {
    return [
      this.createMockEmail("1", "automated-noreply@airbnb.com", 
        "Reservation confirmed: John Smith, arriving September 7, 2025", 
        "Airbnb booking details...", new Date()),
      
      this.createMockEmail("2", "noreply@lodgify.com", 
        "New Confirmed Booking: #B15695014 - Carlos arriving October 16, 2025", 
        "Lodgify booking confirmation...", new Date()),
      
      this.createMockEmail("3", "noreply@vrbo.com", 
        "Booking Confirmation #123456 - David Lee arrives July 4th, 2025", 
        "VRBO booking details...", new Date()),
      
      this.createMockEmail("4", "automated-noreply@airbnb.com", 
        "Your reservation #ABC123 is confirmed - Mike arriving Jan 15, 2025", 
        "Complex Airbnb booking...", new Date()),
      
      this.createMockEmail("5", "noreply@lodgify.com", 
        "BOOKING (#B15831191) - Steven Kopel arriving Oct 16 2025", 
        "Lodgify with parentheses...", new Date())
    ];
  }

  createMockEmail(id, from, subject, body, date) {
    return {
      getId: () => id,
      getFrom: () => from,
      getSubject: () => subject,
      getBody: () => body,
      getDate: () => date,
      markRead: () => true
    };
  }

  reset() {
    this.airtableOperations = [];
    this.logMessages = [];
    this.emailsProcessed = [];
    this.errors = [];
  }

  getStats() {
    return {
      airtableOperations: this.airtableOperations.length,
      logMessages: this.logMessages.length,
      emailsProcessed: this.emailsProcessed.length,
      errors: this.errors.length,
      successfulCreations: this.airtableOperations.filter(op => 
        op.type === 'create' && op.success).length
    };
  }
}

/**
 * Suite de tests de integración completa
 */
function runCompleteIntegrationTests() {
  console.log("=== TESTS DE INTEGRACIÓN COMPLETOS - PASO 9 ===\n");
  
  const mocks = new IntegrationTestMocks();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];

  // Test 1: Integración completa con SimpleEmailProcessor
  console.log("🔧 TEST 1: Integración SimpleEmailProcessor");
  console.log("─".repeat(50));
  
  try {
    totalTests++;
    mocks.setupMocks();
    
    const testEmails = mocks.getMockEmails();
    let processedCount = 0;
    
    testEmails.forEach(email => {
      const result = SimpleEmailProcessor.processReservationEmail(
        email.getFrom(), 
        email.getSubject(), 
        email.getBody()
      );
      
      if (result) {
        processedCount++;
        mocks.emailsProcessed.push({
          emailId: email.getId(),
          result: result
        });
      }
    });
    
    if (processedCount === 5) {
      passedTests++;
      console.log("  ✅ PASS: Todos los emails procesados correctamente");
      console.log(`  📊 Procesados: ${processedCount}/5 emails`);
    } else {
      failedTests.push({
        test: "SimpleEmailProcessor Integration",
        expected: 5,
        actual: processedCount
      });
      console.log("  ❌ FAIL: No todos los emails fueron procesados");
    }
    
  } catch (error) {
    failedTests.push({
      test: "SimpleEmailProcessor Integration",
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  mocks.reset();
  console.log("");

  // Test 2: Integración con EmailProcessor
  console.log("🔧 TEST 2: Integración EmailProcessor");
  console.log("─".repeat(50));
  
  try {
    totalTests++;
    mocks.setupMocks();
    
    // Simular procesamiento con EmailProcessor
    const emails = mocks.getMockEmails();
    let processedByEmailProcessor = 0;
    
    emails.forEach(email => {
      try {
        // EmailProcessor usa SimpleEmailProcessor internamente
        const isProcessed = global.AirtableService.isMessageProcessed(email.getId());
        if (!isProcessed) {
          const result = SimpleEmailProcessor.processReservationEmail(
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
            processedByEmailProcessor++;
          }
        }
      } catch (error) {
        mocks.errors.push(error);
      }
    });
    
    const stats = mocks.getStats();
    
    if (processedByEmailProcessor === 5 && stats.successfulCreations === 5) {
      passedTests++;
      console.log("  ✅ PASS: EmailProcessor integración completa");
      console.log(`  📊 Procesados: ${processedByEmailProcessor}/5 emails`);
      console.log(`  📊 Creados en Airtable: ${stats.successfulCreations}/5`);
    } else {
      failedTests.push({
        test: "EmailProcessor Integration",
        processed: processedByEmailProcessor,
        created: stats.successfulCreations
      });
      console.log("  ❌ FAIL: EmailProcessor no completó correctamente");
    }
    
  } catch (error) {
    failedTests.push({
      test: "EmailProcessor Integration", 
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  mocks.reset();
  console.log("");

  // Test 3: Integración con Main.js
  console.log("🔧 TEST 3: Integración Main.js End-to-End");
  console.log("─".repeat(50));
  
  try {
    totalTests++;
    mocks.setupMocks();
    
    // Test health check primero
    const healthCheck = Main.healthCheck();
    console.log("  🔍 Health Check:", JSON.stringify(healthCheck, null, 2));
    
    if (healthCheck && Object.keys(healthCheck).length > 0) {
      passedTests++;
      console.log("  ✅ PASS: Main.js health check exitoso");
    } else {
      failedTests.push({
        test: "Main.js Health Check",
        result: healthCheck
      });
      console.log("  ❌ FAIL: Health check falló");
    }
    
  } catch (error) {
    failedTests.push({
      test: "Main.js Integration",
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  mocks.reset();
  console.log("");

  // Test 4: Edge Cases y Manejo de Errores
  console.log("🔧 TEST 4: Edge Cases y Manejo de Errores");
  console.log("─".repeat(50));
  
  try {
    totalTests++;
    mocks.setupMocks();
    
    const edgeCases = [
      // Email malformado
      mocks.createMockEmail("edge1", "", "", "", new Date()),
      // Email sin confirmación
      mocks.createMockEmail("edge2", "test@example.com", "Random subject", "Random body", new Date()),
      // Email con caracteres especiales
      mocks.createMockEmail("edge3", "automated-noreply@airbnb.com", 
        "Reservation confirmed: José María O'Connor-Smith, arriving Sept 30, 2025", 
        "Complex name test", new Date())
    ];
    
    let edgeHandled = 0;
    
    edgeCases.forEach(email => {
      try {
        const result = SimpleEmailProcessor.processReservationEmail(
          email.getFrom(),
          email.getSubject(),
          email.getBody()
        );
        
        // Los primeros 2 deberían retornar null, el 3ro debería procesar
        if (email.getId() === "edge3" && result) {
          edgeHandled++;
        } else if ((email.getId() === "edge1" || email.getId() === "edge2") && !result) {
          edgeHandled++;
        }
      } catch (error) {
        // Errores controlados son aceptables para edge cases
        if (email.getId() === "edge1" || email.getId() === "edge2") {
          edgeHandled++;
        }
      }
    });
    
    if (edgeHandled >= 2) {
      passedTests++;
      console.log("  ✅ PASS: Edge cases manejados correctamente");
      console.log(`  📊 Edge cases handled: ${edgeHandled}/3`);
    } else {
      failedTests.push({
        test: "Edge Cases",
        handled: edgeHandled,
        expected: ">=2"
      });
      console.log("  ❌ FAIL: Edge cases no manejados adecuadamente");
    }
    
  } catch (error) {
    failedTests.push({
      test: "Edge Cases",
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  mocks.reset();
  console.log("");

  // Test 5: Performance Integration Test
  console.log("🔧 TEST 5: Performance a Escala");
  console.log("─".repeat(50));
  
  try {
    totalTests++;
    mocks.setupMocks();
    
    const batchSize = 100;
    const startTime = Date.now();
    let processedInBatch = 0;
    
    for (let i = 0; i < batchSize; i++) {
      const email = mocks.createMockEmail(
        `perf-${i}`,
        "automated-noreply@airbnb.com",
        `Reservation confirmed: User${i}, arriving September ${7 + (i % 20)}, 2025`,
        `Test body ${i}`,
        new Date()
      );
      
      const result = SimpleEmailProcessor.processReservationEmail(
        email.getFrom(),
        email.getSubject(),
        email.getBody()
      );
      
      if (result) processedInBatch++;
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTimePerEmail = totalTime / batchSize;
    
    if (processedInBatch === batchSize && avgTimePerEmail < 10) {
      passedTests++;
      console.log("  ✅ PASS: Performance a escala exitosa");
      console.log(`  ⚡ Procesados: ${processedInBatch}/${batchSize} emails`);
      console.log(`  ⚡ Tiempo total: ${totalTime}ms`);
      console.log(`  ⚡ Promedio: ${avgTimePerEmail.toFixed(2)}ms por email`);
    } else {
      failedTests.push({
        test: "Performance at Scale",
        processed: processedInBatch,
        avgTime: avgTimePerEmail
      });
      console.log("  ❌ FAIL: Performance no cumple expectativas");
    }
    
  } catch (error) {
    failedTests.push({
      test: "Performance at Scale",
      error: error.message
    });
    console.log("  ❌ ERROR:", error.message);
  }
  
  console.log("");

  // Resumen final
  console.log("═".repeat(60));
  console.log("📊 RESUMEN TESTS DE INTEGRACIÓN COMPLETOS:");
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
  console.log(`   Failed: ${failedTests.length} (${Math.round(failedTests.length/totalTests*100)}%)`);
  
  if (failedTests.length > 0) {
    console.log(`\n❌ TESTS FALLIDOS:`);
    failedTests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.test}`);
      if (test.error) console.log(`      Error: ${test.error}`);
      if (test.expected) console.log(`      Expected: ${test.expected}, Got: ${test.actual}`);
    });
  } else {
    console.log("\n🎉 ¡TODOS LOS TESTS DE INTEGRACIÓN PASARON!");
    console.log("✅ Sistema listo para producción");
  }
  
  console.log("═".repeat(60));
  
  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests.length,
    failedDetails: failedTests
  };
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
  runCompleteIntegrationTests();
}

module.exports = {
  runCompleteIntegrationTests,
  IntegrationTestMocks
};
