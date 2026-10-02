import { Navigate, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from './AuthContext'
import Spinner from '../components/Spinner'

// roles: which roles may open this page. Others are sent to their own home page.
export default function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="center-page"><Spinner label="Loading" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user.must_change_password) return <Navigate to="/change-password" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return children
}
