import log from 'electron-log'
import { app } from 'electron'
import { join } from 'path'

// Configure electron-log for Sarang Business OS
// Production: write only ERROR and WARN to file — no user behaviour logging
log.transports.file.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB, rotates automatically
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

if (typeof app !== 'undefined') {
  try {
    log.transports.file.resolvePathFn = () =>
      join(app.getPath('userData'), 'logs', 'sarang.log')
  } catch {
    // app not ready yet during early init
  }
}

log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
log.transports.console.format = '[{level}] {text}'

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log.debug(msg, ...args),
  info: (msg: string, ...args: unknown[]) => log.info(msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log.warn(msg, ...args),
  error: (msg: string, ...args: unknown[]) => log.error(msg, ...args),
}

export default logger
