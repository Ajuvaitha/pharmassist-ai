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

  it('rejects a same-drug batch that would drive stock negative, and commits nothing', async () => {
    const patient = await margaret()
    const wardId = (await ward4a()).id
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })
    const prescriber = await prisma.user.findUniqueOrThrow({ where: { username: 'b.kwame' } })

    // A second active prescription for the SAME drug, on a different
    // startDate — allowed by the (patientId, drugId, startDate) unique
    // constraint — that is also due today. Re-running the sweep folds a
    // second indent line for it into today's already-swept indent,
    // alongside the existing Amoxicillin line from the seed.
    await prisma.prescription.create({
      data: {
        patientId: patient.id,
        drugId: drug.id,
        dose: '500mg',
        route: 'Oral',
        frequency: 'TDS',
        foodTiming: 'after_food',
        timeOfDay: ['morning', 'afternoon', 'night'],
        startDate: new Date('2026-08-01T00:00:00Z'),
        durationDays: 7,
        status: 'active',
        prescribedById: prescriber.id,
        prescribedAt: new Date('2026-08-01T08:00:00Z'),
      },
    })
    await runSweep(prisma, { date: DATE })

    const lines = await prisma.indentLine.findMany({
      where: { patientId: patient.id, drugId: drug.id, status: 'pending' },
    })
    expect(lines).toHaveLength(2) // one line per prescription, same drug
    const requiredTotal = lines.reduce((sum, line) => sum + line.qty, 0)
    expect(requiredTotal).toBeGreaterThan(0)

    // Stock enough for one line but not both.
    const oneLineQty = lines[0].qty
    await prisma.inventoryItem.update({
      where: { drugId: drug.id },
      data: { currentStock: oneLineQty },
    })

    const otherDrug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Metformin 500mg' } })
    const otherBefore = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: otherDrug.id } })

    const error = await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId, date: DATE,
    }).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('INSUFFICIENT_STOCK')

    // Nothing committed: the Amoxicillin stock is untouched (never went
    // negative), the unrelated Metformin line is untouched, no billing
    // lines exist, and no line was marked dispensed.
    const amoxAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: drug.id } })
    expect(amoxAfter.currentStock).toBe(oneLineQty)

    const otherAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: otherDrug.id } })
    expect(otherAfter.currentStock).toBe(otherBefore.currentStock)

    expect(await prisma.billingLine.count()).toBe(0)
    expect(
      await prisma.indentLine.count({ where: { patientId: patient.id, status: 'dispensed' } }),
    ).toBe(0)
  })

  it('guards the decrement against a concurrent dispense for a different patient sharing a drug', async () => {
    // The previous test covers the INTRA-batch case (two lines for the
    // same drug inside one patient's dispense). This is the CROSS-
    // transaction case: two DIFFERENT patients, each with their own
    // transaction, both dispensing the same drug at once. Each
    // transaction's up-front check reads its own snapshot of stock, so
    // both can pass against the same starting balance — only a guard on
    // the write itself can stop the loser.
    const wardId = (await ward4a()).id
    const margaretPatient = await margaret()
    const james = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-003145' } })
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })
    const prescriber = await prisma.user.findUniqueOrThrow({ where: { username: 'b.kwame' } })

    // Give James an active Amoxicillin prescription due today too, so his
    // batch requires the same drug as Margaret's, independently.
    await prisma.prescription.create({
      data: {
        patientId: james.id,
        drugId: drug.id,
        dose: '500mg',
        route: 'Oral',
        frequency: 'TDS',
        foodTiming: 'after_food',
        timeOfDay: ['morning', 'afternoon', 'night'],
        startDate: new Date('2026-08-01T00:00:00Z'),
        durationDays: 7,
        status: 'active',
        prescribedById: prescriber.id,
        prescribedAt: new Date('2026-08-01T08:00:00Z'),
      },
    })
    await runSweep(prisma, { date: DATE })

    const margaretLine = await prisma.indentLine.findFirstOrThrow({
      where: { patientId: margaretPatient.id, drugId: drug.id, status: 'pending' },
    })
    const jamesLine = await prisma.indentLine.findFirstOrThrow({
      where: { patientId: james.id, drugId: drug.id, status: 'pending' },
    })
    expect(jamesLine.qty).toBe(margaretLine.qty) // both TDS, same requirement

    // Exactly enough for ONE batch, not both.
    await prisma.inventoryItem.update({
      where: { drugId: drug.id },
      data: { currentStock: margaretLine.qty },
    })

    const viewer = await viewerFor('k.asante')
    const outcomes = await Promise.allSettled([
      dispense(prisma, viewer, { patientId: margaretPatient.id, wardId, date: DATE }),
      dispense(prisma, viewer, { patientId: james.id, wardId, date: DATE }),
    ])

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled')
    const rejected = outcomes.filter((o) => o.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const rejection = rejected[0] as PromiseRejectedResult
    expect(rejection.reason).toBeInstanceOf(AppError)
    expect((rejection.reason as AppError).code).toBe('INSUFFICIENT_STOCK')

    // The write-time guard, not the up-front snapshot check, is what
    // stopped the loser — stock must land at exactly zero, never negative.
    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: drug.id } })
    expect(after.currentStock).toBe(0)
    expect(after.currentStock).toBeGreaterThanOrEqual(0)
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
