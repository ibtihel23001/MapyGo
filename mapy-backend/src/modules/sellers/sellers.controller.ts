import { Request, Response, NextFunction } from 'express';
import { listSellers, createSeller, updateSeller, deleteSeller, sellerSchema } from './sellers.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listSellers(req.query, req.user!.agencyId!);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = sellerSchema.parse(req.body);
    const data = await createSeller(input, req.user!.agencyId!);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = sellerSchema.partial().parse(req.body);
    const data = await updateSeller(Number(req.params.id), input as any, req.user!.agencyId!);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteSeller(Number(req.params.id), req.user!.agencyId!);
    res.json({ success: true, message: 'Seller deleted' });
  } catch (err) { next(err); }
}
