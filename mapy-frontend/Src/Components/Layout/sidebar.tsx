import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Ticket, RotateCcw, Wallet, Users, Building2,
  Bell, FileText, Settings, Plane, ShoppingBag, UserCheck,
  ClipboardList, CreditCard, LogOut,
} from 'lucide-react'
import { cn } from '../../../cn'
import { useAuth } from '../contexts/AuthContext'
import { useLogout } from '../../API/hooks'

const superadminNav = [
  { label: 'Dashboard',     to: '/superadmin/dashboard',      icon: LayoutDashboard },
  { label: 'Agencies',      to: '/superadmin/agencies',        icon: Building2 },
  { label: 'Admins',        to: '/superadmin/admins',          icon: Users },
  { label: 'Accountants',   to: '/superadmin/accountants',     icon: UserCheck },
  { label: 'Registrations', to: '/superadmin/registrations',   icon: ClipboardList },
  { label: 'Subscriptions', to: '/superadmin/subscriptions',   icon: CreditCard },
  { label: 'Tickets',       to: '/superadmin/tickets',         icon: Ticket },
  { label: 'Profile',       to: '/superadmin/profile',         icon: Settings },
]

const adminNav = [
  { label: 'Dashboard',    to: '/admin/dashboard',     icon: LayoutDashboard },
  { label: 'Tickets',      to: '/admin/tickets',        icon: Ticket },
  { label: 'Refunds',      to: '/admin/refunds',        icon: RotateCcw },
  { label: 'Accounting',   to: '/admin/accounting',     icon: Wallet },
  { label: 'Sellers',      to: '/admin/sellers',        icon: ShoppingBag },
  { label: 'Clients',      to: '/admin/clients',        icon: Users },
  { label: 'Accountants',  to: '/admin/accountants',    icon: UserCheck },
  { label: 'Subscription', to: '/admin/subscription',   icon: CreditCard },
  { label: 'Reports',      to: '/admin/reports',        icon: FileText },
  { label: 'API Setup',    to: '/admin/api-setup',      icon: Settings },
  { label: 'Notifications',to: '/admin/notifications',  icon: Bell },
  { label: 'Profile',      to: '/admin/profile',        icon: Settings },
]

const accountantNav = [
  { label: 'Dashboard',   to: '/accountant/dashboard',   icon: LayoutDashboard },
  { label: 'Accounting',  to: '/accountant/accounting',  icon: Wallet },
  { label: 'Reports',     to: '/accountant/reports',     icon: FileText },
  { label: 'Profile',     to: '/accountant/profile',     icon: Settings },
]

export default function Sidebar() {
  const { user } = useAuth()
  const { mutate: logout } = useLogout()

  const nav =
    user?.role.slug === 'superadmin'
      ? superadminNav
      : user?.role.slug === 'admin'
      ? adminNav
      : accountantNav

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-surface-border bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Plane size={16} className="text-white" />
        </div>
        <span className="font-display font-bold text-slate-900 text-lg">MapyGo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
        {nav.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-slate-600 hover:bg-surface-tertiary hover:text-slate-900',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User & logout */}
      <div className="border-t border-surface-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-400 capitalize">{user?.role.name}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-surface-tertiary hover:text-slate-700 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

