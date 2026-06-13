import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './axios';
import type {
  User, Agency, Ticket, Refund, Transaction, Subscription,
  Seller, Client, Notification, Registration, Report,
  PaginatedResponse,
} from '../Components/types';

// ─── Auth ─────────────────────────────────────────────────────
export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post('/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.data?.accessToken ?? data.accessToken)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/auth/logout').then((r) => r.data),
    onSuccess: () => {
      localStorage.removeItem('accessToken')
      qc.clear()
    },
  })
}

export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data.data ?? r.data),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: { email: string }) =>
      api.post('/auth/forgot-password', data).then((r) => r.data),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; password: string }) =>
      api.post('/auth/reset-password', data).then((r) => r.data),
  })
}

// ─── Profile ──────────────────────────────────────────────────
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FormData) =>
      api.put('/users/profile', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

// ─── Dashboard ────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data.data ?? r.data),
  })
}

export function useSuperadminStats() {
  return useQuery({
    queryKey: ['dashboard', 'superadmin'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data.data ?? r.data),
  })
}

export function useAccountantStats() {
  return useQuery({
    queryKey: ['dashboard', 'accountant'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data.data ?? r.data),
  })
}

// ─── Agencies ─────────────────────────────────────────────────
export function useAgencies(params: { page?: number; search?: string; status?: string } = {}) {
  return useQuery<PaginatedResponse<Agency>>({
    queryKey: ['agencies', params],
    queryFn: () => api.get('/agencies', { params }).then((r) => r.data),
  })
}

export function useCreateAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Agency>) => api.post('/agencies', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  })
}

export function useUpdateAgency(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Agency>) => api.put(`/agencies/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  })
}

export function useToggleAgencyStatus(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: string) =>
      api.patch(`/agencies/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  })
}

export function useDeleteAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/agencies/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencies'] }),
  })
}

// ─── Users ────────────────────────────────────────────────────
export function useAdmins(params: { page?: number; search?: string } = {}) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', 'admins', params],
    queryFn: () => api.get('/users/admins', { params }).then((r) => r.data),
  })
}

export function useAccountants(params: { page?: number; search?: string } = {}) {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', 'accountants', params],
    queryFn: () => api.get('/users/accountants', { params }).then((r) => r.data),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<User> & { password?: string; roleSlug?: string }) =>
      api.post('/users', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useToggleUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch(`/users/${id}/status`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

// ─── Tickets ──────────────────────────────────────────────────
export function useTickets(params: { page?: number; search?: string; status?: string; airline?: string; dateFrom?: string; dateTo?: string } = {}) {
  return useQuery<PaginatedResponse<Ticket>>({
    queryKey: ['tickets', params],
    queryFn: () => api.get('/tickets', { params }).then((r) => r.data),
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Ticket>) => api.post('/tickets', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useUpdateTicket(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Ticket>) => api.put(`/tickets/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useUpdateTicketStatus(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (status: string) =>
      api.patch(`/tickets/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useDeleteTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/tickets/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useImportTicketsFromEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/email-import/run').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

// ─── Refunds ──────────────────────────────────────────────────
export function useRefunds(params: { page?: number; status?: string } = {}) {
  return useQuery<PaginatedResponse<Refund>>({
    queryKey: ['refunds', params],
    queryFn: () => api.get('/refunds', { params }).then((r) => r.data),
  })
}

export function useCreateRefund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Refund>) => api.post('/refunds', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds'] }),
  })
}

export function useUpdateRefundStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      api.patch(`/refunds/${id}/status`, { status, notes }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds'] }),
  })
}

// ─── Transactions ─────────────────────────────────────────────
export function useTransactions(params: { page?: number; type?: string } = {}) {
  return useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['transactions', params],
    queryFn: () => api.get('/transactions', { params }).then((r) => r.data),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Transaction>) =>
      api.post('/transactions', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

// ─── Subscriptions ────────────────────────────────────────────
export function useSubscriptions(params: { page?: number; agencyId?: number } = {}) {
  return useQuery<PaginatedResponse<Subscription>>({
    queryKey: ['subscriptions', params],
    queryFn: () => api.get('/subscriptions', { params }).then((r) => r.data),
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Subscription>) =>
      api.post('/subscriptions', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function useUpdateSubscription(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Subscription>) =>
      api.put(`/subscriptions/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.patch(`/subscriptions/${id}/status`, { status: 'cancelled' }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

// ─── Sellers ──────────────────────────────────────────────────
export function useSellers(params: { page?: number; search?: string } = {}) {
  return useQuery<PaginatedResponse<Seller>>({
    queryKey: ['sellers', params],
    queryFn: () => api.get('/sellers', { params }).then((r) => r.data),
  })
}

export function useCreateSeller() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Seller>) => api.post('/sellers', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sellers'] }),
  })
}

export function useUpdateSeller(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Seller>) => api.put(`/sellers/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sellers'] }),
  })
}

export function useToggleSeller() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch(`/sellers/${id}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sellers'] }),
  })
}

export function useDeleteSeller() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/sellers/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sellers'] }),
  })
}

// ─── Clients ──────────────────────────────────────────────────
export function useClients(params: { page?: number; search?: string } = {}) {
  return useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients', params],
    queryFn: () => api.get('/clients', { params }).then((r) => r.data),
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Client>) => api.post('/clients', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Client>) => api.put(`/clients/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

// ─── Notifications ────────────────────────────────────────────
export function useNotifications(params: { page?: number } = {}) {
  return useQuery<PaginatedResponse<Notification>>({
    queryKey: ['notifications', params],
    queryFn: () => api.get('/notifications', { params }).then((r) => r.data),
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.patch(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

// ─── Registrations ────────────────────────────────────────────
export function useRegistrations(params: { page?: number; search?: string; status?: string } = {}) {
  return useQuery<PaginatedResponse<Registration>>({
    queryKey: ['registrations', params],
    queryFn: () => api.get('/registrations', { params }).then((r) => r.data),
  })
}

export function useCreateRegistration() {
  return useMutation({
    mutationFn: (data: Partial<Registration>) =>
      api.post('/registrations', data).then((r) => r.data),
  })
}

export function useReviewRegistration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
    }: {
      id: number
      status: 'approved' | 'rejected'
      adminEmail?: string
      adminPassword?: string
      adminFirstName?: string
      adminLastName?: string
    }) =>
      api
        .patch(`/registrations/${id}/review`, {
          status,
          adminEmail,
          adminPassword,
          adminFirstName,
          adminLastName,
        })
        .then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['registrations'] })
      // Approval creates a new agency — keep agencies list in sync
      if (variables.status === 'approved') {
        qc.invalidateQueries({ queryKey: ['agencies'] })
      }
    },
  })
}

