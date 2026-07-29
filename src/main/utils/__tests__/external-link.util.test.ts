import { describe, it, expect } from 'vitest'
import { isAllowedExternalUrl } from '../external-link.util'

// Real bug found 2026-07-29: setWindowOpenHandler's inline hostname allowlist
// never included 'wa.me', so every "Open WhatsApp" button app-wide (job cards,
// legal hearings, pet vaccination reminders, membership/payment-overdue
// nudges, pest control, etc.) silently failed to open — window.open() was
// denied and shell.openExternal() was never called, with no error shown to
// the user. mailto: links were never handled at all (they parse with an
// empty hostname, so no hostname-based check could ever match them), which
// would have shipped the WhatsApp/email document-sharing feature equally
// broken. Both are fixed here and locked in by these tests.

describe('external-link.util — isAllowedExternalUrl', () => {
  it('allows the pre-existing Aszurex/GitHub domains', () => {
    expect(isAllowedExternalUrl('https://aszurex.com/pricing')).toBe(true)
    expect(isAllowedExternalUrl('https://www.aszurex.com')).toBe(true)
    expect(isAllowedExternalUrl('https://github.com/vishwasgv/sarang')).toBe(true)
    expect(isAllowedExternalUrl('https://www.github.com/vishwasgv/sarang')).toBe(true)
  })

  it('allows wa.me WhatsApp click-to-chat links', () => {
    expect(isAllowedExternalUrl('https://wa.me/919999999999?text=hello')).toBe(true)
  })

  it('allows mailto: links regardless of recipient, since they have no hostname to check', () => {
    expect(isAllowedExternalUrl('mailto:customer@example.com')).toBe(true)
    expect(isAllowedExternalUrl('mailto:customer@example.com?subject=Invoice&body=Please%20find%20attached')).toBe(true)
  })

  it('rejects domains not on the allowlist', () => {
    expect(isAllowedExternalUrl('https://evil.com')).toBe(false)
    expect(isAllowedExternalUrl('https://aszurex.com.evil.com')).toBe(false)
    expect(isAllowedExternalUrl('https://not-wa.me')).toBe(false)
  })

  it('rejects malformed URLs instead of throwing', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false)
    expect(isAllowedExternalUrl('')).toBe(false)
  })
})
