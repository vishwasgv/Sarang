import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface Loc { id: string; name: string; isActive: boolean; isDefault: boolean }
interface Row { productId: string; productName: string; sku: string | null; quantity: number; binCode: string }

// Shelf / rack / bin label of each item inside a location.
export function BinLocationsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const canEdit = useAuthStore((s) => s.hasPermission('inventory.adjustStock'))
  const [locations, setLocations] = useState<Loc[]>([])
  const [locationId, setLocationId] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    window.api.locations.list().then((res) => {
      if (!res.success || !res.data) return
      const list = (res.data as Loc[]).filter((l) => l.isActive)
      setLocations(list)
      setLocationId((list.find((l) => l.isDefault) ?? list[0])?.id ?? '')
    })
  }, [])

  const load = useCallback(async () => {
    if (!locationId) return
    const res = await window.api.bins.list({ locationId, search: search.trim() || undefined })
    if (res.success && res.data) setRows(res.data as Row[])
  }, [locationId, search])
  useEffect(() => { load() }, [load])

  async function save(r: Row) {
    const text = draft[r.productId]
    if (text === undefined) return
    if (text.trim() === r.binCode) { setDraft((d) => { const n = { ...d }; delete n[r.productId]; return n }); return }
    const res = await window.api.bins.set({ productId: r.productId, locationId, binCode: text })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('bins.couldNot')); return }
    setDraft((d) => { const n = { ...d }; delete n[r.productId]; return n })
    setRows((list) => list.map((x) => x.productId === r.productId ? { ...x, binCode: text.trim() } : x))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><MapPin size={18} className="text-brand" /></div>
        <div>
          <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('bins.title')}</h1>
          <p className="text-xs text-slate-400">{t('bins.subtitle')}</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-4 max-w-4xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('bins.location')}</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full h-12 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base">
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <Input label={t('bins.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">{t('bins.help')}</p>
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-4 py-3 text-start">{t('bins.item')}</th>
                <th className="px-4 py-3 text-end">{t('bins.quantity')}</th>
                <th className="px-4 py-3 text-start">{t('bins.bin')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-slate-500">{t('bins.none')}</td></tr>}
              {rows.map((r) => (
                <tr key={r.productId} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="px-4 py-2 text-dark dark:text-slate-100">{r.productName}<span className="ms-2 text-xs text-slate-400">{r.sku}</span></td>
                  <td className="px-4 py-2 text-end text-slate-500">{r.quantity}</td>
                  <td className="px-4 py-2">
                    {canEdit ? (
                      <input
                        maxLength={40}
                        className="w-40 h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base"
                        value={draft[r.productId] ?? r.binCode}
                        onChange={(e) => setDraft((d) => ({ ...d, [r.productId]: e.target.value }))}
                        onBlur={() => save(r)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    ) : r.binCode}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
