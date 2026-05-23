import { Request, Response, NextFunction } from 'express';
import * as svc from './transactions.service';
import { createTransactionSchema } from './transactions.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listTransactions(req.query, req.user!.agencyId, req.user!.roleSlug);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createTransactionSchema.parse(req.body);
    const data = await svc.createTransaction(input, req.user!.agencyId!, req.user!.id);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
