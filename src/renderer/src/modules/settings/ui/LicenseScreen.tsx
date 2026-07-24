import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'

// Phase 59 — Licensing. See PHASE_59_MONETIZATION_LICENSING_MASTER_PROMPT.md
// (repo root) Section 59.6. Region determined the same loose way
// print.service.ts's canShowUpiQr() already does for this free-text field.
function isIndiaCountry(country: string | null | undefined): boolean {
  const c = (country ?? '').trim().toLowerCase()
  return c === 'in' || c.includes('india')
}

type LicenseStatusData = {
  status: 'ACTIVE' | 'WARNING' | 'EXPIRED' | 'NOT_ACTIVATED'
  tier: 'TRIAL' | 'PAID' | null
  region: 'IN' | 'INTL' | null
  daysSinceIssue: number | null
  daysRemaining: number | null
  machineMismatch: boolean
}

export function LicenseScreen() {
  const { t } = useTranslation()
  const profile = useBusinessStore(s => s.profile)
  const { error: toastError, success: toastSuccess } = useNotificationStore()

  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<LicenseStatusData | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  const isIndia = isIndiaCountry(profile?.country)
  const priceLine = isIndia ? t('license.renewIndia') : t('license.renewIntl')

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await api.license.getStatus()
      if (res.success && res.data) setState(res.data as LicenseStatusData)
      else toastError(t('common.error'), res.error?.message ?? 'Could not load license status.')
    } catch {
      toastError(t('common.error'), 'Could not load license status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStatus() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleActivate() {
    if (!keyInput.trim()) return
    setActivating(true)
    setActivateError(null)
    try {
      const res = await api.license.activate({ key: keyInput })
      if (res.success) {
        toastSuccess(t('license.activated'), '')
        setKeyInput('')
        await loadStatus()
      } else {
        setActivateError(res.error?.message ?? t('license.invalidKey'))
      }
    } catch {
      setActivateError(t('license.activateError'))
    } finally {
      setActivating(false)
    }
  }

  const statusBadge = (() => {
    if (!state) return null
    switch (state.status) {
      case 'ACTIVE':
        return state.tier === 'PAID'
          ? <Badge variant="success">{t('license.statusActivePaid')}</Badge>
          : <Badge variant="success">{t('license.statusActive')}</Badge>
      case 'WARNING':
        return <Badge variant="warning">{t('license.statusWarning')}</Badge>
      case 'EXPIRED':
        return <Badge variant="danger">{t('license.statusExpired')}</Badge>
      default:
        return <Badge variant="neutral">{t('license.statusNotActivated')}</Badge>
    }
  })()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Card padding="lg" className="shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-brand" />
            <h2 className="text-sm font-semibold text-dark dark:text-slate-100">{t('license.title')}</h2>
          </div>
          {!loading && statusBadge}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('license.subtitle')}</p>

        {!loading && state?.tier === 'TRIAL' && state.daysRemaining !== null && state.status !== 'EXPIRED' && (
          <p className="text-sm text-dark dark:text-slate-100 mb-3">{t('license.daysRemaining', { days: state.daysRemaining })}</p>
        )}
        {!loading && state?.status === 'EXPIRED' && (
          <div className="mb-3 p-3 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning">
            {t('license.freeYearEndedNotice')}
          </div>
        )}
        {!loading && state?.machineMismatch && (
          <p className="text-xs text-slate-400 mb-3">{t('license.machineMismatchNotice')}</p>
        )}
        <p className="text-xs text-slate-400 mb-4">{t('license.deviceBoundNotice')}</p>

        {(!state || state.status !== 'ACTIVE' || state.tier === 'TRIAL') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                label={t('license.keyLabel')}
                placeholder={t('license.keyPlaceholder')}
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setActivateError(null) }}
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleActivate} loading={activating} disabled={!keyInput.trim()}>
                {t('license.activate')}
              </Button>
            </div>
            {activateError && <p className="text-xs text-danger">{activateError}</p>}
          </div>
        )}
      </Card>

      {(!state || state.tier !== 'PAID') && (
        <Card padding="lg" className="shadow-sm">
          <h2 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('license.renewTitle')}</h2>
          <p className="text-sm text-brand font-semibold mb-3">{priceLine}</p>
          <a
            href="https://aszurex.com/sarang#pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand px-4 py-2 rounded-lg hover:bg-brand/90 transition-colors"
          >
            <ExternalLink size={14} /> {t('license.renewButton')}
          </a>
        </Card>
      )}
    </div>
  )
}
