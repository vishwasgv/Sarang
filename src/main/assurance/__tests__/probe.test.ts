import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'

let handle: RealDb

describe('real database harness', () => {
  beforeAll(async () => { handle = await openRealDb() }, 120000)
  afterAll(async () => { await handle.close() })

  it('has the chart of accounts seeded', async () => {
    const { getPrisma } = await import('../../database/db')
    const n = await getPrisma().chartOfAccounts.count()
    expect(n).toBeGreaterThan(10)
  })
})
