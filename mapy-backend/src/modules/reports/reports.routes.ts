import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { list, generate, remove } from './reports.controller';

const router = Router();

router.use(authenticate, authorize('admin', 'accountant'));

router.get('/', list);
router.post('/generate', generate);
router.delete('/:id', remove);

export default router;
