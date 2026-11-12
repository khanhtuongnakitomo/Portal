import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, LogOut, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Role } from '@/lib/types'
import { Button, Eyebrow, Mono, cx } from './ui'
import { BlurText, ScrollRevealText, SplitText } from './effects'
import { UtsLogo } from './UtsLogo'
import { BrandLockup } from './BrandLockup'
import { ProfileMenu } from './ProfileMenu'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useI18n } from '@/lib/i18n'

export type Route = '/auth' | '/student' | '/manager' | '/admin' | '/profile'
export const homeFor = (role: Role): Route => (role === 'USER' ? '/student' : role === 'MANAGER' ? '/manager' : '/admin')
export const routeRole: Partial<Record<Route, Role>> = { '/student': 'USER', '/manager': 'MANAGER', '/admin': 'ADMIN' }

export function useHashRoute(): [Route, (r: Route) => void] {
  const read = () => {
    const h = window.location.hash.replace('#', '') as Route
    return (['/auth', '/student', '/manager', '/admin', '/profile'] as Route[]).includes(h) ? h : '/student'
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

export function RoleSwitcher({ go }: { go: (r: Route) => void }) {
  const { currentUser } = useStore()
  const { locale } = useI18n()
  if (!currentUser) return null
  const personal = locale === 'vi' ? 'Đặt phòng cá nhân' : 'Personal bookings'
  const manager = locale === 'vi' ? 'Quản lý phòng' : 'Manage rooms'
  return (
    <nav aria-label={locale === 'vi' ? 'Chế độ làm việc' : 'Workspace'} className="bg-forest text-paper">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-6 py-2">
        <span className="text-[12px]">{currentUser.email}</span>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-white/40 px-3 py-1 text-[12px] hover:bg-white/10" onClick={() => go('/student')}>{personal}</button>
          {currentUser.role !== 'USER' && <button className="rounded-md border border-white/40 px-3 py-1 text-[12px] hover:bg-white/10" onClick={() => go('/manager')}>{manager}</button>}
          {currentUser.role === 'ADMIN' && <button className="rounded-md border border-white/40 px-3 py-1 text-[12px] hover:bg-white/10" onClick={() => go('/admin')}>{locale === 'vi' ? 'Quản trị' : 'Administration'}</button>}
        </div>
      </div>
    </nav>
  )
}

export function TopNav({ children }: { children?: ReactNode }) {
  const { currentUser } = useStore()
  const { locale } = useI18n()
  if (!currentUser) return null

  const title =
    locale === 'vi'
      ? 'Hệ thống đặt phòng dành cho TNE - UTS'
      : 'Room Booking System for TNE - UTS'

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 shadow-nav backdrop-blur select-none">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 lg:gap-5 px-4 sm:px-6 select-none">
        <a href={`#${homeFor(currentUser.role)}`} className="shrink-0 focus:outline-none select-none flex items-center" title={title}>
          <BrandLockup size="md" />
        </a>
        <div className="hidden h-5 w-px bg-rule md:block shrink-0" />
        <nav className="hidden flex-1 items-center gap-1 md:flex select-none min-w-0 overflow-x-auto no-scrollbar">{children}</nav>
        <div className="ml-auto flex items-center gap-2.5 sm:gap-3 select-none shrink-0">
          <LanguageSwitcher />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}

export function NavItem({
  active,
  children,
  onClick,
  badge,
  icon,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  badge?: number | string
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group relative flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-[12.5px] font-medium transition-all cursor-pointer select-none whitespace-nowrap',
        active
          ? 'border border-ink bg-paper text-ink shadow-xs font-semibold'
          : 'border border-transparent text-graphite hover:border-rule hover:bg-paper/70 hover:text-ink',
      )}
    >
      {icon && (
        <span className={cx('transition-colors', active ? 'text-accent' : 'text-steel group-hover:text-ink')}>
          {icon}
        </span>
      )}
      {active && !icon && (
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      )}
      <span>{children}</span>
      {badge !== undefined && Number(badge) > 0 ? (
        <span className="rounded-sm bg-accent px-1.5 py-0.2 font-mono text-[10px] font-bold text-paper shadow-2xs">
          {badge}
        </span>
      ) : badge !== undefined && typeof badge === 'string' ? (
        <span className="font-mono text-[10.5px] text-steel">({badge})</span>
      ) : null}
    </button>
  )
}

export function PageHeader({ eyebrow, title, body, right }: { eyebrow: string; title: string; body?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-8 select-none page-header">
      <div className="flex max-w-[720px] flex-col gap-3">
        <Eyebrow className="select-none">
          <SplitText key={eyebrow} text={eyebrow} stagger={30} />
        </Eyebrow>
        <h1 className="font-display text-[34px] leading-[1.15] font-w450 text-ink md:text-major select-none">
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
  const { locale } = useI18n()
  const title =
    locale === 'vi'
      ? 'Hệ thống đặt phòng dành cho TNE - UTS'
      : 'Room Booking System for TNE - UTS'

  const cols = [
    {
      t: locale === 'vi' ? 'Phòng học' : 'Rooms',
      l: ['Seminar Hall 601', 'Studio Room 602', 'Lecture Theatre 605'],
    },
    {
      t: locale === 'vi' ? 'Quy định' : 'Policy',
      l: [
        locale === 'vi' ? 'Đặt trước 2–7 ngày' : 'Booking window 2–7 days',
        locale === 'vi' ? 'Nhận/trả chìa tại phòng Manager' : 'Key custody rules',
        locale === 'vi' ? 'Ưu tiên sự kiện học thuật' : 'Event priority',
      ],
    },
    {
      t: locale === 'vi' ? 'Hỗ trợ' : 'Support',
      l: ['Facilities desk · Level 1', 'it-support@uts-tne.edu.vn', 'Ext. 6021'],
    },
  ]
  return (
    <footer className="mt-16 bg-forest text-paper select-none">
      <div className="mx-auto max-w-[1440px] px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/20 pb-8">
          <div className="flex items-center gap-4">
            <UtsLogo variant="dark" className="h-10 w-auto" />
            <div>
              <div className="font-display text-[15px] font-bold text-paper tracking-tight">
                {title}
              </div>
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
            <div className="text-[14px] font-semibold">{locale === 'vi' ? 'Cơ sở' : 'Campus'}</div>
            <div className="text-[14px] font-normal text-white/75">Level 6, TNE Building · UTS × HCMUT</div>
            <div className="text-[14px] font-normal text-white/75">
              © {new Date().getFullYear()} {title}
            </div>
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
