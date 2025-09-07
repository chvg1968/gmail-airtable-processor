/* eslint-disable */
/* prettier-ignore-file */

/**
 * TEST DE PATRONES REALES DE EMAILS
 * Paso 8: Optimización basada en emails reales de Airbnb y Lodgify
 */

const DateUtils = require("../utils/DateUtils");

// === EMAILS REALES DOCUMENTADOS ===

const REAL_EMAIL_SAMPLES = {
  airbnb: [
    {
      subject: "Reservation confirmed: John Smith, arriving September 7, 2025",
      from: "automated-noreply@airbnb.com",
      expected: { firstName: "John", arrivalDate: "2025-09-07", reservationNumber: null }
    },
    {
      subject: "Instant booking confirmed: Maria Garcia, check-in September 10, 2025",
      from: "automated-noreply@airbnb.com", 
      expected: { firstName: "Maria", arrivalDate: "2025-09-10", reservationNumber: null }
    },
    {
      subject: "Reservation confirmed - Sarah arrives Dec 25, 2024",
      from: "automated-noreply@airbnb.com",
      expected: { firstName: "Sarah", arrivalDate: "2024-12-25", reservationNumber: null }
    },
    {
      subject: "Your reservation #ABC123 is confirmed - Mike arriving Jan 15, 2025",
      from: "automated-noreply@airbnb.com",
      expected: { firstName: "Mike", arrivalDate: "2025-01-15", reservationNumber: "ABC123" }
    },
    {
      subject: "Booking confirmed for Robert Wilson, check-in March 22, 2025",
      from: "automated-noreply@airbnb.com",
      expected: { firstName: "Robert", arrivalDate: "2025-03-22", reservationNumber: null }
    }
  ],
  
  lodgify: [
    {
      subject: "New Confirmed Booking: Anna Johnson arriving Sept 15, 2024",
      from: "noreply@lodgify.com",
      expected: { firstName: "Anna", arrivalDate: "2024-09-15", reservationNumber: null }
    },
    {
      subject: "Reservation confirmed - O'Connor arrives Dec 25, 2024",
      from: "noreply@lodgify.com", 
      expected: { firstName: "O'Connor", arrivalDate: "2024-12-25", reservationNumber: null }
    },
    {
      subject: "New Confirmed Booking: #B15695014 - Carlos arriving October 16, 2025",
      from: "noreply@lodgify.com",
      expected: { firstName: "Carlos", arrivalDate: "2025-10-16", reservationNumber: "B15695014" }
    },
    {
      subject: "BOOKING (#B15831191) - Steven Kopel arriving Oct 16 2025",
      from: "noreply@lodgify.com",
      expected: { firstName: "Steven", arrivalDate: "2025-10-16", reservationNumber: "B15831191" }
    },
    {
      subject: "Booking confirmed: Julia Martinez check-in Aug 8, 2025",
      from: "noreply@lodgify.com",
      expected: { firstName: "Julia", arrivalDate: "2025-08-08", reservationNumber: null }
    }
  ],

  vrbo: [
    {
      subject: "Booking Confirmation #123456 - David Lee arrives July 4th, 2025",
      from: "noreply@vrbo.com",
      expected: { firstName: "David", arrivalDate: "2025-07-04", reservationNumber: "123456" }
    },
    {
      subject: "Your VRBO reservation B987654 confirmed - Lisa arriving June 1, 2025",
      from: "noreply@vrbo.com", 
      expected: { firstName: "Lisa", arrivalDate: "2025-06-01", reservationNumber: "B987654" }
    }
  ],

  // Casos edge y variaciones
  edge_cases: [
    {
      subject: "Reservation confirmed: Jean-Pierre O'Brien, arriving Sept 30, 2025",
      from: "automated-noreply@airbnb.com",
      expected: { firstName: "Jean-Pierre", arrivalDate: "2025-09-30", reservationNumber: null }
    },
    {
      subject: "New Confirmed Booking: María José arriving Sep 5, 2025",
      from: "noreply@lodgify.com",
      expected: { firstName: "María", arrivalDate: "2025-09-05", reservationNumber: null }
    },
    {
      subject: "Booking confirmed: Dr. Smith check-in November 11, 2025",
      from: "automated-noreply@airbnb.com",
      expected: { firstName: "Dr.", arrivalDate: "2025-11-11", reservationNumber: null }
    }
  ]
};

