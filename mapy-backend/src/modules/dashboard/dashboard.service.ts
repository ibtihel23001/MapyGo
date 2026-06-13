import prisma from '../../config/prisma';

// ─── Admin dashboard (agency-scoped) ─────────────────────────
export async function getAdminStats(agencyId: number) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalTickets,
    ticketsThisMonth,
    ticketsLastMonth,
    ticketsByStatus,
    pendingRefunds,
    totalRefunds,
    revenueThisMonth,
    revenueLastMonth,
    totalClients,
    totalSellers,
    recentTickets,
    revenueByMonth,
    subscription,
  ] = await Promise.all([
    // Ticket counts
    prisma.ticket.count({ where: { agencyId } }),
    prisma.ticket.count({ where: { agencyId, createdAt: { gte: startOfMonth } } }),
    prisma.ticket.count({
      where: { agencyId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),

    // Tickets grouped by status
    prisma.ticket.groupBy({
      by: ['status'],
      where: { agencyId },
      _count: { status: true },
    }),

    // Refunds
    prisma.refund.count({ where: { agencyId, status: 'pending' } }),
    prisma.refund.count({ where: { agencyId } }),

    // Revenue
    prisma.transaction.aggregate({
      where: { agencyId, type: 'revenue', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        agencyId,
        type: 'revenue',
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { amount: true },
    }),

    // Contacts
    prisma.client.count({ where: { agencyId } }),
    prisma.seller.count({ where: { agencyId } }),

    // Recent tickets for table
    prisma.ticket.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        ticketNumber: true,
        passengerName: true,
        airline: true,
        status: true,
        airFare: true,
        ttc: true,
        createdAt: true,
      },
    }),

    // Revenue chart — last 6 months
    prisma.$queryRaw<{ month: string; total: number }[]>`
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM') AS month,
        SUM(amount)::numeric(12,2)     AS total
      FROM transactions
      WHERE agency_id = ${agencyId}
        AND type = 'revenue'
        AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `,

    // Active subscription
    prisma.subscription.findFirst({
      where: { agencyId, status: 'active' },
      orderBy: { endDate: 'desc' },
    }),
  ]);

  const ticketGrowth =
    ticketsLastMonth > 0
      ? Math.round(((ticketsThisMonth - ticketsLastMonth) / ticketsLastMonth) * 100)
      : ticketsThisMonth > 0
        ? 100
        : 0;

  const revenueThis = Number(revenueThisMonth._sum.amount ?? 0);
  const revenueLast = Number(revenueLastMonth._sum.amount ?? 0);
  const revenueGrowth =
    revenueLast > 0
      ? Math.round(((revenueThis - revenueLast) / revenueLast) * 100)
      : revenueThis > 0
        ? 100
        : 0;

  return {
    stats: {
      totalTickets,
      ticketsThisMonth,
      ticketGrowth,
      pendingRefunds,
      totalRefunds,
      revenueThisMonth: revenueThis,
      revenueGrowth,
      totalClients,
      totalSellers,
    },
    ticketsByStatus: ticketsByStatus.reduce(
  (acc: Record<string, number>, g: { status: string; _count: { status: number } }) =>
    ({ ...acc, [g.status]: g._count.status }),
  {} as Record<string, number>,
),
    recentTickets,
    revenueChart: revenueByMonth,
    subscription,
  };
}

// ─── Superadmin dashboard (platform-wide) ────────────────────
export async function getSuperAdminStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalAgencies,
    activeAgencies,
    pendingAgencies,
    totalAdmins,
    pendingRegistrations,
    totalTickets,
    ticketsThisMonth,
    totalRevenue,
    revenueThisMonth,
    recentAgencies,
    agenciesByStatus,
    platformRevenueChart,
  ] = await Promise.all([
    prisma.agency.count(),
    prisma.agency.count({ where: { status: 'active' } }),
    prisma.agency.count({ where: { status: 'pending' } }),
    prisma.user.count({ where: { role: { slug: 'admin' } } }),
    prisma.agencyRegistration.count({ where: { status: 'pending' } }),

    prisma.ticket.count(),
    prisma.ticket.count({ where: { createdAt: { gte: startOfMonth } } }),

    prisma.transaction.aggregate({
      where: { type: 'revenue' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'revenue', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),

    // Recent agencies with subscription info
    prisma.agency.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        _count: { select: { tickets: true } },
        subscriptions: {
          where: { status: 'active' },
          orderBy: { endDate: 'desc' },
          take: 1,
          select: { planName: true, endDate: true },
        },
      },
    }),

    prisma.agency.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    prisma.$queryRaw<{ month: string; total: number }[]>`
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM') AS month,
        SUM(amount)::numeric(12,2)     AS total
      FROM transactions
      WHERE type = 'revenue'
        AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `,
  ]);

  return {
    stats: {
      totalAgencies,
      activeAgencies,
      pendingAgencies,
      totalAdmins,
      pendingRegistrations,
      totalTickets,
      ticketsThisMonth,
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
      revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
    },
    agenciesByStatus: agenciesByStatus.reduce(
      (acc: Record<string, number>, g: { status: string; _count: { status: number } }) =>
    ({ ...acc, [g.status]: g._count.status }),
  {} as Record<string, number>,
    ),
    recentAgencies,
    platformRevenueChart,
  };
}

// ─── Accountant dashboard (agency-scoped, financial focus) ───
export async function getAccountantStats(agencyId: number) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    revenueThisMonth,
    expensesThisMonth,
    refundsThisMonth,
    pendingRefunds,
    recentTransactions,
    monthlyBreakdown,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { agencyId, type: 'revenue', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { agencyId, type: 'expense', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { agencyId, type: 'refund', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.refund.count({ where: { agencyId, status: 'pending' } }),

    prisma.transaction.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    prisma.$queryRaw<{ month: string; revenue: number; expenses: number }[]>`
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM') AS month,
        SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END)::numeric(12,2) AS revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)::numeric(12,2) AS expenses
      FROM transactions
      WHERE agency_id = ${agencyId}
        AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `,
  ]);

  const rev = Number(revenueThisMonth._sum.amount ?? 0);
  const exp = Number(expensesThisMonth._sum.amount ?? 0);
  const ref = Number(refundsThisMonth._sum.amount ?? 0);

  return {
    stats: {
      revenueThisMonth: rev,
      expensesThisMonth: exp,
      refundsThisMonth: ref,
      netProfit: rev - exp - ref,
      pendingRefunds,
      revenueTransactions: revenueThisMonth._count,
      expenseTransactions: expensesThisMonth._count,
    },
    recentTransactions,
    monthlyBreakdown,
  };
}
