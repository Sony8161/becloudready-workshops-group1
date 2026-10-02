import { Navigate, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from './AuthContext.jsx'

// Wraps pages that need a login. <ProtectedRoute role="ADMIN"> also checks the role.
// This only hides screens; the REAL protection is the backend checking the token on every request.
export default function ProtectedRoute({ role, children }) {
  const { user, signedOut } = useAuth()
  const location = useLocation()

  if (!user) {
    // remember where they were going, so login can send them back there (not after a deliberate Sign out)
    const state = signedOut === 'manual' ? undefined : { from: location.pathname }
    return <Navigate to="/login" replace state={state} />
  }
  if (role && user.role !== role) {
    return <Navigate to={homeFor(user)} replace /> // a customer typing /admin goes to /app
  }
  return children
}