/**
 * Ejecuta tests de extracción de patrones reales
 */
function runRealEmailPatternsTest() {
  console.log("=== TESTING PATRONES REALES DE EMAILS ===\n");
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];

  // Test todas las categorías
  for (const [platform, emails] of Object.entries(REAL_EMAIL_SAMPLES)) {
    console.log(`📧 Testing ${platform.toUpperCase()} emails:`);
    console.log("─".repeat(50));
    
    emails.forEach((email, index) => {
      totalTests++;
      const result = DateUtils.extractReservationInfo(email.subject);
      
      const passed = (
        result.firstName === email.expected.firstName &&
        result.arrivalDate === email.expected.arrivalDate &&
        result.reservationNumber === email.expected.reservationNumber
      );

      if (passed) {
        passedTests++;
        console.log(`  ✅ Test ${index + 1}: PASS`);
      } else {
        failedTests.push({
          platform,
          index: index + 1,
          subject: email.subject,
          expected: email.expected,
          actual: result
        });
        console.log(`  ❌ Test ${index + 1}: FAIL`);
        console.log(`    Subject: "${email.subject}"`);
        console.log(`    Expected: ${JSON.stringify(email.expected)}`);
        console.log(`    Actual:   ${JSON.stringify(result)}`);
      }
    });
    
    console.log("");
  }

  // Resumen final
  console.log("═".repeat(60));
  console.log(`📊 RESUMEN FINAL:`);
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
  console.log(`   Failed: ${failedTests.length} (${Math.round(failedTests.length/totalTests*100)}%)`);
  
  if (failedTests.length > 0) {
    console.log(`\n❌ TESTS FALLIDOS:`);
    failedTests.forEach(test => {
      console.log(`   ${test.platform} #${test.index}: "${test.subject}"`);
    });
  }
  
  console.log("═".repeat(60));
  
  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests.length,
    failedDetails: failedTests
  };
}

/**
 * Analiza patrones para sugerir mejoras
 */
function analyzePatternFailures(results) {
  if (results.failed === 0) {
    console.log("🎉 ¡Todos los patrones funcionan perfectamente!");
    return;
  }

  console.log("\n🔍 ANÁLISIS DE PATRONES FALLIDOS:");
  console.log("─".repeat(50));
  
  const failuresByType = {
    firstName: [],
    arrivalDate: [],
    reservationNumber: []
  };
  
  results.failedDetails.forEach(fail => {
    if (fail.expected.firstName !== fail.actual.firstName) {
      failuresByType.firstName.push(fail);
    }
    if (fail.expected.arrivalDate !== fail.actual.arrivalDate) {
      failuresByType.arrivalDate.push(fail);
    }
    if (fail.expected.reservationNumber !== fail.actual.reservationNumber) {
      failuresByType.reservationNumber.push(fail);
    }
  });

  // Analizar cada tipo de fallo
  Object.entries(failuresByType).forEach(([type, failures]) => {
    if (failures.length > 0) {
      console.log(`\n❌ ${type.toUpperCase()} failures (${failures.length}):`);
      failures.forEach(fail => {
        console.log(`   "${fail.subject}"`);
        console.log(`   Expected: ${fail.expected[type]} | Got: ${fail.actual[type]}`);
      });
    }
  });
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
  const results = runRealEmailPatternsTest();
  analyzePatternFailures(results);
}

module.exports = {
  runRealEmailPatternsTest,
  analyzePatternFailures,
  REAL_EMAIL_SAMPLES
};
