import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })

const handlers = new Map<string, (e: unknown, p: unknown) => Promise<unknown>>()
vi.mock('electron', () => {
  const base: Record<string, unknown> = {
    app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.', getVersion: () => '1.0.0', on: () => {}, whenReady: () => Promise.resolve() },
    ipcMain: { handle: (c: string, fn: (e: unknown, p: unknown) => Promise<unknown>) => { handlers.set(c, fn) }, on: () => {} },
    dialog: {}, shell: {}, safeStorage: { isEncryptionAvailable: () => false }, Notification: class {}, BrowserWindow: class { static getAllWindows() { return [] } },
    screen: {}, session: {}, Menu: {}, nativeImage: {}, clipboard: {}, powerMonitor: { on: () => {} }
  }
  // Anything the app touches on electron that this test does not need is a harmless stand-in.
  const stub = (): unknown => new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : stub()), apply: () => stub(), construct: () => stub() as object })
  return new Proxy(base, { get: (t, k: string) => (k in t ? t[k] : k === 'default' ? t : k === 'then' ? undefined : stub()) })
})
vi.mock('electron-store', () => ({ default: class { get() { return undefined } set() {} delete() {} clear() {} } }))

import { openRealDb, type RealDb } from '../real-db'
import { LanServer } from '../../lan/server'
import { LanClient } from '../../lan/client'
import { registerAllIpcHandlers } from '../../ipc/index'

let handle: RealDb
let server: LanServer
let port = 0
const SECRET = 'test-secret-123'
let productId = ''

function client(secret = SECRET) { return new LanClient({ host: '127.0.0.1', port, secret }) }
async function call(c: LanClient, channel: string, payload?: unknown) { return (await c.call(channel, payload)).result as { success: boolean; data?: any; error?: { code: string; message: string } } }

