import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

vi.mock('os', () => ({
  hostname: vi.fn(() => 'TEST-PC'),
  platform: vi.fn(() => 'win32'),
  networkInterfaces: vi.fn(() => ({
    eth0: [{ internal: false, mac: 'aa:bb:cc:dd:ee:ff', family: 'IPv4', address: '10.0.0.5' }]
  }))
}))

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
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops))
  }
}

let db: ReturnType<typeof makeDb>

beforeEach(async () => {
  vi.resetModules()
  db = makeDb()
  const { getPrisma } = await import('../../database/db')
  ;(getPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db)
})

afterEach(() => {
  vi.useRealTimers()
})

async function importFresh() {
  return await import('../license.service')
}

describe('license key signing and verification', () => {
  it('round-trips a freshly generated key', async () => {
    const { generateLicenseKey, parseAndVerifyLicenseKey } = await importFresh()
    const issuedAt = new Date('2026-01-15T00:00:00Z')
    const key = generateLicenseKey('TRIAL', 'IN', issuedAt)
    const parsed = parseAndVerifyLicenseKey(key)
    expect(parsed).not.toBeNull()
    expect(parsed?.tier).toBe('TRIAL')
    expect(parsed?.region).toBe('IN')
    expect(parsed?.issuedAt.toISOString().slice(0, 10)).toBe('2026-01-15')
  })

  it('rejects a key with a tampered signature', async () => {
    const { generateLicenseKey, parseAndVerifyLicenseKey } = await importFresh()
    const key = generateLicenseKey('PAID', 'INTL', new Date())
    const tampered = key.slice(0, -2) + 'zz'
    expect(parseAndVerifyLicenseKey(tampered)).toBeNull()
  })

  it('rejects a key with a tampered tier (e.g. TRIAL upgraded to PAID by hand-editing the string)', async () => {
    const { generateLicenseKey, parseAndVerifyLicenseKey } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date())
    const forged = key.replace('TRIAL', 'PAID')
    expect(parseAndVerifyLicenseKey(forged)).toBeNull()
  })

  it('rejects garbage input without throwing', async () => {
    const { parseAndVerifyLicenseKey } = await importFresh()
    expect(parseAndVerifyLicenseKey('not-a-key')).toBeNull()
    expect(parseAndVerifyLicenseKey('')).toBeNull()
    expect(parseAndVerifyLicenseKey('SARANG-TRIAL-IN-abc')).toBeNull()
  })
})

describe('getLicenseState — offline, tamper-resistant, threshold-correct', () => {
  it('reports NOT_ACTIVATED when no key has ever been entered', async () => {
    const { getLicenseState } = await importFresh()
    const state = await getLicenseState()
    expect(state.status).toBe('NOT_ACTIVATED')
  })

  it('re-derives issuedAt from the signed key, ignoring a hand-edited local Setting row (tamper resistance)', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const issuedAt = new Date()
    const key = generateLicenseKey('TRIAL', 'IN', issuedAt)
    await activateLicenseKey(key)

    // Simulate someone hand-editing the local SQLite row to look freshly issued —
    // the stored license_issued_at is now a lie; only the signed key is trustworthy.
    db.__store.set('license_issued_at', new Date().toISOString())
    // But leave the actual key alone — it was really issued long ago:
    const oldKey = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 400 * 86_400_000))
    db.__store.set('license_key', oldKey)

    const state = await getLicenseState()
    expect(state.status).toBe('EXPIRED')
    expect(state.daysSinceIssue).toBeGreaterThanOrEqual(400)
  })

  it('is ACTIVE with no banner before day 335', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 100 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
  })

  it('is WARNING between day 335 and day 364', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 340 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('WARNING')
    expect(state.daysRemaining).toBeGreaterThan(0)
  })

  it('is EXPIRED at exactly day 365', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 365 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('EXPIRED')
  })

  it('a PAID key is ACTIVE while still within its paid year', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date(Date.now() - 10 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
    expect(state.tier).toBe('PAID')
  })

  it('a PAID key EXPIRES once its own paid year is over — real annual renewal, fixed 2026-07-28 (a PAID key used to be exempt from expiry entirely, silently granting a lifetime license after the first payment despite every pricing surface saying "/year")', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date(Date.now() - 900 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('EXPIRED')
    expect(state.tier).toBe('PAID')
  })

  it('a PAID key shows WARNING in the 335-364 day window of its own paid year, same as TRIAL', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date(Date.now() - 340 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('WARNING')
    expect(state.tier).toBe('PAID')
  })

  it('makes zero network calls of any kind (fully offline)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date())
    await activateLicenseKey(key)
    await getLicenseState()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('pingLicenseStatusIfDue and the remote kill switch', () => {
  it('fires the ping when genuinely due (no prior ping recorded) and never blocks the caller even if it fails', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKey, pingLicenseStatusIfDue } = await importFresh()
    db.__store.set('license_key', generateLicenseKey('TRIAL', 'IN', new Date()))
    // No license_last_verified_at row — never pinged before, so it's due.
    await expect(pingLicenseStatusIfDue()).resolves.toBeUndefined() // never throws, even on fetch failure
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('skips the ping when one already ran recently (throttled to ~once/day)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKey, pingLicenseStatusIfDue } = await importFresh()
    db.__store.set('license_key', generateLicenseKey('TRIAL', 'IN', new Date()))
    db.__store.set('license_last_verified_at', new Date().toISOString())
    await pingLicenseStatusIfDue()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('the kill switch only ever relaxes enforcement, never tightens it — an EXPIRED trial becomes ACTIVE when suspended', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 400 * 86_400_000))
    await activateLicenseKey(key)
    expect((await getLicenseState()).status).toBe('EXPIRED')

    db.__store.set('license_enforcement_suspended', 'true')
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
    expect(state.daysRemaining).not.toBeNull() // still reports the real numbers, just doesn't act on them
  })
})

describe('activateLicenseKey — device replacement must be a non-event, not a support ticket', () => {
  it('activates cleanly on a fresh install with no prior key', async () => {
    const { generateLicenseKey, activateLicenseKey } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date())
    const res = await activateLicenseKey(key)
    expect(res.success).toBe(true)
  })

  it('rejects activation outright for a malformed key, with a clear error code', async () => {
    const { activateLicenseKey } = await importFresh()
    const res = await activateLicenseKey('garbage-key')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('LIC-001')
  })

  it('re-activating the SAME key on a NEW machine fingerprint succeeds immediately, no error, no lockout', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState, computeMachineFingerprint } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date())

    // First activation, "old laptop":
    const first = await activateLicenseKey(key)
    expect(first.success).toBe(true)
    const firstFingerprint = db.__store.get('license_machine_fingerprint')

    // Simulate a genuinely different machine (new laptop) by changing what
    // computeMachineFingerprint would resolve to — swap the mocked os module's
    // network interface to a different MAC, matching a real hardware swap.
    const osMod = await import('os')
    ;(osMod.networkInterfaces as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      eth0: [{ internal: false, mac: '11:22:33:44:55:66', family: 'IPv4', address: '10.0.0.9' }]
    })

    const second = await activateLicenseKey(key)
    expect(second.success).toBe(true) // <- the actual guarantee: no rejection, no special-case error

    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
    expect(state.machineMismatch).toBe(false) // freshly re-bound, so it now matches the current machine

    const secondFingerprint = db.__store.get('license_machine_fingerprint')
    expect(secondFingerprint).not.toBe(firstFingerprint) // fingerprint really did move to the new machine
    void computeMachineFingerprint
  })
})
