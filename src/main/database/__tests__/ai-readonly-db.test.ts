import { describe, it, expect, vi, afterAll } from 'vitest'
import { join } from 'path'

// PHASE_57_TECHNICAL_SPEC.md Section 9: "all DB access from the AI
// subsystem goes through a connection opened strictly read-only, verified
// by a write-attempt test... not just by application logic that could be
// bypassed." This is a real integration test against the actual dev
// database file (same one every other live-verification script in
// tests/e2e/ uses) — not a mocked assertion that a write "would" be
// rejected. A genuine INSERT is attempted through the read-only connection
// and must fail at the SQLite engine level (query_only pragma / mode=ro
// URL), which is the actual enforcement mechanism, not app-level intent.
vi.mock('electron', () => ({ app: { isPackaged: false } }))

const dbPath = join(process.cwd(), '.dev-data', 'sarang.db')

describe('ai-readonly-db — real write-rejection test', () => {
  afterAll(async () => {
    const { closeReadOnlyPrisma } = await import('../ai-readonly-db')
    await closeReadOnlyPrisma()
  })

  it('rejects a genuine write attempt at the connection level, not just application logic', async () => {
    const { getReadOnlyPrisma } = await import('../ai-readonly-db')
    const db = await getReadOnlyPrisma()

    // A real INSERT through the read-only connection — must throw, not
    // silently no-op and not succeed. If this ever stops throwing, the
    // read-only enforcement has silently broken.
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO Notification (id, notificationType, title, message) VALUES ('ai-readonly-test-row', 'TEST', 'test', 'test')`
      )
    ).rejects.toThrow()
  })

  it('can still genuinely read through the same connection — proves the rejection is write-specific, not a broken connection', async () => {
    const { getReadOnlyPrisma } = await import('../ai-readonly-db')
    const db = await getReadOnlyPrisma()

    const rows = await db.$queryRawUnsafe<unknown[]>('SELECT 1 as ok')
    expect(rows).toBeTruthy()
  })

  it('confirms the leftover test row was never actually created', async () => {
    const { PrismaClient } = await import('@prisma/client')
    const verifyDb = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
    try {
      const row = await verifyDb.notification.findUnique({ where: { id: 'ai-readonly-test-row' } })
      expect(row).toBeNull()
    } finally {
      await verifyDb.$disconnect()
    }
  })
})
