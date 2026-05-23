import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { dashboardStats } from './dashboard.controller';

const router = Router();

// Single endpoint — controller branches by role
router.get(
  '/stats',
  authenticate,
  authorize('superadmin', 'admin', 'accountant'),
  dashboardStats,
);

export default router;

