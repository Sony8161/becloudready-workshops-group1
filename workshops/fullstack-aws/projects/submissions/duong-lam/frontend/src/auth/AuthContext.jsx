import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as authService from '../services/authService.js'
import { clearSession, getToken, readUser, rememberUsername, saveSession, tokenExpiry } from './session.js'

// CONTEXT = data every component can read without passing props through every level.
// Without it, App would have to pass `user` down to Sidebar, pages, forms... ("prop drilling").
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readUser()) // start logged in if a valid token is saved
  const [notice, setNotice] = useState('') // e.g. "Your session expired" for the login page
  const [signedOut, setSignedOut] = useState(null) // 'manual' (Sign out button) or 'expired'

  async function login(username, password) {
    const session = await authService.login(username, password) // POST /api/auth/login
    saveSession(session.accessToken, session.user)
    rememberUsername(session.user.username) // only if "Remember my username" is ticked
    setNotice('')
    setSignedOut(null)
    setUser(session.user)
    return session.user
  }

  async function register(form) {
    const session = await authService.register(form) // POST /api/auth/register
    saveSession(session.accessToken, session.user)
    setNotice('')
    setSignedOut(null)
    setUser(session.user)
    return session.user
  }

  // Swap in a NEW token without signing out. Used after "change password" and "sign out everywhere":
  // the server cancels every older token, then hands this browser a fresh one so it stays signed in.
  const replaceSession = useCallback((session) => {
    saveSession(session.accessToken, session.user)
    setUser(session.user) // new object = the auto sign-out timer below restarts with the new expiry
  }, [])

  // kind = 'manual' (they clicked Sign out) or 'expired' (token ran out). ProtectedRoute uses it:
  // after an expired session, signing in again returns you to the page you were on; after Sign out it doesn't.
  const logout = useCallback((kind = 'manual') => {
    clearSession()
    setSignedOut(kind)
    setUser(null)
  }, [])

  // api.js fires "auth:expired" when the backend answers 401 (token expired or invalid).
  useEffect(() => {
    function onExpired(event) {
      // the server's reason, e.g. "You were signed out. Please sign in again." after "sign out everywhere"
      const reason = event.detail && event.detail.includes('signed out') ? event.detail : ''
      setNotice(reason || 'Your session expired. Please sign in again.')
      logout('expired')
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired) // clean up when unmounted
  }, [logout])

  // Sign out by itself the moment the token expires, instead of waiting for the next request to fail.
  useEffect(() => {
    if (!user) return
    const msLeft = tokenExpiry(getToken()) - Date.now()
    const timer = setTimeout(() => window.dispatchEvent(new Event('auth:expired')), Math.max(msLeft, 0))
    return () => clearTimeout(timer) // a new login (or logout) cancels the old timer
  }, [user])

  return (
    <AuthContext.Provider value={{ user, notice, signedOut, login, register, logout, replaceSession }}>
      {children}
    </AuthContext.Provider>
  )
}

// Any component: const { user, login, logout } = useAuth()
export function useAuth() {
  return useContext(AuthContext)
}

// Where each role lands after signing in.
export function homeFor(user) {
  return user?.role === 'ADMIN' ? '/admin' : '/app'
}
