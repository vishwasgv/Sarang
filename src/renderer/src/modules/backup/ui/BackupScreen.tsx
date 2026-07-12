import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  HardDrive, ShieldCheck, ShieldAlert, ShieldX, RefreshCw,
  Plus, RotateCcw, Trash2, CheckCircle2, XCircle, Clock,
  AlertTriangle, Database, Info
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@renderer/services/ipc-client'
import { AszurexMark } from '@shared/ui/atoms/Brand'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { formatDateTime } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
interface BackupRecord { id: string; backupName: string; backupPath: string; backupSize: number; backupDate: Date | string; backupVersion: string; schemaVersion: string | null; checksum: string | null; isValid: boolean; createdAt: Date | string }
interface BackupMetadata { appName: string; appVersion: string; schemaVersion: string; businessName: string; backupDate: string; dbChecksum: string; dbSizeBytes: number }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtFileName(b: BackupRecord): string {
  const parts = b.backupPath.split(/[\\/]/)
  return parts[parts.length - 1] || `${b.backupName}.sarang-backup`
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

const fmtDate = formatDateTime

function daysSince(d: Date | string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function healthStatus(backups: BackupRecord[]): 'good' | 'warning' | 'danger' {
  if (backups.length === 0) return 'danger'
  const days = daysSince(backups[0].backupDate)
  if (days === 0) return 'good'
  if (days <= 7) return 'warning'
  return 'danger'
}

// ─────────────────────────────────────────────────────────────────────────────
// BackupScreen
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_BACKUP_DEFAULTS = {
  auto_backup_enabled: 'false',
  auto_backup_interval_days: '7',
  backup_retention_count: '10',
  backup_reminder_days: '7'
}

export function BackupScreen() {
  const { t } = useTranslation()
  const hasPermission = useAuthStore(s => s.hasPermission)
  const canCreate = hasPermission('backup.create')
  const canRestore = hasPermission('backup.restore')
  const canDelete = hasPermission('backup.delete')
  const canConfigure = hasPermission('settings.modify')

  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [integrity, setIntegrity] = useState<{ ok: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null)
  const [restoreMeta, setRestoreMeta] = useState<BackupMetadata | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BackupRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const latestRestoreRequestId = useRef<string | null>(null)

  const [autoSettings, setAutoSettings] = useState(AUTO_BACKUP_DEFAULTS)
  const [savingSettings, setSavingSettings] = useState(false)
  const [destination, setDestination] = useState<{ configuredDir: string | null; effectiveDir: string; usedFallback: boolean } | null>(null)
  const [choosingFolder, setChoosingFolder] = useState(false)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const calls = [api.backup.list(), api.backup.checkIntegrity()]
      if (canConfigure) calls.push(api.settings.getAll(), api.backup.getDestination())
      const [listRes, intRes, settingsRes, destRes] = await Promise.all(calls)
      // Surface the first genuine failure only — the toast state below holds a
      // single message, so firing several toastError calls in the same tick would
      // just have the last one silently clobber the others.
      let firstError: { message?: string } | undefined
      if (listRes.success) setBackups((listRes.data as BackupRecord[]) ?? [])
      else firstError = firstError ?? (listRes.error as { message?: string })
      if (intRes.success) setIntegrity((intRes.data as { ok: boolean; message: string }) ?? null)
      else firstError = firstError ?? (intRes.error as { message?: string })
      if (settingsRes) {
        if (settingsRes.success) {
          const map = (settingsRes.data as Record<string, string>) ?? {}
          setAutoSettings({
            auto_backup_enabled: map.auto_backup_enabled ?? AUTO_BACKUP_DEFAULTS.auto_backup_enabled,
            auto_backup_interval_days: map.auto_backup_interval_days ?? AUTO_BACKUP_DEFAULTS.auto_backup_interval_days,
            backup_retention_count: map.backup_retention_count ?? AUTO_BACKUP_DEFAULTS.backup_retention_count,
            backup_reminder_days: map.backup_reminder_days ?? AUTO_BACKUP_DEFAULTS.backup_reminder_days
          })
        } else {
          firstError = firstError ?? (settingsRes.error as { message?: string })
        }
      }
      if (destRes) {
        if (destRes.success) setDestination(destRes.data as typeof destination)
        else firstError = firstError ?? (destRes.error as { message?: string })
      }
      if (firstError) showToast(firstError.message ?? t('common.error'), false)
    } catch {
      showToast(t('common.error'), false)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConfigure])

