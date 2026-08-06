import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { dispense, getPickupList, runSweep } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()
const DATE = new Date('2026-08-03T00:00:00Z')

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

async function ward4a() {
  return prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
}

async function margaret() {
  return prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
  await runSweep(prisma, { date: DATE })
})

describe('getPickupList', () => {
  it('groups lines by patient', async () => {
    const list = await getPickupList(prisma, await viewerFor('k.asante'), (await ward4a()).id, DATE)

    expect(list.wardCode).toBe('Ward 4A')
    expect(list.patients.length).toBeGreaterThan(0)
    expect(list.patients[0].medicines.length).toBeGreaterThan(0)
  })

  it('reports a patient as not dispensed before pickup', async () => {
    const list = await getPickupList(prisma, await viewerFor('k.asante'), (await ward4a()).id, DATE)
    expect(list.patients.every((p) => p.dispensed === false)).toBe(true)
  })

  it('denies a nurse another ward', async () => {
    const other = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 2D' } })
    await expect(getPickupList(prisma, await viewerFor('a.owusu'), other.id, DATE))
      .rejects.toBeInstanceOf(AppError)
  })
})

describe('dispense', () => {
  it('marks the lines dispensed and reports the total', async () => {
    const patient = await margaret()
    const result = await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    expect(result.lines).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)

    const remaining = await prisma.indentLine.count({ where: { patientId: patient.id, status: 'pending' } })
    expect(remaining).toBe(0)
  })

  it('deducts exactly the dispensed quantity from stock', async () => {
    const patient = await margaret()
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: drug.id } })

    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: drug.id } })
    expect(after.currentStock).toBe(before.currentStock - 3) // TDS
  })

  it('writes a stock movement linked to the indent line', async () => {
    const patient = await margaret()
    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { reason: 'dispense' } })
    expect(movement.delta).toBeLessThan(0)
    expect(movement.indentLineId).not.toBeNull()
  })

  it('creates pending billing lines with the price snapshotted at dispense time', async () => {
    const patient = await margaret()
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })

    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const line = await prisma.billingLine.findFirstOrThrow({ where: { drugId: drug.id } })
    expect(line.status).toBe('pending')
    expect(line.unitPrice.toString()).toBe('0.85')
    expect(line.total.toString()).toBe('2.55') // 3 x 0.85

    // A later catalog change must not rewrite billed history.
    await prisma.drug.update({ where: { id: drug.id }, data: { unitPrice: '9.99' } })
    const unchanged = await prisma.billingLine.findUniqueOrThrow({ where: { id: line.id } })
    expect(unchanged.unitPrice.toString()).toBe('0.85')
  })

  it('rejects a second dispense for the same patient and day', async () => {
    const patient = await margaret()
    const input = { patientId: patient.id, wardId: (await ward4a()).id, date: DATE }
    const viewer = await viewerFor('k.asante')

    await dispense(prisma, viewer, input)

    const error = await dispense(prisma, viewer, input).catch((e) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('BATCH_ALREADY_FULFILLED')
  })

  it('rolls back entirely when any line is short of stock', async () => {
    const patient = await margaret()
    const short = await prisma.drug.findUniqueOrThrow({ where: { label: 'Lisinopril 10mg' } })
    const other = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })

    await prisma.inventoryItem.update({ where: { drugId: short.id }, data: { currentStock: 0 } })
    const otherBefore = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: other.id } })

    const error = await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    }).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('INSUFFICIENT_STOCK')

    // Nothing at all committed.
    const otherAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: other.id } })
    expect(otherAfter.currentStock).toBe(otherBefore.currentStock)
    expect(await prisma.billingLine.count()).toBe(0)
    expect(await prisma.indentLine.count({ where: { patientId: patient.id, status: 'dispensed' } })).toBe(0)
  })

  it('rejects a patient with no pending lines for the day', async () => {
    const patient = await margaret()
    await expect(dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: new Date('2026-07-28T00:00:00Z'),
    })).rejects.toBeInstanceOf(AppError)
  })

  it('records a dispense activity event', async () => {
    const patient = await margaret()
    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'dispense' } })
    expect(event.text).toContain('Margaret Osei')
  })

  it('flips the ward indent to dispensed once every line is done', async () => {
    const wardId = (await ward4a()).id
    const viewer = await viewerFor('k.asante')
    const patients = await prisma.patient.findMany({ where: { wardId, status: 'admitted' } })

    for (const patient of patients) {
      const pending = await prisma.indentLine.count({ where: { patientId: patient.id, status: 'pending' } })
      if (pending > 0) await dispense(prisma, viewer, { patientId: patient.id, wardId, date: DATE })
    }

    const indent = await prisma.dailyIndent.findFirstOrThrow({ where: { wardId, indentDate: DATE } })
    expect(indent.status).toBe('dispensed')
  })

  it('shows the patient as dispensed in the pickup list afterwards', async () => {
    const patient = await margaret()
    const wardId = (await ward4a()).id
    await dispense(prisma, await viewerFor('k.asante'), { patientId: patient.id, wardId, date: DATE })

    const list = await getPickupList(prisma, await viewerFor('k.asante'), wardId, DATE)
    expect(list.patients.find((p) => p.patientId === patient.id)?.dispensed).toBe(true)
  })
})
