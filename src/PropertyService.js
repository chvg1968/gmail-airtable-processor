/**
 * Servicio local para normalizar nombres de propiedades
 * (evitamos dependencia de Google Sheets)
 */
const PropertyService = (() => {
  const LOCAL_FALLBACK = [
    { name: "2-105 Ocean Grace Villa",    aliases: ["Ocean Grace", "Ocean Grace Villa", "Grace"] },
    { name: "2-101 Ocean Serenity Villa", aliases: ["Ocean Serenity", "Ocean Serenity Villa", "Serenity"] },
    { name: "2-208 Ocean Haven Villa",    aliases: ["Ocean Haven", "Ocean Haven Villa", "Bahia Beach Steps from Ocean 2BDRM- Ocean Haven", "Haven"] },
    { name: "2-103 Ocean Sound Villa",    aliases: ["Ocean Sound", "Ocean Sound Villa", "Sound"] },
    { name: "315 Ocean View Villa",       aliases: ["Ocean View", "Ocean View Villa", "View"] },
    { name: "3325 Villa Clara",           aliases: ["Villa Clara", "Clara"] },
    { name: "10180 Villa Flora",          aliases: ["Villa Flora", "Flora"] },
    { name: "7256 Villa Palacio",         aliases: ["Villa Palacio", "Palacio"] },
    { name: "5138 Villa Paloma",          aliases: ["Villa Paloma", "Paloma"] },
    { name: "10389 Villa Tiffany",        aliases: ["Villa Tiffany", "Tiffany"] },
    { name: "Atl. G7 Casa Prestige",      aliases: ["Casa Prestige", "Prestige"] },
    { name: "Est. 24 Casa Paraiso",       aliases: ["Casa Paraiso", "Paraiso"] },
    { name: "Temporal",                   aliases: ["Temporal"] }
  ];

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .trim();
  }

  function tryMatchByAliases(text) {
    const clean = normalize(text);
    for (const p of LOCAL_FALLBACK) {
      for (const alias of p.aliases) {
        if (clean.includes(normalize(alias))) return { name: p.name, aliasMatched: alias };
      }
    }
    return null;
  }

  const PlatformStrategies = {
    Vrbo: function (raw) {
      // En Vrbo/Lodgify, después de un guion suele ir el alias definitorio
      // Ej.: "Bahia Beach Steps from Ocean 2BDRM- Ocean Haven" → "Ocean Haven"
      const part = String(raw || "").split("-").pop();
      return tryMatchByAliases(part) || tryMatchByAliases(raw);
    },
    Lodgify: function (raw) {
      return PlatformStrategies.Vrbo(raw);
    },
    Airbnb: function (raw) {
      // Airbnb usa alias más cortos; buscar en todo el string
      return tryMatchByAliases(raw);
    },
    default: function (raw) {
      return tryMatchByAliases(raw);
    }
  };

  function findPropertyMapping(platform, input) {
    if (!input) return { name: "Temporal", aliasMatched: null };
    const strat = PlatformStrategies[platform] || PlatformStrategies.default;
    const match = strat(input);
    return match || { name: "Temporal", aliasMatched: null };
  }

  function normalizePropertyName(input, platform) {
    return findPropertyMapping(platform, input).name;
  }

  return { normalizePropertyName, findPropertyMapping };
})();