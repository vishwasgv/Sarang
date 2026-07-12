import React, { useEffect, useState } from 'react'
import {
  Package, Users, Truck, BarChart3, DollarSign,
  Upload, ArrowRight, ArrowLeft, Download, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, FileSpreadsheet, Info
} from 'lucide-react'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { motion, AnimatePresence } from 'framer-motion'
import { api, fileUtils, onPushEvent } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Select } from '@shared/ui/atoms/Select'
type ImportModule = 'products' | 'customers' | 'suppliers' | 'inventory' | 'openingBalances'
interface ImportField { key: string; label: string; required: boolean; description?: string }
interface ImportPreviewRow { rowIndex: number; status: 'valid' | 'invalid' | 'warning'; errors: string[]; warnings: string[]; data: Record<string, unknown> }
interface ImportResult { imported: number; skipped: number; failed: number; warnings: number; errors: Array<{ row: number; message: string }>; backupCreated: boolean; backupId?: string }
interface ImportProgress { processed: number; total: number }

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MODULES: { key: ImportModule; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'products', label: 'Products', desc: 'Import product catalog with prices, categories, and units', icon: <Package size={22} /> },
  { key: 'customers', label: 'Customers', desc: 'Import customer list with contact details and credit limits', icon: <Users size={22} /> },
  { key: 'suppliers', label: 'Suppliers', desc: 'Import supplier list with contact and tax information', icon: <Truck size={22} /> },
  { key: 'inventory', label: 'Inventory', desc: 'Add opening stock quantities by product SKU', icon: <BarChart3 size={22} /> },
  { key: 'openingBalances', label: 'Opening Balances', desc: 'Set customer opening debit/credit balances', icon: <DollarSign size={22} /> },
]

const MODULE_LABELS: Record<ImportModule, string> = {
  products: 'Products',
  customers: 'Customers',
  suppliers: 'Suppliers',
  inventory: 'Inventory',
  openingBalances: 'Opening Balances',
}

const STEPS = ['Choose Module', 'Upload File', 'Map Columns', 'Preview', 'Confirm', 'Results']

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedData {
  sessionId: string
  headers: string[]
  preview: Record<string, string>[]
  totalRows: number
  suggestedMapping: Record<string, string>
  templateFields: ImportField[]
}

