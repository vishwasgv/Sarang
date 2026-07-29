import { buildWhatsAppLink } from './notification-queue.service'

/**
 * Share Bill/Report via WhatsApp & Email — see
 * docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md Section 5.1.
 *
 * Deliberately main-process code, not a renderer utility: buildWhatsAppLink()
 * itself is DB-aware (it prepends the business profile's own country dial
 * code to a local-format number), so reimplementing phone handling here
 * instead of delegating to it would silently regress that already-solved
 * behaviour for every local-format customer/supplier number.
 */

// Realistic phone numbers — local or international, with or without a
// country code — are never under 6 digits. A shorter result after stripping
// non-numeric characters means the field held something else entirely (a
// stray "N/A", a placeholder, an empty-but-not-null string), not a usable
// number. buildWhatsAppLink() itself doesn't reject this: it would silently
// build `wa.me/?text=...` with an empty recipient, which *looks* like it
// worked (a window opens) but shares with nobody.
const MIN_PLAUSIBLE_PHONE_DIGITS = 6

/**
 * Builds a wa.me click-to-chat link for sharing a document, or `null` if
 * there's no usable phone number on file — either because the field itself
 * is empty/missing, or because it contains too few digits to plausibly be a
 * real phone number. Callers should treat both cases identically: "can't
 * share via WhatsApp for this contact."
 */
export async function buildShareWhatsAppLink(phone: string | null | undefined, message: string): Promise<string | null> {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < MIN_PLAUSIBLE_PHONE_DIGITS) return null
  return buildWhatsAppLink(phone, message)
}

/**
 * Builds a `mailto:` link for sharing a document. Unlike the WhatsApp side,
 * a missing/empty email still produces a valid link with an empty recipient
 * — the owner's email client opens with the To: field blank, ready for
 * manual entry, rather than blocking the action outright (not every
 * customer/supplier has an email on file, but the owner may know it anyway).
 */
export function buildShareEmailLink(email: string | null | undefined, subject: string, body: string): string {
  // The recipient address itself is deliberately NOT percent-encoded — an
  // email address's own characters (letters/digits/@/./-/_) are already
  // mailto-safe, and encoding the '@' (e.g. to %40) would produce a link
  // that looks unlike every real-world mailto: link and every other
  // wa.me/mailto: example already in this codebase.
  const recipient = email && email.trim() ? email.trim() : ''
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
