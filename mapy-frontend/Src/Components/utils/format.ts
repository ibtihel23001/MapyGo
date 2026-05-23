import { format, parseISO, formatDistanceToNow } from 'date-fns'

export function fDate(date?: string | null, fmt = 'dd MMM yyyy'): string {
  if (!date) return '—'
  try { return format(parseISO(date), fmt) } catch { return '—' }
}

export function fDateTime(date?: string | null): string {
  return fDate(date, 'dd MMM yyyy, HH:mm')
}

export function fRelative(date?: string | null): string {
  if (!date) return '—'
  try { return formatDistanceToNow(parseISO(date), { addSuffix: true }) } catch { return '—' }
}

export function fCurrency(amount?: number | null, currency?: string | null): string {
  const cur = currency ?? 'USD'
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount))
}

export function fNumber(n?: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US').format(n)
}

export function getInitials(firstName?: string, lastName?: string): string {
  return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase()
}

export function truncate(str: string, max = 40): string {
  return str.length <= max ? str : str.slice(0, max) + '…'
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'An error occurred'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const e = error as any
    return e.response?.data?.message ?? e.message ?? 'An error occurred'
  }
  return String(error)
}
