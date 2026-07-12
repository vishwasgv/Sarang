import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import type { ApiResponse } from '../ipc/channels'

export async function listCategories(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const categories = await db.productCategory.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: { where: { isActive: true } } } }, children: { where: { isActive: true }, select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    })
    return { success: true, data: categories }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function createCategory(payload: { name: string; description?: string; parentCategoryId?: string }): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const existing = await db.productCategory.findFirst({
      where: { name: { equals: payload.name }, parentCategoryId: payload.parentCategoryId ?? null, isActive: true }
    })
    if (existing) {
      return { success: false, error: { code: 'CAT-001', message: 'A category with this name already exists.' } }
    }
    const category = await db.productCategory.create({ data: { name: payload.name, description: payload.description, parentCategoryId: payload.parentCategoryId } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'CATEGORY_CREATED', entityType: 'ProductCategory', entityId: category.id, newValue: { name: payload.name } })
    return { success: true, data: category }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateCategory(payload: { id: string; name: string; description?: string; parentCategoryId?: string | null }): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const existing = await db.productCategory.findUnique({ where: { id: payload.id } })
    if (!existing || !existing.isActive) {
      return { success: false, error: { code: 'CAT-002', message: 'Category not found.' } }
    }
    const duplicate = await db.productCategory.findFirst({
      where: { name: { equals: payload.name }, parentCategoryId: payload.parentCategoryId ?? null, isActive: true, id: { not: payload.id } }
    })
    if (duplicate) {
      return { success: false, error: { code: 'CAT-001', message: 'A category with this name already exists.' } }
    }
    if (payload.parentCategoryId === payload.id) {
      return { success: false, error: { code: 'CAT-003', message: 'A category cannot be its own parent.' } }
    }
    const updated = await db.productCategory.update({ where: { id: payload.id }, data: { name: payload.name, description: payload.description, parentCategoryId: payload.parentCategoryId } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'CATEGORY_UPDATED', entityType: 'ProductCategory', entityId: payload.id })
    return { success: true, data: updated }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function archiveCategory(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const activeProducts = await db.product.count({ where: { categoryId: id, isActive: true } })
    if (activeProducts > 0) {
      return { success: false, error: { code: 'CAT-004', message: `Cannot archive: ${activeProducts} active product(s) use this category. Reassign them first.` } }
    }
    await db.productCategory.update({ where: { id }, data: { isActive: false } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'CATEGORY_ARCHIVED', entityType: 'ProductCategory', entityId: id })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
