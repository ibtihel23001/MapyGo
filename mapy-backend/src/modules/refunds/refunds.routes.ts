import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { list, create, updateStatus } from './refunds.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize('superadmin', 'admin', 'accountant'), list);
router.post('/', authorize('admin'), create);
router.patch('/:id/status', authorize('superadmin', 'admin'), updateStatus);

export default router;
