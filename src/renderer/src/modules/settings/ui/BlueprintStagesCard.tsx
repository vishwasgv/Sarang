import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useAuthStore } from '@app/store/auth.store'

interface Stage { id: string; documentType: string; name: string; sortOrder: number }

const DOCUMENT_TYPES = ['SALES_ORDER', 'PURCHASE_ORDER'] as const

// J19 — Blueprints: define the named pipeline a document type moves through (e.g. Draft ->
// Approved -> Sent to Supplier -> Received). The stage-tracker widget on the document's own
// screen (DocumentStageTracker.tsx) is what actually advances a real document through these.
export function BlueprintStagesCard() {
  const { t } = useTranslation()
  const canEdit = useAuthStore((s) => s.hasPermission('settings.modify'))
  const [documentType, setDocumentType] = useState<(typeof DOCUMENT_TYPES)[number]>('SALES_ORDER')
  const [stages, setStages] = useState<Stage[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await window.api.blueprintStages.list({ documentType })
    if (r.success) setStages((r.data as Stage[]) ?? [])
  }, [documentType])
  useEffect(() => { void load() }, [load])

  const add = async () => {
    setError('')
    const r = await window.api.blueprintStages.add({ documentType, name })
    if (!r.success) { setError(r.error?.message ?? ''); return }
    setName(''); void load()
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= stages.length) return
    const reordered = [...stages]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setStages(reordered) // optimistic — reload() below reconciles either way
    await window.api.blueprintStages.reorder({ documentType, orderedIds: reordered.map((s) => s.id) })
    void load()
  }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('settings.blueprints.title')}</h3>
        <p className="text-sm text-slate-500 mt-1">{t('settings.blueprints.hint')}</p>
      </div>

      <select value={documentType} onChange={(e) => setDocumentType(e.target.value as typeof documentType)} className={`${field} w-64`}>
        {DOCUMENT_TYPES.map((dt) => <option key={dt} value={dt}>{t(`settings.blueprints.documentTypes.${dt}`)}</option>)}
      </select>

      {stages.length === 0 && <p className="text-sm text-slate-400">{t('settings.blueprints.noStages')}</p>}

      {stages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="text-xs text-slate-400 w-6">{i + 1}</span>
          <p className="flex-1 text-sm font-medium text-dark dark:text-slate-100">{s.name}</p>
          {canEdit && (
            <>
              <Button variant="secondary" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
              <Button variant="secondary" disabled={i === stages.length - 1} onClick={() => move(i, 1)}>↓</Button>
              <Button variant="secondary" onClick={async () => { await window.api.blueprintStages.retire({ id: s.id }); void load() }}>{t('common.delete')}</Button>
            </>
          )}
        </div>
      ))}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t('settings.blueprints.namePlaceholder')} className={`${field} w-56`} />
          <Button onClick={add} disabled={!name.trim()}>{t('common.add')}</Button>
          {error && <p className="text-sm text-danger w-full">{error}</p>}
        </div>
      )}
    </Card>
  )
}
