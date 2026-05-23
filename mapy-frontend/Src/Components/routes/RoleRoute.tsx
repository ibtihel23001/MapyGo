import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from '../shared'

interface RoleRouteProps {
  roles: string[]
}

export default function RoleRoute({ roles }: RoleRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!roles.includes(user.role.slug)) {
    // Redirect to appropriate home for the user's actual role
    const home =
      user.role.slug === 'superadmin'
        ? '/superadmin/dashboard'
        : user.role.slug === 'admin'
        ? '/admin/dashboard'
        : '/accountant/dashboard'
    return <Navigate to={home} replace />
  }

  return <Outlet />
}
