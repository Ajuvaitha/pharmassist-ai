import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { createPatient, getPatient, listPatients } from './service'
import type { SessionUser } from '@pharmassist/shared'
import { ErrorCode } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('listPatients', () => {
  it('returns all patients for a pharmacist', async () => {
    const patients = await listPatients(prisma, await viewerFor('k.asante'), {})
    expect(patients).toHaveLength(5)
  })

  it('returns only ward patients for a nurse', async () => {
    const patients = await listPatients(prisma, await viewerFor('a.owusu'), {})
    expect(patients).toHaveLength(2)
    expect(patients.every((p) => p.ward === 'Ward 4A')).toBe(true)
  })

  it('searches by name, MRN and bed', async () => {
    const viewer = await viewerFor('k.asante')
    expect((await listPatients(prisma, viewer, { search: 'margaret' }))[0].name).toBe('Margaret Osei')
    expect((await listPatients(prisma, viewer, { search: 'MRN-003145' }))[0].name).toBe('James Kofi Antwi')
    expect((await listPatients(prisma, viewer, { search: 'Bed 12' }))[0].name).toBe('Abena Frimpong')
  })

  it('includes prescriptions with derived currentDay and wire-format foodTiming', async () => {
    const patients = await listPatients(prisma, await viewerFor('k.asante'), {})
    const margaret = patients.find((p) => p.name === 'Margaret Osei')
    const amox = margaret?.prescriptions.find((rx) => rx.drug === 'Amoxicillin 500mg')

    expect(amox?.foodTiming).toBe('after-food')
    expect(amox?.currentDay).toBeGreaterThan(0)
    expect(amox?.prescribedBy).toBe('Dr. B. Kwame')
  })

  it('rejects a nurse asking for another ward', async () => {
    const otherWard = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 5B' } })
    const error = await listPatients(prisma, await viewerFor('a.owusu'), { wardId: otherWard.id }).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(403)
  })
})

describe('getPatient', () => {
  it('returns a patient by id', async () => {
    const [first] = await listPatients(prisma, await viewerFor('k.asante'), {})
    const found = await getPatient(prisma, await viewerFor('k.asante'), first.id)
    expect(found.id).toBe(first.id)
  })

  it('rejects an unknown id', async () => {
    await expect(getPatient(prisma, await viewerFor('k.asante'), 'nope'))
      .rejects.toBeInstanceOf(AppError)
  })

  it('denies a nurse a patient outside their ward, rather than pretending it is missing', async () => {
    const outsider = await prisma.patient.findFirstOrThrow({ where: { ward: { code: 'Ward 2D' } } })
    const error = await getPatient(prisma, await viewerFor('a.owusu'), outsider.id).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(403)
  })
})

describe('createPatient', () => {
  const input = {
    name: 'Ama Boateng',
    dateOfBirth: '1990-04-11',
    gender: 'Female' as const,
    phone: '+233 24 111 2222',
    wardId: '',
    bed: 'Bed 15',
    admissionDate: '2026-08-06',
    diagnosis: 'Observation',
    allergies: 'None known',
  }

  it('creates a patient with a generated MRN and no prescriptions', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    const created = await createPatient(prisma, await viewerFor('a.owusu'), { ...input, wardId: ward.id })

    expect(created.name).toBe('Ama Boateng')
    expect(created.mrn).toMatch(/^MRN-\d{6}$/)
    expect(created.status).toBe('admitted')
    expect(created.prescriptions).toEqual([])
  })

  it('allocates a distinct MRN each time', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    const viewer = await viewerFor('a.owusu')
    const a = await createPatient(prisma, viewer, { ...input, wardId: ward.id })
    const b = await createPatient(prisma, viewer, { ...input, name: 'Kofi Mensah', wardId: ward.id })

    expect(a.mrn).not.toBe(b.mrn)
  })

  it('records a register activity event', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    await createPatient(prisma, await viewerFor('a.owusu'), { ...input, wardId: ward.id })

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'register' } })
    expect(event.text).toContain('Ama Boateng')
  })

  it('denies a nurse registering into another ward', async () => {
    const other = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 6C' } })
    const error = await createPatient(prisma, await viewerFor('a.owusu'), { ...input, wardId: other.id }).catch(
      (e) => e,
    )

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(403)
  })

  it('labels a concurrent MRN collision as a conflict instead of surfacing a raw 500', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })

    // nextMrn() formats MRN-<count+1>. Occupy the MRN that the upcoming
    // createPatient call will compute, so its insert collides on the
    // unique `mrn` column exactly as a second concurrent caller would.
    const count = await prisma.patient.count()
    const collidingMrn = `MRN-${String(count + 2).padStart(6, '0')}`
    await prisma.patient.create({
      data: {
        mrn: collidingMrn,
        name: 'Placeholder Patient',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Female',
        phone: '+233 20 000 0000',
        wardId: ward.id,
        bed: 'Bed 99',
        admissionDate: new Date('2026-08-06'),
        diagnosis: 'n/a',
        allergies: 'n/a',
      },
    })

    const error = await createPatient(prisma, await viewerFor('a.owusu'), { ...input, wardId: ward.id }).catch(
      (e) => e,
    )

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(409)
    expect(error.code).toBe(ErrorCode.DATABASE_ERROR)
    expect(error.message).toMatch(/concurrently|retry/i)
  })
})
