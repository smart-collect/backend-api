import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { env } from '@config/env';
import { logger } from '@utils/logger';
import { errorHandler, catchAsync } from '@middleware/errorHandler';
import { notFoundHandler } from '@middleware/notFound';
import { globalLimiter, authLimiter } from '@middleware/rateLimit';

/**
 * Initialisation de l'application Express
 */
const app: Express = express();

/**
 * Configuration Swagger
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: `${env.APP_NAME} - API Documentation`,
      version: '1.0.0',
      description: 'API backend pour la plateforme IoT Smart-Collect de gestion de collecte d\'ordures',
      contact: {
        name: 'Smart-Collect Team',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Serveur de développement',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['src/routes/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Middlewares de sécurité
 */
// Helmet pour sécuriser les headers HTTP
app.use(helmet());

// CORS - Configuration des origines autorisées
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

/**
 * Middlewares de parsing
 */
app.use(express.json({ limit: env.MAX_FILE_SIZE }));
app.use(express.urlencoded({ limit: env.MAX_FILE_SIZE, extended: true }));

/**
 * Rate limiting global
 */
app.use(globalLimiter);

/**
 * Routes de santé
 */
app.get(
  '/health',
  catchAsync(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
      },
    });
  }),
);

/**
 * Documentation Swagger
 */
if (env.SWAGGER_ENABLED) {
  app.use(env.SWAGGER_URL, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  logger.info(`📚 Documentation Swagger disponible sur http://localhost:${env.PORT}${env.SWAGGER_URL}`);
}

/**
 * Routes de l'API (à implémenter)
 */
// TODO: Implémenter les routes (auth, devices, collections, etc.)

/**
 * Middleware 404
 */
app.use(notFoundHandler);

/**
 * Middleware de gestion des erreurs (doit être enregistré en dernier)
 */
app.use(errorHandler);

/**
 * Démarrage du serveur
 */
async function startServer(): Promise<void> {
  try {
    // Validation des variables d'environnement
    logger.info('✅ Variables d\'environnement validées');

    // Écoute sur le port configuré
    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Serveur démarré sur http://localhost:${env.PORT}`, {
        environment: env.NODE_ENV,
        port: env.PORT,
        appName: env.APP_NAME,
      });
    });

    /**
     * Gestion gracieuse de l'arrêt
     */
    const gracefulShutdown = async (signal: string) => {
      logger.info(`📛 Signal ${signal} reçu, arrêt gracieux...`);
      
      server.close(() => {
        logger.info('✅ Serveur arrêté proprement');
        process.exit(0);
      });

      // Force l'arrêt après 30 secondes
      setTimeout(() => {
        logger.error('❌ Arrêt forcé après timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Erreur lors du démarrage du serveur', error);
    process.exit(1);
  }
}

// Lance le serveur
startServer();

export default app;
