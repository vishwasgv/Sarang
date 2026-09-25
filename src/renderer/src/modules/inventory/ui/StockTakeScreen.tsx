import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, ArrowLeft } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

interface TakeRow { id: string; takeNumber: string; status: string; createdAt: string; postedAt: string | null; lines: number; notes: string | null }
interface Line { id: string; productId: string; productName: string; sku: string | null; systemQty: number; countedQty: number | null; variance: number | null; varianceValue: number | null; posted: boolean }
interface Take { id: string; takeNumber: string; status: string; notes: string | null; lines: Line[]; summary: { lines: number; counted: number; withDifference: number; surplusValue: number; shortageValue: number } }

const VARIANT: Record<string, 'info' | 'success' | 'neutral'> = { IN_PROGRESS: 'info', POSTED: 'success', CANCELLED: 'neutral' }

// Physical stock count: list of counts, and the counting sheet for one of them.
export function StockTakeScreen() {
  const { id } = useParams()
  return id ? <CountSheet id={id} /> : <CountList />
}

function CountList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { error: toastError } = useNotificationStore()
  const canEdit = useAuthStore((s) => s.hasPermission('inventory.adjustStock'))
  const [rows, setRows] = useState<TakeRow[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await window.api.stockTakes.list()
    if (res.success && res.data) setRows(res.data as TakeRow[])
  }, [])
  useEffect(() => { load() }, [load])

  async function start() {
    setBusy(true)
    try {
      const res = await window.api.stockTakes.start({ notes: notes.trim() || undefined })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('stockTake.couldNot')); return }
      navigate(`/inventory/stock-takes/${(res.data as { id: string }).id}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><ClipboardList size={18} className="text-brand" /></div>
        <div>
          <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('stockTake.title')}</h1>
          <p className="text-xs text-slate-400">{t('stockTake.subtitle')}</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-6 max-w-4xl">
        {canEdit && (
          <Card padding="md" className="space-y-3">
            <h2 className="font-semibold text-dark dark:text-slate-100">{t('stockTake.startTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('stockTake.startHelp')}</p>
            <Input label={t('stockTake.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button onClick={start} loading={busy}>{t('stockTake.start')}</Button>
          </Card>
        )}
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 && <p className="p-5 text-sm text-slate-500">{t('stockTake.none')}</p>}
          {rows.map((r) => (
            <button key={r.id} onClick={() => navigate(`/inventory/stock-takes/${r.id}`)} className="w-full min-h-[56px] flex items-center gap-3 px-5 py-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <span className="font-mono text-sm font-semibold text-dark dark:text-slate-100">{r.takeNumber}</span>
              <Badge variant={VARIANT[r.status] ?? 'neutral'} size="sm">{t(`stockTake.status.${r.status}`)}</Badge>
              <span className="text-xs text-slate-400">{formatDate(r.createdAt)} · {r.lines} {t('stockTake.items')}</span>
              <span className="ms-auto text-xs text-slate-500 truncate max-w-[16rem]">{r.notes}</span>
            </button>
          ))}
        </Card>
      </div>
    </div>
  )
}

function CountSheet({ id }: { id: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canEdit = useAuthStore((s) => s.hasPermission('inventory.adjustStock'))
  const [take, setTake] = useState<Take | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'post' | 'cancel' | null>(null)

  const load = useCallback(async () => {
    const res = await window.api.stockTakes.get({ id })
    if (res.success && res.data) setTake(res.data as Take)
  }, [id])
  useEffect(() => { load() }, [load])

  const open = take?.status === 'IN_PROGRESS'
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (take?.lines ?? []).filter((l) => !q || l.productName.toLowerCase().includes(q) || (l.sku ?? '').toLowerCase().includes(q))
  }, [take, search])

  async function save(line: Line) {
    const text = draft[line.id]
    if (text === undefined) return
    const value = text.trim() === '' ? null : Number(text)
    if (value !== null && (!Number.isFinite(value) || value < 0)) { toastError(t('common.error'), t('stockTake.badQuantity')); return }
    if (value === line.countedQty) { setDraft((d) => { const n = { ...d }; delete n[line.id]; return n }); return }
    const res = await window.api.stockTakes.setCounts({ id, counts: [{ lineId: line.id, countedQty: value }] })
    if (res.success && res.data) { setTake(res.data as Take); setDraft((d) => { const n = { ...d }; delete n[line.id]; return n }) }
    else toastError(t('common.error'), res.error?.message ?? t('stockTake.couldNot'))
  }

  async function post() {
    setBusy('post')
    try {
      const res = await window.api.stockTakes.post({ id })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('stockTake.couldNot')); return }
      const d = res.data as { adjusted: number; closed: boolean; problems: { product: string; message: string }[] }
      if (d.closed) toastSuccess(t('stockTake.posted'), t('stockTake.adjusted', { count: d.adjusted }))
      for (const p of d.problems) toastError(p.product, p.message)
      await load()
    } finally { setBusy(null) }
  }

  async function cancel() {
    setBusy('cancel')
    try {
      const res = await window.api.stockTakes.cancel({ id })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('stockTake.couldNot')); return }
      navigate('/inventory/stock-takes')
    } finally { setBusy(null) }
  }

  if (!take) return <div className="p-6 text-sm text-slate-500">…</div>

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3">
        <button onClick={() => navigate('/inventory/stock-takes')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400"><ArrowLeft size={16} /></button>
        <h1 className="text-lg font-bold text-dark dark:text-slate-100">{take.takeNumber}</h1>
        <Badge variant={VARIANT[take.status] ?? 'neutral'}>{t(`stockTake.status.${take.status}`)}</Badge>
        <div className="ms-auto flex gap-2">
          {open && canEdit && <Button variant="outline" onClick={cancel} loading={busy === 'cancel'}>{t('stockTake.cancel')}</Button>}
          {open && canEdit && <Button onClick={post} loading={busy === 'post'} disabled={take.summary.counted === 0}>{t('stockTake.post')}</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t('stockTake.counted'), value: `${take.summary.counted} / ${take.summary.lines}` },
            { label: t('stockTake.withDifference'), value: String(take.summary.withDifference) },
            { label: t('stockTake.surplus'), value: formatCurrency(take.summary.surplusValue) },
            { label: t('stockTake.shortage'), value: formatCurrency(take.summary.shortageValue) }
          ].map((c) => (
            <Card key={c.label} padding="md">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{c.label}</div>
              <div className="text-xl font-bold text-dark dark:text-slate-100">{c.value}</div>
            </Card>
          ))}
        </div>

        <Input label={t('stockTake.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        {open && <p className="text-xs text-slate-500">{t('stockTake.howTo')}</p>}

        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-4 py-3 text-start">{t('stockTake.item')}</th>
                <th className="px-4 py-3 text-end">{t('stockTake.system')}</th>
                <th className="px-4 py-3 text-end">{t('stockTake.countedCol')}</th>
                <th className="px-4 py-3 text-end">{t('stockTake.difference')}</th>
                <th className="px-4 py-3 text-end">{t('stockTake.value')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-4 py-2 text-dark dark:text-slate-100">{l.productName}<span className="ms-2 text-xs text-slate-400">{l.sku}</span></td>
                  <td className="px-4 py-2 text-end text-slate-500">{l.systemQty}</td>
                  <td className="px-4 py-2 text-end">
                    {open && canEdit ? (
                      <input
                        type="number" min="0" step="any" inputMode="decimal"
                        className="w-28 h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-end text-base"
                        value={draft[l.id] ?? (l.countedQty === null ? '' : String(l.countedQty))}
                        onChange={(e) => setDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                        onBlur={() => save(l)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    ) : (l.countedQty ?? '')}
                  </td>
                  <td className={`px-4 py-2 text-end font-semibold ${l.variance === null || l.variance === 0 ? 'text-slate-400' : l.variance > 0 ? 'text-success' : 'text-danger'}`}>{l.variance === null ? '' : l.variance > 0 ? `+${l.variance}` : l.variance}</td>
                  <td className="px-4 py-2 text-end text-slate-600 dark:text-slate-300">{l.varianceValue === null || l.varianceValue === 0 ? '' : formatCurrency(l.varianceValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
