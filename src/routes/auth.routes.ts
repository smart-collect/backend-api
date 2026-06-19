import { Router } from 'express';

import { AuthController } from '@controllers/auth.controller';
import { authLimiter } from '@middleware/rateLimit';
import { requireAuth } from '@middleware/auth';

const router = Router();

router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', requireAuth, AuthController.getMe);
router.get('/me/stats', requireAuth, AuthController.getStats);

export default router;
