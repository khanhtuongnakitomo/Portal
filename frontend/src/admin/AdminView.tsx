import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sliders,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { ACTIVE_STATUSES, useLookups, useStore } from '@/lib/store'
import type { Role, Room, RoomStatus, Settings, User } from '@/lib/types'
import { fmtDate, fmtShort, fmtStamp, fmtTime, sameDay } from '@/lib/time'
import { uid } from '@/lib/seed'
import { Button, EmptyState, Eyebrow, Field, Input, Modal, Select, Tag, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { Reveal, ScrollRevealText, SplitText } from '@/components/effects'
import { OperationsWorkspace } from '@/manager/ManagerView'

export type AdminTab = 'schedule' | 'users' | 'rooms' | 'settings' | 'audit'

export function AdminView() {
  const { rooms, users, bookings, audit } = useStore()
  const [tab, setTab] = useState<AdminTab>('schedule')

  const pending = useMemo(() => bookings.filter((b) => b.status === 'PENDING'), [bookings])
  const now = new Date()
  const today = useMemo(
    () =>
      bookings.filter(
        (b) => sameDay(new Date(b.start), now) && ['APPROVED', 'COMPLETED', 'KEY_CHECKED_OUT'].includes(b.status),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings],
  )
  const scheduled = useMemo(
    () => bookings.filter((b) => ['APPROVED', 'KEY_CHECKED_OUT'].includes(b.status)).length,
    [bookings],
  )

  const studentCount = useMemo(() => users.filter((u) => u.role === 'USER').length, [users])
  const managerCount = useMemo(() => users.filter((u) => u.role === 'MANAGER').length, [users])

  const tabs = [
    {
      id: 'schedule' as AdminTab,
      n: '01',
      label: 'Schedule & Approvals',
      shortLabel: 'Schedule',
      badge: pending.length,
      icon: <Calendar size={14} />,
    },
    {
      id: 'users' as AdminTab,
      n: '02',
      label: 'User Accounts',
      shortLabel: 'Accounts',
      count: users.length,
      icon: <Users size={14} />,
    },
    {
      id: 'rooms' as AdminTab,
      n: '03',
      label: 'Room Inventory',
      shortLabel: 'Rooms',
      count: rooms.length,
      icon: <Building2 size={14} />,
    },
    {
      id: 'settings' as AdminTab,
      n: '04',
      label: 'System Settings',
      shortLabel: 'Settings',
      icon: <Sliders size={14} />,
    },
    {
      id: 'audit' as AdminTab,
      n: '05',
      label: 'Audit Ledger',
      shortLabel: 'Audit',
      count: audit.length,
      icon: <ShieldCheck size={14} />,
    },
  ]

  return (
    <>
      <TopNav>
        <div className="flex items-center gap-1 rounded-md border border-rule/70 bg-ice/50 p-1 overflow-x-auto no-scrollbar max-w-full shrink">
          {tabs.map((t) => (
            <NavItem
              key={t.id}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
              badge={t.badge && t.badge > 0 ? t.badge : undefined}
              icon={t.icon}
            >
              {t.label}
            </NavItem>
          ))}
        </div>
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
                ? 'Directory of student and facility manager accounts. Filter and sort by role, manage activation status, and provision new Manager staff accounts.'
                : tab === 'rooms'
                  ? 'Manage university rooms 601, 602, and 605. Configure capacity, amenities, and maintenance states. All room bookings require manager/admin approval.'
                  : tab === 'settings'
                    ? 'Global operating hours (08:00–17:00), advance reservation limits, and student booking allowances.'
                    : 'Cryptographically structured, append-only log of every mutation in the facilities ledger.'
          }
          right={
            <div className="flex flex-col items-end gap-3">
              <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule sm:grid-cols-4">
                {[
                  ['PENDING', pending.length, pending.length ? 'text-accent' : ''],
                  ['STUDENTS', studentCount, ''],
                  ['MANAGERS', managerCount, 'text-accent'],
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

/* ───────────── 02 · Accounts Directory (Sorted by Student & Manager) ───────────── */

type AccountFilterTab = 'ALL' | 'STUDENTS' | 'MANAGERS' | 'ADMINS'
type AccountSortMode = 'MANAGERS_FIRST' | 'STUDENTS_FIRST' | 'NEWEST' | 'NAME'

function UsersPanel() {
  const { users, currentUser, toggleUserStatus } = useStore()
  const [q, setQ] = useState('')
  const [accountTab, setAccountTab] = useState<AccountFilterTab>('ALL')
  const [sortMode, setSortMode] = useState<AccountSortMode>('MANAGERS_FIRST')
  const [showManagerModal, setShowManagerModal] = useState(false)

  const studentCount = useMemo(() => users.filter((u) => u.role === 'USER').length, [users])
  const managerCount = useMemo(() => users.filter((u) => u.role === 'MANAGER').length, [users])
  const adminCount = useMemo(() => users.filter((u) => u.role === 'ADMIN').length, [users])

  const filteredAndSortedList = useMemo(() => {
    const s = q.trim().toLowerCase()
    let list = users.filter((u) => {
      if (accountTab === 'STUDENTS' && u.role !== 'USER') return false
      if (accountTab === 'MANAGERS' && u.role !== 'MANAGER') return false
      if (accountTab === 'ADMINS' && u.role !== 'ADMIN') return false
      if (!s) return true
      return (
        u.fullName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.studentCode?.toLowerCase().includes(s)
      )
    })

    list = [...list].sort((a, b) => {
      if (sortMode === 'MANAGERS_FIRST') {
        const rank = (role: Role) => (role === 'MANAGER' ? 0 : role === 'USER' ? 1 : 2)
        const diff = rank(a.role) - rank(b.role)
        if (diff !== 0) return diff
        return a.fullName.localeCompare(b.fullName)
      }
      if (sortMode === 'STUDENTS_FIRST') {
        const rank = (role: Role) => (role === 'USER' ? 0 : role === 'MANAGER' ? 1 : 2)
        const diff = rank(a.role) - rank(b.role)
        if (diff !== 0) return diff
        return a.fullName.localeCompare(b.fullName)
      }
      if (sortMode === 'NEWEST') {
        return +new Date(b.createdAt) - +new Date(a.createdAt)
      }
      if (sortMode === 'NAME') {
        return a.fullName.localeCompare(b.fullName)
      }
      return 0
    })

    return list
  }, [users, accountTab, sortMode, q])

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
        <div className="flex items-center gap-3 font-mono text-[11px] text-steel">
          <span>STUDENTS: <b className="text-ink">{studentCount}</b></span>
          <span>•</span>
          <span>MANAGERS: <b className="text-accent">{managerCount}</b></span>
          <span>•</span>
          <span>ADMINS: <b className="text-ink">{adminCount}</b></span>
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAccountTab('ALL')}
            className={cx(
              'rounded-[4px] px-3 py-1.5 font-mono text-[12px] font-semibold transition-all',
              accountTab === 'ALL'
                ? 'border border-ink bg-paper text-ink shadow-xs'
                : 'text-steel hover:bg-ice hover:text-ink',
            )}
          >
            ALL ACCOUNTS ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setAccountTab('STUDENTS')}
            className={cx(
              'flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 font-mono text-[12px] font-semibold transition-all',
              accountTab === 'STUDENTS'
                ? 'border border-accent bg-paper text-accent shadow-xs'
                : 'text-steel hover:bg-ice hover:text-ink',
            )}
          >
            <span className="h-1.5 w-1.5 rounded-sm bg-accent" />
            STUDENTS · USER ({studentCount})
          </button>

          <button
            type="button"
            onClick={() => setAccountTab('MANAGERS')}
            className={cx(
              'flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 font-mono text-[12px] font-semibold transition-all',
              accountTab === 'MANAGERS'
                ? 'border border-ink bg-ink text-paper shadow-xs'
                : 'text-steel hover:bg-ice hover:text-ink',
            )}
          >
            <span className="h-1.5 w-1.5 rounded-sm bg-white" />
            MANAGERS · STAFF ({managerCount})
          </button>

          <button
            type="button"
            onClick={() => setAccountTab('ADMINS')}
            className={cx(
              'flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 font-mono text-[12px] font-semibold transition-all',
              accountTab === 'ADMINS'
                ? 'border border-edge bg-paper text-ink shadow-xs'
                : 'text-steel hover:bg-ice hover:text-ink',
            )}
          >
            ADMINS ({adminCount})
          </button>
        </div>

        {/* Right: Search and Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {accountTab === 'ALL' && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-steel">SORT:</span>
              <Select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as AccountSortMode)}
                className="!w-[170px] !py-1 font-mono !text-[12px]"
              >
                <option value="MANAGERS_FIRST">Managers First</option>
                <option value="STUDENTS_FIRST">Students First</option>
                <option value="NEWEST">Newest Joined</option>
                <option value="NAME">Name (A-Z)</option>
              </Select>
            </div>
          )}

          <div className="relative min-w-[240px]">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-steel" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, or Student ID..."
              className="pl-9 font-sans text-[13px]"
            />
          </div>
        </div>
      </div>

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
            {filteredAndSortedList.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <EmptyState
                    title="NO ACCOUNTS MATCHING"
                    body={
                      accountTab === 'MANAGERS'
                        ? 'No manager accounts match this filter. Click "+ New Manager account" to provision staff.'
                        : 'No accounts match the current query.'
                    }
                  />
                  {accountTab === 'MANAGERS' && (
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
              filteredAndSortedList.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  self={u.id === currentUser?.id}
                  onToggle={() => toggleUserStatus(u.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateManagerModal open={showManagerModal} onClose={() => setShowManagerModal(false)} />
    </section>
  )
}

function CreateManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createManagerAccount } = useStore()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    let pw = 'Mgr!'
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    setPassword(pw)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const err = await createManagerAccount({ fullName, email, password })
      if (err) {
        setError(err)
      } else {
        setFullName('')
        setEmail('')
        setPassword('')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Modal open onClose={onClose} title="Create Manager account" eyebrow="ADMIN PRIVILEGE · PROVISION STAFF">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 p-6">
          <div className="rounded-md border border-edge bg-ice p-3 text-[13px] leading-[1.5] text-graphite">
            <span className="font-semibold text-ink">Staff Provisioning Policy:</span> Only System Administrators can provision Manager accounts. Student accounts are created via self-registration with a valid Student ID.
          </div>

          <Field label="Full name" hint="required">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Minh Hoang"
              autoFocus
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

          <Field
            label="Initial password"
            hint="min 8 chars"
            action={
              <button
                type="button"
                onClick={generateStrongPassword}
                className="font-mono text-[11px] font-semibold text-accent hover:underline"
              >
                Generate strong
              </button>
            }
          >
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="font-mono"
              required
            />
          </Field>

          {error && (
            <div className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">
              {error}
            </div>
          )}
        </div>

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

function UserRow({ u, self, onToggle }: { u: User; self: boolean; onToggle: () => void }) {
  const { updateUserRole } = useStore()
  const [pendingRole, setPendingRole] = useState<Role | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const change = (role: Role) => {
    if (role === u.role) return
    if (role === 'USER' && !u.studentCode) {
      setPendingRole('USER')
      setCode('')
      setError(null)
      return
    }
    const err = updateUserRole(u.id, role)
    setError(err)
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
                disabled={self}
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
            disabled={self}
            onClick={onToggle}
            className={cx(
              'flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              u.status === 'ACTIVE'
                ? 'border-accent/50 bg-tint text-forest hover:border-accent'
                : 'border-plum/40 bg-plum/[0.07] text-plum hover:border-plum',
            )}
            title={self ? 'You cannot change your own status' : u.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}
          >
            <span className={cx('h-1.5 w-1.5 rounded-sm', u.status === 'ACTIVE' ? 'bg-accent' : 'bg-plum')} />
            {u.status}
          </button>
        </td>

        <td className={cx(TD, 'font-mono text-[12px] text-steel')}>
          {fmtStamp(u.createdAt).slice(0, 10)}
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
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="SE000000"
                className="!w-[160px] font-mono"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => {
                  const err = updateUserRole(u.id, 'USER', code)
                  setError(err)
                  if (!err) setPendingRole(null)
                }}
              >
                Assign role <ArrowRight size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingRole(null)}>
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
  const { rooms, bookings, saveRoom, deleteRoom } = useStore()
  const [editing, setEditing] = useState<Room | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  return (
    <section>
      <PanelHead
        eyebrow="03 / ROOMS MANAGEMENT · ROOMS 601, 602, 605"
        title="Rooms (601, 602, 605)"
        right={
          <Button
            onClick={() =>
              setEditing({
                id: uid('r'),
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

      {/* Auto-Approve Policy Notice */}
      <div className="mb-4 flex items-center justify-between rounded-md border border-rule bg-ice px-4 py-2.5 font-mono text-[11px] text-steel">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-accent" />
          ALL BOOKINGS GO THROUGH FACILITY MANAGER / ADMIN APPROVAL · NO AUTO-APPROVE
        </span>
        <span>ROOMS LIMITED TO 601, 602, 605</span>
      </div>

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
                      onChange={(e) => saveRoom({ ...r, status: e.target.value as RoomStatus })}
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
                    {confirmDel === r.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[12px] text-plum">{act ? `${act} active booking(s).` : ''} Delete?</span>
                        <Button
                          size="xs"
                          variant="plum"
                          onClick={() => {
                            deleteRoom(r.id)
                            setConfirmDel(null)
                          }}
                        >
                          Delete
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setConfirmDel(null)}>
                          Keep
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" onClick={() => setEditing(r)}>
                          <Pencil size={12} /> Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label={`Delete room ${r.code}`}
                          onClick={() => setConfirmDel(r.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
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

      <RoomEditor
        room={editing}
        onClose={() => setEditing(null)}
        onSave={saveRoom}
        isNew={!!editing && !rooms.some((r) => r.id === editing.id)}
      />
    </section>
  )
}

function RoomEditor({
  room,
  onClose,
  onSave,
  isNew,
}: {
  room: Room | null
  onClose: () => void
  onSave: (r: Room) => string | null
  isNew: boolean
}) {
  const [draft, setDraft] = useState<Room | null>(room)
  const [features, setFeatures] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(room)
    setFeatures(room?.features.join(', ') ?? '')
    setError(null)
  }, [room])

  if (!room || !draft) return null
  const up = (p: Partial<Room>) => setDraft((d) => (d ? { ...d, ...p } : d))

  return (
    <Modal open onClose={onClose} title={isNew ? 'Create room' : `Edit room ${room.code}`} eyebrow={`ROOM RECORD · ${draft.id}`}>
      <div className="grid grid-cols-2 gap-4 p-6">
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
        <Field label="Status">
          <Select
            value={draft.status}
            onChange={(e) => up({ status: e.target.value as RoomStatus })}
            className="font-mono"
          >
            <option>AVAILABLE</option>
            <option>MAINTENANCE</option>
            <option>INACTIVE</option>
          </Select>
        </Field>
        <Field label="Features" hint="comma separated" className="col-span-2">
          <Input
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Projector, Whiteboard, Video Conference"
          />
        </Field>

        {error && (
          <div className="col-span-2 border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="md"
          onClick={() => {
            const err = onSave({
              ...draft,
              autoApprove: false, // Strict governance: all bookings require manager approval
              features: features.split(',').map((f) => f.trim()).filter(Boolean),
            })
            if (err) setError(err)
            else onClose()
          }}
        >
          Save room <ArrowRight size={16} />
        </Button>
      </div>
    </Modal>
  )
}

/* ───────────── 04 · System Settings ───────────── */

const TIMEZONES = [
  'Asia/Ho_Chi_Minh (UTC+07:00)',
  'Asia/Singapore (UTC+08:00)',
  'Australia/Sydney (UTC+10:00)',
  'UTC (UTC+00:00)',
]

function SettingsPanel() {
  const { settings, updateSettings } = useStore()
  const [draft, setDraft] = useState<Settings>(settings)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setDraft(settings), [settings])
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const up = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }))
  const hours = Array.from({ length: 25 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    up({ [k]: Number(e.target.value) } as Partial<Settings>)

  return (
    <section>
      <PanelHead
        eyebrow="04 / GLOBAL CONFIGURATION"
        title="System settings"
        right={dirty ? <Tag tone="meta">UNSAVED CHANGES</Tag> : <Tag tone="accent">IN SYNC</Tag>}
      />
      <Reveal stagger className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-edge bg-paper">
          <SettingGroup
            n="A"
            title="Locale & hours"
            body="Defines the bookable operating band shown on every room calendar (08:00–17:00)."
          >
            <Field label="Timezone" className="sm:col-span-2">
              <Select value={draft.timezone} onChange={(e) => up({ timezone: e.target.value })} className="font-mono">
                {TIMEZONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
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
            <Field label="Min advance" hint="days">
              <Input
                type="number"
                min={0}
                value={draft.minAdvanceDays}
                onChange={num('minAdvanceDays')}
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
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(settings)}>
              Discard
            </Button>
            <Button size="md" disabled={!dirty} onClick={() => setError(updateSettings(draft))}>
              Save settings <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        <aside className="flex flex-col gap-4 self-start rounded-lg bg-ice p-6">
          <Eyebrow>POLICY PREVIEW</Eyebrow>
          <h3 className="font-display text-feature font-w450">
            <SplitText text="What students will see" />
          </h3>
          <p className="text-[14px] leading-[1.5] text-graphite">
            Rooms open <b className="font-semibold text-ink">{draft.openTime}–{draft.closeTime}</b>. Requests must be made{' '}
            <b className="font-semibold text-ink">
              {draft.minAdvanceDays}–{draft.maxAdvanceDays} days
            </b>{' '}
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
                    : i >= draft.minAdvanceDays && i <= draft.maxAdvanceDays
                      ? 'bg-tint text-forest'
                      : 'hatch text-steel',
                )}
              >
                {i === 0 ? 'T' : `+${i}`}
              </div>
            ))}
          </div>
          <div className="font-mono text-[11px] text-steel">TZ · {draft.timezone}</div>
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
  const { audit } = useStore()
  const { user } = useLookups()
  const [q, setQ] = useState('')
  const [action, setAction] = useState('ALL')
  const [open, setOpen] = useState<string | null>(null)

  const actions = useMemo(() => ['ALL', ...Array.from(new Set(audit.map((a) => a.action))).sort()], [audit])
  const list = audit.filter((a) => {
    const s = q.trim().toLowerCase()
    return (
      (action === 'ALL' || a.action === action) &&
      (!s ||
        a.entity.toLowerCase().includes(s) ||
        a.actorId.toLowerCase().includes(s) ||
        JSON.stringify(a.metadata).toLowerCase().includes(s))
    )
  })

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `audit-log-${fmtStamp(new Date()).slice(0, 10)}.json`
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
          <Button variant="outline" onClick={exportJson}>
            <Download size={14} /> Export JSON
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-steel" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entity, actor or metadata"
            className="pl-9 font-mono"
          />
        </div>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="!w-[220px] font-mono">
          {actions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
      </div>

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
            {list.map((a) => {
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
                      <div className="font-sans text-[11px] text-steel">{user(a.actorId)?.fullName ?? 'System'}</div>
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

      <div className="mt-3 font-mono text-[11px] text-steel">
        SHOWING {list.length} OF {audit.length} ENTRIES · APPEND-ONLY
      </div>
    </section>
  )
}
