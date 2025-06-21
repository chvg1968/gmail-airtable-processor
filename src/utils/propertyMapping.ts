import { AirbnbProperty, VrboProperty } from '../data/propertyMappings';

// Definición de la función findPropertyMapping
// Asegúrate de que esta función utilice los parámetros airbnbMappings y vrboMappings
// en lugar de importar directamente airbnbPropertyMappings y vrboPropertyMappings
// para facilitar las pruebas unitarias.

export function findPropertyMapping(
    accommodationNameFromGemini: string | null | undefined,
    propertyCodeVrboFromGemini: string | null | undefined,
    platform: string | null | undefined,
    airbnbMappings: AirbnbProperty[], 
    vrboMappings: VrboProperty[]     
): string | null {
    if (!platform) {
        // Si no hay plataforma, intentar devolver el nombre de Airbnb o el código de Vrbo, o null
        return accommodationNameFromGemini || propertyCodeVrboFromGemini || null;
    }

    const lowerPlatform = platform.toLowerCase();

    if (lowerPlatform.includes('airbnb')) {
        if (!accommodationNameFromGemini) return null;
        const lowerAccommodationName = accommodationNameFromGemini.toLowerCase();
        // Busca un mapeo donde el alias (en minúsculas) esté incluido en el nombre de Gemini (en minúsculas)
        const mapping = airbnbMappings.find(m =>
            lowerAccommodationName.includes(m.alias.toLowerCase())
        );
        // Si se encuentra un mapeo, devuelve el nombre mapeado; de lo contrario, el nombre original de Gemini
        return mapping ? mapping.name : accommodationNameFromGemini;
    } else if (lowerPlatform.includes('vrbo') || lowerPlatform.includes('homeaway')) {
        if (!propertyCodeVrboFromGemini) return null;
        // Limpia el código de propiedad de Vrbo (ej. remover '#')
        const cleanPropertyCode = propertyCodeVrboFromGemini.replace('#', '');
        const mapping = vrboMappings.find(m => m.code === cleanPropertyCode);
        // Si se encuentra un mapeo, devuelve el nombre mapeado; de lo contrario, el código limpio original
        return mapping ? mapping.name : cleanPropertyCode; 
    }

    // Si la plataforma no es Airbnb, Vrbo ni HomeAway, devuelve el nombre de Gemini o el código de Vrbo
    return accommodationNameFromGemini || propertyCodeVrboFromGemini || null;
}
