/* eslint-disable */
/* prettier-ignore-file */

/**
 * Contenedor de Dependencias - Centraliza la gestión de dependencias
 * Reemplaza el uso excesivo de globalThis con un sistema más organizado
 */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
    this.initialized = false;
  }

  /**
   * Registra una dependencia en el contenedor
   * @param {string} name - Nombre de la dependencia
   * @param {Function} factory - Función que crea la dependencia
   */
  register(name, factory) {
    this.dependencies.set(name, factory);
  }

  /**
   * Obtiene una dependencia del contenedor
   * @param {string} name - Nombre de la dependencia
   * @returns {*} La dependencia resuelta
   */
  get(name) {
    const factory = this.dependencies.get(name);
    if (!factory) {
      throw new Error(`Dependencia no registrada: ${name}`);
    }
    return factory();
  }

  /**
   * Inicializa todas las dependencias para el entorno actual
   */
  initialize() {
    if (this.initialized) return;

    // Registrar dependencias según el entorno
    this.registerDependencies();
    this.initialized = true;
  }

  /**
   * Registra todas las dependencias del sistema
   */
  registerDependencies() {
    // Utilidades compartidas
    this.register('SharedUtils', () => this.loadModule('../shared/SharedUtils', 'SharedUtils'));
    this.register('Constants', () => this.loadModule('../shared/Constants', 'CONSTANTS'));

    // Servicios
    this.register('EmailService', () => this.loadModule('./EmailService', 'EmailService'));
    this.register('AirtableService', () => this.loadModule('./AirtableService', 'AirtableService'));
    this.register('PropertyService', () => this.loadModule('./PropertyService', 'PropertyService'));

    // Procesadores
    this.register('SimpleEmailProcessor', () => this.loadModule('./processors/SimpleEmailProcessor', 'SimpleEmailProcessor'));
    this.register('EmailProcessor', () => this.loadModule('./core/EmailProcessor', 'EmailProcessor'));

    // Utilidades
    this.register('SimpleLogger', () => this.loadModule('./utils/SimpleLogger', 'SimpleLogger'));
    this.register('DateUtils', () => this.loadModule('./utils/DateUtils', 'DateUtils'));
    this.register('EmailFilters', () => this.loadModule('./filters/EmailFilters', 'EmailFilters'));
    this.register('DuplicateDetector', () => this.loadModule('./duplicates/DuplicateDetector', 'DuplicateDetector'));

    // Configuración
    this.register('CONFIG', () => this.loadModule('./Config', 'CONFIG'));
    this.register('Utils', () => this.loadModule('./Utils', 'Utils'));
  }

  /**
   * Carga un módulo de manera segura para ambos entornos
   * @param {string} path - Ruta del módulo
   * @param {string} globalName - Nombre global para GAS
   * @returns {*} El módulo cargado
   */
  loadModule(path, globalName) {
    try {
      if (__IS_NODE__) {
        // Node.js: usar require
        if (path.endsWith('.js')) {
          return require(path);
        } else {
          // Para módulos que exportan un objeto específico
          const module = require(path);
          return module[globalName] || module;
        }
      } else {
        // GAS: usar globalThis
        if (typeof globalThis[globalName] !== 'undefined') {
          return globalThis[globalName];
        }
        throw new Error(`Módulo no disponible en GAS: ${globalName}`);
      }
    } catch (error) {
      console.error(`Error cargando módulo ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Verifica si todas las dependencias críticas están disponibles
   * @returns {Object} Estado de las dependencias
   */
  healthCheck() {
    const criticalDeps = ['CONFIG', 'SimpleLogger', 'EmailService', 'AirtableService'];
    const status = {
      initialized: this.initialized,
      dependencies: {}
    };

    for (const dep of criticalDeps) {
      try {
        this.get(dep);
        status.dependencies[dep] = 'available';
      } catch (error) {
        status.dependencies[dep] = 'missing';
      }
    }

    return status;
  }
}

// Instancia singleton del contenedor
const container = new DependencyContainer();

// Inicializar automáticamente
container.initialize();

// Export para Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DependencyContainer: container };
}

// Disponible globalmente para GAS
if (typeof globalThis !== 'undefined') {
  globalThis.DependencyContainer = container;
}