import { createRequester, type ApiAuth, type ApiResponse } from '@/lib/api'
import type { Role } from '@/lib/types'

export interface DevAccount {
  id: string
  email: string
  fullName: string
  role: Role
  studentCode: string | null
  kind: 'DEV' | 'MOCK' | 'USER'
}

export type DevLogin = { role: Role } | { userId: string }

type Generated = { created: { students: number; bookings: number; blocks: number }; skipped: number }
type Cleared = { deleted: { bookings: number; users: number; blocks: number } }

const request = createRequester()

function unwrap<T>(result: ApiResponse<T>): T {
  if (!result.ok) throw new Error(result.message)
  return result.data
}

export const devApi = {
  async isEnabled() {
    const result = await request<{ enabled: true }>('/dev/status')
    return result.ok && result.status === 200 && result.data.enabled === true
  },
  async accounts() {
    return unwrap(await request<{ accounts: DevAccount[] }>('/dev/accounts')).accounts
  },
  async login(body: DevLogin) {
    return unwrap(await request<ApiAuth>('/dev/login', 'POST', body))
  },
  async generate(days: number) {
    return unwrap(await request<Generated>('/dev/mock-data', 'POST', { days }))
  },
  async clear() {
    return unwrap(await request<Cleared>('/dev/mock-data', 'DELETE'))
  },
}
