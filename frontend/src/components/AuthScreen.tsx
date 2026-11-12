import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button, Eyebrow, Field, Input, cx } from './ui'
import { LogoMark, homeFor, type Route } from './Shell'
import { BlurText, Reveal } from './effects'
import { UtsLogo } from './UtsLogo'
import { BrandLockup } from './BrandLockup'
import { LanguageSwitcher } from './LanguageSwitcher'

const demo = [
  { role: 'USER' as const, label: 'Student', email: 'student@tne.edu.vn', pw: 'Student123456!' },
  { role: 'MANAGER' as const, label: 'Facilities Manager', email: 'manager@tne.edu.vn', pw: 'Manager123456!' },
  { role: 'ADMIN' as const, label: 'System Admin', email: 'admin@tne.edu.vn', pw: 'Admin12345678!' },
]

export function AuthScreen({ go }: { go: (r: Route) => void }) {
  const { loginAsync, registerAsync } = useStore()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [form, setForm] = useState({ fullName: '', email: '', password: '', hcmutId: '', utsId: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        const res = await loginAsync(form.email, form.password)
        if (res.error) {
          setError(res.error)
        } else if (res.user) {
          go(homeFor(res.user.role))
        }
      } else {
        const res = await registerAsync({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          hcmutId: form.hcmutId,
          utsId: form.utsId,
          studentCode: form.hcmutId,
        })
        if (res.error) {
          setError(res.error)
        } else if (res.user) {
          go(homeFor(res.user.role))
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const quickSignIn = async (email: string, pw: string) => {
    setForm((f) => ({ ...f, email, password: pw }))
    setError(null)
    setLoading(true)
    try {
      const res = await loginAsync(email, pw)
      if (res.error) {
        setError(res.error)
      } else if (res.user) {
        go(homeFor(res.user.role))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-40px)] items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute top-4 right-6 z-20">
        <LanguageSwitcher />
      </div>
      <RailDiagram />
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center gap-2 bg-paper px-5 py-3 rounded-md border border-rule/70 shadow-subtle">
            <BrandLockup size="lg" />
          </div>
          <h1 className="bg-paper px-3 font-display text-[40px] leading-[1.1] font-w450 text-ink md:text-[52px]">
            <BlurText text="Rooms, keys, on the record." shine />
          </h1>
        </div>

        <Reveal className="overflow-hidden rounded-lg border border-ink bg-paper">
          <div className="grid grid-cols-2 border-b border-rule p-1.5">
            {(['signin', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={cx(
                  'rounded-md py-2 text-[14px] font-semibold transition-colors',
                  mode === m ? 'text-ink shadow-subtle' : 'text-steel hover:text-ink',
                )}
              >
                {m === 'signin' ? 'Sign in' : 'Register as student'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 p-6">
            <Eyebrow>{mode === 'signin' ? '01 / AUTHENTICATE' : '01 / NEW STUDENT ACCOUNT · ROLE=USER'}</Eyebrow>
            {mode === 'register' && (
              <Field label="Full name">
                <Input value={form.fullName} onChange={set('fullName')} placeholder="Nguyen Van An" autoComplete="name" />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set('email')} placeholder="student@tne.edu.vn" autoComplete="email" />
            </Field>
            <Field label="Password" hint={mode === 'register' ? '8+ chars · uppercase, lowercase, number' : undefined}>
              <Input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </Field>
            {mode === 'register' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="HCMUT Student ID" hint="required">
                  <Input
                    value={form.hcmutId}
                    onChange={(e) => setForm((f) => ({ ...f, hcmutId: e.target.value.toUpperCase().slice(0, 12) }))}
                    placeholder="e.g. 2110123"
                    className="font-mono tracking-wider"
                  />
                </Field>
                <Field label="UTS Student ID" hint="required">
                  <Input
                    value={form.utsId}
                    onChange={(e) => setForm((f) => ({ ...f, utsId: e.target.value.toUpperCase().slice(0, 12) }))}
                    placeholder="e.g. 14234567"
                    className="font-mono tracking-wider"
                  />
                </Field>
              </div>
            )}
            {error && <div className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error}</div>}
            <Button type="submit" size="md" className="mt-2 w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-paper border-t-transparent" />
                  {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} />
                </>
              )}
            </Button>
            {mode === 'register' && (
              <p className="text-[12px] leading-[1.5] text-steel">
                New accounts are assigned the <span className="font-mono font-semibold text-ink">USER</span> role. Manager and admin access is provisioned by the system administrator.
              </p>
            )}
          </form>
          {mode === 'signin' && (
            <div className="border-t border-rule bg-ice px-6 py-4">
              <div className="mb-2 flex items-center justify-between">
                <Eyebrow tone="steel" className="!text-[11px]">DEMO CREDENTIALS · 1-CLICK ACCESS</Eyebrow>
                <span className="font-mono text-[10px] text-steel">CLICK TO FILL OR SIGN IN</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {demo.map((d) => (
                  <div
                    key={d.role}
                    className="group flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge/60 bg-paper/80 px-3 py-2 text-left transition hover:border-accent hover:bg-paper"
                  >
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, email: d.email, password: d.pw }))}
                      className="flex flex-1 items-center gap-2.5 text-left"
                      title="Click to populate form"
                    >
                      <span className="w-16 font-mono text-[11px] font-semibold text-meta">{d.role}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-ink">{d.email}</div>
                        <div className="font-mono text-[11px] text-steel">{d.pw}</div>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={loading}
                      onClick={() => quickSignIn(d.email, d.pw)}
                      className="!rounded !px-2 !py-0.5 text-[11px]"
                    >
                      Quick Sign In <ArrowRight size={11} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Reveal>
      </div>
    </div>
  )
}

/** Faint connector-path background evoking the payment-rail diagram */
function RailDiagram() {
  const labels = [
    { x: 8, y: 22, t: 'ROOM 601' },
    { x: 80, y: 18, t: 'KEY DESK' },
    { x: 6, y: 74, t: 'APPROVAL' },
    { x: 82, y: 78, t: 'ROOM 603' },
    { x: 86, y: 48, t: 'ROOM 602' },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d="M14 24 H30 V50 H50" stroke="#0F62FE" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
        <path d="M86 20 H70 V50 H50" stroke="#E0E0E0" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
        <path d="M12 76 H34 V50" stroke="#E0E0E0" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
        <path d="M88 80 H66 V50" stroke="#0F62FE" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
        <path d="M90 50 H70" stroke="#0F62FE" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
      </svg>
      {labels.map((l) => (
        <div key={l.t} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-rule bg-ice px-2 py-1 font-mono text-[12px] font-semibold text-meta" style={{ left: `${l.x}%`, top: `${l.y}%` }}>
          {l.t}
        </div>
      ))}
    </div>
  )
}
