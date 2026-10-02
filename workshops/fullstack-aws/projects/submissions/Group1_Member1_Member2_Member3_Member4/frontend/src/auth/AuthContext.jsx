import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(signOut)
    if (!getToken()) return
    api.get('/api/auth/me')
      .then(setUser)
      .catch(signOut)
      .finally(() => setLoading(false))
  }, [signOut])

  const signIn = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const changePassword = useCallback(async (current_password, new_password) => {
    const res = await api.post('/api/auth/change-password', { current_password, new_password })
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, changePassword, isStaff: user && user.role !== 'TRAINEE' }),
    [user, loading, signIn, signOut, changePassword],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export function homeFor(user) {
  if (!user) return '/login'
  if (user.must_change_password) return '/change-password'
  return user.role === 'TRAINEE' ? '/me' : '/dashboard'
}
