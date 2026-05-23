import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { list, create } from './transactions.controller';

const router = Router();
router.use(authenticate, authorize('superadmin', 'admin', 'accountant'));
router.get('/', list);
router.post('/', create);
export default router;
