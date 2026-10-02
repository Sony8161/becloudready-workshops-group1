export type Role = 'admin' | 'hr' | 'manager' | 'trainee'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  hr: 'HR / People Team',
  manager: 'Training Manager',
  trainee: 'Trainee',
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}
