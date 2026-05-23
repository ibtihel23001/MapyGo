import { useState } from 'react'
import { useTransactions } from '../../../API/hooks'
import { PageHeader, SelectFilter, Spinner, EmptyState, Pagination } from '../../shared'
import { fDate, fCurrency } from '../../utils/format'
import { TRANSACTION_TYPE_COLORS } from '../../utils/constants'
import type { Transaction } from '../../types'

export default function AccountantAccountingPage() {
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useTransactions({ page, type })

  return (
    <div>
      <PageHeader title="Accounting" subtitle="Transactions ledger (read-only)" />

      <div className="card">
        <div className="card-header">
          <SelectFilter
            value={type}
            onChange={(v) => { setType(v); setPage(1) }}
            options={[
              { label: 'Revenue',    value: 'revenue' },
              { label: 'Expense',    value: 'expense' },
              { label: 'Refund',     value: 'refund' },
              { label: 'Commission', value: 'commission' },
            ]}
            placeholder="All Types"
          />
        </div>

        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr>
              </thead>
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
    </div>
  )
}
