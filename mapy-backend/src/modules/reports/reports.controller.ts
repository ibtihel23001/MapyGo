import { Request, Response, NextFunction } from 'express';
import * as svc from './reports.service';
import { createReportSchema } from './reports.schema';
import { logActivity } from '../../utils/activityLog';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listReports(req.query, req.user!.agencyId!);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createReportSchema.parse(req.body);
    const result = await svc.generateReport(input, req.user!.agencyId!, req.user!.id);
    await logActivity(req, 'generate_report', `Generated ${input.type} report: ${input.title}`);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteReport(Number(req.params.id), req.user!.agencyId!);
    await logActivity(req, 'delete_report', `Deleted report ID: ${req.params.id}`);
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) { next(err); }
}
