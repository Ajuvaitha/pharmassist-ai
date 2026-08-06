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

describe('GET /api/wards/:id/pickup-list', () => {
  it('returns 400 INVALID_INPUT, not 500, for a calendar-impossible date', async () => {
    const cookies = await loginCookie('k.asante')
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })

    const response = await app.inject({
      method: 'GET',
      url: `/api/wards/${ward.id}/pickup-list?date=2026-13-01`,
      cookies,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('INVALID_INPUT')
  })
})
