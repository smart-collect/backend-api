import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { authenticateUser, refreshToken, registerUser, getCurrentUser, getUserStats } from '@services/auth.service';
import { loginSchema, registerSchema } from '@/schemas/auth.schemas';
import { AuthenticatedRequest } from '@middleware/auth';

function success(res: Response, status: number, data: unknown): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function handleControllerError(res: Response, error: unknown, path: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Payload invalide',
        details: error.flatten(),
      },
      timestamp: new Date().toISOString(),
      path,
    });
    return;
  }

  if (error instanceof Error) {
    const map: Record<string, { status: number; code: string; message: string }> = {
      EMAIL_ALREADY_EXISTS: {
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Un compte avec cette adresse email existe déjà',
      },
      INVALID_CREDENTIALS: {
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe invalide',
      },
      INVALID_TOKEN: {
        status: 401,
        code: 'INVALID_TOKEN',
        message: 'Jeton invalide ou expiré',
      },
      AUTHORIZATION_HEADER_REQUIRED: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Header Authorization: Bearer <token> requis',
      },
      USER_NOT_FOUND: {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé',
      },
    };

    const mapped = map[error.message];
    if (mapped) {
      res.status(mapped.status).json({
        success: false,
        error: {
          code: mapped.code,
          message: mapped.message,
        },
        timestamp: new Date().toISOString(),
        path,
      });
      return;
    }
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erreur interne du serveur',
    },
    timestamp: new Date().toISOString(),
    path,
  });
}

export const AuthController = {
  register: async (req: Request, res: Response): Promise<void> => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await registerUser(input);
      success(res, 201, result);
    } catch (error) {
      handleControllerError(res, error, req.path);
    }
  },

  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authenticateUser(input);
      success(res, 200, result);
    } catch (error) {
      handleControllerError(res, error, req.path);
    }
  },

  refresh: async (req: Request, res: Response): Promise<void> => {
    try {
      const authorization = req.header('Authorization');
      if (!authorization?.startsWith('Bearer ')) {
        throw new Error('AUTHORIZATION_HEADER_REQUIRED');
      }

      const token = authorization.slice('Bearer '.length);
      const refreshedToken = await refreshToken(token);
      success(res, 200, { token: refreshedToken });
    } catch (error) {
      handleControllerError(res, error, req.path);
    }
  },

  getMe: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new Error('AUTHORIZATION_HEADER_REQUIRED');
      }
      const user = await getCurrentUser(req.user.id);
      success(res, 200, user);
    } catch (error) {
      handleControllerError(res, error, req.path);
    }
  },

  getStats: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new Error('AUTHORIZATION_HEADER_REQUIRED');
      }
      const stats = await getUserStats(req.user.id);
      success(res, 200, stats);
    } catch (error) {
      handleControllerError(res, error, req.path);
    }
  },
};
