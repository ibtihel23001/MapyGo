import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { authLimiter } from '../../middleware/rateLimiter';
import { list, getOne, submit, review } from './registrations.controller';

const router = Router();

// Public: agency submits their application
router.post('/', authLimiter, submit);

// Superadmin only
router.get('/', authenticate, authorize('superadmin'), list);
router.get('/:id', authenticate, authorize('superadmin'), getOne);
router.patch('/:id/review', authenticate, authorize('superadmin'), review);

export default router;
