/**
 * Real bug found+fixed 2026-07-29 (see docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md
 * Section 2): main/index.ts's setWindowOpenHandler gated window.open() calls
 * on a hostname allowlist that never included 'wa.me' — silently blocking
 * every "Open WhatsApp" button in the app (job cards, legal hearings, pet
 * vaccination reminders, memberships, payment-overdue nudges, pest control,
 * etc.) with zero error shown to the user. Separately, mailto: links parse
 * with an empty hostname, so the same check could never match them either,
 * which would have shipped the new WhatsApp/email document-sharing feature
 * equally broken.
 *
 * This logic used to be inline inside createWindow(), coupled directly to a
 * real BrowserWindow instance — untestable without spinning up Electron.
 * Extracted here as a pure function specifically so the decision logic (the
 * thing that was silently wrong) is unit-testable with plain Vitest, no
 * Electron test harness needed. setWindowOpenHandler is now a thin wrapper
 * around this.
 */

// R27 (original comment, preserved): only allow opening known safe domains
// in the system browser. 'wa.me' is WhatsApp's own official click-to-chat
// domain -- it never loads inside the app, shell.openExternal() always hands
// it off to the OS/WhatsApp Desktop/the browser.
const ALLOWED_EXTERNAL_DOMAINS = ['aszurex.com', 'www.aszurex.com', 'github.com', 'www.github.com', 'wa.me']

/**
 * Decides whether a URL a renderer tried to window.open() is safe to hand
 * off to shell.openExternal(). Never throws -- a malformed URL is simply not
 * allowed, matching the original inline try/catch's behavior.
 */
export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // mailto: links have no hostname at all (new URL('mailto:x@y.com').hostname
    // === '') -- must be checked by protocol, not folded into the hostname
    // allowlist. Safe unconditionally: mailto: only ever hands off to the
    // user's own configured email client, never loads remote content inside
    // the app, the same trust boundary as a domain allowlist entry.
    if (parsed.protocol === 'mailto:') return true
    return ALLOWED_EXTERNAL_DOMAINS.includes(parsed.hostname)
  } catch {
    return false
  }
}
