// Phase 57 — AI Assistant. A genuinely separate, strictly read-only database
// connection — distinct from the app's normal read-write client (getPrisma()
// in db.ts). Defense in depth: even though the query-template layer itself
// should never emit a write, this connection physically cannot perform one.
// See AI_ASSISTANT_MASTER_PROMPT.md Section 3, PHASE_57_TECHNICAL_SPEC.md
// Section 6 — "a second Prisma client / raw SQLite connection using mode=ro
// or PRAGMA query_only=ON, distinct from the app's normal read-write client."
import { PrismaClient } from '@prisma/client'
import { getDatabasePath } from './db'

let readOnlyPrisma: PrismaClient | null = null

export async function getReadOnlyPrisma(): Promise<PrismaClient> {
  if (readOnlyPrisma) return readOnlyPrisma

  const dbPath = getDatabasePath()
  readOnlyPrisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}?mode=ro` } }
  })
  await readOnlyPrisma.$connect()
  // Belt-and-braces on top of the mode=ro connection string — SQLite's own
  // query_only pragma rejects any write at the connection level, not just
  // at the URL-parsing level.
  await readOnlyPrisma.$queryRaw`PRAGMA query_only=ON`

  return readOnlyPrisma
}

export async function closeReadOnlyPrisma(): Promise<void> {
  if (readOnlyPrisma) {
    await readOnlyPrisma.$disconnect()
    readOnlyPrisma = null
  }
}
