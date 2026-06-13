import { useState, useRef } from 'react'
import {
  Plus, Pencil, Trash2, Download, Mail, RefreshCw, Filter, X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket,
  useImportTicketsFromEmail,
} from '../../../API/hooks'
import {
  PageHeader, Button, SearchInput, SelectFilter, Modal, FormField,
  ConfirmDialog, Spinner, EmptyState, Pagination, ErrorAlert,
} from '../../shared'
import { fDate, fCurrency, getErrorMessage } from '../../utils/format'
import api from '../../../API/axios'
import type { Ticket } from '../../types'

// ─── Status colour map ────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:  'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
  refund:   'badge-info',
}

// ─── Form schema (matches real Prisma Ticket) ─────────────────
const schema = z.object({
  ticketNumber: z.string().min(1, 'Required'),
  pnr:          z.string().optional(),
  passengerName: z.string().min(1, 'Required'),
  dateOfIssue:   z.string().optional(),
  departureDate: z.string().optional(),
  arrivalDate:   z.string().optional(),
  airFare: z.coerce.number().optional(),
  ttc:     z.coerce.number().optional(),
})
type FormData = z.infer<typeof schema>

// ─── Import result toast ──────────────────────────────────────
interface ImportResultBanner {
  imported: number
  skipped: number
  errors: string[]
}

