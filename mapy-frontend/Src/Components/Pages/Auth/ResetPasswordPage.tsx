import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Plane } from 'lucide-react'
import { useResetPassword } from '../../../API/hooks'
import { Button, ErrorAlert, FormField } from '../../shared'
import { getErrorMessage } from '../../utils/format'

const schema = z.object({
  password: z.string().min(8, 'Min 8 characters').regex(/[A-Z]/, 'Must contain uppercase').regex(/[0-9]/, 'Must contain number'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const { mutate, isPending, error } = useResetPassword()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function onSubmit(data: FormData) {
    mutate({ token, password: data.password }, {
      onSuccess: () => navigate('/login', { replace: true }),
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
            <Plane size={20} className="text-white" />
          </div>
          <span className="font-display font-bold text-white text-2xl">MapyGo</span>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">Set New Password</h1>
          <p className="text-slate-500 text-sm mb-6">Choose a strong new password</p>

          {error && <div className="mb-4"><ErrorAlert message={getErrorMessage(error)} /></div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="New Password" error={errors.password?.message} required>
              <input type="password" {...register('password')} className="input" placeholder="••••••••" />
            </FormField>
            <FormField label="Confirm Password" error={errors.confirm?.message} required>
              <input type="password" {...register('confirm')} className="input" placeholder="••••••••" />
            </FormField>
            <Button type="submit" className="w-full justify-center" loading={isPending}>
              Reset Password
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            <Link to="/login" className="text-brand-700 hover:underline">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
