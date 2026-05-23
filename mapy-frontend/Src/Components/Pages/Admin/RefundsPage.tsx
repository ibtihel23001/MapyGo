// RefundsPage.tsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRefunds, useCreateRefund, useUpdateRefundStatus } from '../../../API/hooks'
import {
  PageHeader, Button, SelectFilter, Modal, FormField,
  ConfirmDialog, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, fCurrency, getErrorMessage } from '../../utils/format'
import { REFUND_STATUS_COLORS } from '../../utils/constants'
import type { Refund } from '../../types'

const schema = z.object({
  passengerName: z.string().min(1),
  reason: z.string().min(1),
  refundAmount: z.coerce.number().min(0),
  currency: z.string().default('USD'),
  ticketNumber: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function RefundsPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [approveId, setApproveId] = useState<number | null>(null)

  const { data, isLoading } = useRefunds({ page, status })
  const createMut = useCreateRefund()
  const updateMut = useUpdateRefundStatus()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function onSubmit(d: FormData) {
    createMut.mutate(d, { onSuccess: () => { setModal(false); reset() } })
  }

  return (
    <div>
      <PageHeader title="Refunds" subtitle="Manage refund requests" action={
        <Button onClick={() => setModal(true)}><Plus size={16} /> New Refund</Button>
      } />
      <div className="card">
        <div className="card-header">
          <SelectFilter value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
            { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' }, { label: 'Processed', value: 'processed' },
          ]} placeholder="All Status" />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Passenger</th><th>Ticket #</th><th>Amount</th><th>Reason</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={6}><EmptyState /></td></tr>}
                {data?.data.map((r: Refund) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.passengerName}</td>
                    <td className="font-mono text-xs text-slate-500">{r.ticketNumber ?? '—'}</td>
                    <td>{fCurrency(r.refundAmount, r.currency)}</td>
                    <td className="max-w-xs truncate text-sm text-slate-600">{r.reason}</td>
                    <td><span className={REFUND_STATUS_COLORS[r.status]}>{r.status}</span></td>
                    <td>{fDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Refund Request" size="md">
        {createMut.error && <div className="mb-4"><ErrorAlert message={getErrorMessage(createMut.error)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Passenger Name" error={errors.passengerName?.message} required><input {...register('passengerName')} className="input" /></FormField>
            <FormField label="Ticket Number" error={errors.ticketNumber?.message}><input {...register('ticketNumber')} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Refund Amount" error={errors.refundAmount?.message} required><input type="number" step="0.01" {...register('refundAmount')} className="input" /></FormField>
            <FormField label="Currency" error={errors.currency?.message}><input {...register('currency')} className="input" defaultValue="USD" /></FormField>
          </div>
          <FormField label="Reason" error={errors.reason?.message} required><textarea {...register('reason')} className="input resize-none" rows={3} /></FormField>
          <FormField label="Notes" error={errors.notes?.message}><textarea {...register('notes')} className="input resize-none" rows={2} /></FormField>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" loading={createMut.isPending}>Submit</Button></div>
        </form>
      </Modal>
    </div>
  )
}
