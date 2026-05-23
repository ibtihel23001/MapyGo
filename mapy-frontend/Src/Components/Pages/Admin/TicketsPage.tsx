import { useState } from 'react'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket } from '../../../API/hooks'
import {
  PageHeader, Button, SearchInput, SelectFilter, Modal, FormField,
  ConfirmDialog, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, fCurrency, getErrorMessage } from '../../utils/format'
import { TICKET_STATUS_COLORS } from '../../utils/constants'
import type { Ticket } from '../../types'

const schema = z.object({
  passengerName: z.string().min(1, 'Required'),
  passengerEmail: z.string().email().optional().or(z.literal('')),
  passengerPhone: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  departureDate: z.string().optional(),
  returnDate: z.string().optional(),
  airline: z.string().optional(),
  flightNumber: z.string().optional(),
  ticketClass: z.string().optional(),
  fare: z.coerce.number().optional(),
  taxes: z.coerce.number().optional(),
  fees: z.coerce.number().optional(),
  totalAmount: z.coerce.number().optional(),
  currency: z.string().default('USD'),
  pnr: z.string().optional(),
  sellerName: z.string().optional(),
  clientName: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function AdminTicketsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useTickets({ page, search, status })
  const createMut = useCreateTicket()
  const updateMut = useUpdateTicket(selected?.id ?? 0)
  const deleteMut = useDeleteTicket()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function openCreate() { setSelected(null); reset({}); setModal('create') }
  function openEdit(t: Ticket) {
    setSelected(t)
    reset({
      passengerName: t.passengerName,
      pnr: t.pnr ?? undefined,
      passengerEmail: t.passengerEmail ?? undefined,
      passengerPhone: t.passengerPhone ?? undefined,
      origin: t.origin ?? undefined,
      destination: t.destination ?? undefined,
      departureDate: t.departureDate?.slice(0, 10) ?? undefined,
      returnDate: t.returnDate?.slice(0, 10) ?? undefined,
      airline: t.airline ?? undefined,
      flightNumber: t.flightNumber ?? undefined,
      ticketClass: t.ticketClass ?? undefined,
      fare: t.fare ?? undefined,
      taxes: t.taxes ?? undefined,
      fees: t.fees ?? undefined,
      totalAmount: t.totalAmount ?? undefined,
      currency: t.currency ?? undefined,
      sellerName: t.sellerName ?? undefined,
      clientName: t.clientName ?? undefined,
    })
    setModal('edit')
  }

  function onSubmit(d: FormData) {
    if (modal === 'create') createMut.mutate(d, { onSuccess: () => setModal(null) })
    else if (selected) updateMut.mutate(d, { onSuccess: () => setModal(null) })
  }

  const mutErr = modal === 'create' ? createMut.error : updateMut.error

  return (
    <div>
      <PageHeader title="Tickets" subtitle="Manage flight tickets" action={
        <Button onClick={openCreate}><Plus size={16} /> New Ticket</Button>
      } />
      <div className="card">
        <div className="card-header gap-3 flex-wrap">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Passenger, ticket #…" />
          <SelectFilter value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
            { label: 'Pending', value: 'pending' }, { label: 'Issued', value: 'issued' },
            { label: 'Cancelled', value: 'cancelled' }, { label: 'Refunded', value: 'refunded' }, { label: 'Used', value: 'used' },
          ]} placeholder="All Status" />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Ticket #</th><th>Passenger</th><th>Route</th><th>Departure</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={7}><EmptyState /></td></tr>}
                {data?.data.map((t: Ticket) => (
                  <tr key={t.id}>
                    <td><span className="font-mono text-xs text-brand-700">{t.ticketNumber}</span></td>
                    <td><div className="font-medium">{t.passengerName}</div><div className="text-xs text-slate-400">{t.airline}</div></td>
                    <td className="text-sm">{t.origin ?? '—'} → {t.destination ?? '—'}</td>
                    <td>{fDate(t.departureDate)}</td>
                    <td>{fCurrency(t.totalAmount, t.currency)}</td>
                    <td><span className={TICKET_STATUS_COLORS[t.status]}>{t.status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => openEdit(t)}><Pencil size={14} /></button>
                        <button className="btn-ghost btn-sm p-1.5 text-red-500" onClick={() => setDeleteId(t.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'create' ? 'New Ticket' : 'Edit Ticket'} size="lg">
        {mutErr && <div className="mb-4"><ErrorAlert message={getErrorMessage(mutErr)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2"><FormField label="Passenger Name" error={errors.passengerName?.message} required><input {...register('passengerName')} className="input" /></FormField></div>
            <FormField label="PNR" error={errors.pnr?.message}><input {...register('pnr')} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Email" error={errors.passengerEmail?.message}><input type="email" {...register('passengerEmail')} className="input" /></FormField>
            <FormField label="Phone" error={errors.passengerPhone?.message}><input {...register('passengerPhone')} className="input" /></FormField>
            <FormField label="Class" error={errors.ticketClass?.message}><input {...register('ticketClass')} className="input" placeholder="Economy" /></FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Origin" error={errors.origin?.message}><input {...register('origin')} className="input" placeholder="DZA" /></FormField>
            <FormField label="Destination" error={errors.destination?.message}><input {...register('destination')} className="input" placeholder="CDG" /></FormField>
            <FormField label="Airline" error={errors.airline?.message}><input {...register('airline')} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Departure Date" error={errors.departureDate?.message}><input type="date" {...register('departureDate')} className="input" /></FormField>
            <FormField label="Return Date" error={errors.returnDate?.message}><input type="date" {...register('returnDate')} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <FormField label="Fare" error={errors.fare?.message}><input type="number" step="0.01" {...register('fare')} className="input" /></FormField>
            <FormField label="Taxes" error={errors.taxes?.message}><input type="number" step="0.01" {...register('taxes')} className="input" /></FormField>
            <FormField label="Fees" error={errors.fees?.message}><input type="number" step="0.01" {...register('fees')} className="input" /></FormField>
            <FormField label="Total" error={errors.totalAmount?.message}><input type="number" step="0.01" {...register('totalAmount')} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Currency" error={errors.currency?.message}><input {...register('currency')} className="input" defaultValue="USD" /></FormField>
            <FormField label="Seller" error={errors.sellerName?.message}><input {...register('sellerName')} className="input" /></FormField>
            <FormField label="Client" error={errors.clientName?.message}><input {...register('clientName')} className="input" /></FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>{modal === 'create' ? 'Create' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={deleteId !== null} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMut.mutate(deleteId!, { onSuccess: () => setDeleteId(null) })}
        title="Delete Ticket" message="Delete this ticket permanently?" loading={deleteMut.isPending} />
    </div>
  )
}
