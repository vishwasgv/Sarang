import { getPrisma } from '../database/db'
import { inventoryService } from './inventory.service'
import { logAction } from './audit.service'

// ─── Tables ───────────────────────────────────────────────────────────────────

export async function listTables() {
  try {
    const db = getPrisma()
    const tables = await db.restaurantTable.findMany({
      orderBy: { tableNumber: 'asc' },
      include: {
        kots: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
          select: { id: true, status: true }
        }
      }
    })
    return { success: true, data: tables }
  } catch (err) {
    return { success: false, error: { code: 'RST-001', message: err instanceof Error ? err.message : 'Could not list tables.' } }
  }
}

export async function createTable(tableNumber: string, tableName?: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.restaurantTable.findUnique({ where: { tableNumber } })
    if (existing) return { success: false, error: { code: 'RST-002', message: `Table "${tableNumber}" already exists.` } }

    const table = await db.restaurantTable.create({ data: { tableNumber, tableName } })
    await logAction(userId, 'TABLE_CREATED', 'RestaurantTable', table.id)
    return { success: true, data: table }
  } catch (err) {
    return { success: false, error: { code: 'RST-003', message: err instanceof Error ? err.message : 'Could not create table.' } }
  }
}

export async function updateTableStatus(tableId: string, status: string, userId?: string) {
  try {
    const db = getPrisma()
    const valid = ['AVAILABLE', 'OCCUPIED', 'RESERVED']
    if (!valid.includes(status)) return { success: false, error: { code: 'RST-004', message: `Invalid status "${status}".` } }

    const table = await db.restaurantTable.update({ where: { id: tableId }, data: { status } })
    await logAction(userId, 'TABLE_STATUS_UPDATED', 'RestaurantTable', tableId, undefined, status)
    return { success: true, data: table }
  } catch (err) {
    return { success: false, error: { code: 'RST-005', message: err instanceof Error ? err.message : 'Could not update table status.' } }
  }
}

export async function deleteTable(tableId: string, userId?: string) {
  try {
    const db = getPrisma()
    const active = await db.kOT.count({ where: { tableId, status: { in: ['PENDING', 'IN_PROGRESS'] } } })
    if (active > 0) return { success: false, error: { code: 'RST-006', message: 'Cannot delete table with active KOTs.' } }

    await db.restaurantTable.delete({ where: { id: tableId } })
    await logAction(userId, 'TABLE_DELETED', 'RestaurantTable', tableId)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RST-007', message: err instanceof Error ? err.message : 'Could not delete table.' } }
  }
}

// ─── KOT ──────────────────────────────────────────────────────────────────────

export async function listKOTs(filters?: { status?: string; tableId?: string }) {
  try {
    const db = getPrisma()
    const kots = await db.kOT.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.tableId ? { tableId: filters.tableId } : {}),
      },
      include: {
        table: { select: { tableNumber: true, tableName: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            totalAmount: true,
            items: {
              include: { product: { select: { productName: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, data: kots }
  } catch (err) {
    return { success: false, error: { code: 'RST-010', message: err instanceof Error ? err.message : 'Could not list KOTs.' } }
  }
}

export async function createKOT(invoiceId: string, tableId?: string, userId?: string) {
  try {
    const db = getPrisma()
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return { success: false, error: { code: 'RST-011', message: 'Invoice not found.' } }

    const existing = await db.kOT.findUnique({ where: { invoiceId } })
    if (existing) return { success: false, error: { code: 'RST-012', message: 'KOT already exists for this invoice.' } }

    // Mark table occupied if tableId provided
    if (tableId) {
      await db.restaurantTable.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } })
    }

    const kot = await db.kOT.create({ data: { invoiceId, tableId, status: 'PENDING' } })
    await logAction(userId, 'KOT_CREATED', 'KOT', kot.id)
    return { success: true, data: kot }
  } catch (err) {
    return { success: false, error: { code: 'RST-013', message: err instanceof Error ? err.message : 'Could not create KOT.' } }
  }
}

export async function updateKOTStatus(kotId: string, status: string, userId?: string) {
  try {
    const db = getPrisma()
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED']
    if (!validStatuses.includes(status)) return { success: false, error: { code: 'RST-014', message: `Invalid KOT status "${status}".` } }

    const kot = await db.kOT.findUnique({
      where: { id: kotId },
      include: { invoice: { include: { items: { include: { product: true } } } } }
    })
    if (!kot) return { success: false, error: { code: 'RST-015', message: 'KOT not found.' } }

    // DONE and CANCELLED are terminal states. The UI already only exposes
    // forward transitions (PENDING → IN_PROGRESS → DONE, or Cancel), but that
    // is not itself a safety guarantee — without this, a direct/malformed
    // call could take a KOT DONE → CANCELLED → DONE again and deduct the same
    // ingredients twice.
    if ((kot.status === 'DONE' || kot.status === 'CANCELLED') && status !== kot.status) {
      return { success: false, error: { code: 'RST-017', message: `Cannot change status of a ${kot.status.toLowerCase()} KOT.` } }
    }

    // When KOT is fulfilled (DONE), deduct ingredient stock
    if (status === 'DONE' && kot.status !== 'DONE') {
      await deductIngredients(kot.invoice.items, userId)
    }

    // When KOT is done or cancelled, free the table
    if ((status === 'DONE' || status === 'CANCELLED') && kot.tableId) {
      const hasOtherActive = await db.kOT.count({
        where: { tableId: kot.tableId, status: { in: ['PENDING', 'IN_PROGRESS'] }, id: { not: kotId } }
      })
      if (hasOtherActive === 0) {
        await db.restaurantTable.update({ where: { id: kot.tableId }, data: { status: 'AVAILABLE' } })
      }
    }

    const updated = await db.kOT.update({ where: { id: kotId }, data: { status } })
    await logAction(userId, 'KOT_STATUS_UPDATED', 'KOT', kotId, kot.status, status)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'RST-016', message: err instanceof Error ? err.message : 'Could not update KOT status.' } }
  }
}

