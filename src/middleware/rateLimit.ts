import rateLimit from 'express-rate-limit';
import { env } from '@config/env';
import { logger } from '@utils/logger';

/**
 * Configuration du rate limiting global
 * Limite le nombre de requêtes par fenêtre de temps
 */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes par défaut
  max: env.RATE_LIMIT_MAX_REQUESTS,    // 100 requêtes par défaut
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes, veuillez réessayer plus tard',
    },
  },
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne limite pas les health checks
    if (req.path === '/health') return true;
    return false;
  },
  handler: (req, res) => {
    logger.warn(`Rate limit dépassé pour ${req.ip}`);
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Trop de requêtes, veuillez réessayer plus tard',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  },
});

/**
 * Rate limiting strict pour l'authentification
 * Prévint les attaques par force brute
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                   // 100 tentatives (augmenté pour le développement)
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes',
    },
  },
  statusCode: 429,
  skipSuccessfulRequests: true, // Ne compte pas les requêtes réussies
});

/**
 * Rate limiting pour les uploads
 * Prévient les abus d'upload de fichiers
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,                   // 10 uploads par heure
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Trop d\'uploads, veuillez réessayer plus tard',
    },
  },
  statusCode: 429,
});
