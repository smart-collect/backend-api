import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import { env } from '@config/env';
import { swaggerSpec } from '@config/swagger';
import { logger } from '@utils/logger';
import { errorHandler } from '@middleware/errorHandler';
import { notFoundHandler } from '@middleware/notFound';
import { globalLimiter } from '@middleware/rateLimit';
import { startAnomalyDetector } from './iot/anomaly-detector';
import { connectMqttClient, stopMqttClient } from './iot/mqtt.client';
import binRoutes from './routes/bin.route';
import deviceRoutes from './routes/devices.routes';
import reportRoutes from './routes/report.route';
import authRoutes from './routes/auth.routes';
import tourRoutes from './routes/tours.routes';
import statsRoutes from './routes/stats.routes';

const app: Express = express();

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:8000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet());
app.use(globalLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      service: env.APP_NAME,
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('/bins', binRoutes);
app.use('/devices', deviceRoutes);
app.use('/report', reportRoutes);
app.use('/auth', authRoutes);
app.use('/tours', tourRoutes);
app.use('/stats', statsRoutes);

if (env.SWAGGER_ENABLED) {
  app.use(env.SWAGGER_URL, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use(notFoundHandler);
app.use(errorHandler);

if (env.NODE_ENV !== 'test') {
  const anomalyDetector = startAnomalyDetector();
  connectMqttClient();

  const shutdown = () => {
    logger.info('Stopping Smart-Collect backend');
    clearInterval(anomalyDetector);
    stopMqttClient();
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  app.listen(env.PORT, () => {
    logger.info('Smart-Collect backend started', {
      port: env.PORT,
      mqtt_broker: env.MQTT_BROKER_URL,
    });
  });
}

export default app;
