import 'dotenv/config';
import { z } from 'zod';

/**
 * Schéma de validation des variables d'environnement
 * Utilise Zod pour une validation stricte au démarrage
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('Smart-Collect Backend'),
  
  // Base de données
  DATABASE_URL: z.string().url('URL PostgreSQL invalide'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // MQTT
  MQTT_BROKER_URL: z.string().url('URL MQTT invalide'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPICS_SUBSCRIBE: z.string().default('devices/+/data,devices/+/status'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  
  // Fichiers
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(10485760),
  UPLOAD_DIR: z.string().default('uploads'),
  
  // Logs
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_DIR: z.string().default('logs'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:8000'),
  
  // Swagger
  SWAGGER_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),
  SWAGGER_URL: z.string().default('/api-docs'),
});

type Env = z.infer<typeof envSchema>;

/**
 * Valide et exporte les variables d'environnement
 * Lève une erreur fatale si des variables sont manquantes
 */
function getEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Erreur de validation des variables d\'environnement:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  
  return result.data;
}

export const env = getEnv();
export type { Env };
