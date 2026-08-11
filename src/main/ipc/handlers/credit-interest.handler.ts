import { creditInterestService } from '../../services/credit-interest.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('creditInterest:calculate', async (payload) => {
    const deny = await requirePermission('creditInterest.view'); if (deny) return deny
    const p = payload as { customerId: string }
    return creditInterestService.calculateInterest(p.customerId)
  })

  handle('creditInterest:post', async (payload) => {
    const deny = await requirePermission('creditInterest.post'); if (deny) return deny
    const p = payload as { customerId: string }
    return creditInterestService.postInterestCharge(p.customerId, getCurrentSession()?.userId)
  })
}
