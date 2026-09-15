import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories run before top-level const initializers (import hoisting) —
// vi.hoisted keeps these mock fns accessible inside the factories below.
const { loadURL, printToPDF, destroy } = vi.hoisted(() => ({
  loadURL: vi.fn().mockResolvedValue(undefined),
  printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf')),
  destroy: vi.fn(),
}))

vi.mock('electron', () => {
  class MockBrowserWindow {
    webContents = { printToPDF: (...args: unknown[]) => printToPDF(...args) }
    loadURL(...args: unknown[]) { return loadURL(...args) }
    destroy(...args: unknown[]) { return destroy(...args) }
  }
  return { BrowserWindow: MockBrowserWindow }
})

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../document.service', () => ({ attachDocument: vi.fn() }))
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue('/tmp/sarang-doctor-pad-xyz'),
  rm: vi.fn().mockResolvedValue(undefined),
}))

import { getPrisma } from '../../database/db'
import { attachDocument } from '../document.service'
import {
  getOrCreateDoctorPadToken,
  regenerateDoctorPadToken,
  getOrCreateProviderPin,
  regenerateProviderPin,
  resolveProviderPin,
  getProviderDisplayName,
  listDoctorPadEligibleProviders,
  listTodaysAppointmentsForProvider,
  saveHandDrawnNote,
} from '../doctor-pad.service'

function makeMockDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    employee: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    appointment: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  }
  return db
}

