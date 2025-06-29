"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInitializedConfig = void 0;
// src/config.ts
const secret_manager_1 = require("@google-cloud/secret-manager");
const logger_1 = require("./utils/logger");
// Descomentar dotenv para desarrollo local, asegurar que .env se cargue.
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const client = new secret_manager_1.SecretManagerServiceClient();
async function getSecretValue(secretName, projectId) {
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    try {
        const [version] = await client.accessSecretVersion({ name });
        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error(`Secret ${secretName} has no payload.`);
        }
        return payload;
    }
    catch (error) {
        logger_1.logger.error(`Failed to access secret ${secretName}:`, error);
        throw new Error(`Failed to access secret ${secretName}. Ensure it exists and the function has permissions.`);
    }
}
async function loadConfig() {
    // Detectar si estamos en un entorno que probablemente sea Google Cloud
    const isCloudEnvironment = !!(process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.FUNCTION_TARGET ||
        process.env.K_SERVICE ||
        process.env.GCP_PROJECT);
    if (isCloudEnvironment) {
        logger_1.logger.debug("INFO: Detectado entorno de nube. Cargando secretos y configuración desde Secret Manager...");
        const projectId = await client.getProjectId();
        if (!projectId) {
            throw new Error("ERROR: No se pudo determinar el Google Cloud Project ID desde el entorno.");
        }
        // Cargar secretos y configuración desde Secret Manager
        const [googleClientId, googleClientSecret, googleRefreshToken, airtableApiKey, geminiApiKey, airtableTableName, // Cargar desde Secret Manager
        ] = await Promise.all([
            getSecretValue("gmail_airtable_processor_oauth_client_id", projectId),
            getSecretValue("gmail_airtable_processor_oauth_client_secret", projectId),
            getSecretValue("gmail_airtable_processor_gmail_refresh_token", projectId),
            getSecretValue("gmail_airtable_processor_airtable_api_key", projectId),
            getSecretValue("gmail_airtable_processor_gemini_api_key", projectId),
            getSecretValue("AIRTABLE_TABLE_NAME", projectId), // Nombre del secreto
        ]);
        // AIRTABLE_BASE_ID puede seguir viniendo de las variables de entorno
        const airtableBaseId = process.env.AIRTABLE_BASE_ID;
        if (!airtableBaseId) {
            throw new Error("Missing AIRTABLE_BASE_ID environment variable.");
        }
        return {
            googleClientId,
            googleClientSecret,
            googleRefreshToken,
            airtableApiKey,
            airtableBaseId,
            airtableTableName,
            geminiApiKey,
        };
    }
    else {
        logger_1.logger.debug("INFO: Detectado entorno local. Cargando configuración desde variables de entorno (.env)...");
        // Cargar configuración y secretos desde variables de entorno para desarrollo local
        const airtableBaseId = process.env.AIRTABLE_BASE_ID;
        const airtableTableName = process.env.AIRTABLE_TABLE_NAME;
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        const airtableApiKey = process.env.AIRTABLE_API_KEY;
        const geminiApiKey = process.env.GEMINI_API_KEY;
        // Validaciones
        if (!airtableBaseId)
            throw new Error("Missing AIRTABLE_BASE_ID from .env.");
        if (!airtableTableName)
            throw new Error("Missing AIRTABLE_TABLE_NAME from .env.");
        if (!googleClientId)
            throw new Error("Missing GOOGLE_CLIENT_ID from .env.");
        if (!googleClientSecret)
            throw new Error("Missing GOOGLE_CLIENT_SECRET from .env.");
        if (!googleRefreshToken)
            throw new Error("Missing GOOGLE_REFRESH_TOKEN from .env.");
        if (!airtableApiKey)
            throw new Error("Missing AIRTABLE_API_KEY from .env.");
        if (!geminiApiKey)
            throw new Error("Missing GEMINI_API_KEY from .env.");
        return {
            googleClientId,
            googleClientSecret,
            googleRefreshToken,
            airtableApiKey,
            airtableBaseId,
            airtableTableName,
            geminiApiKey,
        };
    }
}
// La función loadConfig original se reemplaza por la lógica de arriba.
// Por lo tanto, el siguiente bloque que carga los secretos directamente ya no es necesario aquí
// ya que está dentro de la lógica condicional de loadConfig.
/*
 */
// Exportamos una función que devuelve una promesa con la configuración inicializada.
// Esto asegura que la configuración se carga asíncronamente antes de ser usada.
let loadedConfig = null;
async function getInitializedConfig() {
    if (!loadedConfig) {
        loadedConfig = await loadConfig();
    }
    return loadedConfig;
}
exports.getInitializedConfig = getInitializedConfig;
