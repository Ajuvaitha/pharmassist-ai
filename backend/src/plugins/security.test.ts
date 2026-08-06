import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../test/db'
import { buildTestApp } from '../test/helpers'

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

function login(payload: { username: string; password: string }) {
  return app.inject({ method: 'POST', url: '/api/auth/login', payload })
}

describe('login rate limiting', () => {
  it('permits a normal number of attempts', async () => {
    const first = await login({ username: 'k.asante', password: 'pharmassist' })
    expect(first.statusCode).toBe(200)
  })

  it('throttles repeated failed attempts from one caller', async () => {
    const statuses: number[] = []
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await login({ username: 'k.asante', password: 'wrong' })
      statuses.push(response.statusCode)
    }

    // Early attempts are ordinary auth failures; later ones must be throttled.
    expect(statuses[0]).toBe(401)
    expect(statuses).toContain(429)
  })

  it('returns the error envelope when throttled, not a bare Fastify error', async () => {
    let throttled: Awaited<ReturnType<typeof login>> | null = null
    for (let attempt = 0; attempt < 12 && !throttled; attempt += 1) {
      const response = await login({ username: 'k.asante', password: 'wrong' })
      if (response.statusCode === 429) throttled = response
    }

    expect(throttled).not.toBeNull()
    expect(throttled?.json()).toMatchObject({ success: false })
  })

  it('does not throttle ordinary reads', async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await app.inject({ method: 'GET', url: '/api/health' })
      expect(response.statusCode).toBe(200)
    }
  })
})
