"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Mock table object with Airtable-like methods
const mockTable = {
    create: jest.fn(),
    update: jest.fn(),
    select: jest.fn().mockReturnValue({ firstPage: jest.fn() }),
};
// mockBase is a function that returns mockTable (simula base('tableName'))
const mockBase = jest.fn(() => mockTable);
// Mock Airtable constructor, whose .base() returns mockBase (a callable)
const mockAirtableConstructor = jest.fn().mockImplementation(() => ({
    base: jest.fn(() => mockBase)
}));
jest.mock('airtable', () => ({
    __esModule: true,
    default: mockAirtableConstructor
}));
// Importamos las funciones y tipos necesarios después de configurar el mock
const airtable_1 = require("../../services/airtable");
global.mockBase = mockBase;
global.mockTable = mockTable;
global.mockAirtableConstructor = mockAirtableConstructor;
// Mock de la configuración
const mockConfig = {
    googleClientId: 'test-google-client-id',
    googleClientSecret: 'test-google-client-secret',
    googleRefreshToken: 'test-google-refresh-token',
    airtableApiKey: 'test-api-key',
    airtableBaseId: 'test-base-id',
    airtableTableName: 'test-table',
    geminiApiKey: 'test-gemini-api-key',
};
// Silenciar logs de consola para un output limpio en los tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
// Configurar los mocks para las pruebas
beforeEach(() => {
    jest.clearAllMocks();
});
// Mock de los mapeos de propiedades
jest.mock('../../data/propertyMappings', () => ({
    airbnbPropertyMappings: [
        { name: '7256 Villa Palacio', alias: '7256 Villa Palacio' },
        { name: '2-101 Ocean Serenity Villa', alias: 'Ocean Serenity Villa' },
    ],
    vrboPropertyMappings: [
        { code: '3456633', name: '5138 Villa Paloma' },
        { code: '4591129', name: '2-101 Ocean Serenity Villa' },
        { code: '3205468', name: '3325 Villa Clara' },
        { code: '3207445', name: '10180 Villa Flora' },
        { code: '3121707', name: '7256 Villa Palacio' },
        { code: '3131031', name: '10389 Villa Tiffany' },
    ],
}));
const baseBookingData = {
    guestName: 'John Doe',
    platform: ['airbnb'],
    reservationNumber: 'ABC123',
    checkInDate: '2025-01-01',
    checkOutDate: '2025-01-07',
    propertyCodeVrbo: '3456633',
    accommodationName: '7256 Villa Palacio',
    accommodationPrice: 1000,
    adults: 2,
    children: 1,
    bookingDate: '2024-01-01',
    discountAmount: 0,
    cleaningFee: 0,
    guestServiceFee: 0,
    taxesAmount: 0,
    damageProtectionFee: 0,
    baseCommissionOrHostFee: 0,
    paymentProcessingFee: 0,
};
describe('upsertBookingToAirtable', () => {
    describe('para reservas de Airbnb', () => {
        it('no debe marcar NeedsDateReview si la diferencia es menor a 330 días y el año es 2025 (caso real)', async () => {
            const testData = {
                ...baseBookingData,
                platform: ['airbnb'],
                bookingDate: '2025-06-20',
                checkInDate: '2025-07-13', // 23 días después, año explícito
            };
            await (0, airtable_1.upsertBookingToAirtable)(testData, mockConfig);
            expect(mockTable.create).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    fields: expect.objectContaining({
                        'Needs Date Review': false
                    })
                })
            ]));
        });
        it('debe establecer NeedsDateReview como true si la diferencia es mayor a 330 días', async () => {
            const testData = {
                ...baseBookingData,
                platform: ['airbnb'],
                bookingDate: '2024-01-01',
                checkInDate: '2025-12-01',
            };
            const result = await (0, airtable_1.upsertBookingToAirtable)(testData, mockConfig);
            expect(result).toBe(true);
            expect(mockTable.create).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    fields: expect.objectContaining({
                        'Needs Date Review': true
                    })
                })
            ]));
        });
        it('debe establecer NeedsDateReview como true si la diferencia es mayor a 330 días (dentro del mismo año)', async () => {
            const testData = {
                ...baseBookingData,
                platform: ['airbnb'],
                bookingDate: '2025-01-01',
                checkInDate: '2025-12-31', // 364 días
            };
            const result = await (0, airtable_1.upsertBookingToAirtable)(testData, mockConfig);
            expect(result).toBe(true);
            expect(mockTable.create).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    fields: expect.objectContaining({
                        'Needs Date Review': true
                    })
                })
            ]));
        });
        /* Caso defensivo/futuro: si Airbnb permite reservas con año 2026, debe marcar NeedsDateReview como true
        it('debe establecer NeedsDateReview como true si la fecha de llegada es en 2026', async () => {
          const testData: ExtractedBookingData = {
            guestName: 'John Doe',
            platform: ['airbnb'],
            reservationNumber: 'ABC123',
            checkInDate: '2026-01-01',
            checkOutDate: '2025-01-07',
            propertyCodeVrbo: '3456633',
            accommodationName: '7256 Villa Palacio',
            accommodationPrice: 1000,
            adults: 2,
            children: 1,
            bookingDate: '2025-06-20',
            discountAmount: 0,
            cleaningFee: 0,
            guestServiceFee: 0,
            taxesAmount: 0,
            damageProtectionFee: 0,
            baseCommissionOrHostFee: 0,
            paymentProcessingFee: 0,
          };
          const result = await upsertBookingToAirtable(testData, mockConfig);
          expect(result).toBe(true);
          expect(mockTable.create).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                fields: expect.objectContaining({
                  'Needs Date Review': true,
                  Arrival: '2026-01-01',
                })
              })
            ])
          );
        });
    
        it('debe establecer NeedsDateReview como true si la fecha de llegada es en 2025 y la diferencia es > 330 días', async () => {
          const testData: ExtractedBookingData = {
            ...baseBookingData,
            platform: ['airbnb'],
            bookingDate: '2025-01-01',
            checkInDate: '2025-12-31',
          };
          const result = await upsertBookingToAirtable(testData, mockConfig);
          expect(result).toBe(true);
          expect(mockTable.create).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                fields: expect.objectContaining({
                  'Needs Date Review': true
                })
              })
            ])
          );
        });
    
        it('debe manejar correctamente cuando no hay fecha de reserva (usar fecha actual)', async () => {
          // Mock de Date.now para que la fecha actual sea 2025-06-20
          const realDateNow = Date.now;
          Date.now = () => new Date('2025-06-20T00:00:00Z').getTime();
          const testData: ExtractedBookingData = {
            ...baseBookingData,
            platform: ['airbnb'],
            bookingDate: undefined,
            checkInDate: '2026-05-20', // 334 días después de 2025-06-20
          };
          const result = await upsertBookingToAirtable(testData, mockConfig);
          expect(result).toBe(true);
          expect(mockTable.create).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                fields: expect.objectContaining({
                  'Needs Date Review': true
                })
              })
            ])
          );
        });
      });
    
      describe('Property field mapping', () => {
        it('debe mapear correctamente Property para Airbnb', async () => {
          const testData: ExtractedBookingData = {
            ...baseBookingData,
            platform: ['airbnb'],
            accommodationName: '2-101 Ocean Serenity Villa',
          };
          await upsertBookingToAirtable(testData, mockConfig);
          expect(mockTable.create).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                fields: expect.objectContaining({
                  Property: '2-101 Ocean Serenity Villa'
                })
              })
            ])
          );
        });
    
        it('debe mapear correctamente Property para Vrbo (con código directo)', async () => {
          const testData: ExtractedBookingData = {
            ...baseBookingData,
            platform: ['vrbo'],
            propertyCodeVrbo: '3456633', // Según mappings, debe ser '5138 Villa Paloma'
          };
          await upsertBookingToAirtable(testData, mockConfig);
          expect(mockTable.create).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                fields: expect.objectContaining({
                  Property: '5138 Villa Paloma'
                })
              })
            ])
          );
        });
    
        it('debe mapear correctamente Property para Vrbo (con símbolo # en el código)', async () => {
          const testData: ExtractedBookingData = {
            ...baseBookingData,
            platform: ['vrbo'],
            propertyCodeVrbo: '#3456633', // Debe limpiar el símbolo y mapear igual
          };
          await upsertBookingToAirtable(testData, mockConfig);
          expect(mockTable.create).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                fields: expect.objectContaining({
                  Property: '5138 Villa Paloma'
                })
              })
            ])
          );
        });
        */
    });
    describe('para reservas de Vrbo', () => {
        it('debe establecer NeedsDateReview como false independientemente de las fechas', async () => {
            const testData1 = {
                ...baseBookingData,
                platform: ['vrbo'],
                bookingDate: '2024-01-01',
                checkInDate: '2025-01-01',
            };
            const testData2 = {
                ...baseBookingData,
                platform: ['vrbo'],
                bookingDate: '2025-06-20',
                checkInDate: '2026-01-01',
            };
            const testData3 = {
                ...baseBookingData,
                platform: ['vrbo'],
                bookingDate: undefined,
                checkInDate: '2025-12-31',
            };
            const result1 = await (0, airtable_1.upsertBookingToAirtable)(testData1, mockConfig);
            const result2 = await (0, airtable_1.upsertBookingToAirtable)(testData2, mockConfig);
            const result3 = await (0, airtable_1.upsertBookingToAirtable)(testData3, mockConfig);
            expect(result1).toBe(true);
            expect(result2).toBe(true);
            expect(result3).toBe(true);
            expect(mockTable.create).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    fields: expect.objectContaining({
                        'Needs Date Review': false
                    })
                })
            ]));
        });
    });
});
