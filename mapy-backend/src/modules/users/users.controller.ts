import { Request, Response, NextFunction } from 'express';
import path from 'path';
import multer from 'multer';
import * as svc from './users.service';
import { createUserSchema, updateUserSchema, updateProfileSchema } from './users.schema';
import { logActivity } from '../../utils/activityLog';
import { env } from '../../config/env';

// ─── Avatar upload ────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: env.UPLOAD_DIR,
  filename: (_req, file, cb) => {
    cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`);
  },
});

export const avatarUpload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
}).single('avatar');

// ─── Handlers ─────────────────────────────────────────────────

export async function listAdmins(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listByRole('admin', req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function listAccountants(req: Request, res: Response, next: NextFunction) {
  try {
    // Admin can only see accountants in their own agency
    const agencyId = req.user!.roleSlug === 'admin' ? req.user!.agencyId : undefined;
    const result = await svc.listByRole('accountant', req.query, agencyId);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getUser(Number(req.params.id));
    // Admin can only view users within their own agency
    if (req.user!.roleSlug === 'admin' && data.agencyId !== req.user!.agencyId) {
      res.status(403).json({ success: false, message: 'You do not have permission to access this resource' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createUserSchema.parse(req.body);
    // Admin can only create accountants, and only within their own agency
    if (req.user!.roleSlug === 'admin') {
      if (input.roleSlug !== 'accountant') {
        res.status(403).json({ success: false, message: 'Admins can only create accountants' });
        return;
      }
      input.agencyId = req.user!.agencyId!;
    }
    const data = await svc.createUser(input);
    await logActivity(req, 'create_user', `Created ${input.roleSlug}: ${input.email}`);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    // Admin can only update users within their own agency
    if (req.user!.roleSlug === 'admin') {
      const target = await svc.getUser(Number(req.params.id));
      if (target.agencyId !== req.user!.agencyId) {
        res.status(403).json({ success: false, message: 'You do not have permission to access this resource' });
        return;
      }
    }
    const input = updateUserSchema.parse(req.body);
    const data = await svc.updateUser(Number(req.params.id), input);
    await logActivity(req, 'update_user', `Updated user ID: ${req.params.id}`);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function toggleStatus(req: Request, res: Response, next: NextFunction) {
  try {
    // Admin can only toggle users within their own agency
    if (req.user!.roleSlug === 'admin') {
      const target = await svc.getUser(Number(req.params.id));
      if (target.agencyId !== req.user!.agencyId) {
        res.status(403).json({ success: false, message: 'You do not have permission to access this resource' });
        return;
      }
    }
    const data = await svc.toggleStatus(Number(req.params.id));
    await logActivity(req, 'toggle_user_status', `Toggled status for user ID: ${req.params.id}`);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    // Admin can only delete users within their own agency
    if (req.user!.roleSlug === 'admin') {
      const target = await svc.getUser(Number(req.params.id));
      if (target.agencyId !== req.user!.agencyId) {
        res.status(403).json({ success: false, message: 'You do not have permission to access this resource' });
        return;
      }
    }
    await svc.deleteUser(Number(req.params.id), req.user!.id);
    await logActivity(req, 'delete_user', `Deleted user ID: ${req.params.id}`);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateProfileSchema.parse(req.body);
    const avatarPath = (req.file as Express.Multer.File | undefined)?.path;
    const data = await svc.updateProfile(req.user!.id, input, avatarPath);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
