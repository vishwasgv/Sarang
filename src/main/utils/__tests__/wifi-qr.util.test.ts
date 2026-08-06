import { describe, it, expect } from 'vitest'
import { buildWifiQrPayload } from '../wifi-qr.util'

describe('wifi-qr.util — buildWifiQrPayload', () => {
  it('builds a standard WPA payload', () => {
    expect(buildWifiQrPayload({ ssid: 'CafeWiFi', password: 'letmein123' }))
      .toBe('WIFI:T:WPA;S:CafeWiFi;P:letmein123;;')
  })

  it('infers nopass when no password is given', () => {
    expect(buildWifiQrPayload({ ssid: 'GuestOpen' })).toBe('WIFI:T:nopass;S:GuestOpen;;')
  })

  it('honors an explicit security type even when a password is present', () => {
    expect(buildWifiQrPayload({ ssid: 'Open', password: 'ignored', security: 'nopass' }))
      .toBe('WIFI:T:nopass;S:Open;;')
  })

  it('adds H:true only when hidden is set', () => {
    expect(buildWifiQrPayload({ ssid: 'Hidden', password: 'secret', hidden: true }))
      .toBe('WIFI:T:WPA;S:Hidden;P:secret;H:true;;')
    expect(buildWifiQrPayload({ ssid: 'Visible', password: 'secret', hidden: false }))
      .toBe('WIFI:T:WPA;S:Visible;P:secret;;')
  })

  // Real bug class this exists to prevent: an unescaped WIFI:-reserved
  // character in the SSID/password silently truncates the field on the
  // phone's own QR parser -- the app has no way to detect this, it just
  // joins the wrong network with no visible error.
  it('escapes semicolons, colons, commas, backslashes, and quotes in the SSID', () => {
    expect(buildWifiQrPayload({ ssid: 'Cafe;Wifi', password: 'x' })).toBe('WIFI:T:WPA;S:Cafe\\;Wifi;P:x;;')
    expect(buildWifiQrPayload({ ssid: 'Cafe:Wifi', password: 'x' })).toBe('WIFI:T:WPA;S:Cafe\\:Wifi;P:x;;')
    expect(buildWifiQrPayload({ ssid: 'Cafe,Wifi', password: 'x' })).toBe('WIFI:T:WPA;S:Cafe\\,Wifi;P:x;;')
    expect(buildWifiQrPayload({ ssid: 'Cafe\\Wifi', password: 'x' })).toBe('WIFI:T:WPA;S:Cafe\\\\Wifi;P:x;;')
    expect(buildWifiQrPayload({ ssid: 'Cafe"Wifi', password: 'x' })).toBe('WIFI:T:WPA;S:Cafe\\"Wifi;P:x;;')
  })

  it('escapes reserved characters in the password', () => {
    expect(buildWifiQrPayload({ ssid: 'Cafe', password: 'p;a:s,s"w\\ord' }))
      .toBe('WIFI:T:WPA;S:Cafe;P:p\\;a\\:s\\,s\\"w\\\\ord;;')
  })

  it('trims whitespace-only SSID and returns null instead of an empty QR', () => {
    expect(buildWifiQrPayload({ ssid: '' })).toBeNull()
    expect(buildWifiQrPayload({ ssid: '   ' })).toBeNull()
  })

  it('trims surrounding whitespace on real values', () => {
    expect(buildWifiQrPayload({ ssid: '  CafeWiFi  ', password: '  letmein123  ' }))
      .toBe('WIFI:T:WPA;S:CafeWiFi;P:letmein123;;')
  })
})
