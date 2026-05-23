import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Building2, Ticket, TrendingUp, RotateCcw } from 'lucide-react'
import { useSuperadminStats } from '../../../API/hooks'
import { StatCard, PageHeader, Spinner } from '../../shared'
import { fCurrency, fNumber } from '../../utils/format'

export default function SuperadminDashboard() {
  const { data, isLoading } = useSuperadminStats()

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Agencies" value={fNumber(data?.activeAgencies)} icon={<Building2 size={20} />} color="brand" />
        <StatCard label="Total Tickets" value={fNumber(data?.totalTickets)} icon={<Ticket size={20} />} color="blue" />
        <StatCard label="Total Revenue" value={fCurrency(data?.totalRevenue)} icon={<TrendingUp size={20} />} color="green" />
        <StatCard label="Pending Refunds" value={fNumber(data?.pendingRefunds)} icon={<RotateCcw size={20} />} color="amber" />
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-display font-semibold text-slate-800">Revenue & Refunds</h2>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data?.chartData ?? []}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c11414" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#c11414" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#c11414" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="refunds" stroke="#3b82f6" fill="url(#refGrad)" strokeWidth={2} name="Refunds" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
