import { Request, Response, NextFunction } from 'express';
import * as svc from './registrations.service';
import { createRegistrationSchema, reviewRegistrationSchema } from './registrations.schema';
import { logActivity } from '../../utils/activityLog';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listRegistrations(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getRegistration(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// Public — no auth needed
export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createRegistrationSchema.parse(req.body);
    const data = await svc.createRegistration(input);
    res.status(201).json({
      success: true,
      message: 'Your application has been submitted and is under review.',
      data: { id: data.id },
    });
  } catch (err) { next(err); }
}

export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    const input = reviewRegistrationSchema.parse(req.body);
    const data = await svc.reviewRegistration(Number(req.params.id), input, req.user!.id);
    await logActivity(
      req,
      'review_registration',
      `Registration ${req.params.id} → ${input.status}`,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
