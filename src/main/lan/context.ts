import { AsyncLocalStorage } from 'async_hooks'

// Set while a request from another PC (a LAN client) is being served. Handlers that would open a window or a file
// dialog on this PC check it and hand the work back to the caller's PC instead.
export interface RemoteContext {
  user: string | null
  downloads: Array<{ tempPath: string; suggestedName: string }>
}

const storage = new AsyncLocalStorage<RemoteContext>()

export function runAsRemote<T>(ctx: RemoteContext, fn: () => T): T {
  return storage.run(ctx, fn)
}

export function remoteContext(): RemoteContext | null {
  return storage.getStore() ?? null
}

export function isRemoteRequest(): boolean {
  return storage.getStore() !== undefined
}
