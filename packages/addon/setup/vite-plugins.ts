import { readFileSync } from 'node:fs'
import { createDefaultAgent } from '@better-slide/agents'
import { locateLine } from '@better-slide/review'
import { createApp, createMiddleware } from '@better-slide/server'
import type { Plugin } from 'vite'

interface SlidevOptions {
  userRoot: string
  data: { slides: { source: { filepath: string; content: string } }[] }
}

export default function setupVitePlugins(options: SlidevOptions): Plugin[] {
  const locate = (slide: number, text: string) => {
    const source = options.data.slides[slide - 1]?.source
    if (!source) return undefined
    try {
      return locateLine(readFileSync(source.filepath, 'utf8'), source.content, text)
    } catch {
      return undefined
    }
  }
  const app = createApp({ agent: createDefaultAgent(), cwd: options.userRoot, locate })
  return [
    {
      name: 'better-slide:server',
      configureServer(server) {
        server.middlewares.use(createMiddleware(app))
      },
    },
  ]
}
