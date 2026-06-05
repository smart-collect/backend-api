import { Request, Response } from 'express';
import { logger } from '@utils/logger';

/**
 * Middleware pour gérer les routes non trouvées (404)
 * Retourne une réponse JSON standardisée
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn(`Route non trouvée: ${req.method} ${req.path}`);
  
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} non trouvée`,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  });
}
