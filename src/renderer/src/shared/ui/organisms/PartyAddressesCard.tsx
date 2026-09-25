import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'

interface Address { id: string; label: string; addressText: string; isDefault: boolean }
interface Props { partyType: 'CUSTOMER' | 'SUPPLIER'; partyId: string; canEdit: boolean }

// The extra addresses of a customer or supplier (ship-to, warehouse, branch office).
export function PartyAddressesCard({ partyType, partyId, canEdit }: Props) {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [items, setItems] = useState<Address[]>([])
  const [form, setForm] = useState<{ id?: string; label: string; addressText: string; isDefault: boolean } | null>(null)

  const load = useCallback(async () => {
    const r = await window.api.partyAddresses.list({ partyType, partyId })
    if (r.success) setItems((r.data as Address[]) ?? [])
  }, [partyType, partyId])
  useEffect(() => { void load() }, [load])

  async function save() {
    if (!form) return
    const r = await window.api.partyAddresses.save({ ...form, partyType, partyId })
    if (!r.success) { toastError(t('common.error'), r.error?.message ?? ''); return }
    setForm(null)
    void load()
  }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <Card padding="lg" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('addresses.title')}</h3>
        {canEdit && !form && <Button variant="secondary" onClick={() => setForm({ label: '', addressText: '', isDefault: false })}>{t('addresses.add')}</Button>}
      </div>
      {items.length === 0 && !form && <p className="text-sm text-slate-400">{t('addresses.empty')}</p>}
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-dark dark:text-slate-100">{a.label}{a.isDefault ? ` · ${t('addresses.default')}` : ''}</p>
            <p className="text-sm text-slate-500 whitespace-pre-line">{a.addressText}</p>
          </div>
          {canEdit && (
            <>
              <Button variant="secondary" onClick={() => setForm({ id: a.id, label: a.label, addressText: a.addressText, isDefault: a.isDefault })}>{t('common.edit')}</Button>
              <Button variant="secondary" onClick={async () => { await window.api.partyAddresses.remove({ id: a.id, partyType }); void load() }}>{t('common.delete')}</Button>
            </>
          )}
        </div>
      ))}
      {form && (
        <div className="space-y-3">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={60} placeholder={t('addresses.labelPlaceholder')} className={`${field} w-full`} />
          <textarea value={form.addressText} onChange={(e) => setForm({ ...form, addressText: e.target.value })} maxLength={400} rows={3}
            placeholder={t('addresses.addressPlaceholder')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100" />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 accent-brand" />
            {t('addresses.makeDefault')}
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={!form.label.trim() || !form.addressText.trim()}>{t('common.save')}</Button>
            <Button variant="secondary" onClick={() => setForm(null)}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
