import { ApiError } from '../services/api'
import type { LoginCredentials, LoginResponse, User } from '../types/auth'

// Dev-only stand-in for the Passport/JWT backend. Tokens are unsigned and not secure.
const MOCK_USERS: Array<User & { password: string }> = [
  { id: 'u1', name: 'Ada Admin', email: 'admin@noticeboard.dev', role: 'admin', password: 'password123' },
  { id: 'u2', name: 'Hannah HR', email: 'hr@noticeboard.dev', role: 'hr', password: 'password123' },
  { id: 'u3', name: 'Morgan Manager', email: 'manager@noticeboard.dev', role: 'manager', password: 'password123' },
  { id: 'u4', name: 'Taylor Trainee', email: 'trainee@noticeboard.dev', role: 'trainee', password: 'password123' },
]

const TOKEN_TTL_SECONDS = 60 * 60

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

const toBase64Url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

const fromBase64Url = (value: string) =>
  JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/')))

function createToken(user: User): string {
  const now = Math.floor(Date.now() / 1000)
  const header = toBase64Url({ alg: 'none', typ: 'JWT' })
  const payload = toBase64Url({ sub: user.id, role: user.role, iat: now, exp: now + TOKEN_TTL_SECONDS })
  return `${header}.${payload}.mock`
}

function stripPassword({ password: _password, ...user }: User & { password: string }): User {
  return user
}

export async function mockLogin({ email, password }: LoginCredentials): Promise<LoginResponse> {
  await delay()
  const match = MOCK_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!match || match.password !== password) {
    throw new ApiError(401, 'Invalid email or password')
  }
  const user = stripPassword(match)
  return { token: createToken(user), user }
}

export async function mockMe(token: string): Promise<User> {
  await delay(150)
  try {
    const payload = fromBase64Url(token.split('.')[1])
    const match = MOCK_USERS.find((u) => u.id === payload.sub)
    if (!match || payload.exp * 1000 < Date.now()) throw new Error()
    return stripPassword(match)
  } catch {
    throw new ApiError(401, 'Session expired')
  }
}
