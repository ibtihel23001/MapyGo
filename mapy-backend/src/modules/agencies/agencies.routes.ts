import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { list, getOne, create, update, updateStatus, remove } from './agencies.controller';

const router = Router();

router.use(authenticate, authorize('superadmin'));

router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/status', updateStatus);
router.delete('/:id', remove);

export default router;
