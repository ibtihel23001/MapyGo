import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Server } from 'lucide-react'
import { useApiConfig, useSaveApiConfig } from '../../../API/hooks'
import { PageHeader, Button, FormField, Spinner, ErrorAlert } from '../../shared'
import { getErrorMessage } from '../../utils/format'

const schema = z.object({
  emailAddress:  z.string().email('Valid email required'),
  emailPassword: z.string().min(1, 'Required'),
  imapHost:      z.string().default('imap.gmail.com'),
  imapPort:      z.coerce.number().int().default(993),
  isActive:      z.boolean().default(true),
})
type FormData = z.infer<typeof schema>

export default function ApiSetupPage() {
  const { data, isLoading } = useApiConfig()
  const saveMut = useSaveApiConfig()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (data) {
      reset({
        emailAddress:  data.emailAddress ?? '',
        emailPassword: '',
        imapHost:      data.imapHost ?? 'imap.gmail.com',
        imapPort:      data.imapPort ?? 993,
        isActive:      data.isActive ?? true,
      })
    }
  }, [data, reset])

  function onSubmit(d: FormData) {
    saveMut.mutate(d)
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  return (
    <div>
      <PageHeader title="API Setup" subtitle="Configure email/IMAP integration for ticket parsing" />

      <div className="max-w-xl">
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Server size={18} className="text-brand-600" />
            <h2 className="font-semibold text-slate-800">Email IMAP Configuration</h2>
          </div>
          <div className="card-body">
            {saveMut.isSuccess && (
              <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                Configuration saved successfully.
              </div>
            )}
            {saveMut.error && (
              <div className="mb-4"><ErrorAlert message={getErrorMessage(saveMut.error)} /></div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField label="Email Address" error={errors.emailAddress?.message} required>
                <input type="email" {...register('emailAddress')} className="input" placeholder="tickets@youragency.com" />
              </FormField>

              <FormField label="Email Password / App Password" error={errors.emailPassword?.message} required>
                <input type="password" {...register('emailPassword')} className="input" placeholder="Leave blank to keep current" />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="IMAP Host" error={errors.imapHost?.message}>
                  <input {...register('imapHost')} className="input" />
                </FormField>
                <FormField label="IMAP Port" error={errors.imapPort?.message}>
                  <input type="number" {...register('imapPort')} className="input" />
                </FormField>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="isActive"
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                  Enable automatic email parsing
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" loading={saveMut.isPending}>Save Configuration</Button>
              </div>
            </form>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-400 leading-relaxed">
          For Gmail, use an App Password (Google Account → Security → 2FA → App passwords).
          The IMAP credentials are stored encrypted in the database.
        </p>
      </div>
    </div>
  )
}
