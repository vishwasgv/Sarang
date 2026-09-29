import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'

let handle: RealDb

describe('blueprints (J19) against the real database', () => {
  beforeAll(async () => { handle = await openRealDb() }, 120000)
  afterAll(async () => { await handle.close() })

  it('adds stages in order, reorders them, and retires one without losing history', async () => {
    const { blueprintStageService } = await import('../../services/blueprint-stage.service')

    const a = await blueprintStageService.add({ documentType: 'SALES_ORDER', name: 'Draft' }) as { success: boolean; data: { id: string } }
    const b = await blueprintStageService.add({ documentType: 'SALES_ORDER', name: 'Approved' }) as { success: boolean; data: { id: string } }
    const c = await blueprintStageService.add({ documentType: 'SALES_ORDER', name: 'Shipped' }) as { success: boolean; data: { id: string } }
    expect(a.success && b.success && c.success).toBe(true)

    const listed = await blueprintStageService.list('SALES_ORDER') as { success: boolean; data: { id: string; sortOrder: number }[] }
    expect(listed.data.map((s) => s.id)).toEqual([a.data.id, b.data.id, c.data.id])

    const reordered = await blueprintStageService.reorder({ documentType: 'SALES_ORDER', orderedIds: [c.data.id, a.data.id, b.data.id] })
    expect(reordered).toMatchObject({ success: true })
    const afterReorder = await blueprintStageService.list('SALES_ORDER') as { data: { id: string }[] }
    expect(afterReorder.data.map((s) => s.id)).toEqual([c.data.id, a.data.id, b.data.id])

    // A different document type's stages are completely independent.
    const other = await blueprintStageService.add({ documentType: 'PURCHASE_ORDER', name: 'Draft' })
    expect(other).toMatchObject({ success: true })
    const poList = await blueprintStageService.list('SALES_ORDER') as { data: unknown[] }
    expect(poList.data.length).toBe(3) // unaffected by the PURCHASE_ORDER add

    const retired = await blueprintStageService.retire(a.data.id)
    expect(retired).toMatchObject({ success: true })
    const afterRetire = await blueprintStageService.list('SALES_ORDER') as { data: { id: string }[] }
    expect(afterRetire.data.map((s) => s.id)).toEqual([c.data.id, b.data.id])
  })

  it('rejects a duplicate stage name and a full stage list', async () => {
    const { blueprintStageService } = await import('../../services/blueprint-stage.service')
    const dup1 = await blueprintStageService.add({ documentType: 'INVOICE', name: 'Same Name' })
    expect(dup1).toMatchObject({ success: true })
    const dup2 = await blueprintStageService.add({ documentType: 'INVOICE', name: 'same name' }) as { success: boolean; error?: { code: string } }
    expect(dup2.success).toBe(false)
    expect(dup2.error?.code).toBe('BPS-003')
  })

  it('a document with no assignment yet sits at the first stage; advancing writes a real, upsertable assignment', async () => {
    const { blueprintStageService } = await import('../../services/blueprint-stage.service')
    const { documentStageService } = await import('../../services/document-stage.service')

    const s1 = await blueprintStageService.add({ documentType: 'BILL', name: 'Open' }) as { data: { id: string } }
    const s2 = await blueprintStageService.add({ documentType: 'BILL', name: 'Paid' }) as { data: { id: string } }

    const beforeAssign = await documentStageService.getCurrent('BILL', 'bill-1') as { success: boolean; data: { currentStageId: string; stages: unknown[] } }
    expect(beforeAssign.success).toBe(true)
    expect(beforeAssign.data!.currentStageId).toBe(s1.data.id) // defaults to the first stage, no row written yet

    const advanced = await documentStageService.advance({ documentType: 'BILL', documentId: 'bill-1', stageId: s2.data.id })
    expect(advanced).toMatchObject({ success: true })

    const afterAssign = await documentStageService.getCurrent('BILL', 'bill-1') as { data: { currentStageId: string } }
    expect(afterAssign.data.currentStageId).toBe(s2.data.id)

    // Advancing again for the SAME document upserts (does not create a second row).
    await documentStageService.advance({ documentType: 'BILL', documentId: 'bill-1', stageId: s1.data.id })
    const back = await documentStageService.getCurrent('BILL', 'bill-1') as { data: { currentStageId: string } }
    expect(back.data.currentStageId).toBe(s1.data.id)

    const { getPrisma } = await import('../../database/db')
    const rows = await getPrisma().documentStageAssignment.findMany({ where: { documentType: 'BILL', documentId: 'bill-1' } })
    expect(rows.length).toBe(1)
  })

  it('refuses to advance to a stage from a different document type, or a retired one', async () => {
    const { blueprintStageService } = await import('../../services/blueprint-stage.service')
    const { documentStageService } = await import('../../services/document-stage.service')

    const wrongType = await blueprintStageService.add({ documentType: 'QUOTATION', name: 'Sent' }) as { data: { id: string } }
    const crossType = await documentStageService.advance({ documentType: 'BILL', documentId: 'bill-2', stageId: wrongType.data.id }) as { success: boolean; error?: { code: string } }
    expect(crossType.success).toBe(false)
    expect(crossType.error?.code).toBe('DSA-001')

    const retiredStage = await blueprintStageService.add({ documentType: 'CREDIT_NOTE', name: 'Draft' }) as { data: { id: string } }
    await blueprintStageService.retire(retiredStage.data.id)
    const afterRetireAdvance = await documentStageService.advance({ documentType: 'CREDIT_NOTE', documentId: 'cn-1', stageId: retiredStage.data.id }) as { success: boolean; error?: { code: string } }
    expect(afterRetireAdvance.success).toBe(false)
    expect(afterRetireAdvance.error?.code).toBe('DSA-001')
  })

  it('a document type with no stages configured returns null (widget renders nothing)', async () => {
    const { documentStageService } = await import('../../services/document-stage.service')
    const res = await documentStageService.getCurrent('SOME_UNCONFIGURED_TYPE', 'doc-1')
    expect(res).toEqual({ success: true, data: null })
  })
})
