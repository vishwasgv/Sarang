import { timingSafeEqual } from 'crypto'

// Real gap found+fixed: the QR-scoped LAN servers (kitchen display, waiter
// view, distributor field-order, token queue) were each comparing an
// attacker-supplied URL path segment against their per-install secret token
// with a plain `===`/`!==`, unlike every equivalent secret check in
// license.service.ts (revocation token, kill-switch token), which already
// uses timingSafeEqual specifically to avoid leaking comparison timing.
// These servers listen on the LAN the QR code is printed for, which is
// exactly the attacker position (same WiFi) a timing side-channel needs.
// timingSafeEqual throws on a length mismatch rather than returning false,
// so the length check must happen first — done here so every call site gets
// the same safe, throw-free behavior for free.
export function secureTokenEquals(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
