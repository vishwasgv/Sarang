import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../permission-guard', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../services/customer.service', () => ({
  listCustomers: vi.fn(),
  listOutstandingCustomers: vi.fn(),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn().mockResolvedValue({ success: true, data: {} }),
  archiveCustomer: vi.fn(),
  getCustomerLedger: vi.fn(),
}))

import { requirePermission } from '../../permission-guard'
import * as customerService from '../../../services/customer.service'
import { register } from '../customers.handler'

// REAL BUG found+fixed 2026-08-03 (IPC auth-layer audit): customers:update
// only ever checked customers.update — seed.ts defines a separate, more
// restricted customers.modifyCreditLimit (Manager/Admin only, Cashier does
// NOT have it) that was completely unenforced anywhere in the codebase. A
// Cashier could raise any customer's credit limit through the normal Edit
// Customer form. Fixed to additionally require customers.modifyCreditLimit
// whenever the update payload actually changes creditLimit from its current
// stored value — ordinary edits (name, phone, etc.) by a Cashier still work.
describe('customers.handler — creditLimit change requires customers.modifyCreditLimit', () => {
  function captureHandlers() {
    const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()
    register((channel, handler) => { handlers.set(channel, handler) })
    return handlers
  }

  const basePayload = {
    id: 'cust-1', customerName: 'Acme Traders', creditLimit: 5000
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePermission).mockResolvedValue(null) // allow, by default
  })

  it('requires customers.modifyCreditLimit when creditLimit actually changes', async () => {
    vi.mocked(customerService.getCustomer).mockResolvedValue({ success: true, data: { id: 'cust-1', creditLimit: 1000 } } as never)
    const handlers = captureHandlers()

    await handlers.get('customers:update')!(basePayload)

    expect(requirePermission).toHaveBeenCalledWith('customers.update')
    expect(requirePermission).toHaveBeenCalledWith('customers.modifyCreditLimit')
  })

  it('does NOT require customers.modifyCreditLimit when creditLimit is unchanged (ordinary Cashier edit)', async () => {
    vi.mocked(customerService.getCustomer).mockResolvedValue({ success: true, data: { id: 'cust-1', creditLimit: 5000 } } as never)
    const handlers = captureHandlers()

    const res = await handlers.get('customers:update')!(basePayload)

    expect(requirePermission).toHaveBeenCalledWith('customers.update')
    expect(requirePermission).not.toHaveBeenCalledWith('customers.modifyCreditLimit')
    expect(res).toEqual({ success: true, data: {} })
  })

  it('blocks the update when customers.modifyCreditLimit is denied, even though customers.update was allowed', async () => {
    vi.mocked(customerService.getCustomer).mockResolvedValue({ success: true, data: { id: 'cust-1', creditLimit: 1000 } } as never)
    vi.mocked(requirePermission).mockImplementation(async (perm: string) =>
      perm === 'customers.modifyCreditLimit'
        ? { success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } }
        : null
    )
    const handlers = captureHandlers()

    const res = await handlers.get('customers:update')!(basePayload)

    expect(res).toEqual({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
    expect(customerService.updateCustomer).not.toHaveBeenCalled()
  })
})
