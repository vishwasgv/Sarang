import { loyaltyProgramService } from '../../services/loyalty-program.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { UpsertLoyaltyProgramSchema } from '../../validation/loyalty-program.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('loyaltyProgram:get', async () => {
    const deny = await requirePermission('loyaltyProgram.view'); if (deny) return deny
    return loyaltyProgramService.getProgram()
  })

  handle('loyaltyProgram:upsert', async (payload) => {
    const deny = await requirePermission('loyaltyProgram.manage'); if (deny) return deny
    const parsed = UpsertLoyaltyProgramSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return loyaltyProgramService.upsertProgram(parsed.data, getCurrentSession()?.userId)
  })

  handle('loyaltyProgram:listCards', async (payload) => {
    const deny = await requirePermission('loyaltyProgram.view'); if (deny) return deny
    return loyaltyProgramService.listCards(payload as { readyForRewardOnly?: boolean } | undefined)
  })

  handle('loyaltyProgram:redeem', async (customerId) => {
    const deny = await requirePermission('loyaltyProgram.manage'); if (deny) return deny
    const bad = validateId(customerId, 'customer ID'); if (bad) return bad
    return loyaltyProgramService.redeemReward(customerId as string, getCurrentSession()?.userId)
  })
}
