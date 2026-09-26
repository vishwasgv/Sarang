export type ChannelHandler = (payload: unknown) => Promise<unknown>

// Every IPC channel the app serves, so the LAN server can call the same handlers a local window does.
const channels = new Map<string, ChannelHandler>()

export function registerChannel(channel: string, handler: ChannelHandler): void {
  channels.set(channel, handler)
}

export function getChannel(channel: string): ChannelHandler | undefined {
  return channels.get(channel)
}

export function channelCount(): number {
  return channels.size
}

// Channels that must run on the PC where the person is sitting, or that need a file or folder picked there.
// A LAN client never asks the server to run them, and the server refuses them if asked.
const LOCAL_ONLY_PREFIXES = ['lan:', 'dialog:', 'backup:', 'tutorial:', 'license:activate', 'auth:loginWithToken', 'setup:completeSetup']
const LOCAL_ONLY = new Set([
  'import:parseFile', 'import:parseDroppedFile', 'import:validatePreview', 'import:execute',
  'documents:pick', 'documents:attach', 'documents:open', 'documents:print', 'documents:exportForShare',
  'share:showItemInFolder', 'branchSummaries:import', 'reportFiles:chooseFolder', 'gstReturns:reconcile',
  'app:restartAndInstallUpdate', 'app:checkForUpdates', 'app:checkForUpdatesNow', 'app:approveUpdateDownload', 'app:dismissPendingUpdate', 'app:setAutoUpdateCheckEnabled'
])

export function isServerOnlyChannel(channel: string): boolean {
  return LOCAL_ONLY.has(channel) || LOCAL_ONLY_PREFIXES.some((p) => channel.startsWith(p))
}

// A change to the data (as opposed to a read) tells other PCs to refresh.
const CHANGES_DATA = /:(create|update|delete|remove|add|record|cancel|reverse|post|save|set|void|approve|reject|receive|adjust|transfer|convert|issue|reconcile|merge|apply|start|finish|complete|mark|toggle|modify|edit|import|execute|split|hold|resume|refund|pay|assign|revoke|reset|change|activate|archive|restore|submit|repay|generate)/i
export function changesData(channel: string): boolean {
  return CHANGES_DATA.test(channel)
}
