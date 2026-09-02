#!/usr/bin/env node
/**
 * Pre-package guard (Phase 59 follow-up, 2026-07-28): fails the build loudly
 * if SARANG_LICENSE_HMAC_SECRET is unset or still the known dev placeholder.
 *
 * Without this, `npm run dist`/`dist:win`/`pack` would succeed silently and
 * ship the installer with the literal string 'DEV-ONLY-INSECURE-PLACEHOLDER-
 * DO-NOT-SHIP' baked into the binary via electron.vite.config.ts's `define`
 * — a value visible in this repo's own source, letting anyone who finds it
 * mint unlimited valid PAID license keys for free. The website side
 * (D:\Aszurex website\server.js) already logs a warning for the equivalent
 * case; this is the missing equivalent guard on the packaged-app side, and
 * a hard failure rather than a warning specifically because a missed
 * warning here means a real, exploitable, shipped installer.
 */
const PLACEHOLDER = 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP'
const secret = process.env.SARANG_LICENSE_HMAC_SECRET

if (!secret || secret === PLACEHOLDER) {
  console.error('\n❌ SARANG_LICENSE_HMAC_SECRET is not set (or is still the dev placeholder).')
  console.error('   Packaging would ship an installer anyone could use to forge free PAID license keys.')
  console.error('   Set a real secret before packaging, e.g.:')
  console.error('     PowerShell: $env:SARANG_LICENSE_HMAC_SECRET = "<64-char hex value>"')
  console.error('   It must match the SARANG_LICENSE_HMAC_SECRET set on the website (Render) exactly.\n')
  process.exit(1)
}

console.log('✅ SARANG_LICENSE_HMAC_SECRET is set and is not the dev placeholder.')

// 2026-09-02 — Ed25519 public key. Safe to be public, but shipping the dev
// placeholder would mean the app can't verify any real SARANG2 key ever
// issued (fails safe, but still worth catching here rather than in a
// support ticket).
if (!process.env.SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM) {
  console.error('\n❌ SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM is not set.')
  console.error('   Packaging would ship an app that cannot verify SARANG2 license keys.\n')
  process.exit(1)
}
console.log('✅ SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM is set.')
