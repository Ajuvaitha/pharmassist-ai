import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { buildTestApp } from '../../test/helpers'

const prisma = getTestPrisma()
let app: FastifyInstance

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
  app = await buildTestApp()
})

afterEach(async () => {
  await app.close()
})

async function loginCookie(username: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password: 'pharmassist' },
  })
  const cookie = res.cookies[0]
  return { [cookie.name]: cookie.value }
}

describe('GET /api/drugs/search', () => {
  it('returns ranked results for a query', async () => {
    const cookies = await loginCookie('b.kwame')

    const response = await app.inject({
      method: 'GET',
      url: '/api/drugs/search?q=aspir',
      cookies,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json() as Array<{ name: string }>
    expect(body[0]?.name).toBe('Aspirin')
  })

  it('rejects a missing query with 400', async () => {
    const cookies = await loginCookie('b.kwame')

    const response = await app.inject({
      method: 'GET',
      url: '/api/drugs/search',
      cookies,
    })

    expect(response.statusCode).toBe(400)
  })
})

describe('GET /api/drugs (no search)', () => {
  it('returns only stocked drugs', async () => {
    const cookies = await loginCookie('b.kwame')

    const response = await app.inject({
      method: 'GET',
      url: '/api/drugs',
      cookies,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json() as Array<{ label: string }>
    // The seed stocks at most 16 curated drugs via INVENTORY.
    expect(body.length).toBeLessThanOrEqual(16)
  })
})
