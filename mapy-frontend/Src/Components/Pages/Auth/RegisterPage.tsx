import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Plane, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { useRegister } from '../../../API/hooks'
import { Button, ErrorAlert, FormField } from '../../shared'
import { getErrorMessage } from '../../utils/format'

const schema = z.object({
  agencyName: z.string().min(2, 'Required'),
  contactName: z.string().min(2, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  licenseNumber: z.string().optional(),
  message: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { mutate, isPending, error } = useRegister()
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function onSubmit(data: FormData) {
    mutate(data, {
      onSuccess: () => setSuccess(true),
    })
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl text-slate-900 mb-2">Request Submitted</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your registration request has been submitted. We'll review it and contact you shortly.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full justify-center">
            Back to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center">
            <Plane size={20} className="text-white" />
          </div>
          <span className="font-display font-bold text-white text-2xl">MapyGo</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">Register Agency</h1>
          <p className="text-slate-500 text-sm mb-6">Submit your agency registration request</p>

          {error && <div className="mb-4"><ErrorAlert message={getErrorMessage(error)} /></div>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Agency Name" error={errors.agencyName?.message} required>
                <input {...register('agencyName')} className="input" placeholder="My Travel Agency" />
              </FormField>
              <FormField label="Contact Name" error={errors.contactName?.message} required>
                <input {...register('contactName')} className="input" placeholder="John Doe" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email" error={errors.email?.message} required>
                <input type="email" {...register('email')} className="input" placeholder="contact@agency.com" />
              </FormField>
              <FormField label="Phone" error={errors.phone?.message}>
                <input {...register('phone')} className="input" placeholder="+1 234 567 8900" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="City" error={errors.city?.message}>
                <input {...register('city')} className="input" placeholder="City" />
              </FormField>
              <FormField label="Country" error={errors.country?.message}>
                <input {...register('country')} className="input" placeholder="Country" />
              </FormField>
            </div>

            <FormField label="License Number" error={errors.licenseNumber?.message}>
              <input {...register('licenseNumber')} className="input" placeholder="Optional" />
            </FormField>

            <FormField label="Message" error={errors.message?.message}>
              <textarea
                {...register('message')}
                className="input resize-none"
                rows={3}
                placeholder="Tell us about your agency…"
              />
            </FormField>

            <Button type="submit" className="w-full justify-center" loading={isPending}>
              Submit Registration
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-700 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
