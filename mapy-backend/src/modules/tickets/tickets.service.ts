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
  const isSuperAdmin = roleSlug === 'superadmin';

  const where: any = {
    ...agencyScope(agencyId, isSuperAdmin),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? {
      OR: [
        { ticketNumber: { contains: search } },
        { passengerName: { contains: search } },
        { pnr: { contains: search } },
        { airline: { contains: search } },
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
      ...input,
      agencyId,
      departureDate: input.departureDate ? new Date(input.departureDate) : undefined,
      returnDate: input.returnDate ? new Date(input.returnDate) : undefined,
    },
  });
}

export async function updateTicket(id: number, input: UpdateTicketInput, agencyId: number | null, roleSlug: string) {
  await getTicket(id, agencyId, roleSlug);

  return prisma.ticket.update({
    where: { id },
    data: {
      ...input,
      departureDate: input.departureDate ? new Date(input.departureDate) : undefined,
      returnDate: input.returnDate ? new Date(input.returnDate) : undefined,
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