describe('doctor-pad.service — server token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and persists a new token when none exists', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const token = await getOrCreateDoctorPadToken()

    expect(token).toMatch(/^[0-9a-f]{24}$/)
    expect(db.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { settingKey: 'doctor_pad_server_token' },
    }))
  })

  it('returns the existing token instead of minting a new one', async () => {
    const db = makeMockDb({
      setting: {
        findUnique: vi.fn().mockResolvedValue({ settingValue: 'existing-token' }),
        upsert: vi.fn(),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const token = await getOrCreateDoctorPadToken()

    expect(token).toBe('existing-token')
    expect(db.setting.upsert).not.toHaveBeenCalled()
  })

  it('regenerateDoctorPadToken always mints a fresh value', async () => {
    const db = makeMockDb({
      setting: {
        findUnique: vi.fn().mockResolvedValue({ settingValue: 'old-token' }),
        upsert: vi.fn().mockResolvedValue({}),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const token = await regenerateDoctorPadToken()

    expect(token).not.toBe('old-token')
    expect(db.setting.upsert).toHaveBeenCalled()
  })
})

describe('doctor-pad.service — per-provider PIN', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a 4-digit PIN scoped to the provider settingKey', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const pin = await getOrCreateProviderPin('prov-1')

    expect(pin).toMatch(/^\d{4}$/)
    expect(db.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { settingKey: 'doctor_pad_pin_prov-1' },
    }))
  })

  it('returns the existing PIN instead of minting a new one', async () => {
    const db = makeMockDb({
      setting: {
        findUnique: vi.fn().mockResolvedValue({ settingValue: '4242' }),
        upsert: vi.fn(),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const pin = await getOrCreateProviderPin('prov-1')

    expect(pin).toBe('4242')
    expect(db.setting.upsert).not.toHaveBeenCalled()
  })

  it('regenerateProviderPin mints a fresh 4-digit PIN and persists it under the same key', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const pin = await regenerateProviderPin('prov-1')

    expect(pin).toMatch(/^\d{4}$/)
    expect(db.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { settingKey: 'doctor_pad_pin_prov-1' },
    }))
  })

  it('resolveProviderPin finds the matching provider by scanning all doctor_pad_pin_* settings', async () => {
    const db = makeMockDb({
      setting: {
        findMany: vi.fn().mockResolvedValue([
          { settingKey: 'doctor_pad_pin_prov-1', settingValue: '1111' },
          { settingKey: 'doctor_pad_pin_prov-2', settingValue: '2222' },
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const providerId = await resolveProviderPin('2222')

    expect(providerId).toBe('prov-2')
  })

  it('resolveProviderPin returns null for an unrecognized PIN', async () => {
    const db = makeMockDb({
      setting: { findMany: vi.fn().mockResolvedValue([{ settingKey: 'doctor_pad_pin_prov-1', settingValue: '1111' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const providerId = await resolveProviderPin('9999')

    expect(providerId).toBeNull()
  })
})

describe('doctor-pad.service — provider lookups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getProviderDisplayName returns the employee full name', async () => {
    const db = makeMockDb({ employee: { findUnique: vi.fn().mockResolvedValue({ fullName: 'Dr. Asha Rao' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const name = await getProviderDisplayName('prov-1')

    expect(name).toBe('Dr. Asha Rao')
  })

  it('getProviderDisplayName returns null when the employee does not exist', async () => {
    const db = makeMockDb({ employee: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const name = await getProviderDisplayName('prov-missing')

    expect(name).toBeNull()
  })

  it('listDoctorPadEligibleProviders returns an empty list without querying employees when no appointments exist', async () => {
    const db = makeMockDb({
      appointment: { findMany: vi.fn().mockResolvedValue([]) },
      employee: { findMany: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await listDoctorPadEligibleProviders()

    expect(result).toEqual([])
    expect(db.employee.findMany).not.toHaveBeenCalled()
  })

  it('listDoctorPadEligibleProviders cross-references distinct providerIds against active employees', async () => {
    const db = makeMockDb({
      appointment: { findMany: vi.fn().mockResolvedValue([{ providerId: 'prov-1' }, { providerId: 'prov-2' }]) },
      employee: { findMany: vi.fn().mockResolvedValue([{ id: 'prov-1', fullName: 'Dr. A' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await listDoctorPadEligibleProviders()

    expect(result).toEqual([{ id: 'prov-1', fullName: 'Dr. A' }])
    expect(db.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['prov-1', 'prov-2'] }, isActive: true },
    }))
  })

  it('listTodaysAppointmentsForProvider excludes CANCELLED and NO_SHOW', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listTodaysAppointmentsForProvider('prov-1')

    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        providerId: 'prov-1',
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      }),
    }))
  })
})

describe('doctor-pad.service — saveHandDrawnNote', () => {
  beforeEach(() => vi.clearAllMocks())

  const validImage = 'data:image/png;base64,aGVsbG8=' // "hello"

  it('rejects an empty images array', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await saveHandDrawnNote('appt-1', [])

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('DP-001')
    expect(attachDocument).not.toHaveBeenCalled()
  })

  it('rejects more than 3 pages', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await saveHandDrawnNote('appt-1', [validImage, validImage, validImage, validImage])

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('DP-001')
    expect(attachDocument).not.toHaveBeenCalled()
  })

  it('rejects a payload that is not a data:image/png base64 URL', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await saveHandDrawnNote('appt-1', ['not-an-image'])

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('DP-001')
    expect(attachDocument).not.toHaveBeenCalled()
  })

  it('rejects a base64 payload containing non-base64 characters (HTML/attribute-injection guard)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const malicious = 'data:image/png;base64,aGVsbG8="><script>alert(1)</script>'
    const res = await saveHandDrawnNote('appt-1', [malicious])

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('DP-001')
    expect(attachDocument).not.toHaveBeenCalled()
  })

  it('rejects when the appointment does not exist', async () => {
    const db = makeMockDb({ appointment: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await saveHandDrawnNote('appt-missing', [validImage])

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('DP-002')
    expect(attachDocument).not.toHaveBeenCalled()
  })

  it('a single page attaches a PNG to the APPOINTMENT entity, not VISIT_NOTE', async () => {
    const db = makeMockDb({ appointment: { findUnique: vi.fn().mockResolvedValue({ id: 'appt-1' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(attachDocument).mockResolvedValue({ success: true } as never)

    const res = await saveHandDrawnNote('appt-1', [validImage])

    expect(res.success).toBe(true)
    expect(attachDocument).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'APPOINTMENT', entityId: 'appt-1', fileName: expect.stringMatching(/\.png$/) })
    )
    // No logged-in user on this LAN write — userId must be omitted (undefined),
    // never a fake placeholder string, since Document.uploadedById/AuditLog.userId
    // are real FKs to User.id.
    expect(vi.mocked(attachDocument).mock.calls[0][1]).toBeUndefined()
    expect(printToPDF).not.toHaveBeenCalled()
  })

  it('multiple pages are combined into a single multi-page PDF attachment', async () => {
    const db = makeMockDb({ appointment: { findUnique: vi.fn().mockResolvedValue({ id: 'appt-1' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(attachDocument).mockResolvedValue({ success: true } as never)

    const res = await saveHandDrawnNote('appt-1', [validImage, validImage])

    expect(res.success).toBe(true)
    expect(printToPDF).toHaveBeenCalledTimes(1)
    expect(attachDocument).toHaveBeenCalledTimes(1)
    expect(attachDocument).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'APPOINTMENT', entityId: 'appt-1', fileName: expect.stringMatching(/\.pdf$/) })
    )
    expect(vi.mocked(attachDocument).mock.calls[0][1]).toBeUndefined()
  })

  it('surfaces a failure from attachDocument as DP-004', async () => {
    const db = makeMockDb({ appointment: { findUnique: vi.fn().mockResolvedValue({ id: 'appt-1' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(attachDocument).mockResolvedValue({ success: false } as never)

    const res = await saveHandDrawnNote('appt-1', [validImage])

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('DP-004')
  })
})
