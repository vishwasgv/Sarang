import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    define: {
      'process.env.SARANG_LICENSE_HMAC_SECRET': JSON.stringify(
        process.env.SARANG_LICENSE_HMAC_SECRET || 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP'
      ),
      'process.env.SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM': JSON.stringify(
        process.env.SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM || ''
      )
    },
    build: {
      rollupOptions: {
        external: ['@prisma/client', 'bcryptjs', 'qrcode', 'xlsx']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@money': resolve('src/shared/utils/money.ts'),
        '@gst': resolve('src/shared/utils/gst-presentation.ts'),
        '@taxpresets': resolve('src/shared/data/tax-presets.ts'),
        '@tds': resolve('src/shared/data/tds-sections.ts'),
        '@shared': resolve('src/renderer/src/shared'),
        '@modules': resolve('src/renderer/src/modules'),
        '@app': resolve('src/renderer/src/app'),
        '@assets': resolve('src/renderer/src/assets')
      }
    },
    plugins: [react()]
  }
})
