import { Request, Response, NextFunction } from 'express';
import {
  getAdminStats,
  getSuperAdminStats,
  getAccountantStats,
} from './dashboard.service';

export async function dashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const { roleSlug, agencyId } = req.user!;

    let data: unknown;

    switch (roleSlug) {
      case 'superadmin':
        data = await getSuperAdminStats();
        break;
      case 'admin':
        data = await getAdminStats(agencyId!);
        break;
      case 'accountant':
        data = await getAccountantStats(agencyId!);
        break;
      default:
        res.status(403).json({ success: false, message: 'Unauthorized role' });
        return;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

