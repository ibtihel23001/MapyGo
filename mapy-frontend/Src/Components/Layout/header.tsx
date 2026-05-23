import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../../API/hooks'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { user } = useAuth()
  const { data } = useNotifications({ page: 1 })

  const unread = data?.data?.filter((n: any) => !n.isRead).length ?? 0

  const notifPath =
    user?.role.slug === 'superadmin'
      ? '/superadmin/notifications'
      : user?.role.slug === 'admin'
      ? '/admin/notifications'
      : '/accountant/notifications'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <Link
          to={notifPath}
          className="relative p-1.5 rounded-lg text-slate-500 hover:bg-surface-tertiary hover:text-slate-700 transition-colors"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2 pl-3 border-l border-surface-border">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">
            {user?.firstName}
          </span>
        </div>
      </div>
    </header>
  )
}

