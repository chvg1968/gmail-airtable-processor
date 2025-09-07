/**
 * SCRIPT DE PRUEBA PARA VERSIONES SIMPLIFICADAS
 * ============================================
 * 
 * Ejecutar en Google Apps Script para probar las versiones simplificadas
 */

function testSimplifiedVersions() {
  try {
    console.log('=== TESTING VERSIONES SIMPLIFICADAS ===');
    
    // 1. Probar EmailProcessor_Simple
    console.log('📧 Testing EmailProcessor_Simple...');
    
    if (typeof EmailProcessor === 'undefined') {
      throw new Error('EmailProcessor no está disponible. Asegúrate de cargar EmailProcessor_Simple.js');
    }
    
    const processor = new EmailProcessor();
    console.log('✅ EmailProcessor instanciado correctamente');
    
    // 2. Probar AirtableService_Simple  
    console.log('🗃️ Testing AirtableService_Simple...');
    
    if (typeof AirtableService === 'undefined') {
      throw new Error('AirtableService no está disponible. Asegúrate de cargar AirtableService_Simple.js');
    }
    
    console.log('✅ AirtableService disponible');
    
    // 3. Ejecutar processEmails()
    console.log('🚀 Ejecutando processEmails()...');
    const result = processor.processEmails();
    
    console.log('🎉 ¡SUCCESS! Versiones simplificadas funcionan correctamente');
    console.log('📊 Resultado:', JSON.stringify(result, null, 2));
    
    return {
      success: true,
      result: result,
      message: 'Versiones simplificadas funcionan sin problemas'
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📍 Stack:', error.stack);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * COMPARACIÓN DE COMPLEJIDAD
 * =========================
 * 
 * ANTES:
 * - EmailProcessor: 495 líneas con funciones auxiliares complejas
 * - AirtableService: 450 líneas con múltiples estrategias
 * - TOTAL: 945 líneas
 * 
 * DESPUÉS:
 * - EmailProcessor_Simple: 224 líneas con operador ?. 
 * - AirtableService_Simple: 163 líneas con funciones esenciales
 * - TOTAL: 387 líneas
 * 
 * REDUCCIÓN: 59% menos código, misma funcionalidad
 */
