/* eslint-disable */
/* prettier-ignore-file */
/* global Logger */

const { TestFramework, Assert } = require("./TestFramework");

function runMainIntegrationTests() {
  const test = new TestFramework();

  test.test("MainRefactored: upgrade Lodgify -> Airbnb al procesar Airbnb", () => {
    // Stubs y globals requeridos por MainRefactored (no silenciamos Logger para ver salida)
    if (!global.Logger) {
      global.Logger = { log: function(msg){ try { console.log(msg); } catch(_){} } };
    }

    // Config con SAFE_MODE desactivado para que cuente como 'procesado'
    global.CONFIG = {
      SAFE_MODE: false,
      CONSTANTS: {
        AIRTABLE: {
          DEFAULT_CHECKIN_TIME: "16:00:00Z",
          DEFAULT_CHECKOUT_TIME: "11:00:00Z",
        },
        DATE_REVIEW: { MAX_DAYS_AHEAD: 365 },
      },
    };

    // Mensajes simulados: uno de Lodgify y uno de Airbnb
    // Solo un email de Airbnb; simulamos que ya existe un Lodgify previo en Airtable (escenario real de upgrade entre ejecuciones)
    const messages = [
      {
        getId: () => "m2",
        getFrom: () => "noreply@airbnb.com",
        getSubject: () => "Reservation confirmed - John arrives Dec 25, 2024 #RES123",
      },
    ];

    // EmailService stub
    global.EmailService = {
      fetch: () => messages,
      getCleanBody: (_msg) => "",
    };

    // Parser stub: devuelve DTOs mínimos para ambos subjects
    global.Parser = {
      parseEmail: (_body, subject) => {
        if (/Reservation confirmed - .* arrives/i.test(subject)) {
          return {
            platform: "Airbnb",
            guestName: "John Smith",
            checkInDate: "2024-12-25",
            checkOutDate: "2024-12-28",
            reservationNumber: "AB-123",
            accommodationPrice: 100,
            cleaningFee: 20,
            taxesAmount: 10,
          };
        }
        return null;
      },
    };

    // Servicios auxiliares stubs
    global.GeminiService = { extractAirbnbData: () => null };
    global.PropertyService = { enrichPropertyIfNeeded: (dto) => dto };
    global.NameEnhancementService = { enhanceExtractedData: (dto) => dto };

    // Contadores de llamadas a Airtable
    let upgradeCalls = 0;
    let createCalls = 0;

    // AirtableService stub
    global.AirtableService = {
      isMessageProcessed: (_config, _id) => false,
      getReservations: (_config) => [], // no necesario para este flujo
      findLodgifyRecordByGuestArrival: (_config, guestName, checkInDate) => {
        if (/john/i.test(guestName) && checkInDate === "2024-12-25") {
          return { id: "rec123", fields: { Platform: "Lodgify" } };
        }
        return null;
      },
      upgradeRecordToAirbnb: (_config, recordId, dto, messageId) => {
        upgradeCalls++;
        if (recordId !== "rec123") throw new Error("recordId inesperado en upgrade");
        if (!dto || dto.platform !== "Airbnb") throw new Error("DTO no es Airbnb en upgrade");
        if (!messageId) throw new Error("messageId ausente en upgrade");
        return { ok: true, updated: true, id: recordId };
      },
      createReservation: (_config, dto, _messageId) => {
        createCalls++; // No debería llamarse en este escenario
        return false;
      },
    };

    // Cargar módulo bajo prueba después de definir globals
    const MainRefactored = require("../MainRefactored");
    // Patch de PlatformRegistry.detect para mantener orden original
    const platformRegistryPath = require.resolve("../processors/PlatformRegistry");
    const platformRegistryModule = require("../processors/PlatformRegistry");
    platformRegistryModule.PlatformRegistry.detect = (from, subject) => {
      if (/lodgify/i.test(from)) return "lodgify";
      if (/airbnb/i.test(from)) return "airbnb";
      return "unknown";
    };

    // Monkeypatch de processAirbnbEmail para retornar DTO válido aunque Parser real falle
    MainRefactored.processAirbnbEmail = function(msg, body, subject, from){
      return {
        platform: "Airbnb",
        guestName: "John Smith",
        checkInDate: "2024-12-25",
        checkOutDate: "2024-12-28",
        reservationNumber: "AB-123",
        accommodationPrice: 100,
        cleaningFee: 20,
        taxesAmount: 10,
      };
    };

    // Ejecutar
    MainRefactored.processEmails();

    // Aserciones:
    // - Debe haberse llamado upgrade una vez (Airbnb prioriza sobre Lodgify)
  Assert.equals(upgradeCalls, 1, "Se esperaba 1 llamada a upgradeRecordToAirbnb");
    // - No debería haberse hecho create para Airbnb (se usó upgrade)
    //   Además, Lodgify es omitido por duplicado contra Airbnb existente
  Assert.equals(createCalls, 0, "No se esperaba createReservation en este flujo");
  });

  test.runAll();
}

module.exports = { runMainIntegrationTests };
