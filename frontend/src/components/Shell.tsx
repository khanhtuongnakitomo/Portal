import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, LogOut, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Role } from '@/lib/types'
import { Button, Eyebrow, Mono, cx } from './ui'
import { BlurText, ScrollRevealText, SplitText } from './effects'

export type Route = '/auth' | '/student' | '/manager' | '/admin'
export const homeFor = (role: Role): Route => (role === 'USER' ? '/student' : role === 'MANAGER' ? '/manager' : '/admin')
export const routeRole: Record<Exclude<Route, '/auth'>, Role> = { '/student': 'USER', '/manager': 'MANAGER', '/admin': 'ADMIN' }

export function useHashRoute(): [Route, (r: Route) => void] {
  const read = () => {
    const h = window.location.hash.replace('#', '') as Route
    return (['/auth', '/student', '/manager', '/admin'] as Route[]).includes(h) ? h : '/student'
  }
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [route, (r) => (window.location.hash = r)]
}

export function LogoMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" className={className} aria-hidden>
      <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="currentColor" />
      <rect x="4" y="4" width="4" height="4" fill="#0F62FE" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" />
      <path d="M8 6h4v4" fill="none" stroke="#0F62FE" strokeWidth="1" />
    </svg>
  )
}

const roles: { role: Role | null; label: string; who: string }[] = [
  { role: 'USER', label: 'USER', who: 'Student · SE184022' },
  { role: 'MANAGER', label: 'MANAGER', who: 'Facilities · Duc Tran' },
  { role: 'ADMIN', label: 'ADMIN', who: 'System · Giang Pham' },
  { role: null, label: 'SIGNED OUT', who: 'Auth screen' },
]

