import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { authenticate, getSessionUser } from './service'

const prisma = getTestPrisma()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('authenticate', () => {
  it('returns the session user for correct credentials', async () => {
    const user = await authenticate(prisma, 'k.asante', 'pharmassist')

    expect(user.username).toBe('k.asante')
    expect(user.displayName).toBe('K. Asante')
    expect(user.role).toBe('pharmacist')
    expect(user.ward).toBeNull()
  })

  it('takes role from the database, not from the request', async () => {
    const doctor = await authenticate(prisma, 'b.kwame', 'pharmassist')
    expect(doctor.role).toBe('doctor')
  })

  it('includes the composed ward label for ward-scoped users', async () => {
    const nurse = await authenticate(prisma, 'a.owusu', 'pharmassist')

    expect(nurse.ward).toMatchObject({
      code: 'Ward 4A',
      name: 'General Medicine',
      label: 'Ward 4A — General Medicine',
    })
  })

  it('rejects a wrong password', async () => {
    await expect(authenticate(prisma, 'k.asante', 'wrong'))
      .rejects.toBeInstanceOf(AppError)
  })

  it('rejects an unknown username with the same error as a wrong password', async () => {
    const unknown = await authenticate(prisma, 'nobody', 'pharmassist').catch((e) => e)
    const wrongPassword = await authenticate(prisma, 'k.asante', 'wrong').catch((e) => e)

    expect(unknown.message).toBe(wrongPassword.message)
    expect(unknown.statusCode).toBe(401)
  })

  it('never exposes the password hash on the session user', async () => {
    const user = await authenticate(prisma, 'k.asante', 'pharmassist')
    expect(JSON.stringify(user)).not.toContain('argon2')
  })
})

describe('getSessionUser', () => {
  it('rebuilds the session user from an id', async () => {
    const authenticated = await authenticate(prisma, 'a.owusu', 'pharmassist')
    const rehydrated = await getSessionUser(prisma, authenticated.id)

    expect(rehydrated).toEqual(authenticated)
  })

  it('rejects an id that no longer exists', async () => {
    await expect(getSessionUser(prisma, 'missing-id'))
      .rejects.toBeInstanceOf(AppError)
  })
})
