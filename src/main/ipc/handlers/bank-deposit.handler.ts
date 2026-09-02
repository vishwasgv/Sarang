import { bankDepositService } from '../../services/bank-deposit.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateBankDepositSchema } from '../../validation/bank-deposit.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('bankDeposits:create', async (payload) => {
    const deny = await requirePermission('bankAccounts.manage'); if (deny) return deny
    const parsed = CreateBankDepositSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bankDepositService.createDeposit(parsed.data, getCurrentSession()?.userId)
  })

  handle('bankDeposits:list', async (payload) => {
    const deny = await requirePermission('bankAccounts.view'); if (deny) return deny
    return bankDepositService.listDeposits(payload as { bankAccountId?: string; page?: number; limit?: number } | undefined)
  })

  handle('bankDeposits:get', async (payload) => {
    const deny = await requirePermission('bankAccounts.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return bankDepositService.getDeposit(id)
  })

  handle('bankDeposits:listAvailableCheques', async (payload) => {
    const deny = await requirePermission('bankAccounts.view'); if (deny) return deny
    const { bankAccountId } = payload as { bankAccountId: string }
    return bankDepositService.listAvailableCheques(bankAccountId)
  })
}
