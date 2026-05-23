import prisma from '../../config/prisma';
import { getPagination, buildMeta } from '../../utils/paginate';
import { createError } from '../../middleware/errorHandler';
import type { CreateSubscriptionInput } from './subscriptions.schema';

export async function listSubscriptions(query: any) {
  const { page, perPage, skip } = getPagination(query);

  const where: any = query.agencyId ? { agencyId: Number(query.agencyId) } : {};

  const [total, subs] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where, skip, take: perPage,
      orderBy: { createdAt: 'desc' },
      include: { agency: { select: { id: true, name: true } } },
    }),
  ]);

  return { data: subs, meta: buildMeta(total, page, perPage) };
}

export async function getActiveSubscription(agencyId: number) {
  return prisma.subscription.findFirst({
    where: { agencyId, status: 'active' },
    orderBy: { endDate: 'desc' },
  });
}

export async function createSubscription(input: CreateSubscriptionInput, createdById: number) {
  return prisma.subscription.create({
    data: {
      ...input,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      createdById,
    },
  });
}

export async function updateSubscriptionStatus(id: number, status: string) {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) throw createError('Subscription not found', 404);
  return prisma.subscription.update({ where: { id }, data: { status: status as any } });
}
