/* eslint-disable */
/* prettier-ignore-file */

/**
 * TEST DE INTEGRACIÓN DE PATRONES OPTIMIZADOS
 * Verifica que SimpleEmailProcessor funciona con los emails reales optimizados
 */

const SimpleEmailProcessor = require("../processors/SimpleEmailProcessor");
const { REAL_EMAIL_SAMPLES } = require("./RealEmailPatternsTest");

/**
 * Test de integración completa con SimpleEmailProcessor
 */
function runSimpleEmailProcessorIntegrationTest() {
  console.log("=== TESTING SIMPLE EMAIL PROCESSOR - PATRONES REALES ===\n");
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];

  // Procesar todos los emails reales con SimpleEmailProcessor
  for (const [platform, emails] of Object.entries(REAL_EMAIL_SAMPLES)) {
    console.log(`📧 Testing ${platform.toUpperCase()} con SimpleEmailProcessor:`);
    console.log("─".repeat(55));
    
    emails.forEach((email, index) => {
      totalTests++;
      
      // Simular email completo
      const mockEmail = {
        getSubject: () => email.subject,
        getFrom: () => email.from || `noreply@${platform}.com`,
        getBody: () => `Test body for ${email.subject}`,
        getId: () => `test-${platform}-${index}`,
        getDate: () => new Date()
      };

      try {
        // SimpleEmailProcessor.processReservationEmail espera (from, subject, body)
        const subject = mockEmail.getSubject();
        const from = mockEmail.getFrom();
        const body = mockEmail.getBody();
        
        const result = SimpleEmailProcessor.processReservationEmail(from, subject, body);
        
        const passed = (
          result && 
          result.firstName === email.expected.firstName &&
          result.arrivalDate === email.expected.arrivalDate &&
          result.reservationNumber === email.expected.reservationNumber
        );

        if (passed) {
          passedTests++;
          console.log(`  ✅ Test ${index + 1}: PASS - ${email.expected.firstName}`);
        } else {
          failedTests.push({
            platform,
            index: index + 1,
            subject: email.subject,
            expected: email.expected,
            actual: result ? {
              firstName: result.firstName,
              arrivalDate: result.arrivalDate,
              reservationNumber: result.reservationNumber
            } : null
          });
          console.log(`  ❌ Test ${index + 1}: FAIL`);
          console.log(`    Expected: ${JSON.stringify(email.expected)}`);
          console.log(`    Actual:   ${JSON.stringify(result ? {
            firstName: result.firstName,
            arrivalDate: result.arrivalDate,
            reservationNumber: result.reservationNumber
          } : null)}`);
        }
      } catch (error) {
        failedTests.push({
          platform,
          index: index + 1,
          subject: email.subject,
          expected: email.expected,
          actual: null,
          error: error.message
        });
        console.log(`  ❌ Test ${index + 1}: ERROR - ${error.message}`);
      }
    });
    
    console.log("");
  }

  // Resumen final
  console.log("═".repeat(60));
  console.log(`📊 RESUMEN INTEGRACIÓN SIMPLE EMAIL PROCESSOR:`);
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
  console.log(`   Failed: ${failedTests.length} (${Math.round(failedTests.length/totalTests*100)}%)`);
  
  if (failedTests.length > 0) {
    console.log(`\n❌ TESTS FALLIDOS:`);
    failedTests.forEach(test => {
      console.log(`   ${test.platform} #${test.index}: "${test.subject}"`);
      if (test.error) {
        console.log(`     Error: ${test.error}`);
      }
    });
  } else {
    console.log("\n🎉 ¡INTEGRACIÓN PERFECTA! Todos los patrones reales funcionan con SimpleEmailProcessor");
  }
  
  console.log("═".repeat(60));
  
  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests.length
  };
}

/**
 * Test de rendimiento de patrones
 */
function runPerformanceTest() {
  console.log("\n=== TESTING PERFORMANCE DE PATRONES ===");
  console.log("─".repeat(50));
  
  const testSubjects = [
    "Reservation confirmed: John Smith, arriving September 7, 2025",
    "Your reservation #ABC123 is confirmed - Mike arriving Jan 15, 2025",
    "BOOKING (#B15831191) - Steven Kopel arriving Oct 16 2025",
    "Booking Confirmation #123456 - David Lee arrives July 4th, 2025"
  ];
  
  const iterations = 1000;
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    testSubjects.forEach((subject, index) => {
      const from = "test@example.com";
      const body = "Test body";
      
      SimpleEmailProcessor.processReservationEmail(from, subject, body);
    });
  }
  
  const endTime = Date.now();
  const totalProcessed = iterations * testSubjects.length;
  const timePerEmail = (endTime - startTime) / totalProcessed;
  
  console.log(`⚡ Procesados ${totalProcessed} emails en ${endTime - startTime}ms`);
  console.log(`⚡ Promedio: ${timePerEmail.toFixed(2)}ms por email`);
  console.log(`⚡ Throughput: ${Math.round(1000 / timePerEmail)} emails/segundo`);
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
  const results = runSimpleEmailProcessorIntegrationTest();
  
  if (results.failed === 0) {
    runPerformanceTest();
  }
}

module.exports = {
  runSimpleEmailProcessorIntegrationTest,
  runPerformanceTest
};
