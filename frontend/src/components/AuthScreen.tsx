import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button, Eyebrow, Field, Input, cx } from './ui'
import { useI18n } from '@/lib/i18n'
import { LanguageSwitcher } from './LanguageSwitcher'
import { BrandLockup } from './BrandLockup'
import { BlurText, Reveal } from './effects'

export function AuthScreen() {
  const { t } = useI18n()
  const { login, register, notify } = useStore()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [form, setForm] = useState({ fullName: '', email: '', password: '', hcmutId: '', utsId: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const error = mode === 'signin' ? await login(form.email, form.password) : await register({
        fullName: form.fullName, email: form.email, password: form.password,
        studentCode: `${form.hcmutId.trim()} / ${form.utsId.trim()}`,
      })
      if (error) {
        setError(error)
        notify(error, 'error')
      }
      setForm((current) => ({ ...current, password: '' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-40px)] items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute top-4 right-6 z-20"><LanguageSwitcher /></div>
      <RailDiagram />
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="rounded-md border border-rule/70 bg-paper px-5 py-3 shadow-subtle"><BrandLockup size="lg" /></div>
          <h1 className="bg-paper px-3 font-display text-[40px] leading-[1.1] font-w450 text-ink md:text-[52px]">
            <BlurText text={t('core.tagline')} shine />
          </h1>
        </div>

        <Reveal className="overflow-hidden rounded-lg border border-ink bg-paper">
          <div className="grid grid-cols-2 border-b border-rule p-1.5">
            {(['signin', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={loading}
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={cx(
                  'rounded-md py-2 text-[14px] font-semibold transition-colors',
                  mode === m ? 'text-ink shadow-subtle' : 'text-steel hover:text-ink',
                )}
              >
                {m === 'signin' ? t('auth.signInBtn') : t('core.registerStudent')}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 p-6">
            <Eyebrow>{mode === 'signin' ? t('auth.signInTitle') : t('auth.signUpTitle')}</Eyebrow>
            {mode === 'register' && (
              <Field label={t('auth.fullNameLabel')}>
                <Input required value={form.fullName} onChange={set('fullName')} placeholder="Nguyen Van An" autoComplete="name" />
              </Field>
            )}
            <Field label={t('core.email')}>
              <Input required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
            <Field label={t('auth.passwordLabel')} hint={mode === 'register' ? t('core.passwordHint') : undefined}>
              <Input
                required
                minLength={mode === 'register' ? 8 : undefined}
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </Field>
            {mode === 'register' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t('student.hcmutId')} hint={t('common.required')}>
                  <Input required pattern="[0-9]{7}" inputMode="numeric" maxLength={7} value={form.hcmutId} onChange={set('hcmutId')} />
                </Field>
                <Field label={t('student.utsId')} hint={t('common.required')}>
                  <Input required pattern="[0-9]{8}" inputMode="numeric" maxLength={8} value={form.utsId} onChange={set('utsId')} />
                </Field>
              </div>
            )}
            {error && <div role="alert" className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error}</div>}
            <Button type="submit" size="md" className="mt-2 w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-paper border-t-transparent" />
                  {mode === 'signin' ? t('core.signingIn') : t('core.creating')}
                </span>
              ) : (
                <>
                  {mode === 'signin' ? t('auth.signInBtn') : t('auth.signUpBtn')} <ArrowRight size={16} />
                </>
              )}
            </Button>
            {mode === 'register' && (
              <p className="text-[12px] leading-[1.5] text-steel">
                {t('core.rolePolicy')}
              </p>
            )}
          </form>
        </Reveal>
      </div>
    </div>
  )
}

/** Faint connector-path background evoking the payment-rail diagram */
function RailDiagram() {
  const { t } = useI18n()
  const labels = [
    { x: 8, y: 22, t: `${t('common.room')} 601` },
    { x: 80, y: 18, t: t('nav.keyCustody') },
    { x: 6, y: 74, t: t('nav.approvalBoard') },
    { x: 82, y: 78, t: `${t('common.room')} 605` },
    { x: 86, y: 48, t: `${t('common.room')} 602` },
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