describe('multi-user over the network (loopback, real handlers, real database)', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    registerAllIpcHandlers()
    const { completeSetup } = await import('../../services/setup.service')
    const setup = await completeSetup({ businessName: 'LAN Shop', businessType: 'RETAIL', ownerName: 'Owner', country: 'India', currencyCode: 'INR', currencySymbol: '₹', taxModel: 'GST', adminUsername: 'admin', adminPassword: 'Admin@12345', adminFullName: 'Admin' } as never)
    expect(setup.success, JSON.stringify(setup)).toBe(true)
    const { getPrisma } = await import('../../database/db')
    const db = getPrisma()
    const p = await db.product.create({ data: { productName: 'Last unit', sellingPrice: 100, costPrice: 50, taxRate: 0 } })
    productId = p.id
    await db.inventory.create({ data: { productId, quantity: 1, averageCost: 50 } })
    const role = await db.role.findFirst({ where: { roleName: 'Admin' } })
    const bcrypt = await import('bcryptjs')
    await db.user.create({ data: { username: 'asha', fullName: 'Asha', passwordHash: await bcrypt.hash('Asha@12345', 4), roleId: role!.id, isActive: true } as never })
    server = new LanServer({ port: 0, secret: SECRET, seatLimit: async () => 2 })
    port = await server.start()
  })
  afterAll(async () => { await server.stop(); await handle.close() })

  it('refuses a message sealed with the wrong secret', async () => {
    const r = await call(client('wrong-secret'), 'lan:ping')
    expect(r.error?.code).toBe('LAN-005')
  })

  it('answers a ping with the right secret', async () => {
    expect((await call(client(), 'lan:ping')).success).toBe(true)
  })

  it('a caller that has not signed in cannot read business data', async () => {
    const r = await call(client(), 'customers:list', {})
    expect(r.success).toBe(false)
    expect(r.error?.code).toBe('AUTH-003')
  })

  it('two PCs sign in as two different people at the same time, each with their own session', async () => {
    const a = client(), b = client()
    expect((await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345', rememberMe: true })).success).toBe(true)
    expect((await call(b, 'auth:login', { username: 'asha', password: 'Asha@12345' })).success).toBe(true)
    expect((await call(a, 'auth:getCurrentUser')).data?.username).toBe('admin')
    expect((await call(b, 'auth:getCurrentUser')).data?.username).toBe('asha')
    await call(a, 'auth:logout'); await call(b, 'auth:logout')
  })

  it('a third PC is refused when all seats are in use (2 seats)', async () => {
    const a = client(), b = client(), c = client()
    expect((await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345' })).success).toBe(true)
    expect((await call(b, 'auth:login', { username: 'asha', password: 'Asha@12345' })).success).toBe(true)
    const third = await call(c, 'auth:login', { username: 'admin', password: 'Admin@12345' })
    expect(third.success).toBe(false)
    expect(third.error?.code).toBe('LAN-003')
    await call(b, 'auth:logout')
    expect((await call(c, 'auth:login', { username: 'admin', password: 'Admin@12345' })).success).toBe(true)
    await call(a, 'auth:logout'); await call(c, 'auth:logout')
  })

  it('actions that need a file or folder on the server PC are refused for another PC', async () => {
    const a = client()
    await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345' })
    const r = await call(a, 'backup:create', {})
    expect(r.error?.code).toBe('LAN-002')
    await call(a, 'auth:logout')
  })

  it('two PCs selling the last unit at the same moment: exactly one sale goes through', async () => {
    const a = client(), b = client()
    await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345' })
    await call(b, 'auth:login', { username: 'asha', password: 'Asha@12345' })
    const sale = { paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 100, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 }
    const [r1, r2] = await Promise.all([call(a, 'billing:createInvoice', sale), call(b, 'billing:createInvoice', sale)])
    expect([r1.success, r2.success].filter(Boolean)).toHaveLength(1)
    const { getPrisma } = await import('../../database/db')
    expect((await getPrisma().inventory.findUnique({ where: { productId } }))!.quantity).toBe(0)
    await call(a, 'auth:logout'); await call(b, 'auth:logout')
  })

  it('invoice numbers stay unique when PCs bill together', async () => {
    const { getPrisma } = await import('../../database/db')
    const db = getPrisma()
    await db.inventory.update({ where: { productId }, data: { quantity: 500 } })
    const a = client(), b = client()
    await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345' })
    await call(b, 'auth:login', { username: 'asha', password: 'Asha@12345' })
    const sale = { paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 100, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 }
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => call(i % 2 ? a : b, 'billing:createInvoice', sale)))
    expect(results.filter((r) => r.success).length).toBe(12)
    const numbers = (await db.invoice.findMany({ select: { invoiceNumber: true } })).map((i) => i.invoiceNumber)
    expect(new Set(numbers).size).toBe(numbers.length)
    await call(a, 'auth:logout'); await call(b, 'auth:logout')
  })

  it('a change made on one PC shows up in the change counter the other PCs watch', async () => {
    const a = client(), b = client()
    await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345' })
    const before = await b.poll()
    const made = await call(a, 'customers:create', { customerName: 'Watch Me', phone: '9000000001' })
    expect(made.success, JSON.stringify(made)).toBe(true)
    const after = await b.poll()
    expect(after!.seq).toBeGreaterThan(before!.seq)
    expect(after!.by).toBe('admin')
    await call(a, 'auth:logout')
  })

  it('a report saved as a file on a client PC is sent back to it instead of opening a dialog on the server', async () => {
    const a = client()
    await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345' })
    const out = await a.call('export:toCsv', { filename: 'people.csv', headers: ['Name'], rows: [['Asha']] })
    expect((out.result as { success?: boolean }).success).toBe(true)
    expect(out.downloads).toHaveLength(1)
    expect(out.downloads[0].suggestedName).toBe('people.csv')
    expect(Buffer.from(out.downloads[0].base64, 'base64').toString('utf8')).toContain('Asha')
    await call(a, 'auth:logout')
  })

  it('a record open for editing on one PC is locked for the other until it is closed', async () => {
    const a = client(), b = client()
    await call(a, 'auth:login', { username: 'admin', password: 'Admin@12345' })
    await call(b, 'auth:login', { username: 'asha', password: 'Asha@12345' })
    expect((await call(a, 'locks:acquire', { kind: 'customer', id: 'c1' })).data.ok).toBe(true)
    const second = await call(b, 'locks:acquire', { kind: 'customer', id: 'c1' })
    expect(second.data).toMatchObject({ ok: false, heldBy: 'admin' })
    // The same person can re-take their own lock (the form refreshes it every minute).
    expect((await call(a, 'locks:acquire', { kind: 'customer', id: 'c1' })).data.ok).toBe(true)
    await call(a, 'locks:release', { kind: 'customer', id: 'c1' })
    expect((await call(b, 'locks:acquire', { kind: 'customer', id: 'c1' })).data.ok).toBe(true)
    await call(a, 'auth:logout'); await call(b, 'auth:logout')
  })

  it('an address that keeps sending messages sealed with the wrong secret is slowed down', async () => {
    const bad = client('not-the-secret')
    for (let i = 0; i < 22; i++) await bad.call('lan:ping', null, 5000)
    // Even the right secret waits while the address is being held back.
    const r = await call(client(), 'lan:ping')
    expect(r.success).toBe(false)
  })
})
