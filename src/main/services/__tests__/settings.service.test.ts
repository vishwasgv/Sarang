import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { setSetting, getSetting } from '../settings.service'
import { LICENSE_INTERNAL_SETTING_KEYS } from '../license.service'

function makeDb() {
  const store = new Map<string, string>()
  return {
    __store: store,
    setting: {
      findUnique: vi.fn(({ where }: { where: { settingKey: string } }) => {
        const v = store.get(where.settingKey)
        return Promise.resolve(v === undefined ? null : { settingKey: where.settingKey, settingValue: v })
      }),
      upsert: vi.fn(({ where, update }: { where: { settingKey: string }; update: { settingValue: string } }) => {
        store.set(where.settingKey, update.settingValue)
        return Promise.resolve({ settingKey: where.settingKey, settingValue: update.settingValue })
      })
    }
  }
}

let db: ReturnType<typeof makeDb>

beforeEach(() => {
  db = makeDb()
  vi.mocked(getPrisma).mockReturnValue(db as never)
})

// 2026-09-02 hardening — real hole closed: settings:set (the generic
// renderer-facing IPC channel, gated only by settings.modify) used to be
// able to write license_enforcement_suspended and every other
// license-internal Setting row with zero restriction — one DevTools line
// permanently disabled all license enforcement. setSetting() is the single
// choke point every settings:set call funnels through.
describe('setSetting — license-internal key deny-list', () => {
  it('rejects every license-internal key with LIC-003 and does not write the row', async () => {
    for (const key of LICENSE_INTERNAL_SETTING_KEYS) {
      const res = await setSetting(key, 'anything')
      expect(res.success).toBe(false)
      expect((res as { error: { code: string } }).error.code).toBe('LIC-003')
      expect(db.__store.has(key)).toBe(false)
    }
  })

  it('specifically rejects flipping license_enforcement_suspended via this path', async () => {
    const res = await setSetting('license_enforcement_suspended', 'true')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LIC-003')
  })

  it('still allows writing an ordinary, non-license setting', async () => {
    const res = await setSetting('thermal_print_size', '80mm')
    expect(res.success).toBe(true)
    expect(db.__store.get('thermal_print_size')).toBe('80mm')
  })

  it('a rejected write leaves getSetting reading the same value as before (or null if never set)', async () => {
    await setSetting('license_key', 'FORGED-KEY')
    const res = await getSetting('license_key')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })
})
