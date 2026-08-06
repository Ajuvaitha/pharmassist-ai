import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from './test/helpers'
import { getTestPrisma, resetDatabase } from './test/db'
import { AppError } from './errors'

let app: FastifyInstance

beforeEach(async () => {
  await resetDatabase(getTestPrisma())
  app = await buildTestApp()
})

afterAll(async () => {
  await app?.close()
})

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', database: 'up' })
  })
})

describe('error envelope', () => {
  it('renders an unknown route as a NOT_FOUND envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/nope' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      success: false,
      error: 'NOT_FOUND',
      message: 'Route GET /api/nope not found',
    })
  })

  it('renders a thrown AppError with its code and status', async () => {
    const withBoom = await buildTestApp(async (instance) => {
      instance.get('/api/boom', async () => {
        throw AppError.invalidInput('daily_dosage_qty must be greater than 0')
      })
    })

    const response = await withBoom.inject({ method: 'GET', url: '/api/boom' })
    await withBoom.close()

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      success: false,
      error: 'INVALID_INPUT',
      message: 'daily_dosage_qty must be greater than 0',
    })
  })

  it('hides the detail of an unexpected error behind INTERNAL_ERROR', async () => {
    const withExplode = await buildTestApp(async (instance) => {
      instance.get('/api/explode', async () => {
        throw new Error('connection string leaked postgres://user:hunter2@host')
      })
    })

    const response = await withExplode.inject({ method: 'GET', url: '/api/explode' })
    await withExplode.close()

    expect(response.statusCode).toBe(500)
    expect(response.json().error).toBe('INTERNAL_ERROR')
    expect(response.json().message).not.toContain('hunter2')
  })
})
