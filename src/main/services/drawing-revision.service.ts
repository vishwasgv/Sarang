import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Fresh-audit build (2026-07-12) — Architect real depth. A drawing register
// (which drawing, which revision, current status) is genuine everyday
// architectural-practice bookkeeping, gated on the drawing_register module.

export async function listDrawingRevisions(projectId: string) {
  try {
    const db = getPrisma()
    const items = await db.drawingRevision.findMany({ where: { projectId }, orderBy: [{ drawingNumber: 'asc' }, { createdAt: 'desc' }] })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'DR-001', message: err instanceof Error ? err.message : 'Could not list drawing revisions.' } }
  }
}

export async function createDrawingRevision(payload: {
  projectId: string
  drawingNumber: string
  title: string
  discipline?: string
  revisionNumber?: string
  status?: string
  issuedDate?: string
  notes?: string
}) {
  try {
    if (!payload.drawingNumber.trim()) return { success: false, error: { code: 'DR-002', message: 'Drawing number is required.' } }
    if (!payload.title.trim()) return { success: false, error: { code: 'DR-003', message: 'Title is required.' } }
    const db = getPrisma()
    const item = await db.drawingRevision.create({
      data: {
        projectId: payload.projectId,
        drawingNumber: payload.drawingNumber.trim(),
        title: payload.title.trim(),
        discipline: payload.discipline ?? 'ARCHITECTURAL',
        revisionNumber: payload.revisionNumber?.trim() || 'A',
        status: payload.status ?? 'DRAFT',
        issuedDate: payload.issuedDate ? new Date(payload.issuedDate) : null,
        notes: payload.notes ?? null,
      }
    })
    await logAction({ action: 'DRAWING_REVISION_CREATED', entityType: 'DrawingRevision', entityId: item.id, newValue: { drawingNumber: item.drawingNumber, revisionNumber: item.revisionNumber } })
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'DR-004', message: err instanceof Error ? err.message : 'Could not create drawing revision.' } }
  }
}

export async function updateDrawingRevision(payload: {
  id: string
  drawingNumber?: string
  title?: string
  discipline?: string
  revisionNumber?: string
  status?: string
  issuedDate?: string | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, issuedDate, ...rest } = payload
    const item = await db.drawingRevision.update({
      where: { id },
      data: {
        ...rest,
        ...(issuedDate !== undefined ? { issuedDate: issuedDate ? new Date(issuedDate) : null } : {}),
      }
    })
    await logAction({ action: 'DRAWING_REVISION_UPDATED', entityType: 'DrawingRevision', entityId: id })
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'DR-005', message: err instanceof Error ? err.message : 'Could not update drawing revision.' } }
  }
}

export async function deleteDrawingRevision(id: string) {
  try {
    const db = getPrisma()
    await db.drawingRevision.delete({ where: { id } })
    await logAction({ action: 'DRAWING_REVISION_DELETED', entityType: 'DrawingRevision', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'DR-006', message: err instanceof Error ? err.message : 'Could not delete drawing revision.' } }
  }
}
