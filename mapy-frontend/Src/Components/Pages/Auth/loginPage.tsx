import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { Plane } from 'lucide-react'
import { useLogin } from '../../../API/hooks'
import { useAuth } from '../../contexts/AuthContext'
import { Button, ErrorAlert, FormField } from '../../shared'
import { getErrorMessage } from '../../utils/format'
import { useEffect } from 'react'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { mutate, isPending, error } = useLogin()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (user) {
      const home =
        user.role.slug === 'superadmin'
          ? '/superadmin/dashboard'
          : user.role.slug === 'admin'
          ? '/admin/dashboard'
          : '/accountant/dashboard'
      navigate(home, { replace: true })
    }
  }, [user, navigate])

  function onSubmit(data: FormData) {
    mutate(data)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
            <Plane size={20} className="text-white" />
          </div>
          <span className="font-display font-bold text-white text-2xl">MapyGo</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">Welcome back</h1>
          <p className="text-slate-500 text-sm mb-6">Sign in to your agency account</p>

          {error && <div className="mb-4"><ErrorAlert message={getErrorMessage(error)} /></div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Email" error={errors.email?.message} required>
              <input
                type="email"
                {...register('email')}
                className="input"
                placeholder="you@agency.com"
                autoComplete="email"
              />
            </FormField>

            <FormField label="Password" error={errors.password?.message} required>
              <input
                type="password"
                {...register('password')}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </FormField>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-brand-700 hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full justify-center" loading={isPending}>
              Sign In
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            New agency?{' '}
            <Link to="/register" className="text-brand-700 hover:underline font-medium">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
