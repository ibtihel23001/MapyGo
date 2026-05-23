import { Request, Response, NextFunction } from 'express';
import * as svc from './agencies.service';
import { createAgencySchema, updateAgencySchema, updateStatusSchema } from './agencies.schema';
import { logActivity } from '../../utils/activityLog';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listAgencies(req.query as any);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getAgency(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createAgencySchema.parse(req.body);
    const data = await svc.createAgency(input, req.user!.id);
    await logActivity(req, 'create_agency', `Created agency: ${data.name}`);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateAgencySchema.parse(req.body);
    const data = await svc.updateAgency(Number(req.params.id), input);
    await logActivity(req, 'update_agency', `Updated agency ID: ${req.params.id}`);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateStatusSchema.parse(req.body);
    const data = await svc.updateAgencyStatus(Number(req.params.id), input);
    await logActivity(req, 'update_agency_status', `Agency ${req.params.id} → ${input.status}`);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteAgency(Number(req.params.id));
    await logActivity(req, 'delete_agency', `Deleted agency ID: ${req.params.id}`);
    res.json({ success: true, message: 'Agency deleted' });
  } catch (err) { next(err); }
}
