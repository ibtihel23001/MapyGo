import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../../../API/hooks'
import {
  PageHeader, Button, SearchInput, Modal, FormField,
  ConfirmDialog, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, getErrorMessage } from '../../utils/format'
import type { Client } from '../../types'

const schema = z.object({
  name:           z.string().min(1, 'Required'),
  email:          z.string().email().optional().or(z.literal('')),
  phone:          z.string().optional(),
  passportNumber: z.string().optional(),
  nationality:    z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ClientsPage() {
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Client | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useClients({ page, search })
  const createMut = useCreateClient()
  const updateMut = useUpdateClient(selected?.id ?? 0)
  const deleteMut = useDeleteClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function openCreate() {
    setSelected(null); reset({}); setModal('create')
  }

  function openEdit(c: Client) {
    setSelected(c)
    reset({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', passportNumber: c.passportNumber ?? '', nationality: c.nationality ?? '' })
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
        title="Clients"
        subtitle="Manage your agency's clients"
        action={<Button onClick={openCreate}><Plus size={16} /> Add Client</Button>}
      />

      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </div>

        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Passport</th><th>Nationality</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={7}><EmptyState /></td></tr>}
                {data?.data.map((c: Client) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.email ?? '—'}</td>
                    <td>{c.phone ?? '—'}</td>
                    <td className="font-mono text-xs">{c.passportNumber ?? '—'}</td>
                    <td>{c.nationality ?? '—'}</td>
                    <td>{fDate(c.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => openEdit(c)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-ghost btn-sm p-1.5 text-red-500" onClick={() => setDeleteId(c.id)}>
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

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'create' ? 'Add Client' : 'Edit Client'} size="md">
        {mutError && <div className="mb-4"><ErrorAlert message={getErrorMessage(mutError)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Full Name" error={errors.name?.message} required>
            <input {...register('name')} className="input" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" error={errors.email?.message}>
              <input type="email" {...register('email')} className="input" />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} className="input" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Passport Number" error={errors.passportNumber?.message}>
              <input {...register('passportNumber')} className="input" />
            </FormField>
            <FormField label="Nationality" error={errors.nationality?.message}>
              <input {...register('nationality')} className="input" />
            </FormField>
          </div>
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
        title="Delete Client"
        message="Are you sure you want to delete this client?"
        loading={deleteMut.isPending}
      />
    </div>
  )
}
