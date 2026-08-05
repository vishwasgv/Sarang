import React, { useState } from 'react'
import { MessageCircle, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@app/store/notification.store'
import { Button } from '@shared/ui/atoms/Button'

/**
 * Share Bill/Report via WhatsApp & Email — see
 * docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md Section 5.1/5.3.
 *
 * One shared component used by all six document types (Invoice, Report,
 * Quotation, Credit Note, Debit Note, Purchase Order) rather than four/six
 * separate implementations — each caller only supplies what's specific to
 * its own document (recipient contact info, message text, and how to export
 * its own PDF); this component owns the common flow:
 *   1. Export the document to PDF (caller-supplied — each doc type already
 *      has its own generator/IPC channel; this component doesn't know or
 *      care which).
 *   2. If the owner cancelled the save dialog, abort silently — no folder
 *      opens, no WhatsApp/email window opens, no partial state.
 *   3. On a real save, reveal the saved file in its folder. If that specific
 *      step fails, show an error and stop (don't proceed with a dangling
 *      reference to a file the owner can't find).
 *   4. Build and open the wa.me/mailto: link.
 *   5. Show a neutral "Opening…" toast — never a "Sent!" success toast,
 *      since the app structurally cannot know whether the owner actually
 *      sent anything (see the design doc's Section 5.3 for why).
 */

export interface ExportPdfResult {
  success: boolean
  /** true when the owner cancelled the save dialog — no file was written. */
  cancelled?: boolean
  /** Present only when a file was actually written. */
  filePath?: string
  error?: { message: string }
}

interface ShareMenuProps {
  /** Customer/Supplier phone on file. Falsy disables the WhatsApp button (no round-trip to attempt a share that can't work). */
  recipientPhone?: string | null
  /** Customer/Supplier email on file. May be empty — the Email button stays enabled regardless (owner can fill the To: field manually). */
  recipientEmail?: string | null
  buildWhatsAppMessage: () => string
  buildEmailSubject: () => string
  buildEmailBody: () => string
  /** Saves the document as PDF via that document type's own existing export flow, and reports what happened. */
  onExportPdf: () => Promise<ExportPdfResult>
  /** 'icon' (default): compact icon-only pair for list rows (expects a `group` ancestor for hover reveal). 'button': labeled buttons for detail-screen header rows. */
  variant?: 'icon' | 'button'
  disabled?: boolean
}

export function ShareMenu({
  recipientPhone, recipientEmail, buildWhatsAppMessage, buildEmailSubject, buildEmailBody,
  onExportPdf, variant = 'icon', disabled
}: ShareMenuProps) {
  const { t } = useTranslation()
  const { error: toastError, info: toastInfo } = useNotificationStore()
  const [busy, setBusy] = useState<'whatsapp' | 'email' | null>(null)

  const hasPhone = !!(recipientPhone && recipientPhone.trim())

  async function handleShare(channel: 'whatsapp' | 'email') {
    if (busy || disabled) return
    setBusy(channel)
    try {
      const exportRes = await onExportPdf()
      if (!exportRes.success) {
        toastError(t('common.error'), exportRes.error?.message ?? t('common.error'))
        return
      }
      if (exportRes.cancelled) return // silent abort — the owner backed out of the save dialog

      if (exportRes.filePath) {
        const revealRes = await window.api.share.showItemInFolder({ filePath: exportRes.filePath })
        if (!revealRes.success) {
          toastError(t('common.error'), revealRes.error?.message ?? t('share.revealFailed'))
          return
        }
      }

      if (channel === 'whatsapp') {
        const linkRes = await window.api.share.buildWhatsAppLink({ phone: recipientPhone ?? null, message: buildWhatsAppMessage() })
        if (!linkRes.success || !linkRes.data) {
          toastError(t('share.noPhoneTitle'), t('share.noPhoneMessage'))
          return
        }
        window.open(linkRes.data, '_blank')
        toastInfo(t('share.openingWhatsApp'))
      } else {
        const linkRes = await window.api.share.buildEmailLink({ email: recipientEmail ?? null, subject: buildEmailSubject(), body: buildEmailBody() })
        if (!linkRes.success || !linkRes.data) {
          toastError(t('common.error'), t('common.error'))
          return
        }
        window.open(linkRes.data, '_blank')
        toastInfo(t('share.openingEmail'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  if (variant === 'button') {
    return (
      <>
        <Button
          size="sm" variant="outline" onClick={() => handleShare('whatsapp')}
          loading={busy === 'whatsapp'} disabled={disabled || !hasPhone || !!busy}
          title={!hasPhone ? t('share.noPhoneOnFile') : undefined}
        >
          <MessageCircle size={14} className="me-1" /> {t('share.whatsapp')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleShare('email')} loading={busy === 'email'} disabled={disabled || !!busy}>
          <Mail size={14} className="me-1" /> {t('share.email')}
        </Button>
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => handleShare('whatsapp')} disabled={disabled || !hasPhone || !!busy}
        title={!hasPhone ? t('share.noPhoneOnFile') : t('share.whatsapp')}
        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30"
      >
        <MessageCircle size={15} />
      </button>
      <button
        onClick={() => handleShare('email')} disabled={disabled || !!busy}
        title={t('share.email')}
        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30"
      >
        <Mail size={15} />
      </button>
    </>
  )
}
