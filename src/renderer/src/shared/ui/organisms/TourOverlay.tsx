import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
import { useTourStore } from '@shared/tour/tour.store'
import { Button } from '@shared/ui/atoms/Button'

// Phase 60 — Interactive Onboarding Tutorial. Deliberately non-blocking: this
// draws a highlight ring around the real target element and a nearby
// tooltip, but never intercepts clicks on the underlying page (the
// highlight box below is `pointer-events-none`). The user interacts with
// the genuine, fully-functional screen underneath — filling in real forms,
// clicking real buttons — completely unassisted and un-gated by this
// overlay. See PHASE_60_TUTORIAL_MASTER_PROMPT.md Section 1 for why this is
// self-paced rather than auto-validated.

interface Rect { top: number; left: number; width: number; height: number }

function measureTarget(selector: string | null): Rect | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function TourOverlay() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isOpen, steps, currentIndex, next, back, close } = useTourStore()
  const [rect, setRect] = useState<Rect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  // Starting guess only — body text length varies a lot step to step (some
  // are one-liners, others walk through a whole multi-part flow), so a fixed
  // height assumption here previously pushed the Next button off-screen for
  // the longer steps. Corrected to the tooltip's real size right after it
  // renders, below.
  const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 220 })

  const step = steps[currentIndex]

  const reposition = useCallback(() => {
    if (!step) return
    setRect(measureTarget(step.targetSelector))
  }, [step])

  // Navigate to the step's route first, then measure the target once the
  // new screen has had a moment to render. A short retry loop (rather than
  // a fixed delay) handles screens whose target element mounts slightly
  // after route change without guessing a magic timeout.
  useEffect(() => {
    if (!isOpen || !step) return

    if (step.route && location.pathname !== step.route) {
      navigate(step.route)
      return // the location-change effect run below will re-fire this effect
    }

    let attempts = 0
    let cancelled = false
    const tryMeasure = () => {
      if (cancelled) return
      const r = measureTarget(step.targetSelector)
      if (r || attempts > 20) { setRect(r); return }
      attempts += 1
      requestAnimationFrame(tryMeasure)
    }
    tryMeasure()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, location.pathname])

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [isOpen, reposition])

  // Runs synchronously before paint, so a mismatch between the guessed size
  // above and the tooltip's real rendered size (e.g. a long body wrapping to
  // many lines) is corrected before the user ever sees it.
  useLayoutEffect(() => {
    const el = tooltipRef.current
    if (!isOpen || !el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      setTooltipSize(prev => (prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isOpen, step?.id, rect])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  if (!isOpen || !step) return null

  const isLast = currentIndex === steps.length - 1
  const title = step.titleLiteral || (step.titleKey ? t(step.titleKey) : '')
  const body = t(step.bodyKey, step.bodyParams)

  // Tooltip position: to the right of the target if there's room, else
  // clamped to the target's own left edge; centered on screen if there's no
  // target (intro/outro cards). Clamped against tooltipSize (the tooltip's
  // real measured width/height, see the ResizeObserver above) rather than a
  // fixed guess, so it can never render partly off-screen regardless of how
  // long a given step's body text is.
  const margin = 16
  const { width: tw, height: th } = tooltipSize
  const maxTop = Math.max(margin, window.innerHeight - th - margin)
  const maxLeft = Math.max(margin, window.innerWidth - tw - margin)
  const rightOfTarget = rect ? rect.left + rect.width + margin : 0
  // No-target (centered) case doesn't set position/top/left here — framer-
  // motion manages the `transform` CSS property itself for its x/y/scale
  // animation props, so a manually-set `transform: translate(-50%,-50%)`
  // in this same style object would silently get overwritten by it. Centering
  // is done with a flex wrapper below instead, which needs no transform.
  const tooltipStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: Math.min(Math.max(margin, rect.top), maxTop),
        left: rightOfTarget + tw <= window.innerWidth - margin ? rightOfTarget : Math.min(Math.max(margin, rect.left), maxLeft),
        zIndex: 10001
      }
    : {}

  return (
    <div aria-live="polite">
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 10,
            boxShadow: '0 0 0 4px rgba(0,174,239,0.9), 0 0 0 9999px rgba(15,23,42,0.55)',
            pointerEvents: 'none',
            zIndex: 10000,
            transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease'
          }}
        />
      )}
      {!rect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999 }} />
      )}

      <AnimatePresence mode="wait">
        {rect ? (
          <motion.div
            key={step.id}
            ref={tooltipRef}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={tooltipStyle}
            className="w-80 max-h-[calc(100vh-32px)] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-modal p-4"
          >
            <TourCardContent
              title={title} body={body} close={close} t={t} currentIndex={currentIndex} stepsLength={steps.length}
              isLast={isLast} back={back} next={next}
            />
          </motion.div>
        ) : (
          // No real target for this step (a centered intro/outro card) —
          // flex-centered in a dedicated wrapper rather than via a manual
          // `transform: translate(-50%,-50%)` on the motion.div itself,
          // which framer-motion's own x/y-driven `transform` would silently
          // overwrite.
          <div key={step.id} style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              style={{ pointerEvents: 'auto' }}
              className="w-80 max-h-[calc(100vh-32px)] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-modal p-4"
            >
              <TourCardContent
                title={title} body={body} close={close} t={t} currentIndex={currentIndex} stepsLength={steps.length}
                isLast={isLast} back={back} next={next}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TourCardContent({ title, body, close, t, currentIndex, stepsLength, isLast, back, next }: {
  title: string
  body: string
  close: () => void
  t: (key: string, params?: Record<string, unknown>) => string
  currentIndex: number
  stepsLength: number
  isLast: boolean
  back: () => void
  next: () => void
}) {
  return (
    <>
      {/* Only the title+body scroll internally on a very short window —
          the Next/Back footer below stays put so it's always reachable,
          regardless of how long a given step's body text is. */}
      <div className="overflow-y-auto min-h-0">
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{title}</p>
          <button onClick={close} aria-label={t('tour.skip')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{body}</p>
      </div>
      <div className="flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-400">{t('tour.stepOf', { current: currentIndex + 1, total: stepsLength })}</p>
        <div className="flex items-center gap-2">
          {currentIndex > 0 && (
            <Button variant="ghost" size="sm" onClick={back} icon={<ArrowLeft size={14} />}>{t('tour.back')}</Button>
          )}
          <Button variant="primary" size="sm" onClick={next} icon={!isLast ? <ArrowRight size={14} /> : undefined} iconPosition="right">
            {isLast ? t('tour.finish') : t('tour.next')}
          </Button>
        </div>
      </div>
    </>
  )
}
