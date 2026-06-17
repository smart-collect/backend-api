import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

/**
 * Interface pour les réponses d'erreur standardisées
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
}

/**
 * Classe personnalisée pour les erreurs de l'API
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number = 500,
    public code: string = 'INTERNAL_SERVER_ERROR',
    message: string = 'Erreur interne du serveur',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Middleware de gestion des erreurs
 * Doit être enregistré APRÈS tous les autres middlewares et routes
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const apiError = err instanceof ApiError 
    ? err 
    : new ApiError(500, 'INTERNAL_SERVER_ERROR', err.message);

  // Log l'erreur
  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.path}`, {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      code: apiError.code,
    });
  } else {
    logger.warn(`${req.method} ${req.path}`, {
      code: apiError.code,
      message: apiError.message,
    });
  }

  // Format la réponse d'erreur
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(apiError.statusCode).json(errorResponse);
}

/**
 * Helper pour wrapper les contrôleurs et capturer les erreurs
 */
export function catchAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
