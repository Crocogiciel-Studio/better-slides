import { createMiddleware } from '@better-slide/server'
import type { Plugin } from 'vite'

export default function setupVitePlugins(): Plugin[] {
  return [
    {
      name: 'better-slide:server',
      configureServer(server) {
        server.middlewares.use(createMiddleware())
      },
    },
  ]
}
