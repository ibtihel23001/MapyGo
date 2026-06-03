import { useState } from 'react'
import { CheckCircle, XCircle, Info, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRegistrations, useUpdateRegistration } from '../../../API/hooks'
import { PageHeader, SelectFilter, Spinner, EmptyState, Pagination, ConfirmDialog, Modal, Button, FormField } from '../../shared'
import { fDate } from '../../utils/format'
import { REGISTRATION_STATUS_COLORS } from '../../utils/constants'
import type { AgencyRegistration } from '../../types'

// ─── Types ───────────────────────────────────────────────────
interface ApprovalResult {
  agencyName: string
  adminEmail: string
  adminPassword: string
}

const approveSchema = z.object({
  adminEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  adminPassword: z.string().min(8, 'Min 8 characters').optional().or(z.literal('')),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional(),
})
type ApproveFormData = z.infer<typeof approveSchema>

// ─── Component ───────────────────────────────────────────────
export default function RegistrationsPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  // Which registration we're about to reject
  const [rejectTarget, setRejectTarget] = useState<AgencyRegistration | null>(null)
  // Which registration opened the approve modal
  const [approveTarget, setApproveTarget] = useState<AgencyRegistration | null>(null)
  // Detail view
  const [detailTarget, setDetailTarget] = useState<AgencyRegistration | null>(null)
  // Success result after approval
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null)

  const { data, isLoading } = useRegistrations({ page, status })
  const updateMut = useUpdateRegistration()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ApproveFormData>({
    resolver: zodResolver(approveSchema),
  })

  // ── Reject flow ──────────────────────────────────────────
  function handleReject() {
    if (!rejectTarget) return
    updateMut.mutate(
      { id: rejectTarget.id, status: 'rejected' },
      { onSuccess: () => setRejectTarget(null) },
    )
  }

  // ── Approve flow ─────────────────────────────────────────
  function openApprove(reg: AgencyRegistration) {
    reset({ adminEmail: reg.email, adminPassword: '', adminFirstName: '', adminLastName: '' })
    setApproveTarget(reg)
  }

  function handleApprove(formData: ApproveFormData) {
    if (!approveTarget) return
    const finalEmail = formData.adminEmail?.trim() || approveTarget.email
    const finalPassword = formData.adminPassword?.trim() || 'Admin@1234'

    updateMut.mutate(
      {
        id: approveTarget.id,
        status: 'approved',
        adminEmail: finalEmail,
        adminPassword: finalPassword || undefined,
        adminFirstName: formData.adminFirstName?.trim() || undefined,
        adminLastName: formData.adminLastName?.trim() || undefined,
      },
      {
        onSuccess: () => {
          setApprovalResult({
            agencyName: approveTarget.agencyName,
            adminEmail: finalEmail,
            adminPassword: finalPassword,
          })
          setApproveTarget(null)
        },
      },
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
                      <div className="flex gap-1 items-center">
                        {/* Detail view — always visible */}
                        <button
                          className="btn-ghost btn-sm p-1.5 text-slate-500"
                          onClick={() => setDetailTarget(r)}
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Approve / Reject — only for pending */}
                        {r.status === 'pending' && (
                          <>
                            <button
                              className="btn-ghost btn-sm p-1.5 text-emerald-600"
                              onClick={() => openApprove(r)}
                              title="Approve"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              className="btn-ghost btn-sm p-1.5 text-red-500"
                              onClick={() => setRejectTarget(r)}
                              title="Reject"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
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

      {/* ── Detail Modal ──────────────────────────────────── */}
      <Modal
        open={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        title="Registration Details"
        size="sm"
      >
        {detailTarget && (
          <div className="space-y-3">
            {[
              { label: 'Agency Name', value: detailTarget.agencyName },
              { label: 'Contact', value: detailTarget.contactName },
              { label: 'Email', value: detailTarget.email },
              { label: 'Phone', value: detailTarget.phone ?? '—' },
              { label: 'City', value: detailTarget.city ?? '—' },
              { label: 'Country', value: detailTarget.country ?? '—' },
              { label: 'License #', value: detailTarget.licenseNumber ?? '—' },
              { label: 'Status', value: detailTarget.status },
              { label: 'Submitted', value: fDate(detailTarget.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-500 font-medium shrink-0 w-28">{label}</span>
                <span className="text-sm text-slate-800 text-right">{value}</span>
              </div>
            ))}
            {detailTarget.message && (
              <div className="pt-1">
                <p className="text-xs text-slate-500 font-medium mb-1">Message</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{detailTarget.message}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Approve Modal (with optional credential override) ─ */}
      <Modal
        open={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        title={`Approve — ${approveTarget?.agencyName ?? ''}`}
        size="md"
      >
        {approveTarget && (
          <form onSubmit={handleSubmit(handleApprove)} className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle size={17} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-800">
                Approving will create <strong>{approveTarget.agencyName}</strong> in the{' '}
                <strong>agencies</strong> table and generate an admin account automatically.
              </p>
            </div>

            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide pt-1">
              Admin credentials (optional — leave blank for defaults)
            </p>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Admin Email" error={errors.adminEmail?.message}>
                <input
                  {...register('adminEmail')}
                  type="email"
                  className="input"
                  placeholder={approveTarget.email}
                />
              </FormField>
              <FormField label="Temporary Password" error={errors.adminPassword?.message}>
                <input
                  {...register('adminPassword')}
                  type="text"
                  className="input"
                  placeholder="Admin@1234"
                />
              </FormField>
              <FormField label="First Name" error={errors.adminFirstName?.message}>
                <input
                  {...register('adminFirstName')}
                  className="input"
                  placeholder={approveTarget.contactName.split(' ')[0]}
                />
              </FormField>
              <FormField label="Last Name" error={errors.adminLastName?.message}>
                <input
                  {...register('adminLastName')}
                  className="input"
                  placeholder={approveTarget.contactName.split(' ')[1] ?? ''}
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setApproveTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Approve & Create Agency
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Reject confirm ────────────────────────────────── */}
      <ConfirmDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Reject Registration"
        message={`Reject the registration request from "${rejectTarget?.agencyName}"?`}
        confirmLabel="Yes, Reject"
        variant="danger"
        loading={updateMut.isPending}
      />

      {/* ── Success modal — shows generated credentials ────── */}
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
                  The agency is now active and added to the agencies table. An admin account has been created.
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
