import { Request, Response, NextFunction } from 'express';
import { listClients, createClient, updateClient, deleteClient, clientSchema } from '../sellers/sellers.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json({ success: true, ...await listClients(req.query, req.user!.agencyId!) }); }
  catch (err) { next(err); }
}
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createClient(clientSchema.parse(req.body), req.user!.agencyId!);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateClient(Number(req.params.id), clientSchema.partial().parse(req.body) as any, req.user!.agencyId!);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteClient(Number(req.params.id), req.user!.agencyId!);
    res.json({ success: true, message: 'Client deleted' });
  } catch (err) { next(err); }
}
