import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Modal } from '@shared/ui/molecules/Modal'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface Party { id: string; code: string | null; name: string; phone: string | null; email: string | null; taxNumber: string | null; city: string | null; balance: number }
interface Group { reason: 'PHONE' | 'TAX_NUMBER' | 'EMAIL' | 'NAME'; key: string; parties: Party[] }

// Finds customers (or suppliers) that look like the same person and merges them into one record.
export function DuplicatesScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { kind: kindParam } = useParams()
  const kind = kindParam === 'suppliers' ? 'Supplier' : 'Customer'
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [keep, setKeep] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<{ group: Group; keepId: string } | null>(null)
  const [merging, setMerging] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.duplicates.find({ kind })
      if (res.success && res.data) {
        const list = res.data as Group[]
        setGroups(list)
        setKeep(Object.fromEntries(list.map((g) => [`${g.reason}:${g.key}`, g.parties[0].id])))
      }
    } finally { setLoading(false) }
  }, [kind])
  useEffect(() => { load() }, [load])

  async function mergeAll() {
    if (!confirm) return
    setMerging(true)
    try {
      for (const p of confirm.group.parties.filter((x) => x.id !== confirm.keepId)) {
        const res = await window.api.duplicates.merge({ kind, keepId: confirm.keepId, removeId: p.id })
        if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('duplicates.failed')); break }
        toastSuccess(t('duplicates.merged'), p.name)
      }
      setConfirm(null)
      await load()
    } finally { setMerging(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400"><ArrowLeft size={16} /></button>
        <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><Copy size={18} className="text-brand" /></div>
        <div>
          <h1 className="text-lg font-bold text-dark dark:text-slate-100">{kind === 'Customer' ? t('duplicates.titleCustomers') : t('duplicates.titleSuppliers')}</h1>
          <p className="text-xs text-slate-400">{t('duplicates.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-4 max-w-4xl">
        {!loading && groups.length === 0 && <p className="text-sm text-slate-500">{t('duplicates.none')}</p>}
        {groups.map((g) => {
          const id = `${g.reason}:${g.key}`
          return (
            <Card key={id} padding="md" className="space-y-3">
              <p className="text-xs font-semibold uppercase text-slate-400">{t(`duplicates.reason.${g.reason}`)}</p>
              <table className="w-full text-sm">
                <tbody>
                  {g.parties.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="px-2 py-2 w-10">
                        <input type="radio" className="w-5 h-5" name={id} checked={keep[id] === p.id} onChange={() => setKeep((k) => ({ ...k, [id]: p.id }))} aria-label={t('duplicates.keepThis')} />
                      </td>
                      <td className="px-2 py-2 font-medium text-dark dark:text-slate-100">{p.name}<span className="ms-2 text-xs text-slate-400">{p.code}</span></td>
                      <td className="px-2 py-2 text-slate-500">{p.phone ?? ''}</td>
                      <td className="px-2 py-2 text-slate-500">{p.city ?? ''}</td>
                      <td className="px-2 py-2 text-end text-slate-600">{kind === 'Customer' ? formatCurrency(p.balance) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button size="sm" onClick={() => setConfirm({ group: g, keepId: keep[id] })}>{t('duplicates.merge')}</Button>
            </Card>
          )
        })}
      </div>

      {confirm && (
        <Modal open onClose={() => setConfirm(null)} title={t('duplicates.confirmTitle')} size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('duplicates.confirmText', { name: confirm.group.parties.find((p) => p.id === confirm.keepId)?.name ?? '' })}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
              <Button onClick={mergeAll} loading={merging}>{t('duplicates.merge')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
