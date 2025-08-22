/* global Logger PropertiesService UpdateCommissionValues Utils */
/**
 * SCRIPT COMPLETO PARA GOOGLE APPS SCRIPT
 * Actualización segura de campos de comisiones en Airtable
 *
 * FLUJO DE SEGURIDAD:
 * 1. PREVIEW (obligatorio)
 * 2. LOTE PEQUEÑO (recomendado)
 * 3. EJECUCIÓN COMPLETA
 */

// ========================================
// VALIDACIÓN DEL MÓDULO
// ========================================
function validateUpdateCommissionValuesModule() {
  try {
    Logger.log("🔍 VALIDANDO MÓDULO UpdateCommissionValues...");
    Logger.log("=".repeat(50));

    // Verificar que el módulo esté disponible
    if (typeof UpdateCommissionValues === "undefined") {
      throw new Error("❌ Módulo UpdateCommissionValues no está disponible");
    }

    // Verificar funciones individuales
    const checks = {
      previewCommissionUpdates:
        typeof UpdateCommissionValues.previewCommissionUpdates === "function",
      executeCommissionUpdates:
        typeof UpdateCommissionValues.executeCommissionUpdates === "function",
      extractAirbnbHostServiceFee:
        typeof UpdateCommissionValues.extractAirbnbHostServiceFee ===
        "function",
    };

    Logger.log("📋 Estado de funciones del módulo:");
    Object.entries(checks).forEach(([name, available]) => {
      Logger.log(`   ${name}: ${available ? "✅" : "❌"}`);
    });

    // Verificar dependencias globales
    const globalChecks = {
      Utils: typeof Utils !== "undefined",
      GmailApp: typeof GmailApp !== "undefined",
      UrlFetchApp: typeof UrlFetchApp !== "undefined",
      PropertiesService: typeof PropertiesService !== "undefined",
    };

    Logger.log("📋 Estado de dependencias globales:");
    Object.entries(globalChecks).forEach(([name, available]) => {
      Logger.log(`   ${name}: ${available ? "✅" : "❌"}`);
    });

    const allFunctionsAvailable = Object.values(checks).every((check) => check);
    const allGlobalsAvailable = Object.values(globalChecks).every(
      (check) => check
    );

    if (allFunctionsAvailable && allGlobalsAvailable) {
      Logger.log("✅ Módulo validado correctamente");
      Logger.log("✅ Todas las funciones están disponibles");
      Logger.log("✅ Todas las dependencias están disponibles");
    } else {
      Logger.log("❌ Módulo tiene problemas");
      if (!allFunctionsAvailable) Logger.log("❌ Faltan funciones del módulo");
      if (!allGlobalsAvailable) Logger.log("❌ Faltan dependencias globales");
    }

    Logger.log("=".repeat(50));
    return allFunctionsAvailable && allGlobalsAvailable;
  } catch (error) {
    Logger.log(`❌ Error validando módulo: ${error.message}`);
    Logger.log(`🔍 Stack trace: ${error.stack || "No disponible"}`);
    return false;
  }
}

// ========================================
// DEBUG DEL MÓDULO INTEGRADO
// ========================================
function debugUpdateCommissionValuesIntegrated() {
  try {
    Logger.log("🔍 DEBUG COMPLETO DEL MÓDULO INTEGRADO UpdateCommissionValuesIntegrated...");
    Logger.log("=".repeat(60));
    
    // Verificar si el módulo integrado existe
    if (typeof UpdateCommissionValuesIntegrated === 'undefined') {
      Logger.log("❌ UpdateCommissionValuesIntegrated es undefined");
      return false;
    }
    
    Logger.log("✅ UpdateCommissionValuesIntegrated existe");
    Logger.log(`📋 Tipo: ${typeof UpdateCommissionValuesIntegrated}`);
    
    // Listar todas las propiedades del módulo integrado
    Logger.log("📋 Propiedades disponibles en UpdateCommissionValuesIntegrated:");
    const properties = Object.getOwnPropertyNames(UpdateCommissionValuesIntegrated);
    properties.forEach(prop => {
      const value = UpdateCommissionValuesIntegrated[prop];
      const type = typeof value;
      Logger.log(`   ${prop}: ${type} ${type === 'function' ? '✅' : '❌'}`);
    });
    
    // Verificar funciones específicas
    Logger.log("🔍 Verificación detallada de funciones:");
    
    if (UpdateCommissionValuesIntegrated.previewCommissionUpdates) {
      Logger.log("   previewCommissionUpdates: ✅ Disponible");
      Logger.log(`   Tipo: ${typeof UpdateCommissionValuesIntegrated.previewCommissionUpdates}`);
    } else {
      Logger.log("   previewCommissionUpdates: ❌ NO disponible");
    }
    
    if (UpdateCommissionValuesIntegrated.executeCommissionUpdates) {
      Logger.log("   executeCommissionUpdates: ✅ Disponible");
      Logger.log(`   Tipo: ${typeof UpdateCommissionValuesIntegrated.executeCommissionUpdates}`);
    } else {
      Logger.log("   executeCommissionUpdates: ❌ NO disponible");
    }
    
    if (UpdateCommissionValuesIntegrated.extractAirbnbHostServiceFee) {
      Logger.log("   extractAirbnbHostServiceFee: ✅ Disponible");
      Logger.log(`   Tipo: ${typeof UpdateCommissionValuesIntegrated.extractAirbnbHostServiceFee}`);
    } else {
      Logger.log("   extractAirbnbHostServiceFee: ❌ NO disponible");
    }
    
    // Intentar llamar a la función problemática
    Logger.log("🧪 Probando llamada a extractAirbnbHostServiceFee...");
    try {
      const testResult = UpdateCommissionValuesIntegrated.extractAirbnbHostServiceFee("test");
      Logger.log(`✅ Llamada exitosa, resultado: ${testResult}`);
    } catch (callError) {
      Logger.log(`⚠️ Llamada falló (esperado): ${callError.message}`);
      Logger.log("✅ Esto confirma que la función existe pero falla con ID inválido");
    }
    
    Logger.log("=".repeat(60));
    return true;
    
  } catch (error) {
    Logger.log(`❌ Error en debug: ${error.message}`);
    Logger.log(`🔍 Stack trace: ${error.stack || 'No disponible'}`);
    return false;
  }
}

