import { Globe } from 'lucide-react'
import { useI18n, type Locale } from '@/lib/i18n'
import { cx } from './ui'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <div
      className={cx(
        'flex items-center gap-1 rounded-md border border-rule/80 bg-paper px-1 py-0.5 shadow-xs select-none',
        className,
      )}
      title="Switch Language / Chọn ngôn ngữ"
    >
      <Globe size={13} className="text-steel ml-1 shrink-0" />
      <div className="flex items-center font-mono text-[11px] select-none">
        <button
          type="button"
          onClick={() => setLocale('vi')}
          className={cx(
            'rounded-sm px-2 py-0.5 font-bold transition-all cursor-pointer select-none',
            locale === 'vi'
              ? 'bg-accent text-paper shadow-xs'
              : 'text-steel hover:text-ink hover:bg-ice/60',
          )}
          aria-label="Tiếng Việt"
        >
          VI
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={cx(
            'rounded-sm px-2 py-0.5 font-bold transition-all cursor-pointer select-none',
            locale === 'en'
              ? 'bg-accent text-paper shadow-xs'
              : 'text-steel hover:text-ink hover:bg-ice/60',
          )}
          aria-label="English"
        >
          EN
        </button>
      </div>
    </div>
  )
}
