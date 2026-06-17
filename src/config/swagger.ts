import swaggerJsdoc from 'swagger-jsdoc';

import { env } from './env';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart-Collect API',
      version: '1.0.0',
      description: 'API backend IoT pour la plateforme Smart-Collect Hysacam',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Serveur local',
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
  apis: ['./src/routes/*.ts'],
});
