// While one person has a record open to edit, another PC is warned instead of both saving over each other.
// Locks live in memory on the PC that keeps the data and expire on their own, so a crashed PC never blocks a record for long.
const LOCK_MS = 3 * 60 * 1000

interface Held { userId: string; username: string; until: number }

const held = new Map<string, Held>()

const keyOf = (kind: string, id: string): string => `${kind}:${id}`

export interface LockResult { ok: boolean; heldBy?: string }

export function acquireEditLock(kind: string, id: string, user: { userId: string; username: string }, now = Date.now()): LockResult {
  const key = keyOf(kind, id)
  const cur = held.get(key)
  if (cur && cur.until > now && cur.userId !== user.userId) return { ok: false, heldBy: cur.username }
  held.set(key, { userId: user.userId, username: user.username, until: now + LOCK_MS })
  return { ok: true }
}

export function releaseEditLock(kind: string, id: string, userId: string): void {
  const key = keyOf(kind, id)
  if (held.get(key)?.userId === userId) held.delete(key)
}

export function releaseAllFor(userId: string): void {
  for (const [k, v] of held) if (v.userId === userId) held.delete(k)
}

export function clearEditLocks(): void {
  held.clear()
}
