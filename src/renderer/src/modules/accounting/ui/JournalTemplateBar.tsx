import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@app/store/notification.store'

interface Template { id: string; name: string; narration: string | null; lines: Array<{ accountId: string; side: 'DEBIT' | 'CREDIT'; remarks?: string }> }
export interface TemplateLine { accountId: string; side: 'DEBIT' | 'CREDIT'; remarks?: string }

// Pick a saved journal pattern to fill the accounts, or save the accounts on the form as a new pattern.
export function JournalTemplateBar({ current, narration, onApply }: { current: TemplateLine[]; narration: string; onApply: (narration: string, lines: TemplateLine[]) => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [templates, setTemplates] = useState<Template[]>([])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    const res = await window.api.voucherClasses.list()
    if (res.success && res.data) setTemplates(res.data as Template[])
  }, [])
  useEffect(() => { load() }, [load])

  async function save() {
    const res = await window.api.voucherClasses.save({ name, narration: narration.trim() || undefined, lines: current })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('journalTemplates.couldNot')); return }
    toastSuccess(t('journalTemplates.saved'), name)
    setNaming(false); setName('')
    await load()
  }

  const cls = 'h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-xs'
  const usable = current.filter((l) => l.accountId)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={cls} value="" onChange={(e) => { const tpl = templates.find((x) => x.id === e.target.value); if (tpl) onApply(tpl.narration ?? '', tpl.lines) }}>
        <option value="">{t('journalTemplates.use')}</option>
        {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {!naming && <button onClick={() => setNaming(true)} disabled={usable.length < 2} className="text-xs text-brand hover:underline font-semibold disabled:opacity-40">{t('journalTemplates.saveAs')}</button>}
      {naming && (
        <>
          <input className={`${cls} w-44`} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('journalTemplates.name')} />
          <button onClick={save} disabled={!name.trim()} className="text-xs text-brand hover:underline font-semibold disabled:opacity-40">{t('common.save')}</button>
          <button onClick={() => setNaming(false)} className="text-xs text-slate-400 hover:underline">{t('common.cancel')}</button>
        </>
      )}
    </div>
  )
}
