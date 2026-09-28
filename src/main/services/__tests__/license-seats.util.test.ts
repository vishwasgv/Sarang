import { describe, it, expect } from 'vitest'
import { generateKeyPairSync, sign, verify } from 'crypto'
import { parseSeatKey, seatsFor, MAX_SEATS, TRIAL_SEATS } from '../license-seats.util'

// Same construction the website's generateSarangLicenseKeyV3 uses.
function makeKey(tier: string, region: string, issuedAt: Date, seats: number, privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'], nonce = 'a1b2c3d4e5f6'): string {
  const days = Math.floor(issuedAt.getTime() / 86_400_000)
  const payload = `${tier}-${region}-${days.toString(36)}-${seats.toString(36)}-${nonce}`
  return `SARANG3-${payload}-${sign(null, Buffer.from(payload), privateKey).toString('hex')}`
}

describe('SARANG3 keys carry a seat count', () => {
  const pair = generateKeyPairSync('ed25519')
  const other = generateKeyPairSync('ed25519')
  const check = (publicKey: typeof pair.publicKey) => (payload: string, sigHex: string) => verify(null, Buffer.from(payload), publicKey, Buffer.from(sigHex, 'hex'))
  const parts = (k: string) => k.toUpperCase().split('-')

  it('reads back tier, region, date and seats from a genuinely signed key', () => {
    const at = new Date('2026-09-26T00:00:00Z')
    const parsed = parseSeatKey(parts(makeKey('PAID', 'IN', at, 5, pair.privateKey)), check(pair.publicKey))
    expect(parsed).toMatchObject({ tier: 'PAID', region: 'IN', seats: 5 })
    expect(parsed!.issuedAt.toISOString().slice(0, 10)).toBe('2026-09-26')
  })

  it('rejects a key signed by someone else, a changed seat count and out-of-range seats', () => {
    const at = new Date('2026-09-26T00:00:00Z')
    expect(parseSeatKey(parts(makeKey('PAID', 'IN', at, 5, other.privateKey)), check(pair.publicKey))).toBeNull()
    const good = parts(makeKey('PAID', 'IN', at, 2, pair.privateKey))
    good[4] = (9).toString(36).toUpperCase()
    expect(parseSeatKey(good, check(pair.publicKey))).toBeNull()
    expect(parseSeatKey(parts(makeKey('PAID', 'IN', at, MAX_SEATS + 1, pair.privateKey)), check(pair.publicKey))).toBeNull()
    expect(parseSeatKey(parts(makeKey('PAID', 'IN', at, 0, pair.privateKey)), check(pair.publicKey))).toBeNull()
  })

  it('counts seats: the key wins, a trial allows two, no key allows one', () => {
    const at = new Date('2026-09-26T00:00:00Z')
    const paid = parseSeatKey(parts(makeKey('PAID', 'INTL', at, 3, pair.privateKey)), check(pair.publicKey))
    const trial = parseSeatKey(parts(makeKey('TRIAL', 'IN', at, 1, pair.privateKey)), check(pair.publicKey))
    expect(seatsFor(paid, 'PAID')).toBe(3)
    expect(seatsFor(trial, 'TRIAL')).toBe(TRIAL_SEATS)
    expect(seatsFor(null, 'PAID')).toBe(1)
    expect(seatsFor(null, null)).toBe(1)
  })
})
