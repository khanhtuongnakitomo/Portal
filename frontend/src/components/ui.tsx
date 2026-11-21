import { useId, useLayoutEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n'
import { X } from 'lucide-react'
import type { BookingStatus } from '@/lib/types'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Eyebrow({ children, className, tone = 'meta' }: { children: ReactNode; className?: string; tone?: 'meta' | 'ink' | 'steel' | 'paper' | 'accent' }) {
  const color = { meta: 'text-meta', ink: 'text-ink', steel: 'text-steel', paper: 'text-white/75', accent: 'text-accent' }[tone]
  return <div className={cx('font-mono text-[14px] leading-[1.2] font-semibold', color, className)}>{children}</div>
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono font-semibold', className)}>{children}</span>
}

type Variant = 'dark' | 'outline' | 'tint' | 'ghost' | 'plum' | 'accent'

export function Button({
  variant = 'dark',
  size = 'sm',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'xs' | 'sm' | 'md' }) {
  const v = {
    dark: 'bg-ink text-paper border border-ink hover:bg-[#262626]',
    outline: 'bg-paper text-ink shadow-subtle hover:bg-ice',
    tint: 'bg-tint text-ink border border-tint hover:border-accent',
    ghost: 'bg-transparent text-ink hover:bg-ice',
    plum: 'bg-paper text-plum border border-plum/50 hover:bg-plum hover:text-paper hover:border-plum',
    accent: 'bg-accent text-paper border border-accent hover:bg-[#0043ce]',
  }[variant]
  const s = { xs: 'px-2 py-1 text-[12px]', sm: 'px-3 py-1.5 text-[14px]', md: 'px-4 py-2 text-[16px]' }[size]
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-sm font-semibold leading-[1.5] whitespace-nowrap transition-colors cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[inherit]',
        v,
        s,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

const fieldBase =
  'w-full rounded-md border border-edge bg-paper px-3 py-2 text-[14px] font-medium text-ink placeholder:text-steel placeholder:font-normal outline-none transition-shadow focus:border-ink focus:shadow-subtle disabled:bg-ice disabled:text-steel'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldBase, className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, 'resize-none', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        fieldBase,
        'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 stroke=%27%23151515%27 fill=%27none%27 stroke-width=%271.4%27/%3E%3C/svg%3E")] bg-[right_12px_center] bg-no-repeat pr-8',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Field({ label, hint, action, error, children, className }: { label: string; hint?: ReactNode; action?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="flex items-center gap-2">
          {hint && <span className="font-mono text-[11px] font-semibold text-steel">{hint}</span>}
          {action}
        </span>
      </span>
      {children}
      {error && <span className="text-[12px] font-semibold text-plum">{error}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-md border transition-colors', checked ? 'border-accent bg-accent' : 'border-edge bg-paper')}
    >
      <span className={cx('absolute h-3.5 w-3.5 rounded-sm transition-all', checked ? 'left-[18px] bg-paper' : 'left-[2px] bg-edge')} />
    </button>
  )
}

const statusStyle: Record<BookingStatus, string> = {
  PENDING: 'bg-paper text-ink border-ink border-dashed',
  APPROVED: 'bg-tint text-ink-blue border-accent',
  KEY_CHECKED_OUT: 'bg-accent text-paper border-accent',
  COMPLETED: 'bg-ice text-ink border-edge',
  REJECTED: 'bg-plum/[0.1] text-plum border-plum',
  CANCELLED: 'bg-paper text-graphite border-edge line-through decoration-graphite/60',
}

export function StatusChip({ status, className }: { status: BookingStatus; className?: string }) {
  const { t } = useI18n()
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-[2px] font-mono text-[11px] font-bold leading-[1.4] tracking-[0.02em] whitespace-nowrap', statusStyle[status], className)}>
      <span className={cx('h-1.5 w-1.5', status === 'KEY_CHECKED_OUT' ? 'bg-tint' : 'bg-current')} />
      {t(status === 'KEY_CHECKED_OUT' ? 'core.keyOut' : `common.${status.toLowerCase()}`)}
    </span>
  )
}

export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'plum' | 'meta' | 'ink'; className?: string }) {
  const t = {
    neutral: 'border-edge text-ink bg-paper',
    accent: 'border-accent text-ink-blue bg-tint',
    plum: 'border-plum/40 text-plum bg-plum/[0.07]',
    meta: 'border-meta text-meta bg-paper',
    ink: 'border-ink bg-ink text-paper',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-sm border px-1.5 py-[2px] font-mono text-[11px] font-bold leading-[1.4] whitespace-nowrap', t, className)}>{children}</span>
}

export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const opener = document.activeElement
    // Native modal dialogs place the rest of the document in an inert state.
    dialog.showModal()
    return () => {
      dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={cx('fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-h-[calc(100dvh_-_2rem)] overflow-auto rounded-lg border border-ink bg-paper p-0 text-ink shadow-nav backdrop:bg-ink/50 backdrop:backdrop-blur-xs', className)}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const dialog = event.currentTarget
        const stops = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]',
        )).filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length && getComputedStyle(el).visibility === 'visible')
        const first = stops[0]
        const last = stops[stops.length - 1]
        const active = document.activeElement
        if (!first || !last) {
          event.preventDefault()
        } else if (!stops.some((el) => el === active) || (event.shiftKey ? active === first : active === last)) {
          event.preventDefault()
          const next = event.shiftKey ? last : first
          next.focus()
        }
      }}
    >
      {children}
    </dialog>,
    document.body,
  )
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 'max-w-[560px]',
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
  className?: string
}) {
  const { t } = useI18n()
  const titleId = useId()
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} className={cx(width, 'open:flex flex-col overflow-hidden', className)}>
      <div className="flex items-start justify-between border-b border-rule px-6 pt-5 pb-4">
        <div className="flex flex-col gap-2">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 id={titleId} className="font-display text-feature font-w450 text-ink">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="-mr-2 rounded-md p-1.5 text-steel hover:bg-ice hover:text-ink">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && <div className="shrink-0 border-t border-rule bg-paper px-5 py-3.5 sm:px-6">{footer}</div>}
    </Dialog>
  )
}

/** Ledger key/value row */
export function LedgerRow({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-rule py-2 last:border-b-0">
      <span className="font-mono text-[12px] font-semibold uppercase text-steel">{k}</span>
      <span className={cx('text-right text-[14px] text-ink', mono ? 'font-mono font-semibold' : 'font-semibold')}>{v}</span>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="hatch flex flex-col items-center justify-center gap-1 border border-dashed border-edge px-6 py-10 text-center">
      <div className="bg-paper px-2 font-mono text-[12px] font-semibold text-steel">{title}</div>
      {body && <div className="bg-paper px-2 text-[13px] text-steel">{body}</div>}
    </div>
  )
}
