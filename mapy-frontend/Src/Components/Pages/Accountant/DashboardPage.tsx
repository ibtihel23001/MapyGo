import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { TrendingUp, TrendingDown, RotateCcw, DollarSign } from 'lucide-react'
import { useAccountantStats } from '../../../API/hooks'
import { StatCard, PageHeader, Spinner } from '../../shared'
import { fCurrency, fDate } from '../../utils/format'

export default function AccountantDashboard() {
  const { data, isLoading } = useAccountantStats()

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const stats = data?.stats

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Financial overview for this month" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue (MTD)"    value={fCurrency(stats?.revenueThisMonth)}  icon={<TrendingUp size={20} />}   color="green" />
        <StatCard label="Expenses (MTD)"   value={fCurrency(stats?.expensesThisMonth)} icon={<TrendingDown size={20} />} color="red" />
        <StatCard label="Refunds (MTD)"    value={fCurrency(stats?.refundsThisMonth)}  icon={<RotateCcw size={20} />}    color="amber" />
        <StatCard label="Net Profit (MTD)" value={fCurrency(stats?.netProfit)}         icon={<DollarSign size={20} />}   color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="font-display font-semibold text-slate-800">Monthly Breakdown</h2>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.monthlyBreakdown ?? []} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue"  fill="#10b981" name="Revenue"  radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="font-display font-semibold text-slate-800">Recent Transactions</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {(data?.recentTransactions ?? []).map((t: any) => (
                  <tr key={t.id}>
                    <td className="text-xs text-slate-400">{fDate(t.transactionDate)}</td>
                    <td className="text-sm max-w-[160px] truncate">{t.description}</td>
                    <td className={t.type === 'revenue' ? 'text-emerald-600 font-medium text-sm' : 'text-red-500 font-medium text-sm'}>
                      {t.type === 'revenue' ? '+' : '-'}{fCurrency(t.amount, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
