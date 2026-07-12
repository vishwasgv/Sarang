import { getPrisma } from '../database/db'

export async function listPets(filters?: {
  customerId?: string
  species?: string
  isActive?: boolean
  search?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.species) where.species = filters.species
    if (filters?.isActive !== undefined) where.isActive = filters.isActive
    if (filters?.search) {
      where.OR = [
        { petName: { contains: filters.search } },
        { breed: { contains: filters.search } },
        { microchipId: { contains: filters.search } },
        { customer: { customerName: { contains: filters.search } } },
      ]
    }

    const items = await db.pet.findMany({
      where,
      include: {
        customer: { select: { id: true, customerName: true, phone: true } },
        vaccinations: {
          select: { id: true, vaccineName: true, nextDueDate: true },
        },
        appointments: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { scheduledDate: 'desc' },
          take: 1,
          select: { id: true, scheduledDate: true, serviceTitle: true, status: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { petName: 'asc' }],
    })

    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'PET-001', message: err instanceof Error ? err.message : 'Could not list pets.' } }
  }
}

export async function getPet(id: string) {
  try {
    const db = getPrisma()
    const item = await db.pet.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, customerName: true, phone: true, email: true } },
        weightHistory: { orderBy: { recordedAt: 'asc' } },
        vaccinations: { orderBy: { administeredAt: 'desc' } },
        appointments: {
          include: {
            provider: { select: { id: true, fullName: true } },
          },
          orderBy: { scheduledDate: 'desc' },
          take: 20,
        },
      },
    })
    if (!item) return { success: false, error: { code: 'PET-002', message: 'Pet not found.' } }
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'PET-002', message: err instanceof Error ? err.message : 'Could not fetch pet.' } }
  }
}

export async function createPet(payload: {
  customerId?: string
  petName: string
  species: string
  breed?: string
  dateOfBirth?: string
  gender?: string
  color?: string
  weight?: number
  microchipId?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const item = await db.pet.create({
      data: {
        customerId: payload.customerId ?? null,
        petName: payload.petName,
        species: payload.species,
        breed: payload.breed ?? null,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        gender: payload.gender ?? null,
        color: payload.color ?? null,
        weight: payload.weight ?? null,
        microchipId: payload.microchipId ?? null,
        notes: payload.notes ?? null,
      },
    })
    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'Pet', entityId: item.id, newValue: JSON.stringify({ petName: payload.petName, species: payload.species }) },
    }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'PET-003', message: err instanceof Error ? err.message : 'Could not create pet.' } }
  }
}

export async function updatePet(payload: {
  id: string
  customerId?: string | null
  petName?: string
  species?: string
  breed?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  color?: string | null
  weight?: number | null
  microchipId?: string | null
  notes?: string | null
  isActive?: boolean
}) {
  try {
    const db = getPrisma()
    const { id, dateOfBirth, ...rest } = payload
    const item = await db.pet.update({
      where: { id },
      data: {
        ...rest,
        ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
      },
    })
    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'Pet', entityId: id },
    }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'PET-004', message: err instanceof Error ? err.message : 'Could not update pet.' } }
  }
}

export async function deletePet(id: string) {
  try {
    const db = getPrisma()
    // Soft delete — keeps history intact
    await db.pet.update({ where: { id }, data: { isActive: false } })
    await db.auditLog.create({
      data: { action: 'DEACTIVATED', entityType: 'Pet', entityId: id },
    }).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'PET-005', message: err instanceof Error ? err.message : 'Could not delete pet.' } }
  }
}

export async function addWeightEntry(payload: { petId: string; weightKg: number; notes?: string; recordedAt?: string }) {
  try {
    const db = getPrisma()
    const entry = await db.weightHistory.create({
      data: {
        petId: payload.petId,
        weightKg: payload.weightKg,
        recordedAt: payload.recordedAt ? new Date(payload.recordedAt) : new Date(),
        notes: payload.notes ?? null,
      },
    })
    // Update current weight on Pet record
    await db.pet.update({ where: { id: payload.petId }, data: { weight: payload.weightKg } })
    return { success: true, data: entry }
  } catch (err) {
    return { success: false, error: { code: 'PET-006', message: err instanceof Error ? err.message : 'Could not add weight entry.' } }
  }
}

export async function listWeightHistory(petId: string) {
  try {
    const db = getPrisma()
    const items = await db.weightHistory.findMany({
      where: { petId },
      orderBy: { recordedAt: 'asc' },
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'PET-007', message: err instanceof Error ? err.message : 'Could not fetch weight history.' } }
  }
}
