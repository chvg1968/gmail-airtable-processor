import Airtable from 'airtable';
import { getInitializedConfig, AppConfig } from '../config'; 
import { ExtractedBookingData } from './gemini'; // Usaremos la interfaz que ya tenemos

/**
 * Formatea una fecha en formato YYYY-MM-DD para Airtable
 * @param dateString Fecha en formato string (puede ser YYYY-MM-DD o cualquier otro formato válido)
 * @returns Fecha formateada como YYYY-MM-DD o null si la fecha no es válida
 */
function formatDateForAirtable(dateString: string | null | undefined, hourString?: string): string | null {
    if (!dateString) return null;
    try {
        // Asegurarse de que la fecha de entrada es solo YYYY-MM-DD
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);

        if (!year || !month || !day) {
            throw new Error('Formato de fecha inválido. Se esperaba YYYY-MM-DD.');
        }

        // Construir la fecha en UTC para evitar desfases de zona horaria
        const utcDate = new Date(Date.UTC(year, month - 1, day));

        if (isNaN(utcDate.getTime())) {
            console.error(`Fecha inválida: ${dateString}`);
            return null;
        }

        const finalYear = utcDate.getUTCFullYear();
        const finalMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
        const finalDay = String(utcDate.getUTCDate()).padStart(2, '0');

        let isoString = `${finalYear}-${finalMonth}-${finalDay}`;

        if (hourString) {
            isoString += `T${hourString}`;
        }

        return isoString;
    } catch (error) {
        console.error(`Error al formatear la fecha '${dateString}':`, error);
        return null;
    }
}

// Interfaz para los datos finales que enviaremos a Airtable
export interface AirtableRecordData extends Omit<ExtractedBookingData, 'propertyCodeVrbo' | 'ownerName'> {
    // Campos que SÍ irán a Airtable, deben coincidir con los nombres de las columnas en tu tabla.
    // Nota: ownerName se omite aquí porque dijiste que es opcional/blank y lo manejaremos en el mapeo.
    // Si necesitas ownerName en Airtable, añádelo aquí y en el mapeo de airtableFields.
    GuestName: string | null; // Ajustado para permitir null si Gemini lo devuelve así
    Platform: string[]; 
    ReservationNumber: string;
    CheckInDate: string; 
    CheckOutDate: string; 
    PropertyAddress: string | null;
    // Si necesitas propertyCodeVrbo en Airtable, añádelo aquí.
}

let base: Airtable.Base | null = null;
let airtableTableName: string | null = null;

async function initializeAirtable(config: AppConfig): Promise<void> {
  if (base && airtableTableName) {
    return;
  }
  base = new Airtable({ apiKey: config.airtableApiKey }).base(config.airtableBaseId);
  airtableTableName = config.airtableTableName;
  if (!airtableTableName) {
      throw new Error('Airtable table name not configured.');
  }
}

/**
 * Sube un registro de reserva a Airtable si no existe uno con el mismo reservationNumber.
 * @param rawData Los datos extraídos y mapeados, listos para ser formateados para Airtable.
 */
