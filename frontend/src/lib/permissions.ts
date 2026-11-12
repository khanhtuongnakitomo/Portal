import type { Role } from './types'

export function canAccessRoute(route: string, role: Role): boolean {
  if (route === '/admin') return role === 'ADMIN'
  if (route === '/manager') return role === 'MANAGER' || role === 'ADMIN'
  return route === '/student' || route === '/profile' || route === '/auth'
}
