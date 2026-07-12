// Typed wrapper around the preload bridge (window.api)
// Renderer code should import from here, not call window.api directly

import type { IpcChannels } from '../../../main/ipc/channels'

type PushChannel = 'notifications:new' | 'backup:progress' | 'backup:complete' | 'import:progress' | 'import:complete' | 'system:alert'

declare global {
  interface Window {
    api: IpcChannels
    appInfo: { version: string; name: string }
    events: {
      on: (channel: PushChannel, listener: (...args: unknown[]) => void) => (() => void)
      off: (channel: PushChannel, listener: (...args: unknown[]) => void) => void
    }
    fileUtils: {
      getPathForFile: (file: File) => string
    }
  }
}

export const api: IpcChannels = window.api
export const appInfo: { version: string; name: string } = window.appInfo
export const fileUtils: { getPathForFile: (file: File) => string } = window.fileUtils

export function onPushEvent(channel: PushChannel, listener: (...args: unknown[]) => void): () => void {
  return window.events?.on(channel, listener) ?? (() => {})
}
