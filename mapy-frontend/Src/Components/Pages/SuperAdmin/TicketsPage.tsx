import { useState } from 'react'
import { useTickets } from '../../../API/hooks'
import {
  PageHeader, SearchInput, SelectFilter, Spinner, EmptyState, Pagination,
} from '../../shared'
import { fDate } from '../../utils/format'
import { TICKET_STATUS_COLORS } from '../../utils/constants'
import { Link } from 'react-router-dom'
import type { Ticket } from '../../types'

export default function SuperadminTicketsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page,   setPage]   = useState(1)

  const { data, isLoading } = useTickets({ page, search, status })

  return (
    <div>
      <PageHeader title="Tickets" subtitle="All tickets across agencies" />
      <div className="card">
        <div className="card-header gap-3 flex-wrap">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Passenger, ticket #, PNR…"
          />
          <SelectFilter
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={[
              { label: 'Pending',  value: 'pending'  },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' },
              { label: 'Refund',   value: 'refund'   },
            ]}
            placeholder="All Status"
          />
        </div>

        {isLoading
          ? <div className="flex justify-center py-16"><Spinner /></div>
          : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>PNR</th>
                    <th>Passenger</th>
                    <th>Airline</th>
                    <th>Departure</th>
                    <th>Air Fare</th>
                    <th>TTC</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.data.length && (
                    <tr><td colSpan={8}><EmptyState /></td></tr>
                  )}
                  {data?.data.map((t: Ticket) => (
                    <tr key={t.id}>
                      <td>
                        <Link
                          to={`/superadmin/tickets/${t.id}`}
                          className="font-mono text-xs text-brand-700 hover:underline"
                        >
                          {t.ticketNumber}
                        </Link>
                      </td>
                      <td className="text-sm text-slate-500">{t.pnr ?? '—'}</td>
                      <td className="font-medium">{t.passengerName}</td>
                      <td className="text-sm text-slate-500">{t.airline ?? '—'}</td>
                      <td className="text-sm">{fDate(t.departureDate)}</td>
                      <td className="text-sm">
                        {t.airFare != null ? `${Number(t.airFare).toLocaleString()} DZD` : '—'}
                      </td>
                      <td className="text-sm font-medium">
                        {t.ttc != null ? `${Number(t.ttc).toLocaleString()} DZD` : '—'}
                      </td>
                      <td>
                        <span className={TICKET_STATUS_COLORS[t.status] ?? 'badge-secondary'}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>
    </div>
  )
}
