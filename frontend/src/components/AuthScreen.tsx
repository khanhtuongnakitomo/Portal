import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button, Eyebrow, Field, Input, cx } from './ui'
import { LogoMark, homeFor, type Route } from './Shell'
import { BlurText, Reveal } from './effects'

const demo = [
  { role: 'USER', email: 'linh.nguyen@student.uts.edu.au', pw: 'student' },
  { role: 'MANAGER', email: 'd.tran@uts-tne.edu.vn', pw: 'manager' },
  { role: 'ADMIN', email: 'g.pham@uts-tne.edu.vn', pw: 'admin' },
]

export function AuthScreen({ go }: { go: (r: Route) => void }) {
  const { login, register, users } = useStore()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [form, setForm] = useState({ fullName: '', email: '', password: '', studentCode: '' })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err = mode === 'signin' ? login(form.email, form.password) : register(form)
    setError(err)
    if (!err) {
      const u = users.find((x) => x.email.toLowerCase() === form.email.trim().toLowerCase())
      go(homeFor(u?.role ?? 'USER'))
    }
  }

  const codeTaken = mode === 'register' && form.studentCode.length >= 8 && users.some((u) => u.studentCode === form.studentCode.trim().toUpperCase())

  return (
    <div className="relative flex min-h-[calc(100vh-40px)] items-center justify-center overflow-hidden px-6 py-16">
      <RailDiagram />
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2.5 bg-paper px-2">
            <LogoMark size={20} />
            <span className="font-mono text-[14px] font-semibold">[UTS-TNE LEDGER]</span>
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
                className={cx('rounded-md py-2 text-[14px] font-semibold transition-colors', mode === m ? 'text-ink shadow-subtle' : 'text-steel hover:text-ink')}
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
              <Input type="email" value={form.email} onChange={set('email')} placeholder="you@student.uts.edu.au" autoComplete="email" />
            </Field>
            <Field label="Password" hint={mode === 'register' ? 'min 6 chars' : undefined}>
              <Input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
            </Field>
            {mode === 'register' && (
              <Field label="Student ID · studentCode" hint="unique · required" error={codeTaken ? 'This Student ID is already registered.' : null}>
                <Input
                  value={form.studentCode}
                  onChange={(e) => setForm((f) => ({ ...f, studentCode: e.target.value.toUpperCase().slice(0, 8) }))}
                  placeholder="SE123456"
                  className="font-mono tracking-wider"
                />
              </Field>
            )}
            {error && <div className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error}</div>}
            <Button type="submit" size="md" className="mt-2 w-full" disabled={codeTaken}>
              {mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} />
            </Button>
            {mode === 'register' && (
              <p className="text-[12px] leading-[1.5] text-steel">
                New accounts are assigned the <span className="font-mono font-semibold text-ink">USER</span> role. Manager and admin access is provisioned by the system administrator.
              </p>
            )}
          </form>
          {mode === 'signin' && (
            <div className="border-t border-rule bg-ice px-6 py-4">
              <Eyebrow tone="steel" className="mb-2 !text-[11px]">DEMO ACCOUNTS — CLICK TO FILL</Eyebrow>
              <div className="flex flex-col">
                {demo.map((d) => (
                  <button
                    key={d.role}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, email: d.email, password: d.pw }))}
                    className="flex items-center justify-between gap-3 border-b border-dashed border-edge py-1.5 text-left last:border-0 hover:text-accent"
                  >
                    <span className="w-20 font-mono text-[11px] font-semibold text-meta">{d.role}</span>
                    <span className="flex-1 truncate text-[13px] font-medium">{d.email}</span>
                    <span className="font-mono text-[11px] text-steel">{d.pw}</span>
                  </button>
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
