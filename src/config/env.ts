import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('Smart-Collect Backend'),

  DATABASE_URL: z
    .string()
    .url('URL PostgreSQL invalide')
    .default('postgresql://smart_collect_user:smart_collect_password_dev@localhost:5432/smart_collect'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET doit contenir au moins 32 caracteres')
    .default('test_jwt_secret_change_me_32_chars_min'),
  JWT_EXPIRES_IN: z.string().default('15m'),

  MQTT_BROKER_URL: z.string().url('URL MQTT invalide').default('mqtt://localhost:1883'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPICS_SUBSCRIBE: z.string().default('devices/+/data,devices/+/status,devices/+/alert'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  MAX_FILE_SIZE: z.coerce.number().int().positive().default(10485760),
  UPLOAD_DIR: z.string().default('uploads'),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_DIR: z.string().default('logs'),

  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:8000'),

  SWAGGER_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),
  SWAGGER_URL: z.string().default('/api-docs'),
});

type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Erreur de validation des variables d'environnement:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const env = getEnv();
export type { Env };
