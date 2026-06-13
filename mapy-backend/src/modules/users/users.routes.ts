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
router.get('/:id', authorize('superadmin', 'admin'), getOne);

// Admin can create/update/toggle/delete accountants within their own agency
router.post('/', authorize('superadmin', 'admin'), create);
router.put('/:id', authorize('superadmin', 'admin'), update);
router.patch('/:id/status', authorize('superadmin', 'admin'), toggleStatus);
router.delete('/:id', authorize('superadmin', 'admin'), remove);

export default router;
