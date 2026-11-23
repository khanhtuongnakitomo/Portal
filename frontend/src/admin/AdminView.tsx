import { useI18n } from '@/lib/i18n'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  Archive,
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
  Users,
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
  const { pendingQueue, bookings } = useStore()
  const [tab, setTab] = useState<AdminTab>('schedule')
  const { t } = useI18n()

  const pendingCount = pendingQueue.length
  const scheduled = useMemo(
    () => bookings.filter((b) => ['APPROVED', 'KEY_CHECKED_OUT'].includes(b.status)).length,
    [bookings],
  )


  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'schedule',
      label: t('admin.tabSchedule'),
      badge: pendingCount,
      icon: <Calendar size={14} />,
    },
    {
      id: 'users',
      label: t('admin.tabUsers'),
      icon: <Users size={14} />,
    },
    {
      id: 'rooms',
      label: t('admin.tabRooms'),
      icon: <Building2 size={14} />,
    },
    {
      id: 'settings',
      label: t('admin.tabSettings'),
      icon: <Sliders size={14} />,
    },
    {
      id: 'audit',
      label: t('admin.tabAudit'),
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
          eyebrow={t('admin.adminEyebrow')}
          title={
            tab === 'schedule'
              ? t('admin.scheduleTitle')
              : tab === 'users'
                ? t('admin.accountsTitle')
                : tab === 'rooms'
                  ? t('admin.roomsTitle')
                  : tab === 'settings'
                    ? t('admin.settingsTitle')
                    : t('admin.auditTitle')
          }
          body={
            tab === 'schedule'
              ? t('admin.scheduleBody')
              : tab === 'users'
                ? t('admin.accountsBody')
                : tab === 'rooms'
                  ? t('admin.roomsBody')
                  : tab === 'settings'
                    ? t('admin.settingsBody')
                    : t('admin.auditBody')
          }
          right={
            <div className="flex flex-col items-end gap-3">
              <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule">
                {[
                  [t('common.pending'), pendingCount, pendingCount ? 'text-accent' : ''],
                  [t('admin.scheduled'), scheduled, ''],
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
                eyebrow={t('admin.adminScheduleEyebrow')}
                title={t('admin.masterCalendar')}
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
  const { t } = useI18n()
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-steel">
      <span aria-live="polite">{loading ? t('admin.loading') : t('admin.pageCounts', { count, total, page, lastPage })}</span>
      <div className="flex gap-2">
        <Button size="xs" variant="outline" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>{t('admin.previous')}</Button>
        <Button size="xs" variant="outline" disabled={loading || page >= lastPage} onClick={() => onPage(page + 1)}>{t('admin.next')}</Button>
      </div>
    </div>
  )
}

function UsersPanel() {
  const { users, usersTotal, currentUser, loadUsers } = useStore()
  const { t } = useI18n()
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
        eyebrow={t('admin.directoryEyebrow')}
        title={t('admin.directory')}
        right={
          <Button
            variant="accent"
            onClick={() => setShowManagerModal(true)}
            className="gap-1.5 shadow-xs"
          >
            <Plus size={14} strokeWidth={2.5} /> {t('admin.newManager')}
          </Button>
        }
      />

      {/* Governance Policy Rule Banner */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-edge bg-ice px-4 py-3 text-[13px] text-graphite">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 items-center rounded-sm bg-accent px-2 font-mono text-[10px] font-bold text-paper">
            {t('admin.governance')}
          </span>
          <span>
            <strong className="text-ink">{t('admin.managerProvisionRule')}</strong> {t('admin.studentSelfRegister')}
          </span>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-3" onSubmit={(event) => {
        event.preventDefault()
        setQuery((previous) => ({ ...previous, page: 1, search: q.trim() || undefined }))
      }}>
        <Select aria-label={t('admin.accountRole')} value={query.role ?? ''} onChange={(event) => {
          const role = (event.target.value || undefined) as Role | undefined
          setQuery((previous) => ({ ...previous, page: 1, role }))
        }} className="!w-auto font-mono">
          <option value="">{t('admin.allRoles')}</option>
          <option value="USER">{t('admin.students')}</option>
          <option value="MANAGER">{t('admin.managers')}</option>
          <option value="ADMIN">{t('admin.admins')}</option>
        </Select>
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-steel" />
          <Input aria-label={t('admin.accountSearch')} value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('admin.accountSearchPlaceholder')} className="pl-9" />
        </div>
        <Button type="submit" variant="outline">{t('admin.search')}</Button>
      </form>

      {/* Accounts Table */}
      <div className="overflow-x-auto rounded-lg border border-edge bg-paper">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={TH}>{t('admin.accountName')}</th>
              <th className={TH}>{t('admin.studentId')}</th>
              <th className={TH}>{t('admin.role')}</th>
              <th className={TH}>{t('admin.status')}</th>
              <th className={TH}>{t('admin.joined')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-steel">{t('admin.loadingAccounts')}</td></tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <EmptyState
                    title={t('admin.noMatchingAccounts')}
                    body={t('admin.accountsEmptyMessage')}
                  />
                  {query.role === 'MANAGER' && (
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => setShowManagerModal(true)}
                      className="mt-3 inline-flex gap-1.5"
                    >
                      <Plus size={14} /> {t('admin.firstManager')}
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
  const { t } = useI18n()
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
        notify(t('admin.managerCreated'))
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  const close = () => { if (!loading) onClose() }

  return (
    <Modal open onClose={close} title={t('admin.createManager')} eyebrow={t('admin.adminPrivilege')}>
      <form onSubmit={handleSubmit}>
        <fieldset disabled={loading} className="flex min-w-0 flex-col gap-4 p-6">
          <div className="rounded-md border border-edge bg-ice p-3 text-[13px] leading-[1.5] text-graphite">
            <span className="font-semibold text-ink">{t('admin.provisionPolicy')}</span> {t('admin.provisionPolicyBody')}
          </div>

          <Field label={t('admin.fullName')} hint={t('admin.required')}>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('admin.fullNameExample')}
              required
            />
          </Field>

          <Field label={t('admin.email')} hint={t('admin.staffDomain')}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="m.hoang@tne.edu.vn"
              required
            />
          </Field>

          <Field label={t('admin.initialPassword')} hint={t('admin.minPassword')}>
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
            {t('admin.generatePassword')}
          </button>

          {error && (
            <div role="alert" className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">
              {error}
            </div>
          )}
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            {t('admin.cancel')}
          </Button>
          <Button size="md" type="submit" disabled={loading}>
            {loading ? t('admin.provisioning') : t('admin.provisionManager')} <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function UserRow({ u, self }: { u: User; self: boolean }) {
  const { updateUserRole, setUserStatus, notify } = useStore()
  const { t, locale } = useI18n()
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
        notify(t('admin.roleUpdated'))
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
      else notify(status === 'SUSPENDED' ? t('admin.accountSuspended') : t('admin.accountActivated'))
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
                {u.fullName} {self && <Tag tone="accent">{t('admin.you')}</Tag>}
              </div>
              <div className="truncate text-[12px] text-steel">{u.email}</div>
            </div>
          </div>
        </td>

        <td className={cx(TD, 'font-mono text-[13px] font-semibold')}>
          {u.studentCode ? (
            <span className="text-meta">{u.studentCode}</span>
          ) : isManager ? (
            <span className="font-mono text-[11px] text-steel uppercase">{t('admin.staff')}</span>
          ) : (
            <span className="text-steel/60">—</span>
          )}
        </td>

        <td className={TD}>
          {isAdmin ? (
            <div className="flex items-center gap-1.5" title={t('admin.adminProtected')}>
              <Tag tone="ink">{t('admin.role_ADMIN')}</Tag>
              <Lock size={12} className="text-steel" />
            </div>
          ) : (
            <>
              <Select
                aria-label={t('admin.accountRole')}
                value={pendingRole ?? u.role}
                disabled={self || busy}
                onChange={(e) => change(e.target.value as Role)}
                className="!w-[130px] !py-1 font-mono !text-[12px]"
              >
                <option value="USER">{t('admin.role_USER')}</option>
                <option value="MANAGER">{t('admin.role_MANAGER')}</option>
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
            title={self ? t('admin.ownStatus') : u.status === 'ACTIVE' ? t('admin.suspend') : t('admin.reactivate')}
          >
            <span className={cx('h-1.5 w-1.5 rounded-sm', u.status === 'ACTIVE' ? 'bg-accent' : 'bg-plum')} />
            {t(`admin.accountStatus_${u.status}`)}
          </button>
        </td>

        <td className={cx(TD, 'font-mono text-[12px] text-steel')}>
          {fmtDate(u.createdAt, locale)}
        </td>
      </tr>

      {pendingRole && (
        <tr className="border-b border-rule bg-ice">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="text-[13px] text-graphite">
                {t('admin.studentRolePrompt', { name: u.fullName })}
              </div>
              <Input
                disabled={busy}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                aria-label={t('admin.studentId')}
                placeholder="SE000000"
                className="!w-[160px] font-mono"
                autoFocus
              />
              <Button
                size="sm"
                disabled={busy || !code.trim()}
                onClick={() => updateRole('USER', code)}
              >
                {t('admin.assignRole')} <ArrowRight size={14} />
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setPendingRole(null); setError(null) }}>
                {t('admin.cancel')}
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
  const { t } = useI18n()
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
        notify(status === 'INACTIVE' ? t('admin.roomArchived', { code: room.code }) : t('admin.roomStatusUpdated', { code: room.code }))
        setConfirmArchive(null)
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <section>
      <PanelHead
        eyebrow={t('admin.roomsEyebrow')}
        title={t('admin.rooms')}
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
            <Plus size={14} /> {t('admin.newRoom')}
          </Button>
        }
      />


      <div className="overflow-x-auto rounded-lg border border-edge bg-paper">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={TH}>{t('admin.code')}</th>
              <th className={TH}>{t('admin.nameLevel')}</th>
              <th className={TH}>{t('admin.capacityUpper')}</th>
              <th className={TH}>{t('admin.status')}</th>
              <th className={TH}>{t('admin.activeBookings')}</th>
              <th className={cx(TH, 'text-right')}>{t('admin.actions')}</th>
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
                      {t('admin.floorNumber', { number: r.floor })} · {r.features.join(' · ') || t('admin.noFeatures')}
                    </div>
                  </td>
                  <td className={cx(TD, 'font-mono text-[14px] font-semibold')}>{r.capacity}</td>
                  <td className={TD}>
                    <Select
                      value={r.status}
                      aria-label={t('admin.roomStatusFor', { code: r.code })}
                      disabled={updatingStatus}
                      onChange={(event) => {
                        const status = event.target.value as RoomStatus
                        if (status === 'INACTIVE') setConfirmArchive(r.id)
                        else void changeStatus(r, status)
                      }}
                      className="!w-[150px] !py-1 font-mono !text-[12px]"
                    >
                      <option value="AVAILABLE">{t('admin.roomStatus_AVAILABLE')}</option>
                      <option value="MAINTENANCE">{t('admin.roomStatus_MAINTENANCE')}</option>
                      <option value="INACTIVE">{t('admin.roomStatus_INACTIVE')}</option>
                    </Select>
                  </td>
                  <td className={TD}>
                    <Tag tone={act ? 'ink' : 'neutral'}>{String(act).padStart(2, '0')}</Tag>
                  </td>
                  <td className={cx(TD, 'text-right')}>
                    {confirmArchive === r.id && r.status !== 'INACTIVE' ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[12px] text-plum">{t('admin.archivePrompt', { code: r.code })}</span>
                        <Button
                          size="xs"
                          variant="plum"
                          disabled={updatingStatus}
                          onClick={() => changeStatus(r, 'INACTIVE')}
                        >
                          {t('admin.confirmArchive')}
                        </Button>
                        <Button size="xs" variant="ghost" disabled={updatingStatus} onClick={() => setConfirmArchive(null)}>
                          {t('admin.keep')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="xs" variant="outline" onClick={() => setEditing(r)}>
                          <Pencil size={12} /> {t('admin.edit')}
                        </Button>
                        {r.status !== 'INACTIVE' && (
                          <Button size="xs" variant="ghost" disabled={updatingStatus} onClick={() => setConfirmArchive(r.id)}>
                            <Archive size={13} /> {t('admin.archive')}
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
            <Tag tone={statusTone[s]}>{t(`admin.roomStatus_${s}`)}</Tag>
            {s === 'AVAILABLE' ? t('admin.roomOpen') : s === 'MAINTENANCE' ? t('admin.roomClosed') : t('admin.roomHidden')}
          </span>
        ))}
      </div>

      {editing && <RoomEditor room={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function RoomEditor({ room, onClose }: { room: Room; onClose: () => void }) {
  const { saveRoom, notify } = useStore()
  const { t } = useI18n()
  const [draft, setDraft] = useState(room)
  const [features, setFeatures] = useState(() => room.features.join(', '))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const up = (p: Partial<Room>) => setDraft((d) => ({ ...d, ...p }))
  const close = () => { if (!saving) onClose() }

  return (
    <Modal open onClose={close} title={room.id ? t('admin.editRoom', { code: room.code }) : t('admin.createRoom')} eyebrow={t('admin.roomRecord')}>
      <fieldset disabled={saving} className="grid grid-cols-2 gap-4 p-6">
        <Field label={t('admin.roomCode')} hint={t('admin.roomCodeHint')}>
          <Input
            value={draft.code}
            onChange={(e) => up({ code: e.target.value.replace(/\D/g, '').slice(0, 3) })}
            className="font-mono"
            placeholder="601"
          />
        </Field>
        <Field label={t('admin.floor')}>
          <Input
            type="number"
            value={draft.floor}
            onChange={(e) => up({ floor: Number(e.target.value) })}
            className="font-mono"
          />
        </Field>
        <Field label={t('admin.name')} className="col-span-2">
          <Input value={draft.name} onChange={(e) => up({ name: e.target.value })} placeholder={t('admin.roomNameExample')} />
        </Field>
        <Field label={t('admin.capacity')}>
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
          {t('admin.autoApprove')}
        </label>
        <Field label={t('admin.features')} hint={t('admin.commaSeparated')} className="col-span-2">
          <Input
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder={t('admin.featureExamples')}
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
          {t('admin.cancel')}
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
                notify(t('admin.roomSaved'))
                onClose()
              }
            } finally {
              setSaving(false)
            }
          }}
        >
          {t('admin.saveRoom')} <ArrowRight size={16} />
        </Button>
      </div>
    </Modal>
  )
}

/* ───────────── 04 · System Settings ───────────── */

function SettingsPanel() {
  const { settings, settingsLoaded, refreshSettings, updateSettings, notify } = useStore()
  const { t } = useI18n()
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
        eyebrow={t('admin.settingsEyebrow')}
        title={t('admin.settings')}
        right={settingsLoaded && (dirty ? <Tag tone="meta">{t('admin.unsaved')}</Tag> : <Tag tone="accent">{t('admin.inSync')}</Tag>)}
      />
      {!settingsLoaded && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-plum p-3 text-[13px]">
          <p role="alert">{t('admin.settingsUnavailable')}</p>
          <Button variant="outline" size="sm" disabled={retrying} onClick={async () => {
            setRetrying(true)
            try { await refreshSettings() } finally { setRetrying(false) }
          }}>
            {retrying ? t('admin.loading') : t('admin.retrySettings')}
          </Button>
        </div>
      )}
      <Reveal stagger className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <fieldset disabled={!settingsLoaded || saving} className="min-w-0 rounded-lg border border-edge bg-paper">
          <SettingGroup
            n="A"
            title={t('admin.localeHours')}
            body={t('admin.localeHoursBody')}
          >
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-semibold text-ink">{t('admin.campusTimezone')}</span>
              <span className="font-mono text-[13px] text-steel">{CAMPUS_TZ} (UTC+07:00)</span>
            </div>
            <Field label={t('admin.openingTime')}>
              <Select value={draft.openTime} onChange={(e) => up({ openTime: e.target.value })} className="font-mono">
                {hours.slice(0, 24).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.closingTime')}>
              <Select value={draft.closeTime} onChange={(e) => up({ closeTime: e.target.value })} className="font-mono">
                {hours.slice(1).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </Field>
          </SettingGroup>

          <SettingGroup n="B" title={t('admin.policy')} body={t('admin.policyBody')}>
            <Field label={t('admin.maxDuration')} hint={t('admin.minutes')}>
              <Input
                type="number"
                step={30}
                min={30}
                value={draft.maxDurationMinutes}
                onChange={num('maxDurationMinutes')}
                className="font-mono"
              />
            </Field>
            <Field label={t('admin.maxActive')} hint={t('admin.perUser')}>
              <Input
                type="number"
                min={1}
                value={draft.maxActiveBookings}
                onChange={num('maxActiveBookings')}
                className="font-mono"
              />
            </Field>
            <Field label={t('admin.maxAdvance')} hint={t('admin.days')}>
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
              {t('admin.discard')}
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
                  notify(t('admin.settingsSaved'))
                }
              } finally {
                setSaving(false)
              }
            }}>
              {t('admin.saveSettings')} <ArrowRight size={16} />
            </Button>
          </div>
        </fieldset>

        <aside className="flex flex-col gap-4 self-start rounded-lg bg-ice p-6">
          <Eyebrow>{t('admin.policyPreview')}</Eyebrow>
          <h3 className="font-display text-feature font-w450">
            <SplitText text={t('admin.studentPreview')} />
          </h3>
          <p className="text-[14px] leading-[1.5] text-graphite">
            {t('admin.policyDescription', { range: `${draft.openTime}–${draft.closeTime}`, advance: draft.maxAdvanceDays, duration: draft.maxDurationMinutes, active: draft.maxActiveBookings })}
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
                {i === 0 ? t('admin.todayShort') : `+${i}`}
              </div>
            ))}
          </div>
          <div className="font-mono text-[11px] text-steel">{t('admin.timezoneShort')} · {CAMPUS_TZ}</div>
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
  const { t, locale } = useI18n()
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
        eyebrow={t('admin.auditEyebrow')}
        title={t('admin.audit')}
        right={
          <Button variant="outline" onClick={exportJson} disabled={loading || audit.length === 0}>
            <Download size={14} /> {t('admin.exportJson')}
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault()
        setOpen(null)
        setQuery({ page: 1, action: action.trim() || undefined, targetType: targetType.trim() || undefined })
      }}>
        <Field label={t('admin.action')} hint={t('admin.exactMatch')}>
          <Input maxLength={100} placeholder={t('admin.actionExample')} value={action} onChange={(event) => setAction(event.target.value)} className="font-mono" />
        </Field>
        <Field label={t('admin.targetType')} hint={t('admin.exactMatch')}>
          <Input maxLength={100} placeholder={t('admin.targetExample')} value={targetType} onChange={(event) => setTargetType(event.target.value)} className="font-mono" />
        </Field>
        <Button type="submit" variant="outline">{t('admin.applyFilters')}</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-edge bg-paper">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={cx(TH, 'w-8')} />
              <th className={TH}>{t('admin.timestamp')}</th>
              <th className={TH}>{t('admin.logId')}</th>
              <th className={TH}>{t('admin.actor')}</th>
              <th className={TH}>{t('admin.actionUpper')}</th>
              <th className={TH}>{t('admin.entity')}</th>
              <th className={TH}>{t('admin.metadata')}</th>
            </tr>
          </thead>
          <tbody>
            {loading || audit.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-steel">{loading ? t('admin.auditLoading') : t('admin.auditEmpty')}</td></tr>
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
                    <td className={cx(TD, 'whitespace-nowrap text-ink')}>{fmtStamp(a.ts, locale)}</td>
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
                          <span>{t('admin.metadataSize', { count: new TextEncoder().encode(meta).length })}</span>
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