export default function AdminTicketsPage() {
  // ── Filter state ──
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [airline,  setAirline]  = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  // ── Modal state ──
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null)
  const [selected,  setSelected]  = useState<Ticket | null>(null)
  const [deleteId,  setDeleteId]  = useState<number | null>(null)

  // ── Import banner ──
  const [importResult, setImportResult] = useState<ImportResultBanner | null>(null)

  // ── Data hooks ──
  const { data, isLoading } = useTickets({ page, search, status, airline, dateFrom, dateTo })
  const createMut  = useCreateTicket()
  const updateMut  = useUpdateTicket(selected?.id ?? 0)
  const deleteMut  = useDeleteTicket()
  const importMut  = useImportTicketsFromEmail()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // ── CRUD helpers ──
  function openCreate() { setSelected(null); reset({}); setModal('create') }
  function openEdit(t: Ticket) {
    setSelected(t)
    reset({
      ticketNumber:  t.ticketNumber,
      pnr:           t.pnr          ?? undefined,
      passengerName: t.passengerName,
      dateOfIssue:   t.dateOfIssue  ? t.dateOfIssue.slice(0, 10)   : undefined,
      departureDate: t.departureDate ? t.departureDate.slice(0, 10) : undefined,
      arrivalDate:   t.arrivalDate  ? t.arrivalDate.slice(0, 10)   : undefined,
      airFare:       t.airFare ?? undefined,
      ttc:           t.ttc    ?? undefined,
    })
    setModal('edit')
  }
  function onSubmit(d: FormData) {
    if (modal === 'create') createMut.mutate(d as any, { onSuccess: () => setModal(null) })
    else if (selected)      updateMut.mutate(d as any, { onSuccess: () => setModal(null) })
  }

  // ── CSV Export ──
  function handleExport() {
    const params = new URLSearchParams()
    if (search)   params.set('search',   search)
    if (status)   params.set('status',   status)
    if (airline)  params.set('airline',  airline)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo)   params.set('dateTo',   dateTo)

    const base = (api.defaults.baseURL ?? '').replace(/\/$/, '')
    const url  = `${base}/tickets/export?${params.toString()}`
    const token = localStorage.getItem('accessToken')

    // Fetch as blob so auth header is included
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        a.download = `tickets_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(href)
      })
      .catch(console.error)
  }

  // ── Email Import ──
  function handleImport() {
    setImportResult(null)
    importMut.mutate(undefined, {
      onSuccess: (res) => {
        setImportResult(res.data)
      },
    })
  }

  function clearFilters() {
    setSearch('');  setStatus(''); setAirline('')
    setDateFrom(''); setDateTo(''); setPage(1)
  }

  const activeFilterCount = [search, status, airline, dateFrom, dateTo].filter(Boolean).length
  const mutErr = modal === 'create' ? createMut.error : updateMut.error

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle="Manage flight tickets"
        action={
          <div className="flex gap-2 flex-wrap">
            {/* Email Import */}
            <Button
              variant="secondary"
              onClick={handleImport}
              loading={importMut.isPending}
              title="Import tickets from email inbox"
            >
              <Mail size={15} />
              Import from Email
            </Button>

            {/* CSV Export */}
            <Button variant="secondary" onClick={handleExport} title="Export current view as CSV">
              <Download size={15} />
              Export CSV
            </Button>

            {/* New Ticket */}
            <Button onClick={openCreate}>
              <Plus size={16} />
              New Ticket
            </Button>
          </div>
        }
      />

      {/* ── Import result banner ── */}
      {importResult && (
        <div className={`mb-4 p-4 rounded-lg border flex items-start justify-between gap-3 ${
          importResult.imported > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="text-sm">
            <p className="font-semibold mb-1">
              {importResult.imported > 0
                ? `✅ ${importResult.imported} ticket(s) imported successfully`
                : '⚠️ No new tickets found'}
            </p>
            {importResult.skipped > 0 && (
              <p className="text-slate-500">{importResult.skipped} already existed (skipped)</p>
            )}
            {importResult.errors.length > 0 && (
              <p className="text-red-600 mt-1">{importResult.errors.length} error(s): {importResult.errors[0]}</p>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Import error banner ── */}
      {importMut.error && (
        <div className="mb-4">
          <ErrorAlert message={getErrorMessage(importMut.error)} />
        </div>
      )}

      <div className="card">
        {/* ── Filter bar ── */}
        <div className="card-header gap-3 flex-wrap">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Passenger, ticket #, PNR…"
          />

          <SelectFilter
            value={status}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={[
              { label: 'Pending',  value: 'pending'  },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' },
              { label: 'Refund',   value: 'refund'   },
            ]}
            placeholder="All Status"
          />

          {/* Advanced filter toggle */}
          <button
            className={`btn-ghost btn-sm flex items-center gap-1 ${showFilters ? 'text-brand-600' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button className="btn-ghost btn-sm text-slate-400 flex items-center gap-1" onClick={clearFilters}>
              <X size={14} /> Clear all
            </button>
          )}
        </div>

        {/* ── Advanced filters panel ── */}
        {showFilters && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Airline</label>
              <input
                className="input"
                placeholder="Turkish Airlines, Qatar…"
                value={airline}
                onChange={(e) => { setAirline(e.target.value); setPage(1) }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Departure from</label>
              <input
                type="date"
                className="input"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Departure to</label>
              <input
                type="date"
                className="input"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              />
            </div>
          </div>
        )}

        {/* ── Table ── */}
        {isLoading
          ? <div className="flex justify-center py-16"><Spinner /></div>
          : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>PNR</th>
                    <th>Passenger</th>
                    <th>Date of Issue</th>
                    <th>Departure</th>
                    <th>Arrival</th>
                    <th>Air Fare</th>
                    <th>TTC</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.data.length && (
                    <tr><td colSpan={10}><EmptyState /></td></tr>
                  )}
                  {data?.data.map((t: Ticket) => (
                    <tr key={t.id}>
                      <td>
                        <span className="font-mono text-xs text-brand-700">{t.ticketNumber}</span>
                      </td>
                      <td className="text-sm text-slate-500">{t.pnr ?? '—'}</td>
                      <td>
                        <div className="font-medium">{t.passengerName}</div>
                      </td>
                      <td className="text-sm">{fDate(t.dateOfIssue)}</td>
                      <td className="text-sm">{fDate(t.departureDate)}</td>
                      <td className="text-sm">{fDate(t.arrivalDate)}</td>
                      <td className="text-sm">
                        {t.airFare != null ? `${Number(t.airFare).toLocaleString()} DZD` : '—'}
                      </td>
                      <td className="text-sm font-medium">
                        {t.ttc != null ? `${Number(t.ttc).toLocaleString()} DZD` : '—'}
                      </td>
                      <td>
                        <span className={STATUS_COLORS[t.status] ?? 'badge-secondary'}>
                          {t.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost btn-sm p-1.5"
                            title="Edit"
                            onClick={() => openEdit(t)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn-ghost btn-sm p-1.5 text-red-500"
                            title="Delete"
                            onClick={() => setDeleteId(t.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        <Pagination
          page={page}
          totalPages={data?.meta.totalPages ?? 1}
          onPage={setPage}
        />
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'New Ticket' : 'Edit Ticket'}
        size="lg"
      >
        {mutErr && (
          <div className="mb-4">
            <ErrorAlert message={getErrorMessage(mutErr)} />
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Ticket Number" error={errors.ticketNumber?.message} required>
              <input {...register('ticketNumber')} className="input" placeholder="235-2172347705" />
            </FormField>
            <FormField label="PNR / Booking Ref" error={errors.pnr?.message}>
              <input {...register('pnr')} className="input" placeholder="ZH5CZ4" />
            </FormField>
          </div>

          <FormField label="Passenger Name" error={errors.passengerName?.message} required>
            <input {...register('passengerName')} className="input" placeholder="Younes Kenzi Iheb Zerroug" />
          </FormField>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Date of Issue" error={errors.dateOfIssue?.message}>
              <input type="date" {...register('dateOfIssue')} className="input" />
            </FormField>
            <FormField label="Departure Date" error={errors.departureDate?.message}>
              <input type="date" {...register('departureDate')} className="input" />
            </FormField>
            <FormField label="Arrival Date" error={errors.arrivalDate?.message}>
              <input type="date" {...register('arrivalDate')} className="input" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Air Fare (DZD)" error={errors.airFare?.message}>
              <input type="number" step="0.01" {...register('airFare')} className="input" placeholder="116830" />
            </FormField>
            <FormField label="TTC / Total (DZD)" error={errors.ttc?.message}>
              <input type="number" step="0.01" {...register('ttc')} className="input" placeholder="179133" />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMut.isPending || updateMut.isPending}
            >
              {modal === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() =>
          deleteMut.mutate(deleteId!, { onSuccess: () => setDeleteId(null) })
        }
        title="Delete Ticket"
        message="Delete this ticket permanently? This cannot be undone."
        loading={deleteMut.isPending}
      />
    </div>
  )
}