// report.service.ts's generateFoodCostReport() identifies KOT-driven ingredient
// deductions by matching this exact remarks prefix against InventoryMovement
// records — exported (rather than duplicated as a literal in both files) so a
// future wording change can't silently break the report with zero compile-time
// warning or runtime error.
export const INGREDIENT_DEDUCTION_REMARKS_PREFIX = 'Ingredient deduction for KOT'

// Deduct ingredient stock when KOT is fulfilled
async function deductIngredients(
  invoiceItems: Array<{ productId: string; quantity: number }>,
  userId?: string
): Promise<void> {
  const db = getPrisma()
  for (const item of invoiceItems) {
    const recipe = await db.recipe.findUnique({
      where: { productId: item.productId },
      include: { items: true }
    })
    if (!recipe) continue

    for (const ri of recipe.items) {
      const needed = ri.quantity * item.quantity
      try {
        const inv = await db.inventory.findUnique({ where: { productId: ri.ingredientProductId } })
        if (!inv) continue
        const newQty = Math.max(0, inv.quantity - needed)
        // adjustStock expects new absolute quantity; movement created with negative delta for food cost report
        await inventoryService.adjustStock({
          productId: ri.ingredientProductId,
          quantity: newQty,
          reason: `${INGREDIENT_DEDUCTION_REMARKS_PREFIX} — recipe: ${recipe.recipeName}`
        }, userId)
      } catch {
        // Do not abort KOT fulfillment if an ingredient is out of stock
      }
    }
  }
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export async function listRecipes() {
  try {
    const db = getPrisma()
    const recipes = await db.recipe.findMany({
      include: {
        items: {
          include: { ingredient: { select: { productName: true, unit: true } } }
        }
      },
      orderBy: { recipeName: 'asc' }
    })

    // Recipe.productId has no Prisma relation to Product (plain column, no
    // @relation) — fetch names for the menu products involved in one batched
    // query rather than adding a schema relation just for a display label.
    const products = await db.product.findMany({
      where: { id: { in: recipes.map(r => r.productId) } },
      select: { id: true, productName: true }
    })
    const productNameById = new Map(products.map(p => [p.id, p.productName]))

    const withProductName = recipes.map(r => ({
      ...r,
      product: { productName: productNameById.get(r.productId) ?? '(deleted product)' }
    }))

    return { success: true, data: withProductName }
  } catch (err) {
    return { success: false, error: { code: 'RST-020', message: err instanceof Error ? err.message : 'Could not list recipes.' } }
  }
}

export async function getRecipe(productId: string) {
  try {
    const db = getPrisma()
    const recipe = await db.recipe.findUnique({
      where: { productId },
      include: {
        items: {
          include: { ingredient: { select: { id: true, productName: true, unit: true } } }
        }
      }
    })
    return { success: true, data: recipe ?? null }
  } catch (err) {
    return { success: false, error: { code: 'RST-021', message: err instanceof Error ? err.message : 'Could not get recipe.' } }
  }
}

export async function upsertRecipe(
  productId: string,
  recipeName: string,
  items: Array<{ ingredientProductId: string; quantity: number }>,
  userId?: string
) {
  try {
    const db = getPrisma()

    if (!recipeName.trim()) return { success: false, error: { code: 'RST-022', message: 'Recipe name is required.' } }
    if (!items.length) return { success: false, error: { code: 'RST-023', message: 'At least one ingredient is required.' } }
    for (const item of items) {
      if (item.quantity <= 0) return { success: false, error: { code: 'RST-024', message: 'Ingredient quantity must be greater than zero.' } }
    }
    // Each ingredient must appear at most once — deductIngredients() processes
    // every item row independently, so a duplicated ingredient would silently
    // deduct stock multiple times per KOT instead of once at the combined
    // quantity.
    const seenIngredients = new Set<string>()
    for (const item of items) {
      if (seenIngredients.has(item.ingredientProductId)) {
        return { success: false, error: { code: 'RST-027', message: 'Each ingredient can only appear once in a recipe — combine duplicate rows into a single quantity instead.' } }
      }
      seenIngredients.add(item.ingredientProductId)
    }

    const existing = await db.recipe.findUnique({ where: { productId } })

    let recipe
    if (existing) {
      // Delete existing items and re-create (simplest safe update)
      await db.recipeItem.deleteMany({ where: { recipeId: existing.id } })
      recipe = await db.recipe.update({
        where: { id: existing.id },
        data: {
          recipeName,
          items: { create: items }
        },
        include: { items: { include: { ingredient: { select: { productName: true, unit: true } } } } }
      })
      await logAction(userId, 'RECIPE_UPDATED', 'Recipe', recipe.id)
    } else {
      recipe = await db.recipe.create({
        data: { productId, recipeName, items: { create: items } },
        include: { items: { include: { ingredient: { select: { productName: true, unit: true } } } } }
      })
      await logAction(userId, 'RECIPE_CREATED', 'Recipe', recipe.id)
    }

    return { success: true, data: recipe }
  } catch (err) {
    return { success: false, error: { code: 'RST-025', message: err instanceof Error ? err.message : 'Could not save recipe.' } }
  }
}

export async function deleteRecipe(recipeId: string, userId?: string) {
  try {
    const db = getPrisma()
    await db.recipe.delete({ where: { id: recipeId } })
    await logAction(userId, 'RECIPE_DELETED', 'Recipe', recipeId)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RST-026', message: err instanceof Error ? err.message : 'Could not delete recipe.' } }
  }
}

// ─── Daily Closing (GAP R22) ──────────────────────────────────────────────────

export async function getDailyClosingSummary(date?: string) {
  try {
    const db = getPrisma()
    const dayStart = date ? new Date(date) : new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    // KOTs completed today
    const kots = await db.kOT.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      select: { status: true, id: true }
    })

    const kotsByStatus = {
      PENDING: kots.filter(k => k.status === 'PENDING').length,
      IN_PROGRESS: kots.filter(k => k.status === 'IN_PROGRESS').length,
      DONE: kots.filter(k => k.status === 'DONE').length,
      CANCELLED: kots.filter(k => k.status === 'CANCELLED').length,
    }

    // Revenue from invoices today
    const invoices = await db.invoice.findMany({
      where: { invoiceDate: { gte: dayStart, lte: dayEnd }, status: 'FINAL' },
      select: { totalAmount: true, paidAmount: true, paymentStatus: true }
    })

    const revenue = {
      total: invoices.reduce((s, i) => s + i.totalAmount, 0),
      collected: invoices.reduce((s, i) => s + i.paidAmount, 0),
      invoiceCount: invoices.length,
      pending: invoices.filter(i => i.paymentStatus !== 'PAID').length
    }

    // Tables currently occupied
    const occupiedTables = await db.restaurantTable.count({ where: { status: 'OCCUPIED' } })

    return {
      success: true,
      data: {
        date: dayStart.toISOString().split('T')[0],
        kots: kotsByStatus,
        revenue,
        openTables: occupiedTables
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'RST-030', message: err instanceof Error ? err.message : 'Could not fetch daily summary.' } }
  }
}

export async function performDailyClose(userId?: string) {
  try {
    const db = getPrisma()

    // Mark all DONE KOTs as closed (already counted in revenue)
    // Reset table statuses to AVAILABLE (close the shift)
    const openTables = await db.restaurantTable.findMany({ where: { status: 'OCCUPIED' } })

    for (const table of openTables) {
      await db.restaurantTable.update({ where: { id: table.id }, data: { status: 'AVAILABLE' } })
    }

    const summary = await getDailyClosingSummary()

    await logAction(userId, 'RESTAURANT_DAILY_CLOSE', 'Restaurant', undefined, undefined, summary.data)

    return { success: true, data: summary.data }
  } catch (err) {
    return { success: false, error: { code: 'RST-031', message: err instanceof Error ? err.message : 'Daily close failed.' } }
  }
}
