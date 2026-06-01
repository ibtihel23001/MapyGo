import { useState } from 'react'
import { CheckCircle, XCircle, Info } from 'lucide-react'
import { useRegistrations, useUpdateRegistration } from '../../../API/hooks'
import { PageHeader, SelectFilter, Spinner, EmptyState, Pagination, ConfirmDialog, Modal, Button } from '../../shared'
import { fDate } from '../../utils/format'
import { REGISTRATION_STATUS_COLORS } from '../../utils/constants'
import type { AgencyRegistration } from '../../types'

interface ApprovalResult {
  agencyName: string
  adminEmail: string
  adminPassword: string
}

export default function RegistrationsPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState<{ id: number; action: 'approved' | 'rejected'; reg: AgencyRegistration } | null>(null)
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null)

  const { data, isLoading } = useRegistrations({ page, status })
  const updateMut = useUpdateRegistration()

  function handleConfirm() {
    if (!confirm) return
    const { id, action, reg } = confirm
    updateMut.mutate(
      { id, status: action },
      {
        onSuccess: () => {
          if (action === 'approved') {
            setApprovalResult({
              agencyName: reg.agencyName,
              adminEmail: reg.email,
              adminPassword: 'Admin@1234',
            })
          }
          setConfirm(null)
        },
      }
    )
  }

  return (
    <div>
      <PageHeader title="Registrations" subtitle="Agency signup requests awaiting review" />
      <div className="card">
        <div className="card-header">
          <SelectFilter
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' },
            ]}
            placeholder="All Status"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!data?.data.length && (
                  <tr><td colSpan={7}><EmptyState /></td></tr>
                )}
                {data?.data.map((r: AgencyRegistration) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium">{r.agencyName}</div>
                      <div className="text-xs text-slate-400">{r.licenseNumber}</div>
                    </td>
                    <td>{r.contactName}</td>
                    <td>{r.email}</td>
                    <td>{r.city ?? '—'}</td>
                    <td>
                      <span className={REGISTRATION_STATUS_COLORS[r.status]}>{r.status}</span>
                    </td>
                    <td>{fDate(r.createdAt)}</td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost btn-sm p-1.5 text-emerald-600"
                            onClick={() => setConfirm({ id: r.id, action: 'approved', reg: r })}
                            title="Approve"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            className="btn-ghost btn-sm p-1.5 text-red-500"
                            onClick={() => setConfirm({ id: r.id, action: 'rejected', reg: r })}
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
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

      {/* Approve / Reject confirm dialog */}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title={confirm?.action === 'approved' ? 'Approve Registration' : 'Reject Registration'}
        message={
          confirm?.action === 'approved'
            ? `Approve "${confirm?.reg.agencyName}"? This will create the agency and generate admin credentials automatically.`
            : `Reject the registration request from "${confirm?.reg.agencyName}"?`
        }
        confirmLabel={confirm?.action === 'approved' ? 'Yes, Approve' : 'Yes, Reject'}
        variant={confirm?.action === 'approved' ? 'primary' : 'danger'}
        loading={updateMut.isPending}
      />

      {/* Success modal showing generated admin credentials */}
      <Modal
        open={approvalResult !== null}
        onClose={() => setApprovalResult(null)}
        title="Agency Approved Successfully"
        size="sm"
      >
        {approvalResult && (
          <div>
            <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <CheckCircle size={18} className="text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  {approvalResult.agencyName} has been approved
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  The agency is now active and an admin account has been created.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Share these credentials with the agency. They should change their password on first login.
              </p>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 font-medium">Admin Email</span>
                <span className="text-sm font-mono text-slate-800">{approvalResult.adminEmail}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 font-medium">Temporary Password</span>
                <span className="text-sm font-mono text-slate-800">{approvalResult.adminPassword}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setApprovalResult(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
