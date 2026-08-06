import type { PrismaClient } from '@prisma/client'
import {
  dosesPerDay,
  isDueOn,
  isSweepable,
  type SweepResult,
  type SweepWardResult,
} from '@pharmassist/shared'
import { toDateString, todayUtc, treatmentDayFor } from '../../domain/dates'

export interface SweepOptions {
  date?: Date
  wardId?: string
  preview?: boolean
}

interface PlannedLine {
  prescriptionId: string
  patientId: string
  drugId: string
  qty: number
  treatmentDay: number
}

/**
 * Decides which prescriptions are due on a date. Pure given its inputs —
 * the scheduled job and the manual endpoint both go through here, so a
 * re-trigger cannot diverge from the 06:00 run.
 */
function planLinesFor(
  prescriptions: {
    id: string
    patientId: string
    drugId: string
    frequency: Parameters<typeof dosesPerDay>[0]
    startDate: Date
    durationDays: number
  }[],
  date: Date,
): PlannedLine[] {
  const planned: PlannedLine[] = []

  for (const rx of prescriptions) {
    // PRN is as-needed and STAT is a one-off; neither has a schedule the
    // sweep can act on.
    if (!isSweepable(rx.frequency)) continue
    if (!isDueOn(rx.frequency, rx.startDate, date)) continue

    const treatmentDay = treatmentDayFor(rx.startDate, date)
    if (treatmentDay < 1 || treatmentDay > rx.durationDays) continue

    planned.push({
      prescriptionId: rx.id,
      patientId: rx.patientId,
      drugId: rx.drugId,
      qty: dosesPerDay(rx.frequency),
      treatmentDay,
    })
  }

  return planned
}

export async function runSweep(prisma: PrismaClient, opts: SweepOptions = {}): Promise<SweepResult> {
  const date = opts.date ?? todayUtc()
  const preview = opts.preview ?? false

  const wards = await prisma.ward.findMany({
    where: opts.wardId ? { id: opts.wardId } : {},
    orderBy: { code: 'asc' },
  })

  const results: SweepWardResult[] = []

  for (const ward of wards) {
    const prescriptions = await prisma.prescription.findMany({
      where: {
        status: 'active',
        startDate: { lte: date },
        patient: { wardId: ward.id, status: 'admitted' },
      },
      select: {
        id: true,
        patientId: true,
        drugId: true,
        frequency: true,
        startDate: true,
        durationDays: true,
      },
    })

    const planned = planLinesFor(prescriptions, date)
    const patientCount = new Set(planned.map((line) => line.patientId)).size

    if (preview) {
      results.push({
        wardId: ward.id,
        wardCode: ward.code,
        indentId: null,
        lineCount: planned.length,
        patientCount,
        status: 'pending',
      })
      continue
    }

    // Unique (wardId, indentDate) makes this safe to re-run; unique
    // (indentId, prescriptionId) plus skipDuplicates makes the lines safe
    // too, without a read-then-write race.
    const indent = await prisma.dailyIndent.upsert({
      where: { wardId_indentDate: { wardId: ward.id, indentDate: date } },
      update: {},
      create: { wardId: ward.id, indentDate: date, status: 'pending' },
    })

    if (planned.length > 0) {
      await prisma.indentLine.createMany({
        data: planned.map((line) => ({ ...line, indentId: indent.id })),
        skipDuplicates: true,
      })
    }

    const updated = await prisma.dailyIndent.update({
      where: { id: indent.id },
      // An indent that produced lines has been swept. One already marked
      // dispensed is not walked backwards by a re-run.
      data: indent.status === 'dispensed' ? {} : { status: 'swept' },
    })

    results.push({
      wardId: ward.id,
      wardCode: ward.code,
      indentId: indent.id,
      lineCount: await prisma.indentLine.count({ where: { indentId: indent.id } }),
      patientCount,
      status: updated.status,
    })
  }

  return { date: toDateString(date), preview, wards: results }
}
