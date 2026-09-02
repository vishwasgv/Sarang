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
  vi.unstubAllEnvs()
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

  // Real bug found+fixed 2026-07-29: the payload used to be built from only
  // tier+region+issuedDay (no per-request entropy), so HMAC-SHA256's
  // determinism meant two different people issued a key for the same
  // tier+region on the same calendar day got the byte-for-byte identical
  // key. Not a hypothetical -- this is the realistic case as soon as more
  // than one person signs up from the same region on the same day.
  it('never issues the same key twice for the same tier+region+day (the actual bug)', async () => {
    const { generateLicenseKey, parseAndVerifyLicenseKey } = await importFresh()
    const sameDay = new Date('2026-03-01T09:00:00Z')
    const keys = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const key = generateLicenseKey('TRIAL', 'IN', sameDay)
      expect(parseAndVerifyLicenseKey(key)).not.toBeNull() // still a valid, verifiable key
      keys.add(key)
    }
    expect(keys.size).toBe(200) // zero collisions across 200 same-day/tier/region issuances
  })

  it('the added nonce does not change the derived issuedAt day, tier, or region', async () => {
    const { generateLicenseKey, parseAndVerifyLicenseKey } = await importFresh()
    const issuedAt = new Date('2026-03-01T09:00:00Z')
    const keyA = generateLicenseKey('TRIAL', 'IN', issuedAt)
    const keyB = generateLicenseKey('TRIAL', 'IN', issuedAt)
    const parsedA = parseAndVerifyLicenseKey(keyA)
    const parsedB = parseAndVerifyLicenseKey(keyB)
    expect(keyA).not.toBe(keyB)
    expect(parsedA?.issuedAt.toISOString().slice(0, 10)).toBe('2026-03-01')
    expect(parsedB?.issuedAt.toISOString().slice(0, 10)).toBe('2026-03-01')
    expect(parsedA?.tier).toBe(parsedB?.tier)
    expect(parsedA?.region).toBe(parsedB?.region)
  })

  // Every key issued and emailed to a real customer before this fix used the
  // old 5-part (no-nonce) format and must keep working forever -- this is
  // not a format this codebase controls the lifetime of once it's in a real
  // inbox.
  it('still validates a pre-2026-07-29 key with the old 5-part (no-nonce) format', async () => {
    // REAL BUG found+fixed here 2026-07-30: this test used to hard-code the
    // dev placeholder secret, silently assuming SARANG_LICENSE_HMAC_SECRET is
    // unset in every environment this suite runs in. On a machine that has
    // the real production secret exported (exactly what a real release build
    // requires — see scripts/check-license-secret.js), the module under test
    // signs with that real secret while this test still signed with the
    // placeholder, so the signatures never matched and the test failed for a
    // reason that had nothing to do with the backward-compat logic actually
    // being broken. vi.stubEnv pins the secret this test signs with to
    // exactly what the freshly-imported module will read, regardless of the
    // host machine's ambient environment.
    vi.stubEnv('SARANG_LICENSE_HMAC_SECRET', 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP')
    const { parseAndVerifyLicenseKey } = await importFresh()
    // Hand-built exactly as the OLD buildSignedPayload() did: TIER-REGION-DAYS.
    const { createHmac } = await import('crypto')
    const days = Math.floor(new Date('2026-01-15T00:00:00Z').getTime() / 86_400_000)
    const payload = `TRIAL-IN-${days.toString(36)}`
    const sig = createHmac('sha256', 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP').update(payload).digest('hex').slice(0, 12)
    const oldFormatKey = `SARANG-${payload}-${sig}`

    const parsed = parseAndVerifyLicenseKey(oldFormatKey)
    expect(parsed).not.toBeNull()
    expect(parsed?.tier).toBe('TRIAL')
    expect(parsed?.region).toBe('IN')
    expect(parsed?.issuedAt.toISOString().slice(0, 10)).toBe('2026-01-15')
  })

  it('rejects an old-format key with a tampered signature exactly like the new format does', async () => {
    // Same env-isolation fix as the test above — see its comment.
    vi.stubEnv('SARANG_LICENSE_HMAC_SECRET', 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP')
    const { parseAndVerifyLicenseKey } = await importFresh()
    const { createHmac } = await import('crypto')
    const days = Math.floor(Date.now() / 86_400_000)
    const payload = `TRIAL-IN-${days.toString(36)}`
    const sig = createHmac('sha256', 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP').update(payload).digest('hex').slice(0, 12)
    const tampered = `SARANG-${payload}-${sig.slice(0, -2)}zz`
    expect(parseAndVerifyLicenseKey(tampered)).toBeNull()
  })
})

describe('SARANG2 (Ed25519) key signing and verification', () => {
  // Ephemeral test keypair — never the real production private key.
  const { generateKeyPairSync } = require('crypto') as typeof import('crypto')
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const TEST_PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const TEST_PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

  it('round-trips a freshly generated SARANG2 key', async () => {
    vi.stubEnv('SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM', TEST_PUBLIC_PEM)
    const { generateLicenseKeyV2, parseAndVerifyLicenseKey } = await importFresh()
    const issuedAt = new Date('2026-01-15T00:00:00Z')
    const key = generateLicenseKeyV2('TRIAL', 'IN', issuedAt, TEST_PRIVATE_PEM)
    expect(key.startsWith('SARANG2-')).toBe(true)
    const parsed = parseAndVerifyLicenseKey(key)
    expect(parsed).not.toBeNull()
    expect(parsed?.tier).toBe('TRIAL')
    expect(parsed?.region).toBe('IN')
    expect(parsed?.issuedAt.toISOString().slice(0, 10)).toBe('2026-01-15')
  })

  it('rejects a SARANG2 key with a tampered signature', async () => {
    vi.stubEnv('SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM', TEST_PUBLIC_PEM)
    const { generateLicenseKeyV2, parseAndVerifyLicenseKey } = await importFresh()
    const key = generateLicenseKeyV2('PAID', 'INTL', new Date(), TEST_PRIVATE_PEM)
    const tampered = key.slice(0, -2) + (key.slice(-2) === 'aa' ? 'bb' : 'aa')
    expect(parseAndVerifyLicenseKey(tampered)).toBeNull()
  })

  it('rejects a SARANG2 key with a tampered tier', async () => {
    vi.stubEnv('SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM', TEST_PUBLIC_PEM)
    const { generateLicenseKeyV2, parseAndVerifyLicenseKey } = await importFresh()
    const key = generateLicenseKeyV2('TRIAL', 'IN', new Date(), TEST_PRIVATE_PEM)
    const forged = key.replace('TRIAL', 'PAID')
    expect(parseAndVerifyLicenseKey(forged)).toBeNull()
  })

  it('a SARANG2 key signed with a DIFFERENT keypair fails verification (proves the public key is actually checked, not just the shape)', async () => {
    vi.stubEnv('SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM', TEST_PUBLIC_PEM)
    const { generateLicenseKeyV2, parseAndVerifyLicenseKey } = await importFresh()
    const otherPair = generateKeyPairSync('ed25519')
    const otherPrivatePem = otherPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const key = generateLicenseKeyV2('TRIAL', 'IN', new Date(), otherPrivatePem)
    expect(parseAndVerifyLicenseKey(key)).toBeNull()
  })

  it('legacy 5-part, current 6-part HMAC, and SARANG2 keys all validate side by side', async () => {
    vi.stubEnv('SARANG_LICENSE_HMAC_SECRET', 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP')
    vi.stubEnv('SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM', TEST_PUBLIC_PEM)
    const { generateLicenseKey, generateLicenseKeyV2, parseAndVerifyLicenseKey } = await importFresh()
    const { createHmac } = await import('crypto')
    const days = Math.floor(new Date('2026-01-15T00:00:00Z').getTime() / 86_400_000)
    const legacyPayload = `TRIAL-IN-${days.toString(36)}`
    const legacySig = createHmac('sha256', 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP').update(legacyPayload).digest('hex').slice(0, 12)
    const legacyKey = `SARANG-${legacyPayload}-${legacySig}`
    const currentKey = generateLicenseKey('TRIAL', 'IN', new Date('2026-01-15T00:00:00Z'))
    const v2Key = generateLicenseKeyV2('TRIAL', 'IN', new Date('2026-01-15T00:00:00Z'), TEST_PRIVATE_PEM)

    expect(parseAndVerifyLicenseKey(legacyKey)).not.toBeNull()
    expect(parseAndVerifyLicenseKey(currentKey)).not.toBeNull()
    expect(parseAndVerifyLicenseKey(v2Key)).not.toBeNull()
  })

  it('activating and checking state with a SARANG2 key makes zero network calls', async () => {
    vi.stubEnv('SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM', TEST_PUBLIC_PEM)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKeyV2, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKeyV2('TRIAL', 'IN', new Date(), TEST_PRIVATE_PEM)
    await activateLicenseKey(key)
    await getLicenseState()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
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

  it('is ACTIVE with no banner before day 70 of its 100-day trial', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 50 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
  })

  it('is WARNING between day 70 and day 99 of its 100-day trial', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 75 * 86_400_000))
    await activateLicenseKey(key)
    const state = await getLicenseState()
    expect(state.status).toBe('WARNING')
    expect(state.daysRemaining).toBeGreaterThan(0)
  })

  it('is EXPIRED at exactly day 100 of its trial', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 100 * 86_400_000))
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

  it('a PAID key shows WARNING in the 335-364 day window of its own paid year (same 30-day warning window length as TRIAL, though PAID keeps a 365-day cycle vs. TRIAL\'s 100)', async () => {
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

  it('persists a revocationToken from the ping response, but only once verified against this device\'s own key', async () => {
    // Fetch is stubbed BEFORE any call that could trigger getLicenseState()'s
    // own internal fire-and-forget ping (real, un-mocked fetch in a test
    // env is a flaky/unwanted network call this test must never risk).
    const { generateLicenseKey, activateLicenseKey, getLicenseState, hashLicenseKeyForPing, signRevocationToken, pingLicenseStatusIfDue } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date())
    const revocationToken = signRevocationToken(hashLicenseKeyForPing(key))
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revocationToken }) })
    vi.stubGlobal('fetch', fetchSpy)

    await activateLicenseKey(key)
    // activateLicenseKey itself stamps license_last_verified_at (so a freshly
    // activated device isn't immediately re-pinged) — clear it so this test's
    // explicit ping below is treated as genuinely due, same as any real
    // install's first daily ping the next day.
    db.__store.delete('license_last_verified_at')
    await pingLicenseStatusIfDue()

    const state = await getLicenseState()
    expect(state.status).toBe('EXPIRED')
    vi.unstubAllGlobals()
  })

  it('the kill switch only ever relaxes enforcement, never tightens it — an EXPIRED trial becomes ACTIVE when suspended by a validly signed token', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState, signKillSwitchToken } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 400 * 86_400_000))
    await activateLicenseKey(key)
    expect((await getLicenseState()).status).toBe('EXPIRED')

    db.__store.set('license_enforcement_suspended', signKillSwitchToken(true))
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
    expect(state.daysRemaining).not.toBeNull() // still reports the real numbers, just doesn't act on them
  })

  // 2026-09-02 hardening — real hole closed: this exact bare string used to
  // flip enforcement off with zero cryptographic check, reachable via a raw
  // SQLite edit or (worse) the generic settings:set IPC channel from
  // DevTools. It must now be cryptographically inert.
  it('a bare unsigned "true" string (the old hole) no longer suspends enforcement', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 400 * 86_400_000))
    await activateLicenseKey(key)

    db.__store.set('license_enforcement_suspended', 'true')
    const state = await getLicenseState()
    expect(state.status).toBe('EXPIRED')
  })

  it('a tampered kill-switch token (flipped suspended flag, stale signature) is rejected', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState, signKillSwitchToken } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date(Date.now() - 400 * 86_400_000))
    await activateLicenseKey(key)

    const token = signKillSwitchToken(true)
    const tampered = token.replace('-1-', '-0-') // flip the suspended flag, signature now stale
    db.__store.set('license_enforcement_suspended', tampered)
    const state = await getLicenseState()
    expect(state.status).toBe('EXPIRED')
  })
})

