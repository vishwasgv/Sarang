import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useAuthStore } from '@app/store/auth.store'
import { formatDate } from '@shared/utils/locale.util'

interface Memo { id: string; title: string; notes: string | null; memoDate: string }

// Notes about things that are not accounting entries yet (goods on approval, promises, pending deals). Never posted to the books.
export function JournalMemoCard() {
  const { t } = useTranslation()
  const canEdit = useAuthStore((s) => s.hasPermission('journalEntries.create'))
  const [memos, setMemos] = useState<Memo[]>([])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const r = await window.api.journalExtras.listMemos()
    if (r.success) setMemos((r.data as Memo[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <Card padding="lg" className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('accounting.memo.title')}</h3>
        <p className="text-sm text-slate-500 mt-1">{t('accounting.memo.hint')}</p>
      </div>
      {memos.map((m) => (
        <div key={m.id} className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-dark dark:text-slate-100">{m.title}</p>
            <p className="text-xs text-slate-400">{formatDate(m.memoDate)}{m.notes ? ` · ${m.notes}` : ''}</p>
          </div>
          {canEdit && <Button variant="secondary" onClick={async () => { await window.api.journalExtras.removeMemo({ id: m.id }); void load() }}>{t('common.delete')}</Button>}
        </div>
      ))}
      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t('accounting.memo.titlePlaceholder')} className={`${field} w-60`} />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder={t('accounting.memo.notesPlaceholder')} className={`${field} flex-1 min-w-[200px]`} />
          <Button disabled={!title.trim()} onClick={async () => { const r = await window.api.journalExtras.addMemo({ title, notes }); if (r.success) { setTitle(''); setNotes(''); void load() } }}>{t('common.add')}</Button>
        </div>
      )}
    </Card>
  )
}
