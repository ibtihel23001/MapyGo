import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDate(date?: string | null, fmt = 'dd MMM yyyy'): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), fmt);
  } catch {
    return '—';
  }
}

export function formatDateTime(date?: string | null): string {
  return formatDate(date, 'dd MMM yyyy, HH:mm');
}

export function formatRelative(date?: string | null): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function formatCurrency(amount?: number | null, currency = 'USD'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatNumber(n?: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function truncate(str: string, max = 40): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

export function pctChange(current: number, previous: number): number {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 100);
}
