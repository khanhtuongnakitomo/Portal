import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import { ACTIVE_STATUSES, useLookups, useStore } from '@/lib/store'
import type { Role, Room, RoomStatus, Settings, User } from '@/lib/types'
import { CAMPUS_TZ, dayKey, fmtDate, fmtStamp } from '@/lib/time'
import { Button, EmptyState, Eyebrow, Field, Input, Modal, Select, Tag, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { Reveal, ScrollRevealText, SplitText } from '@/components/effects'
import { OperationsWorkspace } from '@/manager/ManagerView'

export type AdminTab = 'schedule' | 'users' | 'rooms' | 'settings' | 'audit'

export function AdminView() {
  const { rooms, bookings } = useStore()
  const [tab, setTab] = useState<AdminTab>('schedule')

  const pending = useMemo(() => bookings.filter((b) => b.status === 'PENDING'), [bookings])
  const scheduled = useMemo(
    () => bookings.filter((b) => ['APPROVED', 'KEY_CHECKED_OUT'].includes(b.status)).length,
    [bookings],
  )


  const tabs: { id: AdminTab; n: string; label: string; count?: number; badge?: number }[] = [
    { id: 'schedule', n: '01', label: 'Schedule & Approvals', badge: pending.length },
    { id: 'users', n: '02', label: 'Accounts (Students & Managers)' },
    { id: 'rooms', n: '03', label: 'Room inventory', count: rooms.length },
    { id: 'settings', n: '04', label: 'System settings' },
    { id: 'audit', n: '05', label: 'Audit logs' },
  ]

  return (
    <>
      <TopNav>
        {tabs.map((t) => (
          <NavItem
            key={t.id}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
            badge={t.badge && t.badge > 0 ? t.badge : undefined}
          >
            {t.label}
          </NavItem>
        ))}
      </TopNav>

      <main className="mx-auto max-w-[1440px] px-6 pt-10 pb-24">
        <PageHeader
          eyebrow="SYSTEM ADMINISTRATOR COMMAND · ROLE=ADMIN"
          title={
            tab === 'schedule'
              ? 'Facility schedule & approvals'
              : tab === 'users'
                ? 'Accounts & role management'
                : tab === 'rooms'
                  ? 'Room inventory & status'
                  : tab === 'settings'
                    ? 'System settings & policy'
                    : 'Immutable audit ledger'
          }
          body={
            tab === 'schedule'
              ? 'Direct facilities schedule and approval queue mirroring manager operations. Review requests, monitor real-time room occupancy, and assign schedule overrides across rooms 601, 602, and 605.'
              : tab === 'users'
                ? 'Directory of student and facility manager accounts. Search and filter by role, manage activation status, and provision new Manager staff accounts.'
                : tab === 'rooms'
                  ? 'Manage university rooms, capacity, amenities, approval policy, and availability.'
                  : tab === 'settings'
                    ? 'Global operating hours (08:00–17:00), advance reservation limits, and student booking allowances.'
                    : 'Cryptographically structured, append-only log of every mutation in the facilities ledger.'
          }
          right={
            <div className="flex flex-col items-end gap-3">
              <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule">
                {[
                  ['PENDING', pending.length, pending.length ? 'text-accent' : ''],
                  ['SCHEDULED', scheduled, ''],
                ].map(([k, v, c]) => (
                  <div key={k as string} className="min-w-[110px] border-r border-b border-rule px-4 py-3 bg-paper">
                    <div className="font-mono text-[11px] text-steel">{k}</div>
                    <div className={cx('mt-1 font-display text-[32px] leading-none font-w450', c as string)}>
                      {String(v).padStart(2, '0')}
                    </div>
                  </div>
                ))}
              </Reveal>
            </div>
          }
        />

        {/* View Switcher Strip */}
        <div className="mt-8 flex items-center gap-1 overflow-x-auto border-b border-rule pb-3 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cx(
                'flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 font-mono text-[12px] font-semibold transition-all',
                tab === t.id
                  ? 'border border-ink bg-paper text-ink shadow-xs'
                  : 'text-steel hover:bg-ice hover:text-ink',
              )}
            >
              <span className={tab === t.id ? 'text-accent' : 'text-steel'}>{t.n}</span>
              <span className="font-sans font-semibold text-[13px]">{t.label}</span>
              {t.badge !== undefined && t.badge > 0 ? (
                <span className="rounded-full bg-accent px-1.5 py-0.2 font-mono text-[10px] font-bold text-paper">
                  {t.badge}
                </span>
              ) : t.count !== undefined ? (
                <span className="font-mono text-[11px] text-steel">({t.count})</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Active Panel View */}
        <div className="mt-8">
          <Reveal key={tab} className="min-w-0">
            {tab === 'schedule' && (
              <OperationsWorkspace
                eyebrow="01 / ADMINISTRATIVE SCHEDULE & OCCUPANCY"
                title="Master facility calendar & approvals"
              />
            )}
            {tab === 'users' && <UsersPanel />}
            {tab === 'rooms' && <RoomsPanel />}
            {tab === 'settings' && <SettingsPanel />}
            {tab === 'audit' && <AuditPanel />}
          </Reveal>
        </div>
      </main>
    </>
  )
}

