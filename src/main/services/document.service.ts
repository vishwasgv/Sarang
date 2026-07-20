import { app } from 'electron'
import { copyFile, mkdir, unlink, stat } from 'fs/promises'
import { join, extname } from 'path'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

const ALLOWED_TYPES: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
}

export type DocumentEntityType =
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'EXPENSE'
  | 'PRODUCTION_ORDER'
  // Fresh-audit fix (2026-07-12): lets Architect/Civil Engineer attach a real
  // design-plan file (PDF/image/CAD export) to a drawing revision or site
  // visit record — previously these were metadata-only with no way to save
  // the actual plan document, despite the app already having this generic
  // attachment system built for other entity types.
  | 'DRAWING_REVISION'
  | 'SITE_VISIT'
  // Phase 58 §1 (2026-07-17) — extends the same generic attachment system to
  // the remaining entities that had zero way to attach a real file (agreement
  // PDF, filing acknowledgement, X-ray/scan image, etc.) despite the app
  // already having this infrastructure built and proven on 8 other types.
  | 'LEGAL_CASE'
  | 'COMPLIANCE_TASK'
  | 'ENGAGEMENT'
  | 'ROC_FILING'
  | 'BOARD_MEETING'
  | 'VISIT_NOTE'
  | 'TREATMENT_PLAN'
  | 'LAB_TEST_ORDER'
  // Phase 58 §2 (2026-07-17) — condition-out/condition-in photo evidence on a
  // rental line item. Keyed to RentalBookingItem.id (not RentalBooking.id) so
  // a multi-unit booking's photos attribute correctly to the specific unit.
  | 'RENTAL_BOOKING_ITEM'
  // Phase 58 §2 — Beauty Salon before/after photo attachment per appointment.
  | 'APPOINTMENT'
  // Phase 58 §2 — Placement Agency resume/CV attachment.
  | 'CANDIDATE'

function getDocDir(): string {
  return join(app.getPath('userData'), 'documents')
}

export async function attachDocument(payload: {
  sourcePath: string
  fileName: string
  entityType: DocumentEntityType
  entityId: string
  notes?: string
}, userId?: string) {
  try {
    const ext = extname(payload.fileName).toLowerCase()
    if (!ALLOWED_TYPES[ext]) {
      return { success: false, error: { code: 'DOC-001', message: `File type ${ext} is not allowed. Supported: PDF, images, Office documents, CSV, TXT.` } }
    }

    const fileStats = await stat(payload.sourcePath)
    const docDir = getDocDir()
    await mkdir(docDir, { recursive: true })

    const storedName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    const destPath = join(docDir, storedName)
    await copyFile(payload.sourcePath, destPath)

    const db = getPrisma()
    const doc = await db.document.create({
      data: {
        fileName: payload.fileName,
        storedName,
        filePath: destPath,
        mimeType: ALLOWED_TYPES[ext],
        fileSizeBytes: fileStats.size,
        entityType: payload.entityType,
        entityId: payload.entityId,
        notes: payload.notes ?? null,
        uploadedById: userId ?? null
      }
    })

    await logAction(userId, 'DOCUMENT_ATTACHED', 'Document', doc.id, undefined, { fileName: payload.fileName, entityType: payload.entityType, entityId: payload.entityId })
    return { success: true, data: toRecord(doc) }
  } catch (err) {
    return { success: false, error: { code: 'DOC-002', message: err instanceof Error ? err.message : 'Failed to attach document.' } }
  }
}

export async function listDocuments(entityType: DocumentEntityType, entityId: string) {
  try {
    const db = getPrisma()
    const docs = await db.document.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, data: docs.map(toRecord) }
  } catch (err) {
    return { success: false, error: { code: 'DOC-003', message: err instanceof Error ? err.message : 'Failed to list documents.' } }
  }
}

export async function deleteDocument(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return { success: false, error: { code: 'DOC-004', message: 'Document not found.' } }

    try {
      await unlink(doc.filePath)
    } catch { /* file may already be gone */ }

    await db.document.delete({ where: { id } })
    await logAction(userId, 'DOCUMENT_DELETED', 'Document', id, { fileName: doc.fileName })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'DOC-005', message: err instanceof Error ? err.message : 'Failed to delete document.' } }
  }
}

export async function listAllDocuments(opts?: { entityType?: DocumentEntityType; limit?: number }) {
  try {
    const db = getPrisma()
    const docs = await db.document.findMany({
      where: opts?.entityType ? { entityType: opts.entityType } : undefined,
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 200
    })
    return { success: true, data: docs.map(toRecord) }
  } catch (err) {
    return { success: false, error: { code: 'DOC-007', message: err instanceof Error ? err.message : 'Failed to list documents.' } }
  }
}

export async function getDocumentPath(id: string) {
  try {
    const db = getPrisma()
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return { success: false, error: { code: 'DOC-004', message: 'Document not found.' } }
    return { success: true, data: { filePath: doc.filePath, fileName: doc.fileName, mimeType: doc.mimeType } }
  } catch (err) {
    return { success: false, error: { code: 'DOC-006', message: err instanceof Error ? err.message : 'Failed to get document.' } }
  }
}

function toRecord(doc: {
  id: string; fileName: string; storedName: string; filePath: string
  mimeType: string; fileSizeBytes: bigint; entityType: string; entityId: string
  notes: string | null; uploadedById: string | null; createdAt: Date
}) {
  return {
    id: doc.id,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSizeBytes: Number(doc.fileSizeBytes),
    entityType: doc.entityType,
    entityId: doc.entityId,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString()
  }
}
