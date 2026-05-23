import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { Ticket, RotateCcw, TrendingUp, Clock } from 'lucide-react'
import { useDashboardStats } from '../../../API/hooks'
import { StatCard, PageHeader, Spinner } from '../../shared'
import { fCurrency, fNumber } from '../../utils/format'

export default function AdminDashboard() {
  const { data, isLoading } = useDashboardStats()

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your agency overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tickets" value={fNumber(data?.totalTickets)} icon={<Ticket size={20} />} color="blue" />
        <StatCard label="Total Revenue" value={fCurrency(data?.totalRevenue)} icon={<TrendingUp size={20} />} color="green" />
        <StatCard label="Total Refunds" value={fCurrency(data?.totalRefunds)} icon={<RotateCcw size={20} />} color="amber" />
        <StatCard label="Pending Refunds" value={fNumber(data?.pendingRefunds)} icon={<Clock size={20} />} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Monthly Revenue</h2></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data?.chartData ?? []}>
                <defs>
                  <linearGradient id="aRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c11414" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#c11414" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#c11414" fill="url(#aRevGrad)" strokeWidth={2} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-display font-semibold text-slate-800">Revenue vs Refunds</h2></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.chartData ?? []} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#c11414" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="refunds" fill="#3b82f6" name="Refunds" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
