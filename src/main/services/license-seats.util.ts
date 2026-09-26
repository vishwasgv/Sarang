// A SARANG3 key is a SARANG2 key that also carries how many PCs may use the business at once (the shop PC counts as one):
// SARANG3-<TIER>-<REGION>-<issuedDateBase36Days>-<seatsBase36>-<nonce>-<Ed25519 signature>. Keys without a seat count allow one PC.
export interface SeatKey {
  tier: 'TRIAL' | 'PAID'
  region: 'IN' | 'INTL'
  issuedAt: Date
  seats: number
}

export const MAX_SEATS = 99
export const TRIAL_SEATS = 2

export function parseSeatKey(parts: string[], verify: (payload: string, sigHex: string) => boolean): SeatKey | null {
  if (parts.length !== 7 || parts[0] !== 'SARANG3') return null
  const [, tier, region, daysRaw, seatsRaw, nonce, signature] = parts
  if (tier !== 'TRIAL' && tier !== 'PAID') return null
  if (region !== 'IN' && region !== 'INTL') return null
  const days = parseInt(daysRaw, 36)
  const seats = parseInt(seatsRaw, 36)
  if (!Number.isFinite(days) || !Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) return null
  const payload = `${tier}-${region}-${daysRaw.toLowerCase()}-${seatsRaw.toLowerCase()}-${nonce.toLowerCase()}`
  if (!verify(payload, signature.toLowerCase())) return null
  return { tier, region, issuedAt: new Date(days * 86_400_000), seats }
}

// How many PCs the installed licence allows at once. A free trial allows two so the feature can be tried.
export function seatsFor(key: SeatKey | null, tier: 'TRIAL' | 'PAID' | null): number {
  if (key) return key.tier === 'TRIAL' ? Math.max(key.seats, TRIAL_SEATS) : key.seats
  return tier === 'TRIAL' ? TRIAL_SEATS : 1
}
