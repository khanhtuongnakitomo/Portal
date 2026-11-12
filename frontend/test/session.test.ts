import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'
import type { Store } from '../src/lib/store.tsx'

let vite: ViteDevServer
let sessionModule: { StoreProvider: typeof import('../src/lib/store.tsx').StoreProvider; useStore: () => Store }
const originalFetch = globalThis.fetch
const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, String(value)),
  removeItem: (key: string) => values.delete(key),
} })

before(async () => {
  vite = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-session-tests',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  sessionModule = await vite.ssrLoadModule(process.env.PORTAL_STORE_PATH || '/src/lib/store.tsx') as typeof sessionModule
})
after(async () => { await vite?.close() })
beforeEach(() => values.clear())
afterEach(() => { globalThis.fetch = originalFetch })

function captureStore(): Store {
  let captured: Store | undefined
  function Probe() { captured = sessionModule.useStore(); return null }
  renderToString(createElement(sessionModule.StoreProvider, { children: createElement(Probe) }))
  assert.ok(captured)
  return captured
}

test('registration rejection cannot become a successful browser-only account', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Email or student code is already registered' }), { status: 409 })
  const result = await captureStore().registerAsync({ fullName: 'Test User', email: 'existing@example.com', password: 'SyntheticTest123!', hcmutId: '1234567', utsId: '12345678' })
  assert.equal(result.error, 'Email or student code is already registered')
  assert.equal(result.user, undefined)
  assert.equal(values.get('tne_access_token'), undefined)
})

test('a cached manager cannot sign in with a role-wide demo password after API rejection', async () => {
  values.set('tne_v7_users', JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111', email: 'cached@example.com', fullName: 'Cached Manager', role: 'MANAGER', status: 'ACTIVE', password: '' }]))
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 })
  const result = await captureStore().loginAsync('cached@example.com', 'Manager123456!')
  assert.equal(result.error, 'Invalid email or password')
  assert.equal(result.user, undefined)
  assert.equal(values.get('tne_access_token'), undefined)
})
