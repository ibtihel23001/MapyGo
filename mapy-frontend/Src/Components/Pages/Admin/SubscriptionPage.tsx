import { useSubscriptions } from '../../../API/hooks'
import { PageHeader, Spinner, EmptyState } from '../../shared'
import { fDate, fCurrency } from '../../utils/format'
import { SUBSCRIPTION_STATUS_COLORS } from '../../utils/constants'
import type { Subscription } from '../../types'

export default function SubscriptionPage() {
  const { data, isLoading } = useSubscriptions()

  const active = data?.data.find((s: Subscription) => s.status === 'active')

  return (
    <div>
      <PageHeader title="Subscription" subtitle="Your agency's subscription plan" />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          {/* Active plan card */}
          <div className="card">
            <div className="card-body">
              {!active ? (
                <EmptyState message="No active subscription found." />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-display font-bold text-xl text-slate-900 mb-1">{active.planName}</h2>
                    <p className="text-sm text-slate-500">
                      Valid {fDate(active.startDate)} — {fDate(active.endDate)}
                    </p>
                    {active.paymentMethod && (
                      <p className="text-sm text-slate-500 mt-1">Payment: {active.paymentMethod}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{fCurrency(active.price, active.currency)}</p>
                    <span className={SUBSCRIPTION_STATUS_COLORS[active.status]}>{active.status}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-display font-semibold text-slate-800">Subscription History</h2>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Plan</th><th>Price</th><th>Start</th><th>End</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {!data?.data.length && <tr><td colSpan={5}><EmptyState /></td></tr>}
                  {data?.data.map((s: Subscription) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.planName}</td>
                      <td>{fCurrency(s.price, s.currency)}</td>
                      <td>{fDate(s.startDate)}</td>
                      <td>{fDate(s.endDate)}</td>
                      <td><span className={SUBSCRIPTION_STATUS_COLORS[s.status]}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
