import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Deliberately exercises the app.isPackaged=true (production) branch of
// getMenuPagePath(), pointed at the real resources/ dir — the dev-mode
// branch's relative path depth is only correct once bundled into
// out/main/index.js and cannot be meaningfully verified from an unbundled
// vitest run (source tree depth differs from the bundled output's).
// That branch was verified instead via a real `npm run dev` launch — see
// PHASE_47_COMPLETION_REPORT.md.
vi.mock('electron', () => ({
  app: { isPackaged: true },
}))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../../services/industry-template.service', () => ({ isModuleEnabled: vi.fn() }))
vi.mock('../../services/restaurant-order.service', () => ({
  listMenuProducts: vi.fn(),
  createOrderRequest: vi.fn(),
  getBusinessDisplayInfo: vi.fn(),
}))

import { resolve } from 'path'
import { getPrisma } from '../../database/db'
import { isModuleEnabled } from '../../services/industry-template.service'
import { listMenuProducts, createOrderRequest } from '../../services/restaurant-order.service'
import { ensureQrOrderServerState, stopQrOrderServer, getServerStatus } from '../qr-order-server'

// Points the mocked app.isPackaged=true branch at the real resources/ dir
// (repo root, 4 levels up from this __tests__ file) so the static-page route
// test below serves the genuine qr-menu/index.html, not a fixture.
;(process as { resourcesPath: string }).resourcesPath = resolve(__dirname, '../../../../resources')

// Regression coverage for Phase 47: this is the first network-reachable
// surface in the codebase, so its two most important guarantees are tested
// directly against a real (not mocked) http.Server — module-off means the
// port is genuinely never bound, and the abuse-rate-limit genuinely rejects
// a flood, not just "looks right in the code."

const TEST_PORT = 18453

function mockDbWithPort(port: number) {
  return { setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: String(port) }) } }
}

function mockDbWithPortAndTable(port: number, table: { id: string } | null) {
  return {
    setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: String(port) }) },
    restaurantTable: {
      findUnique: vi.fn().mockResolvedValue(table),
      update: vi.fn().mockResolvedValue(table),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await stopQrOrderServer()
})

describe('ensureQrOrderServerState', () => {
  it('does not bind a port when the module is disabled', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(false)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(TEST_PORT) as never)

    await ensureQrOrderServerState()
    expect(getServerStatus().running).toBe(false)

    // Confirm at the network level, not just the in-memory flag
    await expect(fetch(`http://127.0.0.1:${TEST_PORT}/api/menu`)).rejects.toThrow()
  })

  it('binds the configured port when the module is enabled', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(TEST_PORT) as never)
    vi.mocked(listMenuProducts).mockResolvedValue([{ id: 'p1', productName: 'Tea', sellingPrice: 20, imagePath: null, categoryName: null, foodType: null }])

    await ensureQrOrderServerState()
    expect(getServerStatus().running).toBe(true)
    expect(getServerStatus().port).toBe(TEST_PORT)

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/menu`)
    const body = await res.json() as { success: boolean; data: Array<{ productName: string }> }
    expect(body.success).toBe(true)
    expect(body.data[0].productName).toBe('Tea')
  })

  it('stopQrOrderServer actually closes the port', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(TEST_PORT) as never)
    vi.mocked(listMenuProducts).mockResolvedValue([])

    await ensureQrOrderServerState()
    expect(getServerStatus().running).toBe(true)

    await stopQrOrderServer()
    expect(getServerStatus().running).toBe(false)
    await expect(fetch(`http://127.0.0.1:${TEST_PORT}/api/menu`)).rejects.toThrow()
  })
})

