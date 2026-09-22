import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, X, Sparkles } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Button } from '@shared/ui/atoms/Button'

// 2026-09-22 — founder ask: an Android-style "a security patch is ready —
// install it?" prompt, app-wide (not buried in Settings → About), that asks
// permission BEFORE downloading (update-check.service.ts used to
// auto-download silently for an eligible install; it now only ever records
// the update as PENDING and this prompt is what actually triggers the
// download, on the user's explicit say-so). Also the "check as soon as
// we're back online" trigger — checkForUpdatesIfDue() itself is throttled
// to ~once/20h and respects the user's Settings toggle, so firing this on
// every 'online' event is always safe, never spams GitHub.
type PromptState = 'idle' | 'pending' | 'downloading' | 'ready' | 'restarting'

export function UpdatePermissionPrompt() {
  const { t } = useTranslation()
  const [state, setState] = useState<PromptState>('idle')
  const [version, setVersion] = useState<string | null>(null)

  async function refresh() {
    try {
      const readyRes = await api.app.getUpdateReadyVersion()
      if (readyRes.success && readyRes.data) {
        setVersion(readyRes.data)
        setState('ready')
        return
      }
      const pendingRes = await api.app.getPendingUpdateVersion()
      if (pendingRes.success && pendingRes.data) {
        setVersion(pendingRes.data)
        setState('pending')
        return
      }
      setState('idle')
    } catch {
      // Never surface a check failure as an error — matches this whole
      // feature's pre-existing offline-silent convention.
    }
  }

  useEffect(() => {
    refresh()
    function onOnline() {
      api.app.checkForUpdatesNow().catch(() => {})
      // checkForUpdatesIfDue() runs fire-and-forget in the main process with
      // no completion signal back to the renderer — a short best-effort
      // delay before re-polling is simpler and safer than wiring a new
      // main→renderer push event for what is, worst case, a few-second lag
      // before the prompt appears.
      setTimeout(refresh, 3000)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  async function handleDownload() {
    setState('downloading')
    try {
      await api.app.approveUpdateDownload()
    } catch {
      // fall through to refresh() below either way
    }
    await refresh()
  }

  async function handleDismiss() {
    try {
      await api.app.dismissPendingUpdate()
    } catch {
      // still hide locally even if the "don't ask again for this version"
      // write failed — worst case it asks again next check, not a big deal
    }
    setState('idle')
  }

  async function handleRestart() {
    setState('restarting')
    try {
      await api.app.restartAndInstallUpdate()
      // No further UI update expected — a successful call quits the app.
    } catch {
      setState('ready')
    }
  }

  if (state === 'idle') return null

  return (
    <div className="fixed bottom-5 end-5 z-40 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">
            {state === 'ready' || state === 'restarting' ? t('about.updateReadyTitle') : t('about.updateAvailableTitle')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('about.updateVersionLabel', { version })}
          </p>
        </div>
        {(state === 'pending' || state === 'ready') && (
          <button onClick={state === 'pending' ? handleDismiss : () => setState('idle')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0" aria-label={t('common.close')}>
            <X size={15} />
          </button>
        )}
      </div>

      {state === 'pending' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleDownload} className="flex-1" icon={<Download size={13} />}>
            {t('about.downloadAndInstall')}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDismiss}>{t('about.notNow')}</Button>
        </div>
      )}

      {state === 'downloading' && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <RefreshCw size={13} className="animate-spin" /> {t('about.downloading')}
        </div>
      )}

      {(state === 'ready' || state === 'restarting') && (
        <Button size="sm" onClick={handleRestart} loading={state === 'restarting'} className="w-full" icon={<RefreshCw size={13} />}>
          {t('about.restartAndInstall')}
        </Button>
      )}
    </div>
  )
}
