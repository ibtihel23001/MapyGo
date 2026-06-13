import { Request, Response, NextFunction } from 'express';
import * as svc from './tickets.service';
import { createTicketSchema, updateTicketSchema, updateStatusSchema } from './tickets.schema';
import { logActivity } from '../../utils/activityLog';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listTickets(req.query, req.user!.id, req.user!.agencyId, req.user!.roleSlug);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getTicket(Number(req.params.id), req.user!.agencyId, req.user!.roleSlug);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createTicketSchema.parse(req.body);
    const data = await svc.createTicket(input, req.user!.agencyId!);
    await logActivity(req, 'create_ticket', `Created ticket: ${input.ticketNumber}`);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateTicketSchema.parse(req.body);
    const data = await svc.updateTicket(Number(req.params.id), input, req.user!.agencyId, req.user!.roleSlug);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateStatusSchema.parse(req.body);
    const data = await svc.updateTicketStatus(Number(req.params.id), input, req.user!.agencyId, req.user!.roleSlug);
    await logActivity(req, 'update_ticket_status', `Ticket ${req.params.id} → ${input.status}`);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteTicket(Number(req.params.id), req.user!.agencyId, req.user!.roleSlug);
    await logActivity(req, 'delete_ticket', `Deleted ticket ID: ${req.params.id}`);
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (err) { next(err); }
}

/** GET /api/tickets/export?status=&dateFrom=&dateTo=&search= */
export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await svc.exportTicketsCsv(req.query, req.user!.agencyId, req.user!.roleSlug);
    const filename = `tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  } catch (err) { next(err); }
}
