import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService } from '../services/authService'
import type { LoginCredentials, User } from '../types/auth'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<User>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authService.me().then((restored) => {
      setUser(restored)
      setIsLoading(false)
    })
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { user } = await authService.login(credentials)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, isLoading, login, logout }), [user, isLoading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
