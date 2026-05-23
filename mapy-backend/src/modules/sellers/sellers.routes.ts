import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { list, create, update, remove } from './sellers.controller';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
export default router;
