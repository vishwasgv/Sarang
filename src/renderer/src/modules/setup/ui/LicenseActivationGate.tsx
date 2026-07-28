import React, { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { BrandIcon, AszurexMark } from '@shared/ui/atoms/Brand'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { api } from '@renderer/services/ipc-client'

/**
 * Real gap found+closed 2026-07-28 (see setup.service.ts's isSetupComplete()
 * doc comment for the full story): a business/admin account can exist with
 * no license ever activated — e.g. the app was closed between the original
 * SetupWizard's final submit and its "Launch Dashboard" click. Restarting
 * the full 8-step SetupWizard in that state would either wipe the just-
 * created business profile or hit a "username already in use" error on the
 * same admin account. This lightweight, standalone screen is the correct
 * resume path: the business/admin already exist, only a license is missing,
 * so only a license is asked for here — same activation call, same
 * mandatory-checkbox pattern as SetupWizard's CompleteStep, deliberately not
 * shared as one component with it since CompleteStep also handles the
 * one-time recovery-code display, which doesn't apply on a resume (the
 * recovery code was already shown once, or never will be again — its hash
 * is all that's stored, per this app's own no-plaintext-secrets rule).
 */
export function LicenseActivationGate({ onComplete }: { onComplete: () => void }) {
  const [keyInput, setKeyInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [activated, setActivated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)

  async function handleActivate() {
    if (!keyInput.trim()) return
    setActivating(true)
    setError(null)
    try {
      const res = await api.license.activate({ key: keyInput })
      if (res.success) {
        setActivated(true)
      } else {
        setActivated(false)
        setError(res.error?.message ?? 'That license key is not valid. Double-check it and try again.')
      }
    } catch {
      setActivated(false)
      setError('Could not activate this key right now. Please try again.')
    } finally {
      setActivating(false)
    }
  }

  const canLaunch = activated && checked

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <Card padding="lg" className="max-w-md w-full shadow-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <BrandIcon size={28} />
        </div>
        <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={26} className="text-brand" />
        </div>
        <h2 className="text-lg font-bold text-dark dark:text-slate-100 mb-2">One more step</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Your business account is already set up. Activate your license key to continue — Sarang is free for your first 12 months, with a small annual license after that.
        </p>

        <div className="mb-6 p-4 bg-brand/5 border-2 border-brand/20 rounded-lg text-left">
          <p className="text-sm font-bold text-dark dark:text-slate-100 mb-2">Activate your license</p>
          <div className="flex items-center gap-2 mb-2">
            <Input
              aria-label="License key"
              placeholder="SARANG-XXXX-XXXX-XXXX-XXXX"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setActivated(false); setError(null) }}
              disabled={activated}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleActivate} loading={activating} disabled={activated || !keyInput.trim()}>
              {activated ? 'Activated' : 'Activate'}
            </Button>
          </div>
          {error && <p className="text-xs text-danger mb-2">{error}</p>}
          {activated && <p className="text-xs text-success mb-2">License activated for this device.</p>}
          {!activated && (
            <p className="text-xs text-slate-400 mb-2">
              Don't have a key? <a href="https://aszurex.com/sarang.html" target="_blank" rel="noopener noreferrer" className="text-brand underline">Get one free</a> — it only takes a minute.
            </p>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
            <span className="text-xs text-slate-600 dark:text-slate-300">I understand Sarang is free for my first 12 months, then a small annual license keeps it running.</span>
          </label>
        </div>

        <Button onClick={onComplete} size="lg" className="w-full" disabled={!canLaunch}>
          Launch Dashboard
        </Button>
        <p className="text-xs text-brand mt-4 font-medium inline-flex items-center gap-1.5 justify-center">
          Powered by Aszurex <AszurexMark width={12} /> · Trust Beyond Limits
        </p>
      </Card>
    </div>
  )
}
