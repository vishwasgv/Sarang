import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart } from '../utils/date.util'

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
        // Real bug found live (2026-08-27 Phase 68 audit): a bare
        // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent
        // with this app's own parseLocalDateStart convention used
        // everywhere else for a date-only write.
        issuedDate: payload.issuedDate ? parseLocalDateStart(payload.issuedDate) : null,
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
  approvedByName?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, issuedDate, ...rest } = payload

    // Client approval/sign-off trail: moving TO 'APPROVED' requires a real
    // signer name, not just a status flip. Checks the incoming payload first
    // (so approving-with-a-name-in-the-same-call works), falling back to
    // whatever is already stored on the row (so re-saving an already-approved
    // revision with other edits doesn't require re-typing the name).
    if (payload.status === 'APPROVED') {
      const nameProvided = payload.approvedByName?.trim()
      if (!nameProvided) {
        const existing = await db.drawingRevision.findUnique({ where: { id }, select: { approvedByName: true } })
        if (!existing?.approvedByName) {
          return { success: false, error: { code: 'DR-007', message: 'A signer name is required to mark a drawing revision Approved.' } }
        }
      }
    }

    const item = await db.drawingRevision.update({
      where: { id },
      data: {
        ...rest,
        ...(issuedDate !== undefined ? { issuedDate: issuedDate ? parseLocalDateStart(issuedDate) : null } : {}),
        ...(payload.status === 'APPROVED' && payload.approvedByName?.trim() ? { approvedDate: new Date() } : {}),
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

// Phase 58 §2 — the only path that properly advances a drawing to its next
// revision: creates a NEW row linked back to its predecessor via
// supersedesId, and flips the predecessor's status to SUPERSEDED — so Rev A
// and Rev B stay two real, independently comparable rows instead of one
// mutable revisionNumber field silently overwriting history.
export async function issueNewRevision(payload: {
  previousRevisionId: string
  revisionNumber: string
  title?: string
  discipline?: string
  issuedDate?: string
  notes?: string
}) {
  try {
    if (!payload.revisionNumber.trim()) return { success: false, error: { code: 'DR-008', message: 'Revision number is required.' } }
    const db = getPrisma()
    const previous = await db.drawingRevision.findUnique({ where: { id: payload.previousRevisionId } })
    if (!previous) return { success: false, error: { code: 'DR-009', message: 'Previous revision not found.' } }
    if (previous.status === 'SUPERSEDED') {
      return { success: false, error: { code: 'DR-010', message: 'This revision has already been superseded by a later one.' } }
    }

    const created = await db.$transaction(async (tx) => {
      const next = await tx.drawingRevision.create({
        data: {
          projectId: previous.projectId,
          drawingNumber: previous.drawingNumber,
          title: payload.title?.trim() || previous.title,
          discipline: payload.discipline ?? previous.discipline,
          revisionNumber: payload.revisionNumber.trim(),
          status: 'DRAFT',
          issuedDate: payload.issuedDate ? parseLocalDateStart(payload.issuedDate) : null,
          notes: payload.notes ?? null,
          supersedesId: previous.id,
        },
      })
      await tx.drawingRevision.update({ where: { id: previous.id }, data: { status: 'SUPERSEDED' } })
      return next
    })

    await logAction({ action: 'DRAWING_REVISION_ISSUED', entityType: 'DrawingRevision', entityId: created.id, newValue: { drawingNumber: created.drawingNumber, revisionNumber: created.revisionNumber, supersedesId: previous.id } })
    return { success: true, data: created }
  } catch (err) {
    return { success: false, error: { code: 'DR-011', message: err instanceof Error ? err.message : 'Could not issue new revision.' } }
  }
}

// Phase 68 §9.1 — Architect item 5: superseded-drawing warning. issueNewRevision
// is the only path that properly retires a revision (creates a real
// successor AND flips the predecessor to SUPERSEDED in the same
// transaction). But the status dropdown on DrawingRegisterScreen lets a
// user flip ANY revision's status directly, including setting the newest
// (currently-displayed "current") revision to SUPERSEDED without ever
// issuing a replacement — silently leaving that drawing number with no
// valid current revision at all, which is exactly the dangerous case a site
// team could act on by mistake. Flags any SUPERSEDED row that nothing else
// in the register actually supersedes (no other row's supersedesId points
// at it) as orphaned.
export interface OrphanedSupersededDrawing {
  id: string
  projectId: string
  drawingNumber: string
  title: string
  revisionNumber: string
}

export async function getOrphanedSupersededDrawings(
  projectId: string
): Promise<{ success: true; data: OrphanedSupersededDrawing[] } | { success: false; error: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const revisions = await db.drawingRevision.findMany({ where: { projectId }, select: { id: true, drawingNumber: true, title: true, revisionNumber: true, status: true, supersedesId: true } })
    const supersededByOthers = new Set(revisions.map((r) => r.supersedesId).filter((id): id is string => !!id))
    const orphaned = revisions.filter((r) => r.status === 'SUPERSEDED' && !supersededByOthers.has(r.id))
    return {
      success: true,
      data: orphaned.map((r) => ({ id: r.id, projectId, drawingNumber: r.drawingNumber, title: r.title, revisionNumber: r.revisionNumber })),
    }
  } catch (err) {
    return { success: false, error: { code: 'DR-013', message: err instanceof Error ? err.message : 'Could not check for orphaned superseded drawings.' } }
  }
}

// Full history for one drawing number, oldest first — Rev A alongside Rev B
// alongside Rev C, each a real independently-queryable row.
export async function getRevisionHistory(projectId: string, drawingNumber: string) {
  try {
    const db = getPrisma()
    const items = await db.drawingRevision.findMany({
      where: { projectId, drawingNumber },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'DR-012', message: err instanceof Error ? err.message : 'Could not load revision history.' } }
  }
}
