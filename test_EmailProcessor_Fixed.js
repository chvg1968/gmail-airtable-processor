/**
 * Test script para probar EmailProcessor sin recursión
 * Ejecutar este código en Google Apps Script
 */

function testEmailProcessorFixed() {
  try {
    console.log('=== TESTING EmailProcessor SIN RECURSIÓN ===');
    
    // 1. Cargar todas las dependencias primero
    console.log('🔄 Cargando dependencias...');
    
    // Ejecutar todos los archivos de dependencias
    eval(DriveApp.createFile('Config.js', Utilities.getBlob('CONFIG.js')).getBlob().getDataAsString());
    eval(DriveApp.createFile('SimpleLogger.js', Utilities.getBlob('SimpleLogger.js')).getBlob().getDataAsString());
    eval(DriveApp.createFile('EmailService.js', Utilities.getBlob('EmailService.js')).getBlob().getDataAsString());
    eval(DriveApp.createFile('EmailFilters.js', Utilities.getBlob('EmailFilters.js')).getBlob().getDataAsString());
    eval(DriveApp.createFile('SharedUtils.js', Utilities.getBlob('SharedUtils.js')).getBlob().getDataAsString());
    eval(DriveApp.createFile('SimpleEmailProcessor.js', Utilities.getBlob('SimpleEmailProcessor.js')).getBlob().getDataAsString());
    eval(DriveApp.createFile('AirtableService.js', Utilities.getBlob('AirtableService.js')).getBlob().getDataAsString());
    
    // 2. Cargar EmailProcessor NUEVO
    eval(DriveApp.createFile('EmailProcessor.js', Utilities.getBlob('EmailProcessor.js')).getBlob().getDataAsString());
    
    console.log('✅ Dependencias cargadas');
    
    // 3. Verificar que EmailProcessor existe
    if (typeof EmailProcessor === 'undefined') {
      throw new Error('EmailProcessor no se cargó correctamente');
    }
    console.log('✅ EmailProcessor disponible');
    
    // 4. Crear instancia
    const processor = new EmailProcessor();
    console.log('✅ Instancia creada');
    
    // 5. Intentar ejecutar processEmails()
    console.log('🚀 Ejecutando processEmails()...');
    const result = processor.processEmails();
    
    console.log('🎉 ¡SUCCESS! processEmails() ejecutado sin errores');
    console.log('📊 Resultado:', JSON.stringify(result, null, 2));
    
    return {
      success: true,
      result: result,
      message: 'EmailProcessor funciona sin recursión'
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
