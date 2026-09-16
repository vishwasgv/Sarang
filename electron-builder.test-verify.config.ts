import baseConfig from './electron-builder.config'
import type { Configuration } from 'electron-builder'

/**
 * TEST-ONLY packaged build config -- never used for a shipped installer.
 *
 * The real config's `electronFuses.enableNodeCliInspectArguments: false`
 * (2026-09-02 hardening, closes a raw-devtools-inspection route to bypassing
 * license.service.ts) has a side effect discovered 2026-09-16: it also
 * blocks Playwright's `_electron.launch()`, which needs that same CLI
 * inspect/remote-debugging capability to attach to the packaged exe at all
 * ("Process failed to launch!"). That silently broke every `packaged-*.js`
 * E2E script (packaged-feature-smoke.js, packaged-fresh-install-flow.js,
 * packaged-backup-restore.js, packaged-corrupted-backup.js,
 * packaged-locale-check.js) the moment that hardening shipped, undetected
 * until this file's first real use.
 *
 * Rather than weaken the real installer's fuse (the whole point of that
 * hardening), this is a second, deliberately-separate build target: same
 * app, same code, only this one fuse re-enabled, output to a different
 * directory so it can never be confused with or accidentally overwrite the
 * real release/ artifact.
 *
 * Usage: `npm run dist:test-packaged`, then point a `packaged-*.js` script's
 * EXE_PATH at the install produced from `release-testonly/*.exe` instead of
 * the real release. Never publish anything built from this config.
 */
const config: Configuration = {
  ...baseConfig,
  directories: {
    ...baseConfig.directories,
    output: 'release-testonly'
  },
  electronFuses: {
    ...baseConfig.electronFuses,
    enableNodeCliInspectArguments: true
  },
  // Never auto-publish a test build.
  publish: null
}

export default config
