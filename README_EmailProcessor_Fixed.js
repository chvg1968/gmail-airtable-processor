/**
 * INSTRUCCIONES PARA PROBAR EmailProcessor SIN RECURSIÓN
 * =====================================================
 * 
 * Para probar el nuevo EmailProcessor.js en Google Apps Script:
 * 
 * 1. Abrir Google Apps Script
 * 2. Copiar y pegar el contenido del archivo EmailProcessor.js
 * 3. Asegurarse de que todos los otros archivos estén cargados:
 *    - Config.js
 *    - SimpleLogger.js  
 *    - EmailService.js
 *    - EmailFilters.js
 *    - SharedUtils.js
 *    - SimpleEmailProcessor.js
 *    - AirtableService.js
 * 
 * 4. Ejecutar la siguiente función de prueba:
 */

function testProcessEmails() {
  try {
    console.log('=== TESTING EmailProcessor SIN RECURSIÓN ===');
    
    // Verificar que EmailProcessor existe
    if (typeof EmailProcessor === 'undefined') {
      throw new Error('EmailProcessor no está disponible');
    }
    
    console.log('✅ EmailProcessor disponible');
    
    // Crear instancia
    const processor = new EmailProcessor();
    console.log('✅ Instancia creada');
    
    // Ejecutar processEmails()
    console.log('🚀 Ejecutando processEmails()...');
    const result = processor.processEmails();
    
    console.log('🎉 ¡SUCCESS! processEmails() ejecutado sin errores de recursión');
    console.log('📊 Resultado:', JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📍 Stack:', error.stack);
    
    // Verificar si es error de recursión
    if (error.message.includes('Maximum call stack size exceeded')) {
      console.error('⚠️  RECURSIÓN DETECTADA: Revisar llamadas a ensureDependencies()');
    }
    
    throw error;
  }
}

/**
 * RESUMEN DE CAMBIOS REALIZADOS:
 * ===============================
 * 
 * ✅ ELIMINADO: Todas las llamadas a ensureDependencies()
 * ✅ AGREGADO: Funciones auxiliares seguras (getSimpleLogger, getEmailFilters, etc.)
 * ✅ CAMBIADO: Acceso directo a globalThis para dependencias
 * ✅ SIMPLIFICADO: Lazy loading reemplazado por verificaciones directas
 * ✅ MEJORADO: Manejo de errores sin recursión
 * 
 * PUNTOS CLAVE:
 * - EmailProcessor ya no llama ensureDependencies() en el constructor
 * - Cada método usa funciones auxiliares que NO causan recursión
 * - Acceso directo a globalThis.EmailService, globalThis.CONFIG, etc.
 * - Manejo seguro de dependencias faltantes
 */
