import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../test/db'
import { buildTestApp } from '../test/helpers'

/**
 * Sets a process.env var for the duration of `fn`, restoring the previous
 * value (or absence of it) afterward. loadEnv() reads process.env directly,
 * so this is the least invasive way to exercise a specific CORS_ORIGIN
 * without changing any production code path.
 */
async function withEnv<T>(key: string, value: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.env[key]
  process.env[key] = value
  try {
    return await fn()
  } finally {
    if (previous === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previous
    }
  }
}

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
    for (let attempt = 0; attempt < 22; attempt += 1) {
      const response = await login({ username: 'k.asante', password: 'wrong' })
      statuses.push(response.statusCode)
    }

    // Early attempts are ordinary auth failures; later ones must be throttled.
    expect(statuses[0]).toBe(401)
    expect(statuses).toContain(429)
  })

  it('returns the error envelope when throttled, not a bare Fastify error', async () => {
    let throttled: Awaited<ReturnType<typeof login>> | null = null
    for (let attempt = 0; attempt < 22 && !throttled; attempt += 1) {
      const response = await login({ username: 'k.asante', password: 'wrong' })
      if (response.statusCode === 429) throttled = response
    }

    expect(throttled).not.toBeNull()
    expect(throttled?.json()).toMatchObject({
      success: false,
      error: 'TOO_MANY_REQUESTS',
    })
  })

  it('does not throttle ordinary reads', async () => {
    for (let attempt = 0; attempt < 22; attempt += 1) {
      const response = await app.inject({ method: 'GET', url: '/api/health' })
      expect(response.statusCode).toBe(200)
    }
  })

  it('does not let one username lock out another', async () => {
    // Exhaust k.asante's bucket.
    let throttledAsante = false
    for (let attempt = 0; attempt < 22 && !throttledAsante; attempt += 1) {
      const response = await login({ username: 'k.asante', password: 'wrong' })
      throttledAsante = response.statusCode === 429
    }
    expect(throttledAsante).toBe(true)

    // A different username, from the same caller (app.inject shares one
    // source address), must still get an ordinary auth failure rather than
    // inheriting k.asante's exhausted bucket.
    const other = await login({ username: 'a-different-user', password: 'wrong' })
    expect(other.statusCode).not.toBe(429)
  })
})

describe('CORS allow-list', () => {
  it('echoes exactly the allowed origin, not a wildcard', async () => {
    await withEnv(
      'CORS_ORIGIN',
      'https://allowed.example',
      async () => {
        const corsApp = await buildTestApp()
        try {
          const response = await corsApp.inject({
            method: 'GET',
            url: '/api/health',
            headers: { origin: 'https://allowed.example' },
          })
          expect(response.headers['access-control-allow-origin']).toBe('https://allowed.example')
          expect(response.headers['access-control-allow-credentials']).toBe('true')
        } finally {
          await corsApp.close()
        }
      },
    )
  })

  it('sends no allow-origin header for an unlisted origin', async () => {
    await withEnv(
      'CORS_ORIGIN',
      'https://allowed.example',
      async () => {
        const corsApp = await buildTestApp()
        try {
          const response = await corsApp.inject({
            method: 'GET',
            url: '/api/health',
            headers: { origin: 'https://evil.example' },
          })
          expect(response.headers['access-control-allow-origin']).toBeUndefined()
        } finally {
          await corsApp.close()
        }
      },
    )
  })
})
