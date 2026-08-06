import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { runSweep } from './service'

const prisma = getTestPrisma()

/** Margaret Osei's Amoxicillin TDS runs 2026-07-29 for 7 days. */
const DURING_COURSE = new Date('2026-08-03T00:00:00Z')

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('runSweep', () => {
  it('creates one indent per ward for the date', async () => {
    const result = await runSweep(prisma, { date: DURING_COURSE })

    expect(result.date).toBe('2026-08-03')
    expect(result.wards).toHaveLength(4)
    expect(await prisma.dailyIndent.count()).toBe(4)
  })

  it('sets quantity from the dosing frequency', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const line = await prisma.indentLine.findFirstOrThrow({
      where: { drug: { label: 'Amoxicillin 500mg' } },
    })
    // TDS = three doses a day.
    expect(line.qty).toBe(3)
  })

  it('records the treatment day', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const line = await prisma.indentLine.findFirstOrThrow({
      where: { drug: { label: 'Amoxicillin 500mg' } },
    })
    // Started 2026-07-29; 2026-08-03 is day 6.
    expect(line.treatmentDay).toBe(6)
  })

  it('is idempotent — a second run adds nothing', async () => {
    await runSweep(prisma, { date: DURING_COURSE })
    const first = await prisma.indentLine.count()

    await runSweep(prisma, { date: DURING_COURSE })
    expect(await prisma.indentLine.count()).toBe(first)
    expect(await prisma.dailyIndent.count()).toBe(4)
  })

  it('excludes a stopped prescription', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const digoxin = await prisma.indentLine.findFirst({
      where: { drug: { label: 'Digoxin 0.25mg' } },
    })
    expect(digoxin).toBeNull()
  })

  it('excludes a prescription whose course has elapsed', async () => {
    // Amoxicillin: 2026-07-29 + 7 days, so day 8 is out of range.
    await runSweep(prisma, { date: new Date('2026-08-05T00:00:00Z') })

    const line = await prisma.indentLine.findFirst({
      where: { drug: { label: 'Amoxicillin 500mg' } },
    })
    expect(line).toBeNull()
  })

  it('excludes a prescription that has not started', async () => {
    // Amoxicillin starts 2026-07-29; the day before, it must not appear.
    // (Not asserted as a global zero count: Esi Mensah's chemo regimen
    // started 2026-07-20 and is legitimately mid-course on 2026-07-28.)
    await runSweep(prisma, { date: new Date('2026-07-28T00:00:00Z') })

    const line = await prisma.indentLine.findFirst({
      where: { drug: { label: 'Amoxicillin 500mg' } },
    })
    expect(line).toBeNull()
  })

  it('never generates a line for a PRN or STAT prescription', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Ibuprofen 400mg' } })
    const prescriber = await prisma.user.findUniqueOrThrow({ where: { username: 'b.kwame' } })

    for (const frequency of ['PRN', 'STAT'] as const) {
      await prisma.prescription.create({
        data: {
          patientId: patient.id,
          drugId: drug.id,
          dose: '400mg',
          route: 'Oral',
          frequency,
          foodTiming: 'after_food',
          timeOfDay: ['morning'],
          startDate: new Date(frequency === 'PRN' ? '2026-08-02' : '2026-08-01'),
          durationDays: 10,
          prescribedById: prescriber.id,
        },
      })
    }

    await runSweep(prisma, { date: DURING_COURSE })

    const lines = await prisma.indentLine.findMany({
      where: { prescription: { frequency: { in: ['PRN', 'STAT'] } } },
    })
    expect(lines).toHaveLength(0)
  })

  it('generates a Weekly line only on its due day', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Dexamethasone 4mg' } })
    const prescriber = await prisma.user.findUniqueOrThrow({ where: { username: 'b.kwame' } })

    await prisma.prescription.create({
      data: {
        patientId: patient.id, drugId: drug.id, dose: '4mg', route: 'Oral',
        frequency: 'Weekly', foodTiming: 'after_food', timeOfDay: ['morning'],
        startDate: new Date('2026-08-03'), durationDays: 28,
        prescribedById: prescriber.id,
      },
    })

    await runSweep(prisma, { date: new Date('2026-08-03T00:00:00Z') })
    expect(await prisma.indentLine.count({ where: { drug: { label: 'Dexamethasone 4mg' }, prescription: { frequency: 'Weekly' } } })).toBe(1)

    await runSweep(prisma, { date: new Date('2026-08-04T00:00:00Z') })
    const onTheFourth = await prisma.indentLine.count({
      where: {
        prescription: { frequency: 'Weekly' },
        indent: { indentDate: new Date('2026-08-04T00:00:00Z') },
      },
    })
    expect(onTheFourth).toBe(0)
  })

  it('excludes a discharged patient', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    await prisma.patient.update({ where: { id: patient.id }, data: { status: 'discharged' } })

    await runSweep(prisma, { date: DURING_COURSE })

    expect(await prisma.indentLine.count({ where: { patientId: patient.id } })).toBe(0)
  })

  it('can sweep a single ward', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    const result = await runSweep(prisma, { date: DURING_COURSE, wardId: ward.id })

    expect(result.wards).toHaveLength(1)
    expect(await prisma.dailyIndent.count()).toBe(1)
  })

  it('writes nothing in preview mode but still reports the counts', async () => {
    const result = await runSweep(prisma, { date: DURING_COURSE, preview: true })

    expect(result.preview).toBe(true)
    expect(result.wards.some((w) => w.lineCount > 0)).toBe(true)
    expect(await prisma.dailyIndent.count()).toBe(0)
    expect(await prisma.indentLine.count()).toBe(0)
  })

  it('marks a swept indent as swept', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const indent = await prisma.dailyIndent.findFirstOrThrow({ where: { ward: { code: 'Ward 4A' } } })
    expect(indent.status).toBe('swept')
  })
})
