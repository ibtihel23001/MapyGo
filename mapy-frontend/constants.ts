export const API_BASE = '/api';

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
} as const;

export const TICKET_STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  issued:    'Issued',
  cancelled: 'Cancelled',
  refunded:  'Refunded',
  used:      'Used',
};

export const TICKET_STATUS_COLORS: Record<string, string> = {
  pending:   'badge-yellow',
  issued:    'badge-green',
  cancelled: 'badge-red',
  refunded:  'badge-purple',
  used:      'badge-gray',
};

export const AGENCY_STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  active:    'Active',
  suspended: 'Suspended',
  inactive:  'Inactive',
};

export const AGENCY_STATUS_COLORS: Record<string, string> = {
  pending:   'badge-yellow',
  active:    'badge-green',
  suspended: 'badge-red',
  inactive:  'badge-gray',
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const REFUND_STATUS_COLORS: Record<string, string> = {
  pending:  'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
};

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  active:    'badge-green',
  expired:   'badge-red',
  cancelled: 'badge-gray',
  pending:   'badge-yellow',
};

export const TRANSACTION_TYPES = ['revenue', 'expense', 'refund', 'commission', 'other'] as const;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'DZD', 'MAD', 'TND', 'SAR', 'AED'] as const;

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
