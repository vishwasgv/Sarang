import { z } from 'zod'
import { expenseClaimService } from '../../services/expense-claim.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const SubmitSchema = z.object({
  claimantName: z.string().min(1).max(80),
  categoryId: z.string().min(1),
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(1e10),
  claimDate: z.string().optional()
})
const DecideSchema = z.object({ id: z.string().min(1), to: z.enum(['APPROVED', 'REJECTED']), note: z.string().max(300).optional() })
const PaySchema = z.object({ id: z.string().min(1), paymentMethod: z.string().min(1).max(30) })

export function register(handle: HandleFn): void {
  handle('expenseClaims:list', async (payload) => {
    const deny = await requirePermission('expenses.view'); if (deny) return deny
    const status = (payload as { status?: unknown } | null)?.status
    return expenseClaimService.list(typeof status === 'string' ? status : undefined)
  })

  handle('expenseClaims:submit', async (payload) => {
    const deny = await requirePermission('expenses.create'); if (deny) return deny
    const parsed = SubmitSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid claim.' } }
    return expenseClaimService.submit(parsed.data, getCurrentSession()?.userId)
  })

  handle('expenseClaims:decide', async (payload) => {
    const deny = await requirePermission('expenses.modify'); if (deny) return deny
    const parsed = DecideSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a claim.' } }
    return expenseClaimService.decide(parsed.data.id, parsed.data.to, parsed.data.note, getCurrentSession()?.userId)
  })

  handle('expenseClaims:pay', async (payload) => {
    const deny = await requirePermission('expenses.create'); if (deny) return deny
    const deny2 = await requirePermission('expenses.modify'); if (deny2) return deny2
    const parsed = PaySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a claim and a payment method.' } }
    return expenseClaimService.pay(parsed.data.id, parsed.data.paymentMethod, getCurrentSession()?.userId)
  })
}
