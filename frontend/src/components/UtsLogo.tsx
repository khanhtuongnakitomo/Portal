import { cx } from './ui'

interface UtsLogoProps {
  /** 'light' for light backgrounds (dark text/colors), 'dark' for dark backgrounds (reversed white) */
  variant?: 'light' | 'dark'
  className?: string
  alt?: string
}

export function UtsLogo({
  variant = 'light',
  className = 'h-8 w-auto',
  alt = 'UTS - HCMUT TNE Rooms Booking',
}: UtsLogoProps) {
  const base = import.meta.env.BASE_URL || '/'
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  const fileName =
    variant === 'dark'
      ? 'UTS_HCMUT_Vertical_Logo_Lockup_White.png'
      : 'UTS_HCMUT_Vertical_Logo_Lockup.png'
  const src = `${cleanBase}${fileName}`

  return (
    <img
      src={src}
      alt={alt}
      className={cx('object-contain select-none shrink-0', className)}
      loading="eager"
      decoding="async"
    />
  )
}
