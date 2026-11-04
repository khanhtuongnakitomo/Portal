import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from './ui'

/**
 * ShinyText / BlurText-inspired heading treatment (after React Bits).
 * Text resolves from a soft blur, then a slow Rich Black → UTS Blue sheen sweeps across.
 * Pure CSS (see `.shiny-text` in index.css); reduced-motion falls back to solid ink.
 */
export function ShinyText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('shiny-text', className)}>{children}</span>
}

/**
 * App-wide backdrop. Layering: white canvas → aurora → graph-paper grid → UI.
 * CSS-only animation on transforms; never intercepts pointer events.
 */
export function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-paper">
      <div className="aurora-layer">
        <span className="aurora-blob aurora-blob--a" />
        <span className="aurora-blob aurora-blob--b" />
        <span className="aurora-blob aurora-blob--c" />
      </div>
      <div className="graph-grid absolute inset-0" />
    </div>
  )
}

function useFinePointerMotion() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEnabled(fine.matches && !reduce.matches)
    update()
    fine.addEventListener('change', update)
    reduce.addEventListener('change', update)
    return () => {
      fine.removeEventListener('change', update)
      reduce.removeEventListener('change', update)
    }
  }, [])
  return enabled
}

/**
 * Blob / Splash cursor-inspired feedback (after React Bits), tuned to be barely-there.
 * Two soft UTS Blue blobs trail the pointer at different rates for a liquid feel; a thin
 * ripple ring marks presses inside `[data-cursor-zone]` areas (calendar, room tabs).
 * All updates go straight to the DOM via refs + rAF, so React never re-renders on move.
 * Disabled for touch / coarse pointers and prefers-reduced-motion.
 */
