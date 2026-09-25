import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { useNotificationStore } from '@app/store/notification.store'

interface Props {
  scenarios: string[]
  scenario: string
  canManage: boolean
  onChange: (scenario: string) => void
  onCreated: (name: string) => void
}

// Pick a what-if plan, or copy the one being viewed into a new plan raised or lowered by a percent.
export function BudgetScenarioBar({ scenarios, scenario, canManage, onChange, onCreated }: Props) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [percent, setPercent] = useState('10')

  async function create() {
    const res = await window.api.budgets.copyScenario({ from: scenario, to: name, percent: Number(percent) })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? ''); return }
    toastSuccess(t('budgets.scenario.created'))
    setAdding(false)
    onCreated(name.trim().slice(0, 40))
    setName('')
  }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 uppercase">{t('budgets.scenario.label')}</span>
      <select value={scenario} onChange={(e) => onChange(e.target.value)} className={field}>
        {scenarios.map((s) => <option key={s} value={s}>{s === 'Base' ? t('budgets.scenario.base') : s}</option>)}
      </select>
      {canManage && !adding && <Button variant="secondary" onClick={() => setAdding(true)}>{t('budgets.scenario.copy')}</Button>}
      {adding && (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('budgets.scenario.namePlaceholder')} className={`${field} w-44`} />
          <input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} className={`${field} w-24`} aria-label={t('budgets.scenario.percent')} />
          <span className="text-sm text-slate-500">%</span>
          <Button disabled={!name.trim() || percent === ''} onClick={create}>{t('common.save')}</Button>
          <Button variant="secondary" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
        </>
      )}
    </div>
  )
}
