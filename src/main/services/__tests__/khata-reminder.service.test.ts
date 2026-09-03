import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildReminderWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/919876543210?text=reminder') }))

import { getPrisma } from '../../database/db'
import { khataReminderService } from '../khata-reminder.service'

// 2026-09 §12 — Grocery/Kirana item 3: Khata (credit) auto-reminder.

describe('khataReminderService.listKhataReminderCandidates', () => {
  it('lists a customer with an outstanding balance as eligible when they have a phone and no recent reminder', async () => {
    const db = {
      customer: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'cust-1', customerName: 'Ramesh Kirana', phone: '9876543210', lastKhataReminderSentAt: null },
        ]),
      },
      customerLedger: {
        findMany: vi.fn().mockResolvedValue([
          { customerId: 'cust-1', debitAmount: 500, creditAmount: 0, createdAt: new Date(Date.now() - 10 * 86400000) },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.listKhataReminderCandidates()

    expect(res.success).toBe(true)
    expect(res.data?.[0]).toMatchObject({ customerName: 'Ramesh Kirana', outstanding: 500, eligibleForReminder: true })
  })

  it('excludes a customer with zero outstanding balance', async () => {
    const db = {
      customer: { findMany: vi.fn().mockResolvedValue([{ id: 'cust-2', customerName: 'Fully Paid', phone: '9876500000', lastKhataReminderSentAt: null }]) },
      customerLedger: { findMany: vi.fn().mockResolvedValue([{ customerId: 'cust-2', debitAmount: 100, creditAmount: 100, createdAt: new Date() }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.listKhataReminderCandidates()

    expect(res.data).toEqual([])
  })

  it('marks a customer ineligible when there is no phone number on file', async () => {
    const db = {
      customer: { findMany: vi.fn().mockResolvedValue([{ id: 'cust-3', customerName: 'No Phone Customer', phone: null, lastKhataReminderSentAt: null }]) },
      customerLedger: { findMany: vi.fn().mockResolvedValue([{ customerId: 'cust-3', debitAmount: 300, creditAmount: 0, createdAt: new Date() }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.listKhataReminderCandidates()

    expect(res.data?.[0]).toMatchObject({ eligibleForReminder: false, ineligibleReason: 'No phone number on file.' })
  })

  it('marks a customer ineligible when a reminder was already sent within the cooldown window', async () => {
    const db = {
      customer: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'cust-4', customerName: 'Recently Reminded', phone: '9876511111', lastKhataReminderSentAt: new Date(Date.now() - 2 * 86400000) },
        ]),
      },
      customerLedger: { findMany: vi.fn().mockResolvedValue([{ customerId: 'cust-4', debitAmount: 300, creditAmount: 0, createdAt: new Date() }]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.listKhataReminderCandidates()

    expect(res.data?.[0].eligibleForReminder).toBe(false)
    expect(res.data?.[0].ineligibleReason).toMatch(/already sent/)
  })
})

describe('khataReminderService.buildKhataReminderLink', () => {
  it('builds a WhatsApp link and stamps lastKhataReminderSentAt', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const db = {
      customer: {
        findUnique: vi.fn().mockResolvedValue({ customerName: 'Ramesh Kirana', phone: '9876543210' }),
        update: updateMock,
      },
      customerLedger: { findMany: vi.fn().mockResolvedValue([{ debitAmount: 500, creditAmount: 0 }]) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.buildKhataReminderLink('cust-1')

    expect(res.success).toBe(true)
    expect(res.data).toContain('wa.me')
    expect(updateMock).toHaveBeenCalledWith({ where: { id: 'cust-1' }, data: { lastKhataReminderSentAt: expect.any(Date) } })
  })

  it('fails when the customer has no phone number on file', async () => {
    const db = { customer: { findUnique: vi.fn().mockResolvedValue({ customerName: 'No Phone', phone: null }) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.buildKhataReminderLink('cust-2')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('KHATA-002')
  })

  it('fails when the customer has no outstanding balance', async () => {
    const db = {
      customer: { findUnique: vi.fn().mockResolvedValue({ customerName: 'Fully Paid', phone: '9876500000' }) },
      customerLedger: { findMany: vi.fn().mockResolvedValue([{ debitAmount: 100, creditAmount: 100 }]) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.buildKhataReminderLink('cust-3')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('KHATA-003')
  })

  it('fails when the customer does not exist', async () => {
    const db = { customer: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await khataReminderService.buildKhataReminderLink('cust-missing')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CUST-001')
  })
})
