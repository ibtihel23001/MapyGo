import { Request, Response, NextFunction } from 'express';
import * as svc from './refunds.service';
import { createRefundSchema, updateRefundStatusSchema } from './refunds.schema';
import { logActivity } from '../../utils/activityLog';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listRefunds(req.query, req.user!.agencyId, req.user!.roleSlug);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createRefundSchema.parse(req.body);
    const data = await svc.createRefund(input, req.user!.agencyId!, req.user!.id);
    await logActivity(req, 'create_refund', `Refund created for: ${input.passengerName}`);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateRefundStatusSchema.parse(req.body);
    const data = await svc.updateRefundStatus(
      Number(req.params.id), input, req.user!.id, req.user!.agencyId, req.user!.roleSlug
    );
    await logActivity(req, 'update_refund_status', `Refund ${req.params.id} → ${input.status}`);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