  useEffect(() => { load() }, [load])

  async function handleChooseFolder() {
    setChoosingFolder(true)
    try {
      const picked = await api.backup.pickDestinationFolder()
      if (picked.success && picked.data) {
        const res = await api.backup.setDestination({ path: (picked.data as { folderPath: string }).folderPath })
        if (res.success) { showToast(t('backup.destinationSaved'), true); await load() }
        else showToast((res.error as { message?: string })?.message ?? t('backup.destinationSaveFailed'), false)
      } else if (!picked.success) {
        // picked.success === true with data === null just means the user cancelled
        // the folder picker — not an error, so no toast for that branch.
        showToast((picked.error as { message?: string })?.message ?? t('backup.destinationSaveFailed'), false)
      }
    } catch {
      showToast(t('backup.destinationSaveFailed'), false)
    } finally {
      setChoosingFolder(false)
    }
  }

  async function handleResetDestination() {
    setChoosingFolder(true)
    try {
      const res = await api.backup.setDestination({ path: null })
      if (res.success) { showToast(t('backup.destinationReset'), true); await load() }
      else showToast((res.error as { message?: string })?.message ?? t('backup.destinationSaveFailed'), false)
    } catch {
      showToast(t('backup.destinationSaveFailed'), false)
    } finally {
      setChoosingFolder(false)
    }
  }

  async function handleSaveAutoSettings() {
    // The backend treats a non-positive-integer interval as NaN, and
    // `daysSinceBackup >= NaN` is always false in JS — an invalid value here
    // would silently disable auto-backup forever with no error anywhere.
    const numericFields: (keyof typeof autoSettings)[] = ['auto_backup_interval_days', 'backup_retention_count', 'backup_reminder_days']
    for (const key of numericFields) {
      const n = Number(autoSettings[key])
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        showToast(t('backup.settingsInvalidNumber'), false)
        return
      }
    }

