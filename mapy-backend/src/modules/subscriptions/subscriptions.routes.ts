import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { list, getActive, create, updateStatus } from './subscriptions.controller';

const router = Router();
router.use(authenticate);
router.get('/', authorize('superadmin'), list);
router.get('/active', authorize('admin', 'accountant'), getActive);
router.get('/active/:agencyId', authorize('superadmin'), getActive);
router.post('/', authorize('superadmin'), create);
router.patch('/:id/status', authorize('superadmin'), updateStatus);
export default router;
