import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import type { CreateReportInput } from './reports.schema';

export async function listReports(query: any, agencyId: number) {
  const { page, perPage, skip } = getPagination(query);

  const [total, data] = await Promise.all([
    prisma.report.count({ where: { agencyId } }),
    prisma.report.findMany({
      where: { agencyId },
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: { generator: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return { data, meta: buildMeta(total, page, perPage) };
}

export async function generateReport(
  input: CreateReportInput,
  agencyId: number,
  generatedBy: number,
) {
  const periodStart = input.periodStart ? new Date(input.periodStart) : undefined;
  const periodEnd = input.periodEnd ? new Date(input.periodEnd) : undefined;

  const dateFilter =
    periodStart && periodEnd
      ? { createdAt: { gte: periodStart, lte: periodEnd } }
      : {};

  let reportData: Record<string, unknown> = {};

  switch (input.type) {
    case 'tickets': {
      const [total, byStatus, byStatusBreakdown] = await Promise.all([
        prisma.ticket.count({ where: { agencyId, ...dateFilter } }),
        prisma.ticket.groupBy({
          by: ['status'],
          where: { agencyId, ...dateFilter },
          _count: { status: true },
        }),
        prisma.ticket.groupBy({
          by: ['status'],
          where: { agencyId, ...dateFilter },
          _count: { status: true },
          orderBy: { _count: { status: 'desc' } },
          take: 10,
        }),
      ]);
      reportData = { total, byStatus, byStatusBreakdown };
      break;
    }

    case 'financial': {
      const [revenue, expenses, refunds] = await Promise.all([
        prisma.transaction.aggregate({
          where: { agencyId, type: 'revenue', ...dateFilter },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { agencyId, type: 'expense', ...dateFilter },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { agencyId, type: 'refund', ...dateFilter },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      const totalRevenue = Number(revenue._sum.amount ?? 0);
      const totalExpenses = Number(expenses._sum.amount ?? 0);
      const totalRefunds = Number(refunds._sum.amount ?? 0);

      reportData = {
        revenue: { total: totalRevenue, count: revenue._count },
        expenses: { total: totalExpenses, count: expenses._count },
        refunds: { total: totalRefunds, count: refunds._count },
        netProfit: totalRevenue - totalExpenses - totalRefunds,
      };
      break;
    }

    case 'refunds': {
      const [total, byStatus] = await Promise.all([
        prisma.refund.count({ where: { agencyId, ...dateFilter } }),
        prisma.refund.groupBy({
          by: ['status'],
          where: { agencyId, ...dateFilter },
          _count: { status: true },
          _sum: { refundAmount: true },
        }),
      ]);
      reportData = { total, byStatus };
      break;
    }

    case 'summary': {
      const [tickets, refunds, transactions, clients, sellers] = await Promise.all([
        prisma.ticket.count({ where: { agencyId } }),
        prisma.refund.count({ where: { agencyId } }),
        prisma.transaction.aggregate({
          where: { agencyId, type: 'revenue' },
          _sum: { amount: true },
        }),
        prisma.client.count({ where: { agencyId } }),
        prisma.seller.count({ where: { agencyId } }),
      ]);
      reportData = {
        totalTickets: tickets,
        totalRefunds: refunds,
        totalRevenue: Number(transactions._sum.amount ?? 0),
        totalClients: clients,
        totalSellers: sellers,
      };
      break;
    }
  }

  // Persist the report record
  const report = await prisma.report.create({
    data: {
      agencyId,
      type: input.type,
      title: input.title,
      periodStart,
      periodEnd,
      generatedBy,
    },
  });

  return { report, data: reportData };
}

export async function deleteReport(id: number, agencyId: number) {
  const report = await prisma.report.findFirst({ where: { id, agencyId } });
  if (!report) throw createError('Report not found', 404);
  await prisma.report.delete({ where: { id } });
}
