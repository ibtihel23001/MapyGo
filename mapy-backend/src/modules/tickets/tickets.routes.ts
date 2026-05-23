import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { list, getOne, create, update, updateStatus, remove } from './tickets.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize('superadmin', 'admin', 'accountant'), list);
router.get('/:id', authorize('superadmin', 'admin', 'accountant'), getOne);
router.post('/', authorize('admin'), create);
router.put('/:id', authorize('admin'), update);
router.patch('/:id/status', authorize('admin'), updateStatus);
router.delete('/:id', authorize('admin'), remove);

export default router;
