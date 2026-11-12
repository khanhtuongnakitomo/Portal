import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { apiCreateBooking, apiGetCalendar, apiLogin, apiRegister, TOKEN_KEY, USER_KEY } from '../src/lib/api.ts'

const originalFetch = globalThis.fetch
const values = new Map<string, string>()
const storage: Storage = {
  get length() { return values.size },
  clear() { values.clear() },
  getItem(key) { return values.get(key) ?? null },
  setItem(key, value) { values.set(key, String(value)) },
  removeItem(key) { values.delete(key) },
  key(index) { return [...values.keys()][index] ?? null },
}
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
beforeEach(() => values.clear())
afterEach(() => { globalThis.fetch = originalFetch })

const dto = { roomId: 'room-1', title: 'Test booking', purpose: 'Test request', startTime: '2026-11-16T02:00:00Z', endTime: '2026-11-16T03:00:00Z' }

test('preserves the API booking error so the form can explain the rejection', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'You already have a pending request for this time slot' }), { status: 409 })
  await assert.rejects(apiCreateBooking(dto), /You already have a pending request for this time slot/)
})

test('asks for a real sign-in when the booking session is rejected', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
  await assert.rejects(apiCreateBooking(dto), /sign in again/i)
})

test('registration conflict cannot produce or persist a local session', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Email or student code is already registered' }), { status: 409 })
  const result = await apiRegister({ fullName: 'Test User', email: 'test@example.com', password: 'SyntheticTest123!', hcmutId: '1234567', utsId: '12345678' })
  assert.deepEqual(result, { error: 'Email or student code is already registered' })
  assert.equal(localStorage.getItem(TOKEN_KEY), null)
  assert.equal(localStorage.getItem(USER_KEY), null)
})

test('invalid login cannot fall back to a cached user', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 })
  assert.deepEqual(await apiLogin('test@example.com', 'WrongPassword123!'), { error: 'Invalid email or password' })
  assert.equal(localStorage.getItem(TOKEN_KEY), null)
})

test('a malformed authentication response cannot establish a session', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ user: { id: 'user-1', role: 'USER' } }), { status: 200 })
  const result = await apiLogin('test@example.com', 'SyntheticTest123!')
  assert.ok('error' in result)
  assert.equal(localStorage.getItem(TOKEN_KEY), null)
})

test('an empty server calendar is authoritative and distinct from a failed request', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ bookings: [], blocks: [] }), { status: 200 })
  assert.deepEqual(await apiGetCalendar(), { ok: true, bookings: [], blocks: [], users: [] })
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  assert.equal((await apiGetCalendar()).ok, false)
})

test('sends personal mode explicitly and maps the server booking', async () => {
  let body: Record<string, unknown> = {}
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(String(options?.body))
    return new Response(JSON.stringify({ id: 'saved-booking', roomId: 'room-1', userId: 'manager-1', status: 'PENDING', isEvent: false }), { status: 201 })
  }
  const booking = await apiCreateBooking({ ...dto, isEvent: false })
  assert.equal(body.isEvent, false)
  assert.equal(booking?.id, 'saved-booking')
  assert.equal(booking?.status, 'PENDING')
  assert.equal(booking?.isEvent, false)
})
