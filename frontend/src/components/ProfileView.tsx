import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Check,
  GraduationCap,
  Lock,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Eyebrow, Field, Input, Tag } from './ui'
import { NavItem, PageHeader, TopNav, homeFor, type Route } from './Shell'
import { UtsLogo } from './UtsLogo'

export function ProfileView({ go }: { go: (r: Route) => void }) {
  const { currentUser, updateProfile, notify, logout, settings, settingsLoaded } = useStore()
  const { t } = useI18n()
  const [fullName, setFullName] = useState(currentUser?.fullName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  if (!currentUser) return null
  const { hcmutId, utsId } = currentUser

  const isStudent = currentUser.role === 'USER'

  // Generate 2-letter initials
  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(-2)
      .join('')
      .toUpperCase() || 'U'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const err = await updateProfile({ fullName })
      if (err) {
        setError(err)
        notify(err, 'error')
      } else {
        setFullName(fullName.trim())
        setSuccess(true)
        notify(t('core.profileSaved'))
      }
    } finally {
      setSaving(false)
    }
  }

  const backRoute = homeFor(currentUser.role)
  const workspaceName = t(`core.workspace_${currentUser.role}`)

  return (
    <>
      {/* Top Navigation */}
      <TopNav>
        <NavItem onClick={() => go(backRoute)}>
          <span className="flex items-center gap-1.5 font-mono text-[13px]">
            <ArrowLeft size={14} /> {t('common.back')} {workspaceName}
          </span>
        </NavItem>
        <NavItem active>
          <span className="font-mono text-[13px]">{t('nav.profile')}</span>
        </NavItem>
      </TopNav>

      {/* Main Container */}
      <main className="mx-auto max-w-[1440px] px-6 py-10">
        {/* Navigation Breadcrumb & Back action */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => go(backRoute)}
            className="group inline-flex items-center gap-2 rounded-sm border border-rule bg-paper px-3 py-1.5 font-mono text-[12px] font-semibold text-ink shadow-xs transition-colors hover:border-ink hover:bg-ice cursor-pointer"
          >
            <ArrowLeft size={14} className="text-steel transition-transform group-hover:-translate-x-0.5 group-hover:text-ink" />
            <span>{t('common.back')} {workspaceName.toUpperCase()}</span>
          </button>

          <div className="flex items-center gap-2 font-mono text-[11px] text-steel">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>{t('core.authenticated')} · {currentUser.email}</span>
          </div>
        </div>

        {/* Page Header */}
        <PageHeader
          eyebrow={t('profile.eyebrow')}
          title={t('profile.title')}
          body={t('profile.body')}
        />

        {/* Content Grid */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Column: Edit Profile Form (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Card 1: Official Identity & Credentials */}
              <div className="rounded-md border border-rule bg-paper shadow-xs overflow-hidden">
                <div className="border-b border-rule bg-ice/50 px-6 py-4 flex items-center justify-between">
                  <div>
                    <Eyebrow className="!text-[10px]">{t('profile.officialIdentity')}</Eyebrow>
                    <h2 className="text-[16px] font-semibold text-ink font-display mt-0.5">
                      {t('profile.cardSubtitle')}
                    </h2>
                  </div>
                  <Tag tone="accent">{t('core.authenticated')}</Tag>
                </div>

                <div className="p-6 flex flex-col gap-5">
                  {/* Alert Messages */}
                  {error && (
                    <div className="rounded-md border border-plum/30 bg-plum/[0.06] p-3.5 text-[12.5px] text-plum font-mono flex items-start gap-2.5">
                      <span className="font-bold shrink-0">[!]</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3.5 text-[12.5px] text-emerald-800 font-mono flex items-start gap-2.5">
                      <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{t('core.profileSaved')}</span>
                    </div>
                  )}

                  {/* Full Name */}
                  <Field label={t('profile.fullNameLabel')} hint={t('profile.fullNameHint')}>
                    <Input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value)
                        setError(null)
                        setSuccess(false)
                      }}
                      required minLength={2} maxLength={120} disabled={saving}
                      className="text-[14px]"
                    />
                  </Field>

                  {/* Institutional Email (Read-only) */}
                  <Field label={t('profile.emailLabel')} hint={t('core.readOnly')}>
                    <div className="relative">
                      <Input
                        type="email"
                        value={currentUser.email}
                        disabled
                        className="bg-ice font-mono text-[13px] text-steel cursor-not-allowed pl-9"
                      />
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
                    </div>
                    <span className="font-mono text-[11px] text-steel mt-1 block">
                      {t('core.emailNote')}
                    </span>
                  </Field>

                  {/* University Student IDs Section */}
                  {isStudent ? (
                    <div className="rounded-md border border-rule bg-ice/40 p-4.5 flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-rule/70 pb-2">
                        <span className="flex items-center gap-2 font-mono text-[11px] font-bold text-ink uppercase tracking-wider">
                          <GraduationCap size={15} className="text-accent" />
                          <span>{t('profile.identifiersTitle')}</span>
                        </span>
                      </div>
                      <p className="text-[12px] text-graphite">{t('core.readOnlyIds')}</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label={t('student.hcmutId')}><Input readOnly value={hcmutId || '—'} /></Field>
                        <Field label={t('student.utsId')}><Input readOnly value={utsId || '—'} /></Field>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-rule bg-ice/40 p-4">
                      <div className="font-mono text-[11px] font-bold text-steel uppercase mb-1">
                        {t('profile.staffIdLabel')}
                      </div>
                      <div className="font-mono text-[13px] font-bold text-ink">
                        {currentUser.id}
                      </div>
                      <span className="font-mono text-[10.5px] text-steel mt-1 block">
                        {t('profile.staffIdSub')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="border-t border-rule bg-ice/30 px-6 py-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => go(backRoute)}
                    className="rounded-sm border border-edge bg-paper px-4 py-2 font-mono text-[12px] font-bold text-graphite hover:border-ink hover:text-ink transition-colors cursor-pointer"
                  >
                    {t('profile.cancelBtn')}
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-sm bg-accent hover:bg-[#0043CE] px-5 py-2 font-mono text-[12.5px] font-bold text-paper transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save size={14} />
                    <span>{saving ? t('profile.savingBtn') : t('profile.saveBtn')}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Card 2: Facility Booking Guidelines & Responsibilities */}
            <div className="rounded-md border border-rule bg-paper p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <Eyebrow className="!text-[10px]">{t('profile.policyTitle')}</Eyebrow>
                <span className="font-mono text-[11px] text-steel">POL-FAC-2026</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-md border border-rule bg-ice/40 p-3.5">
                  <div className="font-mono text-[10px] text-steel uppercase">{t('profile.maxSlotTitle')}</div>
                  <div className="font-mono text-[15px] font-bold text-ink mt-0.5">{settingsLoaded ? t('core.minutes', { n: settings.maxDurationMinutes }) : '—'}</div>
                  <div className="text-[11px] text-graphite mt-1">{t('profile.maxSlotSub')}</div>
                </div>

                <div className="rounded-md border border-rule bg-ice/40 p-3.5">
                  <div className="font-mono text-[10px] text-steel uppercase">{t('profile.advanceTitle')}</div>
                  <div className="font-mono text-[15px] font-bold text-ink mt-0.5">{settingsLoaded ? t('core.days', { n: settings.maxAdvanceDays }) : '—'}</div>
                  <div className="text-[11px] text-graphite mt-1">{t('core.advanceNote')}</div>
                </div>

                <div className="rounded-md border border-rule bg-ice/40 p-3.5">
                  <div className="font-mono text-[10px] text-steel uppercase">{t('profile.custodyTitle')}</div>
                  <div className="font-mono text-[14px] font-bold text-accent mt-0.5">{t('profile.custodyVal')}</div>
                  <div className="text-[11px] text-graphite mt-1">{t('profile.custodySub')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Institutional Identity Card Preview (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Digital Identity Pass / Card Preview */}
            <div className="rounded-lg border-2 border-ink bg-paper p-6 shadow-card flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-rule pb-4">
                <UtsLogo variant="light" className="h-7 w-auto" />
                <span className="rounded-sm bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-bold text-accent border border-accent/20">
                  {t('profile.credentialTitle')}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-accent text-paper font-mono text-[18px] font-bold shadow-xs">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-bold text-ink font-display">{fullName}</div>
                  <div className="font-mono text-[11px] text-steel truncate">{currentUser.email}</div>
                  <div className="mt-1">
                    <span className="inline-block rounded-sm bg-ink px-2 py-0.5 font-mono text-[9px] font-bold text-paper">
                      {t(`core.${currentUser.role}`)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ID Details */}
              <div className="grid grid-cols-2 gap-2 border-t border-b border-rule py-3">
                <div className="rounded-md border border-rule bg-ice/60 p-2.5">
                  <div className="font-mono text-[9px] font-bold text-steel uppercase">{t('student.hcmutId')}</div>
                  <div className="font-mono text-[14px] font-bold text-ink mt-0.5">
                    {hcmutId || '—'}
                  </div>
                </div>
                <div className="rounded-md border border-rule bg-ice/60 p-2.5">
                  <div className="font-mono text-[9px] font-bold text-steel uppercase">{t('student.utsId')}</div>
                  <div className="font-mono text-[14px] font-bold text-accent mt-0.5">
                    {utsId || '—'}
                  </div>
                </div>
              </div>

              {/* Verification Stamp */}
              <div className="flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>{t('core.authenticated')}</span>
                </div>
                <span className="text-steel">{t(`core.${currentUser.role}`)}</span>
              </div>
            </div>

            {/* Quick Navigation Card */}
            <div className="rounded-md border border-rule bg-paper p-5 shadow-xs flex flex-col gap-3">
              <div className="font-mono text-[11px] font-bold text-steel uppercase tracking-wider">
                {t('profile.quickNav')}
              </div>

              <button
                type="button"
                onClick={() => go(backRoute)}
                className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-[12.5px] font-medium text-ink hover:bg-ice transition-colors cursor-pointer"
              >
                <span>{t('profile.returnWorkspace')} {workspaceName}</span>
                <ArrowLeft size={14} className="rotate-180 text-steel" />
              </button>

              <button
                type="button"
                onClick={() => {
                  logout()
                  go('/auth')
                }}
                className="flex items-center justify-between rounded-md border border-plum/30 px-3 py-2 text-[12.5px] font-medium text-plum hover:bg-plum/10 transition-colors cursor-pointer"
              >
                <span>{t('profile.signOut')}</span>
                <span className="font-mono text-[10px] text-plum/70">{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
