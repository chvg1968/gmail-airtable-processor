/* eslint-disable */
/* prettier-ignore-file */

const __IS_NODE__ = (typeof require !== 'undefined') && (typeof module !== 'undefined');

/**
 * Strategy Manager - Coordina las estrategias de procesamiento de email
 * Strategy Pattern: Contexto que selecciona y ejecuta la estrategia apropiada
 */
class StrategyManager {
  constructor() {
    this.strategies = [];
    this.loadStrategies();
  }

  /**
   * Carga todas las estrategias disponibles
   */
  loadStrategies() {
    // Airbnb Strategy
    let AirbnbStrategy;
    if (__IS_NODE__) {
      AirbnbStrategy = require('./AirbnbStrategy').AirbnbStrategy;
    } else {
      AirbnbStrategy = globalThis.AirbnbStrategy;
    }
    if (AirbnbStrategy) {
      this.strategies.push(new AirbnbStrategy());
    }

    // Lodgify Strategy
    let LodgifyStrategy;
    if (__IS_NODE__) {
      LodgifyStrategy = require('./LodgifyStrategy').LodgifyStrategy;
    } else {
      LodgifyStrategy = globalThis.LodgifyStrategy;
    }
    if (LodgifyStrategy) {
      this.strategies.push(new LodgifyStrategy());
    }

    // Vrbo Strategy
    let VrboStrategy;
    if (__IS_NODE__) {
      VrboStrategy = require('./VrboStrategy').VrboStrategy;
    } else {
      VrboStrategy = globalThis.VrboStrategy;
    }
    if (VrboStrategy) {
      this.strategies.push(new VrboStrategy());
    }
  }

  /**
   * Procesa un email usando la estrategia apropiada
   * @param {string} from - Remitente
   * @param {string} subject - Asunto
   * @param {string} body - Cuerpo
   * @returns {Object|null} Resultado del procesamiento
   */
  processEmail(from, subject, body) {
    const logger = this.getLogger();

    // Encontrar estrategia que pueda procesar este email
    const strategy = this.findStrategy(from, subject);

    if (!strategy) {
      logger?.debug('No se encontró estrategia para procesar email', { from, subject });
      return null;
    }

    logger?.info(`Usando estrategia ${strategy.getPlatformName()}`, { subject });

    // Procesar con la estrategia seleccionada
    return strategy.process(from, subject, body);
  }

  /**
   * Encuentra la estrategia apropiada para el email
   * @param {string} from - Remitente
   * @param {string} subject - Asunto
   * @returns {EmailProcessingStrategy|null} Estrategia o null
   */
  findStrategy(from, subject) {
    for (const strategy of this.strategies) {
      if (strategy.canProcess(from, subject)) {
        return strategy;
      }
    }
    return null;
  }

  /**
   * Obtiene la lista de plataformas soportadas
   * @returns {string[]} Nombres de plataformas
   */
  getSupportedPlatforms() {
    return this.strategies.map(strategy => strategy.getPlatformName());
  }

  /**
   * Verifica si una plataforma está soportada
   * @param {string} platform - Nombre de la plataforma
   * @returns {boolean}
   */
  isPlatformSupported(platform) {
    return this.getSupportedPlatforms().includes(platform);
  }

  /**
   * Health check del Strategy Manager
   * @returns {Object} Estado del manager
   */
  healthCheck() {
    return {
      strategiesLoaded: this.strategies.length,
      supportedPlatforms: this.getSupportedPlatforms(),
      status: this.strategies.length > 0 ? 'ready' : 'no_strategies'
    };
  }

  // Método auxiliar para obtener logger
  getLogger() {
    if (__IS_NODE__) {
      try {
        return require('../utils/SimpleLogger').SimpleLogger;
      } catch {
        return null;
      }
    } else {
      return globalThis.SimpleLogger;
    }
  }
}

// Instancia singleton
let instance = null;

function getStrategyManager() {
  if (!instance) {
    instance = new StrategyManager();
  }
  return instance;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StrategyManager, getStrategyManager };
} else if (typeof globalThis !== 'undefined') {
  globalThis.StrategyManager = StrategyManager;
  globalThis.getStrategyManager = getStrategyManager;
}