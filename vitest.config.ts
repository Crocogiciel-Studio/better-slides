import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/components/**/*.test.ts', 'packages/*/e2e/**/*.e2e.test.ts'],
    environment: 'node',
  },
})
