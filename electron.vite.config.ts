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
        '@shared': resolve('src/renderer/src/shared'),
        '@modules': resolve('src/renderer/src/modules'),
        '@app': resolve('src/renderer/src/app'),
        '@assets': resolve('src/renderer/src/assets')
      }
    },
    plugins: [react()]
  }
})
