// AdminsPage.tsx
import { useState } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAdmins, useCreateUser, useToggleUserStatus, useDeleteUser } from '../../../API/hooks'
import {
  PageHeader, Button, SearchInput, Modal, FormField,
  ConfirmDialog, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, getErrorMessage } from '../../utils/format'
import type { User } from '../../types'

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  username: z.string().min(3, 'Min 3 chars').regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  phone: z.string().optional(),
  agencyId: z.coerce.number().int().positive('Required'),
})
type FormData = z.infer<typeof schema>

export default function AdminsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useAdmins({ page, search })
  const createMut = useCreateUser()
  const toggleMut = useToggleUserStatus()
  const deleteMut = useDeleteUser()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function onSubmit(d: FormData) {
    createMut.mutate({ ...d, roleSlug: 'admin' }, { onSuccess: () => { setModal(false); reset() } })
  }

  return (
    <div>
      <PageHeader title="Admins" subtitle="Manage agency admins" action={
        <Button onClick={() => setModal(true)}><Plus size={16} /> Add Admin</Button>
      } />
      <div className="card">
        <div className="card-header">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Agency</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={6}><EmptyState /></td></tr>}
                {data?.data.map((u: User) => (
                  <tr key={u.id}>
                    <td><div className="font-medium">{u.firstName} {u.lastName}</div><div className="text-xs text-slate-400">@{u.username}</div></td>
                    <td>{u.email}</td>
                    <td>{u.agency?.name ?? '—'}</td>
                    <td><span className={u.isActive ? 'badge-green' : 'badge-red'}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>{fDate(u.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => toggleMut.mutate(u.id)}>
                          {u.isActive ? <ToggleRight size={16} className="text-emerald-600" /> : <ToggleLeft size={16} className="text-slate-400" />}
                        </button>
                        <button className="btn-ghost btn-sm p-1.5 text-red-500" onClick={() => setDeleteId(u.id)}><Trash2 size={15} /></button>
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

      <Modal open={modal} onClose={() => setModal(false)} title="Add Admin" size="md">
        {createMut.error && <div className="mb-4"><ErrorAlert message={getErrorMessage(createMut.error)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" error={errors.firstName?.message} required><input {...register('firstName')} className="input" /></FormField>
            <FormField label="Last Name" error={errors.lastName?.message} required><input {...register('lastName')} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Username" error={errors.username?.message} required><input {...register('username')} className="input" /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><input {...register('phone')} className="input" /></FormField>
          </div>
          <FormField label="Email" error={errors.email?.message} required><input type="email" {...register('email')} className="input" /></FormField>
          <FormField label="Password" error={errors.password?.message} required><input type="password" {...register('password')} className="input" /></FormField>
          <FormField label="Agency ID" error={errors.agencyId?.message} required><input type="number" {...register('agencyId')} className="input" /></FormField>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" loading={createMut.isPending}>Create</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={() => deleteMut.mutate(deleteId!, { onSuccess: () => setDeleteId(null) })} title="Delete Admin" message="Delete this admin account?" loading={deleteMut.isPending} />
    </div>
  )
}
