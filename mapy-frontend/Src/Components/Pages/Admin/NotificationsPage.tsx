import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../../API/hooks'
import { PageHeader, Button, Spinner, EmptyState, Pagination } from '../../shared'
import { fDate } from '../../utils/format'
import { cn } from '../../../../cn'
import { useState } from 'react'
import type { Notification } from '../../types'

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useNotifications({ page })
  const markMut    = useMarkNotificationRead()
  const markAllMut = useMarkAllNotificationsRead()

  const unreadCount = data?.data.filter((n: Notification) => !n.isRead).length ?? 0

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date with your agency"
        action={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={() => markAllMut.mutate()} loading={markAllMut.isPending}>
              <CheckCheck size={16} /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="card">
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="divide-y divide-surface-border">
            {!data?.data.length && (
              <div className="py-8"><EmptyState message="No notifications." /></div>
            )}
            {data?.data.map((n: Notification) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-4 px-6 py-4 transition-colors',
                  !n.isRead && 'bg-brand-50/50',
                )}
              >
                <div className={cn(
                  'mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  n.isRead ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-600',
                )}>
                  <Bell size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !n.isRead && 'font-semibold text-slate-900')}>
                    {n.title}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{fDate(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <button
                    className="btn-ghost btn-sm text-xs shrink-0"
                    onClick={() => markMut.mutate(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>
    </div>
  )
}
