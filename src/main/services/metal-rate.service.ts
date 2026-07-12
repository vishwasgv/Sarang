import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Jewellery vertical (fresh-audit build, 2026-07-12). One row per
// metalType+purity — 22K and 18K gold trade at genuinely different
// per-gram rates, not a single "gold rate". Owner updates these whenever
// the day's rate changes; there is no automatic feed (this app has no
// internet dependency for core features, per its own standing "offline
// forever" rule) — the owner reads today's rate from wherever they
// normally do and types it in.

export async function listMetalRates() {
  try {
    const db = getPrisma()
    const rates = await db.metalRate.findMany({ orderBy: [{ metalType: 'asc' }, { purity: 'asc' }] })
    return { success: true, data: rates }
  } catch (err) {
    return { success: false, error: { code: 'MR-001', message: err instanceof Error ? err.message : 'Could not list metal rates.' } }
  }
}

export async function upsertMetalRate(payload: {
  metalType: string
  purity: string
  ratePerGram: number
  updatedById?: string
}) {
  try {
    if (payload.ratePerGram <= 0) {
      return { success: false, error: { code: 'MR-002', message: 'Rate per gram must be greater than zero.' } }
    }
    const db = getPrisma()
    const rate = await db.metalRate.upsert({
      where: { metalType_purity: { metalType: payload.metalType, purity: payload.purity } },
      create: { metalType: payload.metalType, purity: payload.purity, ratePerGram: payload.ratePerGram, updatedById: payload.updatedById ?? null },
      update: { ratePerGram: payload.ratePerGram, updatedById: payload.updatedById ?? null },
    })
    await logAction({ userId: payload.updatedById, action: 'METAL_RATE_UPDATED', entityType: 'MetalRate', entityId: rate.id, newValue: { metalType: payload.metalType, purity: payload.purity, ratePerGram: payload.ratePerGram } })
    return { success: true, data: rate }
  } catch (err) {
    return { success: false, error: { code: 'MR-003', message: err instanceof Error ? err.message : 'Could not update metal rate.' } }
  }
}

export async function getMetalRate(metalType: string, purity: string) {
  try {
    const db = getPrisma()
    const rate = await db.metalRate.findUnique({ where: { metalType_purity: { metalType, purity } } })
    return { success: true, data: rate }
  } catch (err) {
    return { success: false, error: { code: 'MR-004', message: err instanceof Error ? err.message : 'Could not fetch metal rate.' } }
  }
}

export async function deleteMetalRate(id: string) {
  try {
    const db = getPrisma()
    await db.metalRate.delete({ where: { id } })
    await logAction({ action: 'METAL_RATE_DELETED', entityType: 'MetalRate', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'MR-005', message: err instanceof Error ? err.message : 'Could not delete metal rate.' } }
  }
}
