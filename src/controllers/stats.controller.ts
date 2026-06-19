import { Response } from 'express';
import { ZodError } from 'zod';

import { binHistoryQuerySchema } from '@/schemas/stats.schemas';
import { AuthenticatedRequest } from '@middleware/auth';
import { StatsService } from '@services/stats.service';

function success(res: Response, status: number, data: unknown): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function handleControllerError(res: Response, req: AuthenticatedRequest, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Parametres invalides',
        details: error.flatten(),
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  if (error instanceof Error && error.message === 'BIN_NOT_FOUND') {
    res.status(404).json({
      success: false,
      error: {
        code: 'BIN_NOT_FOUND',
        message: 'Bac introuvable',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
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

function getRequiredBinId(req: AuthenticatedRequest): string {
  const id = req.params['id'];
  if (!id) {
    throw new Error('BIN_NOT_FOUND');
  }
  return id;
}

export const StatsController = {
  getDashboard: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const dashboard = await StatsService.getDashboard();
      success(res, 200, dashboard);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  getNeighborhoodStats: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const stats = await StatsService.getNeighborhoodStats();
      success(res, 200, stats);
    } catch (error) {
      handleControllerError(res, _req, error);
    }
  },

  getAlerts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const alerts = await StatsService.getAlerts();
      success(res, 200, alerts);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  getBinHistory: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const query = binHistoryQuerySchema.parse(req.query);
      const history = await StatsService.getBinHistory(getRequiredBinId(req), query.days);
      success(res, 200, history);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  getReportsHeatmap: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const heatmap = await StatsService.getReportsHeatmap();
      success(res, 200, heatmap);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },
};
