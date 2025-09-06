/* global Logger */

// === PRUEBAS UNITARIAS PARA DUPLICATE DETECTOR ===
// Explorando casos críticos de detección de duplicados

const { TestFramework, Assert } = require("./TestFramework");
const DuplicateDetector = require("../duplicates/DuplicateDetector");

function runDuplicateDetectorTests() {
  const test = new TestFramework();

  // === ¿QUÉ PASA SI... hay nombres con variaciones? ===

  test.test("¿Qué pasa si un nombre tiene espacios extra?", () => {
    const name1 = DuplicateDetector.normalizeName("  John   Smith  ");
    const name2 = DuplicateDetector.normalizeName("John Smith");
    Assert.equals(name1, name2, "Nombres con espacios extra deberían ser iguales");
  });

  test.test("¿Qué pasa si hay diferencias de mayúsculas?", () => {
    const name1 = DuplicateDetector.normalizeName("MARIA GONZALEZ");
    const name2 = DuplicateDetector.normalizeName("maria gonzalez");
    Assert.equals(name1, name2, "Mayúsculas y minúsculas deberían ser iguales");
  });

  test.test("¿Qué pasa si el nombre es null?", () => {
    const result = DuplicateDetector.normalizeName(null);
    Assert.equals(result, "", "Nombre null debería retornar string vacío");
  });

  test.test("¿Qué pasa si el nombre es un número?", () => {
    const result = DuplicateDetector.normalizeName(123);
    Assert.equals(result, "", "Número como nombre debería retornar string vacío");
  });

  // === ¿QUÉ PASA SI... hay fechas en diferentes formatos? ===

  test.test("¿Qué pasa si la fecha es en formato ISO?", () => {
    const result = DuplicateDetector.normalizeDate("2024-12-25");
    Assert.equals(result, "2024-12-25", "Fecha ISO debería mantenerse igual");
  });

  test.test("¿Qué pasa si la fecha es en formato US?", () => {
    const result = DuplicateDetector.normalizeDate("12/25/2024");
    Assert.equals(result, "2024-12-25", "Fecha US debería convertirse a ISO");
  });

  test.test("¿Qué pasa si la fecha es un objeto Date?", () => {
    const dateObj = new Date("2024-12-25");
    const result = DuplicateDetector.normalizeDate(dateObj);
    Assert.equals(result, "2024-12-25", "Objeto Date debería convertirse a ISO");
  });

  test.test("¿Qué pasa si la fecha es inválida?", () => {
    const result = DuplicateDetector.normalizeDate("fecha-invalida");
    Assert.isNull(result, "Fecha inválida debería retornar null");
  });

  test.test("¿Qué pasa si la fecha es null?", () => {
    const result = DuplicateDetector.normalizeDate(null);
    Assert.isNull(result, "Fecha null debería retornar null");
  });

  // === ¿QUÉ PASA SI... detectamos duplicados con datos reales? ===

  test.test("¿Qué pasa si Lodgify tiene mismo guest y fecha que Airbnb?", () => {
    const lodgifyReservation = {
      firstName: "John",
      arrivalDate: "2024-12-25"
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "John",
          "Check-in": "2024-12-25"
        }
      }
    ];

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation, 
      existingRecords
    );
    Assert.isTrue(result, "Debería detectar duplicado exacto");
  });

  test.test("¿Qué pasa si los nombres son similares pero las fechas diferentes?", () => {
    const lodgifyReservation = {
      firstName: "John", 
      arrivalDate: "2024-12-25"
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "John",
          "Check-in": "2024-12-26" // Fecha diferente
        }
      }
    ];

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      existingRecords
    );
    Assert.isFalse(result, "NO debería detectar duplicado si fechas son diferentes");
  });

  test.test("¿Qué pasa si las fechas son iguales pero nombres diferentes?", () => {
    const lodgifyReservation = {
      firstName: "John",
      arrivalDate: "2024-12-25"
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "Jane", // Nombre diferente
          "Check-in": "2024-12-25"
        }
      }
    ];

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      existingRecords
    );
    Assert.isFalse(result, "NO debería detectar duplicado si nombres son diferentes");
  });

  // === ¿QUÉ PASA SI... hay datos faltantes? ===

  test.test("¿Qué pasa si la reserva de Lodgify no tiene firstName?", () => {
    const lodgifyReservation = {
      arrivalDate: "2024-12-25"
      // firstName faltante
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "John",
          "Check-in": "2024-12-25"
        }
      }
    ];

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      existingRecords
    );
    Assert.isFalse(result, "Sin firstName NO debería detectar duplicado");
  });

  test.test("¿Qué pasa si el registro existente no tiene fields?", () => {
    const lodgifyReservation = {
      firstName: "John",
      arrivalDate: "2024-12-25"
    };

    const existingRecords = [
      { /* sin fields */ }
    ];

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      existingRecords
    );
    Assert.isFalse(result, "Sin fields NO debería detectar duplicado");
  });

  test.test("¿Qué pasa si existingRecords es array vacío?", () => {
    const lodgifyReservation = {
      firstName: "John",
      arrivalDate: "2024-12-25"
    };

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      []
    );
    Assert.isFalse(result, "Array vacío NO debería detectar duplicados");
  });

  test.test("¿Qué pasa si existingRecords es null?", () => {
    const lodgifyReservation = {
      firstName: "John", 
      arrivalDate: "2024-12-25"
    };

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      lodgifyReservation,
      null
    );
    Assert.isFalse(result, "Records null NO debería detectar duplicados");
  });

  // === ¿QUÉ PASA SI... usamos findDuplicateBy con múltiples criterios? ===

  test.test("¿Qué pasa si buscamos por firstName Y arrivalDate?", () => {
    const newReservation = {
      firstName: "John",
      arrivalDate: "2024-12-25",
      email: "john@example.com"
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "John",
          "Check-in": "2024-12-25",
          "Email": "different@example.com"
        }
      }
    ];

    const result = DuplicateDetector.findDuplicateBy(
      newReservation,
      existingRecords,
      ["firstName", "arrivalDate"]
    );

    Assert.isNotNull(result, "Debería encontrar duplicado por firstName + arrivalDate");
  });

  test.test("¿Qué pasa si agregamos criterio de email que no coincide?", () => {
    const newReservation = {
      firstName: "John",
      arrivalDate: "2024-12-25", 
      email: "john@example.com"
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "John",
          "Check-in": "2024-12-25",
          "Email": "different@example.com"
        }
      }
    ];

    const result = DuplicateDetector.findDuplicateBy(
      newReservation,
      existingRecords,
      ["firstName", "arrivalDate", "email"]
    );

    Assert.isNull(result, "NO debería encontrar duplicado si email no coincide");
  });

  // === ¿QUÉ PASA SI... generamos IDs de reserva? ===

  test.test("¿Qué pasa si generamos ID con criterios básicos?", () => {
    const reservation = {
      firstName: "John Smith",
      arrivalDate: "2024-12-25"
    };

    const id = DuplicateDetector.generateReservationId(reservation);
    Assert.equals(id, "john smith|2024-12-25", "ID debería combinar criterios normalizados");
  });

  test.test("¿Qué pasa si incluimos email en el ID?", () => {
    const reservation = {
      firstName: "John",
      arrivalDate: "2024-12-25",
      email: "JOHN@EXAMPLE.COM"
    };

    const id = DuplicateDetector.generateReservationId(
      reservation,
      ["firstName", "arrivalDate", "email"]
    );
    Assert.equals(id, "john|2024-12-25|john@example.com", "ID debería incluir email normalizado");
  });

  test.test("¿Qué pasa si hay campos faltantes en el ID?", () => {
    const reservation = {
      firstName: "John"
      // arrivalDate faltante
    };

    const id = DuplicateDetector.generateReservationId(reservation);
    Assert.equals(id, "john", "ID debería excluir campos faltantes");
  });

  // Ejecutar pruebas
  test.runAll();
}