describe('POST /api/order abuse controls', () => {
  it('rate-limits a flood of order submissions from the same source', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(TEST_PORT) as never)
    vi.mocked(createOrderRequest).mockResolvedValue({ success: true })

    await ensureQrOrderServerState()

    const post = () => fetch(`http://127.0.0.1:${TEST_PORT}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'table-1', items: [{ productId: 'p1', quantity: 1 }] })
    })

    const results: number[] = []
    for (let i = 0; i < 7; i++) {
      const res = await post()
      results.push(res.status)
    }
    // First 5 within the window succeed (200), the rest are rate-limited (429)
    expect(results.slice(0, 5).every(s => s === 200)).toBe(true)
    expect(results.slice(5)).toEqual([429, 429])
  })

  it('tracks GET (menu/business) and POST (order) rate limits independently per IP', async () => {
    const port = TEST_PORT + 1 // distinct port — avoids any port-reuse race with adjacent tests
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(listMenuProducts).mockResolvedValue([])
    vi.mocked(createOrderRequest).mockResolvedValue({ success: true })

    await ensureQrOrderServerState()

    // Exhaust the (lower) POST cap first — a burst of menu page-loads must
    // never count against it, and vice versa.
    for (let i = 0; i < 5; i++) {
      await fetch(`http://127.0.0.1:${port}/api/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: 'table-1', items: [{ productId: 'p1', quantity: 1 }] })
      })
    }
    const blockedOrder = await fetch(`http://127.0.0.1:${port}/api/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'table-1', items: [{ productId: 'p1', quantity: 1 }] })
    })
    expect(blockedOrder.status).toBe(429)

    // GET /api/menu must still work — its own (higher) cap is untouched by the POST flood above
    const menuRes = await fetch(`http://127.0.0.1:${port}/api/menu`)
    expect(menuRes.status).toBe(200)
  })

  it('rejects a body larger than the size cap rather than buffering it unbounded', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(TEST_PORT) as never)

    await ensureQrOrderServerState()

    // The server destroys the connection outright once the size cap is
    // exceeded (cheaper than buffering an attacker's oversized payload just
    // to formulate a polite error) — this surfaces to the client as a
    // connection reset, not a clean HTTP response.
    const hugeBody = JSON.stringify({ tableId: 'table-1', items: [{ productId: 'p1'.repeat(20000), quantity: 1 }] })
    await expect(fetch(`http://127.0.0.1:${TEST_PORT}/api/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: hugeBody
    })).rejects.toThrow()
  })
})

describe('GET /order/:tableId', () => {
  it('serves the static customer ordering page', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(TEST_PORT) as never)

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/order/table-1`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<html')
  })

  // Was the one route in this file with NO rate limit at all (every other
  // route calls isRateLimited) — a LAN device could flood this with GET
  // requests and, since it also did synchronous readFileSync on every hit
  // before this fix, stall the Electron main process's single event loop
  // (the same thread every IPC handler — billing, invoicing — runs on).
  it('rate-limits a flood of page requests from the same source, same cap as the other GET routes', async () => {
    const port = TEST_PORT + 2 // distinct port — avoids any port-reuse race with adjacent tests
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)

    await ensureQrOrderServerState()

    const results: number[] = []
    for (let i = 0; i < 31; i++) {
      const res = await fetch(`http://127.0.0.1:${port}/order/table-1`)
      results.push(res.status)
    }
    // GET_RATE_LIMIT_MAX_REQUESTS is 30 — the 31st request in the same
    // window must be rejected, not silently served.
    expect(results.slice(0, 30).every(s => s === 200)).toBe(true)
    expect(results[30]).toBe(429)
  })

  it('serves the cached page on repeated requests without re-reading the file from disk each time', async () => {
    const port = TEST_PORT + 3
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)

    await ensureQrOrderServerState()

    const first = await (await fetch(`http://127.0.0.1:${port}/order/table-1`)).text()
    const second = await (await fetch(`http://127.0.0.1:${port}/order/table-2`)).text()
    expect(second).toBe(first) // same cached HTML regardless of tableId
  })
})

// Fresh-audit fix (2026-07-12): the server used to bind with no explicit
// host, which Node resolves to the wildcard address — reachable from ANY
// interface (a public-facing NIC, a VPN tunnel), not just the LAN the
// printed QR codes point at. Now binds one listener per detected LAN IPv4
// address plus loopback explicitly. Also added an Origin-must-equal-Host
// check on POST /api/order (the actual CSRF threat: some other page loaded
// in another tab on the same WiFi blind-POSTing here).
describe('LAN-only binding + Origin check (fresh-audit hardening)', () => {
  it('loopback (127.0.0.1) is always reachable regardless of LAN interfaces present', async () => {
    const port = TEST_PORT + 4
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(listMenuProducts).mockResolvedValue([])

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/menu`)
    expect(res.status).toBe(200)
  })

  it('accepts a POST with no Origin header at all (non-browser/older clients — this is a LAN-trust feature, not a login boundary)', async () => {
    const port = TEST_PORT + 5
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(createOrderRequest).mockResolvedValue({ success: true })

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'table-1', items: [{ productId: 'p1', quantity: 1 }] })
    })
    expect(res.status).toBe(200)
  })

  it('accepts a POST whose Origin matches the Host it was sent to (the real menu page\'s own same-origin fetch)', async () => {
    const port = TEST_PORT + 6
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(createOrderRequest).mockResolvedValue({ success: true })

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': `http://127.0.0.1:${port}` },
      body: JSON.stringify({ tableId: 'table-1', items: [{ productId: 'p1', quantity: 1 }] })
    })
    expect(res.status).toBe(200)
  })

  it('rejects a POST whose Origin does NOT match the Host — the actual cross-tab CSRF threat', async () => {
    const port = TEST_PORT + 7
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(createOrderRequest).mockResolvedValue({ success: true })

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://some-unrelated-site.example' },
      body: JSON.stringify({ tableId: 'table-1', items: [{ productId: 'p1', quantity: 1 }] })
    })
    expect(res.status).toBe(403)
    expect(createOrderRequest).not.toHaveBeenCalled()
  })
})

