import React, { useState, useEffect } from 'react'
import { Search, Trash2, Printer, Barcode, Scale, XCircle } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'

interface Product {
  id: string; productName: string; sku?: string | null; barcode?: string | null
  sellingPrice: number; sellByWeight?: boolean; weightUnit?: string | null; pricePerWeightUnit?: number | null
}
interface LabelLine { product: Product; copies: number }

// Phase 38: Print Labels — batch barcode/price label printing (5.3/5.4) and the
// weigh-and-print flow for loose-billed products (5.6). Everything here is only
// reachable if barcode_printing is enabled (see router.tsx) — there is no path
// into this screen for a business that hasn't opted in.
export function PrintLabelsScreen() {
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  // Batch label printing
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [lines, setLines] = useState<LabelLine[]>([])
  const [outputMode, setOutputMode] = useState<'THERMAL_LABEL' | 'A4_SHEET'>('A4_SHEET')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Weigh-and-print
  const [looseQuery, setLooseQuery] = useState('')
  const [looseResults, setLooseResults] = useState<Product[]>([])
  const [looseProduct, setLooseProduct] = useState<Product | null>(null)
  const [weightGrams, setWeightGrams] = useState('')
  const [weighPrinting, setWeighPrinting] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await window.api.products.search(query)
        if (res.success) setResults(res.data as Product[])
        else toastError('Search Failed', res.error?.message ?? 'Could not search products.')
      } catch {
        toastError('Search Failed', 'Could not search products.')
      }
    }, 200)
    return () => clearTimeout(t)
  }, [query, toastError])

  useEffect(() => {
    if (!looseQuery.trim()) { setLooseResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await window.api.products.search(looseQuery)
        if (res.success) setLooseResults((res.data as Product[]).filter(p => p.sellByWeight))
        else toastError('Search Failed', res.error?.message ?? 'Could not search products.')
      } catch {
        toastError('Search Failed', 'Could not search products.')
      }
    }, 200)
    return () => clearTimeout(t)
  }, [looseQuery, toastError])

  function addLine(product: Product) {
    setLines(prev => {
      const existing = prev.find(l => l.product.id === product.id)
      if (existing) return prev.map(l => l.product.id === product.id ? { ...l, copies: Math.min(l.copies + 1, 500) } : l)
      return [...prev, { product, copies: 1 }]
    })
    setQuery('')
    setResults([])
  }

  function updateCopies(productId: string, copies: number) {
    if (copies <= 0) { setLines(prev => prev.filter(l => l.product.id !== productId)); return }
    // The input's max="500" HTML attribute only affects the spinner arrows —
    // typing/pasting a larger number bypasses it. Matches the server-side cap
    // in PrintLabelsSchema (products.validation.ts).
    const clamped = Math.min(copies, 500)
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, copies: clamped } : l))
  }

  function buildPayload() {
    const withoutBarcode = lines.filter(l => !l.product.barcode)
    if (withoutBarcode.length > 0) {
      toastError('Missing Barcodes', `${withoutBarcode.map(l => l.product.productName).join(', ')} — generate a barcode for these first (Products screen or Settings → Generate Missing Barcodes).`)
      return null
    }
    return {
      items: lines.map(l => ({ productId: l.product.id, copies: l.copies })),
      outputMode,
      fields: { showPrice: true, showBarcode: true, showName: true }
    }
  }

  async function handlePreview() {
    if (lines.length === 0) return
    const payload = buildPayload()
    if (!payload) return
    setBusy(true)
    try {
      const res = await window.api.print.previewLabels(payload)
      if (res.success) setPreviewHtml(res.data as string)
      else toastError('Preview Failed', res.error?.message ?? 'Could not generate preview.')
    } catch {
      toastError('Preview Failed', 'Could not generate preview.')
    } finally { setBusy(false) }
  }

  async function handlePrint() {
    const payload = buildPayload()
    if (!payload) return
    setBusy(true)
    try {
      const res = await window.api.print.labels(payload)
      if (res.success) {
        toastSuccess('Labels Printed', `${lines.reduce((s, l) => s + l.copies, 0)} label(s) sent to print.`)
        setPreviewHtml(null)
        setLines([])
      } else {
        toastError('Print Failed', res.error?.message ?? 'Could not print labels.')
      }
    } catch {
      toastError('Print Failed', 'Could not print labels.')
    } finally { setBusy(false) }
  }

  async function handleWeighAndPrint() {
    if (!looseProduct) return
    const grams = Math.round(parseFloat(weightGrams))
    if (!grams || grams < 1) { toastError('Invalid Weight', 'Enter a whole number of grams (at least 1).'); return }
    setWeighPrinting(true)
    try {
      const genRes = await window.api.products.generateWeightLabel({ productId: looseProduct.id, weightGrams: grams })
      if (!genRes.success) { toastError('Error', genRes.error?.message ?? 'Could not create the weight label.'); return }
      // The price is computed server-side (barcode.service.ts), not re-derived
      // here — a prior version hardcoded a /1000 conversion that was correct
      // for kg/L but silently 1000x-undercharged the printed price for any
      // product priced per gram or per millilitre.
      const { barcode, quantityInSellUnit, weightUnit, reprintPriceChanged } = genRes.data as { barcode: string; quantityInSellUnit: number; weightUnit: string; pricePerWeightUnit: number; preTaxAmount: number; reprintPriceChanged: boolean }
      const weightText = `${quantityInSellUnit} ${weightUnit}`
      const priceText = formatCurrency((genRes.data as { preTaxAmount: number }).preTaxAmount)
      // barcodeOverride/priceTextOverride print exactly the ad-hoc weight-embedded
      // code just generated above — never the product's own fixed Product.barcode,
      // which would be wrong for a one-off weighed parcel.
      const printRes = await window.api.print.labels({
        items: [{ productId: looseProduct.id, copies: 1, barcodeOverride: barcode, priceTextOverride: `${priceText} (${weightText})` }],
        outputMode: 'THERMAL_LABEL',
        fields: { showPrice: true, showBarcode: true, showName: true }
      })
      if (printRes.success) {
        toastSuccess('Label Printed', `Weight label for ${looseProduct.productName} (${grams}g) printed. Barcode: ${barcode}`)
        // A reprint at the exact same weight after a price change produces an
        // identical barcode to the earlier label — there's no way for a scan
        // to tell them apart afterward, so the only defense is catching it now,
        // while whoever is printing can still go pull the old sticker.
        if (reprintPriceChanged) {
          toastError(
            'Check the shelf for an old label',
            `A label for ${looseProduct.productName} at exactly ${grams}g was printed before at a different price. If that old label is still on the shelf, remove it — a customer bringing it to checkout will be charged the old price.`
          )
        }
      } else {
        toastError('Print Failed', printRes.error?.message ?? 'Label was generated but printing failed.')
      }
      setWeightGrams('')
      setLooseProduct(null)
      setLooseQuery('')
    } catch {
      toastError('Error', 'Could not print the weight label.')
    } finally { setWeighPrinting(false) }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
      <div>
        <h1 className="text-lg font-bold text-dark dark:text-slate-100 flex items-center gap-2"><Barcode size={20} /> Print Labels</h1>
        <p className="text-sm text-slate-500 mt-1">Print barcode + price labels for your products — on a thermal label printer or a regular A4/letter printer.</p>
      </div>

      {/* Batch label printing */}
      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search or scan a product to add…"
            className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {results.map(p => (
                <button key={p.id} onClick={() => addLine(p)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center justify-between">
                  <span>{p.productName}</span>
                  <span className="text-xs text-slate-400">{p.barcode ? p.barcode : 'No barcode yet'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
            {lines.map(l => (
              <div key={l.product.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-dark dark:text-slate-100">{l.product.productName}</p>
                  <p className="text-xs text-slate-400">{l.product.barcode ?? 'No barcode — will fail to print'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" min="1" max="500" value={l.copies}
                    onChange={e => updateCopies(l.product.id, parseInt(e.target.value) || 0)}
                    className="w-16 h-8 text-center text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                  <button onClick={() => updateCopies(l.product.id, 0)} className="text-slate-400 hover:text-danger transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}

        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {(['A4_SHEET', 'THERMAL_LABEL'] as const).map(m => (
              <button key={m} onClick={() => setOutputMode(m)}
                className={cn('px-4 py-2 text-xs font-medium transition-colors', outputMode === m ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>
                {m === 'A4_SHEET' ? 'A4 / Letter Sheet' : 'Thermal Label Printer'}
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={handlePreview} disabled={lines.length === 0} loading={busy}>Preview</Button>
          <Button onClick={handlePrint} disabled={lines.length === 0} loading={busy}>
            <Printer size={14} className="mr-1" /> Print {lines.reduce((s, l) => s + l.copies, 0) || ''} Label{lines.reduce((s, l) => s + l.copies, 0) === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      {/* Weigh-and-print for loose-billed products */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
        <h2 className="text-sm font-bold text-dark dark:text-slate-100 flex items-center gap-2"><Scale size={16} /> Weigh & Print a Loose Item</h2>
        <p className="text-xs text-slate-400">Weigh the item on any scale, enter the weight, and print a label with the price already worked out. Scanning it at checkout adds it to the bill in one scan.</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="relative w-64">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Product</label>
            <input
              value={looseProduct ? looseProduct.productName : looseQuery}
              onChange={e => { setLooseProduct(null); setLooseQuery(e.target.value) }}
              placeholder="Search loose-billed products…"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {looseResults.length > 0 && !looseProduct && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {looseResults.map(p => (
                  <button key={p.id} onClick={() => { setLooseProduct(p); setLooseResults([]) }} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">
                    {p.productName} <span className="text-xs text-slate-400">({formatCurrency(p.pricePerWeightUnit ?? 0)}/{p.weightUnit})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input label="Weight (grams)" type="number" min="1" max="99999" value={weightGrams} onChange={e => setWeightGrams(e.target.value)} className="w-40" />
          <Button onClick={handleWeighAndPrint} disabled={!looseProduct || !weightGrams} loading={weighPrinting}>
            <Printer size={14} className="mr-1" /> Print Label
          </Button>
        </div>
      </div>

      {/* Preview modal */}
      {previewHtml !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-bold text-dark dark:text-slate-100">Label Preview</h2>
              <button onClick={() => setPreviewHtml(null)} className="text-slate-400 hover:text-danger transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950 p-3">
              <iframe title="Label preview" srcDoc={previewHtml} className="w-full h-full bg-white rounded-lg border border-slate-200" style={{ minHeight: '60vh' }} />
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
              <Button variant="outline" onClick={() => setPreviewHtml(null)}>Cancel</Button>
              <Button onClick={handlePrint} loading={busy}>
                <Printer size={14} className="mr-1" /> Print
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
