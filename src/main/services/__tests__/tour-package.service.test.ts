import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { createTourPackage, createTourDeparture } from '../tour-package.service'

beforeEach(() => vi.clearAllMocks())

describe('tour-package.service.createTourPackage', () => {
  it('rejects a non-positive duration', async () => {
    const res = await createTourPackage({ packageName: 'Kerala Tour', durationDays: 0, defaultTotalSeats: 20, farePerSeat: 5000 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TPK-002')
  })

  it('rejects a non-positive defaultTotalSeats', async () => {
    const res = await createTourPackage({ packageName: 'Kerala Tour', durationDays: 4, defaultTotalSeats: 0, farePerSeat: 5000 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TPK-003')
  })
})

describe('tour-package.service.createTourDeparture', () => {
  it('defaults totalSeats to the package\'s own defaultTotalSeats when not explicitly given', async () => {
    const db = {
      tourPackage: { findUnique: vi.fn().mockResolvedValue({ id: 'pkg-1', defaultTotalSeats: 25 }) },
      tourDeparture: {
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'dep-1', ...data, tourPackage: { packageName: 'Kerala Tour' }, vehicle: null })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTourDeparture({ tourPackageId: 'pkg-1', departureDate: '2024-07-01' })

    expect(res.success).toBe(true)
    expect((res as { data: { totalSeats: number } }).data.totalSeats).toBe(25)
  })

  it('uses an explicitly-given totalSeats over the package default', async () => {
    const db = {
      tourPackage: { findUnique: vi.fn().mockResolvedValue({ id: 'pkg-1', defaultTotalSeats: 25 }) },
      tourDeparture: {
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'dep-1', ...data, tourPackage: { packageName: 'Kerala Tour' }, vehicle: null })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTourDeparture({ tourPackageId: 'pkg-1', departureDate: '2024-07-01', totalSeats: 12 })

    expect((res as { data: { totalSeats: number } }).data.totalSeats).toBe(12)
  })

  it('rejects an unknown tour package', async () => {
    const db = { tourPackage: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTourDeparture({ tourPackageId: 'pkg-missing', departureDate: '2024-07-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TPK-007')
  })
})
