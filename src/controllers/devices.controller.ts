import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { associateDeviceSchema, createDeviceSchema } from '@/schemas/devices.schemas';
import { DevicesService } from '@services/devices.service';

function success(res: Response, status: number, data: unknown): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function handleControllerError(res: Response, req: Request, error: unknown): void {
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

  if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') {
    res.status(404).json({
      success: false,
      error: {
        code: 'DEVICE_NOT_FOUND',
        message: 'Dispositif introuvable',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  if (getErrorCode(error) === 'P2025') {
    res.status(404).json({
      success: false,
      error: {
        code: 'DEVICE_NOT_FOUND',
        message: 'Dispositif introuvable',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  if (getErrorCode(error) === 'P2002') {
    res.status(409).json({
      success: false,
      error: {
        code: 'DEVICE_ALREADY_EXISTS',
        message: 'Un dispositif avec cet identifiant existe deja',
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

function getRequiredId(req: Request): string {
  const id = req.params['id'];
  if (!id) {
    throw new Error('DEVICE_NOT_FOUND');
  }
  return id;
}

export const DevicesController = {
  listDevices: async (req: Request, res: Response): Promise<void> => {
    try {
      const devices = await DevicesService.listDevices();
      success(res, 200, devices);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  getDevice: async (req: Request, res: Response): Promise<void> => {
    try {
      const device = await DevicesService.getDeviceById(getRequiredId(req));
      if (!device) {
        res.status(404).json({
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Dispositif introuvable',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      success(res, 200, device);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  getMeasurements: async (req: Request, res: Response): Promise<void> => {
    try {
      const queryLimit = req.query['limit'];
      const limit = typeof queryLimit === 'string' ? Number.parseInt(queryLimit, 10) : 100;
      const measurements = await DevicesService.getMeasurements(getRequiredId(req), Number.isNaN(limit) ? 100 : limit);

      if (!measurements) {
        res.status(404).json({
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Dispositif introuvable',
          },
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      success(res, 200, measurements);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  createDevice: async (req: Request, res: Response): Promise<void> => {
    try {
      const input = createDeviceSchema.parse(req.body);
      const device = await DevicesService.createDevice(input);
      success(res, 201, device);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  associateDevice: async (req: Request, res: Response): Promise<void> => {
    try {
      const input = associateDeviceSchema.parse(req.body);
      const device = await DevicesService.associateDevice(getRequiredId(req), input.bin_id);
      success(res, 200, device);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },

  deleteDevice: async (req: Request, res: Response): Promise<void> => {
    try {
      const device = await DevicesService.deleteDevice(getRequiredId(req));
      success(res, 200, device);
    } catch (error) {
      handleControllerError(res, req, error);
    }
  },
};
