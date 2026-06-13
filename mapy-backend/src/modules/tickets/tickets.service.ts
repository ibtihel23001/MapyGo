import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import type { CreateTicketInput, UpdateTicketInput, UpdateTicketStatusInput } from './tickets.schema';

function agencyScope(agencyId: number | null, isSuperAdmin: boolean) {
  if (isSuperAdmin) return {};
  if (!agencyId) throw createError('No agency associated with your account', 403);
  return { agencyId };
}

export async function listTickets(query: any, userId: number, agencyId: number | null, roleSlug: string) {
  const { page, perPage, skip } = getPagination(query);
  const search = query.search?.trim();
  const statusFilter = query.status;
  const dateFrom = query.dateFrom;
  const dateTo = query.dateTo;
  const isSuperAdmin = roleSlug === 'superadmin';

  const where: any = {
    ...agencyScope(agencyId, isSuperAdmin),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFrom || dateTo ? {
      departureDate: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
      },
    } : {}),
    ...(search ? {
      OR: [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { passengerName: { contains: search, mode: 'insensitive' } },
        { pnr: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [total, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where, skip, take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { data: tickets, meta: buildMeta(total, page, perPage) };
}

export async function getTicket(id: number, agencyId: number | null, roleSlug: string) {
  const isSuperAdmin = roleSlug === 'superadmin';
  const ticket = await prisma.ticket.findFirst({
    where: { id, ...agencyScope(agencyId, isSuperAdmin) },
    include: { refunds: true },
  });

  if (!ticket) throw createError('Ticket not found', 404);
  return ticket;
}

export async function createTicket(input: CreateTicketInput, agencyId: number) {
  const existing = await prisma.ticket.findUnique({ where: { ticketNumber: input.ticketNumber } });
  if (existing) throw createError('Ticket number already exists', 409);

  return prisma.ticket.create({
    data: {
      agencyId,
      ticketNumber: input.ticketNumber,
      pnr: input.pnr,
      passengerName: input.passengerName,
      airline: (input as any).airline ?? undefined,
      dateOfIssue: input.dateOfIssue ? new Date(input.dateOfIssue) : undefined,
      departureDate: input.departureDate ? new Date(input.departureDate) : undefined,
      arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : undefined,
      airFare: input.airFare,
      ttc: input.ttc,
      status: 'pending',
    },
  });
}

export async function updateTicket(id: number, input: UpdateTicketInput, agencyId: number | null, roleSlug: string) {
  await getTicket(id, agencyId, roleSlug);

  return prisma.ticket.update({
    where: { id },
    data: {
      ...(input.ticketNumber !== undefined ? { ticketNumber: input.ticketNumber } : {}),
      ...(input.pnr           !== undefined ? { pnr:           input.pnr           } : {}),
      ...(input.passengerName !== undefined ? { passengerName: input.passengerName } : {}),
      ...(input.airline       !== undefined ? { airline:       input.airline       } : {}),
      ...(input.dateOfIssue   !== undefined ? { dateOfIssue:   new Date(input.dateOfIssue!) } : {}),
      ...(input.departureDate !== undefined ? { departureDate: new Date(input.departureDate!) } : {}),
      ...(input.arrivalDate   !== undefined ? { arrivalDate:   new Date(input.arrivalDate!)   } : {}),
      ...(input.airFare       !== undefined ? { airFare:       input.airFare       } : {}),
      ...(input.ttc           !== undefined ? { ttc:           input.ttc           } : {}),
    },
  });
}

export async function updateTicketStatus(id: number, input: UpdateTicketStatusInput, agencyId: number | null, roleSlug: string) {
  await getTicket(id, agencyId, roleSlug);
  return prisma.ticket.update({ where: { id }, data: { status: input.status } });
}

export async function deleteTicket(id: number, agencyId: number | null, roleSlug: string) {
  await getTicket(id, agencyId, roleSlug);
  await prisma.ticket.delete({ where: { id } });
}

/**
 * Export all matching tickets as a CSV string.
 * Uses same filter logic as listTickets but returns all rows (no pagination).
 */
export async function exportTicketsCsv(query: any, agencyId: number | null, roleSlug: string): Promise<string> {
  const isSuperAdmin = roleSlug === 'superadmin';
  const search = query.search?.trim();
  const statusFilter = query.status;
  const dateFrom = query.dateFrom;
  const dateTo = query.dateTo;

  const where: any = {
    ...agencyScope(agencyId, isSuperAdmin),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFrom || dateTo ? {
      departureDate: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
      },
    } : {}),
    ...(search ? {
      OR: [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { passengerName: { contains: search, mode: 'insensitive' } },
        { pnr: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const header = 'Ticket Number,PNR,Passenger Name,Airline,Date of Issue,Departure Date,Arrival Date,Air Fare (DZD),TTC (DZD),Status\r\n';
  const rows = tickets.map((t: typeof tickets[number]) => [
    t.ticketNumber,
    t.pnr ?? '',
    t.passengerName,
    t.airline ?? '',
    t.dateOfIssue   ? t.dateOfIssue.toISOString().slice(0, 10)   : '',
    t.departureDate ? t.departureDate.toISOString().slice(0, 10) : '',
    t.arrivalDate   ? t.arrivalDate.toISOString().slice(0, 10)   : '',
    t.airFare != null ? Number(t.airFare).toFixed(2) : '',
    t.ttc     != null ? Number(t.ttc).toFixed(2)     : '',
    t.status,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

  return header + rows.join('\r\n');
}
