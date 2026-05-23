import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUpdateProfile } from '../../../API/hooks'
import { Button, FormField, ErrorAlert, PageHeader } from '../../shared'
import { getErrorMessage, getInitials } from '../../utils/format'

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  username: z.string().min(3),
  phone: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ProfilePage() {
  const { user } = useAuth()
  const updateMut = useUpdateProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (user) reset({ firstName: user.firstName, lastName: user.lastName, username: user.username, phone: user.phone ?? undefined })
  }, [user, reset])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setAvatarFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function onSubmit(d: FormData) {
    const fd = new FormData()
    Object.entries(d).forEach(([k, v]) => v && fd.append(k, v))
    if (avatarFile) fd.append('avatar', avatarFile)
    updateMut.mutate(fd, {
      onSuccess: () => {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      },
    })
  }

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your account details" />
      <div className="max-w-xl">
        <div className="card">
          <div className="card-body space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {preview || user?.avatar ? (
                  <img src={preview ?? user?.avatar ?? undefined} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-brand-700 flex items-center justify-center text-white text-xl font-bold">
                    {getInitials(user?.firstName, user?.lastName)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50"
                >
                  <Camera size={11} className="text-slate-600" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-slate-500">{user?.role.name} · {user?.agency?.name}</p>
              </div>
            </div>

            {updateMut.error && <ErrorAlert message={getErrorMessage(updateMut.error)} />}
            {success && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">Profile updated successfully.</div>}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" error={errors.firstName?.message} required>
                  <input {...register('firstName')} className="input" />
                </FormField>
                <FormField label="Last Name" error={errors.lastName?.message} required>
                  <input {...register('lastName')} className="input" />
                </FormField>
              </div>
              <FormField label="Username" error={errors.username?.message} required>
                <input {...register('username')} className="input" />
              </FormField>
              <FormField label="Phone" error={errors.phone?.message}>
                <input {...register('phone')} className="input" type="tel" />
              </FormField>
              <div className="pt-2 flex justify-end">
                <Button type="submit" loading={updateMut.isPending}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-body">
            <h3 className="font-semibold text-slate-700 mb-3">Account Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium">{user?.email}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Role</span><span className="font-medium">{user?.role.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Agency</span><span className="font-medium">{user?.agency?.name ?? '—'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
