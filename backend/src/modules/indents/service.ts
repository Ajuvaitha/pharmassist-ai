import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import {
  dosesPerDay,
  isDueOn,
  isSweepable,
  type DispenseRequest,
  type SessionUser,
  type SweepResult,
  type SweepWardResult,
  type WardPickupList,
} from '@pharmassist/shared'
import { ErrorCode } from '@pharmassist/shared'
import { startOfUtcDay, toDateString, todayUtc, treatmentDayFor } from '../../domain/dates'
import { AppError } from '../../errors'
import { decimalToNumber } from '../../domain/dto'
import { assertWardAccess } from '../patients/service'

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
    //
    // Prisma's upsert is NOT a single INSERT ... ON CONFLICT here — it
    // compiles to a SELECT followed by an INSERT (or UPDATE). Under
    // concurrent callers (the 06:00 scheduled job racing a pharmacist's
    // manual "Run sweep") two callers can both miss the SELECT and both
    // attempt the INSERT; the loser hits the unique constraint as a raw
    // P2002 instead of the upsert's usual "update" branch. No duplicate
    // row is ever created — the constraint holds — but left uncaught this
    // surfaces as an unhandled 500 for what is a benign "someone else
    // created it first". Catch it and re-read the row the winner created.
    const indent = await prisma.dailyIndent
      .upsert({
        where: { wardId_indentDate: { wardId: ward.id, indentDate: date } },
        update: {},
        create: { wardId: ward.id, indentDate: date, status: 'pending' },
      })
      .catch(async (error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return prisma.dailyIndent.findUniqueOrThrow({
            where: { wardId_indentDate: { wardId: ward.id, indentDate: date } },
          })
        }
        throw error
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

export async function getPickupList(
  prisma: PrismaClient,
  viewer: SessionUser,
  wardId: string,
  date: Date = todayUtc(),
): Promise<WardPickupList> {
  assertWardAccess(viewer, wardId)

  const ward = await prisma.ward.findUnique({ where: { id: wardId } })
  if (!ward) throw AppError.notFound(`No ward found with id ${wardId}`)

  const indent = await prisma.dailyIndent.findUnique({
    where: { wardId_indentDate: { wardId, indentDate: date } },
    include: {
      lines: {
        where: { status: { not: 'cancelled' } },
        include: { patient: true, drug: true, prescription: true },
        orderBy: [{ patient: { bed: 'asc' } }, { drug: { label: 'asc' } }],
      },
    },
  })

  if (!indent) {
    return { wardId, wardCode: ward.code, date: toDateString(date), status: 'pending', patients: [] }
  }

  const byPatient = new Map<string, WardPickupList['patients'][number]>()

  for (const line of indent.lines) {
    let entry = byPatient.get(line.patientId)
    if (!entry) {
      entry = {
        patientId: line.patientId,
        name: line.patient.name,
        mrn: line.patient.mrn,
        bed: line.patient.bed,
        medicines: [],
        dispensed: true,
      }
      byPatient.set(line.patientId, entry)
    }

    entry.medicines.push({
      lineId: line.id,
      drug: line.drug.label,
      dose: line.prescription.dose,
      route: line.prescription.route,
      qty: line.qty,
      treatmentDay: line.treatmentDay,
      durationDays: line.prescription.durationDays,
      status: line.status,
    })

    // A patient counts as dispensed only when every one of their lines is.
    if (line.status !== 'dispensed') entry.dispensed = false
  }

  return {
    wardId,
    wardCode: ward.code,
    date: toDateString(date),
    status: indent.status,
    patients: [...byPatient.values()],
  }
}

export interface DispenseResult {
  patientId: string
  lines: number
  total: number
}

/**
 * Moves stock and creates money in one all-or-nothing transaction.
 *
 * Stock is checked for every line BEFORE any write, so a shortfall on the
 * last line cannot leave the first few already deducted. The unit price is
 * snapshotted here rather than referenced, so a later catalog change
 * cannot rewrite what a patient was billed.
 */
export async function dispense(
  prisma: PrismaClient,
  actor: SessionUser,
  // DispenseRequest.date is the wire ISO-string; callers here (the route
  // and the tests) already hold a parsed Date, so this overrides that
  // field rather than intersecting with it — `DispenseRequest & { date?:
  // Date }` would otherwise demand a value that is simultaneously a
  // string and a Date, which nothing can satisfy.
  input: Omit<DispenseRequest, 'date'> & { date?: Date },
): Promise<DispenseResult> {
  const date = input.date ?? todayUtc()
  assertWardAccess(actor, input.wardId)

  return prisma.$transaction(async (tx) => {
    const lines = await tx.indentLine.findMany({
      where: {
        patientId: input.patientId,
        indent: { wardId: input.wardId, indentDate: date },
        status: { not: 'cancelled' },
      },
      include: { drug: { include: { inventoryItem: true } }, patient: { include: { ward: true } }, indent: true },
    })

    if (lines.length === 0) {
      throw AppError.notFound('No pending medication for that patient on that date')
    }

    const pending = lines.filter((line) => line.status === 'pending')
    if (pending.length === 0) {
      throw AppError.conflict(
        ErrorCode.BATCH_ALREADY_FULFILLED,
        `Medication for ${lines[0].patient.name} was already dispensed on ${toDateString(date)}`,
      )
    }

    // Check every line before writing any of them.
    for (const line of pending) {
      const stock = line.drug.inventoryItem
      if (!stock) {
        throw AppError.conflict(ErrorCode.INSUFFICIENT_STOCK, `${line.drug.label} has no inventory record`)
      }
      if (stock.currentStock < line.qty) {
        throw AppError.conflict(
          ErrorCode.INSUFFICIENT_STOCK,
          `${line.drug.label}: ${stock.currentStock} in stock, ${line.qty} required`,
        )
      }
    }

    let total = 0

    for (const line of pending) {
      await tx.inventoryItem.update({
        where: { drugId: line.drugId },
        data: { currentStock: { decrement: line.qty } },
      })

      await tx.stockMovement.create({
        data: {
          drugId: line.drugId,
          delta: -line.qty,
          reason: 'dispense',
          indentLineId: line.id,
          actorId: actor.id,
        },
      })

      await tx.indentLine.update({
        where: { id: line.id },
        data: { status: 'dispensed', dispensedById: actor.id, dispensedAt: new Date() },
      })

      const unitPrice = line.drug.unitPrice
      const lineTotal = unitPrice.mul(line.qty)
      total += decimalToNumber(lineTotal)

      await tx.billingLine.create({
        data: {
          indentLineId: line.id,
          patientId: line.patientId,
          wardId: input.wardId,
          drugId: line.drugId,
          qty: line.qty,
          unitPrice,
          total: lineTotal,
          status: 'pending',
        },
      })
    }

    const patient = pending[0].patient
    const summary = pending.map((line) => `${line.drug.label} × ${line.qty}`).join(' + ')

    await tx.activityEvent.create({
      data: {
        type: 'dispense',
        patientId: patient.id,
        wardId: input.wardId,
        drugId: pending[0].drugId,
        actorId: actor.id,
        text: `Dispensed ${summary} — ${patient.name} (${patient.ward.code})`,
      },
    })

    const stillOpen = await tx.indentLine.count({
      where: { indentId: pending[0].indentId, status: 'pending' },
    })

    if (stillOpen === 0) {
      await tx.dailyIndent.update({
        where: { id: pending[0].indentId },
        data: { status: 'dispensed' },
      })
    }

    return { patientId: input.patientId, lines: pending.length, total }
  })
}
