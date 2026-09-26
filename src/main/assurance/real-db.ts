import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Real-database harness for the assurance suites: a fresh SQLite file with every migration applied and the
// default data seeded, so services run against the real schema instead of mocks. Tests must vi.mock('electron')
// before importing this file (see the note in each suite).
export interface RealDb {
  dir: string
  path: string
  close: () => Promise<void>
}

export async function openRealDb(): Promise<RealDb> {
  const dir = mkdtempSync(join(tmpdir(), 'sarang-assure-'))
  const path = join(dir, 'assure.db')
  const { initializeDatabase, getPrisma } = await import('../database/db')
  await initializeDatabase(path)
  const { seedDefaultData } = await import('../database/seed')
  await seedDefaultData()
  const { chartOfAccountsService } = await import('../services/chart-of-accounts.service')
  await chartOfAccountsService.ensureSystemAccountsSeeded()
  return {
    dir,
    path,
    close: async () => {
      try { await getPrisma().$disconnect() } catch { /* already closed */ }
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* Windows may still hold the WAL file */ }
    }
  }
}