export function CursorField() {
  const enabled = useFinePointerMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)
  const ringsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    const root = rootRef.current!
    const core = coreRef.current!
    const halo = haloRef.current!
    const rings = Array.from(ringsRef.current!.children) as HTMLElement[]
    let ringIdx = 0
    let raf = 0
    let idle = 0
    const target = { x: -200, y: -200 }
    const c = { x: -200, y: -200 }
    const h = { x: -200, y: -200 }
    let zoneScale = 1
    let zoneCur = 1

    const tick = () => {
      c.x += (target.x - c.x) * 0.3
      c.y += (target.y - c.y) * 0.3
      h.x += (target.x - h.x) * 0.1
      h.y += (target.y - h.y) * 0.1
      zoneCur += (zoneScale - zoneCur) * 0.12
      const vx = target.x - h.x
      const vy = target.y - h.y
      const speed = Math.min(Math.hypot(vx, vy) / 120, 0.35)
      const angle = Math.atan2(vy, vx)
      core.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) translate(-50%, -50%) scale(${zoneCur})`
      halo.style.transform = `translate3d(${h.x}px, ${h.y}px, 0) translate(-50%, -50%) rotate(${angle}rad) scale(${(1 + speed) * zoneCur}, ${(1 - speed * 0.5) * zoneCur})`
      const settled = Math.abs(target.x - h.x) < 0.3 && Math.abs(target.y - h.y) < 0.3 && Math.abs(zoneScale - zoneCur) < 0.005
      raf = settled ? 0 : requestAnimationFrame(tick)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (c.x < -100) {
        // first move: jump into place instead of sliding in from the corner
        c.x = h.x = e.clientX
        c.y = h.y = e.clientY
      }
      target.x = e.clientX
      target.y = e.clientY
      const inZone = !!(e.target as Element | null)?.closest?.('[data-cursor-zone]')
      zoneScale = inZone ? 1.35 : 1
      root.style.opacity = '1'
      window.clearTimeout(idle)
      idle = window.setTimeout(() => (root.style.opacity = '0'), 1600)
      kick()
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (!(e.target as Element | null)?.closest?.('[data-cursor-zone]')) return
      const ring = rings[ringIdx++ % rings.length]
      ring.style.left = `${e.clientX}px`
      ring.style.top = `${e.clientY}px`
      ring.getAnimations().forEach((a) => a.cancel())
      ring.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0.55 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
        ],
        { duration: 650, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
      )
    }
    const onLeave = () => (root.style.opacity = '0')

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(idle)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none fixed inset-0 z-[55] overflow-hidden opacity-0 transition-opacity duration-500">
      <div ref={haloRef} className="cursor-halo absolute top-0 left-0" />
      <div ref={coreRef} className="cursor-core absolute top-0 left-0" />
      <div ref={ringsRef}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="cursor-ring absolute opacity-0" />
        ))}
      </div>
    </div>
  )
}

/* ─────────────── Text entrance & scroll reveal (React Bits-inspired) ─────────────── */

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// One shared IntersectionObserver for every reveal on the page.
const onceCallbacks = new WeakMap<Element, () => void>()
let sharedObserver: IntersectionObserver | null = null
function observeOnce(el: Element, cb: () => void) {
  if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
    cb()
    return () => {}
  }
  sharedObserver ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        onceCallbacks.get(e.target)?.()
        onceCallbacks.delete(e.target)
        sharedObserver!.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  )
  onceCallbacks.set(el, cb)
  sharedObserver.observe(el)
  return () => {
    onceCallbacks.delete(el)
    sharedObserver?.unobserve(el)
  }
}

/** Adds `is-visible` to the element the first time it enters the viewport (no React re-render). */
function useRevealOnce<T extends Element>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return observeOnce(el, () => el.classList.add('is-visible'))
  }, [])
  return ref
}

const splitWords = (text: string) => text.split(/\s+/).filter(Boolean)

/**
 * BlurText — word-by-word blur/drift entrance on load (UTS Blue → ink).
 * With `shine`, hands off to the ShinyText sheen once the last word lands, so the two never overlap.
 */
export function BlurText({ text, shine = false, stagger = 65, duration = 600, className }: { text: string; shine?: boolean; stagger?: number; duration?: number; className?: string }) {
  const [done, setDone] = useState(false)
  const words = splitWords(text)
  if (done && shine) return <ShinyText className={className}>{text}</ShinyText>
  return (
    <span className={cx('blur-text', className)} aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span
            aria-hidden
            className="blur-word"
            style={{ animationDelay: `${i * stagger}ms`, animationDuration: `${duration}ms` }}
            onAnimationEnd={i === words.length - 1 ? () => setDone(true) : undefined}
          >
            {w}
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  )
}

/** SplitText — section headings rise word-by-word when scrolled into view. */
export function SplitText({ text, stagger = 45, className }: { text: string; stagger?: number; className?: string }) {
  const ref = useRevealOnce<HTMLSpanElement>()
  const words = splitWords(text)
  return (
    <span ref={ref} className={cx('split-text', className)} aria-label={text} style={{ '--stagger': `${stagger}ms` } as CSSProperties}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span aria-hidden className="split-word" style={{ '--i': i } as CSSProperties}>
            {w}
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  )
}

type RevealTag = 'div' | 'section' | 'aside'
/**
 * Animated Content — fades up (with a light blur) once when entering the viewport.
 * `stagger` reveals direct children in sequence (~80ms apart) instead of the container as one block.
 */
export function Reveal({ as = 'div', stagger = false, className, children, id }: { as?: RevealTag; stagger?: boolean; className?: string; children: ReactNode; id?: string }) {
  const ref = useRevealOnce<HTMLElement>()
  const Tag = as as 'div'
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} id={id} className={cx(stagger ? 'reveal-stagger' : 'reveal', className)}>
      {children}
    </Tag>
  )
}

/**
 * Scroll Reveal — words brighten and sharpen progressively as the text scrolls up the viewport.
 * Progress is written to a CSS variable from a rAF-throttled scroll listener that is only attached
 * while the text is near the viewport, and released once fully revealed.
 */
export function ScrollRevealText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const words = splitWords(text)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.style.setProperty('--p', '1')
      return
    }
    let raf = 0
    let listening = false
    const update = () => {
      raf = 0
      const vh = window.innerHeight
      const top = el.getBoundingClientRect().top
      // 0 when the text enters at the bottom, 1 once it has risen ~30% of the viewport
      const p = Math.min(1, Math.max(0, (vh - top) / (vh * 0.3)))
      el.style.setProperty('--p', p.toFixed(3))
      if (p >= 1) stop()
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const start = () => {
      if (listening) return
      listening = true
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
      update()
    }
    const stop = () => {
      listening = false
      window.removeEventListener('scroll', onScroll, { capture: true })
      io.disconnect()
    }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : null), { rootMargin: '0px 0px 10% 0px' })
    io.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      stop()
    }
  }, [])
  return (
    <span ref={ref} className={cx('scroll-reveal', className)} aria-label={text} style={{ '--n': words.length } as CSSProperties}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span aria-hidden className="sr-word" style={{ '--i': i } as CSSProperties}>
            {w}
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </span>
  )
}
