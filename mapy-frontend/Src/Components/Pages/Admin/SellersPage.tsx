import { useState } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSellers, useCreateSeller, useUpdateSeller, useToggleSeller, useDeleteSeller } from '../../../API/hooks'
import {
  PageHeader, Button, SearchInput, Modal, FormField,
  ConfirmDialog, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, getErrorMessage } from '../../utils/format'
import type { Seller } from '../../types'

const schema = z.object({
  name:  z.string().min(1, 'Required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function SellersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [modal, setModal]   = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Seller | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useSellers({ page, search })
  const createMut = useCreateSeller()
  const updateMut = useUpdateSeller(selected?.id ?? 0)
  const toggleMut = useToggleSeller()
  const deleteMut = useDeleteSeller()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function openCreate() {
    setSelected(null); reset({}); setModal('create')
  }

  function openEdit(s: Seller) {
    setSelected(s); reset({ name: s.name, email: s.email ?? '', phone: s.phone ?? '' }); setModal('edit')
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
        title="Sellers"
        subtitle="Manage your agency's sales team"
        action={<Button onClick={openCreate}><Plus size={16} /> Add Seller</Button>}
      />

      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </div>

        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={6}><EmptyState /></td></tr>}
                {data?.data.map((s: Seller) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.email ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td>
                      <span className={s.isActive ? 'badge-green' : 'badge-red'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{fDate(s.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => toggleMut.mutate(s.id)}>
                          {s.isActive
                            ? <ToggleRight size={16} className="text-emerald-600" />
                            : <ToggleLeft size={16} className="text-slate-400" />}
                        </button>
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => openEdit(s)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-ghost btn-sm p-1.5 text-red-500" onClick={() => setDeleteId(s.id)}>
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

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'create' ? 'Add Seller' : 'Edit Seller'} size="sm">
        {mutError && <div className="mb-4"><ErrorAlert message={getErrorMessage(mutError)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Name" error={errors.name?.message} required>
            <input {...register('name')} className="input" />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <input type="email" {...register('email')} className="input" />
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            <input {...register('phone')} className="input" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {modal === 'create' ? 'Add' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMut.mutate(deleteId!, { onSuccess: () => setDeleteId(null) })}
        title="Delete Seller"
        message="Are you sure you want to delete this seller?"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