function PanelHead({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-3">
      <div className="flex flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="font-display text-section font-w450">
          <SplitText key={title} text={title} />
        </h2>
      </div>
      {right}
    </div>
  )
}

const TH = 'px-4 py-2.5 text-left font-mono text-[11px] font-semibold text-steel whitespace-nowrap'
const TD = 'px-4 py-3 align-middle'

/* ───────────── 02 · Accounts Directory ───────────── */

const PAGE_SIZE = 20

function Pager({ page, total, count, loading, onPage }: {
  page: number
  total: number
  count: number
  loading: boolean
  onPage: (page: number) => void
}) {
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-steel">
      <span aria-live="polite">{loading ? 'Loading…' : `Showing ${count} of ${total} matching results · Page ${page} of ${lastPage}`}</span>
      <div className="flex gap-2">
        <Button size="xs" variant="outline" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="xs" variant="outline" disabled={loading || page >= lastPage} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

function UsersPanel() {
  const { users, usersTotal, currentUser, loadUsers } = useStore()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState<{ page: number; search?: string; role?: Role }>({ page: 1 })
  const [loadedQuery, setLoadedQuery] = useState<typeof query | null>(null)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const loading = loadedQuery !== query

  useEffect(() => {
    let current = true
    void loadUsers(query).finally(() => { if (current) setLoadedQuery(query) })
    return () => { current = false }
  }, [loadUsers, query])

  useEffect(() => {
    if (loading || usersTotal === 0) return
    const lastPage = Math.ceil(usersTotal / PAGE_SIZE)
    if (query.page > lastPage) setQuery({ ...query, page: lastPage })
  }, [loading, query, usersTotal])

  return (
    <section>
      <PanelHead
        eyebrow="02 / USER & ROLE MANAGEMENT · ACCOUNTS DIRECTORY"
        title="Accounts directory"
        right={
          <Button
            variant="accent"
            onClick={() => setShowManagerModal(true)}
            className="gap-1.5 shadow-xs"
          >
            <Plus size={14} strokeWidth={2.5} /> New Manager account
          </Button>
        }
      />

      {/* Governance Policy Rule Banner */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-edge bg-ice px-4 py-3 text-[13px] text-graphite">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 items-center rounded-sm bg-accent px-2 font-mono text-[10px] font-bold text-paper">
            GOVERNANCE RULE
          </span>
          <span>
            <strong className="text-ink">Manager accounts can ONLY be created by System Administrator.</strong> Students self-register with Student ID.
          </span>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-3" onSubmit={(event) => {
        event.preventDefault()
        setQuery((previous) => ({ ...previous, page: 1, search: q.trim() || undefined }))
      }}>
        <Select aria-label="Account role" value={query.role ?? ''} onChange={(event) => {
          const role = (event.target.value || undefined) as Role | undefined
          setQuery((previous) => ({ ...previous, page: 1, role }))
        }} className="!w-auto font-mono">
          <option value="">All roles</option>
          <option value="USER">Students</option>
          <option value="MANAGER">Managers</option>
          <option value="ADMIN">Admins</option>
        </Select>
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-steel" />
          <Input aria-label="Search accounts" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, email, or Student ID…" className="pl-9" />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {/* Accounts Table */}
      <div className="overflow-x-auto rounded-lg border border-edge bg-paper">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={TH}>ACCOUNT / NAME</th>
              <th className={TH}>STUDENT ID</th>
              <th className={TH}>ROLE</th>
              <th className={TH}>STATUS</th>
              <th className={TH}>JOINED</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-steel">Loading accounts…</td></tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <EmptyState
                    title="NO ACCOUNTS MATCHING"
                    body="No accounts match the current query."
                  />
                  {query.role === 'MANAGER' && (
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => setShowManagerModal(true)}
                      className="mt-3 inline-flex gap-1.5"
                    >
                      <Plus size={14} /> Provision First Manager
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  self={u.id === currentUser?.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager page={query.page} total={usersTotal} count={users.length} loading={loading} onPage={(page) => setQuery((previous) => ({ ...previous, page }))} />
      {showManagerModal && <CreateManagerModal onClose={() => setShowManagerModal(false)} />}
    </section>
  )
}

function CreateManagerModal({ onClose }: { onClose: () => void }) {
  const { createManagerAccount, notify } = useStore()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    let pw = 'Mgr!'
    for (const value of crypto.getRandomValues(new Uint16Array(10))) pw += chars[value % chars.length]
    setPassword(pw)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const err = await createManagerAccount({ fullName, email, password })
      if (err) {
        setError(err)
        notify(err, 'error')
      } else {
        notify('Manager account created.')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  const close = () => { if (!loading) onClose() }

  return (
    <Modal open onClose={close} title="Create Manager account" eyebrow="ADMIN PRIVILEGE · PROVISION STAFF">
      <form onSubmit={handleSubmit}>
        <fieldset disabled={loading} className="flex min-w-0 flex-col gap-4 p-6">
          <div className="rounded-md border border-edge bg-ice p-3 text-[13px] leading-[1.5] text-graphite">
            <span className="font-semibold text-ink">Staff Provisioning Policy:</span> Only System Administrators can provision Manager accounts. Student accounts are created via self-registration with a valid Student ID.
          </div>

          <Field label="Full name" hint="required">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Minh Hoang"
              required
            />
          </Field>

          <Field label="Email" hint="staff domain recommended">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="m.hoang@tne.edu.vn"
              required
            />
          </Field>

          <Field label="Initial password" hint="min 8 chars">
            <Input
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="font-mono"
              required
            />
          </Field>
          <button
            type="button"
            onClick={generateStrongPassword}
            disabled={loading}
            className="self-start font-mono text-[11px] font-semibold text-accent hover:underline"
          >
            Generate strong password
          </button>

          {error && (
            <div role="alert" className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">
              {error}
            </div>
          )}
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="md" type="submit" disabled={loading}>
            {loading ? 'Provisioning...' : 'Provision Manager account'} <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function UserRow({ u, self }: { u: User; self: boolean }) {
  const { updateUserRole, setUserStatus, notify } = useStore()
  const [pendingRole, setPendingRole] = useState<Role | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const updateRole = async (role: Role, studentCode?: string) => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const error = await updateUserRole(u.id, role, studentCode)
      if (error) {
        setError(error)
        notify(error, 'error')
      } else {
        setPendingRole(null)
        notify('Account role updated.')
      }
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async () => {
    if (busy || self) return
    setBusy(true)
    const status = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      const error = await setUserStatus(u.id, status)
      if (error) notify(error, 'error')
      else notify(status === 'SUSPENDED' ? 'Account suspended.' : 'Account activated.')
    } finally {
      setBusy(false)
    }
  }

  const change = (role: Role) => {
    if (busy || role === (pendingRole ?? u.role)) return
    if (role === u.role) {
      setPendingRole(null)
      setError(null)
      return
    }
    if (role === 'USER' && !u.studentCode) {
      setPendingRole('USER')
      setCode('')
      setError(null)
      return
    }
    void updateRole(role)
  }

  const isAdmin = u.role === 'ADMIN'
  const isManager = u.role === 'MANAGER'

  return (
    <>
      <tr
        className={cx(
          'border-b border-rule hover:bg-ice/40 transition-colors',
          u.status === 'SUSPENDED' && 'bg-plum/[0.03]',
          pendingRole && 'border-b-0',
        )}
      >
        <td className={TD}>
          <div className="flex items-center gap-3">
            <span
              className={cx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm font-mono text-[11px] font-semibold',
                isAdmin
                  ? 'border border-ink bg-ink text-paper'
                  : isManager
                    ? 'border border-accent bg-accent/10 text-accent font-bold'
                    : 'border border-edge bg-ice text-graphite',
              )}
            >
              {u.fullName
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[14px] font-medium">
                {u.fullName} {self && <Tag tone="accent">YOU</Tag>}
              </div>
              <div className="truncate text-[12px] text-steel">{u.email}</div>
            </div>
          </div>
        </td>

        <td className={cx(TD, 'font-mono text-[13px] font-semibold')}>
          {u.studentCode ? (
            <span className="text-meta">{u.studentCode}</span>
          ) : isManager ? (
            <span className="font-mono text-[11px] text-steel uppercase">— (STAFF)</span>
          ) : (
            <span className="text-steel/60">—</span>
          )}
        </td>

        <td className={TD}>
          {isAdmin ? (
            <div className="flex items-center gap-1.5" title="System Admin account is protected">
              <Tag tone="ink">ADMIN</Tag>
              <Lock size={12} className="text-steel" />
            </div>
          ) : (
            <>
              <Select
                value={pendingRole ?? u.role}
                disabled={self || busy}
                onChange={(e) => change(e.target.value as Role)}
                className="!w-[130px] !py-1 font-mono !text-[12px]"
              >
                <option value="USER">USER</option>
                <option value="MANAGER">MANAGER</option>
              </Select>
              {error && !pendingRole && <div className="mt-1 text-[11px] text-plum">{error}</div>}
            </>
          )}
        </td>

        <td className={TD}>
          <button
            type="button"
            disabled={self || busy}
            onClick={changeStatus}
            className={cx(
              'flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              u.status === 'ACTIVE'
                ? 'border-accent/50 bg-tint text-forest hover:border-accent'
                : 'border-plum/40 bg-plum/[0.07] text-plum hover:border-plum',
            )}
            title={self ? 'You cannot change your own status' : u.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', u.status === 'ACTIVE' ? 'bg-accent' : 'bg-plum')} />
            {u.status}
          </button>
        </td>

        <td className={cx(TD, 'font-mono text-[12px] text-steel')}>
          {fmtDate(u.createdAt)}
        </td>
      </tr>

      {pendingRole && (
        <tr className="border-b border-rule bg-ice">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="text-[13px] text-graphite">
                Assigning <span className="font-mono font-semibold text-ink">USER</span> to {u.fullName} requires a unique Student ID.
              </div>
              <Input
                disabled={busy}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="SE000000"
                className="!w-[160px] font-mono"
                autoFocus
              />
              <Button
                size="sm"
                disabled={busy || !code.trim()}
                onClick={() => updateRole('USER', code)}
              >
                Assign role <ArrowRight size={14} />
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setPendingRole(null); setError(null) }}>
                Cancel
              </Button>
              {error && <span className="text-[12px] font-medium text-plum">{error}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ───────────── 03 · Rooms (601, 602, 605) ───────────── */

const statusTone: Record<RoomStatus, 'accent' | 'meta' | 'neutral'> = {
  AVAILABLE: 'accent',
  MAINTENANCE: 'meta',
  INACTIVE: 'neutral',
}

function RoomsPanel() {
  const { rooms, bookings, setRoomStatus, notify } = useStore()
  const [editing, setEditing] = useState<Room | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const changeStatus = async (room: Room, status: RoomStatus) => {
    if (updatingStatus || room.status === status) return
    setUpdatingStatus(true)
    try {
      const error = await setRoomStatus(room.id, status)
      if (error) notify(error, 'error')
      else {
        notify(status === 'INACTIVE' ? `Room ${room.code} archived.` : `Room ${room.code} status updated.`)
        setConfirmArchive(null)
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <section>
      <PanelHead
        eyebrow="03 / ROOM MANAGEMENT"
        title="Room inventory"
        right={
          <Button
            onClick={() =>
              setEditing({
                id: '',
                code: '601',
                name: '',
                floor: 6,
                capacity: 40,
                autoApprove: false,
                status: 'AVAILABLE',
                features: [],
              })
            }
          >
            <Plus size={14} /> New room
          </Button>
        }
      />


      <div className="overflow-x-auto rounded-lg border border-edge bg-paper">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={TH}>CODE</th>
              <th className={TH}>NAME &amp; LEVEL</th>
              <th className={TH}>CAPACITY</th>
              <th className={TH}>STATUS</th>
              <th className={TH}>ACTIVE BKGS</th>
              <th className={cx(TH, 'text-right')}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => {
              const act = bookings.filter((b) => b.roomId === r.id && ACTIVE_STATUSES.includes(b.status)).length
              return (
                <tr key={r.id} className="border-b border-rule last:border-0 hover:bg-ice/40 transition-colors">
                  <td className={TD}>
                    <span className="font-display text-[26px] leading-none font-w450">{r.code}</span>
                  </td>
                  <td className={TD}>
                    <div className="text-[14px] font-medium">{r.name}</div>
                    <div className="font-mono text-[11px] text-steel">
                      L{r.floor} · {r.features.join(' · ') || 'no features'}
                    </div>
                  </td>
                  <td className={cx(TD, 'font-mono text-[14px] font-semibold')}>{r.capacity}</td>
                  <td className={TD}>
                    <Select
                      value={r.status}
                      aria-label={`Status for room ${r.code}`}
                      disabled={updatingStatus}
                      onChange={(event) => {
                        const status = event.target.value as RoomStatus
                        if (status === 'INACTIVE') setConfirmArchive(r.id)
                        else void changeStatus(r, status)
                      }}
                      className="!w-[150px] !py-1 font-mono !text-[12px]"
                    >
                      <option>AVAILABLE</option>
                      <option>MAINTENANCE</option>
                      <option>INACTIVE</option>
                    </Select>
                  </td>
                  <td className={TD}>
                    <Tag tone={act ? 'ink' : 'neutral'}>{String(act).padStart(2, '0')}</Tag>
                  </td>
                  <td className={cx(TD, 'text-right')}>
                    {confirmArchive === r.id && r.status !== 'INACTIVE' ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[12px] text-plum">Archive room {r.code}?</span>
                        <Button
                          size="xs"
                          variant="plum"
                          disabled={updatingStatus}
                          onClick={() => changeStatus(r, 'INACTIVE')}
                        >
                          Confirm archive
                        </Button>
                        <Button size="xs" variant="ghost" disabled={updatingStatus} onClick={() => setConfirmArchive(null)}>
                          Keep
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" onClick={() => setEditing(r)}>
                          <Pencil size={12} /> Edit
                        </Button>
                        {r.status !== 'INACTIVE' && (
                          <Button size="xs" variant="ghost" disabled={updatingStatus} onClick={() => setConfirmArchive(r.id)}>
                            <Archive size={13} /> Archive
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 font-mono text-[11px] text-steel">
        {(['AVAILABLE', 'MAINTENANCE', 'INACTIVE'] as RoomStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-2">
            <Tag tone={statusTone[s]}>{s}</Tag>
            {s === 'AVAILABLE' ? 'open for booking' : s === 'MAINTENANCE' ? 'temporarily closed' : 'hidden from new bookings'}
          </span>
        ))}
      </div>

      {editing && <RoomEditor room={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function RoomEditor({ room, onClose }: { room: Room; onClose: () => void }) {
  const { saveRoom, notify } = useStore()
  const [draft, setDraft] = useState(room)
  const [features, setFeatures] = useState(() => room.features.join(', '))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const up = (p: Partial<Room>) => setDraft((d) => ({ ...d, ...p }))
  const close = () => { if (!saving) onClose() }

  return (
    <Modal open onClose={close} title={room.id ? `Edit room ${room.code}` : 'Create room'} eyebrow="ROOM RECORD">
      <fieldset disabled={saving} className="grid grid-cols-2 gap-4 p-6">
        <Field label="Room code" hint="3 digits (601, 602, 605)">
          <Input
            value={draft.code}
            onChange={(e) => up({ code: e.target.value.replace(/\D/g, '').slice(0, 3) })}
            className="font-mono"
            placeholder="601"
          />
        </Field>
        <Field label="Floor">
          <Input
            type="number"
            value={draft.floor}
            onChange={(e) => up({ floor: Number(e.target.value) })}
            className="font-mono"
          />
        </Field>
        <Field label="Name" className="col-span-2">
          <Input value={draft.name} onChange={(e) => up({ name: e.target.value })} placeholder="Seminar Hall 601" />
        </Field>
        <Field label="Capacity">
          <Input
            type="number"
            min={1}
            value={draft.capacity}
            onChange={(e) => up({ capacity: Number(e.target.value) })}
            className="font-mono"
          />
        </Field>
        <label className="flex items-center gap-2 self-center text-[13px] font-semibold text-ink">
          <input type="checkbox" checked={draft.autoApprove} onChange={(event) => up({ autoApprove: event.target.checked })} />
          Auto-approve clear student slots
        </label>
        <Field label="Features" hint="comma separated" className="col-span-2">
          <Input
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Projector, Whiteboard, Video Conference"
          />
        </Field>

        {error && (
          <div role="alert" className="col-span-2 border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">
            {error}
          </div>
        )}
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">
        <Button variant="ghost" onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="md"
          disabled={saving}
          onClick={async () => {
            if (saving) return
            setError(null)
            setSaving(true)
            try {
              const error = await saveRoom({
                ...draft,
                features: features.split(',').map((f) => f.trim()).filter(Boolean),
              })
              if (error) {
                setError(error)
                notify(error, 'error')
              } else {
                notify('Room saved.')
                onClose()
              }
            } finally {
              setSaving(false)
            }
          }}
        >
          Save room <ArrowRight size={16} />
        </Button>
      </div>
    </Modal>
  )
}

/* ───────────── 04 · System Settings ───────────── */

function SettingsPanel() {
  const { settings, settingsLoaded, refreshSettings, updateSettings, notify } = useStore()
  const [edit, setEdit] = useState<{ base: Settings; value: Settings } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const draft = edit?.base === settings ? edit.value : settings
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const up = (p: Partial<Settings>) => setEdit((current) => ({
    base: settings, value: { ...(current?.base === settings ? current.value : settings), ...p },
  }))
  const hours = Array.from({ length: 25 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    up({ [k]: Number(e.target.value) } as Partial<Settings>)

  return (
    <section>
      <PanelHead
        eyebrow="04 / GLOBAL CONFIGURATION"
        title="System settings"
        right={settingsLoaded && (dirty ? <Tag tone="meta">UNSAVED CHANGES</Tag> : <Tag tone="accent">IN SYNC</Tag>)}
      />
      {!settingsLoaded && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-plum p-3 text-[13px]">
          <p role="alert">Settings are unavailable. Reload them before saving.</p>
          <Button variant="outline" size="sm" disabled={retrying} onClick={async () => {
            setRetrying(true)
            try { await refreshSettings() } finally { setRetrying(false) }
          }}>
            {retrying ? 'Loading…' : 'Retry settings'}
          </Button>
        </div>
      )}
      <Reveal stagger className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <fieldset disabled={!settingsLoaded || saving} className="min-w-0 rounded-lg border border-edge bg-paper">
          <SettingGroup
            n="A"
            title="Locale & hours"
            body="Defines the bookable operating hours shown on every room calendar in campus time."
          >
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-semibold text-ink">Campus timezone</span>
              <span className="font-mono text-[13px] text-steel">{CAMPUS_TZ} (UTC+07:00)</span>
            </div>
            <Field label="Opening time">
              <Select value={draft.openTime} onChange={(e) => up({ openTime: e.target.value })} className="font-mono">
                {hours.slice(0, 24).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </Field>
            <Field label="Closing time">
              <Select value={draft.closeTime} onChange={(e) => up({ closeTime: e.target.value })} className="font-mono">
                {hours.slice(1).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </Field>
          </SettingGroup>

          <SettingGroup n="B" title="Booking policy" body="Limits enforced on every new student reservation request.">
            <Field label="Max duration" hint="minutes">
              <Input
                type="number"
                step={30}
                min={30}
                value={draft.maxDurationMinutes}
                onChange={num('maxDurationMinutes')}
                className="font-mono"
              />
            </Field>
            <Field label="Max active bookings" hint="per user">
              <Input
                type="number"
                min={1}
                value={draft.maxActiveBookings}
                onChange={num('maxActiveBookings')}
                className="font-mono"
              />
            </Field>
            <Field label="Max advance" hint="days">
              <Input
                type="number"
                min={1}
                value={draft.maxAdvanceDays}
                onChange={num('maxAdvanceDays')}
                className="font-mono"
              />
            </Field>
          </SettingGroup>

          {error && (
            <div className="mx-6 mb-4 border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">
            <Button variant="ghost" disabled={!dirty || saving} onClick={() => { setEdit(null); setError(null) }}>
              Discard
            </Button>
            <Button size="md" disabled={!settingsLoaded || !dirty || saving} onClick={async () => {
              if (!settingsLoaded || saving) return
              setError(null)
              setSaving(true)
              try {
                const error = await updateSettings({ ...draft, timezone: CAMPUS_TZ })
                if (error) {
                  setError(error)
                  notify(error, 'error')
                } else {
                  notify('Settings saved.')
                }
              } finally {
                setSaving(false)
              }
            }}>
              Save settings <ArrowRight size={16} />
            </Button>
          </div>
        </fieldset>

        <aside className="flex flex-col gap-4 self-start rounded-lg bg-ice p-6">
          <Eyebrow>POLICY PREVIEW</Eyebrow>
          <h3 className="font-display text-feature font-w450">
            <SplitText text="What students will see" />
          </h3>
          <p className="text-[14px] leading-[1.5] text-graphite">
            Rooms open <b className="font-semibold text-ink">{draft.openTime}–{draft.closeTime}</b>. Requests can be made up to{' '}
            <b className="font-semibold text-ink">{draft.maxAdvanceDays} days</b>{' '}
            ahead, last at most <b className="font-semibold text-ink">{draft.maxDurationMinutes} min</b>, and each student may hold{' '}
            <b className="font-semibold text-ink">{draft.maxActiveBookings}</b> active booking(s).
          </p>
          <div className="flex h-8 items-stretch border border-ink bg-paper">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={cx(
                  'flex flex-1 items-center justify-center border-r border-rule font-mono text-[9px] last:border-0',
                  i === 0
                    ? 'bg-ink text-paper'
                    : i <= draft.maxAdvanceDays
                      ? 'bg-tint text-forest'
                      : 'hatch text-steel',
                )}
              >
                {i === 0 ? 'T' : `+${i}`}
              </div>
            ))}
          </div>
          <div className="font-mono text-[11px] text-steel">TZ · {CAMPUS_TZ}</div>
        </aside>
      </Reveal>
    </section>
  )
}

function SettingGroup({
  n,
  title,
  body,
  children,
}: {
  n: string
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-6 border-b border-rule p-6 md:grid-cols-[220px_1fr]">
      <div>
        <div className="font-mono text-[12px] font-semibold text-accent">{n}</div>
        <div className="mt-1 text-[16px] font-semibold">{title}</div>
        <div className="mt-1 text-[13px] leading-[1.5] text-graphite">
          <ScrollRevealText text={body} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

/* ───────────── 05 · Immutable Audit Ledger ───────────── */

function AuditPanel() {
  const { audit, auditTotal, loadAudit } = useStore()
  const { user } = useLookups()
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [query, setQuery] = useState<{ page: number; action?: string; targetType?: string }>({ page: 1 })
  const [loadedQuery, setLoadedQuery] = useState<typeof query | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const loading = loadedQuery !== query

  useEffect(() => {
    let current = true
    void loadAudit(query).finally(() => { if (current) setLoadedQuery(query) })
    return () => { current = false }
  }, [loadAudit, query])

  const exportJson = () => {
    if (loading) return
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `audit-log-${dayKey(new Date())}-page-${query.page}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const tone = (act: string) =>
    /REJECT|DELETE|SUSPEND|CANCEL/.test(act)
      ? 'plum'
      : /APPROVE|CREATE|REGISTER|RETURN/.test(act)
        ? 'accent'
        : /KEY/.test(act)
          ? 'ink'
          : 'neutral'

  return (
    <section>
      <PanelHead
        eyebrow="05 / IMMUTABLE AUDIT LEDGER"
        title="Audit logs"
        right={
          <Button variant="outline" onClick={exportJson} disabled={loading || audit.length === 0}>
            <Download size={14} /> Export current page (JSON)
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault()
        setOpen(null)
        setQuery({ page: 1, action: action.trim() || undefined, targetType: targetType.trim() || undefined })
      }}>
        <Field label="Action" hint="Exact match">
          <Input maxLength={100} placeholder="e.g. BOOKING_APPROVED" value={action} onChange={(event) => setAction(event.target.value)} className="font-mono" />
        </Field>
        <Field label="Target type" hint="Exact match">
          <Input maxLength={100} placeholder="e.g. Booking" value={targetType} onChange={(event) => setTargetType(event.target.value)} className="font-mono" />
        </Field>
        <Button type="submit" variant="outline">Apply filters</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-edge bg-paper">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={cx(TH, 'w-8')} />
              <th className={TH}>TIMESTAMP</th>
              <th className={TH}>LOG ID</th>
              <th className={TH}>ACTOR</th>
              <th className={TH}>ACTION</th>
              <th className={TH}>ENTITY</th>
              <th className={TH}>METADATA</th>
            </tr>
          </thead>
          <tbody>
            {loading || audit.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-steel">{loading ? 'Loading audit entries…' : 'No audit entries match the current filters.'}</td></tr>
            ) : audit.map((a) => {
              const isOpen = open === a.id
              const meta = JSON.stringify(a.metadata)
              return (
                <Fragment key={a.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : a.id)}
                    className={cx(
                      'cursor-pointer border-b border-rule font-mono text-[12px] hover:bg-ice/50 transition-colors',
                      isOpen && 'bg-ice/60',
                    )}
                  >
                    <td className="pl-4 text-steel">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className={cx(TD, 'whitespace-nowrap text-ink')}>{fmtStamp(a.ts)}</td>
                    <td className={cx(TD, 'text-steel')}>{a.id}</td>
                    <td className={TD}>
                      <div className="font-medium text-meta">{a.actorId}</div>
                      <div className="font-sans text-[11px] text-steel">{user(a.actorId)?.fullName}</div>
                    </td>
                    <td className={TD}>
                      <Tag tone={tone(a.action)}>{a.action}</Tag>
                    </td>
                    <td className={cx(TD, 'text-graphite')}>{a.entity}</td>
                    <td className={cx(TD, 'max-w-[280px] truncate text-steel')}>{meta === '{}' ? '—' : meta}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-rule">
                      <td colSpan={7} className="bg-forest p-0">
                        <div className="flex items-center justify-between border-b border-white/15 px-5 py-2 font-mono text-[11px] text-white/75">
                          <span>metadata.json · {a.id}</span>
                          <span>{meta.length} bytes</span>
                        </div>
                        <pre className="overflow-x-auto px-5 py-4 font-mono text-[12px] leading-[1.6] text-tint">
                          {JSON.stringify(
                            {
                              id: a.id,
                              ts: a.ts,
                              actorId: a.actorId,
                              action: a.action,
                              entity: a.entity,
                              metadata: a.metadata,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pager page={query.page} total={auditTotal} count={audit.length} loading={loading} onPage={(page) => {
        setOpen(null)
        setQuery((previous) => ({ ...previous, page }))
      }} />
    </section>
  )
}
