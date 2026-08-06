/**
 * Builds the payload string for a standard WiFi-join QR code (the
 * `WIFI:T:...;S:...;P:...;;` format natively recognized by iOS Camera and
 * Android's built-in QR scanner — scanning it prompts the phone to join the
 * network directly, no app required). Kept as a pure, unit-testable function
 * (same reasoning as external-link.util.ts) because the one real way this
 * silently breaks is under-escaping a special character in the SSID or
 * password — a `;` or `:` in an unescaped password truncates the field and
 * produces a QR code that joins the wrong (or no) network with no visible
 * error, since the phone's OS does the parsing, not this app.
 */

// Per the WIFI: QR spec, `\`, `;`, `,`, `"`, and `:` are field separators/
// quoting characters and must be backslash-escaped wherever they appear
// inside the SSID or password value itself.
function escapeWifiField(value: string): string {
  return value.replace(/([\\;,":])/g, '\\$1')
}

export type WifiSecurityType = 'WPA' | 'nopass'

export interface WifiQrConfig {
  ssid: string
  password?: string
  security?: WifiSecurityType
  hidden?: boolean
}

/**
 * Returns null when there's no SSID to encode — callers should treat that as
 * "WiFi QR not applicable", not throw.
 */
export function buildWifiQrPayload(config: WifiQrConfig): string | null {
  const ssid = config.ssid.trim()
  if (!ssid) return null

  const security: WifiSecurityType = config.security ?? (config.password ? 'WPA' : 'nopass')
  const password = config.password?.trim() ?? ''

  const parts = [
    `T:${security}`,
    `S:${escapeWifiField(ssid)}`,
    security === 'nopass' ? '' : `P:${escapeWifiField(password)}`,
    config.hidden ? 'H:true' : ''
  ].filter(Boolean)

  return `WIFI:${parts.join(';')};;`
}