describe('kill-switch token signing and verification', () => {
  it('round-trips a signed suspend token', async () => {
    const { signKillSwitchToken, parseAndVerifyKillSwitchToken } = await importFresh()
    const token = signKillSwitchToken(true)
    expect(parseAndVerifyKillSwitchToken(token)).toEqual({ suspended: true })
  })

  it('round-trips a signed not-suspended token', async () => {
    const { signKillSwitchToken, parseAndVerifyKillSwitchToken } = await importFresh()
    const token = signKillSwitchToken(false)
    expect(parseAndVerifyKillSwitchToken(token)).toEqual({ suspended: false })
  })

  it('rejects null/undefined/empty', async () => {
    const { parseAndVerifyKillSwitchToken } = await importFresh()
    expect(parseAndVerifyKillSwitchToken(null)).toBeNull()
    expect(parseAndVerifyKillSwitchToken(undefined)).toBeNull()
    expect(parseAndVerifyKillSwitchToken('')).toBeNull()
  })

  it('rejects a tampered signature', async () => {
    const { signKillSwitchToken, parseAndVerifyKillSwitchToken } = await importFresh()
    const token = signKillSwitchToken(true)
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A')
    expect(parseAndVerifyKillSwitchToken(tampered)).toBeNull()
  })

  it('rejects a plain license key passed by mistake (wrong shape)', async () => {
    const { generateLicenseKey, parseAndVerifyKillSwitchToken } = await importFresh()
    const key = generateLicenseKey('TRIAL', 'IN', new Date())
    expect(parseAndVerifyKillSwitchToken(key)).toBeNull()
  })
})

