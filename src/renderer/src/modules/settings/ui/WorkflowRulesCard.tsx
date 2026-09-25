import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useAuthStore } from '@app/store/auth.store'

interface Rule { id: string; name: string; event: string; minAmount: number; enabled: boolean }

const EVENTS = ['INVOICE_CREATED', 'BILL_CREATED', 'EXPENSE_CREATED']

// "When an invoice / bill / expense of at least this amount is saved, send me a notification."
export function WorkflowRulesCard() {
  const { t } = useTranslation()
  const canEdit = useAuthStore((s) => s.hasPermission('settings.modify'))
  const [rules, setRules] = useState<Rule[]>([])
  const [name, setName] = useState('')
  const [event, setEvent] = useState(EVENTS[0])
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await window.api.workflowRules.list()
    if (r.success) setRules((r.data as Rule[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  const add = async () => {
    setError('')
    const r = await window.api.workflowRules.add({ name, event, minAmount: Number(amount) })
    if (!r.success) { setError(r.error?.message ?? ''); return }
    setName(''); setAmount(''); void load()
  }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('settings.workflowRules.title')}</h3>
        <p className="text-sm text-slate-500 mt-1">{t('settings.workflowRules.hint')}</p>
      </div>
      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{r.name}</p>
            <p className="text-xs text-slate-400">{t(`settings.workflowRules.events.${r.event}`)} · {t('settings.workflowRules.atLeast')} {r.minAmount}</p>
          </div>
          {canEdit && (
            <>
              <Button variant="secondary" onClick={async () => { await window.api.workflowRules.setEnabled({ id: r.id, enabled: !r.enabled }); void load() }}>
                {r.enabled ? t('settings.workflowRules.on') : t('settings.workflowRules.off')}
              </Button>
              <Button variant="secondary" onClick={async () => { await window.api.workflowRules.remove({ id: r.id }); void load() }}>{t('common.delete')}</Button>
            </>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('settings.workflowRules.namePlaceholder')} className={`${field} w-56`} />
          <select value={event} onChange={(e) => setEvent(e.target.value)} className={field}>
            {EVENTS.map((ev) => <option key={ev} value={ev}>{t(`settings.workflowRules.events.${ev}`)}</option>)}
          </select>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('settings.workflowRules.amountPlaceholder')} className={`${field} w-40`} />
          <Button onClick={add} disabled={!name.trim() || amount === ''}>{t('common.add')}</Button>
          {error && <p className="text-sm text-danger w-full">{error}</p>}
        </div>
      )}
    </Card>
  )
}
