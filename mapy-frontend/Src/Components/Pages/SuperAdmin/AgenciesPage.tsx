import { useState } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAgencies, useCreateAgency, useUpdateAgency, useToggleAgencyStatus, useDeleteAgency } from '../../../API/hooks'
import {
  PageHeader, Button, SearchInput, SelectFilter, Modal, FormField,
  ConfirmDialog, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, getErrorMessage } from '../../utils/format'
import { AGENCY_STATUS_COLORS } from '../../utils/constants'
import type { Agency } from '../../types'

const schema = z.object({
  name: z.string().min(2, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  licenseNumber: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function AgenciesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Agency | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useAgencies({ page, search, status })
  const createMut = useCreateAgency()
  const updateMut = useUpdateAgency(selected?.id ?? 0)
  const toggleMut = useToggleAgencyStatus(selected?.id ?? 0)
  const deleteMut = useDeleteAgency()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function openCreate() {
    setSelected(null)
    reset({})
    setModal('create')
  }

  function openEdit(a: Agency) {
    setSelected(a)
    reset({ name: a.name, email: a.email, phone: a.phone ?? undefined, city: a.city ?? undefined, country: a.country ?? undefined, licenseNumber: a.licenseNumber ?? undefined })
    setModal('edit')
  }

  function onSubmit(d: FormData) {
    if (modal === 'create') {
      createMut.mutate(d, { onSuccess: () => setModal(null) })
    } else if (selected) {
      updateMut.mutate(d, { onSuccess: () => setModal(null) })
    }
  }

  const mutError = modal === 'create' ? createMut.error : updateMut.error

  return (
    <div>
      <PageHeader
        title="Agencies"
        subtitle="Manage all registered travel agencies"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Agency
          </Button>
        }
      />

      <div className="card">
        <div className="card-header gap-3 flex-wrap">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
          <SelectFilter
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
              { label: 'Inactive', value: 'inactive' },
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
                  <th>Email</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.length === 0 && (
                  <tr><td colSpan={6}><EmptyState /></td></tr>
                )}
                {data?.data.map((a: Agency) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium text-slate-900">{a.name}</div>
                      <div className="text-xs text-slate-400">{a.licenseNumber}</div>
                    </td>
                    <td>{a.email}</td>
                    <td>{a.city ?? '—'}</td>
                    <td><span className={AGENCY_STATUS_COLORS[a.status]}>{a.status}</span></td>
                    <td>{fDate(a.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-ghost btn-sm p-1.5"
                          onClick={() => {
                            setSelected(a)
                            toggleMut.mutate(a.status === 'active' ? 'suspended' : 'active')
                          }}
                          title={a.status === 'active' ? 'Suspend' : 'Activate'}
                        >
                          {a.status === 'active'
                            ? <ToggleRight size={16} className="text-emerald-600" />
                            : <ToggleLeft size={16} className="text-slate-400" />}
                        </button>
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => openEdit(a)}>
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn-ghost btn-sm p-1.5 text-red-500 hover:text-red-700"
                          onClick={() => setDeleteId(a.id)}
                        >
                          <Trash2 size={15} />
                        </button>
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

      {/* Create / Edit Modal */}
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'create' ? 'Add Agency' : 'Edit Agency'} size="md">
        {mutError && <div className="mb-4"><ErrorAlert message={getErrorMessage(mutError)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" error={errors.name?.message} required>
              <input {...register('name')} className="input" />
            </FormField>
            <FormField label="Email" error={errors.email?.message} required>
              <input type="email" {...register('email')} className="input" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} className="input" />
            </FormField>
            <FormField label="License Number" error={errors.licenseNumber?.message}>
              <input {...register('licenseNumber')} className="input" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City" error={errors.city?.message}>
              <input {...register('city')} className="input" />
            </FormField>
            <FormField label="Country" error={errors.country?.message}>
              <input {...register('country')} className="input" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {modal === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMut.mutate(deleteId!, { onSuccess: () => setDeleteId(null) })}
        title="Delete Agency"
        message="This will permanently delete the agency and all its data. This cannot be undone."
        loading={deleteMut.isPending}
      />
    </div>
  )
}