describe('per-key revocation — the same-key-on-many-devices countermeasure', () => {
  it('a validly-signed revocation token for this exact key forces EXPIRED even with most of the cycle left', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState, signRevocationToken, hashLicenseKeyForPing } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date()) // issued today — 365 days remaining
    await activateLicenseKey(key)
    expect((await getLicenseState()).status).toBe('ACTIVE')

    db.__store.set('license_revocation_token', signRevocationToken(hashLicenseKeyForPing(key)))
    const state = await getLicenseState()
    expect(state.status).toBe('EXPIRED')
    expect(state.daysRemaining).not.toBeNull() // still reports the real numbers, just doesn't act on them — same as kill-switch
  })

  it('a revocation token signed for a DIFFERENT key does not revoke this one', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState, signRevocationToken, hashLicenseKeyForPing } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date())
    await activateLicenseKey(key)

    const someOtherKeyHash = hashLicenseKeyForPing(generateLicenseKey('PAID', 'IN', new Date()))
    db.__store.set('license_revocation_token', signRevocationToken(someOtherKeyHash))
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
  })

  it('a tampered revocation token (key hash swapped, stale signature) is rejected', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState, signRevocationToken, hashLicenseKeyForPing } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date())
    await activateLicenseKey(key)

    const token = signRevocationToken(hashLicenseKeyForPing(key))
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A')
    db.__store.set('license_revocation_token', tampered)
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
  })

  it('a bare unsigned revocation flag (hand-edited Setting row) is ignored', async () => {
    const { generateLicenseKey, activateLicenseKey, getLicenseState } = await importFresh()
    const key = generateLicenseKey('PAID', 'IN', new Date())
    await activateLicenseKey(key)

    db.__store.set('license_revocation_token', 'true')
    const state = await getLicenseState()
    expect(state.status).toBe('ACTIVE')
  })
})

