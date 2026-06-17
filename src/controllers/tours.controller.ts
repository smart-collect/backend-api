import { Response } from 'express';
import { ZodError } from 'zod';

import { createTourSchema, generateTourSchema } from '@/schemas/tours.schemas';
import { AuthenticatedRequest } from '@middleware/auth';
import { ToursService } from '@services/tours.service';

function success(res: Response, status: number, data: unknown): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function getAuthContext(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error('UNAUTHORIZED');
  }

  return {
    userId: req.user.id,
    isAdmin: req.user.role === 'admin',
  };
}

function handleControllerError(res: Response, req: AuthenticatedRequest, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Payload invalide',
        details: error.flatten(),
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  if (error instanceof Error) {
    const map: Record<string, { status: number; code: string; message: string }> = {
      UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Authentification requise' },
      TOUR_NOT_FOUND: { status: 404, code: 'TOUR_NOT_FOUND', message: 'Tournée introuvable' },
      TOUR_FORBIDDEN: { status: 403, code: 'TOUR_FORBIDDEN', message: 'Acces refuse a cette tournée' },
      BIN_NOT_FOUND: { status: 404, code: 'BIN_NOT_FOUND', message: 'Bac introuvable' },
      BIN_NOT_IN_TOUR: { status: 404, code: 'BIN_NOT_IN_TOUR', message: 'Bac absent de la tournée' },
      BIN_ALREADY_VISITED: { status: 409, code: 'BIN_ALREADY_VISITED', message: 'Bac deja visite' },
      TOUR_INVALID_STATUS: { status: 409, code: 'TOUR_INVALID_STATUS', message: 'Statut de tournée invalide pour cette action' },
      TOUR_NOT_IN_PROGRESS: { status: 409, code: 'TOUR_NOT_IN_PROGRESS', message: 'La tournée doit etre en cours' },
      NO_BINS_AVAILABLE: { status: 422, code: 'NO_BINS_AVAILABLE', message: 'Aucun bac eligible pour generer une tournée' },
      AGENT_FORBIDDEN: { status: 403, code: 'AGENT_FORBIDDEN', message: 'Un agent ne peut agir que sur ses propres tournées' },
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
        path: req.path,
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
    path: req.path,
  });
}

function getRequiredParam(req: AuthenticatedRequest, key: 'id' | 'bin_id'): string {
  const value = req.params[key];
  if (!value) {
    throw new Error(key === 'id' ? 'TOUR_NOT_FOUND' : 'BIN_NOT_IN_TOUR');
  }
  return value;
}

function assertAgentScope(agentId: string, userId: string, isAdmin: boolean): void {
  if (!isAdmin && agentId !== userId) {
    throw new Error('AGENT_FORBIDDEN');
  }
}

export const ToursController = {
  listTours: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, isAdmin } = getAuthContext(req);
      const tours = await ToursService.listTours(userId, isAdmin);
      success(res, 200, tours);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  getTour: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, isAdmin } = getAuthContext(req);
      const tour = await ToursService.getTourById(getRequiredParam(req, 'id'), userId, isAdmin);
      success(res, 200, tour);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  createTour: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, isAdmin } = getAuthContext(req);
      const input = createTourSchema.parse(req.body);
      assertAgentScope(input.agent_id, userId, isAdmin);

      const tour = await ToursService.createTour(input);
      success(res, 201, tour);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  generateTour: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, isAdmin } = getAuthContext(req);
      const input = generateTourSchema.parse(req.body);
      assertAgentScope(input.agent_id, userId, isAdmin);

      const tour = await ToursService.generateTour(input);
      success(res, 201, tour);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  startTour: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, isAdmin } = getAuthContext(req);
      const tour = await ToursService.startTour(getRequiredParam(req, 'id'), userId, isAdmin);
      success(res, 200, tour);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  visitBin: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, isAdmin } = getAuthContext(req);
      const tour = await ToursService.visitBin(
        getRequiredParam(req, 'id'),
        getRequiredParam(req, 'bin_id'),
        userId,
        isAdmin,
      );
      success(res, 200, tour);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  completeTour: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, isAdmin } = getAuthContext(req);
      const tour = await ToursService.completeTour(getRequiredParam(req, 'id'), userId, isAdmin);
      success(res, 200, tour);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },
};
