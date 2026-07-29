import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories run before top-level const initializers (import hoisting).
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { buildShareWhatsAppLink, buildShareEmailLink } from '../share.service'

function mockBusinessCountry(country: string | null) {
  vi.mocked(getPrisma).mockReturnValue({
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ country }) }
  } as never)
}

beforeEach(() => vi.clearAllMocks())

describe('buildShareWhatsAppLink', () => {
  it('builds a wa.me link for an already-international-format number (no DB lookup needed)', async () => {
    const link = await buildShareWhatsAppLink('+91 98765 43210', 'Hello')
    expect(link).toBe('https://wa.me/919876543210?text=Hello')
  })

  it('prepends the business profile country dial code for a local-format number', async () => {
    mockBusinessCountry('India')
    const link = await buildShareWhatsAppLink('9876543210', 'Hello')
    expect(link).toBe('https://wa.me/919876543210?text=Hello')
  })

  it('returns null for a missing phone', async () => {
    expect(await buildShareWhatsAppLink(null, 'Hello')).toBeNull()
    expect(await buildShareWhatsAppLink(undefined, 'Hello')).toBeNull()
    expect(await buildShareWhatsAppLink('', 'Hello')).toBeNull()
  })

  // Real gap closed in the design doc's second self-review round: a phone
  // field that is *present* but garbage (a stray "N/A", a placeholder) must
  // be treated the same as a missing one, not passed through to produce a
  // broken wa.me/?text=... link with an empty recipient that looks like it
  // worked (a window opens) but shares with nobody.
  it('returns null for a garbage phone value with no extractable digits', async () => {
    expect(await buildShareWhatsAppLink('N/A', 'Hello')).toBeNull()
    expect(await buildShareWhatsAppLink('-', 'Hello')).toBeNull()
  })

  it('returns null for a phone with fewer than 6 digits after stripping non-numeric characters', async () => {
    expect(await buildShareWhatsAppLink('12345', 'Hello')).toBeNull()
    expect(await buildShareWhatsAppLink('(1) 2-3', 'Hello')).toBeNull()
  })

  it('accepts a phone with exactly 6 digits (the plausibility floor, not an off-by-one)', async () => {
    mockBusinessCountry('India')
    const link = await buildShareWhatsAppLink('123456', 'Hi')
    expect(link).not.toBeNull()
  })

  it('URL-encodes special characters (currency symbols, punctuation) in the message without corrupting the link', async () => {
    const link = await buildShareWhatsAppLink('+919876543210', 'Total: ₹1,234.50 — "Thank you", Acme & Co.!')
    expect(link).toBe(`https://wa.me/919876543210?text=${encodeURIComponent('Total: ₹1,234.50 — "Thank you", Acme & Co.!')}`)
    // Sanity check: decoding the built link recovers the exact original text.
    const encoded = link!.split('?text=')[1]
    expect(decodeURIComponent(encoded)).toBe('Total: ₹1,234.50 — "Thank you", Acme & Co.!')
  })
})

describe('buildShareEmailLink', () => {
  it('builds a mailto link with the recipient, subject, and body', () => {
    const link = buildShareEmailLink('customer@example.com', 'Invoice INV-001 from Acme', 'Please find attached.')
    // Recipient address itself is not percent-encoded (matches the plain
    // mailto:user@domain.com convention used elsewhere in this codebase,
    // e.g. external-link.util.test.ts) — only subject/body are.
    expect(link).toBe(`mailto:customer@example.com?subject=${encodeURIComponent('Invoice INV-001 from Acme')}&body=${encodeURIComponent('Please find attached.')}`)
  })

  it('still builds a valid mailto link with an empty recipient when email is null/empty, rather than blocking the action', () => {
    const linkNull = buildShareEmailLink(null, 'Subject', 'Body')
    const linkEmpty = buildShareEmailLink('', 'Subject', 'Body')
    const linkBlank = buildShareEmailLink('   ', 'Subject', 'Body')
    expect(linkNull).toBe(`mailto:?subject=${encodeURIComponent('Subject')}&body=${encodeURIComponent('Body')}`)
    expect(linkEmpty).toBe(linkNull)
    expect(linkBlank).toBe(linkNull)
  })

  it('URL-encodes special characters (currency symbols, punctuation in names) in subject and body', () => {
    const link = buildShareEmailLink('a@b.com', 'Invoice #123 from O\'Brien & Sons', 'Total: ₹45,678.90 — "Thank you"!')
    expect(link).toContain(encodeURIComponent('Invoice #123 from O\'Brien & Sons'))
    expect(link).toContain(encodeURIComponent('Total: ₹45,678.90 — "Thank you"!'))
    // No raw special characters should leak into the URL unencoded.
    expect(link).not.toContain('₹')
    expect(link).not.toContain('"')
    expect(link).not.toContain(' & ')
  })

  // Design doc Section 5.2's second-round gap: mailto:'s ~2081-character
  // ceiling (Outlook/Windows ShellExecute) is stricter than wa.me's ~2000.
  // This asserts a realistic worst case — a long business/customer name plus
  // the longest field labels this template uses — stays comfortably under
  // that ceiling, so a future template edit that adds one more interpolated
  // field doesn't silently regress past it unnoticed.
  it('keeps a realistic worst-case mailto: URL comfortably under the ~2081-character Outlook/ShellExecute ceiling', () => {
    const longBusinessName = 'A'.repeat(80) + ' Trading & Distribution Private Limited Company'
    const longRecipient = 'a-fairly-long-customer-mailbox-name.for-testing@some-long-corporate-domain-name.example.com'
    const subject = `Invoice INV-2026-000123 from ${longBusinessName}`
    const body = [
      `Dear Valued Customer,`,
      ``,
      `Please find attached Invoice INV-2026-000123 from ${longBusinessName}, for a total amount of ₹12,34,567.89.`,
      ``,
      `The detailed invoice document is attached as a file to this email.`,
      ``,
      `Thank you for your business.`,
      `${longBusinessName}`
    ].join('\n')

    const link = buildShareEmailLink(longRecipient, subject, body)
    expect(link.length).toBeLessThan(2081)
  })
})
