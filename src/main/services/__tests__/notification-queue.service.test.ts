import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { buildWhatsAppLink, buildReminderWhatsAppLink } from '../notification-queue.service'

describe('buildWhatsAppLink', () => {
  it('keeps a +-prefixed international number as-is', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn() } } as never)
    const link = await buildWhatsAppLink('+91 98765 43210', 'Hello')
    expect(link).toBe('https://wa.me/919876543210?text=Hello')
  })

  it('strips a 00 international prefix', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn() } } as never)
    const link = await buildWhatsAppLink('00919876543210', 'Hi')
    expect(link).toBe('https://wa.me/919876543210?text=Hi')
  })

  it('prepends the business profile country dial code to a local-format number', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ country: 'India' }) },
    } as never)
    const link = await buildWhatsAppLink('9876543210', 'Hi')
    expect(link).toBe('https://wa.me/919876543210?text=Hi')
  })

  it('URL-encodes special characters in the message', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn() } } as never)
    const link = await buildWhatsAppLink('+919876543210', 'Amount: ₹500 & due!')
    expect(link).toContain(encodeURIComponent('Amount: ₹500 & due!'))
  })
})

// 2026-09-03 — real gap found across a full audit of every reminder message
// this app sends: almost none identified which business sent them. This
// wrapper is the fix, centralized so every reminder call site gets it for
// free — see this function's own doc comment in notification-queue.service.ts.
describe('buildReminderWhatsAppLink', () => {
  it('prepends the business name as a bold WhatsApp header line', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Amba Enterprises' }) },
    } as never)
    const link = await buildReminderWhatsAppLink('+919876543210', 'Your order is ready.')
    expect(link).toContain(encodeURIComponent('*Amba Enterprises*\nYour order is ready.'))
  })

  it('falls back to no prefix when the business has no name on file', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue(null) },
    } as never)
    const link = await buildReminderWhatsAppLink('+919876543210', 'Your order is ready.')
    expect(link).toContain(encodeURIComponent('Your order is ready.'))
    expect(link).not.toContain(encodeURIComponent('*'))
  })

  it('still resolves the phone number correctly alongside the prefix', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ businessName: 'Test Biz' }) // buildReminderWhatsAppLink's own lookup
          .mockResolvedValueOnce({ country: 'India' }), // buildWhatsAppLink's dial-code lookup
      },
    } as never)
    const link = await buildReminderWhatsAppLink('9876543210', 'Hi')
    expect(link).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
  })
})
