import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronRight, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { ACTIVE_STATUSES, useLookups, useStore } from '@/lib/store'
import type { Role, Room, RoomStatus, Settings, User } from '@/lib/types'
import { fmtStamp } from '@/lib/time'
import { uid } from '@/lib/seed'
import { Button, Eyebrow, Field, Input, Modal, Select, Tag, Toggle, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { Reveal, ScrollRevealText, SplitText } from '@/components/effects'

type Tab = 'rooms' | 'users' | 'settings' | 'audit'

export function AdminView() {
  const { rooms, users, audit } = useStore()
  const [tab, setTab] = useState<Tab>('rooms')
  const tabs: { id: Tab; n: string; label: string; count?: number }[] = [
    { id: 'rooms', n: '01', label: 'Rooms', count: rooms.length },
    { id: 'users', n: '02', label: 'Users & roles', count: users.length },
    { id: 'settings', n: '03', label: 'System settings' },
    { id: 'audit', n: '04', label: 'Audit logs', count: audit.length },
  ]
  return (
    <>
      <TopNav>
        {tabs.map((t) => (
          <NavItem key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </NavItem>
        ))}
      </TopNav>
      <main className="mx-auto max-w-[1440px] px-6 pt-10">
        <PageHeader eyebrow="SYSTEM CONTROL CENTER · ROLE=ADMIN" title="Administrative console" body="Configure rooms and booking policy, provision roles, and review every change recorded in the system ledger." />
        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-24 lg:flex-col lg:self-start">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cx(
                  'flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-[14px] font-semibold transition-colors',
                  tab === t.id ? 'bg-paper text-ink shadow-subtle' : 'text-graphite hover:bg-ice hover:text-ink',
                )}
              >
                <span className={cx('font-mono text-[12px] font-semibold', tab === t.id ? 'text-accent' : 'text-steel')}>{t.n}</span>
                <span className="flex-1">{t.label}</span>
                {t.count !== undefined && <span className="font-mono text-[11px] text-steel">{t.count}</span>}
              </button>
            ))}
            <div className="mt-6 hidden rounded-lg bg-ice p-4 lg:block">
              <Eyebrow className="!text-[12px]">LEDGER INTEGRITY</Eyebrow>
              <p className="mt-2 text-[13px] leading-[1.5] text-graphite">
                <ScrollRevealText text="Every mutation in this console is appended to the audit log with actor and metadata." />
              </p>
            </div>
          </nav>
          <Reveal key={tab} className="min-w-0">
            {tab === 'rooms' && <RoomsPanel />}
            {tab === 'users' && <UsersPanel />}
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

const TH = 'px-4 py-2 text-left font-mono text-[11px] font-semibold text-steel whitespace-nowrap'
const TD = 'px-4 py-3 align-middle'

/* ───────────── Rooms ───────────── */

const statusTone: Record<RoomStatus, 'accent' | 'meta' | 'neutral'> = { AVAILABLE: 'accent', MAINTENANCE: 'meta', INACTIVE: 'neutral' }

