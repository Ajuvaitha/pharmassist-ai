import type { PrismaClient } from '@prisma/client'
import {
  dosesPerDay,
  isDueOn,
  isSweepable,
  type SweepResult,
  type SweepWardResult,
} from '@pharmassist/shared'
import { startOfUtcDay, toDateString, treatmentDayFor } from '../../domain/dates'
import { AppError } from '../../errors'

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
 * Decides which of the given prescriptions are due on a date: sweepable
 * frequency, due today per its schedule, and within its treatment-day
 * window. Pure given its inputs — the scheduled job and the manual
 * endpoint both go through here, so a re-trigger cannot diverge from the
 * 06:00 run.
 *
 * This is NOT the complete inclusion rule. `status === 'active'` on the
 * prescription and `admitted` on the patient are enforced only by the
 * Prisma `where` in runSweep, before prescriptions ever reach this
 * function. Callers must pass in already-filtered prescriptions — this
 * function does not, and cannot, re-check status or admission itself.
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
  // indentDate is a @db.Date column; a caller-supplied date (e.g. parsed
  // from a query parameter) must be normalised before it reaches an
  // upsert where-clause or a create, not left to whatever the driver does
  // with the time component.
  const date = startOfUtcDay(opts.date ?? new Date())
  const preview = opts.preview ?? false

  const wards = await prisma.ward.findMany({
    where: opts.wardId ? { id: opts.wardId } : {},
    orderBy: { code: 'asc' },
  })

  if (opts.wardId && wards.length === 0) {
    throw AppError.notFound(`No ward found with id ${opts.wardId}`)
  }

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
      // Read-only: report the real indent if one already exists for this
      // ward and date, rather than hardcoding pending/null and lying
      // about an already-dispensed day.
      const existing = await prisma.dailyIndent.findUnique({
        where: { wardId_indentDate: { wardId: ward.id, indentDate: date } },
      })
      results.push({
        wardId: ward.id,
        wardCode: ward.code,
        indentId: existing?.id ?? null,
        lineCount: planned.length,
        patientCount,
        status: existing?.status ?? 'pending',
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

    // A prescription written after the ward already collected its
    // medication for the day must not land in a closed indent.
    if (planned.length > 0 && indent.status !== 'dispensed') {
      await prisma.indentLine.createMany({
        data: planned.map((line) => ({ ...line, indentId: indent.id })),
        skipDuplicates: true,
      })
    }

    // An indent that produced lines has been swept. One already marked
    // dispensed is not walked backwards by a re-run — checked and set in
    // one atomic statement so a dispense landing between the upsert above
    // and this update cannot be overwritten by a stale read.
    await prisma.dailyIndent.updateMany({
      where: { id: indent.id, status: { not: 'dispensed' } },
      data: { status: 'swept' },
    })
    const updated = await prisma.dailyIndent.findUniqueOrThrow({ where: { id: indent.id } })

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
