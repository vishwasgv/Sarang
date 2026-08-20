import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Hammer, ShoppingBag, UtensilsCrossed, Gem, CalendarClock, Briefcase, Wrench, X } from 'lucide-react'
import { useIndustryStore } from '@app/store/industry.store'
import { api } from '@renderer/services/ipc-client'

// Phase 67 §9.1 — General: "Which template fits you?" wizard. A GENERAL
// business that's genuinely been using a specific vertical's own pattern of
// data (carton-pack products, jewellery pricing fields, appointments, etc.)
// for at least a week gets a one-time, dismissible nudge toward the
// template that actually fits — never forced, never repeated once
// dismissed. Only ever computed/shown for GENERAL businesses; every other
// business type already picked (or been suggested and dismissed) a
// template.
type SuggestionType = 'HARDWARE' | 'JEWELLERY' | 'RENTAL' | 'RESTAURANT' | 'REPAIR' | 'SERVICE' | 'RETAIL'
interface TemplateSuggestion { businessType: SuggestionType; matchedCount: number; signalKey: string }

const ICON_BY_TYPE: Record<SuggestionType, React.ReactNode> = {
  HARDWARE: <Hammer size={18} />,
  RETAIL: <ShoppingBag size={18} />,
  RESTAURANT: <UtensilsCrossed size={18} />,
  JEWELLERY: <Gem size={18} />,
  RENTAL: <CalendarClock size={18} />,
  SERVICE: <Briefcase size={18} />,
  REPAIR: <Wrench size={18} />
}

export function TemplateSuggestionBanner(): React.ReactElement | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { businessType } = useIndustryStore()
  const [suggestion, setSuggestion] = useState<TemplateSuggestion | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (businessType !== 'GENERAL') { setLoaded(true); return }
    let cancelled = false
    Promise.all([api.templateSuggestion.get(), api.templateSuggestion.isDismissed()]).then(([sugRes, dismissRes]) => {
      if (cancelled) return
      if (sugRes?.success) setSuggestion(sugRes.data as TemplateSuggestion | null)
      if (dismissRes?.success) setDismissed(!!dismissRes.data)
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { cancelled = true }
  }, [businessType])

  if (businessType !== 'GENERAL' || !loaded || dismissed || !suggestion) return null

  async function handleDismiss() {
    setDismissed(true)
    await api.templateSuggestion.dismiss().catch(() => {})
  }

  return (
    <div className="bg-brand/5 border border-brand/20 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
            {ICON_BY_TYPE[suggestion.businessType]}
          </div>
          <div>
            <p className="text-sm font-bold text-brand mb-1">{t('dashboard.templateSuggestion.title')}</p>
            <p className="text-xs text-slate-500 mb-3">
              {t(`dashboard.templateSuggestion.reason.${suggestion.signalKey}`, { count: suggestion.matchedCount, template: t(`dashboard.templateSuggestion.template.${suggestion.businessType}`) })}
            </p>
            <button
              onClick={() => navigate('/settings/industry')}
              className="text-xs text-brand font-semibold hover:underline">
              {t('dashboard.templateSuggestion.explore')} →
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} title={t('dashboard.templateSuggestion.dismiss') as string} className="text-slate-400 hover:text-slate-600 mt-0.5 shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
