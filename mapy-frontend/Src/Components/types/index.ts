// ─── Auth ────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string | null;
  createdAt: string;
  agencyId?: number | null;
  roleSlug: string;
  roleName: string;
  role: { id: number; name: string; slug: string };
  agency?: { id: number; name: string; status: string } | null;
}

// ─── Agency ──────────────────────────────────────────────────
export type AgencyStatus = 'pending' | 'active' | 'suspended' | 'inactive';

export interface Agency {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  logo?: string | null;
  website?: string | null;
  licenseNumber?: string | null;
  status: AgencyStatus;
  registeredBy?: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tickets: number; users: number };
  subscriptions?: Subscription[];
}

// ─── Tickets ─────────────────────────────────────────────────
export type TicketStatus = 'pending' | 'issued' | 'cancelled' | 'refunded' | 'used';

export interface Ticket {
  id: number;
  agencyId: number;
  ticketNumber: string;
  pnr?: string | null;
  passengerName: string;
  passengerEmail?: string | null;
  passengerPhone?: string | null;
  origin?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  returnDate?: string | null;
  airline?: string | null;
  flightNumber?: string | null;
  ticketClass?: string | null;
  fare?: number | null;
  taxes?: number | null;
  fees?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  status: TicketStatus;
  sellerName?: string | null;
  clientName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Refunds ─────────────────────────────────────────────────
export type RefundStatus = 'pending' | 'approved' | 'rejected';

export interface Refund {
  id: number;
  agencyId: number;
  ticketId?: number | null;
  ticketNumber?: string | null;
  passengerName: string;
  reason: string;
  refundAmount: number;
  currency?: string | null;
  status: RefundStatus;
  requestedById?: number | null;
  processedById?: number | null;
  processedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Transactions ────────────────────────────────────────────
export type TransactionType = 'revenue' | 'expense' | 'refund' | 'commission' | 'other';

export interface Transaction {
  id: number;
  agencyId: number;
  type: TransactionType;
  category?: string | null;
  description: string;
  amount: number;
  currency: string;
  ticketId?: number | null;
  refundId?: number | null;
  transactionDate: string;
  createdAt: string;
}

// ─── Subscriptions ───────────────────────────────────────────
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface Subscription {
  id: number;
  agencyId: number;
  planName: string;
  price: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  createdAt: string;
  agency?: { id: number; name: string } | null;
}

// ─── Sellers ─────────────────────────────────────────────────
export interface Seller {
  id: number;
  agencyId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Clients ─────────────────────────────────────────────────
export interface Client {
  id: number;
  agencyId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  passportNumber?: string | null;
  nationality?: string | null;
  createdAt: string;
}

// ─── Notifications ───────────────────────────────────────────
export interface Notification {
  id: number;
  userId?: number | null;
  agencyId?: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Reports ─────────────────────────────────────────────────
export interface Report {
  id: number;
  agencyId: number;
  title: string;
  type: string;
  generatedById?: number | null;
  createdAt: string;
}

// ─── Registrations ───────────────────────────────────────────
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface Registration {
  id: number;
  agencyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  message?: string | null;
  licenseNumber?: string | null;
  status: RegistrationStatus;
  createdAt: string;
}

// ─── Pagination ──────────────────────────────────────────────
export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── API Response ────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────
export interface AdminStats {
  totalTickets: number;
  ticketsThisMonth: number;
  ticketsLastMonth: number;
  ticketsByStatus: { status: string; _count: { status: number } }[];
  pendingRefunds: number;
  totalRefunds: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalClients: number;
  totalSellers: number;
  recentTickets: Partial<Ticket>[];
  revenueByMonth: { month: string; total: number }[];
  subscription?: Subscription | null;
}

export interface SuperAdminStats {
  totalAgencies: number;
  activeAgencies: number;
  pendingAgencies: number;
  totalUsers: number;
  totalTickets: number;
  totalRevenue: number;
  recentRegistrations: Registration[];
  agenciesByStatus: { status: string; _count: number }[];
}

// ─── API Config ──────────────────────────────────────────────
export interface ApiConfig {
  id: number;
  agencyId: number;
  imapHost?: string | null;
  imapPort?: number | null;
  imapUser?: string | null;
  imapSecure?: boolean | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Alias for backward compat */
export type AgencyRegistration = Registration;