export async function upsertBookingToAirtable(rawData: ExtractedBookingData, config: AppConfig): Promise<boolean> {
    await initializeAirtable(config);
    if (!base || !airtableTableName) { // Chequeo de seguridad
        console.error('Airtable client not initialized.');
        throw new Error('Airtable client not initialized.');
    }
    try {
        // 1. Preparar el objeto de campos con los datos extraídos.
        // Los nombres de las claves deben coincidir EXACTAMENTE con los nombres de las columnas en Airtable.
        const airtableFields: { [key: string]: any } = {
            'Full Name': rawData.guestName,
            // Asegurarse de que Platform sea un valor de selección simple (no un array)
            'Platform': rawData.platform && Array.isArray(rawData.platform) && rawData.platform.length > 0 
                ? rawData.platform[0] 
                : 'Desconocido',
            'Reservation number': rawData.reservationNumber,
            // Asegurar que las fechas tengan el formato correcto (YYYY-MM-DD)
            'Arrival': formatDateForAirtable(rawData.checkInDate, '15:00:00'), // 3:00 pm
            'Departure Date': formatDateForAirtable(rawData.checkOutDate, '10:00:00'), // 10:00 am
            // Property field must match existing select options in Airtable exactly
            'Property': (() => {
                try {
                    const platform = rawData.platform?.[0]?.toLowerCase();
                    
                    // For Vrbo, use the exact mapped property name
                    if ((platform === 'vrbo' || platform === 'homeaway') && rawData.propertyCodeVrbo) {
                        const cleanCode = rawData.propertyCodeVrbo.replace('#', '').trim();
                        const vrboMappings = require('../data/propertyMappings').vrboPropertyMappings;
                        const vrboProperty = vrboMappings.find((p: any) => p.code === cleanCode);
                        
                        if (vrboProperty) {
                            return vrboProperty.name; // Return exact name from mappings
                        }
                    } 
                    // For Airbnb, find the exact property name from mappings
                    else if (platform === 'airbnb' && rawData.accommodationName) {
                        const airbnbMappings = require('../data/propertyMappings').airbnbPropertyMappings;
                        const airbnbProperty = airbnbMappings.find((p: any) => 
                            p.alias.toLowerCase() === rawData.accommodationName?.toLowerCase() ||
                            p.name.toLowerCase() === rawData.accommodationName?.toLowerCase()
                        );
                        if (airbnbProperty) {
                            return airbnbProperty.name; // Return exact name from mappings
                        }
                    }
                    
                    // If we get here, try to find a match in either mapping by name
                    const allMappings = [
                        ...require('../data/propertyMappings').vrboPropertyMappings,
                        ...require('../data/propertyMappings').airbnbPropertyMappings
                    ];
                    
                    const matchedProperty = allMappings.find(p => 
                        p.name.toLowerCase() === rawData.accommodationName?.toLowerCase() ||
                        (p as any).alias?.toLowerCase() === rawData.accommodationName?.toLowerCase()
                    );
                    
                    // Return the exact name from mappings if found, otherwise use the original name or default
                    return matchedProperty?.name || rawData.accommodationName || 'Unknown Property';
                } catch (error) {
                    console.error('Error determining property name:', error);
                    return 'Unknown Property';
                }
            })(),
            // Asegurar que los campos numéricos tengan un valor predeterminado de 0 si son nulos
            'Accommodation': rawData.accommodationPrice ?? 0,
            'Adults': rawData.adults ?? 0,
            'Children': rawData.children ?? 0,
            'Booking Date': rawData.bookingDate || null,
            'Discount': rawData.discountAmount ?? 0,
            'Cleaning Fee': rawData.cleaningFee ?? 0,
            'Guest Service': rawData.guestServiceFee ?? 0,
            'Taxes': rawData.taxesAmount ?? 0,
            'D. Protection': rawData.damageProtectionFee ?? 0,
            'Vrbo value 1 or Airbnb value': typeof rawData.baseCommissionOrHostFee === 'number' ? rawData.baseCommissionOrHostFee : 0,
            // Lógica especial para 'Vrbo value 2': si es 'TBD', guardar 0, si no, el valor numérico.
            'Vrbo value 2': rawData.paymentProcessingFee === 'TBD' ? 0 : rawData.paymentProcessingFee,
            // Calcular 'Needs Date Review' solo para reservas de Airbnb
            'Needs Date Review': (() => {
  try {
    if (rawData.platform?.[0]?.toLowerCase() !== 'airbnb') return false;
    if (!rawData.checkInDate) return false;

    const checkIn = new Date(rawData.checkInDate);
    const bookingDate = rawData.bookingDate ? new Date(rawData.bookingDate) : new Date();
    const days = Math.ceil((checkIn.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));
    return checkIn.getFullYear() === 2026 || days > 330;
  } catch (error) {
    console.error('Error al calcular Needs Date Review:', error);
    return false;
  }
})()
        };
        
        // 2. Limpiar el objeto de campos para no enviar valores nulos o indefinidos.
        // Esto evita errores si un campo en Airtable no está configurado para aceptar valores vacíos.
        for (const key in airtableFields) {
            if (airtableFields[key] === null || airtableFields[key] === undefined) {
                delete airtableFields[key];
            }
        }

        // 3. Verificar si ya existe un registro con el mismo número de reserva.
        const reservationNumberToSearch = rawData.reservationNumber;

        if (typeof reservationNumberToSearch !== 'string' || reservationNumberToSearch.trim() === '') {
            console.error(`ERROR Airtable: Reservation number es inválido o no proporcionado: '${String(reservationNumberToSearch)}'. No se puede buscar o crear/actualizar el registro para los datos recibidos:`, rawData);
            return false; // Indicar que la operación falló para este registro
        }

        const filterFormula = `{Reservation number} = "${reservationNumberToSearch.replace(/"/g, '\"')}"`; // Escapar comillas dobles
        console.log(`DEBUG Airtable: Buscando registro existente con Reservation number: '${reservationNumberToSearch}'`);
        console.log(`DEBUG Airtable: Usando filterByFormula: ${filterFormula}`);
        
        const existingRecords = await base(airtableTableName).select({
            filterByFormula: filterFormula,
            maxRecords: 1
        }).firstPage();

        if (existingRecords && existingRecords.length > 0) {
            console.log(`DEBUG Airtable: Encontrado ${existingRecords.length} registro(s) existente(s) para Reservation number: '${reservationNumberToSearch}'. ID del primer registro: ${existingRecords[0].id}`);
        } else {
            console.log(`DEBUG Airtable: No se encontró registro existente para Reservation number: '${reservationNumberToSearch}'. Se procederá a crear uno nuevo.`);
        }

        // 4. Validate property value against allowed options if possible
        // Note: In a production environment, you might want to fetch allowed options first
        // For now, we'll rely on the property mapping to return valid values
        
        // 5. Update existing record or create new one
        if (existingRecords && existingRecords.length > 0) {
            const existingRecord = existingRecords[0];
            const platform = rawData.platform && rawData.platform.length > 0 ? rawData.platform[0] : '';
            // Si el registro existe, lo actualizamos con los nuevos datos.
            // Esto asegura que si llega un correo más completo (ej. Instant Booking después de Reservation),
            // la información se sobrescriba.
            console.log(`INFO: Registro con ReservationNumber ${rawData.reservationNumber} ya existe. Actualizando con nuevos datos...`);
            console.log(`DEBUG Airtable: Intentando actualizar registro. Full Name a guardar: '${airtableFields['Full Name']}', ReservationNumber: ${rawData.reservationNumber}`);
            await base(airtableTableName).update(existingRecord.id, airtableFields);
            console.log(`INFO: Registro con ReservationNumber ${rawData.reservationNumber} actualizado exitosamente.`);
            return true; // Indicar que se realizó una actualización.
        } else {
            // Crear un nuevo registro si no se encontró uno existente.
            console.log(`DEBUG Airtable: Intentando crear nuevo registro. Full Name a guardar: '${airtableFields['Full Name']}', ReservationNumber: ${rawData.reservationNumber}`);
            await base(airtableTableName).create([{ fields: airtableFields }]);
            console.log(`Registro con ReservationNumber ${rawData.reservationNumber} creado exitosamente en Airtable.`);
            return true; // Indicar que se creó exitosamente
        }

    } catch (error) {
        console.error(`Error al interactuar con Airtable para ReservationNumber ${rawData.reservationNumber}:`, error);
        return false; // Indicar que hubo un error y se omitió la escritura efectiva
    }
}