export function RoleSwitcher({ go }: { go: (r: Route) => void }) {
  const { currentUser, previewAs, logout, apiConnected } = useStore()
  return (
    <div className="bg-forest text-paper">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2">
        <div className="flex items-center gap-2.5 font-mono text-[12px] text-white/75">
          <span className={cx('h-2 w-2 rounded-full', apiConnected ? 'bg-tint animate-pulse' : 'bg-steel')} />
          <span>{apiConnected ? 'API LIVE SYNC' : 'HYBRID STORAGE'} · ROLE PREVIEW</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {roles.map((r) => {
            const active = r.role ? currentUser?.role === r.role : !currentUser
            return (
              <button
                key={r.label}
                onClick={() => {
                  if (r.role) {
                    previewAs(r.role)
                    go(homeFor(r.role))
                  } else {
                    logout()
                    go('/auth')
                  }
                }}
                className={cx(
                  'group flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[12px] font-semibold transition-colors',
                  active ? 'border-tint bg-tint text-ink' : 'border-white/20 text-white/80 hover:border-white/50 hover:text-paper',
                )}
              >
                {active && <Check size={12} strokeWidth={2.5} />}
                {r.label}
                <span className={cx('hidden font-sans text-[11px] font-normal lg:inline', active ? 'text-ink/60' : 'text-white/75')}>{r.who}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TopNav({ children }: { children?: ReactNode }) {
  const { currentUser, logout } = useStore()
  if (!currentUser) return null
  const idCode = currentUser.studentCode && currentUser.role === 'USER' ? currentUser.studentCode : `STAFF-${currentUser.id.slice(2).toUpperCase()}`
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 shadow-nav backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-6">
        <a href={`#${homeFor(currentUser.role)}`} className="flex items-center gap-2.5 text-ink">
          <LogoMark />
          <span className="font-mono text-[14px] font-semibold tracking-tight">[UTS-TNE LEDGER]</span>
        </a>
        <div className="hidden h-5 w-px bg-rule md:block" />
        <nav className="hidden flex-1 items-center gap-1 md:flex">{children}</nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[13px] font-medium leading-tight text-ink">{currentUser.fullName}</div>
            <div className="text-[11px] leading-tight text-steel">{currentUser.role === 'USER' ? 'Student' : currentUser.role === 'MANAGER' ? 'Facilities Manager' : 'System Administrator'}</div>
          </div>
          <span className="rounded-md px-2 py-1 font-mono text-[13px] font-semibold text-ink shadow-subtle">{idCode}</span>
          <Button
            variant="outline"
            onClick={() => {
              logout()
              window.location.hash = '/auth'
            }}
            className="!rounded-md !px-2 !py-1"
            aria-label="Log out"
          >
            <LogOut size={14} strokeWidth={1.75} />
            <span className="hidden text-[13px] lg:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function NavItem({ active, children, onClick, badge }: { active?: boolean; children: ReactNode; onClick?: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[14px] font-semibold transition-colors',
        active ? 'text-ink shadow-subtle' : 'text-graphite hover:bg-ice hover:text-ink',
      )}
    >
      {active && <span className="h-1.5 w-1.5 bg-accent" />}
      {children}
      {badge ? <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper">{badge}</span> : null}
    </button>
  )
}

export function PageHeader({ eyebrow, title, body, right }: { eyebrow: string; title: string; body?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-8">
      <div className="flex max-w-[720px] flex-col gap-3">
        <Eyebrow>
          <SplitText key={eyebrow} text={eyebrow} stagger={30} />
        </Eyebrow>
        <h1 className="font-display text-[34px] leading-[1.15] font-w450 text-ink md:text-major">
          <BlurText key={title} text={title} shine />
        </h1>
        {body && (
          <p className="max-w-[600px] text-[16px] leading-6 font-normal text-graphite">
            <ScrollRevealText key={body} text={body} />
          </p>
        )}
      </div>
      {right}
    </div>
  )
}

export function AccessDenied({ need, go }: { need: Role; go: (r: Route) => void }) {
  const { currentUser } = useStore()
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-[520px] rounded-lg border border-ink bg-paper p-8">
        <div className="mb-6 flex items-center gap-3 text-plum">
          <ShieldAlert size={20} strokeWidth={1.5} />
          <Eyebrow className="!text-plum">HTTP 403 · ROUTE GUARD</Eyebrow>
        </div>
        <h1 className="font-display text-section font-w450 text-ink">This console requires the {need} role.</h1>
        <p className="mt-3 text-[16px] leading-6 font-normal text-graphite">
          You are signed in as <Mono className="text-ink">{currentUser?.role}</Mono>. Role-based routing keeps each workspace isolated.
        </p>
        {currentUser && (
          <Button size="md" className="mt-8" onClick={() => go(homeFor(currentUser.role))}>
            Go to my workspace <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  )
}

export function Footer() {
  const cols = [
    { t: 'Rooms', l: ['Seminar Hall 601', 'Studio Room 602', 'Lecture Theatre 605'] },
    { t: 'Policy', l: ['Booking window 2–7 days', 'Key custody rules', 'Event priority'] },
    { t: 'Support', l: ['Facilities desk · Level 1', 'it-support@uts-tne.edu.vn', 'Ext. 6021'] },
  ]
  return (
    <footer className="mt-16 bg-forest text-paper">
      <div className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/20 pb-8">
          <div className="flex items-center gap-3">
            <LogoMark size={22} className="text-paper" />
            <div>
              <div className="font-mono text-[14px] font-semibold">[UTS-TNE LEDGER]</div>
              <div className="text-[14px] font-normal text-white/75">Room booking & key custody for UTS Transnational Education.</div>
            </div>
          </div>
          <div className="font-mono text-[12px] text-white/75">BUILD 2.4.1 · NODE AP-SE-1 · ALL SYSTEMS NOMINAL</div>
        </div>
        <div className="grid grid-cols-2 gap-8 pt-8 md:grid-cols-4">
          {cols.map((c) => (
            <div key={c.t} className="flex flex-col gap-2">
              <div className="text-[14px] font-semibold">{c.t}</div>
              {c.l.map((x) => (
                <div key={x} className="text-[14px] font-normal text-white/75">
                  {x}
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <div className="text-[14px] font-semibold">Campus</div>
            <div className="text-[14px] font-normal text-white/75">Level 6, TNE Building</div>
            <div className="text-[14px] font-normal text-white/75">© {new Date().getFullYear()} UTS-TNE</div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex items-center gap-3 rounded-md border px-3 py-2.5 text-[14px] font-medium shadow-nav',
            t.tone === 'ok' ? 'border-ink bg-ink text-paper' : 'border-plum bg-paper text-plum',
          )}
        >
          {t.tone === 'ok' ? <span className="h-2 w-2 bg-tint" /> : <TriangleAlert size={14} />}
          {t.message}
        </div>
      ))}
    </div>
  )
}