function RoomsPanel() {
  const { rooms, bookings, saveRoom, deleteRoom } = useStore()
  const [editing, setEditing] = useState<Room | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  return (
    <section>
      <PanelHead
        eyebrow="01 / ROOMS MANAGEMENT"
        title="Rooms"
        right={
          <Button onClick={() => setEditing({ id: uid('r'), code: '', name: '', floor: 6, capacity: 40, autoApprove: false, status: 'AVAILABLE', features: [] })}>
            <Plus size={14} /> New room
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-lg border border-edge">
        <table className="w-full min-w-[860px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={TH}>CODE</th>
              <th className={TH}>NAME</th>
              <th className={TH}>CAPACITY</th>
              <th className={TH}>AUTO-APPROVE</th>
              <th className={TH}>STATUS</th>
              <th className={TH}>ACTIVE BKGS</th>
              <th className={cx(TH, 'text-right')}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => {
              const act = bookings.filter((b) => b.roomId === r.id && ACTIVE_STATUSES.includes(b.status)).length
              return (
                <tr key={r.id} className="border-b border-rule last:border-0 hover:bg-ice/40">
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
                    <div className="flex items-center gap-2">
                      <Toggle checked={r.autoApprove} onChange={(v) => saveRoom({ ...r, autoApprove: v })} label={`Auto-approve ${r.code}`} />
                      <span className="font-mono text-[11px] text-steel">{r.autoApprove ? 'ON' : 'OFF'}</span>
                    </div>
                  </td>
                  <td className={TD}>
                    <Select value={r.status} onChange={(e) => saveRoom({ ...r, status: e.target.value as RoomStatus })} className="!w-[150px] !py-1 font-mono !text-[12px]">
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
                        <Button size="xs" variant="ghost" aria-label={`Delete room ${r.code}`} onClick={() => setConfirmDel(r.id)}>
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
      <RoomEditor room={editing} onClose={() => setEditing(null)} onSave={saveRoom} isNew={!!editing && !rooms.some((r) => r.id === editing.id)} />
    </section>
  )
}

function RoomEditor({ room, onClose, onSave, isNew }: { room: Room | null; onClose: () => void; onSave: (r: Room) => string | null; isNew: boolean }) {
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
        <Field label="Room code" hint="3 digits">
          <Input value={draft.code} onChange={(e) => up({ code: e.target.value.replace(/\D/g, '').slice(0, 3) })} className="font-mono" placeholder="604" />
        </Field>
        <Field label="Floor">
          <Input type="number" value={draft.floor} onChange={(e) => up({ floor: Number(e.target.value) })} className="font-mono" />
        </Field>
        <Field label="Name" className="col-span-2">
          <Input value={draft.name} onChange={(e) => up({ name: e.target.value })} placeholder="Seminar Hall 604" />
        </Field>
        <Field label="Capacity">
          <Input type="number" min={1} value={draft.capacity} onChange={(e) => up({ capacity: Number(e.target.value) })} className="font-mono" />
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => up({ status: e.target.value as RoomStatus })} className="font-mono">
            <option>AVAILABLE</option>
            <option>MAINTENANCE</option>
            <option>INACTIVE</option>
          </Select>
        </Field>
        <Field label="Features" hint="comma separated" className="col-span-2">
          <Input value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="Projector, Whiteboard" />
        </Field>
        <div className="col-span-2 flex items-center justify-between border border-rule bg-ice px-4 py-3">
          <div>
            <div className="text-[14px] font-semibold">Auto-approve bookings</div>
            <div className="text-[12px] text-graphite">Valid requests skip the manager queue and receive a pass instantly.</div>
          </div>
          <Toggle checked={draft.autoApprove} onChange={(v) => up({ autoApprove: v })} label="Auto-approve" />
        </div>
        {error && <div className="col-span-2 border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error}</div>}
      </div>
      <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="md"
          onClick={() => {
            const err = onSave({ ...draft, features: features.split(',').map((f) => f.trim()).filter(Boolean) })
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

/* ───────────── Users ───────────── */

function UsersPanel() {
  const { users, currentUser, toggleUserStatus } = useStore()
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const list = users.filter((u) => {
    const s = q.trim().toLowerCase()
    return (roleFilter === 'ALL' || u.role === roleFilter) && (!s || u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.studentCode?.toLowerCase().includes(s))
  })
  return (
    <section>
      <PanelHead
        eyebrow="02 / USER & ROLE MANAGEMENT"
        title="Users & roles"
        right={
          <div className="flex gap-1">
            {(['ALL', 'USER', 'MANAGER', 'ADMIN'] as const).map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)} className={cx('rounded-md px-2 py-1 font-mono text-[11px] font-semibold', roleFilter === r ? 'text-ink shadow-subtle' : 'text-steel hover:text-ink')}>
                {r} <span className="text-steel">{r === 'ALL' ? users.length : users.filter((u) => u.role === r).length}</span>
              </button>
            ))}
          </div>
        }
      />
      <div className="relative mb-4 max-w-[420px]">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-steel" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or student ID" className="pl-9" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-edge">
        <table className="w-full min-w-[880px] border-collapse">
          <thead className="border-b border-ink bg-ice">
            <tr>
              <th className={TH}>USER</th>
              <th className={TH}>STUDENT ID</th>
              <th className={TH}>ROLE</th>
              <th className={TH}>STATUS</th>
              <th className={TH}>JOINED</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <UserRow key={u.id} u={u} self={u.id === currentUser?.id} onToggle={() => toggleUserStatus(u.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
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

  return (
    <>
      <tr className={cx('border-b border-rule hover:bg-ice/40', u.status === 'SUSPENDED' && 'bg-plum/[0.03]', pendingRole && 'border-b-0')}>
        <td className={TD}>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-edge bg-ice font-mono text-[11px] font-semibold text-graphite">
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
        <td className={cx(TD, 'font-mono text-[13px] font-semibold', u.studentCode ? 'text-meta' : 'text-steel/60')}>{u.studentCode ?? '—'}</td>
        <td className={TD}>
          <Select value={pendingRole ?? u.role} disabled={self} onChange={(e) => change(e.target.value as Role)} className="!w-[130px] !py-1 font-mono !text-[12px]">
            <option>USER</option>
            <option>MANAGER</option>
            <option>ADMIN</option>
          </Select>
          {error && !pendingRole && <div className="mt-1 text-[11px] text-plum">{error}</div>}
        </td>
        <td className={TD}>
          <button
            disabled={self}
            onClick={onToggle}
            className={cx(
              'flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              u.status === 'ACTIVE' ? 'border-accent/50 bg-tint text-forest hover:border-accent' : 'border-plum/40 bg-plum/[0.07] text-plum hover:border-plum',
            )}
            title={self ? 'You cannot change your own status' : u.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account'}
          >
            <span className={cx('h-1.5 w-1.5', u.status === 'ACTIVE' ? 'bg-accent' : 'bg-plum')} />
            {u.status}
          </button>
        </td>
        <td className={cx(TD, 'font-mono text-[12px] text-steel')}>{fmtStamp(u.createdAt).slice(0, 10)}</td>
      </tr>
      {pendingRole && (
        <tr className="border-b border-rule bg-ice">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="text-[13px] text-graphite">
                Assigning <span className="font-mono font-semibold text-ink">USER</span> to {u.fullName} requires a unique Student ID.
              </div>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))} placeholder="SE000000" className="!w-[160px] font-mono" autoFocus />
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

/* ───────────── Settings ───────────── */

const TIMEZONES = ['Asia/Ho_Chi_Minh (UTC+07:00)', 'Asia/Singapore (UTC+08:00)', 'Australia/Sydney (UTC+10:00)', 'UTC (UTC+00:00)']

function SettingsPanel() {
  const { settings, updateSettings } = useStore()
  const [draft, setDraft] = useState<Settings>(settings)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setDraft(settings), [settings])
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const up = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }))
  const hours = Array.from({ length: 25 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => up({ [k]: Number(e.target.value) } as Partial<Settings>)

  return (
    <section>
      <PanelHead eyebrow="03 / GLOBAL CONFIGURATION" title="System settings" right={dirty ? <Tag tone="meta">UNSAVED CHANGES</Tag> : <Tag tone="accent">IN SYNC</Tag>} />
      <Reveal stagger className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-edge">
          <SettingGroup n="A" title="Locale & hours" body="Defines the bookable band shown on every room calendar.">
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
          <SettingGroup n="B" title="Booking policy" body="Limits enforced on every new student request.">
            <Field label="Max duration" hint="minutes">
              <Input type="number" step={30} min={30} value={draft.maxDurationMinutes} onChange={num('maxDurationMinutes')} className="font-mono" />
            </Field>
            <Field label="Max active bookings" hint="per user">
              <Input type="number" min={1} value={draft.maxActiveBookings} onChange={num('maxActiveBookings')} className="font-mono" />
            </Field>
            <Field label="Min advance" hint="days">
              <Input type="number" min={0} value={draft.minAdvanceDays} onChange={num('minAdvanceDays')} className="font-mono" />
            </Field>
            <Field label="Max advance" hint="days">
              <Input type="number" min={1} value={draft.maxAdvanceDays} onChange={num('maxAdvanceDays')} className="font-mono" />
            </Field>
          </SettingGroup>
          {error && <div className="mx-6 mb-4 border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error}</div>}
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
                className={cx('flex flex-1 items-center justify-center border-r border-rule font-mono text-[9px] last:border-0', i === 0 ? 'bg-ink text-paper' : i >= draft.minAdvanceDays && i <= draft.maxAdvanceDays ? 'bg-tint text-forest' : 'hatch text-steel')}
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

function SettingGroup({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
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

/* ───────────── Audit ───────────── */

function AuditPanel() {
  const { audit } = useStore()
  const { user } = useLookups()
  const [q, setQ] = useState('')
  const [action, setAction] = useState('ALL')
  const [open, setOpen] = useState<string | null>(null)
  const actions = useMemo(() => ['ALL', ...Array.from(new Set(audit.map((a) => a.action))).sort()], [audit])
  const list = audit.filter((a) => {
    const s = q.trim().toLowerCase()
    return (action === 'ALL' || a.action === action) && (!s || a.entity.toLowerCase().includes(s) || a.actorId.toLowerCase().includes(s) || JSON.stringify(a.metadata).toLowerCase().includes(s))
  })
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `audit-log-${fmtStamp(new Date()).slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const tone = (act: string) => (/REJECT|DELETE|SUSPEND|CANCEL/.test(act) ? 'plum' : /APPROVE|CREATE|REGISTER|RETURN/.test(act) ? 'accent' : /KEY/.test(act) ? 'ink' : 'neutral')

  return (
    <section>
      <PanelHead
        eyebrow="04 / IMMUTABLE LEDGER"
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entity, actor or metadata" className="pl-9 font-mono" />
        </div>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="!w-[220px] font-mono">
          {actions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-edge">
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
                  <tr onClick={() => setOpen(isOpen ? null : a.id)} className={cx('cursor-pointer border-b border-rule font-mono text-[12px] hover:bg-ice/50', isOpen && 'bg-ice/60')}>
                    <td className="pl-4 text-steel">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
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
                        <pre className="overflow-x-auto px-5 py-4 font-mono text-[12px] leading-[1.6] text-tint">{JSON.stringify({ id: a.id, ts: a.ts, actorId: a.actorId, action: a.action, entity: a.entity, metadata: a.metadata }, null, 2)}</pre>
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
