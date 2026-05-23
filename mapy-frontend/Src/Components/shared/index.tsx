import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { X, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight, InboxIcon } from 'lucide-react'
import { cn } from '../../../cn'

// ─── Spinner ──────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
  return <Loader2 className={cn('animate-spin text-brand-600', s)} />
}

// ─── Button ───────────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  }[variant]

  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={cn(base, className)}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  )
}

// ─── FormField ────────────────────────────────────────────────
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function FormField({ label, error, required, children }: FormFieldProps) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── PageHeader ───────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number | undefined
  icon?: ReactNode
  color?: 'brand' | 'blue' | 'green' | 'amber' | 'red'
  trend?: number
}

export function StatCard({ label, value, icon, color = 'brand', trend }: StatCardProps) {
  const colorMap = {
    brand: 'bg-brand-100 text-brand-700',
    blue:  'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red:   'bg-red-100 text-red-700',
  }

  return (
    <div className="stat-card">
      {icon && (
        <div className={cn('stat-icon', colorMap[color])}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value ?? '—'}</p>
        {trend !== undefined && (
          <p className={cn('text-xs mt-1', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {trend >= 0 ? '+' : ''}{trend}% vs last month
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
}

const modalSizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }

export function Modal({ open, onClose, title, size = 'md', children }: ModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative w-full bg-white rounded-xl shadow-xl animate-in',
          modalSizes[size],
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="font-display font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-tertiary transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  loading?: boolean
  confirmLabel?: string
  variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  confirmLabel = 'Confirm',
  variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

// ─── SearchInput ──────────────────────────────────────────────
interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        className="input pl-9 w-64"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ─── SelectFilter ─────────────────────────────────────────────
interface SelectFilterProps {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
}

export function SelectFilter({ value, onChange, options, placeholder = 'All' }: SelectFilterProps) {
  return (
    <select
      className="input w-44"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ─── Pagination ───────────────────────────────────────────────
interface PaginationProps {
  page: number
  totalPages: number
  onPage: (p: number) => void
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between text-sm text-slate-500">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-1">
        <button
          className="btn-ghost btn-sm px-2"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        <button
          className="btn-ghost btn-sm px-2"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────
export function EmptyState({ message = 'No results found.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <InboxIcon size={36} className="mb-3 text-slate-300" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ─── ErrorAlert ───────────────────────────────────────────────
export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

