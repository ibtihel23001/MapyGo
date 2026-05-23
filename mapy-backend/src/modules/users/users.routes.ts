import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  listAdmins, listAccountants, getOne, create, update,
  toggleStatus, remove, updateProfile, avatarUpload,
} from './users.controller';

const router = Router();

router.use(authenticate);

// Profile — any authenticated user
router.put('/profile', avatarUpload, updateProfile);

// Admin list — accessible by admin too (own agency scope applied in controller)
router.get('/accountants', authorize('superadmin', 'admin'), listAccountants);

// Superadmin-only
router.get('/admins', authorize('superadmin'), listAdmins);
router.get('/:id', authorize('superadmin'), getOne);
router.post('/', authorize('superadmin'), create);
router.put('/:id', authorize('superadmin'), update);
router.patch('/:id/status', authorize('superadmin'), toggleStatus);
router.delete('/:id', authorize('superadmin'), remove);

export default router;
