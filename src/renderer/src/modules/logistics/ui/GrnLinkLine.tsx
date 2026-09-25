import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@app/store/notification.store'

interface Found { id: string; productName: string }

// Links a free-text line of a posted GRN to a catalog item; its accepted quantity then comes into stock.
export function GrnLinkLine({ itemId, onLinked }: { itemId: string; onLinked: () => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Found[]>([])

  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const res = await window.api.products.search(query.trim())
      if (res.success && res.data) setResults((res.data as Found[]).slice(0, 6))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, open])

  async function link(f: Found) {
    const res = await window.api.logisticsGrn.linkLine({ itemId, productId: f.id })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('logistics.grn.linkFailed')); return }
    toastSuccess(t('logistics.grn.linked'), f.productName)
    setOpen(false); setQuery(''); onLinked()
  }

  if (!open) return <button onClick={(e) => { e.stopPropagation(); setOpen(true) }} className="ms-2 text-blue-600 hover:underline">{t('logistics.grn.linkToItem')}</button>
  return (
    <span className="relative ms-2 inline-block" onClick={(e) => e.stopPropagation()}>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('logistics.grn.findItem')} className="h-9 w-48 px-2 rounded border border-gray-300 text-xs" />
      {results.length > 0 && (
        <span className="absolute z-10 start-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg block">
          {results.map((r) => <button key={r.id} onClick={() => link(r)} className="block w-full min-h-[36px] px-2 text-start text-xs hover:bg-gray-50">{r.productName}</button>)}
        </span>
      )}
    </span>
  )
}