// === CASOS EDGE EXTREMOS ===

function runExtremeEdgeCases() {
  const test = new TestFramework();

  test.test("🚨 ¿Qué pasa si hay nombres con caracteres especiales?", () => {
    const name1 = DuplicateDetector.normalizeName("José María Ñoño");
    const name2 = DuplicateDetector.normalizeName("JOSÉ MARÍA ÑOÑO");
    Assert.equals(name1, name2, "Caracteres especiales deberían normalizarse");
  });

  test.test("🚨 ¿Qué pasa si la fecha es '31/02/2024' (inválida)?", () => {
    const result = DuplicateDetector.normalizeDate("31/02/2024");
    Assert.isNull(result, "Fecha imposible debería retornar null");
  });

  test.test("🚨 ¿Qué pasa si comparamos fechas de años diferentes?", () => {
    const reservation = {
      firstName: "John",
      arrivalDate: "2024-12-25"
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "John",
          "Check-in": "2025-12-25" // Año diferente
        }
      }
    ];

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      reservation,
      existingRecords
    );
    Assert.isFalse(result, "Años diferentes NO deberían ser duplicados");
  });

  test.test("🚨 ¿Qué pasa con múltiples registros existentes?", () => {
    const reservation = {
      firstName: "John",
      arrivalDate: "2024-12-25"
    };

    const existingRecords = [
      {
        fields: {
          "First Name": "Jane",
          "Check-in": "2024-12-25"
        }
      },
      {
        fields: {
          "First Name": "John",
          "Check-in": "2024-12-24"
        }
      },
      {
        fields: {
          "First Name": "John",
          "Check-in": "2024-12-25" // Este coincide
        }
      }
    ];

    const result = DuplicateDetector.shouldSkipLodgifyDuplicate(
      reservation,
      existingRecords
    );
    Assert.isTrue(result, "Debería encontrar coincidencia en múltiples registros");
  });

  test.runAll();
}

module.exports = {
  runDuplicateDetectorTests,
  runExtremeEdgeCases
};
