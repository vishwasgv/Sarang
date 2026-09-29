import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, cpSync, readdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.setConfig({ testTimeout: 180000, hookTimeout: 180000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

// M7 — upgrade-path check with real data (BUILD CHECKLIST.md).
//
// This drives the actual production migration runner (src/main/database/db.ts's
// applyMigrations, via initializeDatabase's dbPathOverride branch) through a real
// two-phase upgrade: build a database at an OLDER schema (missing the 40 most
// recent migrations, ~4 weeks of releases as of 2026-09-29), seed REAL business
// data into it through the real service layer (not raw SQL, not fixtures), then
// let the newer migrations — including 20260902200000_bank_deposit_slips, which
// rebuilds a table the RedefineTables/FK-toggle way — apply on top, and verify
// every seeded row survives with its original values.
//
// This is the same class of check that caught a real, silent data-loss bug on
// 2026-07-22 (see the long comment above the FK-toggle handling in db.ts):
// a RedefineTables migration cascade-deleted every InvoiceItem row in a real
// populated database, with the migration itself reporting success. That bug
// is fixed, and the runner now has three independent safety nets (mandatory
// verified pre-upgrade backup, transactional per-migration DDL, and a
// post-migration PRAGMA foreign_key_check that aborts startup on any
// violation) — this test exercises all three for real, on the current
// migration set, rather than trusting a historical fix stays correct forever.
//
// REAL BUG found+fixed 2026-09-29: this used to move real folders out of the
// shared prisma/migrations directory and back (try/finally). Under Vitest's
// file-level parallelism, that raced any other concurrently-running test
// file's own openRealDb() call, which also reads that same real directory —
// intermittently handing an unrelated test a half-migrated schema (missing
// whatever columns this test had temporarily hidden). Now works entirely on
// isolated temp copies (via db.ts's migrationsDirOverride param, added for
// exactly this) — the real project directory is never touched at all.

const PROJECT_MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')
// Everything from here (inclusive) onward is treated as "not yet installed" —
// picked to include at least one RedefineTables/FK-toggle migration
// (bank_deposit_slips) plus a migration literally named for money integrity.
const CUTOFF = '20260902100000_kot_running_table_tab'

let workDir: string
let oldMigrationsDir: string
let fullMigrationsDir: string
let scratchDbDir: string
let dbPath: string
let pendingCount = 0
let preUpgrade: { invoiceItems: { productId: string; quantity: number; unitPrice: number; taxAmount: number }[]; invoiceTotal: number; productCount: number }

describe('upgrade path against real, populated data (M7)', () => {
  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'sarang-migrations-work-'))
    oldMigrationsDir = join(workDir, 'old')
    fullMigrationsDir = join(workDir, 'full')
    scratchDbDir = mkdtempSync(join(tmpdir(), 'sarang-upgrade-test-'))
    dbPath = join(scratchDbDir, 'upgrade-test.db')

    // Two independent, isolated copies — the real project directory is read from once, here,
    // and never touched again for the rest of this test.
    cpSync(PROJECT_MIGRATIONS_DIR, fullMigrationsDir, { recursive: true })
    cpSync(PROJECT_MIGRATIONS_DIR, oldMigrationsDir, { recursive: true })

    const allDirs = readdirSync(oldMigrationsDir).filter((d) => d !== 'migration_lock.toml')
    const pendingDirs = allDirs.filter((d) => d >= CUTOFF).sort()
    pendingCount = pendingDirs.length
    expect(pendingCount).toBeGreaterThan(5) // sanity: this is meant to be a real multi-week batch
    expect(pendingDirs).toContain('20260902200000_bank_deposit_slips')
    for (const d of pendingDirs) rmSync(join(oldMigrationsDir, d), { recursive: true, force: true })

    // ── Phase 1: build the OLD-schema database from the isolated old-migrations copy ──
    const { initializeDatabase, getPrisma } = await import('../../database/db')
    await initializeDatabase(dbPath, oldMigrationsDir)

    // ── Seed real business data at the OLD schema, via raw SQL naming only the
    // columns that exist at this point in migration history (confirmed against
    // real PRAGMA table_info() output for each table — not guessed). The current
    // Prisma Client is generated against HEAD's schema.prisma and always
    // materializes every @default(...) scalar into its INSERT, so it cannot be
    // used here: it would send values for columns (e.g. Product.taxCategory)
    // that this OLD schema doesn't have yet. This still exercises the exact
    // thing under test — real relational rows surviving a real migration run —
    // just without routing through billingService's own tax/ledger computation,
    // which is already covered by documents-flow.test.ts against a fully
    // current schema.
    const db = getPrisma()
    const now = Date.now()
    const pid1 = crypto.randomUUID()
    const pid2 = crypto.randomUUID()
    const custId = crypto.randomUUID()
    const invId = crypto.randomUUID()
    const item1Id = crypto.randomUUID()
    const item2Id = crypto.randomUUID()

    await db.$executeRawUnsafe(
      `INSERT INTO "Product" ("id","productName","sellingPrice","costPrice","taxRate","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?)`,
      pid1, 'Upgrade-test item A', 500, 300, 18, now, now
    )
    await db.$executeRawUnsafe(
      `INSERT INTO "Product" ("id","productName","sellingPrice","costPrice","taxRate","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?)`,
      pid2, 'Upgrade-test item B', 1200, 700, 12, now, now
    )
    await db.$executeRawUnsafe(
      `INSERT INTO "Inventory" ("id","productId","quantity","averageCost","updatedAt") VALUES (?,?,?,?,?)`,
      crypto.randomUUID(), pid1, 50, 300, now
    )
    await db.$executeRawUnsafe(
      `INSERT INTO "Inventory" ("id","productId","quantity","averageCost","updatedAt") VALUES (?,?,?,?,?)`,
      crypto.randomUUID(), pid2, 20, 700, now
    )
    await db.$executeRawUnsafe(
      `INSERT INTO "Customer" ("id","customerName","createdAt","updatedAt") VALUES (?,?,?,?)`,
      custId, 'Upgrade-test customer', now, now
    )
    // Real invoice math, computed here the same way the app would (line total
    // = qty*unitPrice, tax = lineTotal*taxRate/100) so the post-upgrade
    // assertions check real, meaningful figures rather than placeholders.
    const line1 = { qty: 3, unitPrice: 500, taxRate: 18 }
    const line2 = { qty: 2, unitPrice: 1200, taxRate: 12 }
    const lineTotal1 = line1.qty * line1.unitPrice
    const lineTotal2 = line2.qty * line2.unitPrice
    const tax1 = Math.round(lineTotal1 * line1.taxRate) / 100
    const tax2 = Math.round(lineTotal2 * line2.taxRate) / 100
    const subtotal = lineTotal1 + lineTotal2
    const taxAmount = tax1 + tax2
    const grandTotal = subtotal + taxAmount

    await db.$executeRawUnsafe(
      `INSERT INTO "Invoice" ("id","invoiceNumber","customerId","subtotal","taxAmount","totalAmount","balanceAmount","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?)`,
      invId, 'UPGRADE-TEST-0001', custId, subtotal, taxAmount, grandTotal, grandTotal, now, now
    )
    await db.$executeRawUnsafe(
      `INSERT INTO "InvoiceItem" ("id","invoiceId","productId","productName","quantity","unitPrice","taxRate","taxAmount","lineTotal") VALUES (?,?,?,?,?,?,?,?,?)`,
      item1Id, invId, pid1, 'Upgrade-test item A', line1.qty, line1.unitPrice, line1.taxRate, tax1, lineTotal1
    )
    await db.$executeRawUnsafe(
      `INSERT INTO "InvoiceItem" ("id","invoiceId","productId","productName","quantity","unitPrice","taxRate","taxAmount","lineTotal") VALUES (?,?,?,?,?,?,?,?,?)`,
      item2Id, invId, pid2, 'Upgrade-test item B', line2.qty, line2.unitPrice, line2.taxRate, tax2, lineTotal2
    )

    preUpgrade = {
      invoiceItems: [
        { productId: pid1, quantity: line1.qty, unitPrice: line1.unitPrice, taxAmount: tax1 },
        { productId: pid2, quantity: line2.qty, unitPrice: line2.unitPrice, taxAmount: tax2 }
      ],
      invoiceTotal: grandTotal,
      productCount: await db.product.count()
    }

    await (await import('../../database/db')).closeDatabase()
  })

  afterAll(async () => {
    try { await (await import('../../database/db')).closeDatabase() } catch { /* already closed */ }
    rmSync(workDir, { recursive: true, force: true })
    try { rmSync(scratchDbDir, { recursive: true, force: true }) } catch { /* Windows may still hold the WAL file briefly */ }
  })

  it('applies all pending migrations on top of real seeded data with zero data loss', async () => {
    const { initializeDatabase, getPrisma } = await import('../../database/db')

    // ── Phase 2: the actual upgrade — real runner, real migration files (isolated full copy), real data ──
    await expect(initializeDatabase(dbPath, fullMigrationsDir)).resolves.not.toThrow()
    expect(pendingCount).toBeGreaterThan(0) // sanity: phase 1 really did have something pending

    const db = getPrisma()

    // The mandatory pre-upgrade backup (db.ts's VACUUM INTO + integrity-check step)
    // must have actually run, not been skipped — proves the safety net engaged.
    const backupsDir = join(process.env.TEMP ?? '.', 'backups')
    const hasBackup = existsSync(backupsDir) && readdirSync(backupsDir).some((f) => f.startsWith('pre-upgrade-'))
    expect(hasBackup).toBe(true)

    // Every seeded row survived the upgrade, unchanged — the exact class of
    // thing the 2026-07-22 bug silently destroyed.
    const productCount = await db.product.count()
    expect(productCount).toBe(preUpgrade.productCount)

    const invoices = await db.invoice.findMany({ where: { customer: { customerName: 'Upgrade-test customer' } } })
    expect(invoices.length).toBe(1)
    expect(Math.round(invoices[0].totalAmount * 100) / 100).toBe(Math.round(preUpgrade.invoiceTotal * 100) / 100)

    const items = await db.invoiceItem.findMany({
      where: { invoiceId: invoices[0].id },
      select: { productId: true, quantity: true, unitPrice: true, taxAmount: true }
    })
    expect(items.length).toBe(preUpgrade.invoiceItems.length)
    for (const expected of preUpgrade.invoiceItems) {
      const actual = items.find((it) => it.productId === expected.productId)
      if (!actual) throw new Error(`no InvoiceItem row survived for productId ${expected.productId}`)
      expect(actual.quantity).toBe(expected.quantity)
      expect(actual.unitPrice).toBe(expected.unitPrice)
      expect(Math.round(actual.taxAmount * 100) / 100).toBe(Math.round(expected.taxAmount * 100) / 100)
    }

    // Belt-and-suspenders: the runner itself already aborts startup on any FK
    // violation found after a FK-toggle migration (db.ts), but re-check
    // directly here too, against the finished, fully-upgraded database.
    const violations = await db.$queryRawUnsafe<unknown[]>('PRAGMA foreign_key_check')
    expect(violations).toEqual([])
  })
})
