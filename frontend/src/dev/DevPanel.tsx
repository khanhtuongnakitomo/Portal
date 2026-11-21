import { useEffect, useState } from 'react'
import { homeFor, type Route } from '@/components/Shell'
import { Button, Input, Modal, Select } from '@/components/ui'
import { useStore } from '@/lib/store'
import type { Role } from '@/lib/types'
import { devApi, type DevAccount, type DevLogin } from './api'

const QUICK_ROLES = [
  { role: 'USER', label: 'Student' },
  { role: 'MANAGER', label: 'Manager' },
  { role: 'ADMIN', label: 'Admin' },
] satisfies { role: Role; label: string }[]

const GROUPS = ['DEV', 'MOCK', 'USER'] as const

type Action = 'accounts' | 'login' | 'generate' | 'clear'

export default function DevPanel({ go }: { go: (route: Route) => void }) {
  const { currentUser, startSession, refreshData } = useStore()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<DevAccount[]>([])
  const [userId, setUserId] = useState('')
  const [days, setDays] = useState('5')
  const [pending, setPending] = useState<Action | null>(null)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')

  useEffect(() => {
    let active = true
    void devApi.isEnabled().then((available) => {
      if (active) setEnabled(available)
    })
    return () => { active = false }
  }, [])

  if (!enabled) return null

  const busy = pending !== null
  const dayCount = Number(days)
  const validDays = Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= 10

  async function run(action: Action, work: () => Promise<void>) {
    if (busy) return
    setPending(action)
    setError('')
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Developer action failed.')
    } finally {
      setPending(null)
    }
  }

  async function loadAccounts() {
    const next = await devApi.accounts()
    setAccounts(next)
    setUserId((selected) => next.some((account) => account.id === selected) ? selected : '')
  }

  function signIn(body: DevLogin) {
    void run('login', async () => {
      const auth = await devApi.login(body)
      startSession(auth)
      go(homeFor(auth.user.role))
      setOpen(false)
    })
  }

  async function refreshAfterMutation() {
    // The store's refreshData also refreshes the Key Desk for staff.
    await Promise.all([refreshData(), loadAccounts()])
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-4 left-4 z-50 cursor-pointer rounded-sm border-2 border-black bg-yellow-300 px-3 py-1.5 font-mono text-sm font-bold text-black shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait"
        aria-label="DEV — open developer tools"
        aria-haspopup="dialog"
        disabled={busy && !open}
        onClick={() => {
          setOpen(true)
          void run('accounts', loadAccounts)
        }}
      >
        DEV
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Developer tools" eyebrow="LOCAL ONLY" width="max-w-[440px]">
        <div className="space-y-4 px-6 py-4">
          <p className="break-all text-sm text-steel">Current identity: {currentUser ? `${currentUser.email} (${currentUser.role})` : 'Signed out'}</p>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Quick sign-in</h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_ROLES.map(({ role, label }) => (
                <Button key={role} type="button" variant="outline" disabled={busy} onClick={() => signIn({ role })}>{label}</Button>
              ))}
            </div>
          </section>

          <form className="flex items-end gap-2" onSubmit={(event) => {
            event.preventDefault()
            if (userId) signIn({ userId })
          }}>
            <label className="min-w-0 flex-1 space-y-2 text-sm font-semibold">
              <span className="block">Sign in as</span>
              <Select value={userId} disabled={busy || !accounts.length} onChange={(event) => setUserId(event.target.value)}>
                <option value="">Select an account</option>
                {GROUPS.map((kind) => {
                  const group = accounts.filter((account) => account.kind === kind)
                  return group.length > 0 && (
                    <optgroup key={kind} label={kind}>
                      {group.map(({ id, fullName, email, role }) => (
                        <option key={id} value={id}>{fullName} ({email}, {role})</option>
                      ))}
                    </optgroup>
                  )
                })}
              </Select>
            </label>
            <Button type="submit" disabled={busy || !userId}>Sign in</Button>
          </form>

          <section className="space-y-2 border-t border-rule pt-4">
            <h3 className="text-sm font-semibold">Mock data</h3>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
              event.preventDefault()
              if (!validDays) return
              void run('generate', async () => {
                setSummary('')
                const { created, skipped } = await devApi.generate(dayCount)
                setSummary(`Created ${created.students} students, ${created.bookings} bookings, and ${created.blocks} blocks. Skipped ${skipped}.`)
                await refreshAfterMutation()
              })
            }}>
              <label className="space-y-2 text-sm font-semibold">
                <span className="block">Future workdays</span>
                <Input type="number" min={1} max={10} step={1} required className="max-w-28" value={days} disabled={busy} onChange={(event) => setDays(event.target.value)} />
              </label>
              <Button type="submit" disabled={busy || !validDays}>Generate</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => {
                if (!window.confirm('Delete mock users, mock and developer bookings, and mock room blocks?')) return
                void run('clear', async () => {
                  setSummary('')
                  const { deleted } = await devApi.clear()
                  setSummary(`Cleared ${deleted.bookings} bookings, ${deleted.users} users, and ${deleted.blocks} blocks.`)
                  await refreshAfterMutation()
                })
              }}>Clear</Button>
            </form>
          </section>

          {pending && <p role="status" className="text-sm text-steel">{pending === 'accounts' ? 'Loading accounts…' : 'Working…'}</p>}
          {summary && <p role="status" className="text-sm">{summary}</p>}
          {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        </div>
      </Modal>
    </>
  )
}
