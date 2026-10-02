import { mockLogin, mockMe } from '../mocks/mockAuth'
import type { LoginCredentials, LoginResponse, User } from '../types/auth'
import { apiFetch, tokenStorage } from './api'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_AUTH !== 'false'

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const res = USE_MOCK
      ? await mockLogin(credentials)
      : await apiFetch<LoginResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        })
    tokenStorage.set(res.token)
    return res
  },

  async me(): Promise<User | null> {
    const token = tokenStorage.get()
    if (!token) return null
    try {
      return USE_MOCK ? await mockMe(token) : await apiFetch<User>('/auth/me')
    } catch {
      tokenStorage.clear()
      return null
    }
  },

  logout() {
    tokenStorage.clear()
  },
}
