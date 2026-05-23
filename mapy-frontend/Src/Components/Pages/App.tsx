import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import { AuthProvider } from '../contexts/AuthContext'
import ProtectedRoute from '../routes/ProtectedRoute'
import RoleRoute from '../routes/RoleRoute'
import AppShell from '../Layout/AppShell'

// Auth pages
import LoginPage from './Auth/loginPage'
import RegisterPage from './Auth/RegisterPage'
import ForgotPasswordPage from './Auth/ForgotPasswordPage'
import ResetPasswordPage from './Auth/ResetPasswordPage'

// SuperAdmin pages
import SuperAdminDashboard from './SuperAdmin/DashboardPage'
import SuperAdminAgencies from './SuperAdmin/AgenciesPage'
import SuperAdminAdmins from './SuperAdmin/AdminsPage'
import SuperAdminAccountants from './SuperAdmin/AccountantsPage'
import SuperAdminRegistrations from './SuperAdmin/RegistrationsPage'
import SuperAdminSubscriptions from './SuperAdmin/SubsciptionsPage'
import SuperAdminTickets from './SuperAdmin/TicketsPage'
import SuperAdminProfile from './SuperAdmin/ProfilePage'

// Admin pages
import AdminDashboard from './Admin/DashboardPage'
import AdminTickets from './Admin/TicketsPage'
import AdminRefunds from './Admin/RefundsPage'
import AdminAccounting from './Admin/AccountingPage'
import AdminSellers from './Admin/SellersPage'
import AdminClients from './Admin/ClientsPage'
import AdminAccountants from './Admin/AccountantsPage'
import AdminSubscription from './Admin/SubscriptionPage'
import AdminReports from './Admin/ReportsPage'
import AdminApiSetup from './Admin/ApiSetupPage'
import AdminNotifications from './Admin/NotificationsPage'
import AdminProfile from './Admin/ProfilePage'

// Accountant pages
import AccountantDashboard from './Accountant/DashboardPage'
import AccountantAccounting from './Accountant/AccountingPage'
import AccountantReports from './Accountant/ReportsPage'
import AccountantProfile from './Accountant/ProfilePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected */}
            <Route element={<ProtectedRoute />}>
              {/* SuperAdmin */}
              <Route element={<RoleRoute roles={['superadmin']} />}>
                <Route element={<AppShell />}>
                  <Route path="/superadmin/dashboard"      element={<SuperAdminDashboard />} />
                  <Route path="/superadmin/agencies"        element={<SuperAdminAgencies />} />
                  <Route path="/superadmin/admins"          element={<SuperAdminAdmins />} />
                  <Route path="/superadmin/accountants"     element={<SuperAdminAccountants />} />
                  <Route path="/superadmin/registrations"   element={<SuperAdminRegistrations />} />
                  <Route path="/superadmin/subscriptions"   element={<SuperAdminSubscriptions />} />
                  <Route path="/superadmin/tickets"         element={<SuperAdminTickets />} />
                  <Route path="/superadmin/profile"         element={<SuperAdminProfile />} />
                </Route>
              </Route>

              {/* Admin */}
              <Route element={<RoleRoute roles={['admin']} />}>
                <Route element={<AppShell />}>
                  <Route path="/admin/dashboard"     element={<AdminDashboard />} />
                  <Route path="/admin/tickets"        element={<AdminTickets />} />
                  <Route path="/admin/refunds"        element={<AdminRefunds />} />
                  <Route path="/admin/accounting"     element={<AdminAccounting />} />
                  <Route path="/admin/sellers"        element={<AdminSellers />} />
                  <Route path="/admin/clients"        element={<AdminClients />} />
                  <Route path="/admin/accountants"    element={<AdminAccountants />} />
                  <Route path="/admin/subscription"   element={<AdminSubscription />} />
                  <Route path="/admin/reports"        element={<AdminReports />} />
                  <Route path="/admin/api-setup"      element={<AdminApiSetup />} />
                  <Route path="/admin/notifications"  element={<AdminNotifications />} />
                  <Route path="/admin/profile"        element={<AdminProfile />} />
                </Route>
              </Route>

              {/* Accountant */}
              <Route element={<RoleRoute roles={['accountant']} />}>
                <Route element={<AppShell />}>
                  <Route path="/accountant/dashboard"   element={<AccountantDashboard />} />
                  <Route path="/accountant/accounting"   element={<AccountantAccounting />} />
                  <Route path="/accountant/reports"      element={<AccountantReports />} />
                  <Route path="/accountant/profile"      element={<AccountantProfile />} />
                </Route>
              </Route>
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

