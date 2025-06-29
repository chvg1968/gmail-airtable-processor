// src/config.ts
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { logger } from "./utils/logger";

// Descomentar dotenv para desarrollo local, asegurar que .env se cargue.
import * as dotenv from "dotenv";
dotenv.config();

const client = new SecretManagerServiceClient();

async function getSecretValue(
  secretName: string,
  projectId: string,
): Promise<string> {
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error(`Secret ${secretName} has no payload.`);
    }
    return payload;
  } catch (error) {
    logger.error(`Failed to access secret ${secretName}:`, error);
    throw new Error(
      `Failed to access secret ${secretName}. Ensure it exists and the function has permissions.`,
    );
  }
}

export interface AppConfig {
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  airtableApiKey: string;
  airtableBaseId: string;
  airtableTableName: string;
  geminiApiKey: string;
}

async function loadConfig(): Promise<AppConfig> {
  // Detectar si estamos en un entorno que probablemente sea Google Cloud
  const isCloudEnvironment = !!(
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FUNCTION_TARGET ||
    process.env.K_SERVICE ||
    process.env.GCP_PROJECT
  );

  if (isCloudEnvironment) {
    logger.debug(
      "INFO: Detectado entorno de nube. Cargando secretos y configuración desde Secret Manager...",
    );

    const projectId = await client.getProjectId();
    if (!projectId) {
      throw new Error(
        "ERROR: No se pudo determinar el Google Cloud Project ID desde el entorno.",
      );
    }

    // Cargar secretos y configuración desde Secret Manager
    const [
      googleClientId,
      googleClientSecret,
      googleRefreshToken,
      airtableApiKey,
      geminiApiKey,
      airtableTableName, // Cargar desde Secret Manager
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
  } else {
    logger.debug(
      "INFO: Detectado entorno local. Cargando configuración desde variables de entorno (.env)...",
    );
    // Cargar configuración y secretos desde variables de entorno para desarrollo local
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const airtableTableName = process.env.AIRTABLE_TABLE_NAME;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const airtableApiKey = process.env.AIRTABLE_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // Validaciones
    if (!airtableBaseId) throw new Error("Missing AIRTABLE_BASE_ID from .env.");
    if (!airtableTableName) throw new Error("Missing AIRTABLE_TABLE_NAME from .env.");
    if (!googleClientId) throw new Error("Missing GOOGLE_CLIENT_ID from .env.");
    if (!googleClientSecret) throw new Error("Missing GOOGLE_CLIENT_SECRET from .env.");
    if (!googleRefreshToken) throw new Error("Missing GOOGLE_REFRESH_TOKEN from .env.");
    if (!airtableApiKey) throw new Error("Missing AIRTABLE_API_KEY from .env.");
    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY from .env.");

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
let loadedConfig: AppConfig | null = null;

export async function getInitializedConfig(): Promise<AppConfig> {
  if (!loadedConfig) {
    loadedConfig = await loadConfig();
  }
  return loadedConfig;
}
