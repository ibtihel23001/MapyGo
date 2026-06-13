import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import type { CreateRefundInput, UpdateRefundStatusInput } from './refunds.schema';

export async function listRefunds(query: any, agencyId: number | null, roleSlug: string) {
  const { page, perPage, skip } = getPagination(query);
  const isSuperAdmin = roleSlug === 'superadmin';

  const where: any = {
    ...(isSuperAdmin ? {} : { agencyId: agencyId! }),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, refunds] = await Promise.all([
    prisma.refund.count({ where }),
    prisma.refund.findMany({
      where, skip, take: perPage,
      orderBy: { createdAt: 'desc' },
      include: { ticket: { select: { ticketNumber: true, passengerName: true } } },
    }),
  ]);

  return { data: refunds, meta: buildMeta(total, page, perPage) };
}

export async function createRefund(input: CreateRefundInput, agencyId: number, requestedById: number) {
  return prisma.refund.create({
    data: { ...input, agencyId, requestedById },
  });
}

export async function updateRefundStatus(
  id: number,
  input: UpdateRefundStatusInput,
  processedById: number,
  agencyId: number | null,
  roleSlug: string,
) {
  const refund = await prisma.refund.findFirst({
    where: { id, ...(roleSlug !== 'superadmin' ? { agencyId: agencyId! } : {}) },
  });

  if (!refund) throw createError('Refund not found', 404);
  if (refund.status !== 'pending') throw createError('Only pending refunds can be updated', 400);

  return prisma.refund.update({
    where: { id },
    data: {
      status: input.status,
      notes: input.notes,
      processedById,
      processedAt: new Date(),
    },
  });
}
