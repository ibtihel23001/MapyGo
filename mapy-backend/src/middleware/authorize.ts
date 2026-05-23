import { Request, Response, NextFunction } from 'express';

/**
 * authorize('superadmin')            — single role
 * authorize('admin', 'accountant')  — any of the listed roles
 */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.roleSlug)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
}