describe('revocation token signing and verification', () => {
  it('round-trips a signed token for the key it names', async () => {
    const { signRevocationToken, parseAndVerifyRevocationToken } = await importFresh()
    const token = signRevocationToken('abc123')
    expect(parseAndVerifyRevocationToken(token, 'abc123')).toBe(true)
  })

  it('rejects that same valid token against a different key hash', async () => {
    const { signRevocationToken, parseAndVerifyRevocationToken } = await importFresh()
    const token = signRevocationToken('abc123')
    expect(parseAndVerifyRevocationToken(token, 'def456')).toBe(false)
  })

  it('rejects null/undefined/empty', async () => {
    const { parseAndVerifyRevocationToken } = await importFresh()
    expect(parseAndVerifyRevocationToken(null, 'abc123')).toBe(false)
    expect(parseAndVerifyRevocationToken(undefined, 'abc123')).toBe(false)
    expect(parseAndVerifyRevocationToken('', 'abc123')).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const { signRevocationToken, parseAndVerifyRevocationToken } = await importFresh()
    const token = signRevocationToken('abc123')
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A')
    expect(parseAndVerifyRevocationToken(tampered, 'abc123')).toBe(false)
  })

  it('rejects a kill-switch token passed by mistake (wrong shape)', async () => {
    const { signKillSwitchToken, parseAndVerifyRevocationToken } = await importFresh()
    const token = signKillSwitchToken(true)
    expect(parseAndVerifyRevocationToken(token, 'abc123')).toBe(false)
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
