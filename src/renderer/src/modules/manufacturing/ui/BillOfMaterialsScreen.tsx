import React, { useEffect, useState, useCallback } from 'react'
import { BookMarked, Plus, X, Trash2, RefreshCw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'

interface BomItem {
  id: string
  rawMaterialId: string
  materialName: string
  materialUnit: string
  quantityNeeded: number
  wastagePercent: number
  effectiveQty: number
  unitCost: number
  lineCost: number
}

interface Bom {
  id: string
  productId: string
  productName: string
  description: string | null
  outputQty: number
  items: BomItem[]
  totalMaterialCost: number
  createdAt: string
}

interface ProductOption { id: string; productName: string }
interface RawMaterialOption { id: string; name: string; unit: string; unitCost: number }

interface ItemRow {
  rawMaterialId: string
  materialName: string
  quantityNeeded: string
  wastagePercent: string
  query: string
  results: RawMaterialOption[]
}

function emptyItemRow(): ItemRow {
  return { rawMaterialId: '', materialName: '', quantityNeeded: '', wastagePercent: '', query: '', results: [] }
}

export function BillOfMaterialsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [boms, setBoms] = useState<Bom[]>([])
  const [loading, setLoading] = useState(true)

  // BOM editor modal
  const [editBom, setEditBom] = useState<Bom | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProductName, setSelectedProductName] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<ProductOption[]>([])
  const [description, setDescription] = useState('')
  const [outputQty, setOutputQty] = useState('1')
  const [items, setItems] = useState<ItemRow[]>([emptyItemRow()])
  const [saving, setSaving] = useState(false)

  // Detail view modal
  const [detailBom, setDetailBom] = useState<Bom | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.bom.list()
      if (res.success && res.data) {
        setBoms(res.data as Bom[])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  // Product picker (finished product this BOM is for) — search-as-you-type
  // against products.search() instead of a static products.list({limit:500})
  // that silently missed anything past the first 500 (alphabetically) with
  // no way to reach the rest.
  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const t = setTimeout(async () => {
      const res = await api.products.search(productQuery.trim())
      if (res.success && res.data) setProductResults(res.data as ProductOption[])
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  // Debounced per-row raw material search
  useEffect(() => {
    const timers = items.map((row, idx) => {
      if (!row.query.trim()) { if (row.results.length) setItemResults(idx, []); return undefined }
      return setTimeout(async () => {
        const res = await api.rawMaterials.list({ search: row.query.trim(), limit: 20 })
        if (res.success && res.data) setItemResults(idx, (res.data as { materials: RawMaterialOption[] }).materials)
      }, 250)
    })
    return () => { timers.forEach(t => t && clearTimeout(t)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(r => r.query).join('|')])

  function setItemResults(idx: number, results: RawMaterialOption[]) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, results } : item))
  }

  function openNewBom() {
    setEditBom(null)
    setSelectedProductId('')
    setSelectedProductName('')
    setProductQuery(''); setProductResults([])
    setDescription('')
    setOutputQty('1')
    setItems([emptyItemRow()])
    setShowEditor(true)
  }

  function openEditBom(bom: Bom) {
    setEditBom(bom)
    setSelectedProductId(bom.productId)
    setSelectedProductName(bom.productName)
    setProductQuery(''); setProductResults([])
    setDescription(bom.description ?? '')
    setOutputQty(String(bom.outputQty))
    setItems(bom.items.map(i => ({
      rawMaterialId: i.rawMaterialId, materialName: i.materialName,
      quantityNeeded: String(i.quantityNeeded), wastagePercent: String(i.wastagePercent),
      query: '', results: []
    })))
    setShowEditor(true)
  }

  function addItemRow() {
    setItems(p => [...p, emptyItemRow()])
  }

  function removeItemRow(idx: number) {
    setItems(p => p.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: 'quantityNeeded' | 'wastagePercent' | 'query', value: string) {
    setItems(p => p.map((row, i) => {
      if (i !== idx) return row
      if (field === 'query') return { ...row, query: value, rawMaterialId: '', materialName: '' }
      return { ...row, [field]: value }
    }))
  }

  function pickMaterial(idx: number, m: RawMaterialOption) {
    setItems(p => p.map((row, i) => i === idx
      ? { ...row, rawMaterialId: m.id, materialName: `${m.name} (${m.unit})`, query: '', results: [] }
      : row))
  }

  async function handleSave() {
    if (!selectedProductId) { toastError(t('manufacturing.selectProduct')); return }
    const validItems = items.filter(i => i.rawMaterialId && parseFloat(i.quantityNeeded) > 0)
    if (validItems.length === 0) { toastError(t('manufacturing.addMaterialRequired')); return }

    setSaving(true)
    const res = await api.bom.upsert({
      productId: selectedProductId,
      description: description || undefined,
      outputQty: parseFloat(outputQty) || 1,
      items: validItems.map(i => ({
        rawMaterialId: i.rawMaterialId,
        quantityNeeded: parseFloat(i.quantityNeeded),
        wastagePercent: parseFloat(i.wastagePercent) || 0
      }))
    })
    setSaving(false)
    if (res.success) {
      toastSuccess(editBom ? t('manufacturing.bomUpdated') : t('manufacturing.bomCreated'))
      setShowEditor(false)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.saveFailed'))
    }
  }

  async function handleDelete(bom: Bom) {
    if (!confirm(t('manufacturing.confirmDeleteBom', { name: bom.productName }))) return
    const res = await api.bom.delete({ productId: bom.productId })
    if (res.success) {
      toastSuccess(t('manufacturing.bomDeleted'))
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.actionFailed'))
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <BookMarked size={24} className="text-brand" />
              {t('manufacturing.bom')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('manufacturing.bomSubtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={openNewBom} className="flex items-center gap-2 px-5 h-11 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors">
              <Plus size={16} /> {t('manufacturing.addBom')}
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : boms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <BookMarked size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('manufacturing.noBoms')}</p>
            <p className="text-sm mt-1">{t('manufacturing.noBomDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {boms.map(bom => (
              <Card key={bom.id} padding="lg" hoverable>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-text-primary">{bom.productName}</h3>
                    {bom.description && <p className="text-xs text-text-secondary mt-0.5">{bom.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setDetailBom(bom)} className="p-2 rounded-lg text-text-secondary hover:text-brand hover:bg-brand/5 transition-colors text-xs">{t('common.view')}</button>
                    <button onClick={() => openEditBom(bom)} className="p-2 rounded-lg text-text-secondary hover:text-brand hover:bg-brand/5 transition-colors text-xs">{t('common.edit')}</button>
                    <button onClick={() => handleDelete(bom)} className="p-2 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-text-secondary mb-3">
                  <span>{t('manufacturing.outputLabel')}: <strong className="text-text-primary">{bom.outputQty} {t('common.units')}</strong></span>
                  <span>{t('manufacturing.ingredientsCount', { count: bom.items.length })}</span>
                </div>
                {bom.totalMaterialCost > 0 && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-text-secondary">{t('manufacturing.materialCostBatch')}</p>
                    <p className="text-lg font-bold text-brand">{formatCurrency(bom.totalMaterialCost)}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* BOM Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-text-primary">{editBom ? t('manufacturing.editBom') : t('manufacturing.newBom')}</h2>
              <button onClick={() => setShowEditor(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-5">
              {/* Product selector — search-as-you-type, disabled when editing (can't change which product a BOM is for) */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.finishedProductLabel')}</label>
                {editBom ? (
                  <div className="w-full h-12 px-4 flex items-center rounded-xl border border-border bg-surface-alt text-base text-text-secondary">
                    {selectedProductName}
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      value={selectedProductId ? selectedProductName : productQuery}
                      onChange={e => { setSelectedProductId(''); setSelectedProductName(''); setProductQuery(e.target.value) }}
                      placeholder="Search product by name or SKU…"
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand" />
                    {productResults.length > 0 && !selectedProductId && (
                      <div className="absolute z-10 mt-1 w-full border border-border rounded-xl overflow-hidden divide-y divide-border bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                        {productResults.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => { setSelectedProductId(p.id); setSelectedProductName(p.productName); setProductQuery(''); setProductResults([]) }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-brand/5 transition-colors text-text-primary">
                            {p.productName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.outputQtyBatch')}</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={outputQty}
                    onChange={e => setOutputQty(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">{t('common.description')} ({t('common.optional')})</label>
                  <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="e.g. Standard recipe"
                  />
                </div>
              </div>

              {/* Items grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-primary">{t('manufacturing.rawMaterials')}</label>
                  <button onClick={addItemRow} className="flex items-center gap-1 text-xs text-brand hover:underline">
                    <Plus size={12} /> {t('manufacturing.addRow')}
                  </button>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-alt">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary">{t('manufacturing.material')}</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary w-28">{t('manufacturing.qtyNeeded')}</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-text-secondary w-24">{t('manufacturing.wastagePercent')}</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 relative">
                            <input
                              value={row.rawMaterialId ? row.materialName : row.query}
                              onChange={e => updateItem(idx, 'query', e.target.value)}
                              placeholder="Search material…"
                              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                            {row.results.length > 0 && !row.rawMaterialId && (
                              <div className="absolute z-10 mt-1 w-full border border-border rounded-lg overflow-hidden divide-y divide-border bg-white dark:bg-slate-900 shadow-lg max-h-48 overflow-y-auto">
                                {row.results.map(m => (
                                  <button key={m.id} type="button" onClick={() => pickMaterial(idx, m)}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-brand/5 transition-colors text-text-primary">
                                    {m.name} ({m.unit})
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={row.quantityNeeded}
                              onChange={e => updateItem(idx, 'quantityNeeded', e.target.value)}
                              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={row.wastagePercent}
                              onChange={e => updateItem(idx, 'wastagePercent', e.target.value)}
                              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {items.length > 1 && (
                              <button onClick={() => removeItemRow(idx)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6 shrink-0">
              <button onClick={() => setShowEditor(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-medium text-base transition-colors">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold text-base hover:bg-brand-hover disabled:opacity-50 transition-colors">
                {saving ? t('cashClose.saving') : editBom ? t('manufacturing.saveBomChanges') : t('manufacturing.createBom')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailBom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{detailBom.productName}</h2>
                <p className="text-sm text-text-secondary">{t('manufacturing.outputPerBatch', { qty: detailBom.outputQty, unit: t('common.units') })}</p>
              </div>
              <button onClick={() => setDetailBom(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-text-secondary uppercase">
                    <th className="text-left pb-2">{t('manufacturing.material')}</th>
                    <th className="text-right pb-2">{t('manufacturing.quantity')}</th>
                    <th className="text-right pb-2">{t('manufacturing.wastagePercent')}</th>
                    <th className="text-right pb-2">{t('manufacturing.effectiveQty')}</th>
                    <th className="text-right pb-2">{t('common.cost')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detailBom.items.map(item => (
                    <tr key={item.id}>
                      <td className="py-2 font-medium text-text-primary">{item.materialName}</td>
                      <td className="py-2 text-right text-text-secondary">{item.quantityNeeded} {item.materialUnit}</td>
                      <td className="py-2 text-right text-text-secondary">{item.wastagePercent > 0 ? `${item.wastagePercent}%` : '—'}</td>
                      <td className="py-2 text-right text-text-primary">{item.effectiveQty.toFixed(3)} {item.materialUnit}</td>
                      <td className="py-2 text-right text-text-primary">{formatCurrency(item.lineCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border">
                  <tr>
                    <td colSpan={4} className="pt-3 font-semibold text-text-primary">{t('manufacturing.totalMaterialCost')}</td>
                    <td className="pt-3 text-right font-bold text-brand text-base">{formatCurrency(detailBom.totalMaterialCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
