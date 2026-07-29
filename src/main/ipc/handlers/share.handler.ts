import { shell } from 'electron'
import { buildShareWhatsAppLink, buildShareEmailLink } from '../../services/share.service'
import { requireSession } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Share Bill/Report via WhatsApp & Email — see
// docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md Section 5.1/5.3. These
// three handlers are the generic, document-type-agnostic half of the
// feature; the per-document Print/Export permission gates live on each
// document type's own `...:exportPdf` handler, not here — a signed-in user
// building a link or revealing a file they already saved themselves needs
// no extra document-specific permission beyond an active session, same
// precedent as app.handler.ts's getBusinessLogoDataUri/generateUpiPaymentQr.
export function register(handle: HandleFn): void {
  handle('share:buildWhatsAppLink', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const { phone, message } = (payload ?? {}) as { phone?: string | null; message?: string }
    if (typeof message !== 'string' || !message.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'A message is required.' } }
    }
    const link = await buildShareWhatsAppLink(phone ?? null, message)
    return { success: true, data: link }
  })

  handle('share:buildEmailLink', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const { email, subject, body } = (payload ?? {}) as { email?: string | null; subject?: string; body?: string }
    if (typeof subject !== 'string' || typeof body !== 'string') {
      return { success: false, error: { code: 'VAL-001', message: 'A subject and body are required.' } }
    }
    return { success: true, data: buildShareEmailLink(email ?? null, subject, body) }
  })

  // Read-only: reveals a file the owner already chose to save themselves via
  // a save dialog seconds earlier (Share step 4). No new attack surface.
  handle('share:showItemInFolder', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const { filePath } = (payload ?? {}) as { filePath?: string }
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid file path.' } }
    }
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: { code: 'SHARE-001', message: err instanceof Error ? err.message : 'Could not open the folder for the saved file.' } }
    }
  })
}
