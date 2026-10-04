import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { status, refresh } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <div className="page-loader"><span className="spinner" />Checking your session…</div>
  }
  if (status === 'error') {
    return (
      <div className="page-loader error-state">
        <p>Unable to verify your session. Check your connection and try again.</p>
        <button className="button button-primary" onClick={() => void refresh().catch(() => undefined)}>Retry</button>
      </div>
    )
  }
  return status === 'authenticated'
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location.pathname }} />
}
