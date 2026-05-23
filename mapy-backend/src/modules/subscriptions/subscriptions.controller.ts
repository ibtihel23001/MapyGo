import { Request, Response, NextFunction } from 'express';
import * as svc from './subscriptions.service';
import { createSubscriptionSchema, updateSubscriptionStatusSchema } from './subscriptions.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listSubscriptions(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getActive(req: Request, res: Response, next: NextFunction) {
  try {
    const agencyId = req.user!.agencyId ?? Number(req.params.agencyId);
    const data = await svc.getActiveSubscription(agencyId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createSubscriptionSchema.parse(req.body);
    const data = await svc.createSubscription(input, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = updateSubscriptionStatusSchema.parse(req.body);
    const data = await svc.updateSubscriptionStatus(Number(req.params.id), status);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
