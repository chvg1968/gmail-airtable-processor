/* eslint-disable */
/* prettier-ignore-file */

/**
 * Test simple para verificar que SimpleEmailProcessor funciona correctamente
 * después de las mejoras del Step 4
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

if (__IS_NODE__) {
  const SimpleEmailProcessor = require('../processors/SimpleEmailProcessor');
  const DateUtils = require('../utils/DateUtils');
  
  console.log('=== TESTING SimpleEmailProcessor ===');
  
  // Test 1: Health Check
  console.log('\n1. Health Check:');
  console.log(JSON.stringify(SimpleEmailProcessor.healthCheck(), null, 2));
  
  // Test 2: Identificación de plataforma
  console.log('\n2. Identificación de plataforma:');
  console.log('Airbnb:', SimpleEmailProcessor.identifyPlatform('automated-noreply@airbnb.com'));
  console.log('Lodgify:', SimpleEmailProcessor.identifyPlatform('noreply@lodgify.com'));
  console.log('Unknown:', SimpleEmailProcessor.identifyPlatform('test@example.com'));
  
  // Test 3: Verificación de confirmación de reserva
  console.log('\n3. Verificación de confirmación:');
  console.log('Valid:', SimpleEmailProcessor.isBookingConfirmation('Reservation confirmed for John'));
  console.log('Invalid:', SimpleEmailProcessor.isBookingConfirmation('Welcome message'));
  
  // Test 4: Procesamiento de email completo
  console.log('\n4. Procesamiento completo:');
  const testResult = SimpleEmailProcessor.processReservationEmail(
    'automated-noreply@airbnb.com',
    'Reservation confirmed: John Smith, arriving September 7, 2025',
    'Test body content'
  );
  
  if (testResult) {
    console.log('✅ Procesamiento exitoso:');
    console.log(JSON.stringify(testResult, null, 2));
  } else {
    console.log('❌ No se pudo procesar el email');
  }
  
  // Test 5: Procesamiento específico de Airbnb
  console.log('\n5. Procesamiento específico de Airbnb:');
  const airbnbResult = SimpleEmailProcessor.processAirbnbEmail(
    'automated-noreply@airbnb.com',
    'Instant booking confirmed: Maria Garcia, check-in September 10, 2025',
    'Airbnb booking details...'
  );
  
  if (airbnbResult) {
    console.log('✅ Airbnb procesado:');
    console.log(JSON.stringify(airbnbResult, null, 2));
  } else {
    console.log('❌ No se pudo procesar email de Airbnb');
  }
  
  console.log('\n=== TESTS COMPLETED ===');
  
} else {
  console.log('Este test está diseñado para ejecutarse en Node.js');
}
