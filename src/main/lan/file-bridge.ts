import { dialog, type SaveDialogOptions } from 'electron'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { remoteContext } from './context'

// Asks where to save a file. On the PC itself that is the normal Save dialog. For a request from another PC the
// file is written to a temporary place here and sent back, and the caller's PC shows its own Save dialog.
export async function chooseSavePath(options: SaveDialogOptions): Promise<{ filePath: string | undefined; canceled: boolean }> {
  const ctx = remoteContext()
  if (!ctx) {
    const { filePath, canceled } = await dialog.showSaveDialog(options)
    return { filePath, canceled }
  }
  const suggestedName = basename(options.defaultPath ?? 'sarang-file')
  const tempPath = join(mkdtempSync(join(tmpdir(), 'sarang-dl-')), suggestedName)
  ctx.downloads.push({ tempPath, suggestedName })
  return { filePath: tempPath, canceled: false }
}
