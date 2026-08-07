import { beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../test/db'
import { buildTestApp } from '../test/helpers'

const prisma = getTestPrisma()

beforeAll(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('app.drugSearch', () => {
  it('finds a curated drug by prefix after boot', async () => {
    const app = await buildTestApp()
    try {
      const results = app.drugSearch.search('aspir', 5)
      expect(results[0]?.name).toBe('Aspirin')
    } finally {
      await app.close()
    }
  })
})
