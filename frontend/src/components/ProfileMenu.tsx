import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Edit3, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { cx } from './ui'

export function ProfileMenu() {
  const { currentUser, logout } = useStore()
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  if (!currentUser) return null

  // Generate 2-letter initials
  const initials = currentUser.fullName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase() || 'U'

  const hcmutId = currentUser.hcmutId || currentUser.studentCode || '2110123'
  const utsId = currentUser.utsId || '14234567'

  return (
    <div className="relative" ref={menuRef}>
      {/* Interactive Profile Button Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cx(
          'flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-all text-left group select-none cursor-pointer',
          open
            ? 'border border-ink bg-ice shadow-xs'
            : 'border border-rule/70 bg-paper hover:border-ink hover:bg-ice/50',
        )}
      >
        {/* User Avatar Circle */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-ink text-paper font-mono text-[12px] font-bold tracking-tight">
          {initials}
        </div>

        {/* User Name & Role */}
        <div className="hidden sm:flex flex-col min-w-0 pr-1">
          <span className="truncate text-[13px] font-semibold leading-tight text-ink group-hover:text-accent transition-colors">
            {currentUser.fullName}
          </span>
          <span className="text-[10px] font-mono leading-tight text-steel">
            {currentUser.role === 'USER'
              ? (locale === 'vi' ? 'Sinh viên' : 'Student')
              : currentUser.role === 'MANAGER'
                ? (locale === 'vi' ? 'Quản lý cơ sở' : 'Facilities Manager')
                : (locale === 'vi' ? 'Quản trị viên' : 'System Admin')}
          </span>
        </div>

        {/* Dropdown Chevron */}
        <ChevronDown
          size={14}
          className={cx(
            'text-steel transition-transform duration-150',
            open ? 'rotate-180 text-ink' : 'group-hover:text-ink',
          )}
        />
      </button>

      {/* Dropdown Popover Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-lg border border-ink bg-paper shadow-nav animate-in fade-in-50 zoom-in-95 duration-100 overflow-hidden">
          {/* Menu Header with User Identity */}
          <div className="border-b border-rule bg-ice/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-paper font-mono text-[14px] font-bold shadow-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-ink">{currentUser.fullName}</div>
                <div className="truncate text-[11px] text-steel font-mono">{currentUser.email}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="rounded-sm bg-ink px-1.5 py-0.2 font-mono text-[9px] font-bold text-paper">
                    {currentUser.role === 'USER'
                      ? 'STUDENT'
                      : currentUser.role === 'MANAGER'
                        ? 'FACILITIES MANAGER'
                        : 'SYSTEM ADMIN'}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Student Identification Cards (Hạ xuống đây thay vì để ngoài Navbar) */}
          <div className="p-3.5 border-b border-rule bg-paper">
            <div className="font-mono text-[10px] font-bold text-steel uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Institutional Credentials</span>
              <span className="text-[9px] text-graphite font-normal">Verified</span>
            </div>

            {currentUser.role === 'USER' ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-rule bg-ice/40 p-2">
                  <div className="font-mono text-[9px] font-semibold text-steel">HCMUT ID</div>
                  <div className="font-mono text-[13px] font-bold text-ink mt-0.5">{hcmutId}</div>
                </div>
                <div className="rounded-md border border-rule bg-ice/40 p-2">
                  <div className="font-mono text-[9px] font-semibold text-steel">UTS ID</div>
                  <div className="font-mono text-[13px] font-bold text-accent mt-0.5">{utsId}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-rule bg-ice/40 p-2">
                <div className="font-mono text-[9px] font-semibold text-steel">STAFF IDENTIFIER</div>
                <div className="font-mono text-[13px] font-bold text-ink mt-0.5">
                  STAFF-{currentUser.id.slice(2).toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* Action List */}
          <div className="p-2 flex flex-col gap-1 bg-paper">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                window.location.hash = '/profile'
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-medium text-ink hover:bg-ice transition-colors text-left cursor-pointer"
            >
              <UserIcon size={14} className="text-accent" />
              <span>{t('nav.profile')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                logout()
                window.location.hash = '/auth'
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-medium text-plum hover:bg-plum/10 transition-colors text-left cursor-pointer"
            >
              <LogOut size={14} />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