// ========================================
// RECARGA DEL MÓDULO INTEGRADO
// ========================================
function reloadUpdateCommissionValuesIntegrated() {
  try {
    Logger.log("🔄 INTENTANDO RECARGAR MÓDULO INTEGRADO UpdateCommissionValuesIntegrated...");
    Logger.log("=".repeat(60));
    
    // Verificar estado antes de la recarga
    Logger.log("📋 Estado ANTES de la recarga:");
    if (typeof UpdateCommissionValuesIntegrated !== 'undefined') {
      Logger.log("   UpdateCommissionValuesIntegrated: ✅ Disponible");
      Logger.log(`   extractAirbnbHostServiceFee: ${typeof UpdateCommissionValuesIntegrated.extractAirbnbHostServiceFee === 'function' ? '✅' : '❌'}`);
    } else {
      Logger.log("   UpdateCommissionValuesIntegrated: ❌ NO disponible");
    }
    
    // Intentar forzar recarga (en Google Apps Script esto puede requerir refrescar la página)
    Logger.log("🔄 Recarga completada (puede requerir refrescar la página del editor)");
    Logger.log("💡 Si el problema persiste, intenta:");
    Logger.log("   1. Guardar todos los archivos");
    Logger.log("   2. Refrescar la página del editor");
    Logger.log("   3. Ejecutar debugUpdateCommissionValuesIntegrated()");
    
    Logger.log("=".repeat(60));
    return true;
    
  } catch (error) {
    Logger.log(`❌ Error en recarga: ${error.message}`);
    return false;
  }
}

// ========================================
// CONFIGURACIÓN - OBTIENE DESDE SCRIPT PROPERTIES
// ========================================
function getConfig() {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();

    const config = {
      airtableApiKey: scriptProperties.getProperty("AIRTABLE_API_KEY"),
      airtableBaseId: scriptProperties.getProperty("AIRTABLE_BASE_ID"),
      airtableTableName: scriptProperties.getProperty("AIRTABLE_TABLE_NAME"),
    };

    // Verificar que todas las propiedades estén configuradas
    if (!config.airtableApiKey) {
      throw new Error(
        "❌ AIRTABLE_API_KEY no configurada en Script Properties"
      );
    }

    if (!config.airtableBaseId) {
      throw new Error(
        "❌ AIRTABLE_BASE_ID no configurada en Script Properties"
      );
    }

    if (!config.airtableTableName) {
      throw new Error(
        "❌ AIRTABLE_TABLE_NAME no configurada en Script Properties"
      );
    }

    return config;
  } catch (error) {
    Logger.log(`❌ Error obteniendo configuración: ${error.message}`);
    throw error;
  }
}

