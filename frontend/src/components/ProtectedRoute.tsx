import { Navigate, Outlet } from 'react-router-dom'
import { useUser } from '@/hooks/use-api'

export function ProtectedRoute() {
  const { data: user, isLoading, error } = useUser()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function AdminRoute() {
  const { data: user, isLoading, error } = useUser()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !user || user.plan !== 'ENTERPRISE') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
