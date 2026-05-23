export const TICKET_STATUS_COLORS: Record<string, string> = {
  pending:   'badge-yellow',
  issued:    'badge-green',
  cancelled: 'badge-red',
  refunded:  'badge-purple',
  used:      'badge-gray',
}

export const AGENCY_STATUS_COLORS: Record<string, string> = {
  pending:   'badge-yellow',
  active:    'badge-green',
  suspended: 'badge-red',
  inactive:  'badge-gray',
}

export const REFUND_STATUS_COLORS: Record<string, string> = {
  pending:   'badge-yellow',
  approved:  'badge-green',
  rejected:  'badge-red',
  processed: 'badge-blue',
}

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  active:    'badge-green',
  expired:   'badge-red',
  cancelled: 'badge-gray',
  pending:   'badge-yellow',
}

export const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  revenue:    'badge-green',
  expense:    'badge-red',
  refund:     'badge-purple',
  commission: 'badge-blue',
  other:      'badge-gray',
}

export const REGISTRATION_STATUS_COLORS: Record<string, string> = {
  pending:  'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'DZD', 'MAD', 'TND', 'SAR', 'AED'] as const
