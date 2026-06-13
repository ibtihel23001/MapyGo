import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { runImport } from './email-import.controller';

const router = Router();

router.use(authenticate);

/**
 * POST /api/email-import/run
 * Manual trigger – admin only.
 */
router.post('/run', authorize('admin'), runImport);

export default router;
