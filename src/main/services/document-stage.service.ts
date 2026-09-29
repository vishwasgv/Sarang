import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

// J19 — the per-document side of Blueprints. See blueprint-stage.service.ts for the config
// side (defining the stages themselves). A document with no assignment yet, on a document type
// that HAS stages configured, is treated as sitting at the first stage (sortOrder 0) without
// writing a row until it's actually advanced — so turning a blueprint on for a document type
// never needs a backfill pass over existing documents.

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

export const documentStageService = {
  /** The document's current stage plus the full ordered stage list for its type — everything
   *  a stage-tracker widget needs in one call. `null` data means this document type has no
   *  blueprint configured (the widget should render nothing). */
  async getCurrent(documentType: string, documentId: string) {
    try {
      const db = getPrisma()
      const stages = await db.blueprintStage.findMany({ where: { documentType, isActive: true }, orderBy: { sortOrder: 'asc' } })
      if (stages.length === 0) return { success: true, data: null }

      const assignment = await db.documentStageAssignment.findUnique({ where: { documentType_documentId: { documentType, documentId } } })
      const currentStageId = assignment?.currentStageId ?? stages[0].id
      return { success: true, data: { stages, currentStageId } }
    } catch (err) {
      return fail(err)
    }
  },

  async advance(p: { documentType: string; documentId: string; stageId: string }, userId?: string) {
    try {
      const db = getPrisma()
      const stage = await db.blueprintStage.findUnique({ where: { id: p.stageId } })
      if (!stage || stage.documentType !== p.documentType || !stage.isActive) {
        throw new ServiceError('DSA-001', 'That stage is not available for this document.')
      }
      const assignment = await db.documentStageAssignment.upsert({
        where: { documentType_documentId: { documentType: p.documentType, documentId: p.documentId } },
        create: { documentType: p.documentType, documentId: p.documentId, currentStageId: p.stageId, updatedById: userId },
        update: { currentStageId: p.stageId, updatedById: userId }
      })
      await logAction({ userId, action: 'DOCUMENT_STAGE_ADVANCED', entityType: p.documentType, entityId: p.documentId, newValue: { stageId: p.stageId, stageName: stage.name } })
      return { success: true, data: assignment }
    } catch (err) {
      return fail(err)
    }
  }
}
