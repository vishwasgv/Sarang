import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import * as svc from '../../services/blood-bank.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('bloodBank:createDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const session = getCurrentSession()
    return svc.createDonor(payload as Parameters<typeof svc.createDonor>[0], session?.userId)
  })

  handle('bloodBank:listDonors', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listDonors(payload as Parameters<typeof svc.listDonors>[0])
  })

  handle('bloodBank:getDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getDonor(id)
  })

  handle('bloodBank:updateDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const session = getCurrentSession()
    return svc.updateDonor(payload as Parameters<typeof svc.updateDonor>[0], session?.userId)
  })

  handle('bloodBank:deactivateDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const session = getCurrentSession()
    const { id } = payload as { id: string }
    return svc.deactivateDonor(id, session?.userId)
  })

  handle('bloodBank:sendDonorRecall', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const { donorId } = payload as { donorId: string }
    return svc.sendDonorRecall(donorId)
  })

  handle('bloodBank:createDonationCamp', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const session = getCurrentSession()
    return svc.createDonationCamp(payload as Parameters<typeof svc.createDonationCamp>[0], session?.userId)
  })

  handle('bloodBank:listDonationCamps', async () => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listDonationCamps()
  })

  handle('bloodBank:createDonationRecord', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const session = getCurrentSession()
    return svc.createDonationRecord(payload as Parameters<typeof svc.createDonationRecord>[0], session?.userId)
  })

  handle('bloodBank:listDonationRecords', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listDonationRecords(payload as Parameters<typeof svc.listDonationRecords>[0])
  })

  handle('bloodBank:updateScreeningStatus', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const session = getCurrentSession()
    return svc.updateScreeningStatus(payload as Parameters<typeof svc.updateScreeningStatus>[0], session?.userId)
  })

  handle('bloodBank:getBloodStock', async () => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.getBloodStock()
  })

  handle('bloodBank:checkCompatibilityBatch', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.checkCompatibilityBatch(payload as Parameters<typeof svc.checkCompatibilityBatch>[0])
  })

  handle('bloodBank:createIssue', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const session = getCurrentSession()
    return svc.createBloodIssue(payload as Parameters<typeof svc.createBloodIssue>[0], session?.userId)
  })

  handle('bloodBank:listIssues', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listBloodIssues(payload as Parameters<typeof svc.listBloodIssues>[0])
  })

  handle('bloodBank:getIssue', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getBloodIssue(id)
  })

  handle('bloodBank:cancelIssue', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const session = getCurrentSession()
    const { id } = payload as { id: string }
    return svc.cancelBloodIssue(id, session?.userId)
  })

  handle('bloodBank:generateIssueInvoice', async (payload) => {
    // Routine front-desk billing once units are already issued — matches the
    // labOrders/appointments precedent of gating invoice generation on the
    // create-level permission, not manage. See seed.ts's Cashier grant.
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.generateBloodIssueInvoice(id)
  })
}
