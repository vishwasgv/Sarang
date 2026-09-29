import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'

interface Stage { id: string; name: string; sortOrder: number }

// J19 — Blueprints: a horizontal stage pipeline on a document's own detail screen, sibling to
// ApprovalPanel (same documentType/documentId/refreshSignal shape). Renders nothing when the
// owner hasn't defined any stages for this document type in Settings — invisible on every
// install that never turns this on, matching ApprovalPanel's own opt-in design. Not an
// approval gate: any stage can be clicked directly (no "must go in order" rule), since this is
// a status pipeline the owner defines freely, not a sign-off chain.
export function DocumentStageTracker({ documentType, documentId, refreshSignal }: {
  documentType: 'SALES_ORDER' | 'PURCHASE_ORDER'
  documentId: string
  refreshSignal?: string
}) {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [stages, setStages] = useState<Stage[] | null>(null)
  const [currentStageId, setCurrentStageId] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await window.api.documentStage.getCurrent({ documentType, documentId })
      if (res.success && res.data) {
        setStages(res.data.stages)
        setCurrentStageId(res.data.currentStageId)
      } else {
        setStages(null)
      }
    } catch {
      setStages(null)
    }
  }, [documentType, documentId])

  useEffect(() => { load() }, [load, refreshSignal])

  async function advance(stageId: string) {
    if (stageId === currentStageId) return
    setAdvancing(stageId)
    try {
      const res = await window.api.documentStage.advance({ documentType, documentId, stageId })
      if (res.success) setCurrentStageId(stageId)
      else toastError(t('common.error'), res.error?.message ?? t('settings.blueprints.couldNotAdvance'))
    } catch {
      toastError(t('common.error'), t('settings.blueprints.couldNotAdvance'))
    } finally {
      setAdvancing(null)
    }
  }

  if (!stages || stages.length === 0) return null
  const currentIndex = stages.findIndex((s) => s.id === currentStageId)

  return (
    <Card padding="lg" className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('settings.blueprints.stageTitle')}</p>
      <div className="flex items-center flex-wrap gap-2">
        {stages.map((s, i) => {
          const done = i < currentIndex
          const active = s.id === currentStageId
          return (
            <button key={s.id} onClick={() => advance(s.id)} disabled={advancing === s.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                active ? 'bg-brand text-white'
                  : done ? 'bg-success/10 text-success hover:bg-success/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}>
              {done && <Check size={12} />}
              {s.name}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
