import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { useNotificationStore } from '@app/store/notification.store'

interface VariantRow {
  id?: string
  size: string
  color: string
  sku: string
  barcode: string
  additionalPrice: string
  stockQty: string
}

interface VariantManagementModalProps {
  open: boolean
  productId: string
  productName: string
  onClose: () => void
}

const COMMON_SIZES_CLOTHING = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const COMMON_SIZES_FOOTWEAR = ['5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12']
const COMMON_COLORS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Grey', 'Brown', 'Pink', 'Purple', 'Orange', 'Navy']

function emptyRow(): VariantRow {
  return { size: '', color: '', sku: '', barcode: '', additionalPrice: '0', stockQty: '0' }
}

export function VariantManagementModal({ open, productId, productName, onClose }: VariantManagementModalProps) {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [rows, setRows] = useState<VariantRow[]>([emptyRow()])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<{ totalVariants: number; totalStock: number; sizes: string[]; colors: string[] } | null>(null)

  const loadVariants = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const res = await window.api.variants.list({ productId })
      if (res.success) {
        const existing = res.data as unknown[]
        if (existing && existing.length > 0) {
          setRows(existing.map(v => {
            const r = v as Record<string, unknown>
            return {
              id: r.id as string | undefined,
              size: (r.size as string | null) ?? '',
              color: (r.color as string | null) ?? '',
              sku: (r.sku as string | null) ?? '',
              barcode: (r.barcode as string | null) ?? '',
              additionalPrice: String((r.additionalPrice as number | null) ?? 0),
              stockQty: String((r.stockQty as number | null) ?? 0)
            }
          }))
        } else {
          setRows([emptyRow()])
        }
      } else {
        toastError('Failed', (res.error as { message?: string })?.message ?? 'Could not load variants.')
      }
      const sumRes = await window.api.variants.summary({ productId })
      if (sumRes.success) setSummary(sumRes.data as typeof summary)
      else toastError('Failed', (sumRes.error as { message?: string })?.message ?? 'Could not load variant summary.')
    } catch {
      toastError('Failed', 'Could not load variants.')
    } finally {
      setLoading(false)
    }
  }, [productId, toastError])

  useEffect(() => {
    if (open && productId) {
      setDeletedIds([])
      loadVariants()
    }
  }, [open, productId, loadVariants])

  function addRow() {
    setRows(r => [...r, emptyRow()])
  }

  function removeRow(idx: number) {
    const row = rows[idx]
    if (row.id) setDeletedIds(prev => [...prev, row.id!])
    setRows(r => r.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, field: keyof VariantRow, value: string) {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    const valid = rows.filter(r => r.size || r.color)
    if (valid.length === 0) {
      toastError('No Variants', 'Add at least one variant with a size or colour.')
      return
    }
    setSaving(true)
    try {
      const res = await window.api.variants.upsert({
        productId,
        variants: valid.map(v => ({
          id: v.id,
          size: v.size || undefined,
          color: v.color || undefined,
          sku: v.sku || undefined,
          barcode: v.barcode || undefined,
          additionalPrice: parseFloat(v.additionalPrice) || 0,
          stockQty: parseFloat(v.stockQty) || 0
        }))
      })
      if (res.success) {
        for (const id of deletedIds) {
          const delRes = await window.api.variants.delete({ id })
          if (!delRes.success) {
            toastError('Failed', (delRes.error as { message?: string })?.message ?? 'Could not delete a removed variant.')
            return
          }
        }
        toastSuccess('Variants Saved', `${valid.length} variant${valid.length > 1 ? 's' : ''} saved for ${productName}.`)
        setDeletedIds([])
        onClose()
      } else {
        toastError('Failed', (res.error as { message: string })?.message ?? 'Could not save variants.')
      }
    } catch {
      toastError('Failed', 'Could not save variants.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">Manage Variants</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{productName}</p>
          </div>
          {summary && (
            <div className="text-right">
              <p className="text-base font-semibold text-dark dark:text-slate-100">{summary.totalVariants} variants</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total stock: {summary.totalStock}</p>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-base text-slate-500 dark:text-slate-400 py-8 text-center">Loading…</p>
        ) : (
          <>
            <div className="overflow-auto flex-1">
              <table className="w-full text-base">
                <thead>
                  <tr className="text-sm font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 pr-3 text-left">Size</th>
                    <th className="py-3 pr-3 text-left">Colour</th>
                    <th className="py-3 pr-3 text-left">SKU</th>
                    <th className="py-3 pr-3 text-left">+Price</th>
                    <th className="py-3 pr-3 text-left">Stock</th>
                    <th className="py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-3">
                        <input
                          list={`sizes-${idx}`}
                          value={row.size}
                          onChange={e => updateRow(idx, 'size', e.target.value)}
                          placeholder="M, L, 32…"
                          className="w-full h-10 px-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <datalist id={`sizes-${idx}`}>
                          {[...COMMON_SIZES_CLOTHING, ...COMMON_SIZES_FOOTWEAR].map(s => <option key={s} value={s}/>)}
                        </datalist>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          list={`colors-${idx}`}
                          value={row.color}
                          onChange={e => updateRow(idx, 'color', e.target.value)}
                          placeholder="Black, Red…"
                          className="w-full h-10 px-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <datalist id={`colors-${idx}`}>
                          {COMMON_COLORS.map(c => <option key={c} value={c}/>)}
                        </datalist>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          value={row.sku}
                          onChange={e => updateRow(idx, 'sku', e.target.value)}
                          placeholder="Optional"
                          className="w-full h-10 px-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={row.additionalPrice}
                          onChange={e => updateRow(idx, 'additionalPrice', e.target.value)}
                          placeholder="0"
                          step="0.01"
                          className="w-24 h-10 px-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={row.stockQty}
                          onChange={e => updateRow(idx, 'stockQty', e.target.value)}
                          placeholder="0"
                          min="0"
                          className="w-24 h-10 px-3 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => removeRow(idx)}
                          className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={addRow}
                className="flex items-center gap-2 text-base font-medium text-brand hover:underline"
              >
                <Plus size={16} /> Add Row
              </button>

              <div className="flex gap-3">
                <Button size="md" className="flex-1" onClick={handleSave} disabled={saving}>
                  <Save size={16} className="mr-1.5" />
                  {saving ? 'Saving…' : 'Save Variants'}
                </Button>
                <Button size="md" variant="outline" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
