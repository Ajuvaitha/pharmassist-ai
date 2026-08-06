import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
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

function login(username: string, password = 'pharmassist') {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  })
}

describe('POST /api/auth/login', () => {
  it('returns the session user and sets an httpOnly cookie', async () => {
    const response = await login('k.asante')

    expect(response.statusCode).toBe(200)
    expect(response.json().user).toMatchObject({
      username: 'k.asante',
      displayName: 'K. Asante',
      role: 'pharmacist',
    })

    const cookie = response.cookies.find((c) => c.name === 'pharmassist_session')
    expect(cookie).toBeDefined()
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite?.toLowerCase()).toBe('lax')
    expect(cookie?.path).toBe('/')
  })

  it('never puts the token anywhere but the cookie', async () => {
    const response = await login('k.asante')
    expect(response.body).not.toContain('eyJ')
  })

  it('rejects a wrong password with AUTH_EXPIRED', async () => {
    const response = await login('k.asante', 'wrong')

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('AUTH_EXPIRED')
  })

  it('rejects a malformed body with INVALID_INPUT', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('INVALID_INPUT')
  })

  it('ignores any role supplied in the request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'a.owusu', password: 'pharmassist', role: 'pharmacist' },
    })

    expect(response.json().user.role).toBe('nurse')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the session user when a valid cookie is present', async () => {
    const cookie = (await login('a.owusu')).cookies[0]

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { [cookie.name]: cookie.value },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().user.ward.label).toBe('Ward 4A — General Medicine')
  })

  it('returns AUTH_EXPIRED without a cookie', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('AUTH_EXPIRED')
  })

  it('returns AUTH_EXPIRED for a forged cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { pharmassist_session: 'not.a.real.token' },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const cookie = (await login('k.asante')).cookies[0]

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { [cookie.name]: cookie.value },
    })

    expect(response.statusCode).toBe(200)
    const cleared = response.cookies.find((c) => c.name === 'pharmassist_session')
    expect(cleared?.value).toBe('')
  })
})

describe('requireRole', () => {
  // Routes are passed to the builder because Fastify runs plugins at
  // ready(): app.requireRole does not exist before then, and routes
  // cannot be added after.
  const guardedRoute: FastifyPluginAsync = async (instance) => {
    instance.get(
      '/api/only-pharmacists',
      { preHandler: [instance.authenticate, instance.requireRole('pharmacist')] },
      async () => ({ ok: true }),
    )
  }

  it('allows a role on the list', async () => {
    const guarded = await buildTestApp(guardedRoute)
    const cookie = (await guarded.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'k.asante', password: 'pharmassist' },
    })).cookies[0]

    const response = await guarded.inject({
      method: 'GET',
      url: '/api/only-pharmacists',
      cookies: { [cookie.name]: cookie.value },
    })
    await guarded.close()

    expect(response.statusCode).toBe(200)
  })

  it('rejects a role not on the list with FORBIDDEN', async () => {
    const guarded = await buildTestApp(guardedRoute)
    const cookie = (await guarded.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'a.owusu', password: 'pharmassist' },
    })).cookies[0]

    const response = await guarded.inject({
      method: 'GET',
      url: '/api/only-pharmacists',
      cookies: { [cookie.name]: cookie.value },
    })
    await guarded.close()

    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('FORBIDDEN')
  })

  it('fails closed with AUTH_EXPIRED when registered without the authenticate preHandler', async () => {
    const misconfiguredRoute: FastifyPluginAsync = async (instance) => {
      instance.get(
        '/api/misconfigured-only-pharmacists',
        { preHandler: [instance.requireRole('pharmacist')] },
        async () => ({ ok: true }),
      )
    }

    const guarded = await buildTestApp(misconfiguredRoute)

    const response = await guarded.inject({
      method: 'GET',
      url: '/api/misconfigured-only-pharmacists',
    })
    await guarded.close()

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('AUTH_EXPIRED')
  })
})
