import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

// J19 — Blueprints: an owner-defined named pipeline a document visibly moves through (e.g.
// Draft -> Approved -> Sent to Supplier -> Received), with a widget on the document screen to
// advance it. This file is the config side (define/reorder/retire the stages for a document
// type); document-stage.service.ts is the per-document side (get/advance a real document's
// current stage). Deliberately not an approval gate — see ApprovalWorkflow for that; anyone who
// can already edit the document can advance its stage here.

const MAX_STAGES_PER_TYPE = 20

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

export const blueprintStageService = {
  async list(documentType: string) {
    try {
      const db = getPrisma()
      const stages = await db.blueprintStage.findMany({
        where: { documentType, isActive: true },
        orderBy: { sortOrder: 'asc' }
      })
      return { success: true, data: stages }
    } catch (err) {
      return fail(err)
    }
  },

  async add(p: { documentType: string; name: string }, userId?: string) {
    try {
      const name = p.name.trim()
      if (!name) throw new ServiceError('BPS-001', 'Give the stage a name.')
      const db = getPrisma()
      const existing = await db.blueprintStage.findMany({ where: { documentType: p.documentType, isActive: true } })
      if (existing.length >= MAX_STAGES_PER_TYPE) throw new ServiceError('BPS-002', `You can keep up to ${MAX_STAGES_PER_TYPE} stages. Retire one first.`)
      if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new ServiceError('BPS-003', 'A stage with this name already exists.')
      const nextOrder = existing.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1
      const stage = await db.blueprintStage.create({
        data: { documentType: p.documentType, name: name.slice(0, 80), sortOrder: nextOrder }
      })
      await logAction({ userId, action: 'BLUEPRINT_STAGE_ADDED', entityType: 'BlueprintStage', entityId: stage.id, newValue: { documentType: p.documentType, name: stage.name } })
      return { success: true, data: stage }
    } catch (err) {
      return fail(err)
    }
  },

  async reorder(p: { documentType: string; orderedIds: string[] }, userId?: string) {
    try {
      const db = getPrisma()
      const stages = await db.blueprintStage.findMany({ where: { documentType: p.documentType, isActive: true } })
      const validIds = new Set(stages.map((s) => s.id))
      if (p.orderedIds.length !== stages.length || !p.orderedIds.every((id) => validIds.has(id))) {
        throw new ServiceError('BPS-004', 'That list of stages does not match what is currently active.')
      }
      await db.$transaction(p.orderedIds.map((id, i) => db.blueprintStage.update({ where: { id }, data: { sortOrder: i } })))
      await logAction({ userId, action: 'BLUEPRINT_STAGES_REORDERED', entityType: 'BlueprintStage', entityId: p.documentType, newValue: { order: p.orderedIds } })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  },

  // Stages are retired (isActive: false), never hard-deleted — a real document may already be
  // assigned to this stage (DocumentStageAssignment.currentStageId is a real FK to this table),
  // and losing that history silently would be worse than just hiding the stage from new use.
  async retire(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const stage = await db.blueprintStage.update({ where: { id }, data: { isActive: false } })
      await logAction({ userId, action: 'BLUEPRINT_STAGE_RETIRED', entityType: 'BlueprintStage', entityId: id, newValue: { documentType: stage.documentType, name: stage.name } })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  }
}
