import prisma from '../../config/prisma';
import { getPagination, buildMeta } from '../../utils/paginate';
import type { CreateTransactionInput } from './transactions.schema';

export async function listTransactions(query: any, agencyId: number | null, roleSlug: string) {
  const { page, perPage, skip } = getPagination(query);
  const isSuperAdmin = roleSlug === 'superadmin';

  const where: any = {
    ...(isSuperAdmin ? {} : { agencyId: agencyId! }),
    ...(query.type ? { type: query.type } : {}),
  };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
  ]);

  return { data: transactions, meta: buildMeta(total, page, perPage) };
}

export async function createTransaction(input: CreateTransactionInput, agencyId: number, createdById: number) {
  return prisma.transaction.create({
    data: {
      ...input,
      agencyId,
      createdById,
      transactionDate: new Date(input.transactionDate),
    },
  });
}