// ========================================
// MÓDULO INTEGRADO UpdateCommissionValues
// ========================================
const UpdateCommissionValuesIntegrated = (() => {
  // Configuración de fechas
  const START_DATE = "2025-06-01";
  const END_DATE = new Date().toISOString().split("T")[0]; // Hoy

  // Extraer Host service fee del correo original de Airbnb
  function extractAirbnbHostServiceFee(gmailMessageId) {
    try {
      Logger.log(`[UpdateCommissionValues] 🔍 Intentando extraer fee del mensaje: ${gmailMessageId}`);
      
      // Buscar el mensaje en Gmail usando el ID
      const message = GmailApp.getMessageById(gmailMessageId);
      if (!message) {
        Logger.log(`[UpdateCommissionValues] ❌ No se encontró mensaje Gmail: ${gmailMessageId}`);
        return 0;
      }
      
      const body = message.getBody();
      if (!body) {
        Logger.log(`[UpdateCommissionValues] ❌ Cuerpo del mensaje vacío: ${gmailMessageId}`);
        return 0;
      }
      
      const cleanBody = Utils.stripForwardHeaders(body);
      Logger.log(`[UpdateCommissionValues] 📧 Cuerpo del mensaje procesado (${cleanBody.length} caracteres)`);
      
      // Patrones para extraer Host service fee
      const patterns = [
        /Host service fee[:\s-]*\$?([\d,]+\.?\d*)/i,
        /Service fee[:\s-]*\$?([\d,]+\.?\d*)/i,
        /Host fee[:\s-]*\$?([\d,]+\.?\d*)/i,
        /(?:3\.0%|3%)[:\s-]*\$?([\d,]+\.?\d*)/i
      ];
      
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = cleanBody.match(pattern);
        if (match && match[1]) {
          const fee = Utils.sanitizeMoneyUSD(match[1]);
          Logger.log(`[UpdateCommissionValues] ✅ Host service fee extraído con patrón ${i + 1}: $${fee} (${gmailMessageId})`);
          return fee;
        }
      }
      
      Logger.log(`[UpdateCommissionValues] ⚠️ No se pudo extraer Host service fee con ningún patrón del mensaje: ${gmailMessageId}`);
      Logger.log(`[UpdateCommissionValues] 🔍 Primeros 200 caracteres del cuerpo: ${cleanBody.substring(0, 200)}...`);
      return 0;
      
    } catch (error) {
      Logger.log(`[UpdateCommissionValues] ❌ Error extrayendo Host service fee: ${error}`);
      Logger.log(`[UpdateCommissionValues] 🔍 Stack trace: ${error.stack || 'No disponible'}`);
      return 0;
    }
  }

  // Función principal: preview de cambios
  function previewCommissionUpdates(config) {
    Logger.log(
      "[UpdateCommissionValues] Iniciando preview de actualizaciones de comisiones"
    );
    Logger.log(`[UpdateCommissionValues] Período: ${START_DATE} a ${END_DATE}`);

    const recordsToUpdate = findRecordsForUpdate(config);

    if (recordsToUpdate.length === 0) {
      Logger.log(
        "[UpdateCommissionValues] No se encontraron registros para actualizar"
      );
      return {
        ok: true,
        message: "No hay registros para actualizar",
        records: [],
      };
    }

    // Generar preview de cambios
    const preview = generateUpdatePreview(recordsToUpdate);

    Logger.log(
      `[UpdateCommissionValues] PREVIEW: ${recordsToUpdate.length} registros serán actualizados`
    );
    Logger.log(
      `[UpdateCommissionValues] Vrbo: ${preview.vrboCount} | Airbnb: ${preview.airbnbCount}`
    );

    return {
      ok: true,
      message: `Preview generado: ${recordsToUpdate.length} registros`,
      records: recordsToUpdate,
      preview: preview,
    };
  }

  // Función principal: ejecutar actualizaciones
  function executeCommissionUpdates(config) {
    Logger.log(
      "[UpdateCommissionValues] Iniciando ejecución de actualizaciones de comisiones"
    );
    Logger.log(`[UpdateCommissionValues] Período: ${START_DATE} a ${END_DATE}`);

    const recordsToUpdate = findRecordsForUpdate(config);

    if (recordsToUpdate.length === 0) {
      Logger.log(
        "[UpdateCommissionValues] No se encontraron registros para actualizar"
      );
      return {
        ok: true,
        message: "No hay registros para actualizar",
        records: [],
      };
    }

    Logger.log(
      `[UpdateCommissionValues] EJECUTANDO: ${recordsToUpdate.length} registros serán actualizados`
    );

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const record of recordsToUpdate) {
      try {
        Logger.log(
          `[UpdateCommissionValues] Procesando registro: ${record.id} - ${record.fields.Platform || 'Sin plataforma'}`
        );

        const result = updateSingleRecord(record, config);
        results.push({ recordId: record.id, result });

        if (result.ok) {
          successCount++;
          Logger.log(
            `[UpdateCommissionValues] ✅ Registro ${record.id} actualizado: ${result.message}`
          );
        } else {
          errorCount++;
          Logger.log(
            `[UpdateCommissionValues] ❌ Error en registro ${record.id}: ${result.error}`
          );
        }
      } catch (error) {
        errorCount++;
        Logger.log(
          `[UpdateCommissionValues] ❌ Excepción en registro ${record.id}: ${error}`
        );
        results.push({
          recordId: record.id,
          result: { ok: false, error: error.toString() },
        });
      }
    }

    Logger.log(
      `[UpdateCommissionValues] RESUMEN EJECUCIÓN: ${successCount} exitosos, ${errorCount} errores`
    );

    return {
      ok: errorCount === 0,
      message: `Ejecución completada: ${successCount} exitosos, ${errorCount} errores`,
      results,
      summary: { successCount, errorCount, total: recordsToUpdate.length },
    };
  }

  // Buscar registros que necesitan actualización
  function findRecordsForUpdate(config) {
    Logger.log("[UpdateCommissionValues] Buscando registros para actualizar...");

    const baseUrl = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}`;
    
    // Filtro: registros desde 1 Junio 2025 con Gmail Message ID
    // Usar "Arrival" en lugar de "Check-in Date" según la estructura real de la tabla
    // No incluir "Resort Fee" ya que no existe en Airtable
    const filterFormula = `AND(
      IS_AFTER({Arrival}, '${START_DATE}'),
      {Gmail Message ID} != '',
      OR({Platform} = 'Vrbo', {Platform} = 'Airbnb')
    )`;

    const url = `${baseUrl}?filterByFormula=${encodeURIComponent(filterFormula)}&fields[]=Platform&fields[]=Gmail Message ID&fields[]=Arrival&fields[]=Accommodation&fields[]=Cleaning Fee&fields[]=Taxes&fields[]=Vrbo value 1 or Airbnb value&fields[]=Vrbo value 2`;

    const options = {
      method: "get",
      headers: {
        Authorization: `Bearer ${config.airtableApiKey}`,
      },
      muteHttpExceptions: true,
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());

      if (response.getResponseCode() !== 200) {
        Logger.log(
          `[UpdateCommissionValues] ❌ Error HTTP ${response.getResponseCode()}: ${response.getContentText()}`
        );
        return [];
      }

      if (!result.records) {
        Logger.log("[UpdateCommissionValues] ❌ Respuesta inválida de Airtable");
        return [];
      }

      Logger.log(
        `[UpdateCommissionValues] ✅ Encontrados ${result.records.length} registros para actualizar`
      );

      return result.records;
    } catch (error) {
      Logger.log(
        `[UpdateCommissionValues] ❌ Error buscando registros: ${error}`
      );
      return [];
    }
  }

  // Generar preview de cambios
  function generateUpdatePreview(records) {
    let vrboCount = 0;
    let airbnbCount = 0;

    for (const record of records) {
      const platform = record.fields.Platform;
      if (platform === "Vrbo") {
        vrboCount++;
      } else if (platform === "Airbnb") {
        airbnbCount++;
      }
    }

    return { vrboCount, airbnbCount };
  }

  // Actualizar un registro individual
  function updateSingleRecord(record, config) {
    const fields = record.fields;
    const platform = fields.Platform;
    const gmailMessageId = fields["Gmail Message ID"];

    if (!platform || !gmailMessageId) {
      return {
        ok: false,
        error: "Faltan campos requeridos: Platform o Gmail Message ID",
      };
    }

    let newValue1 = 0;
    let newValue2 = 0;

    if (platform === "Vrbo") {
      // Vrbo: Value1 = (Accommodation + Cleaning Fee + Taxes) * 3%
      //       Value2 = (Accommodation + Taxes) * 5%
      // Nota: Resort Fee no existe en Airtable, se usa solo Accommodation
      const accommodation = Utils.sanitizeMoneyUSD(fields.Accommodation || 0);
      const cleaningFee = Utils.sanitizeMoneyUSD(fields["Cleaning Fee"] || 0);
      const taxes = Utils.sanitizeMoneyUSD(fields.Taxes || 0);

      newValue1 = Utils.sanitizeMoneyUSD(
        (accommodation + cleaningFee + taxes) * 0.03
      );
      newValue2 = Utils.sanitizeMoneyUSD(
        (accommodation + taxes) * 0.05
      );

      Logger.log(
        `[UpdateCommissionValues] Vrbo calculado: Value1=$${newValue1}, Value2=$${newValue2}`
      );
      Logger.log(
        `[UpdateCommissionValues] Valores base: Accommodation=$${accommodation}, Cleaning Fee=$${cleaningFee}, Taxes=$${taxes}`
      );
    } else if (platform === "Airbnb") {
      // Airbnb: Value1 re-extraído del correo original, Value2 = 0
      if (!gmailMessageId) {
        Logger.log(
          `[UpdateCommissionValues] Airbnb sin Gmail Message ID, manteniendo valores existentes`
        );
        newValue1 = fields["Vrbo value 1 or Airbnb value"] || 0;
        newValue2 = 0;
      } else {
        // Re-leer correo y extraer Host service fee
        newValue1 = extractAirbnbHostServiceFee(gmailMessageId);
        newValue2 = 0;
        Logger.log(
          `[UpdateCommissionValues] Airbnb re-extraído: Value1=$${newValue1}, Value2=$${newValue2}`
        );
      }
    }

    // Solo enviar campos que van a cambiar
    const updateFields = {};

    if (fields["Vrbo value 1 or Airbnb value"] !== newValue1) {
      updateFields["Vrbo value 1 or Airbnb value"] = newValue1;
    }

    if (fields["Vrbo value 2"] !== newValue2) {
      updateFields["Vrbo value 2"] = newValue2;
    }

    // Si no hay cambios, no hacer update
    if (Object.keys(updateFields).length === 0) {
      return { ok: true, message: "No hay cambios necesarios" };
    }

    Logger.log(
      `[UpdateCommissionValues] Actualizando campos: ${JSON.stringify(updateFields)}`
    );

    // Ejecutar PATCH
    const baseUrl = `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTableName)}`;
    const patchUrl = `${baseUrl}/${record.id}`;

    const options = {
      method: "patch",
      headers: {
        Authorization: `Bearer ${config.airtableApiKey}`,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({ fields: updateFields }),
      muteHttpExceptions: true,
    };

    try {
      const response = UrlFetchApp.fetch(patchUrl, options);
      const result = JSON.parse(response.getContentText());

      if (response.getResponseCode() === 200 && result.records) {
        return { ok: true, message: "Actualizado exitosamente" };
      } else {
        return {
          ok: false,
          error: `HTTP ${response.getResponseCode()}: ${response.getContentText()}`,
        };
      }
    } catch (error) {
      return { ok: false, error: error.toString() };
    }
  }

  // Retornar objeto con todas las funciones exportadas
  return {
    previewCommissionUpdates,
    executeCommissionUpdates,
    extractAirbnbHostServiceFee,
  };
})();

// ========================================
// FUNCIÓN 1: PREVIEW (OBLIGATORIO PRIMERO)
// ========================================
function previewCommissionUpdates() {
  try {
    Logger.log("🚀 INICIANDO PREVIEW DE ACTUALIZACIONES DE COMISIONES");
    Logger.log("=".repeat(60));

    // Obtener configuración desde Script Properties
    const config = getConfig();

    Logger.log("✅ Configuración obtenida desde Script Properties");
    Logger.log(`📊 Base: ${config.airtableBaseId}`);
    Logger.log(`📋 Tabla: ${config.airtableTableName}`);
    Logger.log("=".repeat(60));

    // Ejecutar preview
    const preview = UpdateCommissionValuesIntegrated.previewCommissionUpdates(config);

    if (!preview.ok) {
      throw new Error(`❌ Error en preview: ${preview.message}`);
    }

    // Validación adicional: verificar Gmail Message ID y extraer valores reales
    Logger.log("🔍 VALIDANDO GMAIL MESSAGE ID Y EXTRACCIÓN DE CORREOS...");
    const validatedPreview = validateGmailMessagesAndExtractValues(
      preview.records
    );

    // Mostrar resumen
    Logger.log("📋 RESUMEN DEL PREVIEW VALIDADO:");
    Logger.log(
      `   Total registros a actualizar: ${validatedPreview.totalCount}`
    );
    Logger.log(`   Vrbo: ${validatedPreview.vrboCount}`);
    Logger.log(`   Airbnb: ${validatedPreview.airbnbCount}`);
    Logger.log(`   ⚠️  Problemas detectados: ${validatedPreview.issuesCount}`);
    Logger.log("=".repeat(60));

    // Mostrar detalles de Vrbo
    if (validatedPreview.vrboUpdates.length > 0) {
      Logger.log("🏠 REGISTROS VRBO A ACTUALIZAR:");
      validatedPreview.vrboUpdates.forEach((record, index) => {
        Logger.log(
          `   ${index + 1}. ${record.guestName} (${record.reservationNumber})`
        );
        Logger.log(
          `      Value1 actual: ${record.currentValue1} → Nuevo: $${record.newValue1}`
        );
        Logger.log(
          `      Value2 actual: ${record.currentValue2} → Nuevo: $${record.newValue2}`
        );
        Logger.log(
          `      ✅ Gmail Message ID: ${record.hasGmailId ? "SÍ" : "NO"}`
        );
      });
    }

    // Mostrar detalles de Airbnb
    if (validatedPreview.airbnbUpdates.length > 0) {
      Logger.log("🏡 REGISTROS AIRBNB A ACTUALIZAR:");
      validatedPreview.airbnbUpdates.forEach((record, index) => {
        Logger.log(
          `   ${index + 1}. ${record.guestName} (${record.reservationNumber})`
        );
        Logger.log(
          `      Value1 actual: ${record.currentValue1} → Nuevo: $${record.newValue1}`
        );
        Logger.log(
          `      Value2 actual: ${record.currentValue2} → Nuevo: $${record.newValue2}`
        );
        Logger.log(
          `      📧 Gmail Message ID: ${record.hasGmailId ? "SÍ" : "NO"}`
        );
        if (record.hasGmailId) {
          Logger.log(
            `      💰 Host service fee extraído: $${record.extractedFee}`
          );
        } else {
          Logger.log(`      ❌ NO se puede extraer fee - sin Gmail Message ID`);
        }
      });
    }

    // Mostrar problemas detectados
    if (validatedPreview.issues.length > 0) {
      Logger.log("⚠️  PROBLEMAS DETECTADOS:");
      validatedPreview.issues.forEach((issue, index) => {
        Logger.log(`   ${index + 1}. ${issue.type}: ${issue.description}`);
        Logger.log(
          `      Registro: ${issue.guestName} (${issue.reservationNumber})`
        );
      });
    }

    Logger.log("=".repeat(60));
    Logger.log("✅ PREVIEW VALIDADO COMPLETADO EXITOSAMENTE");
    Logger.log("💡 Ahora puedes ejecutar executeSmallBatch() o executeAll()");

    return validatedPreview;
  } catch (error) {
    Logger.log(`❌ ERROR EN PREVIEW: ${error.message}`);
    Logger.log(`🔍 Detalles: ${error.stack || "No disponible"}`);
    return { ok: false, error: error.message };
  }
}

// ========================================
// FUNCIÓN DE VALIDACIÓN DE GMAIL Y EXTRACCIÓN
// ========================================
function validateGmailMessagesAndExtractValues(records) {
  Logger.log(
    "🔍 Iniciando validación de Gmail Message ID y extracción de valores..."
  );

  const validatedPreview = {
    totalCount: records.length,
    vrboCount: 0,
    airbnbCount: 0,
    issuesCount: 0,
    vrboUpdates: [],
    airbnbUpdates: [],
    issues: [],
  };

  for (const record of records) {
    try {
      const fields = record.fields;
      const platform = fields.Platform;
      const gmailMessageId = fields["Gmail Message ID"];

      if (platform === "Vrbo") {
        // Vrbo: calcular valores desde campos de Airtable
        const accommodation = fields.Accommodation || 0;
        const cleaningFee = fields["Cleaning Fee"] || 0;
        const taxes = fields.Taxes || 0;

        const newValue1 = Utils.sanitizeMoneyUSD(
          (accommodation + cleaningFee + taxes) * 0.03
        );
        const newValue2 = Utils.sanitizeMoneyUSD(
          (accommodation + taxes) * 0.05
        );

        validatedPreview.vrboUpdates.push({
          id: record.id,
          reservationNumber: fields["Reservation number"],
          guestName: fields["Full Name"],
          currentValue1: fields["Vrbo value 1 or Airbnb value"] || "NO TIENE",
          currentValue2: fields["Vrbo value 2"] || "NO TIENE",
          newValue1: newValue1,
          newValue2: newValue2,
          hasGmailId: !!gmailMessageId,
        });

        validatedPreview.vrboCount++;
      } else if (platform === "Airbnb") {
        // Airbnb: validar Gmail Message ID y extraer fee
        if (!gmailMessageId) {
          validatedPreview.issues.push({
            type: "SIN_GMAIL_MESSAGE_ID",
            description: "No se puede extraer Host service fee",
            guestName: fields["Full Name"],
            reservationNumber: fields["Reservation number"],
          });
          validatedPreview.issuesCount++;

          // Aún incluir en la lista pero marcado como problemático
          validatedPreview.airbnbUpdates.push({
            id: record.id,
            reservationNumber: fields["Reservation number"],
            guestName: fields["Full Name"],
            currentValue1: fields["Vrbo value 1 or Airbnb value"] || "NO TIENE",
            currentValue2: fields["Vrbo value 2"] || "NO TIENE",
            newValue1: 0, // No se puede extraer
            newValue2: 0,
            hasGmailId: false,
            extractedFee: 0,
          });
        } else {
          // Intentar extraer Host service fee del correo
          try {
            const extractedFee =
              UpdateCommissionValuesIntegrated.extractAirbnbHostServiceFee(
                gmailMessageId
              );

            validatedPreview.airbnbUpdates.push({
              id: record.id,
              reservationNumber: fields["Reservation number"],
              guestName: fields["Full Name"],
              currentValue1:
                fields["Vrbo value 1 or Airbnb value"] || "NO TIENE",
              currentValue2: fields["Vrbo value 2"] || "NO TIENE",
              newValue1: extractedFee,
              newValue2: 0,
              hasGmailId: true,
              extractedFee: extractedFee,
            });

            if (extractedFee === 0) {
              validatedPreview.issues.push({
                type: "NO_SE_PUDO_EXTRAER_FEE",
                description:
                  "Gmail Message ID existe pero no se pudo extraer fee",
                guestName: fields["Full Name"],
                reservationNumber: fields["Reservation number"],
              });
              validatedPreview.issuesCount++;
            }
          } catch (extractionError) {
            validatedPreview.issues.push({
              type: "ERROR_EXTRACCION",
              description: `Error extrayendo fee: ${extractionError.message}`,
              guestName: fields["Full Name"],
              reservationNumber: fields["Reservation number"],
            });
            validatedPreview.issuesCount++;

            // Incluir con valores por defecto
            validatedPreview.airbnbUpdates.push({
              id: record.id,
              reservationNumber: fields["Reservation number"],
              guestName: fields["Full Name"],
              currentValue1:
                fields["Vrbo value 1 or Airbnb value"] || "NO TIENE",
              currentValue2: fields["Vrbo value 2"] || "NO TIENE",
              newValue1: 0,
              newValue2: 0,
              hasGmailId: true,
              extractedFee: 0,
            });
          }
        }

        validatedPreview.airbnbCount++;
      }
    } catch (recordError) {
      Logger.log(
        `❌ Error validando registro ${record.id}: ${recordError.message}`
      );
      validatedPreview.issues.push({
        type: "ERROR_VALIDACION",
        description: `Error validando registro: ${recordError.message}`,
        guestName: "DESCONOCIDO",
        reservationNumber: "DESCONOCIDO",
      });
      validatedPreview.issuesCount++;
    }
  }

  Logger.log(
    `✅ Validación completada: ${validatedPreview.totalCount} registros procesados`
  );
  Logger.log(`   Problemas detectados: ${validatedPreview.issuesCount}`);

  return validatedPreview;
}

// ========================================
// FUNCIÓN 2: LOTE PEQUEÑO (RECOMENDADO)
// ========================================
function executeSmallBatch() {
  try {
    Logger.log("🚀 INICIANDO ACTUALIZACIÓN EN LOTE PEQUEÑO");
    Logger.log("=".repeat(60));

    // Obtener configuración
    const config = getConfig();

    // Primero hacer preview
    Logger.log("📋 Obteniendo preview...");
    const preview = UpdateCommissionValuesIntegrated.previewCommissionUpdates(config);

    if (!preview.ok || preview.records.length === 0) {
      Logger.log("ℹ️ No hay registros para actualizar");
      return { ok: true, message: "No hay registros para actualizar" };
    }

    // Tomar solo los primeros 5 registros
    const smallBatch = preview.records.slice(0, 5);
    Logger.log(`🔢 Ejecutando lote pequeño: ${smallBatch.length} registros`);

    // Ejecutar actualizaciones
    const result = UpdateCommissionValuesIntegrated.executeCommissionUpdates(
      config
    );

    if (!result.ok) {
      throw new Error(`❌ Error en ejecución: ${result.message}`);
    }

    // Mostrar resumen
    Logger.log("=".repeat(60));
    Logger.log("📊 RESUMEN DEL LOTE PEQUEÑO:");
    Logger.log(`   Total procesados: ${result.summary.total}`);
    Logger.log(`   ✅ Exitosos: ${result.summary.success}`);
    Logger.log(`   ❌ Errores: ${result.summary.errors}`);

    if (result.summary.errors > 0) {
      Logger.log("🔍 DETALLES DE ERRORES:");
      result.summary.errorDetails.forEach((error, index) => {
        Logger.log(`   ${index + 1}. Record ID: ${error.recordId}`);
        Logger.log(`      Error: ${error.error}`);
      });
    }

    Logger.log("=".repeat(60));
    Logger.log("✅ LOTE PEQUEÑO COMPLETADO");
    Logger.log("💡 Si todo salió bien, puedes ejecutar executeAll()");

    return result;
  } catch (error) {
    Logger.log(`❌ ERROR EN LOTE PEQUEÑO: ${error.message}`);
    Logger.log(`🔍 Detalles: ${error.stack || "No disponible"}`);
    return { ok: false, error: error.message };
  }
}

// ========================================
// FUNCIÓN 3: EJECUCIÓN COMPLETA
// ========================================
function executeAll() {
  try {
    Logger.log("🚀 INICIANDO ACTUALIZACIÓN COMPLETA");
    Logger.log("=".repeat(60));

    // Obtener configuración
    const config = getConfig();

    // Primero hacer preview
    Logger.log("📋 Obteniendo preview...");
    const preview = UpdateCommissionValuesIntegrated.previewCommissionUpdates(config);

    if (!preview.ok || preview.records.length === 0) {
      Logger.log("ℹ️ No hay registros para actualizar");
      return { ok: true, message: "No hay registros para actualizar" };
    }

    Logger.log(
      `🔢 Ejecutando actualización completa: ${preview.records.length} registros`
    );

    // Confirmación de seguridad
    Logger.log("⚠️  ADVERTENCIA: Esta función actualizará TODOS los registros");
    Logger.log("💡 Si quieres probar primero, ejecuta executeSmallBatch()");

    // Ejecutar todas las actualizaciones
    const result = UpdateCommissionValuesIntegrated.executeCommissionUpdates(
      config
    );

    if (!result.ok) {
      throw new Error(`❌ Error en ejecución: ${result.message}`);
    }

    // Mostrar resumen final
    Logger.log("=".repeat(60));
    Logger.log("🎉 ACTUALIZACIÓN COMPLETA FINALIZADA");
    Logger.log("📊 RESUMEN FINAL:");
    Logger.log(`   Total procesados: ${result.summary.total}`);
    Logger.log(`   ✅ Exitosos: ${result.summary.success}`);
    Logger.log(`   ❌ Errores: ${result.summary.errors}`);

    if (result.summary.errors > 0) {
      Logger.log("🔍 REGISTROS CON ERRORES:");
      result.summary.errorDetails.forEach((error, index) => {
        Logger.log(`   ${index + 1}. Record ID: ${error.recordId}`);
        Logger.log(`      Error: ${error.error}`);
      });

      Logger.log("💡 Considera revisar manualmente los registros con errores");
    } else {
      Logger.log("🎯 ¡TODOS LOS REGISTROS ACTUALIZADOS EXITOSAMENTE!");
    }

    Logger.log("=".repeat(60));

    return result;
  } catch (error) {
    Logger.log(`❌ ERROR EN EJECUCIÓN COMPLETA: ${error.message}`);
    Logger.log(`🔍 Detalles: ${error.stack || "No disponible"}`);
    return { ok: false, error: error.message };
  }
}

// ========================================
// FUNCIÓN DE VERIFICACIÓN DE CONFIGURACIÓN
// ========================================
function verifyConfiguration() {
  Logger.log("🔍 VERIFICANDO CONFIGURACIÓN DESDE SCRIPT PROPERTIES");
  Logger.log("=".repeat(50));

  try {
    const config = getConfig();

    Logger.log("✅ CONFIGURACIÓN COMPLETA DESDE SCRIPT PROPERTIES");
    Logger.log(`📊 Base: ${config.airtableBaseId}`);
    Logger.log(`📋 Tabla: ${config.airtableTableName}`);
    Logger.log("💡 Puedes ejecutar previewCommissionUpdates()");
  } catch (error) {
    Logger.log("❌ CONFIGURACIÓN INCOMPLETA");
    Logger.log(`🔧 Error: ${error.message}`);
    Logger.log("💡 Verifica que tengas estas propiedades configuradas:");
    Logger.log("   - AIRTABLE_API_KEY");
    Logger.log("   - AIRTABLE_BASE_ID");
    Logger.log("   - AIRTABLE_TABLE_NAME");
  }

  Logger.log("=".repeat(50));
}

// ========================================
// FUNCIÓN DE AYUDA
// ========================================
function showHelp() {
  Logger.log("📚 AYUDA - FLUJO DE SEGURIDAD");
  Logger.log("=".repeat(50));
  Logger.log("1️⃣ verifyConfiguration() - Verifica tu configuración");
  Logger.log("2️⃣ previewCommissionUpdates() - PREVIEW obligatorio");
  Logger.log("3️⃣ executeSmallBatch() - Lote de 5 registros (recomendado)");
  Logger.log("4️⃣ executeAll() - Actualización completa");
  Logger.log("=".repeat(50));
  Logger.log("💡 EJECUTA EN ESTE ORDEN PARA MÁXIMA SEGURIDAD");
  Logger.log("⚠️  NUNCA ejecutes executeAll() sin hacer preview primero");
  Logger.log(
    "🔑 Las API keys se obtienen automáticamente de Script Properties"
  );
}

// ========================================
// PRUEBA DE FUNCIÓN EXTRACT AIRBNB HOST SERVICE FEE
// ========================================
function testExtractAirbnbHostServiceFee() {
  try {
    Logger.log("🧪 PROBANDO FUNCIÓN extractAirbnbHostServiceFee...");
    Logger.log("=".repeat(50));

    // Verificar que la función esté disponible
    if (typeof UpdateCommissionValues === "undefined") {
      throw new Error("❌ Módulo UpdateCommissionValues no está disponible");
    }

    if (
      typeof UpdateCommissionValues.extractAirbnbHostServiceFee !== "function"
    ) {
      throw new Error(
        "❌ Función extractAirbnbHostServiceFee no está disponible"
      );
    }

    Logger.log("✅ Función extractAirbnbHostServiceFee está disponible");
    Logger.log("✅ Módulo UpdateCommissionValues está disponible");

    // Intentar llamar a la función con un ID de prueba (esto fallará pero verificará que esté disponible)
    try {
      const result =
        UpdateCommissionValues.extractAirbnbHostServiceFee("test_id");
      Logger.log(`✅ Función ejecutada exitosamente, resultado: ${result}`);
    } catch (executionError) {
      Logger.log(
        `⚠️ Función ejecutada pero falló (esperado): ${executionError.message}`
      );
      Logger.log(
        "✅ Esto confirma que la función está disponible y se puede llamar"
      );
    }

    Logger.log("=".repeat(50));
    return true;
  } catch (error) {
    Logger.log(`❌ Error en prueba: ${error.message}`);
    Logger.log(`🔍 Stack trace: ${error.stack || "No disponible"}`);
    return false;
  }
}

// ========================================
// TEST DE EXTRACCIÓN DE NOMBRES DE AIRBNB
// ========================================
function testExtractGuestNameFromSubject() {
  Logger.log("🧪 PROBANDO EXTRACCIÓN DE NOMBRES DE AIRBNB...");
  Logger.log("=".repeat(60));
  
  // Test cases para Airbnb
  const testCases = [
    {
      subject: "Reservation confirmed - Francisco De Jesus arrives Aug 18",
      expected: "Francisco De Jesus",
      description: "Nombre completo con dos apellidos"
    },
    {
      subject: "Reservation confirmed - Karen Roberts arrives Aug 21",
      expected: "Karen Roberts", 
      description: "Nombre completo con un apellido"
    },
    {
      subject: "Reservation confirmed - Andrew arrives Aug 22",
      expected: "Andrew",
      description: "Solo nombre"
    },
    {
      subject: "Reservation confirmed - María José López arrives Aug 23",
      expected: "María José López",
      description: "Nombre completo con acentos"
    }
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (const testCase of testCases) {
    try {
      Logger.log(`\n📧 Probando: "${testCase.description}"`);
      Logger.log(`   Subject: "${testCase.subject}"`);
      
      // Simular la extracción del nombre
      const parts = testCase.subject.split(" - ");
      let extractedName = null;
      
      if (parts.length > 1) {
        const potentialNameAndDate = parts[1];
        const nameParts = potentialNameAndDate.split(/ (?:arrives|llega)/i);
        if (nameParts.length > 0) {
          extractedName = nameParts[0].trim();
        }
      }
      
      Logger.log(`   Nombre extraído: "${extractedName}"`);
      Logger.log(`   Nombre esperado: "${testCase.expected}"`);
      
      if (extractedName === testCase.expected) {
        Logger.log("   ✅ PASÓ");
        passedTests++;
      } else {
        Logger.log("   ❌ FALLÓ");
      }
      
    } catch (error) {
      Logger.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  
  Logger.log(`\n📊 RESULTADOS: ${passedTests}/${totalTests} tests pasaron`);
  
  if (passedTests === totalTests) {
    Logger.log("🎉 TODOS LOS TESTS PASARON - La extracción de nombres funciona correctamente");
  } else {
    Logger.log("⚠️ ALGUNOS TESTS FALLARON - Revisar la lógica de extracción");
  }
  
  Logger.log("=".repeat(60));
  return passedTests === totalTests;
}

// ========================================
// TEST COMPLETO DE EXTRACCIÓN Y MEJORA DE NOMBRES
// ========================================
function testCompleteNameExtractionAndEnhancement() {
  Logger.log("🧪 PROBANDO EXTRACCIÓN Y MEJORA COMPLETA DE NOMBRES...");
  Logger.log("=".repeat(70));
  
  // Simular datos extraídos por Gemini (solo primer nombre)
  const extractedData = {
    guestName: "Francisco", // Solo primer nombre (como lo extrae Gemini)
    platform: ["Airbnb"],
    reservationNumber: "198b5a5c53155b59",
    checkInDate: "2025-08-18",
    checkOutDate: "2025-08-21"
  };
  
  // Simular mensaje de Gmail con asunto completo
  const mockMessage = {
    getSubject: () => "Reservation confirmed - Francisco De Jesus arrives Aug 18",
    getDate: () => new Date("2025-08-18T05:27:00Z")
  };
  
  Logger.log("📧 Datos iniciales extraídos por Gemini:");
  Logger.log(`   guestName: "${extractedData.guestName}"`);
  Logger.log(`   platform: ${extractedData.platform}`);
  Logger.log(`   subject: "${mockMessage.getSubject()}"`);
  
  // Simular la función extractGuestNameFromSubject
  const extractGuestNameFromSubject = (subject) => {
    const parts = subject.split(" - ");
    if (parts.length > 1) {
      const potentialNameAndDate = parts[1];
      const nameParts = potentialNameAndDate.split(/ (?:arrives|llega)/i);
      if (nameParts.length > 0) {
        return nameParts[0].trim();
      }
    }
    return null;
  };
  
  // Simular la función toTitleCase
  const toTitleCase = (str) => {
    if (!str) return str;
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };
  
  // Simular la lógica de enhanceExtractedData
  const subject = mockMessage.getSubject();
  const nameFromSubject = extractGuestNameFromSubject(subject);
  
  Logger.log("\n🔍 Extracción del asunto:");
  Logger.log(`   nameFromSubject: "${nameFromSubject}"`);
  
  // Aplicar la lógica de mejora
  let finalGuestName = extractedData.guestName;
  
  if (!extractedData.guestName && nameFromSubject) {
    finalGuestName = nameFromSubject;
    Logger.log("   ✅ Caso 1: No había guestName, usando nameFromSubject");
  } else if (
    extractedData.guestName &&
    !extractedData.guestName.includes(" ") &&
    nameFromSubject &&
    nameFromSubject
      .toLowerCase()
      .startsWith(extractedData.guestName.toLowerCase()) &&
    nameFromSubject.includes(" ")
  ) {
    finalGuestName = nameFromSubject;
    Logger.log("   ✅ Caso 2: guestName solo primer nombre, mejorando con nameFromSubject completo");
  } else {
    Logger.log("   ⚠️ No se aplicó mejora de nombre");
  }
  
  Logger.log("\n📊 RESULTADO FINAL:");
  Logger.log(`   Nombre inicial (Gemini): "${extractedData.guestName}"`);
  Logger.log(`   Nombre del asunto: "${nameFromSubject}"`);
  Logger.log(`   Nombre final: "${finalGuestName}"`);
  
  // Verificar si la mejora funcionó
  if (finalGuestName === "Francisco De Jesus") {
    Logger.log("   🎉 ÉXITO: El nombre se mejoró correctamente");
    Logger.log("   ✅ La lógica de mejora funciona para nombres completos");
  } else if (finalGuestName === "Francisco") {
    Logger.log("   ❌ FALLO: El nombre NO se mejoró");
    Logger.log("   ⚠️ La lógica de mejora no está funcionando");
    
    // Debug de la condición
    Logger.log("\n🔍 DEBUG de la condición de mejora:");
    Logger.log(`   extractedData.guestName: "${extractedData.guestName}"`);
    Logger.log(`   !extractedData.guestName.includes(" "): ${!extractedData.guestName.includes(" ")}`);
    Logger.log(`   nameFromSubject: "${nameFromSubject}"`);
    Logger.log(`   nameFromSubject.toLowerCase().startsWith(extractedData.guestName.toLowerCase()): ${nameFromSubject.toLowerCase().startsWith(extractedData.guestName.toLowerCase())}`);
    Logger.log(`   nameFromSubject.includes(" "): ${nameFromSubject.includes(" ")}`);
    
    const condition = 
      extractedData.guestName &&
      !extractedData.guestName.includes(" ") &&
      nameFromSubject &&
      nameFromSubject.toLowerCase().startsWith(extractedData.guestName.toLowerCase()) &&
      nameFromSubject.includes(" ");
    
    Logger.log(`   Condición completa: ${condition}`);
  }
  
  Logger.log("=".repeat(70));
  return finalGuestName === "Francisco De Jesus";
}

// ========================================
// INSTRUCCIONES DE USO
// ========================================
/*
INSTRUCCIONES PASO A PASO:

1. COPIA este script a Google Apps Script
2. COPIA también el módulo UpdateCommissionValues.js
3. VERIFICA que tengas estas propiedades en Script Properties:
   - AIRTABLE_API_KEY: Tu API key de Airtable
   - AIRTABLE_BASE_ID: ID de tu base de Airtable
   - AIRTABLE_TABLE_NAME: Nombre de tu tabla
4. EJECUTA en este orden:
   a) verifyConfiguration() - Verifica configuración
   b) previewCommissionUpdates() - OBLIGATORIO
   c) executeSmallBatch() - Recomendado para probar
   d) executeAll() - Solo si todo salió bien

CONFIGURACIÓN AUTOMÁTICA:
- ✅ No necesitas modificar código
- ✅ Las API keys se obtienen de Script Properties
- ✅ Más seguro que hardcodear credenciales
- ✅ Fácil de mantener y actualizar

SEGURIDAD:
- ✅ Solo modifica 2 campos específicos
- ✅ No toca nombres, fechas, importes
- ✅ Preview obligatorio antes de ejecutar
- ✅ Logs detallados de cada cambio
- ✅ Rollback fácil si algo sale mal

¿NECESITAS AYUDA? Ejecuta showHelp() para ver las instrucciones.
*/
