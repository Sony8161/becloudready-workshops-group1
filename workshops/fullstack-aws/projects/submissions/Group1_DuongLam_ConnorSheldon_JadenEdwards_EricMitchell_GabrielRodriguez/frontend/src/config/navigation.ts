import type { Role } from '../types/auth'

export interface NavItem {
  label: string
  to: string
  roles: Role[]
}

const ALL_ROLES: Role[] = ['admin', 'hr', 'manager', 'trainee']

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/', roles: ALL_ROLES },
  // Add feature pages here, e.g.:
  // { label: 'Trainees', to: '/trainees', roles: ['admin', 'hr'] },
  // { label: 'Plans', to: '/plans', roles: ['admin', 'manager'] },
  // { label: 'Progress Reports', to: '/reports', roles: ['manager', 'trainee'] },
]

export const navItemsForRole = (role: Role) => NAV_ITEMS.filter((item) => item.roles.includes(role))
