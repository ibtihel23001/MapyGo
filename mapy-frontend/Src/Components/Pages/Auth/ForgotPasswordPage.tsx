import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Plane, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { useForgotPassword } from '../../../API/hooks'
import { Button, ErrorAlert, FormField } from '../../shared'
import { getErrorMessage } from '../../utils/format'

const schema = z.object({ email: z.string().email('Invalid email') })
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const { mutate, isPending, error } = useForgotPassword()
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function onSubmit(data: FormData) {
    mutate(data, { onSuccess: () => setSent(true) })
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
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h2 className="font-display font-bold text-xl text-slate-900 mb-2">Check your email</h2>
              <p className="text-slate-500 text-sm mb-6">
                If this email is registered, you'll receive a reset link shortly.
              </p>
              <Link to="/login" className="btn-primary btn w-full justify-center">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">Reset Password</h1>
              <p className="text-slate-500 text-sm mb-6">Enter your email to receive a reset link</p>

              {error && <div className="mb-4"><ErrorAlert message={getErrorMessage(error)} /></div>}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormField label="Email" error={errors.email?.message} required>
                  <input type="email" {...register('email')} className="input" placeholder="you@agency.com" />
                </FormField>
                <Button type="submit" className="w-full justify-center" loading={isPending}>
                  Send Reset Link
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-slate-500">
                <Link to="/login" className="text-brand-700 hover:underline">Back to Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
