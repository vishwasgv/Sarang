import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'

const schema = z.object({
  // REAL BUG found+fixed (pre-launch audit): this mirrored the backend's own
  // now-fixed AdjustStockSchema mistake — see that file's comment. Negative
  // is a real, setting-gated case (inventory.service.ts's adjustStock/
  // getAllowNegative()), not something the form should reject outright;
  // the backend still returns a friendly error when the setting is off.
  quantity: z.coerce.number().finite('Quantity must be a valid number'),
  reason: z.string().min(1, 'Reason is required for stock adjustment').max(255),
  // z.coerce.number() alone turns a blank input into 0 (Number('') === 0 in JS),
  // not undefined — which would silently recalculate average cost using a cost
  // of 0 instead of leaving it untouched. Preprocess blank/empty to undefined
  // BEFORE coercion so "I didn't enter a cost" stays genuinely absent.
  unitCost: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().min(0, 'Cost cannot be negative').optional()
  )
})

type FormValues = z.infer<typeof schema>

interface InventoryItem {
  productId: string
  quantity: number
  reorderLevel: number
  averageCost?: number
  product: { productName: string; unit: string; sellByPack?: boolean; packUnit?: string | null; unitsPerPack?: number | null }
}

const REASON_CATEGORIES = [
  { value: '', labelKey: 'inventory.reasonNone' },
  { value: 'RECOUNT', labelKey: 'inventory.reasonRecount' },
  { value: 'DAMAGE', labelKey: 'inventory.reasonDamage' },
  { value: 'THEFT', labelKey: 'inventory.reasonTheft' },
  { value: 'EXPIRY', labelKey: 'inventory.reasonExpiry' },
  { value: 'OTHER', labelKey: 'inventory.reasonOther' },
]

interface StockAdjustmentModalProps {
  open: boolean
  inventoryItem: InventoryItem
  onClose: () => void
  onSaved: () => void
}

export function StockAdjustmentModal({ open, inventoryItem, onClose, onSaved }: StockAdjustmentModalProps) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [saving, setSaving] = useState(false)
  const [reasonCategory, setReasonCategory] = useState('')
  // Phase 58 §2 — carton/box receiving convenience: entering a pack count
  // just computes the equivalent "New Quantity" for the existing absolute-
  // target field below — Inventory.quantity itself never changes meaning,
  // it's always in the base unit.
  const [entryMode, setEntryMode] = useState<'units' | 'packs'>('units')
  const [packsInput, setPacksInput] = useState('')
  const canUsePacks = !!(inventoryItem.product.sellByPack && inventoryItem.product.unitsPerPack)

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: inventoryItem.quantity, reason: '', unitCost: undefined }
  })

  const newQty = watch('quantity')
  const difference = Number(newQty) - inventoryItem.quantity
  const isLow = Number(newQty) <= inventoryItem.reorderLevel
  const isIncrease = difference > 0
  const isNoChange = !isNaN(difference) && difference === 0

  function handlePacksChange(value: string) {
    setPacksInput(value)
    const packs = Number(value)
    const unitsPerPack = inventoryItem.product.unitsPerPack ?? 0
    if (Number.isFinite(packs) && packs >= 0) {
      setValue('quantity', inventoryItem.quantity + packs * unitsPerPack, { shouldValidate: true })
    }
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const res = await window.api.inventory.adjustStock({
        productId: inventoryItem.productId,
        quantity: values.quantity,
        reason: values.reason,
        reasonCategory: reasonCategory || undefined,
        ...(isIncrease && values.unitCost !== undefined ? { unitCost: values.unitCost } : {})
      })
      if (res.success) {
        toastSuccess(t('inventory.stockAdjustedTitle'), t('inventory.stockAdjustedMessage', { productName: inventoryItem.product.productName, quantity: values.quantity, unit: inventoryItem.product.unit }))
        onSaved()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('inventory.adjustStockFailed'))
      }
    } catch {
      toastError(t('common.error'), t('inventory.adjustStockFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('inventory.adjustStock')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={saving} disabled={isNoChange}>{t('inventory.saveAdjustment')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="flex-1">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{inventoryItem.product.productName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('inventory.currentStockInline')} <span className="font-medium text-dark dark:text-slate-100">{inventoryItem.quantity} {inventoryItem.product.unit}</span>
              {inventoryItem.averageCost !== undefined && (
                <span className="ms-2 text-slate-400">{t('inventory.avgCostLabel')} {inventoryItem.averageCost.toFixed(2)}</span>
              )}
            </p>
          </div>
        </div>

        {canUsePacks && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">{t('inventory.enterAs')}</span>
            <button type="button" onClick={() => setEntryMode('units')}
              className={`px-2.5 py-1 rounded-full font-medium ${entryMode === 'units' ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {inventoryItem.product.unit}
            </button>
            <button type="button" onClick={() => setEntryMode('packs')}
              className={`px-2.5 py-1 rounded-full font-medium ${entryMode === 'packs' ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {inventoryItem.product.packUnit} {t('inventory.received')}
            </button>
          </div>
        )}

        {canUsePacks && entryMode === 'packs' ? (
          <Input
            label={t('inventory.packsReceivedLabel', { packUnit: inventoryItem.product.packUnit, unitsPerPack: inventoryItem.product.unitsPerPack, unit: inventoryItem.product.unit })}
            type="number" min="0" step="1"
            value={packsInput}
            onChange={(e) => handlePacksChange(e.target.value)}
          />
        ) : (
          <Input
            label={t('inventory.newQuantityLabel', { unit: inventoryItem.product.unit })}
            type="number"
            step="1"
            {...register('quantity')}
            error={errors.quantity?.message}
          />
        )}

        {!isNaN(difference) && difference !== 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${difference > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {difference > 0 ? '+' : ''}{difference} {inventoryItem.product.unit} {t(difference > 0 ? 'inventory.willBeAdded' : 'inventory.willBeRemoved')}
          </div>
        )}

        {isNoChange && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm">
            {t('inventory.noChangeHint')}
          </div>
        )}

        {isIncrease && (
          <Input
            label={t('inventory.costPerUnitLabel')}
            type="number"
            min="0"
            step="0.01"
            placeholder={t('inventory.costPerUnitPlaceholder')}
            {...register('unitCost')}
            error={errors.unitCost?.message}
          />
        )}

        {isLow && Number(newQty) >= 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm">
            <AlertTriangle size={14} />
            {t('inventory.atOrBelowReorderLevel', { level: inventoryItem.reorderLevel, unit: inventoryItem.product.unit })}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.reasonCategoryLabel')}</label>
          <select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100">
            {REASON_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
          </select>
        </div>

        <Input
          label={`${t('common.reason')} *`}
          placeholder={t('inventory.reasonPlaceholder')}
          {...register('reason')}
          error={errors.reason?.message}
        />
      </div>
    </Modal>
  )
}
