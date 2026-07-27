import React, { useEffect, useState, useCallback } from 'react'
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
  // below it; centered on screen if there's no target (intro/outro cards).
  const tooltipStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: Math.min(rect.top, window.innerHeight - 220),
        left: rect.left + rect.width + 16 < window.innerWidth - 340 ? rect.left + rect.width + 16 : Math.max(16, rect.left),
        zIndex: 10001
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10001 }

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
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          style={tooltipStyle}
          className="w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-modal p-4"
        >
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{title}</p>
            <button onClick={close} aria-label={t('tour.skip')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{body}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{t('tour.stepOf', { current: currentIndex + 1, total: steps.length })}</p>
            <div className="flex items-center gap-2">
              {currentIndex > 0 && (
                <Button variant="ghost" size="sm" onClick={back} icon={<ArrowLeft size={14} />}>{t('tour.back')}</Button>
              )}
              <Button variant="primary" size="sm" onClick={next} icon={!isLast ? <ArrowRight size={14} /> : undefined} iconPosition="right">
                {isLast ? t('tour.finish') : t('tour.next')}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