    setSavingSettings(true)
    try {
      const entries = Object.entries(autoSettings) as [keyof typeof autoSettings, string][]
      const results = await Promise.all(entries.map(([key, value]) => api.settings.set({ key, value })))
      if (results.every(r => r.success)) {
        showToast(t('backup.settingsSaved'), true)
      } else {
        showToast(t('backup.settingsSaveFailed'), false)
      }
    } catch {
      showToast(t('backup.settingsSaveFailed'), false)
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await api.backup.create()
      if (res.success) {
        showToast(t('backup.backupCreated'), true)
        load()
      } else {
        showToast((res.error as { message?: string })?.message ?? t('backup.backupFailed'), false)
      }
    } catch {
      showToast(t('backup.backupFailed'), false)
    } finally {
      setCreating(false)
    }
  }

  async function handleValidate(backup: BackupRecord) {
    try {
      const res = await api.backup.validate({ backupId: backup.id })
      if (res.success) {
        const d = res.data as { valid: boolean; metadata?: BackupMetadata }
        // Note: intentionally does not touch restoreMeta — that state belongs to
        // the restore confirmation modal (openRestoreModal). If this "Verify" action
        // ran concurrently with a restore modal already open for a *different*
        // backup, resolving here could otherwise overwrite the modal's metadata
        // with the wrong backup's data while it's still on screen.
        showToast(d.valid ? t('backup.backupValid') : t('backup.backupInvalid'), d.valid)
        load()
      } else {
        showToast((res.error as { message?: string })?.message ?? t('backup.backupInvalid'), false)
      }
    } catch {
      showToast(t('backup.backupInvalid'), false)
    }
  }

  async function openRestoreModal(backup: BackupRecord) {
    // Guards against clicking "Restore" on two different rows in quick succession:
    // if the first click's validate() call resolves after the second's, it must
    // not overwrite the modal with the wrong backup's metadata/target.
    latestRestoreRequestId.current = backup.id
    try {
      const res = await api.backup.validate({ backupId: backup.id })
      if (latestRestoreRequestId.current !== backup.id) return
      if (res.success) {
        const d = res.data as { valid: boolean; metadata?: BackupMetadata }
        if (!d.valid) { showToast(t('backup.backupInvalid'), false); return }
        setRestoreMeta(d.metadata ?? null)
        setRestoreTarget(backup)
      } else {
        showToast((res.error as { message?: string })?.message ?? t('backup.backupInvalid'), false)
      }
    } catch {
      if (latestRestoreRequestId.current === backup.id) showToast(t('backup.backupInvalid'), false)
    }
  }

  async function handleRestore() {
    if (!restoreTarget) return
    setRestoring(true)
    setRestoreTarget(null)
    try {
      const res = await api.backup.restore({ backupId: restoreTarget.id })
      // If we reach here without app restart, something went wrong
      if (!res.success) {
        showToast((res.error as { message?: string })?.message ?? t('backup.restoreFailed'), false)
      }
    } catch {
      // A thrown/rejected IPC call here is just as much a failed restore as
      // res.success === false — surface it with the same message so the user
      // isn't left staring at a spinner that silently stopped.
      showToast(t('backup.restoreFailed'), false)
    } finally {
      setRestoring(false)
    }
  }

  async function handleDelete(backup: BackupRecord) {
    setDeletingId(backup.id)
    try {
      const res = await api.backup.delete({ id: backup.id })
      if (res.success) {
        showToast(t('backup.deleteBackup'), true)
        load()
      } else {
        showToast((res.error as { message?: string })?.message ?? t('common.error'), false)
      }
    } catch {
      showToast(t('common.error'), false)
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  const health = healthStatus(backups)
  const lastBackup = backups[0] ?? null

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('backup.title')}</h2>
          <p className="text-sm text-slate-400">{t('backup.description')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            {t('common.refresh')}
          </button>
          {canCreate && (
            <button onClick={handleCreate} disabled={creating || loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {creating ? t('backup.creating') : t('backup.createBackup')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Status Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Health */}
        <div className={cn('rounded-xl border p-5 flex items-start gap-4',
          health === 'good' ? 'bg-success/5 border-success/20' :
          health === 'warning' ? 'bg-warning/5 border-warning/20' : 'bg-danger/5 border-danger/20')}>
          {health === 'good'
            ? <ShieldCheck size={22} className="text-success shrink-0 mt-0.5" />
            : health === 'warning'
            ? <ShieldAlert size={22} className="text-warning shrink-0 mt-0.5" />
            : <ShieldX size={22} className="text-danger shrink-0 mt-0.5" />}
          <div>
            <p className={cn('text-sm font-semibold',
              health === 'good' ? 'text-success' : health === 'warning' ? 'text-warning' : 'text-danger')}>
              {health === 'good' ? t('backup.statusProtected') : health === 'warning' ? t('backup.statusOverdue') : t('backup.statusNoProtection')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {backups.length === 0
                ? t('backup.noBackupsFound')
                : daysSince(lastBackup.backupDate) === 0
                ? t('backup.backedUpToday')
                : t('backup.lastBackupDaysAgo', { days: daysSince(lastBackup.backupDate) })}
            </p>
          </div>
        </div>

        {/* Last Backup */}
        <Card padding="lg" className="flex items-start gap-4">
          <Clock size={22} className="text-brand shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('backup.lastBackup')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lastBackup ? fmtDate(lastBackup.backupDate) : t('backup.never')}
            </p>
          </div>
        </Card>

        {/* DB Integrity */}
        <div className={cn('rounded-xl border p-5 flex items-start gap-4',
          integrity === null ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' :
          integrity.ok ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20')}>
          <Database size={22} className={cn('shrink-0 mt-0.5',
            integrity === null ? 'text-slate-400' : integrity.ok ? 'text-success' : 'text-danger')} />
          <div>
            <p className={cn('text-sm font-semibold',
              integrity === null ? 'text-slate-500 dark:text-slate-400' : integrity.ok ? 'text-success' : 'text-danger')}>
              {integrity === null ? t('backup.checkingIntegrity') : integrity.ok ? t('backup.integrityOk') : t('backup.integrityIssue')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {integrity?.message ?? t('backup.verifyingDatabase')}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Corruption Recovery Banner ──────────────────────────────── */}
      {integrity && !integrity.ok && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 flex items-start gap-3">
          <ShieldX size={18} className="text-danger shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <p className="font-semibold text-danger">{t('backup.recoveryBannerTitle')}</p>
            <p>{integrity.message} {canRestore ? t('backup.recoveryBannerAdmin') : t('backup.recoveryBannerNonAdmin')}</p>
          </div>
        </div>
      )}

      {/* ─── Backup List ─────────────────────────────────────────────── */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <HardDrive size={15} className="text-brand" />
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('backup.backupHistory')}</h3>
          <span className="ml-auto text-xs text-slate-400">{t('backup.backupCount', { count: backups.length })}</span>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <RefreshCw size={16} className="animate-spin text-slate-300 mr-2" />
            <span className="text-sm text-slate-400">{t('backup.loadingBackups')}</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <HardDrive size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('backup.noBackups')}</p>
            <p className="text-xs text-slate-400 mb-4">{t('backup.noBackupsDesc')}</p>
            {canCreate && (
              <button onClick={handleCreate} disabled={creating}
                className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
                {creating ? t('backup.creating') : t('backup.createFirstBackup')}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {backups.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                {/* Valid indicator */}
                <div className="shrink-0">
                  {b.isValid
                    ? <CheckCircle2 size={16} className="text-success" />
                    : <XCircle size={16} className="text-danger" />}
                </div>

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{fmtFileName(b)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDate(b.backupDate)}</p>
                </div>

                {/* Size */}
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 hidden sm:block">{fmtSize(b.backupSize)}</span>

                {/* Status badge */}
                <Badge variant={b.isValid ? 'success' : 'danger'} size="sm" className="shrink-0">
                  {b.isValid ? t('backup.valid') : t('backup.invalid')}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => handleValidate(b)} title={t('backup.verifyBackup')}
                    className="p-1.5 text-slate-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors">
                    <ShieldCheck size={14} />
                  </button>
                  {canRestore && (
                    <button onClick={() => openRestoreModal(b)} title={t('backup.restoreFromThisBackup')}
                      className="p-1.5 text-slate-400 hover:text-success hover:bg-success/10 rounded-lg transition-colors">
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setDeleteTarget(b)} title={t('backup.deleteBackup')}
                      disabled={deletingId === b.id}
                      className="p-1.5 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors disabled:opacity-40">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── Auto-Backup Settings (Admin only) ───────────────────────── */}
      {canConfigure && (
        <Card padding="lg" className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('backup.autoBackupTitle')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('backup.autoBackupDesc')}</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSettings.auto_backup_enabled === 'true'}
              onChange={e => setAutoSettings(s => ({ ...s, auto_backup_enabled: e.target.checked ? 'true' : 'false' }))}
              className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span className="text-sm text-dark dark:text-slate-100">{t('backup.autoBackupEnable')}</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{t('backup.autoBackupInterval')}</label>
              <input
                type="number" min={1}
                value={autoSettings.auto_backup_interval_days}
                onChange={e => setAutoSettings(s => ({ ...s, auto_backup_interval_days: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{t('backup.retentionCountLabel')}</label>
              <input
                type="number" min={1}
                value={autoSettings.backup_retention_count}
                onChange={e => setAutoSettings(s => ({ ...s, backup_retention_count: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{t('backup.reminderDaysLabel')}</label>
              <input
                type="number" min={1}
                value={autoSettings.backup_reminder_days}
                onChange={e => setAutoSettings(s => ({ ...s, backup_reminder_days: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          <button
            onClick={handleSaveAutoSettings}
            disabled={savingSettings}
            className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {savingSettings ? t('backup.creating') : t('common.save')}
          </button>

          {/* Backup destination — a local-disk-only picker (e.g. a USB drive), not
              cloud storage; the app stays fully offline either way. */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">{t('backup.destinationLabel')}</label>
            <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1.5 rounded break-all">
              {destination?.effectiveDir ?? '…'}
            </p>
            {destination?.usedFallback && destination.configuredDir && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={12} /> {t('backup.destinationUnreachable', { path: destination.configuredDir })}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleChooseFolder}
                disabled={choosingFolder}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {t('backup.destinationChoose')}
              </button>
              {destination?.configuredDir && (
                <button
                  onClick={handleResetDestination}
                  disabled={choosingFolder}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                  {t('backup.destinationUseDefault')}
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ─── Info box ────────────────────────────────────────────────── */}
      <div className="bg-brand/5 border border-brand/15 rounded-xl p-4 flex items-start gap-3">
        <Info size={15} className="text-brand shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <p><span className="font-semibold text-brand">{t('backup.infoLocalTitle')}</span> {t('backup.infoLocalDesc')}</p>
          <p>{t('backup.infoPathLabel')} <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded break-all">{destination?.effectiveDir ?? 'AppData\\Sarang Business OS Lite\\backups\\'}</span></p>
          <p className="text-slate-400">{t('backup.infoCopyAdvice')}</p>
        </div>
      </div>

      {/* ─── Aszurex footer ──────────────────────────────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-medium text-brand inline-flex items-center gap-1.5">
          Sarang Business OS Lite · Powered by Aszurex <AszurexMark width={12} />
        </p>
        <p className="text-xs text-slate-400">No cloud. No tracking. 100% offline.</p>
      </div>

      {/* ─── Toast ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className={cn(
              'fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50',
              toast.ok ? 'bg-success text-white' : 'bg-danger text-white'
            )}
          >
            {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Restore Confirmation Modal ──────────────────────────────── */}
      <AnimatePresence>
        {restoreTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setRestoreTarget(null) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-warning" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('backup.restoreBackup')}</h3>
                  <p className="text-xs text-slate-400">{t('backup.restoreWarningShort')}</p>
                </div>
              </div>

              {/* Metadata preview */}
              {restoreMeta && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('backup.metaBusiness')}</span>
                    <span className="font-semibold text-dark dark:text-slate-100">{restoreMeta.businessName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('backup.metaBackupDate')}</span>
                    <span className="font-medium text-dark dark:text-slate-100">{fmtDate(restoreMeta.backupDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('backup.metaAppVersion')}</span>
                    <span className="font-medium text-dark dark:text-slate-100">v{restoreMeta.appVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('backup.metaDbSize')}</span>
                    <span className="font-medium text-dark dark:text-slate-100">{fmtSize(restoreMeta.dbSizeBytes)}</span>
                  </div>
                </div>
              )}

              <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 mb-5 text-xs text-warning flex gap-2">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">{t('backup.warningHeading')}</p>
                  <p>{t('backup.restoreWarningFull')}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setRestoreTarget(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={handleRestore}
                  className="flex-1 py-2 rounded-xl bg-warning text-white text-sm font-semibold hover:bg-warning/90 transition-colors">
                  {t('backup.restoreAndRestart')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirmation Modal ───────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-danger" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('backup.deleteBackup')}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{fmtFileName(deleteTarget)}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t('backup.deleteWarning')}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={() => handleDelete(deleteTarget)} disabled={deletingId === deleteTarget.id}
                  className="flex-1 py-2 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-50">
                  {deletingId === deleteTarget.id ? t('backup.deleting') : t('common.delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Restoring Overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {restoring && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-dark/80 z-[100] flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-brand/20 flex items-center justify-center">
              <RotateCcw size={28} className="text-brand animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">{t('backup.restoringTitle')}</p>
              <p className="text-slate-400 text-sm mt-1">{t('backup.restoringDesc')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
