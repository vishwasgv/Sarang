import { getPrisma } from '../database/db'

export async function listBoardResolutions(boardMeetingId: string) {
  try {
    const db = getPrisma()
    const resolutions = await db.boardResolution.findMany({
      where: { boardMeetingId },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: resolutions }
  } catch (err) {
    return { success: false, error: { code: 'BR-001', message: err instanceof Error ? err.message : 'Could not list resolutions.' } }
  }
}

// Phase 58 §2 — Company Secretary: auto-sequenced resolution numbering,
// scoped PER CLIENT (COMPANY) — each client's resolutions restart/track
// independently, since a real CS files these against separate companies
// (numbering ABC Ltd's resolutions into the same sequence as XYZ Pvt Ltd's
// would be wrong). Count-based rather than parsing the previous number: the
// pre-existing free-text field may already hold non-integer formats (e.g.
// "2024-03") from before auto-sequencing existed, and count-based numbering
// never breaks on those.
async function nextResolutionNumberForClient(db: ReturnType<typeof getPrisma>, clientId: string): Promise<string> {
  const count = await db.boardResolution.count({ where: { boardMeeting: { clientId } } })
  return String(count + 1)
}

export async function createBoardResolution(payload: {
  boardMeetingId: string
  resolutionNumber?: string
  resolutionType?: string
  resolutionText: string
  passedUnanimously?: boolean
}) {
  try {
    const db = getPrisma()
    const meeting = await db.boardMeeting.findUnique({ where: { id: payload.boardMeetingId }, select: { id: true, clientId: true } })
    if (!meeting) return { success: false, error: { code: 'BR-002', message: 'Board meeting not found.' } }
    if (!payload.resolutionText.trim()) return { success: false, error: { code: 'BR-003', message: 'Resolution text is required.' } }

    const resolutionNumber = payload.resolutionNumber?.trim() || await nextResolutionNumberForClient(db, meeting.clientId)

    const resolution = await db.boardResolution.create({
      data: {
        boardMeetingId: payload.boardMeetingId,
        resolutionNumber,
        resolutionType: payload.resolutionType ?? 'ORDINARY',
        resolutionText: payload.resolutionText.trim(),
        passedUnanimously: payload.passedUnanimously ?? true,
      },
    })
    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'BoardResolution', entityId: resolution.id, newValue: JSON.stringify({ boardMeetingId: payload.boardMeetingId, resolutionNumber: resolution.resolutionNumber }) },
    }).catch(() => {})
    return { success: true, data: resolution }
  } catch (err) {
    return { success: false, error: { code: 'BR-004', message: err instanceof Error ? err.message : 'Could not create resolution.' } }
  }
}

export async function updateBoardResolution(payload: {
  id: string
  resolutionNumber?: string
  resolutionType?: string
  resolutionText?: string
  passedUnanimously?: boolean
}) {
  try {
    const db = getPrisma()
    const { id, ...rest } = payload
    if (rest.resolutionText !== undefined && !rest.resolutionText.trim()) {
      return { success: false, error: { code: 'BR-003', message: 'Resolution text is required.' } }
    }
    const resolution = await db.boardResolution.update({ where: { id }, data: rest })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'BoardResolution', entityId: id } }).catch(() => {})
    return { success: true, data: resolution }
  } catch (err) {
    return { success: false, error: { code: 'BR-005', message: err instanceof Error ? err.message : 'Could not update resolution.' } }
  }
}

export async function deleteBoardResolution(id: string) {
  try {
    const db = getPrisma()
    await db.boardResolution.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'BoardResolution', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'BR-006', message: err instanceof Error ? err.message : 'Could not delete resolution.' } }
  }
}
