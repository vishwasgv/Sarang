import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'

const schema = z.object({
  quantity: z.coerce.number().min(0, 'Quantity cannot be negative'),
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
  product: { productName: string; unit: string }
}

interface StockAdjustmentModalProps {
  open: boolean
  inventoryItem: InventoryItem
  onClose: () => void
  onSaved: () => void
}

export function StockAdjustmentModal({ open, inventoryItem, onClose, onSaved }: StockAdjustmentModalProps) {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: inventoryItem.quantity, reason: '', unitCost: undefined }
  })

  const newQty = watch('quantity')
  const difference = Number(newQty) - inventoryItem.quantity
  const isLow = Number(newQty) <= inventoryItem.reorderLevel
  const isIncrease = difference > 0
  const isNoChange = !isNaN(difference) && difference === 0

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const res = await window.api.inventory.adjustStock({
        productId: inventoryItem.productId,
        quantity: values.quantity,
        reason: values.reason,
        ...(isIncrease && values.unitCost !== undefined ? { unitCost: values.unitCost } : {})
      })
      if (res.success) {
        toastSuccess('Stock Adjusted', `${inventoryItem.product.productName} stock updated to ${values.quantity} ${inventoryItem.product.unit}.`)
        onSaved()
      } else {
        toastError('Error', res.error?.message ?? 'Failed to adjust stock.')
      }
    } catch {
      toastError('Error', 'Failed to adjust stock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust Stock"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={saving} disabled={isNoChange}>Save Adjustment</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="flex-1">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{inventoryItem.product.productName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Current stock: <span className="font-medium text-dark dark:text-slate-100">{inventoryItem.quantity} {inventoryItem.product.unit}</span>
              {inventoryItem.averageCost !== undefined && (
                <span className="ml-2 text-slate-400">· Avg cost: {inventoryItem.averageCost.toFixed(2)}</span>
              )}
            </p>
          </div>
        </div>

        <Input
          label={`New Quantity (${inventoryItem.product.unit})`}
          type="number"
          min="0"
          step="1"
          {...register('quantity')}
          error={errors.quantity?.message}
        />

        {!isNaN(difference) && difference !== 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${difference > 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {difference > 0 ? '+' : ''}{difference} {inventoryItem.product.unit} will be {difference > 0 ? 'added' : 'removed'}
          </div>
        )}

        {isNoChange && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm">
            No change — enter a different quantity to record an adjustment.
          </div>
        )}

        {isIncrease && (
          <Input
            label="Cost per unit for the added stock (optional)"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. what you paid per unit — used for inventory valuation"
            {...register('unitCost')}
            error={errors.unitCost?.message}
          />
        )}

        {isLow && Number(newQty) >= 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning text-sm">
            <AlertTriangle size={14} />
            This quantity is at or below the reorder level ({inventoryItem.reorderLevel} {inventoryItem.product.unit}).
          </div>
        )}

        <Input
          label="Reason *"
          placeholder="e.g. Physical stock count, Damaged goods, Opening balance"
          {...register('reason')}
          error={errors.reason?.message}
        />
      </div>
    </Modal>
  )
}
