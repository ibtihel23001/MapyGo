// AccountingPage.tsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTransactions, useCreateTransaction } from '../../../API/hooks'
import {
  PageHeader, Button, SelectFilter, Modal, FormField,
  Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, fCurrency, getErrorMessage } from '../../utils/format'
import { TRANSACTION_TYPE_COLORS } from '../../utils/constants'
import type { Transaction } from '../../types'

const schema = z.object({
  type: z.enum(['revenue', 'expense', 'refund', 'commission']),
  category: z.string().optional(),
  description: z.string().min(1),
  amount: z.coerce.number().min(0),
  currency: z.string().default('USD'),
  transactionDate: z.string(),
})
type FormData = z.infer<typeof schema>

export function AccountingPage() {
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)

  const { data, isLoading } = useTransactions({ page, type })
  const createMut = useCreateTransaction()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  function onSubmit(d: FormData) {
    createMut.mutate(d, { onSuccess: () => { setModal(false); reset() } })
  }

  return (
    <div>
      <PageHeader title="Accounting" subtitle="Transactions ledger" action={
        <Button onClick={() => setModal(true)}><Plus size={16} /> Add Transaction</Button>
      } />
      <div className="card">
        <div className="card-header">
          <SelectFilter value={type} onChange={(v) => { setType(v); setPage(1) }} options={[
            { label: 'Revenue', value: 'revenue' }, { label: 'Expense', value: 'expense' },
            { label: 'Refund', value: 'refund' }, { label: 'Commission', value: 'commission' },
          ]} placeholder="All Types" />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={5}><EmptyState /></td></tr>}
                {data?.data.map((t: Transaction) => (
                  <tr key={t.id}>
                    <td>{fDate(t.transactionDate)}</td>
                    <td><span className={TRANSACTION_TYPE_COLORS[t.type]}>{t.type}</span></td>
                    <td className="text-slate-500">{t.category ?? '—'}</td>
                    <td className="max-w-xs truncate text-sm">{t.description}</td>
                    <td className={t.type === 'revenue' ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                      {t.type === 'revenue' ? '+' : '-'}{fCurrency(t.amount, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Transaction" size="md">
        {createMut.error && <div className="mb-4"><ErrorAlert message={getErrorMessage(createMut.error)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type" error={errors.type?.message} required>
              <select {...register('type')} className="input">
                <option value="">Select…</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
                <option value="refund">Refund</option>
                <option value="commission">Commission</option>
              </select>
            </FormField>
            <FormField label="Category" error={errors.category?.message}><input {...register('category')} className="input" /></FormField>
          </div>
          <FormField label="Description" error={errors.description?.message} required><input {...register('description')} className="input" /></FormField>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2"><FormField label="Amount" error={errors.amount?.message} required><input type="number" step="0.01" {...register('amount')} className="input" /></FormField></div>
            <FormField label="Currency" error={errors.currency?.message}><input {...register('currency')} className="input" defaultValue="USD" /></FormField>
          </div>
          <FormField label="Date" error={errors.transactionDate?.message} required><input type="date" {...register('transactionDate')} className="input" /></FormField>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" loading={createMut.isPending}>Add</Button></div>
        </form>
      </Modal>
    </div>
  )
}
export default AccountingPage
