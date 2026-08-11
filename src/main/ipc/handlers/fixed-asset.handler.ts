import { fixedAssetService } from '../../services/fixed-asset.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateFixedAssetSchema, RunDepreciationSchema, DisposeFixedAssetSchema } from '../../validation/fixed-asset.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('fixedAssets:create', async (payload) => {
    const deny = await requirePermission('fixedAssets.manage'); if (deny) return deny
    const parsed = CreateFixedAssetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return fixedAssetService.createAsset(parsed.data, getCurrentSession()?.userId)
  })

  handle('fixedAssets:list', async (payload) => {
    const deny = await requirePermission('fixedAssets.view'); if (deny) return deny
    return fixedAssetService.listAssets(payload as { status?: string; category?: string } | undefined)
  })

  handle('fixedAssets:get', async (id) => {
    const deny = await requirePermission('fixedAssets.view'); if (deny) return deny
    return fixedAssetService.getAsset(id as string)
  })

  handle('fixedAssets:runDepreciation', async (payload) => {
    const deny = await requirePermission('fixedAssets.runDepreciation'); if (deny) return deny
    const parsed = RunDepreciationSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return fixedAssetService.runDepreciation(parsed.data, getCurrentSession()?.userId)
  })

  handle('fixedAssets:dispose', async (payload) => {
    const deny = await requirePermission('fixedAssets.manage'); if (deny) return deny
    const parsed = DisposeFixedAssetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return fixedAssetService.disposeAsset(parsed.data, getCurrentSession()?.userId)
  })
}
