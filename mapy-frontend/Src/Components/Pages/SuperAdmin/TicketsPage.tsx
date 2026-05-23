import { useState } from 'react'
import { useTickets } from '../../../API/hooks'
import { PageHeader, SearchInput, SelectFilter, Spinner, EmptyState, Pagination } from '../../shared'
import { fDate, fCurrency } from '../../utils/format'
import { TICKET_STATUS_COLORS } from '../../utils/constants'
import { Link } from 'react-router-dom'
import type { Ticket } from '../../types'

export default function SuperadminTicketsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useTickets({ page, search, status })

  return (
    <div>
      <PageHeader title="Tickets" subtitle="All tickets across agencies" />
      <div className="card">
        <div className="card-header gap-3 flex-wrap">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Passenger, ticket #…" />
          <SelectFilter value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
            { label: 'Pending', value: 'pending' },
            { label: 'Issued', value: 'issued' },
            { label: 'Cancelled', value: 'cancelled' },
            { label: 'Refunded', value: 'refunded' },
          ]} placeholder="All Status" />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Ticket #</th><th>Passenger</th><th>Route</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={6}><EmptyState /></td></tr>}
                {data?.data.map((t: Ticket) => (
                  <tr key={t.id}>
                    <td><Link to={`/superadmin/tickets/${t.id}`} className="font-mono text-xs text-brand-700 hover:underline">{t.ticketNumber}</Link></td>
                    <td><div className="font-medium">{t.passengerName}</div><div className="text-xs text-slate-400">{t.airline}</div></td>
                    <td className="text-sm">{t.origin ?? '—'} → {t.destination ?? '—'}</td>
                    <td>{fDate(t.departureDate)}</td>
                    <td>{fCurrency(t.totalAmount, t.currency)}</td>
                    <td><span className={TICKET_STATUS_COLORS[t.status]}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>
    </div>
  )
}
