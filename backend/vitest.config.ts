import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Service tests share one Postgres database and truncate between
    // tests, so they must not run concurrently.
    fileParallelism: false,
  },
})
