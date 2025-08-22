/**
 * Módulo independiente para actualizar campos de comisiones en registros existentes
 * - Solo actualiza "Vrbo value 1 or Airbnb value" y "Vrbo value 2"
 * - Busca registros desde 1 Junio 2025
 * - Preview antes de ejecutar
 * - No modifica otros campos existentes
 */
/* global UrlFetchApp, Logger, CONFIG, Utils, GmailApp */

const UpdateCommissionValues = (() => {
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
    const filterFormula = `AND(
      IS_AFTER({Check-in Date}, '${START_DATE}'),
      {Gmail Message ID} != '',
      OR({Platform} = 'Vrbo', {Platform} = 'Airbnb')
    )`;

    const url = `${baseUrl}?filterByFormula=${encodeURIComponent(filterFormula)}&fields[]=Platform&fields[]=Gmail Message ID&fields[]=Check-in Date&fields[]=Accommodation&fields[]=Resort Fee&fields[]=Cleaning Fee&fields[]=Taxes&fields[]=Vrbo value 1 or Airbnb value&fields[]=Vrbo value 2`;

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
      // Vrbo: Value1 = (Accommodation + Resort Fee + Cleaning Fee + Taxes) * 3%
      //       Value2 = (Accommodation + Resort Fee + Taxes) * 5%
      const accommodation = Utils.sanitizeMoneyUSD(fields.Accommodation || 0);
      const resortFee = Utils.sanitizeMoneyUSD(fields["Resort Fee"] || 0);
      const cleaningFee = Utils.sanitizeMoneyUSD(fields["Cleaning Fee"] || 0);
      const taxes = Utils.sanitizeMoneyUSD(fields.Taxes || 0);

      newValue1 = Utils.sanitizeMoneyUSD(
        (accommodation + resortFee + cleaningFee + taxes) * 0.03
      );
      newValue2 = Utils.sanitizeMoneyUSD(
        (accommodation + resortFee + taxes) * 0.05
      );

      Logger.log(
        `[UpdateCommissionValues] Vrbo calculado: Value1=$${newValue1}, Value2=$${newValue2}`
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

  // Función de validación del módulo
  function validateModule() {
    Logger.log("[UpdateCommissionValues] 🔍 Validando módulo...");
    
    const checks = {
      extractAirbnbHostServiceFee: typeof extractAirbnbHostServiceFee === 'function',
      previewCommissionUpdates: typeof previewCommissionUpdates === 'function',
      executeCommissionUpdates: typeof executeCommissionUpdates === 'function',
      Utils: typeof Utils !== 'undefined',
      GmailApp: typeof GmailApp !== 'undefined',
      UrlFetchApp: typeof UrlFetchApp !== 'undefined'
    };
    
    Logger.log("[UpdateCommissionValues] 📋 Estado de dependencias:");
    Object.entries(checks).forEach(([name, available]) => {
      Logger.log(`   ${name}: ${available ? '✅' : '❌'}`);
    });
    
    const allAvailable = Object.values(checks).every(check => check);
    Logger.log(`[UpdateCommissionValues] ${allAvailable ? '✅' : '❌'} Módulo ${allAvailable ? 'válido' : 'con problemas'}`);
    
    return allAvailable;
  }

  // Retornar objeto con todas las funciones exportadas
  return {
    previewCommissionUpdates,
    executeCommissionUpdates,
    extractAirbnbHostServiceFee,
    validateModule,
  };
})();
