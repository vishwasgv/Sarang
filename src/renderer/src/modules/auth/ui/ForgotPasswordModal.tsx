import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Input } from '@shared/ui/atoms/Input'
import { Button } from '@shared/ui/atoms/Button'
import { api } from '@renderer/services/ipc-client'

interface ForgotPasswordModalProps {
  open: boolean
  onClose: () => void
}

// Offline password reset via the one-time recovery code shown at first-time
// setup (SetupWizard.tsx's CompleteStep) or re-generated later from
// Settings → Security. There is no SMS/email in this app — the recovery
// code IS the reset mechanism, by design (see auth.service.ts's
// resetPasswordWithRecoveryCode for the full rationale).
export function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  function reset() {
    setUsername('')
    setRecoveryCode('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSubmitting(false)
    setSuccess(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !recoveryCode.trim() || !newPassword) {
      setError(t('auth.forgotPasswordFillAll'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDontMatch'))
      return
    }
    setSubmitting(true)
    try {
      const res = await api.auth.resetPasswordWithRecoveryCode({ username: username.trim(), recoveryCode, newPassword })
      if (res.success) {
        setSuccess(true)
      } else {
        setError(res.error?.message ?? t('common.error'))
      }
    } catch {
      setError(t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('auth.forgotPasswordTitle')} size="sm">
      {success ? (
        <div className="text-center py-2">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} className="text-success" />
          </div>
          <p className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('auth.passwordResetSuccessTitle')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('auth.passwordResetSuccessBody')}</p>
          <Button onClick={handleClose} className="w-full">{t('auth.backToSignIn')}</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('auth.forgotPasswordExplain')}</p>
          <Input label={t('auth.username')} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          <Input
            label={t('auth.recoveryCode')}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            required
          />
          <Input label={t('auth.newPassword')} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <Input label={t('auth.confirmPassword')} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          {error && <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <Button type="submit" className="w-full" loading={submitting}>{t('auth.resetPassword')}</Button>
        </form>
      )}
    </Modal>
  )
}
