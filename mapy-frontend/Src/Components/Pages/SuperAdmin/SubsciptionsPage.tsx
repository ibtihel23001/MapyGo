import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSubscriptions, useCreateSubscription } from '../../../API/hooks'
import {
  PageHeader, Button, Modal, FormField, Spinner, EmptyState,
  Pagination, ErrorAlert,
} from '../../shared'
import { fDate, fCurrency, getErrorMessage } from '../../utils/format'
import { SUBSCRIPTION_STATUS_COLORS } from '../../utils/constants'
import type { Subscription } from '../../types'

const schema = z.object({
  agencyId: z.coerce.number().int().positive(),
  planName: z.string().default('Annual Plan'),
  price: z.coerce.number().min(0),
  currency: z.string().default('USD'),
  startDate: z.string(),
  endDate: z.string(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function SubscriptionsPage() {
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useSubscriptions({ page })
  const createMut = useCreateSubscription()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function onSubmit(d: FormData) {
    createMut.mutate(d, { onSuccess: () => { setModal(false); reset() } })
  }

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Agency subscription management" action={
        <Button onClick={() => setModal(true)}><Plus size={16} /> New Subscription</Button>
      } />
      <div className="card">
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Agency</th><th>Plan</th><th>Price</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={6}><EmptyState /></td></tr>}
                {data?.data.map((s: Subscription) => (
                  <tr key={s.id}>
                    <td>{s.agency?.name ?? `Agency #${s.agencyId}`}</td>
                    <td>{s.planName}</td>
                    <td>{fCurrency(s.price, s.currency)}</td>
                    <td>{fDate(s.startDate)}</td>
                    <td>{fDate(s.endDate)}</td>
                    <td><span className={SUBSCRIPTION_STATUS_COLORS[s.status]}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create Subscription" size="md">
        {createMut.error && <div className="mb-4"><ErrorAlert message={getErrorMessage(createMut.error)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Agency ID" error={errors.agencyId?.message} required><input type="number" {...register('agencyId')} className="input" /></FormField>
            <FormField label="Plan Name" error={errors.planName?.message}><input {...register('planName')} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Price" error={errors.price?.message} required><input type="number" step="0.01" {...register('price')} className="input" /></FormField>
            <FormField label="Currency" error={errors.currency?.message}><input {...register('currency')} className="input" defaultValue="USD" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" error={errors.startDate?.message} required><input type="date" {...register('startDate')} className="input" /></FormField>
            <FormField label="End Date" error={errors.endDate?.message} required><input type="date" {...register('endDate')} className="input" /></FormField>
          </div>
          <FormField label="Payment Method" error={errors.paymentMethod?.message}><input {...register('paymentMethod')} className="input" placeholder="Bank Transfer, Card…" /></FormField>
          <FormField label="Notes" error={errors.notes?.message}><textarea {...register('notes')} className="input resize-none" rows={2} /></FormField>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" loading={createMut.isPending}>Create</Button></div>
        </form>
      </Modal>
    </div>
  )
}
