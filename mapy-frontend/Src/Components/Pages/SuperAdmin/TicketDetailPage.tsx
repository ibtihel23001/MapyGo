import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTicket } from '../../../API/hooks'
import { Button, Spinner } from '../../shared'
import { fDate, fCurrency } from '../../utils/format'
import { TICKET_STATUS_COLORS } from '../../utils/constants'

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ticket, isLoading } = useTicket(Number(id))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!ticket) return <p className="text-slate-500">Ticket not found.</p>

  const row = (label: string, value?: string | null) => (
    <div className="flex justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft size={16} /> Back
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="font-display font-bold text-2xl text-slate-900">Ticket #{ticket.ticketNumber}</h1>
          <span className={TICKET_STATUS_COLORS[ticket.status]}>{ticket.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="font-semibold text-slate-700">Passenger Info</h2></div>
          <div className="card-body">
            {row('Name', ticket.passengerName)}
            {row('Email', ticket.passengerEmail)}
            {row('Phone', ticket.passengerPhone)}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-semibold text-slate-700">Flight Details</h2></div>
          <div className="card-body">
            {row('Route', ticket.origin && ticket.destination ? `${ticket.origin} → ${ticket.destination}` : null)}
            {row('Airline', ticket.airline)}
            {row('Flight #', ticket.flightNumber)}
            {row('PNR', ticket.pnr)}
            {row('Class', ticket.ticketClass)}
            {row('Departure', fDate(ticket.departureDate))}
            {row('Return', fDate(ticket.returnDate))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-semibold text-slate-700">Pricing</h2></div>
          <div className="card-body">
            {row('Fare', fCurrency(ticket.fare, ticket.currency))}
            {row('Taxes', fCurrency(ticket.taxes, ticket.currency))}
            {row('Fees', fCurrency(ticket.fees, ticket.currency))}
            {row('Total', fCurrency(ticket.totalAmount, ticket.currency))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-semibold text-slate-700">Other</h2></div>
          <div className="card-body">
            {row('Seller', ticket.sellerName)}
            {row('Client', ticket.clientName)}
            {row('Created', fDate(ticket.createdAt, 'dd MMM yyyy HH:mm'))}
          </div>
        </div>
      </div>
    </div>
  )
}
