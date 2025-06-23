import { findPropertyMapping } from "../propertyMapping";
import {
  airbnbPropertyMappings,
  vrboPropertyMappings,
} from "../../data/propertyMappings";

describe("findPropertyMapping", () => {
  // Pruebas para Airbnb
  describe("Airbnb", () => {
    it("debe devolver el nombre mapeado cuando el alias coincide exactamente", () => {
      const result = findPropertyMapping(
        "Villa Clara", // accommodationNameFromGemini
        null, // propertyCodeVrboFromGemini
        "airbnb", // platform
        airbnbPropertyMappings,
        [],
      );
      expect(result).toBe("3325 Villa Clara");
    });

    it("debe manejar mayúsculas y minúsculas en el nombre de la propiedad", () => {
      const result = findPropertyMapping(
        "villa clara", // En minúsculas
        null,
        "AIRBNB", // En mayúsculas
        airbnbPropertyMappings,
        [],
      );
      expect(result).toBe("3325 Villa Clara");
    });

    it("debe devolver el nombre original si no encuentra un mapeo", () => {
      const result = findPropertyMapping(
        "Propiedad Inexistente",
        null,
        "airbnb",
        airbnbPropertyMappings,
        [],
      );
      expect(result).toBe("Propiedad Inexistente");
    });

    it("debe devolver null si accommodationNameFromGemini es null", () => {
      const result = findPropertyMapping(
        null,
        null,
        "airbnb",
        airbnbPropertyMappings,
        [],
      );
      expect(result).toBeNull();
    });
  });

  // Pruebas para Vrbo
  describe("Vrbo", () => {
    it("debe devolver el nombre mapeado cuando el código coincide exactamente", () => {
      const result = findPropertyMapping(
        null,
        "4574967", // Código de propiedad Vrbo
        "vrbo",
        [],
        vrboPropertyMappings,
      );
      expect(result).toBe("2-105 Ocean Grace Villa");
    });

    it("debe manejar códigos con símbolo #", () => {
      const result = findPropertyMapping(
        null,
        "#4574967", // Código con #
        "vrbo",
        [],
        vrboPropertyMappings,
      );
      expect(result).toBe("2-105 Ocean Grace Villa");
    });

    it("debe devolver el código limpio si no encuentra un mapeo", () => {
      const result = findPropertyMapping(
        null,
        "9999999", // Código que no existe
        "vrbo",
        [],
        vrboPropertyMappings,
      );
      expect(result).toBe("9999999");
    });

    it("debe devolver null si propertyCodeVrboFromGemini es null", () => {
      const result = findPropertyMapping(
        null,
        null,
        "vrbo",
        [],
        vrboPropertyMappings,
      );
      expect(result).toBeNull();
    });
  });

  // Pruebas para casos sin plataforma
  describe("Sin plataforma", () => {
    it("debe devolver accommodationNameFromGemini si está disponible", () => {
      const result = findPropertyMapping(
        "Nombre de Airbnb",
        "Código Vrbo",
        null, // Sin plataforma
        airbnbPropertyMappings,
        vrboPropertyMappings,
      );
      expect(result).toBe("Nombre de Airbnb");
    });

    it("debe devolver propertyCodeVrboFromGemini si accommodationNameFromGemini no está disponible", () => {
      const result = findPropertyMapping(
        null,
        "Código Vrbo",
        null, // Sin plataforma
        airbnbPropertyMappings,
        vrboPropertyMappings,
      );
      expect(result).toBe("Código Vrbo");
    });

    it("debe devolver null si ambos parámetros son null", () => {
      const result = findPropertyMapping(
        null,
        null,
        null, // Sin plataforma
        airbnbPropertyMappings,
        vrboPropertyMappings,
      );
      expect(result).toBeNull();
    });
  });

  // Pruebas para plataformas desconocidas
  describe("Plataforma desconocida", () => {
    it("debe comportarse como si no hubiera plataforma", () => {
      const result = findPropertyMapping(
        "Nombre de Propiedad",
        "Código Desconocido",
        "booking", // Plataforma desconocida
        airbnbPropertyMappings,
        vrboPropertyMappings,
      );
      expect(result).toBe("Nombre de Propiedad");
    });
  });

  // Pruebas para coincidencia parcial en nombres de Airbnb
  describe("Coincidencia parcial para Airbnb", () => {
    it("debe manejar coincidencias parciales en los nombres de Airbnb", () => {
      // 'Ocean Bliss' debería coincidir con '2-102 Ocean Bliss Villa'
      const result = findPropertyMapping(
        "Reserva en Ocean Bliss para 2 personas",
        null,
        "airbnb",
        airbnbPropertyMappings,
        [],
      );
      expect(result).toBe("2-102 Ocean Bliss Villa");
    });
  });
});
