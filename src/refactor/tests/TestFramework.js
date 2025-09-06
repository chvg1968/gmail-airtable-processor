// === SIMPLE TEST FRAMEWORK ===
// Framework básico para pruebas unitarias en Google Apps Script

class TestFramework {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  /**
   * Registra una nueva prueba
   * @param {string} name - Nombre de la prueba
   * @param {Function} testFn - Función de prueba
   */
  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  /**
   * Ejecuta todas las pruebas registradas
   */
  runAll() {
    Logger.log("=== INICIANDO PRUEBAS UNITARIAS ===");
    
    for (const { name, testFn } of this.tests) {
      try {
        Logger.log(`\n🧪 Ejecutando: ${name}`);
        testFn();
        this.results.push({ name, status: "PASS", error: null });
        Logger.log(`✅ PASS: ${name}`);
      } catch (error) {
        this.results.push({ name, status: "FAIL", error: error.message });
        Logger.log(`❌ FAIL: ${name} - ${error.message}`);
      }
    }

    this.printSummary();
  }

  /**
   * Imprime resumen de resultados
   */
  printSummary() {
    const passed = this.results.filter(r => r.status === "PASS").length;
    const failed = this.results.filter(r => r.status === "FAIL").length;
    
    Logger.log("\n=== RESUMEN DE PRUEBAS ===");
    Logger.log(`✅ Pasaron: ${passed}`);
    Logger.log(`❌ Fallaron: ${failed}`);
    Logger.log(`📊 Total: ${this.results.length}`);
    
    if (failed > 0) {
      Logger.log("\n=== PRUEBAS FALLIDAS ===");
      this.results
        .filter(r => r.status === "FAIL")
        .forEach(r => Logger.log(`❌ ${r.name}: ${r.error}`));
    }
  }
}

// === ASSERTION HELPERS ===

const Assert = {
  /**
   * Verifica que el valor sea verdadero
   */
  isTrue(value, message = "Expected true") {
    if (!value) {
      throw new Error(`${message}. Got: ${value}`);
    }
  },

  /**
   * Verifica que el valor sea falso
   */
  isFalse(value, message = "Expected false") {
    if (value) {
      throw new Error(`${message}. Got: ${value}`);
    }
  },

  /**
   * Verifica que dos valores sean iguales
   */
  equals(actual, expected, message = "Values should be equal") {
    if (actual !== expected) {
      throw new Error(`${message}. Expected: ${expected}, Got: ${actual}`);
    }
  },

  /**
   * Verifica que el valor sea null o undefined
   */
  isNull(value, message = "Expected null or undefined") {
    if (value != null) {
      throw new Error(`${message}. Got: ${value}`);
    }
  },

  /**
   * Verifica que el valor no sea null o undefined
   */
  isNotNull(value, message = "Expected not null") {
    if (value == null) {
      throw new Error(`${message}. Got: ${value}`);
    }
  },

  /**
   * Verifica que sea un array con longitud específica
   */
  arrayLength(array, expectedLength, message = "Array length mismatch") {
    if (!Array.isArray(array)) {
      throw new Error(`${message}. Expected array, got: ${typeof array}`);
    }
    if (array.length !== expectedLength) {
      throw new Error(`${message}. Expected length: ${expectedLength}, Got: ${array.length}`);
    }
  },

  /**
   * Verifica que el objeto tenga una propiedad específica
   */
  hasProperty(obj, property, message = `Expected object to have property`) {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`${message} '${property}'. Object is null or not an object`);
    }
    if (!(property in obj)) {
      throw new Error(`${message} '${property}'. Available properties: ${Object.keys(obj).join(', ')}`);
    }
  },

  /**
   * Verifica que se lance una excepción
   */
  throws(fn, expectedMessage = null, message = "Expected function to throw") {
    try {
      fn();
      throw new Error(`${message}. Function did not throw`);
    } catch (error) {
      if (expectedMessage && !error.message.includes(expectedMessage)) {
        throw new Error(`${message}. Expected error message to contain: "${expectedMessage}", got: "${error.message}"`);
      }
    }
  },

  /**
   * Verifica que el string contenga un substring
   */
  contains(str, substring, message = "String should contain substring") {
    if (typeof str !== 'string') {
      throw new Error(`${message}. Expected string, got: ${typeof str}`);
    }
    if (!str.includes(substring)) {
      throw new Error(`${message}. Expected "${str}" to contain "${substring}"`);
    }
  }
};

module.exports = { TestFramework, Assert };
