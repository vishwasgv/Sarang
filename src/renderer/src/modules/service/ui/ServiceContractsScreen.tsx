import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSignature, Plus, RefreshCw, Receipt } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatDate } from '@shared/utils/locale.util'

interface ServiceContract {
  id: string; contractNumber: string; customerId: string
  scope: string | null; serviceFrequency: string; startDate: string; endDate: string | null
  contractValue: number; status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  lastInvoicedPeriod: string | null
  customer: { id: string; customerName: string; phone: string | null }
}

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']

// Phase 67 §9.1 — Service item 3: Recurring service contract, an AMC-like
// arrangement for repeat customers. Mirrors GoldSavingsScreen's own
// list + inline-Card-panel pattern (not a modal overlay).
export function ServiceContractsScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const sym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('sales.manage')

  const [contracts, setContracts] = useState<ServiceContract[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [scope, setScope] = useState('')
  const [frequency, setFrequency] = useState('MONTHLY')
  const [contractValue, setContractValue] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [invoiceTarget, setInvoiceTarget] = useState<ServiceContract | null>(null)
  const [invoicing, setInvoicing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.serviceContracts.list()
      if (res.success) setContracts((res.data as ServiceContract[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setPickedCustomer(null)
    setScope('')
    setFrequency('MONTHLY')
    setContractValue('')
    setStartDate(new Date().toISOString().slice(0, 10))
    setError('')
  }

  async function handleCreate() {
    setError('')
    if (!pickedCustomer) { setError(t('service.selectCustomer')); return }
    const value = Number(contractValue)
    if (!Number.isFinite(value) || value <= 0) { setError(t('service.validContractValueRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.serviceContracts.create({
        customerId: pickedCustomer.id, scope: scope.trim() || undefined, serviceFrequency: frequency,
        startDate, contractValue: value,
      })
      if (res.success) {
        const data = res.data as ServiceContract
        toastSuccess(t('service.contractCreated'), t('service.contractCreatedDesc', { number: data.contractNumber }))
        setShowForm(false)
        resetForm()
        await load()
      } else {
        setError(res.error?.message ?? t('common.error'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateInvoice() {
    if (!invoiceTarget) return
    setInvoicing(true)
    try {
      const res = await window.api.serviceContracts.generateInvoice({ id: invoiceTarget.id })
      if (res.success) {
        toastSuccess(t('service.contractInvoiced'), t('service.contractInvoicedDesc'))
        setInvoiceTarget(null)
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setInvoicing(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><FileSignature size={20} /> {t('service.serviceContracts')}</h2>
          <p className="text-sm text-slate-400">{t('service.serviceContractsDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('jewellery.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('service.newContract')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('billing.customer')} />
          <Input label={t('service.contractScope')} value={scope} onChange={(e) => setScope(e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Select label={t('service.serviceFrequency')} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`service.frequency.${f}`)}</option>)}
            </Select>
            <Input label={t('service.contractValue')} type="number" step="0.01" min="0" value={contractValue} onChange={(e) => setContractValue(e.target.value)} />
            <Input label={t('jewellery.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('service.createContract')}</Button>
          </div>
        </Card>
      )}

      {invoiceTarget && (
        <Card padding="md" className="space-y-3 border-brand/40">
          <p className="text-sm font-semibold text-dark">{t('service.generateContractInvoiceTitle', { number: invoiceTarget.contractNumber })}</p>
          <p className="text-xs text-slate-400">{t('service.generateContractInvoiceHint', { amount: `${sym}${invoiceTarget.contractValue.toFixed(2)}` })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setInvoiceTarget(null)} disabled={invoicing}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleGenerateInvoice()} loading={invoicing}>{t('service.generateInvoice')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('jewellery.loading')}</div>
      ) : contracts.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <FileSignature size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('service.noContracts')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {contracts.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{c.contractNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{t(`service.frequency.${c.serviceFrequency}`)}</span>
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'EXPIRED' ? 'warning' : 'neutral'} size="sm">{t(`service.contractStatus.${c.status}`)}</Badge>
                  </div>
                  <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{c.customer.customerName}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                    <span className="font-semibold text-dark dark:text-slate-100">{sym}{c.contractValue.toFixed(2)}</span>
                    <span>{formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : ''}</span>
                    {c.lastInvoicedPeriod && <span>{t('service.lastInvoicedFor', { period: c.lastInvoicedPeriod })}</span>}
                  </div>
                </div>
                {canManage && c.status === 'ACTIVE' && (
                  <button onClick={() => setInvoiceTarget(c)} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium shrink-0">
                    <Receipt size={12} /> {t('service.generateInvoice')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
