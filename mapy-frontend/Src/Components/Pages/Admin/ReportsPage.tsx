import { useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useReports, useGenerateReport } from '../../../API/hooks'
import {
  PageHeader, Button, Modal, FormField, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, getErrorMessage } from '../../utils/format'
import type { Report } from '../../types'

const schema = z.object({
  type:        z.enum(['revenue', 'tickets', 'refunds', 'summary']),
  title:       z.string().min(1, 'Required'),
  periodStart: z.string().optional(),
  periodEnd:   z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ReportsPage() {
  const [page, setPage]   = useState(1)
  const [modal, setModal] = useState(false)

  const { data, isLoading } = useReports({ page })
  const generateMut = useGenerateReport()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function onSubmit(d: FormData) {
    generateMut.mutate(d, { onSuccess: () => { setModal(false); reset() } })
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Generate and view financial reports"
        action={<Button onClick={() => setModal(true)}><Plus size={16} /> Generate Report</Button>}
      />

      <div className="card">
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Type</th><th>Period</th><th>Generated</th></tr>
              </thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={4}><EmptyState message="No reports generated yet." /></td></tr>}
                {data?.data.map((r: Report) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="text-slate-400" />
                        <span className="font-medium">{r.title}</span>
                      </div>
                    </td>
                    <td><span className="badge-blue capitalize">{r.type}</span></td>
                    <td className="text-slate-500 text-sm">—</td>
                    <td>{fDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Generate Report" size="md">
        {generateMut.error && <div className="mb-4"><ErrorAlert message={getErrorMessage(generateMut.error)} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Report Title" error={errors.title?.message} required>
            <input {...register('title')} className="input" placeholder="e.g. Monthly Revenue Q1" />
          </FormField>
          <FormField label="Type" error={errors.type?.message} required>
            <select {...register('type')} className="input">
              <option value="">Select…</option>
              <option value="revenue">Revenue</option>
              <option value="tickets">Tickets</option>
              <option value="refunds">Refunds</option>
              <option value="summary">Summary</option>
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Period Start" error={errors.periodStart?.message}>
              <input type="date" {...register('periodStart')} className="input" />
            </FormField>
            <FormField label="Period End" error={errors.periodEnd?.message}>
              <input type="date" {...register('periodEnd')} className="input" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" loading={generateMut.isPending}>Generate</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
