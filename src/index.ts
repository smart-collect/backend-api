import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { env } from '@config/env';
import { logger } from '@utils/logger';
import { errorHandler, catchAsync } from '@middleware/errorHandler';
import { notFoundHandler } from '@middleware/notFound';
import { globalLimiter } from '@middleware/rateLimit';

// Importation de tes routes BINS
import binRoutes from './routes/bin.route';
import reportRoutes from './routes/report.route';/**
 * Initialisation de l'application Express
 */
const app: Express = express();

// Intergiciels (Middlewares) de base
app.use(express.json());
app.use(cors());
app.use(helmet());

// Connexion de tes routes sur le préfixe /bins
app.use('/bins', binRoutes);
app.use('/report', reportRoutes);
// Gestion des erreurs (À laisser en bas)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;