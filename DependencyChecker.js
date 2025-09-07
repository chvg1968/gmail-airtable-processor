/**
 * VERIFICADOR DE DEPENDENCIAS PARA GOOGLE APPS SCRIPT
 * 
 * Copia y pega este código en un archivo separado en tu proyecto GAS
 * y ejecútalo para verificar que todas las dependencias estén cargadas correctamente.
 */

function checkAllDependencies() {
  Logger.log('=== VERIFICACIÓN DE DEPENDENCIAS ===');
  
  const dependencies = [
    { name: 'CONFIG', obj: typeof CONFIG !== 'undefined' ? CONFIG : null },
    { name: 'Utils', obj: globalThis.Utils },
    { name: 'SimpleLogger', obj: globalThis.SimpleLogger },
    { name: 'DateUtils', obj: globalThis.DateUtils },
    { name: 'SharedUtils', obj: globalThis.SharedUtils },
    { name: 'EmailFilters', obj: globalThis.EmailFilters },
    { name: 'DuplicateDetector', obj: globalThis.DuplicateDetector },
    { name: 'SimpleEmailProcessor', obj: globalThis.SimpleEmailProcessor },
    { name: 'EmailService', obj: globalThis.EmailService },
    { name: 'AirtableService', obj: globalThis.AirtableService },
    { name: 'PropertyService', obj: globalThis.PropertyService },
    { name: 'EmailProcessor', obj: globalThis.EmailProcessor },
    { name: 'processEmails', obj: globalThis.processEmails }
  ];
  
  let allGood = true;
  
  dependencies.forEach((dep, index) => {
    const status = dep.obj ? '✅ OK' : '❌ FALTANTE';
    Logger.log(`${index + 1}. ${dep.name}: ${status}`);
    
    if (!dep.obj) {
      allGood = false;
    }
    
    // Verificaciones adicionales
    if (dep.name === 'DateUtils' && dep.obj) {
      const hasExtractReservationInfo = typeof dep.obj.extractReservationInfo === 'function';
      Logger.log(`   - extractReservationInfo: ${hasExtractReservationInfo ? '✅' : '❌'}`);
      if (!hasExtractReservationInfo) allGood = false;
    }
    
    if (dep.name === 'EmailFilters' && dep.obj) {
      const hasApplyEmailFilters = typeof dep.obj.applyEmailFilters === 'function';
      Logger.log(`   - applyEmailFilters: ${hasApplyEmailFilters ? '✅' : '❌'}`);
      if (!hasApplyEmailFilters) allGood = false;
    }
    
    if (dep.name === 'EmailService' && dep.obj) {
      const hasGetMessages = typeof dep.obj.getMessages === 'function';
      Logger.log(`   - getMessages: ${hasGetMessages ? '✅' : '❌'}`);
      if (!hasGetMessages) allGood = false;
    }
  });
  
  Logger.log('\n=== RESUMEN ===');
  if (allGood) {
    Logger.log('🎉 TODAS LAS DEPENDENCIAS ESTÁN DISPONIBLES');
    Logger.log('Puedes ejecutar processEmails() con seguridad');
  } else {
    Logger.log('⚠️  HAY DEPENDENCIAS FALTANTES');
    Logger.log('Revisa el orden de los archivos en tu proyecto GAS');
    Logger.log('\nOrden correcto:');
    Logger.log('1. Config.js');
    Logger.log('2. Utils.js');
    Logger.log('3. SimpleLogger.js');
    Logger.log('4. DateUtils.js');
    Logger.log('5. SharedUtils.js');
    Logger.log('6. EmailFilters.js');
    Logger.log('7. DuplicateDetector.js');
    Logger.log('8. SimpleEmailProcessor.js');
    Logger.log('9. EmailService.js');
    Logger.log('10. AirtableService.js');
    Logger.log('11. PropertyService.js');
    Logger.log('12. EmailProcessor.js');
    Logger.log('13. Main.js');
  }
  
  return allGood;
}

/**
 * Función de test rápido
 */
function quickTest() {
  try {
    Logger.log('=== TEST RÁPIDO ===');
    
    // Test SimpleLogger
    if (globalThis.SimpleLogger) {
      SimpleLogger.info('Test SimpleLogger funcionando');
      Logger.log('✅ SimpleLogger OK');
    } else {
      Logger.log('❌ SimpleLogger no disponible');
    }
    
    // Test DateUtils con más detalle
    if (globalThis.DateUtils) {
      try {
        Logger.log('🔍 Probando DateUtils.extractReservationInfo...');
        const testResult = DateUtils.extractReservationInfo('Test: John arrives Sep 4');
        Logger.log('✅ DateUtils OK - Test result:', JSON.stringify(testResult));
      } catch (dateError) {
        Logger.log('❌ Error en DateUtils.extractReservationInfo:', dateError.message);
        Logger.log('Stack trace:', dateError.stack);
      }
    } else {
      Logger.log('❌ DateUtils no disponible');
    }
    
    // Test EmailFilters con más detalle
    if (globalThis.EmailFilters) {
      try {
        Logger.log('🔍 Probando EmailFilters.applyEmailFilters...');
        const filterResult = EmailFilters.applyEmailFilters('test@airbnb.com', 'Reservation confirmed');
        Logger.log('✅ EmailFilters OK - Test result:', JSON.stringify(filterResult));
      } catch (filterError) {
        Logger.log('❌ Error en EmailFilters.applyEmailFilters:', filterError.message);
        Logger.log('Stack trace:', filterError.stack);
      }
    } else {
      Logger.log('❌ EmailFilters no disponible');
    }
    
    Logger.log('🎉 Test rápido completado');
    
  } catch (error) {
    Logger.log('❌ Error general en test rápido:', error.message);
    Logger.log('Stack trace completo:', error.stack);
  }
}
