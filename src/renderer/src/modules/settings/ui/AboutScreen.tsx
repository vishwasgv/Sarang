import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, Database, HardDrive, Info, ExternalLink, RefreshCw } from 'lucide-react'
import { appInfo, api } from '@renderer/services/ipc-client'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { BrandIcon, AszurexMark } from '@shared/ui/atoms/Brand'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'

export function AboutScreen() {
  const { t } = useTranslation()
  const profile = useBusinessStore(s => s.profile)
  const { error: toastError } = useNotificationStore()
  const [paths, setPaths] = useState<{ userData: string; logs: string; backups: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [updateResult, setUpdateResult] = useState<{ hasUpdate: boolean; latestVersion: string; downloadUrl?: string } | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.app.getPaths().then((r: any) => {
      if (r?.success && r?.data) setPaths(r.data)
      else toastError(t('common.error'), r?.error?.message ?? 'Could not load storage paths.')
    }).catch(() => {
      toastError(t('common.error'), 'Could not load storage paths.')
    })
  }, [toastError, t])

  async function handleCheckForUpdates() {
    setChecking(true)
    setUpdateResult(null)
    setUpdateError(null)
    try {
      const res = await api.app.checkForUpdates()
      if (res.success && res.data) {
        setUpdateResult({ hasUpdate: res.data.hasUpdate, latestVersion: res.data.latestVersion, downloadUrl: (res.data as { downloadUrl?: string }).downloadUrl })
      } else {
        setUpdateError(res.error?.message ?? 'Could not check for updates.')
      }
    } catch {
      setUpdateError('Could not check for updates.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Identity — the authentic-voice header: why this exists, not just a specs list */}
      <Card padding="none" className="shadow-sm p-8 text-center">
        <BrandIcon size={64} className="mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{appInfo.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Version {appInfo.version}</p>
        <p className="text-base text-slate-600 dark:text-slate-300 mt-4 max-w-md mx-auto leading-relaxed">
          Sarang exists because small businesses shouldn&apos;t have to pay a subscription just to run their
          day-to-day operations. It&apos;s built by Aszurex, given away in full, and kept entirely on your device
          — no catch, no upsell buried in the fine print.
        </p>
        <p className="text-sm text-brand font-medium mt-3 inline-flex items-center gap-1.5">
          Powered by <strong>Aszurex</strong> <AszurexMark width={16} /> — Trust Beyond Limits
        </p>
      </Card>

      {/* Business info */}
      {profile && (
        <Card padding="lg" className="shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Info size={16} className="text-brand" />
            <h2 className="text-sm font-semibold text-dark dark:text-slate-100">Business</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Business Name</span>
              <span className="font-medium text-dark dark:text-slate-100">{profile.businessName}</span>
            </div>
            {profile.businessType && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Type</span>
                <span className="font-medium text-dark dark:text-slate-100">{profile.businessType}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Privacy & data — the facts stay exactly as they were; they're load-bearing, not decoration */}
      <Card padding="lg" className="shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-success" />
          <h2 className="text-sm font-semibold text-dark dark:text-slate-100">Privacy & Data</h2>
        </div>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>Sarang Business OS Lite is <strong>100% offline-first</strong>. All your data stays on this device.</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>No cloud storage. No telemetry. No tracking.</li>
            <li>Free forever. No subscriptions. No hidden charges.</li>
            <li>No internet connection required for any core business feature — billing, inventory, customers, and reports all work fully offline. (Checking for software updates below is the one optional exception, and only runs when you choose to check.)</li>
            <li>Your business data never leaves your device.</li>
            <li>Payments are recorded for your records only — Sarang does not process or verify payments.</li>
          </ul>
        </div>
      </Card>

      {/* Data storage paths */}
      <Card padding="lg" className="shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-brand" />
          <h2 className="text-sm font-semibold text-dark dark:text-slate-100">Data Storage</h2>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3">
          <p>All data is stored locally in your user data directory.</p>
          {paths ? (
            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
              <div><span className="text-slate-400">Database  </span><span className="text-slate-700 dark:text-slate-300 break-all">{paths.userData}</span></div>
              <div><span className="text-slate-400">Backups   </span><span className="text-slate-700 dark:text-slate-300 break-all">{paths.backups}</span></div>
              <div><span className="text-slate-400">Logs      </span><span className="text-slate-700 dark:text-slate-300 break-all">{paths.logs}</span></div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Loading paths…</p>
          )}
          <p className="text-xs text-slate-400">Use <strong>Backup</strong> regularly to protect your data.</p>
        </div>
      </Card>

      {/* Software updates */}
      <Card padding="lg" className="shadow-sm">
        <h2 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">Software Updates</h2>
        <p className="text-sm text-slate-500 mb-1">Check if a newer version of Sarang is available.</p>
        <p className="text-xs text-slate-400 mb-4">Only runs when you click the button below — sends nothing but the app's own version number, no business or customer data.</p>

        <Button variant="secondary" onClick={handleCheckForUpdates} loading={checking} icon={<RefreshCw size={16} />}>
          Check for Updates
        </Button>

        {updateResult && !updateResult.hasUpdate && (
          <p className="mt-3 text-sm text-success font-medium">You are using the latest version.</p>
        )}
        {updateResult && updateResult.hasUpdate && (
          <div className="mt-3 flex items-center gap-3">
            <p className="text-sm text-brand font-medium">
              Version {updateResult.latestVersion} is available.
            </p>
            {updateResult.downloadUrl && (
              <a href={updateResult.downloadUrl} target="_blank" rel="noreferrer"
                className="text-xs font-semibold text-white bg-brand px-3 py-1 rounded-lg hover:bg-brand/90 transition-colors">
                Download Update
              </a>
            )}
          </div>
        )}
        {updateError && (
          <p className="mt-3 text-sm text-danger">{updateError}</p>
        )}
      </Card>

      {/* Legal */}
      <div className="bg-warning/10 dark:bg-warning/15 rounded-xl border border-warning/30 p-5">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive size={16} className="text-warning" />
          <h2 className="text-sm font-semibold text-warning">{t('about.legalDisclaimerTitle')}</h2>
        </div>
        <p className="text-xs text-warning leading-relaxed">
          {t('disclaimer.legalNotice')}
        </p>
      </div>

      {/* Support links */}
      <Card padding="lg" className="shadow-sm">
        <h2 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Support</h2>
        <div className="space-y-3">
          <a
            href="https://aszurex.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand hover:underline"
          >
            <ExternalLink size={13} /> Visit Aszurex Website
          </a>
          <a
            href="mailto:support@aszurex.com"
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-brand hover:underline"
          >
            <ExternalLink size={13} /> Contact Aszurex Support
          </a>
        </div>
        <p className="text-xs text-slate-400 mt-4 inline-flex items-center gap-1.5">
          Built by Aszurex <AszurexMark width={12} /> | www.aszurex.com | vishwasgv123@gmail.com
        </p>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Aszurex. All rights reserved.
      </p>
    </div>
  )
}
