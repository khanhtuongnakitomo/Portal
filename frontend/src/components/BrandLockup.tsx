import { cx } from './ui'
import { UtsLogo } from './UtsLogo'

export interface BrandLockupProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  showSubline?: boolean
  className?: string
  badgeText?: string
}

export function BrandLockup({
  variant = 'light',
  size = 'md',
  showSubline = true,
  className,
  badgeText = 'PORTAL',
}: BrandLockupProps) {
  const isDark = variant === 'dark'

  const logoHeight =
    size === 'sm' ? 'h-7 max-h-7' : size === 'lg' ? 'h-11 max-h-11' : 'h-8 max-h-8'

  const titleSize =
    size === 'sm' ? 'text-[13px]' : size === 'lg' ? 'text-[17px]' : 'text-[14px]'

  const roomsSize =
    size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-[15px]' : 'text-[13px]'

  const sublineSize =
    size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-[11px]' : 'text-[9.5px]'

  return (
    <div className={cx('flex items-center gap-2.5 sm:gap-3 select-none group shrink-0 whitespace-nowrap', className)}>
      {/* Official UTS × HCMUT Vertical Lockup Logo */}
      <UtsLogo
        variant={variant}
        className={cx(
          logoHeight,
          'w-auto shrink-0 object-contain transition-transform duration-200 group-hover:scale-[1.02]',
        )}
      />

      {/* Distinctive Two-Tier Brand Typographic Identity */}
      <div className="flex flex-col justify-center shrink-0 whitespace-nowrap">
        {/* Tier 1: Main Brand & System Function */}
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <div className="flex items-center gap-1.5 leading-none shrink-0 whitespace-nowrap">
            {/* TNE (Transnational Education) */}
            <span
              className={cx(
                'font-display font-black tracking-tight transition-colors whitespace-nowrap',
                titleSize,
                isDark ? 'text-paper group-hover:text-tint' : 'text-ink group-hover:text-accent',
              )}
            >
              TNE
            </span>

            {/* Geometric Hairline Separator */}
            <span
              className={cx(
                'h-3.5 w-px transition-colors shrink-0',
                isDark ? 'bg-white/20 group-hover:bg-tint/40' : 'bg-rule group-hover:bg-accent/40',
              )}
            />

            {/* ROOMS BOOKING in UTS Academic Blue */}
            <span
              className={cx(
                'font-mono font-bold tracking-tight whitespace-nowrap',
                roomsSize,
                isDark ? 'text-tint' : 'text-accent',
              )}
            >
              ROOMS BOOKING
            </span>
          </div>

          {/* Micro Status Badge */}
          {badgeText && (
            <span
              className={cx(
                'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors shrink-0 whitespace-nowrap',
                isDark
                  ? 'border-white/20 bg-white/10 text-white/90 group-hover:border-tint group-hover:text-tint'
                  : 'border-rule/80 bg-ice/70 text-graphite group-hover:border-accent/40 group-hover:text-accent',
              )}
            >
              <span
                className={cx(
                  'h-1.5 w-1.5 rounded-full animate-pulse shrink-0',
                  isDark ? 'bg-tint' : 'bg-accent',
                )}
              />
              <span>{badgeText}</span>
            </span>
          )}
        </div>

        {/* Tier 2: Academic Subtitle / Level 6 Indicator */}
        {showSubline && (
          <div
            className={cx(
              'font-mono font-medium tracking-wider uppercase mt-0.5 flex items-center gap-1.5 leading-tight shrink-0 whitespace-nowrap',
              sublineSize,
              isDark ? 'text-white/60' : 'text-steel',
            )}
          >
            <span className="whitespace-nowrap">UTS</span>
            <span className={isDark ? 'text-white/30' : 'text-rule'}>×</span>
            <span className="whitespace-nowrap">HCMUT</span>
            <span className={isDark ? 'text-white/30' : 'text-rule'}>·</span>
            <span className={cx('font-semibold whitespace-nowrap', isDark ? 'text-white/80' : 'text-graphite')}>
              LEVEL 6
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
