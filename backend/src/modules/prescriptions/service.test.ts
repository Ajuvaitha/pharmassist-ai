import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { createPrescription, stopPrescription, updatePrescription } from './service'
import { listDrugs } from '../drugs/service'
import type { SessionUser } from '@pharmassist/shared'

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

describe('listDrugs', () => {
  it('returns the catalog with prices as numbers', async () => {
    const drugs = await listDrugs(prisma)
    expect(drugs).toHaveLength(15)

    const aspirin = drugs.find((d) => d.label === 'Aspirin 75mg')
    expect(aspirin?.unitPrice).toBe(0.12)
    expect(typeof aspirin?.unitPrice).toBe('number')
  })

  it('filters by search term', async () => {
    const drugs = await listDrugs(prisma, 'furos')
    expect(drugs).toHaveLength(1)
    expect(drugs[0].label).toBe('Furosemide 40mg')
  })
})

describe('createPrescription', () => {
  async function newRxInput() {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Ibuprofen 400mg' } })
    return {
      drugId: drug.id,
      dose: '400mg',
      route: 'Oral' as const,
      frequency: 'TDS' as const,
      foodTiming: 'after-food' as const,
      timeOfDay: ['morning' as const, 'night' as const],
      startDate: '2026-08-10',
      durationDays: 5,
      notes: 'With food.',
    }
  }

  it('creates a prescription linked to the real drug row', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const rx = await createPrescription(prisma, await viewerFor('b.kwame'), patient.id, await newRxInput())

    expect(rx.drug).toBe('Ibuprofen 400mg')
    expect(rx.status).toBe('active')
    expect(rx.prescribedBy).toBe('Dr. B. Kwame')
  })

  it('stores foodTiming translated to the Prisma enum, and returns it in wire form', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const rx = await createPrescription(prisma, await viewerFor('b.kwame'), patient.id, await newRxInput())

    expect(rx.foodTiming).toBe('after-food')
    const row = await prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } })
    expect(row.foodTiming).toBe('after_food')
  })

  it('rejects a drugId that is not in the catalog', async () => {
    const patient = await prisma.patient.findFirstOrThrow()
    const input = { ...(await newRxInput()), drugId: 'd-ibuprofen-400mg' }

    await expect(createPrescription(prisma, await viewerFor('b.kwame'), patient.id, input))
      .rejects.toBeInstanceOf(AppError)
  })

  it('records a prescription activity event', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    await createPrescription(prisma, await viewerFor('b.kwame'), patient.id, await newRxInput())

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'prescription' } })
    expect(event.text).toContain('Ibuprofen 400mg')
  })
})

describe('updatePrescription', () => {
  it('applies a partial change', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'active' } })
    const updated = await updatePrescription(prisma, await viewerFor('b.kwame'), rx.id, { durationDays: 21 })
    expect(updated.durationDays).toBe(21)
  })

  it('refuses to edit a stopped prescription', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'stopped' } })
    await expect(updatePrescription(prisma, await viewerFor('b.kwame'), rx.id, { durationDays: 3 }))
      .rejects.toBeInstanceOf(AppError)
  })
})

describe('stopPrescription', () => {
  it('marks the prescription stopped with its reason and prescriber', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'active' } })
    const stopped = await stopPrescription(prisma, await viewerFor('b.kwame'), rx.id, 'Adverse reaction')

    expect(stopped.status).toBe('stopped')
    expect(stopped.stopReason).toBe('Adverse reaction')

    const row = await prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } })
    expect(row.stoppedAt).not.toBeNull()
    expect(row.stoppedById).not.toBeNull()
  })

  it('rejects stopping an already-stopped prescription', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'stopped' } })
    await expect(stopPrescription(prisma, await viewerFor('b.kwame'), rx.id, 'Again'))
      .rejects.toBeInstanceOf(AppError)
  })

  it('records a stop activity event carrying the reason', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'active' } })
    await stopPrescription(prisma, await viewerFor('b.kwame'), rx.id, 'Toxicity suspected')

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'stop' } })
    expect(event.text).toContain('Toxicity suspected')
  })
})
