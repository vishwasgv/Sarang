import { z } from 'zod'
import { requirePermission } from '../permission-guard'
import { getSeatLimit } from '../../lan/seats'
import { applyLanConfig, currentConfig, lanStatus, saveLanConfig } from '../../lan/controller'
import { generateSecret } from '../../lan/config'
import { LanClient } from '../../lan/client'
import { getLanServer } from '../../lan/router'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const SaveSchema = z.object({
  mode: z.enum(['off', 'server', 'client']),
  port: z.number().int().min(1024).max(65535).optional(),
  secret: z.string().min(6).max(64).optional(),
  host: z.string().trim().max(120).optional()
})

// The multi-user settings. On a client PC there is no local sign-in (people sign in to the server), so the screen can
// still read the state and switch the PC back to single-PC use; turning the feature on needs the owner's permission.
export function register(handle: HandleFn): void {
  handle('lan:getStatus', async () => {
    const cfg = currentConfig()
    const deny = await requirePermission('settings.modify')
    const seats = cfg.mode === 'client' ? null : await getSeatLimit()
    return { success: true, data: { ...lanStatus(), host: cfg.host, seats, secret: deny ? null : cfg.secret, canEdit: !deny || cfg.mode === 'client' } }
  })

  handle('lan:saveConfig', async (payload) => {
    const cfg = currentConfig()
    if (cfg.mode !== 'client') {
      const deny = await requirePermission('settings.modify'); if (deny) return deny
    }
    const parsed = SaveSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid settings.' } }
    if (parsed.data.mode === 'client' && (!parsed.data.host || !parsed.data.secret)) {
      return { success: false, error: { code: 'VAL-001', message: 'Enter the server PC address and its shared secret.' } }
    }
    saveLanConfig(parsed.data)
    // Switching between single-PC, server and client changes what the app opens with, so it restarts.
    return { success: true, data: { restartRequired: true } }
  })

  handle('lan:newSecret', async () => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const cfg = saveLanConfig({ secret: generateSecret() })
    await applyLanConfig()
    return { success: true, data: { secret: cfg.secret } }
  })

  handle('lan:disconnect', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const id = (payload as { id?: string } | null)?.id
    if (!id) return { success: false, error: { code: 'VAL-001', message: 'Connection is required.' } }
    return { success: true, data: { removed: getLanServer()?.disconnect(id) ?? false } }
  })

  handle('lan:testConnection', async (payload) => {
    const p = payload as { host?: string; port?: number; secret?: string } | null
    if (!p?.host || !p.secret) return { success: false, error: { code: 'VAL-001', message: 'Enter the server PC address and its shared secret.' } }
    const client = new LanClient({ host: p.host, port: p.port ?? currentConfig().port, secret: p.secret })
    const r = await client.ping()
    return r.ok ? { success: true, data: { message: r.message } } : { success: false, error: { code: 'LAN-001', message: r.message } }
  })

  handle('lan:restart', async () => {
    const { app } = await import('electron')
    app.relaunch()
    app.exit(0)
    return { success: true }
  })
}