interface PreviewData {
  rows: ImportPreviewRow[]
  validCount: number
  invalidCount: number
  warningCount: number
  totalCount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// ImportWizardScreen
// ─────────────────────────────────────────────────────────────────────────────

export function ImportWizardScreen() {
  const [step, setStep] = useState(0)
  const [selectedModule, setSelectedModule] = useState<ImportModule | null>(null)
  const [moduleFields, setModuleFields] = useState<ImportField[] | null>(null)
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  function reset() {
    setStep(0)
    setSelectedModule(null)
    setModuleFields(null)
    setParsed(null)
    setMapping({})
    setPreviewData(null)
    setImportResult(null)
    setError(null)
    setProgress(null)
  }

  // Fetch the module's expected-column list from the backend the moment a
  // module is picked, instead of keeping a second hardcoded copy in this file
  // — that copy previously drifted out of sync with the real field list (a
  // backend-only `unitCost` field for Inventory was never added here).
  useEffect(() => {
    if (!selectedModule) { setModuleFields(null); return }
    let cancelled = false
    api.import.getFields({ module: selectedModule }).then(res => {
      if (cancelled) return
      if (res.success && res.data) {
        setModuleFields(res.data)
      } else {
        setError((res.error as { message?: string })?.message ?? 'Could not load the field list for this module.')
      }
    }).catch(() => {
      if (!cancelled) setError('Could not load the field list for this module.')
    })
    return () => { cancelled = true }
  }, [selectedModule])

  // ── Step 2: Upload file ──────────────────────────────────────────────────

  async function handleUpload() {
    if (!selectedModule) return
    setLoading(true)
    setError(null)
    const res = await api.import.parseFile({ module: selectedModule })
    setLoading(false)
    if (res.success && res.data) {
      const d = res.data as ParsedData
      setParsed(d)
      setMapping(d.suggestedMapping)
      setStep(2)
    } else if ((res.error as { code?: string })?.code !== 'IMP-000') {
      setError((res.error as { message?: string })?.message ?? 'Could not read file.')
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (!selectedModule) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const filePath = fileUtils.getPathForFile(file)
    if (!filePath) { setError('Could not read the dropped file. Try using Browse File instead.'); return }
    setLoading(true)
    setError(null)
    const res = await api.import.parseDroppedFile({ module: selectedModule, filePath })
    setLoading(false)
    if (res.success && res.data) {
      const d = res.data as ParsedData
      setParsed(d)
      setMapping(d.suggestedMapping)
      setStep(2)
    } else if ((res.error as { code?: string })?.code !== 'IMP-000') {
      setError((res.error as { message?: string })?.message ?? 'Could not read file.')
    }
  }

  async function handleDownloadTemplate() {
    if (!selectedModule) return
    setLoading(true)
    const res = await api.import.downloadTemplate({ module: selectedModule })
    setLoading(false)
    if (!res.success && (res.error as { code?: string })?.code !== 'IMP-000') {
      setError((res.error as { message?: string })?.message ?? 'Could not generate template.')
    }
  }

  // ── Step 3 → 4: Validate preview ─────────────────────────────────────────

  async function handlePreview() {
    if (!parsed || !selectedModule) return
    setLoading(true)
    setError(null)
    const res = await api.import.validatePreview({ sessionId: parsed.sessionId, mapping, module: selectedModule })
    setLoading(false)
    if (res.success && res.data) {
      setPreviewData(res.data as PreviewData)
      setStep(3)
    } else {
      setError((res.error as { message?: string })?.message ?? 'Preview failed.')
    }
  }

  // ── Step 5: Execute import ────────────────────────────────────────────────

  async function handleExecute() {
    if (!parsed || !selectedModule) return
    setLoading(true)
    setError(null)
    setProgress({ processed: 0, total: parsed.totalRows })
    const unsubscribe = onPushEvent('import:progress', (...args) => {
      const p = args[0] as ImportProgress | undefined
      if (p) setProgress(p)
    })
    try {
      const res = await api.import.execute({ sessionId: parsed.sessionId, mapping, module: selectedModule })
      if (res.success && res.data) {
        setImportResult(res.data as ImportResult)
        setStep(5)
      } else {
        setError((res.error as { message?: string })?.message ?? 'Import failed.')
      }
    } finally {
      unsubscribe()
      setLoading(false)
      setProgress(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">Data Import Wizard</h2>
          <p className="text-sm text-slate-400">Import products, customers, suppliers, inventory, and opening balances</p>
        </div>
        {step > 0 && step < 5 && (
          <button onClick={reset} className="text-xs text-slate-400 hover:text-brand transition-colors">
            Start Over
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              i === step ? 'bg-brand text-white' :
              i < step ? 'bg-success/10 text-success' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            )}>
              {i < step ? <CheckCircle2 size={11} /> : <span className="w-4 text-center">{i + 1}</span>}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={cn('flex-1 h-px', i < step ? 'bg-success/30' : 'bg-slate-200')} />}
          </React.Fragment>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-danger">
          <XCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── Step 0: Choose Module ──────────────────────────────────────────── */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MODULES.map(m => (
                <button key={m.key}
                  onClick={() => setSelectedModule(m.key)}
                  className={cn(
                    'text-left rounded-xl border p-5 flex items-start gap-4 transition-all hover:shadow-sm',
                    selectedModule === m.key ? 'border-brand bg-brand/5 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand/40'
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    selectedModule === m.key ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}>
                    {m.icon}
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold', selectedModule === m.key ? 'text-brand' : 'text-dark dark:text-slate-100')}>{m.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={() => setStep(1)} disabled={!selectedModule}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Next: Upload File <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 1: Upload File ────────────────────────────────────────────── */}
        {step === 1 && selectedModule && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                isDragging ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700'
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet size={28} className="text-brand" />
              </div>
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">Upload {MODULE_LABELS[selectedModule]} File</h3>
              <p className="text-xs text-slate-400 mb-6">Drag & drop a CSV or Excel (.xlsx) file here, or</p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleUpload} disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? 'Reading file…' : 'Browse File'}
                </button>
                <button onClick={handleDownloadTemplate} disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
                  <Download size={14} />
                  Download Template
                </button>
              </div>
            </div>

            {/* Field guide — fetched live from the backend so this can never
                drift out of sync with what the import engine actually accepts */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-semibold text-dark dark:text-slate-100 mb-3">Expected columns for {MODULE_LABELS[selectedModule]}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {moduleFields === null
                  ? <p className="text-xs text-slate-400 col-span-full">Loading…</p>
                  : moduleFields.map(f => (
                    <div key={f.key} className="flex items-center gap-1.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', f.required ? 'bg-danger' : 'bg-slate-300')} />
                      <span className="text-xs text-slate-600 dark:text-slate-300">{f.label}</span>
                      {f.required && <span className="text-xs text-danger">*</span>}
                    </div>
                  ))}
              </div>
            </div>

            {/* Excel leading-zero caution — this is a real, common data-loss
                trap: if a source column (SKU, phone, barcode) is General/Number
                formatted in Excel, values like "0012" are stored as 12 before
                this app ever sees the file, and the leading zero cannot be
                recovered by any importer. */}
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-3 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Info size={14} className="text-warning shrink-0 mt-0.5" />
              <p>If your SKU, Barcode, or Phone codes have leading zeros (e.g. "0012"), format that column as <strong>Text</strong> in Excel before saving — otherwise Excel strips the leading zeros before this file ever reaches Sarang.</p>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Column Mapping ─────────────────────────────────────────── */}
        {step === 2 && parsed && selectedModule && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card padding="none">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-dark dark:text-slate-100">Map Columns</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{parsed.totalRows} rows detected · {parsed.headers.length} columns</p>
                </div>
                <span className="text-xs text-brand font-medium bg-brand/5 px-2.5 py-1 rounded-full">
                  {Object.keys(mapping).length} of {parsed.headers.length} mapped
                </span>
              </div>

              <div className="p-5 space-y-3">
                {parsed.templateFields.map(field => {
                  const currentHeader = Object.entries(mapping).find(([, v]) => v === field.key)?.[0] ?? ''
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="w-48 shrink-0">
                        <p className="text-xs font-medium text-dark dark:text-slate-100">{field.label}</p>
                        {field.required && <span className="text-xs text-danger">Required</span>}
                        {field.description && <p className="text-xs text-slate-400">{field.description}</p>}
                      </div>
                      <div className="flex-1">
                        <Select
                          value={currentHeader}
                          onChange={e => {
                            const newHeader = e.target.value
                            const newMapping = { ...mapping }
                            // Remove old assignment for this field
                            Object.keys(newMapping).forEach(h => { if (newMapping[h] === field.key) delete newMapping[h] })
                            // Set new assignment
                            if (newHeader) {
                              // Remove any existing assignment for this header
                              if (newMapping[newHeader]) delete newMapping[newHeader]
                              newMapping[newHeader] = field.key
                            }
                            setMapping(newMapping)
                          }}
                        >
                          <option value="">— Not mapped —</option>
                          {parsed.headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handlePreview} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                {loading ? 'Validating…' : 'Preview Data'} {!loading && <ArrowRight size={14} />}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Preview ────────────────────────────────────────────────── */}
        {step === 3 && previewData && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Summary chips */}
            <div className="flex gap-3 flex-wrap">
              <Badge variant="success" icon={<CheckCircle2 size={13} />}>
                {previewData.validCount} Valid (sample)
              </Badge>
              {previewData.warningCount > 0 && (
                <Badge variant="warning" icon={<AlertTriangle size={13} />}>
                  {previewData.warningCount} Duplicates in sample (will be skipped)
                </Badge>
              )}
              {previewData.invalidCount > 0 && (
                <Badge variant="danger" icon={<XCircle size={13} />}>
                  {previewData.invalidCount} Invalid in sample (will be skipped)
                </Badge>
              )}
              <Badge variant="neutral">{previewData.totalCount} Total rows</Badge>
            </div>

            <p className="text-xs text-slate-400">Showing first 20 rows. All {previewData.totalCount} rows will be processed on import.</p>

            <Card padding="none" className="overflow-hidden">
              <div className="divide-y divide-slate-50">
                {previewData.rows.map(row => (
                  <div key={row.rowIndex} className={cn(
                    'px-5 py-3 flex items-start gap-3',
                    row.status === 'invalid' ? 'bg-danger/3' :
                    row.status === 'warning' ? 'bg-warning/3' : ''
                  )}>
                    <span className="text-xs text-slate-400 w-8 shrink-0 pt-0.5">#{row.rowIndex}</span>
                    {row.status === 'valid'
                      ? <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
                      : row.status === 'warning'
                      ? <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                      : <XCircle size={14} className="text-danger shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-dark dark:text-slate-100 font-medium">
                        {Object.values(row.data).filter(Boolean).slice(0, 3).join(' · ')}
                      </div>
                      {row.errors.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {row.errors.map((e, i) => <p key={i} className="text-xs text-danger">{e}</p>)}
                        </div>
                      )}
                      {row.warnings.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {row.warnings.map((w, i) => <p key={i} className="text-xs text-warning">{w}</p>)}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={row.status === 'valid' ? 'success' : row.status === 'warning' ? 'warning' : 'danger'}
                      size="sm"
                      className="shrink-0"
                    >
                      {row.status === 'valid' ? 'Valid' : row.status === 'warning' ? 'Duplicate' : 'Error'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep(4)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
                Confirm Import <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Confirm ────────────────────────────────────────────────── */}
        {step === 4 && previewData && selectedModule && parsed && (
          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">Import Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 dark:text-slate-400">Module</span>
                  <span className="font-semibold text-dark dark:text-slate-100">{MODULE_LABELS[selectedModule]}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 dark:text-slate-400">Total rows in file</span>
                  <span className="font-semibold text-dark dark:text-slate-100">{previewData.totalCount}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 dark:text-slate-400">Valid rows in first 20 sampled</span>
                  <span className="font-semibold text-success">{previewData.validCount} of {Math.min(20, previewData.totalCount)}</span>
                </div>
                {previewData.warningCount > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-500 dark:text-slate-400">Duplicate rows in sample (will be skipped)</span>
                    <span className="font-semibold text-warning">{previewData.warningCount}</span>
                  </div>
                )}
                {previewData.invalidCount > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-500 dark:text-slate-400">Invalid rows in sample (will be skipped)</span>
                    <span className="font-semibold text-danger">{previewData.invalidCount}</span>
                  </div>
                )}
              </div>
              {previewData.totalCount > 20 && (
                <p className="text-xs text-slate-400 mt-3">Only the first 20 rows were validated for this preview. The remaining {previewData.totalCount - 20} rows will be validated as they're processed during the actual import — final counts may differ from the sample above.</p>
              )}
            </Card>

            <div className="bg-brand/5 border border-brand/15 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
              <CheckCircle2 size={14} className="text-brand shrink-0 mt-0.5" />
              <p>A <strong className="text-brand">safety backup</strong> from the last 15 minutes will be reused, or a fresh one created if none exists — no import proceeds without one.</p>
            </div>

            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3 text-xs text-warning">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>Import mode is <strong>Create Only</strong>. Existing records with duplicate keys will be skipped. This action cannot be undone (unless you restore from backup).</p>
            </div>

            {loading && progress && (
              <Card padding="md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-dark dark:text-slate-100">
                    {progress.processed === 0 ? 'Checking safety backup…' : `Importing… ${progress.processed.toLocaleString()} of ${progress.total.toLocaleString()} rows`}
                  </span>
                  <span className="text-xs text-slate-400">{progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-brand transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </Card>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors disabled:opacity-40">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleExecute} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                {loading ? 'Importing…' : 'Run Import'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 5: Results ────────────────────────────────────────────────── */}
        {step === 5 && importResult && (
          <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card padding="lg">
              {/* Big result icon */}
              <div className="text-center mb-6">
                {importResult.imported > 0
                  ? <CheckCircle2 size={36} className="text-success mx-auto mb-2" />
                  : <XCircle size={36} className="text-danger mx-auto mb-2" />}
                <h3 className="text-base font-bold text-dark dark:text-slate-100">
                  {importResult.imported > 0 ? 'Import Complete' : 'Import Finished with Issues'}
                </h3>
              </div>

              {/* Result cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <KpiCard label="Imported" value={importResult.imported} color="success" />
                <KpiCard label="Skipped" value={importResult.skipped} color="warning" />
                <KpiCard label="Failed" value={importResult.failed} color="danger" />
                <KpiCard label="Warnings" value={importResult.warnings} color="neutral" />
              </div>

              {/* Backup notice */}
              {importResult.backupCreated && (
                <div className="bg-brand/5 border border-brand/15 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-brand shrink-0" />
                  A safety backup covers this import (ID: <span className="font-mono">{importResult.backupId?.slice(-8)}</span>)
                </div>
              )}

              {/* Error list */}
              {importResult.errors.length > 0 && (
                <div className="border border-danger/20 rounded-xl overflow-hidden">
                  <div className="bg-danger/5 px-4 py-2.5 border-b border-danger/10">
                    <p className="text-xs font-semibold text-danger">Row Errors ({importResult.errors.length})</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2 flex items-start gap-2 text-xs">
                        <span className="text-slate-400 shrink-0 w-10">Row {e.row}</span>
                        <span className="text-danger">{e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="flex gap-3 justify-end">
              <button onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                Import Another File
              </button>
              <button onClick={reset}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aszurex footer */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-medium text-brand inline-flex items-center gap-1.5">
          Sarang Business OS Lite · Powered by Aszurex <AszurexMark width={12} />
        </p>
        <p className="text-xs text-slate-400">No cloud. No tracking. 100% offline.</p>
      </div>
    </div>
  )
}
