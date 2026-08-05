import React, { useEffect, useState } from 'react'
import {
  Package, Users, Truck, BarChart3, DollarSign,
  Upload, ArrowRight, ArrowLeft, Download, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, FileSpreadsheet, Info
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

const MODULE_ICONS: Record<ImportModule, React.ReactNode> = {
  products: <Package size={22} />,
  customers: <Users size={22} />,
  suppliers: <Truck size={22} />,
  inventory: <BarChart3 size={22} />,
  openingBalances: <DollarSign size={22} />,
}

const MODULE_KEYS: ImportModule[] = ['products', 'customers', 'suppliers', 'inventory', 'openingBalances']

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
  const { t } = useTranslation()
  const MODULE_LABELS: Record<ImportModule, string> = {
    products: t('import.moduleProducts'),
    customers: t('import.moduleCustomers'),
    suppliers: t('import.moduleSuppliers'),
    inventory: t('import.moduleInventory'),
    openingBalances: t('import.moduleOpeningBalances'),
  }
  const MODULE_DESCS: Record<ImportModule, string> = {
    products: t('import.moduleProductsDesc'),
    customers: t('import.moduleCustomersDesc'),
    suppliers: t('import.moduleSuppliersDesc'),
    inventory: t('import.moduleInventoryDesc'),
    openingBalances: t('import.moduleOpeningBalancesDesc'),
  }
  const MODULES: { key: ImportModule; label: string; desc: string; icon: React.ReactNode }[] =
    MODULE_KEYS.map((key) => ({ key, label: MODULE_LABELS[key], desc: MODULE_DESCS[key], icon: MODULE_ICONS[key] }))
  const STEPS = [t('import.stepChooseModule'), t('import.stepUploadFile'), t('import.stepMapColumns'), t('import.stepPreview'), t('import.stepConfirm'), t('import.stepResults')]

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
        setError((res.error as { message?: string })?.message ?? t('import.couldNotLoadFields'))
      }
    }).catch(() => {
      if (!cancelled) setError(t('import.couldNotLoadFields'))
    })
    return () => { cancelled = true }
  }, [selectedModule])

  // ── Step 2: Upload file ──────────────────────────────────────────────────

  async function handleUpload() {
    if (!selectedModule) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.import.parseFile({ module: selectedModule })
      if (res.success && res.data) {
        const d = res.data as ParsedData
        setParsed(d)
        setMapping(d.suggestedMapping)
        setStep(2)
      } else if ((res.error as { code?: string })?.code !== 'IMP-000') {
        setError((res.error as { message?: string })?.message ?? t('import.couldNotReadFile'))
      }
    } catch {
      setError(t('import.couldNotReadFile'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (!selectedModule) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const filePath = fileUtils.getPathForFile(file)
    if (!filePath) { setError(t('import.couldNotReadDroppedFile')); return }
    setLoading(true)
    setError(null)
    try {
      const res = await api.import.parseDroppedFile({ module: selectedModule, filePath })
      if (res.success && res.data) {
        const d = res.data as ParsedData
        setParsed(d)
        setMapping(d.suggestedMapping)
        setStep(2)
      } else if ((res.error as { code?: string })?.code !== 'IMP-000') {
        setError((res.error as { message?: string })?.message ?? t('import.couldNotReadFile'))
      }
    } catch {
      setError(t('import.couldNotReadFile'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadTemplate() {
    if (!selectedModule) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.import.downloadTemplate({ module: selectedModule })
      if (!res.success && (res.error as { code?: string })?.code !== 'IMP-000') {
        setError((res.error as { message?: string })?.message ?? t('import.couldNotGenerateTemplate'))
      }
    } catch {
      setError(t('import.couldNotGenerateTemplate'))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3 → 4: Validate preview ─────────────────────────────────────────

  async function handlePreview() {
    if (!parsed || !selectedModule) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.import.validatePreview({ sessionId: parsed.sessionId, mapping, module: selectedModule })
      if (res.success && res.data) {
        setPreviewData(res.data as PreviewData)
        setStep(3)
      } else {
        setError((res.error as { message?: string })?.message ?? t('import.previewFailed'))
      }
    } catch {
      setError(t('import.previewFailed'))
    } finally {
      setLoading(false)
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
        setError((res.error as { message?: string })?.message ?? t('import.importFailed'))
      }
    } catch {
      setError(t('import.importFailed'))
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
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('import.title')}</h2>
          <p className="text-sm text-slate-400">{t('import.subtitle')}</p>
        </div>
        {step > 0 && step < 5 && (
          <button onClick={reset} className="text-xs text-slate-400 hover:text-brand transition-colors">
            {t('import.startOver')}
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
                    'text-start rounded-xl border p-5 flex items-start gap-4 transition-all hover:shadow-sm',
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
                {t('import.nextUploadFile')} <ArrowRight size={14} />
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
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('import.uploadTitle', { module: MODULE_LABELS[selectedModule] })}</h3>
              <p className="text-xs text-slate-400 mb-6">{t('import.uploadHint')}</p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleUpload} disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? t('import.readingFile') : t('import.browseFile')}
                </button>
                <button onClick={handleDownloadTemplate} disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
                  <Download size={14} />
                  {t('import.downloadTemplate')}
                </button>
              </div>
            </div>

            {/* Field guide — fetched live from the backend so this can never
                drift out of sync with what the import engine actually accepts */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-semibold text-dark dark:text-slate-100 mb-3">{t('import.expectedColumnsFor', { module: MODULE_LABELS[selectedModule] })}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {moduleFields === null
                  ? <p className="text-xs text-slate-400 col-span-full">{t('import.loadingFields')}</p>
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
              <p>{t('import.leadingZeroWarning')}</p>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                <ArrowLeft size={14} /> {t('common.back')}
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
                  <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('import.mapColumnsTitle')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t('import.rowsAndColumnsDetected', { rows: parsed.totalRows, columns: parsed.headers.length })}</p>
                </div>
                <span className="text-xs text-brand font-medium bg-brand/5 px-2.5 py-1 rounded-full">
                  {t('import.fieldsMapped', { mapped: Object.keys(mapping).length, total: parsed.headers.length })}
                </span>
              </div>

              <div className="p-5 space-y-3">
                {parsed.templateFields.map(field => {
                  const currentHeader = Object.entries(mapping).find(([, v]) => v === field.key)?.[0] ?? ''
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="w-48 shrink-0">
                        <p className="text-xs font-medium text-dark dark:text-slate-100">{field.label}</p>
                        {field.required && <span className="text-xs text-danger">{t('import.required')}</span>}
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
                          <option value="">{t('import.notMapped')}</option>
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
                <ArrowLeft size={14} /> {t('common.back')}
              </button>
              <button onClick={handlePreview} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                {loading ? t('import.validating') : t('import.previewData')} {!loading && <ArrowRight size={14} />}
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
                {t('import.validInSample', { count: previewData.validCount })}
              </Badge>
              {previewData.warningCount > 0 && (
                <Badge variant="warning" icon={<AlertTriangle size={13} />}>
                  {t('import.duplicatesInSample', { count: previewData.warningCount })}
                </Badge>
              )}
              {previewData.invalidCount > 0 && (
                <Badge variant="danger" icon={<XCircle size={13} />}>
                  {t('import.invalidInSample', { count: previewData.invalidCount })}
                </Badge>
              )}
              <Badge variant="neutral">{t('import.totalRows', { count: previewData.totalCount })}</Badge>
            </div>

            <p className="text-xs text-slate-400">{t('import.previewSampleHint', { count: previewData.totalCount })}</p>

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
                      {row.status === 'valid' ? t('import.rowValid') : row.status === 'warning' ? t('import.rowDuplicate') : t('import.rowError')}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                <ArrowLeft size={14} /> {t('common.back')}
              </button>
              <button onClick={() => setStep(4)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
                {t('import.confirmImport')} <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Confirm ────────────────────────────────────────────────── */}
        {step === 4 && previewData && selectedModule && parsed && (
          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('import.importSummary')}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 dark:text-slate-400">{t('import.module')}</span>
                  <span className="font-semibold text-dark dark:text-slate-100">{MODULE_LABELS[selectedModule]}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 dark:text-slate-400">{t('import.totalRowsInFile')}</span>
                  <span className="font-semibold text-dark dark:text-slate-100">{previewData.totalCount}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 dark:text-slate-400">{t('import.validRowsSampled')}</span>
                  <span className="font-semibold text-success">{t('import.ofSampled', { valid: previewData.validCount, sampled: Math.min(20, previewData.totalCount) })}</span>
                </div>
                {previewData.warningCount > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-500 dark:text-slate-400">{t('import.duplicateRowsInSample')}</span>
                    <span className="font-semibold text-warning">{previewData.warningCount}</span>
                  </div>
                )}
                {previewData.invalidCount > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-slate-500 dark:text-slate-400">{t('import.invalidRowsInSample')}</span>
                    <span className="font-semibold text-danger">{previewData.invalidCount}</span>
                  </div>
                )}
              </div>
              {previewData.totalCount > 20 && (
                <p className="text-xs text-slate-400 mt-3">{t('import.remainingRowsHint', { count: previewData.totalCount - 20 })}</p>
              )}
            </Card>

            <div className="bg-brand/5 border border-brand/15 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
              <CheckCircle2 size={14} className="text-brand shrink-0 mt-0.5" />
              <p>{t('import.safetyBackupNotice')}</p>
            </div>

            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3 text-xs text-warning">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>{t('import.createOnlyWarning')}</p>
            </div>

            {loading && progress && (
              <Card padding="md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-dark dark:text-slate-100">
                    {progress.processed === 0 ? t('import.checkingBackup') : t('import.importingProgress', { processed: progress.processed.toLocaleString(), total: progress.total.toLocaleString() })}
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
                <ArrowLeft size={14} /> {t('common.back')}
              </button>
              <button onClick={handleExecute} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                {loading ? t('import.importing') : t('import.runImport')}
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
                  {importResult.imported > 0 ? t('import.importComplete') : t('import.importFinishedWithIssues')}
                </h3>
              </div>

              {/* Result cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <KpiCard label={t('import.imported')} value={importResult.imported} color="success" />
                <KpiCard label={t('import.skipped')} value={importResult.skipped} color="warning" />
                <KpiCard label={t('import.failed')} value={importResult.failed} color="danger" />
                <KpiCard label={t('import.warnings')} value={importResult.warnings} color="neutral" />
              </div>

              {/* Backup notice */}
              {importResult.backupCreated && (
                <div className="bg-brand/5 border border-brand/15 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-brand shrink-0" />
                  {t('import.backupCoversImport', { id: importResult.backupId?.slice(-8) ?? '' })}
                </div>
              )}

              {/* Error list */}
              {importResult.errors.length > 0 && (
                <div className="border border-danger/20 rounded-xl overflow-hidden">
                  <div className="bg-danger/5 px-4 py-2.5 border-b border-danger/10">
                    <p className="text-xs font-semibold text-danger">{t('import.rowErrors', { count: importResult.errors.length })}</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2 flex items-start gap-2 text-xs">
                        <span className="text-slate-400 shrink-0 w-10">{t('import.rowN', { row: e.row })}</span>
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
                {t('import.importAnotherFile')}
              </button>
              <button onClick={reset}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
                {t('import.done')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aszurex footer */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-medium text-brand inline-flex items-center gap-1.5">
          {t('common.offlineFooterBrand')} <AszurexMark width={12} />
        </p>
        <p className="text-xs text-slate-400">{t('common.offlineFooterTagline')}</p>
      </div>
    </div>
  )
}
