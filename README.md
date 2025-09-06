# Gmail Airtable Processor

## 1. Application Purpose

This application is a productivity tool designed to help property managers automate the process of tracking bookings. It connects to a user's Gmail account, finds reservation confirmation emails from platforms like Airbnb and Vrbo, extracts key details (such as guest name, check-in/check-out dates, and property name), and organizes this information neatly in a user-provided Airtable base.

The goal is to eliminate manual data entry, reduce errors, and provide a centralized dashboard of all bookings within Airtable.

## 2. Scopes Justification & Data Handling

To achieve its purpose, this application requires the following Google API scope:

- **`https://www.googleapis.com/auth/gmail.readonly`**: **(Restricted Scope)** This permission is essential for the core functionality of the application. It is used exclusively to **read the content of reservation emails** to find and extract booking details.

### Data Flow

1. The application authenticates with the user's Google Account via OAuth2.
2. It searches for emails matching specific criteria for reservation confirmations (e.g., from `automated@airbnb.com`).
3. It reads the body of the identified emails to parse booking information.
4. The extracted data is sent directly to the user's specified Airtable base.
5. **Important**: This application **does not store, copy, or save any of the user's email data** on its own servers or any third-party service other than the user's own Airtable. All processing happens in memory during the execution of the function.

## 3. Privacy Policy

A detailed Privacy Policy is available here: [https://gmail-airtable-function.netlify.app/privacy](https://gmail-airtable-function.netlify.app/privacy)

---

## 4. Technical Details

### Features

- Extracts and transforms booking data from emails.
- Robust logic for flagging reservations that need manual review.
- Automatic mapping of properties to canonical names.
- Unit tested with advanced mocks for Airtable.

### Project Structure

```text
├── src/
│   ├── services/
│   │   ├── airtable.ts
│   │   ├── gmail.ts
│   │   └── gemini.ts
│   └── ...
├── .env.example
└── ...
```

### Installation & Usage

1. **Prerequisites**: Node.js, npm.
2. Clone the repository.
3. Install dependencies: `npm install`.
4. Create a `.env` file from `.env.example` and fill in your credentials for Google Cloud, Airtable, and Gemini.
5. Run the application: `npm start`.

### Running Tests

```sh
npm test
```

## 5. Despliegue en Google Apps Script (GAS)

Si deseas ejecutar la lógica directamente dentro de un proyecto de Google Apps Script (por ejemplo como tarea programada que lea Gmail y actualice Airtable), hay dos enfoques:

### Opción A: Bundle (recomendado para producción)

1. Instala un bundler ligero (ej. esbuild):

```sh
npm i -D esbuild
```

1. Genera un único archivo listo para GAS:

```sh
npx esbuild src/refactor/MainRefactored.js \
	--bundle --platform=neutral --format=iife \
	--global-name=GmailAirtableApp \
	--outfile=dist/Code.js
```
1. Sube `dist/Code.js` a tu proyecto GAS (con clasp o pegando el contenido).
1. Asegúrate de exponer una función ejecutable (por ejemplo añade al final del bundle un wrapper que llame `GmailAirtableApp.processEmails()`).
1. Ejecuta primero en modo seguro (`CONFIG.SAFE_MODE = true`) si aplicas esa variable en tu configuración inicial.

### Opción B: Loader + Globals (rápido / simplicidad puntual)

Este repositorio incluye `src/refactor/GAS_Loader.js` que prepara objetos globales cuando se carga en Node y también sirve como guía para adaptarlo manualmente a GAS sin bundling.

Pasos:
1. Copia a tu proyecto GAS los archivos de `src/refactor/` que realmente necesites (utilidades, procesadores, `MainRefactored.js`, etc.).
2. En cada archivo elimina las líneas `require(...)` y `module.exports = ...` si existen.
3. Sustituye exportaciones por asignaciones globales, por ejemplo:

	```javascript
	// Antes (Node)
		const { SharedUtils } = require('./shared/SharedUtils');
		module.exports = { processEmails };

	// Después (GAS)
		var SharedUtils = { /* funciones */ };
		function processEmails() { /* ... */ }
	```
4. Alternativamente, conserva el código actual y añade al inicio de cada archivo:

	```javascript
		if (typeof require === 'undefined') { /* asumir globals ya cargados */ }
	```
5. Añade el contenido de `GAS_Loader.js` (opcional). Este archivo en Node usa `require`; en GAS puedes dejar solo los comentarios o adaptarlo removiendo llamadas a `require`.
6. Asegura el orden de archivos en el editor de GAS: primero utilidades (`SharedUtils`, `EmailUtils`, etc.), luego procesadores, finalmente `MainRefactored`.
7. Crea una función simple para el trigger:

	 ```javascript
		function runProcessor() {
			processEmails();
		}
	 ```
8. Configura un trigger de tiempo (ej. cada 15 minutos) sobre `runProcessor`.

### Variables de Configuración

En GAS define un objeto `CONFIG` global (en un archivo separado o al inicio de `MainRefactored.js`):

```javascript
var CONFIG = {
	SAFE_MODE: true,              // Cambia a false tras validar
	AIRTABLE_API_KEY: '***',
	AIRTABLE_BASE_ID: '***',
	AIRTABLE_TABLE_NAME: 'Reservas',
	// Otros campos necesarios
};
```

### Estrategia de Migración Segura

1. Despliega primero en un nuevo proyecto GAS de pruebas.
2. Aplica un filtro de Gmail (etiqueta) y ajusta tu función para sólo procesar correos con esa etiqueta (fase de verificación).
3. Activa `SAFE_MODE` y revisa logs (Apps Script > Executions) confirmando detecciones correctas.
4. Cuando estés conforme, desactiva `SAFE_MODE` y apunta al base/table definitiva de Airtable.
5. Finalmente replica la configuración en el proyecto GAS de producción o mueve el código.

\n### Notas
- Si más adelante crece la lógica, migrar a Opción A (bundle) reduce mantenimiento manual.
- El loader actual (`GAS_Loader.js`) no es obligatorio en GAS, sólo una ayuda conceptual.
- Mantén las pruebas en este repo (Node) para asegurar regresiones mínimas antes de volver a desplegar.

