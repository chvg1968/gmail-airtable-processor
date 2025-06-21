# Gmail Airtable Processor

## Descripción

Este proyecto automatiza la integración entre reservas recibidas por correo electrónico (Airbnb, Vrbo, etc.) y una base de datos de Airtable. Procesa la información de las reservas, la transforma según reglas de negocio y la sincroniza con Airtable, facilitando la gestión y revisión de reservas a futuro.

## Características principales
- Extracción y transformación de datos de reservas desde emails.
- Lógica robusta para el campo **"Needs Date Review"**:
  - Solo para Airbnb: verdadero si el año de check-in es 2026 o la diferencia entre check-in y bookingDate es mayor a 330 días.
  - Para Vrbo siempre es falso.
- Mapeo automático de propiedades usando nombres canónicos.
- Pruebas unitarias con mocks avanzados de Airtable.
- Validación y defensividad ante cambios futuros en formatos de fechas.

## Estructura del proyecto

```
├── src/
│   ├── services/
│   │   └── airtable.ts         # Lógica principal de integración y reglas de negocio
│   ├── utils/
│   │   └── __tests__/
│   │       └── airtable.test.ts # Pruebas unitarias
│   └── data/
│       └── propertyMappings.ts # Utilidades de mapeo de propiedades
├── .env.example                # Variables de entorno requeridas
├── package.json
├── README.md
└── ...
```

## Instalación

1. Clona el repositorio:
   ```sh
   git clone https://github.com/chvg1968/gmail-airtable-processor.git
   cd gmail-airtable-processor
   ```
2. Instala dependencias:
   ```sh
   npm install
   ```
3. Crea un archivo `.env` basado en `.env.example` y rellena tus credenciales de Airtable y Google.

## Ejecución

- **Procesamiento principal:**
  ```sh
  npm start
  ```
- **Pruebas unitarias:**
  ```sh
  npm test
  # o para un archivo específico
  npx jest src/utils/__tests__/airtable.test.ts
  ```

## Tests unitarios

Los tests unitarios aseguran que la lógica de integración y las reglas de negocio se mantengan correctas ante cambios y refactorizaciones. Están escritos con **Jest** y usan mocks avanzados para simular la API de Airtable y el entorno de fechas.

### ¿Qué pruebas cubren?

1. **Lógica de "Needs Date Review" (Airbnb):**
   - Verifica que el campo sea `true` solo si:
     - El año del check-in es 2026 (caso defensivo/futuro, test comentado).
     - La diferencia entre check-in y bookingDate es mayor a 330 días.
   - Ejemplo:
     - _Check-in en 2025, diferencia de 23 días → `false`_
     - _Check-in en 2025, diferencia de 364 días → `true`_
2. **Lógica para Vrbo:**
   - Siempre debe ser `false` sin importar las fechas.
3. **Mapeo de propiedades:**
   - Verifica que el campo `Property` en Airtable se mapee correctamente según el nombre/código de la reserva, tanto para Airbnb como para Vrbo.
4. **Validación de fechas faltantes:**
   - Si falta la fecha de reserva, el sistema usa la fecha actual (mockeada en los tests para consistencia).

### Estructura de los tests

- Archivo principal: `src/utils/__tests__/airtable.test.ts`
- Secciones agrupadas por plataforma (Airbnb, Vrbo).
- Uso de mocks para simular métodos de Airtable (`create`, `update`, `select`).
- Mock de la fecha actual para resultados predecibles.

### Ejemplo de test (simplificado)

```typescript
it('debe establecer NeedsDateReview como true si la diferencia es mayor a 330 días', async () => {
  const testData = {
    ...baseBookingData,
    platform: ['airbnb'],
    bookingDate: '2025-01-01',
    checkInDate: '2025-12-31', // 364 días después
  };
  await upsertBookingToAirtable(testData, mockConfig);
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
```

### Notas importantes
- El test para check-in en 2026 está **comentado** y documentado como caso defensivo ante posibles cambios futuros en Airbnb.
- Todos los tests reales pasan y cubren los escenarios actuales de negocio.
- Puedes ejecutar los tests con:
  ```sh
  npm test
  # o
  npx jest src/utils/__tests__/airtable.test.ts
  ```

## Lógica de "Needs Date Review"
- **Airbnb:**
  - `true` si el año de check-in es 2026 (protección ante cambios futuros de Airbnb).
  - `true` si la diferencia entre check-in y bookingDate es mayor a 330 días.
  - `false` en cualquier otro caso.
- **Vrbo:**
  - Siempre `false`.

## Flujo de trabajo recomendado
1. Procesa correos y extrae datos de reservas.
2. Ejecuta el procesador para sincronizar con Airtable.
3. Revisa el campo "Needs Date Review" para identificar reservas que requieren atención especial.
4. Ejecuta las pruebas antes de cualquier despliegue/actualización.

## Contribución
- Haz un fork y abre un Pull Request para sugerencias o mejoras.
- Asegúrate de que todas las pruebas pasen antes de enviar cambios.

## Licencia
MIT

---

### Notas adicionales
- El test para check-in en 2026 está comentado en `airtable.test.ts` como protección ante posibles cambios futuros en la política de reservas de Airbnb.
- Para dudas o soporte: abre un Issue en GitHub.