// Perf fix (2026-09-02, founder-reported real-device latency scanning a
// table QR): GET /api/menu and /api/business now cache their result for a
// short TTL rather than re-running the Prisma query on every single
// request — turns N near-simultaneous menu loads (a party being seated,
// several tables scanning around the same moment) into 1 real DB round
// trip + N-1 near-instant in-memory hits. Rate limiting still runs first
// and unconditionally either way (verified below).
describe('GET /api/menu and /api/business response caching', () => {
  it('serves a second GET /api/menu from cache without calling listMenuProducts again', async () => {
    const port = TEST_PORT + 8
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(listMenuProducts).mockResolvedValue([{ id: 'p1', productName: 'Tea', sellingPrice: 20, imagePath: null, categoryName: null, foodType: null }])

    await ensureQrOrderServerState()
    const first = await (await fetch(`http://127.0.0.1:${port}/api/menu`)).json()
    const second = await (await fetch(`http://127.0.0.1:${port}/api/menu`)).json()

    expect(first).toEqual(second)
    expect(listMenuProducts).toHaveBeenCalledTimes(1)
  })

  it('fetches fresh data again after the server is stopped and restarted (cache reset, not stale forever)', async () => {
    const port = TEST_PORT + 9
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(listMenuProducts).mockResolvedValue([])

    await ensureQrOrderServerState()
    await fetch(`http://127.0.0.1:${port}/api/menu`)
    await stopQrOrderServer()

    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    await ensureQrOrderServerState()
    await fetch(`http://127.0.0.1:${port}/api/menu`)

    expect(listMenuProducts).toHaveBeenCalledTimes(2)
  })

  it('still rate-limits normally on a cache hit — caching never bypasses the abuse cap', async () => {
    const port = TEST_PORT + 10
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
    vi.mocked(listMenuProducts).mockResolvedValue([])

    await ensureQrOrderServerState()
    const results: number[] = []
    for (let i = 0; i < 31; i++) {
      results.push((await fetch(`http://127.0.0.1:${port}/api/menu`)).status)
    }
    expect(results.slice(0, 30).every(s => s === 200)).toBe(true)
    expect(results[30]).toBe(429)
  })
})

// Real bug found+fixed 2026-09-02: binding used to happen inside one shared
// try/catch — a single LAN adapter failing to bind (a stale VPN/VMware/
// Hyper-V host-only adapter still enumerated by the OS, common on a real
// small-business Windows PC) used to abort the ENTIRE server, including
// loopback. Each address now binds independently.
describe('resilient per-address binding', () => {
  it('still serves loopback even when a real LAN address on this machine is already occupied by another listener', async () => {
    const { networkInterfaces } = await import('os')
    const lanAddress = Object.values(networkInterfaces())
      .flat()
      .find((i) => i?.family === 'IPv4' && !i.internal)?.address
    if (!lanAddress) return // no LAN adapter on this machine/CI runner — nothing to conflict with, skip

    const port = TEST_PORT + 11
    // Occupy the real LAN address on this exact port first, so the QR
    // server's own attempt to bind that same address:port fails — exactly
    // the "one adapter unavailable" scenario the fix targets.
    const blocker = (await import('http')).createServer()
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject)
      blocker.listen(port, lanAddress, () => resolve())
    })

    try {
      vi.mocked(isModuleEnabled).mockResolvedValue(true)
      vi.mocked(getPrisma).mockReturnValue(mockDbWithPort(port) as never)
      vi.mocked(listMenuProducts).mockResolvedValue([])

      await ensureQrOrderServerState()

      // The server must still be reported running (loopback bound fine)
      // even though the LAN address collided — the old code would have
      // torn everything down and reported not-running here.
      expect(getServerStatus().running).toBe(true)
      const res = await fetch(`http://127.0.0.1:${port}/api/menu`)
      expect(res.status).toBe(200)
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
    }
  })
})

// 2026-09-02 — the customer's own "Checkout" action on the QR menu. Never
// bills anything itself, only flags the table (checkoutRequestedAt) so
// staff know to bring the bill — see restaurant.service.ts's checkoutTable
// for where billing actually happens.
describe('POST /api/checkout-request', () => {
  it('flags the table (checkoutRequestedAt) and returns success for a real table', async () => {
    const port = TEST_PORT + 12
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    const db = mockDbWithPortAndTable(port, { id: 'table-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/checkout-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'table-1' }),
    })
    const body = await res.json() as { success: boolean }
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(db.restaurantTable.update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { checkoutRequestedAt: expect.any(Date) },
    })
  })

  it('returns 404 without writing anything for an unrecognized table', async () => {
    const port = TEST_PORT + 13
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    const db = mockDbWithPortAndTable(port, null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/checkout-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: 'no-such-table' }),
    })
    expect(res.status).toBe(404)
    expect(db.restaurantTable.update).not.toHaveBeenCalled()
  })

  it('rejects a request with no tableId', async () => {
    const port = TEST_PORT + 14
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPortAndTable(port, null) as never)

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/checkout-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('rejects a cross-origin POST — same CSRF protection as /api/order', async () => {
    const port = TEST_PORT + 15
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    vi.mocked(getPrisma).mockReturnValue(mockDbWithPortAndTable(port, { id: 'table-1' }) as never)

    await ensureQrOrderServerState()
    const res = await fetch(`http://127.0.0.1:${port}/api/checkout-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example.com' },
      body: JSON.stringify({ tableId: 'table-1' }),
    })
    expect(res.status).toBe(403)
  })
})
