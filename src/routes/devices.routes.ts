import { Router } from 'express';

import { DevicesController } from '@controllers/devices.controller';
import { requireAuth, requireRole } from '@middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('agent', 'admin'), DevicesController.listDevices);
router.get('/:id', requireRole('agent', 'admin'), DevicesController.getDevice);
router.get('/:id/measurements', requireRole('agent', 'admin'), DevicesController.getMeasurements);
router.post('/', requireRole('admin'), DevicesController.createDevice);
router.patch('/:id/associate', requireRole('admin'), DevicesController.associateDevice);
router.delete('/:id', requireRole('admin'), DevicesController.deleteDevice);

export default router;
