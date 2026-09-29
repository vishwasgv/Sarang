import { app, net, protocol } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'

// F-90 fix (J10, receipt OCR): tesseract.js's Worker/importScripts pipeline can't load
// file:// URLs (blocked as cross-origin from a worker whose own origin doesn't match — see
// BUILD CHECKLIST.md), and its corePath/langPath resolution logic (getCore.js: a hardcoded
// `.slice(-2) === 'js'` filename check, plus string-concatenation for langPath) only works with
// real path-structured URLs, ruling out blob: URLs too. A privileged custom scheme is Electron's
// own documented mechanism for exactly this — serves the 4 bundled OCR assets from a real,
// worker/fetch-accessible origin, with no new file-open surface (only these 4 whitelisted names
// are ever served; everything else 404s).
export const OCR_SCHEME = 'sarang-ocr'

const OCR_ASSET_WHITELIST = new Set([
  'worker.min.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'eng.traineddata.gz'
])

// Must run before app.whenReady() / any other Electron API — this is a module-level call by
// Electron's own design, so this file must be imported at the very top of main/index.ts.
protocol.registerSchemesAsPrivileged([
  { scheme: OCR_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
])

function ocrAssetsDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'ocr') : join(__dirname, '../../resources/ocr')
}

export function registerOcrProtocolHandler(): void {
  protocol.handle(OCR_SCHEME, (request) => {
    const filename = new URL(request.url).pathname.replace(/^\/+/, '')
    if (!OCR_ASSET_WHITELIST.has(filename)) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(join(ocrAssetsDir(), filename)).href)
  })
}
