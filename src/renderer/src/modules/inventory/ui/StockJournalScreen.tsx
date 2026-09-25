import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Repeat, Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatDate } from '@shared/utils/locale.util'

interface JournalRow { id: string; journalNumber: string; notes: string | null; createdAt: string; out: string[]; in: string[] }
interface DraftLine { key: number; productId: string; name: string; quantity: string }
interface Found { id: string; productName: string }

function LinePicker({ title, lines, onChange }: { title: string; lines: DraftLine[]; onChange: (l: DraftLine[]) => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Found[]>([])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const res = await window.api.products.search(query.trim())
      if (res.success && res.data) setResults((res.data as Found[]).slice(0, 8))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  function add(f: Found) {
    if (!lines.some((l) => l.productId === f.id)) onChange([...lines, { key: Date.now(), productId: f.id, name: f.productName, quantity: '1' }])
    setQuery(''); setResults([])
  }

  return (
    <Card padding="md" className="space-y-3">
      <h2 className="font-semibold text-dark dark:text-slate-100">{title}</h2>
      <div className="relative">
        <Input label={t('stockJournal.findItem')} value={query} onChange={(e) => setQuery(e.target.value)} />
        {results.length > 0 && (
          <div className="absolute z-10 start-0 end-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-auto">
            {results.map((r) => <button key={r.id} onClick={() => add(r)} className="w-full min-h-[44px] px-3 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-700">{r.productName}</button>)}
          </div>
        )}
      </div>
      {lines.map((l) => (
        <div key={l.key} className="flex items-center gap-2">
          <span className="flex-1 text-sm text-dark dark:text-slate-100">{l.name}</span>
          <input
            type="number" min="0" step="any" inputMode="decimal" value={l.quantity}
            onChange={(e) => onChange(lines.map((x) => x.key === l.key ? { ...x, quantity: e.target.value } : x))}
            className="w-28 h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-end text-base"
          />
          <button onClick={() => onChange(lines.filter((x) => x.key !== l.key))} className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-danger"><Trash2 size={16} /></button>
        </div>
      ))}
    </Card>
  )
}

// Items taken out of stock and items brought in, in one entry (repacking, hand assembly, conversion).
export function StockJournalScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canEdit = useAuthStore((s) => s.hasPermission('inventory.adjustStock'))
  const [rows, setRows] = useState<JournalRow[]>([])
  const [creating, setCreating] = useState(false)
  const [outs, setOuts] = useState<DraftLine[]>([])
  const [ins, setIns] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await window.api.stockJournals.list()
    if (res.success && res.data) setRows(res.data as JournalRow[])
  }, [])
  useEffect(() => { load() }, [load])

  async function save() {
    const toLine = (kind: 'OUT' | 'IN') => (l: DraftLine) => ({ kind, productId: l.productId, quantity: Number(l.quantity) })
    setBusy(true)
    try {
      const res = await window.api.stockJournals.create({ notes: notes.trim() || undefined, lines: [...outs.map(toLine('OUT')), ...ins.map(toLine('IN'))] })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('stockJournal.couldNot')); return }
      toastSuccess(t('stockJournal.saved'), (res.data as { journalNumber: string }).journalNumber)
      setCreating(false); setOuts([]); setIns([]); setNotes('')
      await load()
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><Repeat size={18} className="text-brand" /></div>
        <div>
          <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('stockJournal.title')}</h1>
          <p className="text-xs text-slate-400">{t('stockJournal.subtitle')}</p>
        </div>
        {canEdit && !creating && <Button className="ms-auto" onClick={() => setCreating(true)}><Plus size={16} className="me-1.5" />{t('stockJournal.new')}</Button>}
      </div>
      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-6 max-w-4xl">
        {creating && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('stockJournal.help')}</p>
            <LinePicker title={t('stockJournal.takenOut')} lines={outs} onChange={setOuts} />
            <LinePicker title={t('stockJournal.broughtIn')} lines={ins} onChange={setIns} />
            <Input label={t('stockJournal.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={save} loading={busy} disabled={outs.length === 0 || ins.length === 0}>{t('stockJournal.save')}</Button>
              <Button variant="outline" onClick={() => { setCreating(false); setOuts([]); setIns([]) }}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 && <p className="p-5 text-sm text-slate-500">{t('stockJournal.none')}</p>}
          {rows.map((r) => (
            <div key={r.id} className="px-5 py-3 space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-dark dark:text-slate-100">{r.journalNumber}</span>
                <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                <span className="ms-auto text-xs text-slate-500 truncate max-w-[16rem]">{r.notes}</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300"><span className="text-danger">{t('stockJournal.outShort')}</span> {r.out.join(', ')}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300"><span className="text-success">{t('stockJournal.inShort')}</span> {r.in.join(', ')}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
