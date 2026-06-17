import { Request, Response, NextFunction } from 'express';
import { importTicketsFromEmail } from './email-import.service';
import { logActivity } from '../../utils/activityLog';

/**
 * POST /api/email-import/run
 * Manually trigger an email import for the current admin's agency.
 */
export async function runImport(req: Request, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(403).json({ success: false, message: 'No agency associated with your account' });
    }

    const result = await importTicketsFromEmail(agencyId);

    await logActivity(
      req,
      'email_import',
      `Email import completed: ${result.imported} imported, ${result.skipped} skipped. Log: ${result.logFile ?? 'n/a'}`,
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
