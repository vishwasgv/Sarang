import React, { useState, useEffect, useCallback } from 'react'
import { Shield, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { cn } from '@shared/utils/cn'
import { formatDateTime } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface AuditLog {
  id: string
  userId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
  createdAt: string
  user?: { fullName: string; username: string } | null
}

// Audit `action` is an open-ended free-text log field written from 75+ service
// files across the app (not a bounded enum) — this map only covers the small
// set of actions worth highlighting distinctly; every other action legitimately
// falls back to the neutral variant below, it isn't a missed enum value.
const ACTION_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'brand' | 'neutral'> = {
  USER_LOGIN: 'brand',
  USER_LOGOUT: 'neutral',
  USER_AUTO_LOGIN: 'brand',
  INVOICE_CREATED: 'success',
  INVOICE_CANCELLED: 'danger',
  PAYMENT_RECORDED: 'success',
  PAYMENT_REVERSED: 'warning',
  INVENTORY_ADD_STOCK: 'success',
  INVENTORY_ADJUST_STOCK: 'warning',
  BACKUP_CREATED: 'brand',
  BACKUP_RESTORE_STARTED: 'warning',
  PASSWORD_CHANGED: 'warning',
}

const PAGE_SIZE = 50

export function AuditLogsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; verifiedCount: number; brokenAt?: { id: string; reason: string } } | null>(null)

  async function handleVerifyChain() {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await window.api.audit.verifyChain()
      if (res.success) setVerifyResult(res.data as typeof verifyResult)
      else toastError(t('common.error'), (res.error as { message?: string })?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setVerifying(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PAGE_SIZE
      // Fetch PAGE_SIZE + 1 to detect if more pages exist
      const res = await window.api.audit.list({ limit: PAGE_SIZE + 1, offset, entityType: entityTypeFilter || undefined })
      if (res.success) {
        const rows = (res.data as AuditLog[]) ?? []
        const hasMore = rows.length > PAGE_SIZE
        setLogs(hasMore ? rows.slice(0, PAGE_SIZE) : rows)
        setTotal(offset + rows.length)
      } else {
        toastError(t('common.error'), (res.error as { message?: string })?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [page, entityTypeFilter, toastError, t])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function formatValue(v: string | null) {
    if (!v) return null
    try { return JSON.stringify(JSON.parse(v), null, 2) } catch { return v }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Shield size={20} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('audit.title')}</h1>
            <p className="text-sm text-slate-500">{t('audit.eventsRecorded', { count: total.toLocaleString() })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={entityTypeFilter}
            onChange={e => { setEntityTypeFilter(e.target.value); setPage(1) }}
          >
            <option value="">{t('audit.allEntityTypes')}</option>
            {[
              // 'Setting' removed — no code path ever writes an audit log with this
              // entityType (settings.service.ts has no audit calls at all), so it
              // was a dangling filter option that would always return zero results.
              'User', 'Invoice', 'Payment', 'Inventory', 'Product', 'Customer', 'Supplier', 'Backup',
              'Quotation', 'CreditNote', 'DebitNote', 'PurchaseOrder', 'Expense',
              'ProductCategory', 'TaxConfiguration', 'BusinessProfile', 'DailyCashClose', 'Import',
              'Appointment', 'Placement', 'Candidate', 'JobOrder',
              'LegalCase', 'Hearing', 'StaffCommission',
              'Pet', 'VaccinationRecord', 'VisitNote',
              'ToothRecord', 'TreatmentPlan', 'RecallRecord',
              'TreatmentPhase', 'ExerciseProgram', 'ClientSessionPack',
              'CoachingBatch', 'CoachingFeeRecord', 'StudentProfile', 'CoachingBatchEnrollment',
              'TimeEntry', 'RetainerAgreement', 'Lead',
              'Membership', 'ServiceCatalog', 'BatchClass',
              'DrivingVehicle', 'DrivingSession', 'DrivingTest',
              'ComplianceTask', 'Engagement', 'ROCFiling', 'BoardMeeting',
              'ServiceProject', 'ServiceProjectMilestone', 'Issue', 'Sprint',
              'Property', 'PropertyDeal', 'PropertyInquiry',
              'ShootBooking', 'EventBooking', 'EventVendorBooking',
              'CarJobCard', 'TailoringOrder', 'MeasurementRecord',
              'PestServiceContract', 'PestJobSheet',
            ].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={handleVerifyChain} disabled={verifying}>
            <Shield size={14} className={cn('mr-1.5', verifying && 'animate-spin')} /> {verifying ? t('audit.verifying') : t('audit.verifyIntegrity')}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={cn('mr-1.5', loading && 'animate-spin')} /> {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Chain verification result — on-demand only, not run automatically on
          load (walking the whole table is real work; a manual click matches
          this project's convention for anything that isn't itself time-sensitive) */}
      {verifyResult && (
        <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium',
          verifyResult.ok ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20')}>
          {verifyResult.ok ? <ShieldCheck size={16} className="shrink-0" /> : <ShieldAlert size={16} className="shrink-0" />}
          <span>
            {verifyResult.ok
              ? t('audit.chainIntact', { count: verifyResult.verifiedCount })
              : t('audit.chainBroken', { count: verifyResult.verifiedCount, id: verifyResult.brokenAt?.id.slice(0, 8) ?? '?' })}
          </span>
        </div>
      )}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-40">{t('audit.time')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('audit.action')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-32">{t('audit.entity')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-32">{t('audit.user')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-16">{t('common.details')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{t('audit.noLogs')}</td></tr>
            ) : logs.map(log => (
              <React.Fragment key={log.id}>
                <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ACTION_VARIANT[log.action] ?? 'neutral'} size="sm">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {log.entityType && <span className="font-medium">{log.entityType}</span>}
                    {log.entityId && <span className="block text-slate-400 truncate max-w-[120px]">{log.entityId.slice(0, 8)}…</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {log.user ? (
                      <span>{log.user.fullName}</span>
                    ) : (
                      <span className="text-slate-400">{t('audit.system')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(log.newValue || log.oldValue) && (
                      <button
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="text-xs text-brand hover:underline"
                      >
                        {expanded === log.id ? t('audit.hide') : t('common.view')}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr className="bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid grid-cols-2 gap-4">
                        {log.oldValue && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">{t('audit.oldValue')}</p>
                            <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200 dark:border-slate-700 overflow-x-auto max-h-40">{formatValue(log.oldValue)}</pre>
                          </div>
                        )}
                        {log.newValue && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-1">{t('audit.newValue')}</p>
                            <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200 dark:border-slate-700 overflow-x-auto max-h-40">{formatValue(log.newValue)}</pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {t('audit.showing')} {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} {t('audit.of')} {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('audit.page')} {page} {t('audit.of')} {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
