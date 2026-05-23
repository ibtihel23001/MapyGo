import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authLimiter } from '../../middleware/rateLimiter';
import { login, logout, refresh, getMe, forgotPassword, resetPassword } from './auth.controller';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/logout', authenticate, logout);
router.post('/refresh', refresh);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
