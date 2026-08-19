import { priceMarkdownService } from '../../services/price-markdown.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreatePriceMarkdownSchema } from '../../validation/price-markdown.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('priceMarkdowns:list', async (payload) => {
    const deny = await requirePermission('priceMarkdowns.view'); if (deny) return deny
    return priceMarkdownService.listPriceMarkdowns(payload as { status?: string; productId?: string } | undefined)
  })

  handle('priceMarkdowns:create', async (payload) => {
    const deny = await requirePermission('priceMarkdowns.manage'); if (deny) return deny
    const parsed = CreatePriceMarkdownSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return priceMarkdownService.createPriceMarkdown(parsed.data, getCurrentSession()?.userId)
  })

  handle('priceMarkdowns:cancel', async (id) => {
    const deny = await requirePermission('priceMarkdowns.manage'); if (deny) return deny
    const bad = validateId(id, 'price markdown ID'); if (bad) return bad
    return priceMarkdownService.cancelPriceMarkdown(id as string, getCurrentSession()?.userId)
  })

  // Manual "check now" — same evaluator the hourly setInterval in
  // main/index.ts calls automatically, exposed so a store owner isn't stuck
  // waiting up to an hour to see a due markdown actually revert.
  handle('priceMarkdowns:evaluateNow', async () => {
    const deny = await requirePermission('priceMarkdowns.manage'); if (deny) return deny
    const result = await priceMarkdownService.revertDuePriceMarkdowns(getCurrentSession()?.userId)
    return { success: true, data: result }
  })
}