// ─── Reports ──────────────────────────────────────────────────
export function useReports(params: { page?: number } = {}) {
  return useQuery<PaginatedResponse<Report>>({
    queryKey: ['reports', params],
    queryFn: () => api.get('/reports', { params }).then((r) => r.data),
  })
}

export function useGenerateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: string; periodStart?: string; periodEnd?: string; title?: string }) =>
      api.post('/reports/generate', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

// ─── API Config ───────────────────────────────────────────────
export function useApiConfig() {
  return useQuery({
    queryKey: ['api-config'],
    queryFn: () => api.get('/api-config').then((r) => r.data.data ?? r.data),
  })
}

export function useSaveApiConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      emailAddress: string
      emailPassword: string
      imapHost?: string
      imapPort?: number
      isActive?: boolean
    }) => api.put('/api-config', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-config'] }),
  })
}


// ─── Missing hooks (aliases/additions) ────────────────────────

/** Alias: agency self-registration form (public) */
export function useRegister() {
  return useMutation({
    mutationFn: (data: Partial<Registration>) =>
      api.post('/registrations', data).then((r) => r.data),
  })
}

/** Get a single ticket by id */
export function useTicket(id: number) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => api.get(`/tickets/${id}`).then((r) => r.data.data ?? r.data),
    enabled: !!id,
  })
}

/** Simple registration status update (approve / reject) */
export function useUpdateRegistration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
    }: {
      id: number
      status: 'approved' | 'rejected'
      adminEmail?: string
      adminPassword?: string
      adminFirstName?: string
      adminLastName?: string
    }) =>
      api
        .patch(`/registrations/${id}/review`, {
          status,
          adminEmail,
          adminPassword,
          adminFirstName,
          adminLastName,
        })
        .then((r) => r.data),
    onSuccess: (_data, variables) => {
      // Always refresh registrations list
      qc.invalidateQueries({ queryKey: ['registrations'] })
      // When approved, the backend creates a new agency — refresh agencies list too
      if (variables.status === 'approved') {
        qc.invalidateQueries({ queryKey: ['agencies'] })
      }
    },
  })
}
