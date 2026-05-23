import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useRegistrations, useUpdateRegistration } from '../../../API/hooks'
import { PageHeader, SelectFilter, Spinner, EmptyState, Pagination, ConfirmDialog } from '../../shared'
import { fDate } from '../../utils/format'
import { REGISTRATION_STATUS_COLORS } from '../../utils/constants'
import type { AgencyRegistration } from '../../types'

export default function RegistrationsPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<{ id: number; action: 'approved' | 'rejected' } | null>(null)

  const { data, isLoading } = useRegistrations({ page, status })
  const updateMut = useUpdateRegistration()

  return (
    <div>
      <PageHeader title="Registrations" subtitle="Agency signup requests awaiting review" />
      <div className="card">
        <div className="card-header">
          <SelectFilter value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
            { label: 'Pending', value: 'pending' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ]} placeholder="All Status" />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Agency</th><th>Contact</th><th>Email</th><th>City</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={7}><EmptyState /></td></tr>}
                {data?.data.map((r: AgencyRegistration) => (
                  <tr key={r.id}>
                    <td><div className="font-medium">{r.agencyName}</div><div className="text-xs text-slate-400">{r.licenseNumber}</div></td>
                    <td>{r.contactName}</td>
                    <td>{r.email}</td>
                    <td>{r.city ?? '—'}</td>
                    <td><span className={REGISTRATION_STATUS_COLORS[r.status]}>{r.status}</span></td>
                    <td>{fDate(r.createdAt)}</td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button className="btn-ghost btn-sm p-1.5 text-emerald-600" onClick={() => setConfirm({ id: r.id, action: 'approved' })} title="Approve"><CheckCircle size={16} /></button>
                          <button className="btn-ghost btn-sm p-1.5 text-red-500" onClick={() => setConfirm({ id: r.id, action: 'rejected' })} title="Reject"><XCircle size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && updateMut.mutate({ id: confirm.id, status: confirm.action }, { onSuccess: () => setConfirm(null) })}
        title={confirm?.action === 'approved' ? 'Approve Registration' : 'Reject Registration'}
        message={confirm?.action === 'approved' ? 'Approve this agency registration? This will create the agency.' : 'Reject this registration request?'}
        loading={updateMut.isPending}
      />
    </div>
  )
}
