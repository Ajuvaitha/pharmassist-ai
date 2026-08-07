import type { Prisma, PrismaClient } from '@prisma/client'
import type {
  CreatePrescriptionRequest,
  Prescription,
  SessionUser,
  UpdatePrescriptionRequest,
} from '@pharmassist/shared'
import { ErrorCode } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toFoodTimingEnum } from '../../domain/enums'
import { toPrescriptionDto } from '../../domain/dto'
import { parseIsoDate, todayUtc } from '../../domain/dates'
import { assertWardAccess } from '../../domain/scoping'
import { closeIndentIfComplete, enqueuePrescription } from '../indents/service'

const rxInclude = { drug: true, prescribedBy: true } satisfies Prisma.PrescriptionInclude

export async function createPrescription(
  prisma: PrismaClient,
  actor: SessionUser,
  patientId: string,
  input: CreatePrescriptionRequest,
): Promise<Prescription> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, include: { ward: true } })
  if (!patient) throw AppError.notFound(`No patient found with id ${patientId}`)
  assertWardAccess(actor, patient.wardId)

  // The browser used to invent ids like `d-ibuprofen-400mg`. Only a real
  // catalog row is acceptable; anything else would dangle.
  const drug = await prisma.drug.findUnique({ where: { id: input.drugId } })
  if (!drug) throw AppError.invalidInput(`No drug found with id ${input.drugId}`)

  const created = await prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.create({
      data: {
        patientId,
        drugId: drug.id,
        dose: input.dose,
        route: input.route,
        frequency: input.frequency,
        foodTiming: toFoodTimingEnum(input.foodTiming),
        timeOfDay: input.timeOfDay,
        startDate: parseIsoDate(input.startDate),
        durationDays: input.durationDays,
        notes: input.notes ?? null,
        prescribedById: actor.id,
      },
      include: rxInclude,
    })

    await tx.activityEvent.create({
      data: {
        type: 'prescription',
        patientId,
        wardId: patient.wardId,
        drugId: drug.id,
        actorId: actor.id,
        text: `New prescription: ${drug.label} ${input.frequency} — ${patient.name} (${patient.ward.code})`,
      },
    })

    return rx
  })

  // Post-commit, mirroring stopPrescription's closeIndentIfComplete: put the
  // new prescription on today's indent so the pharmacist sees it without a
  // manual sweep. Kept out of the transaction so a P2002 from a concurrent
  // sweep can be caught and re-read.
  await enqueuePrescription(
    prisma,
    {
      id: created.id,
      patientId: created.patientId,
      drugId: created.drugId,
      frequency: created.frequency,
      startDate: created.startDate,
      durationDays: created.durationDays,
      wardId: patient.wardId,
    },
  )

  return toPrescriptionDto(created)
}

export async function updatePrescription(
  prisma: PrismaClient,
  actor: SessionUser,
  id: string,
  input: UpdatePrescriptionRequest,
): Promise<Prescription> {
  const existing = await prisma.prescription.findUnique({
    where: { id },
    include: { patient: { include: { ward: true } } },
  })
  if (!existing) throw AppError.notFound(`No prescription found with id ${id}`, ErrorCode.RX_NOT_FOUND)
  assertWardAccess(actor, existing.patient.wardId)

  if (existing.status !== 'active') {
    throw AppError.conflict(ErrorCode.RX_NOT_ACTIVE, 'Only an active prescription can be edited')
  }

  if (input.drugId) {
    const drug = await prisma.drug.findUnique({ where: { id: input.drugId } })
    if (!drug) throw AppError.invalidInput(`No drug found with id ${input.drugId}`)
  }

  // Only the fields the caller actually sent describe what changed — an
  // absent field means "leave as is", not "set to nothing".
  const changedFields = (Object.keys(input) as (keyof UpdatePrescriptionRequest)[]).filter(
    (key) => input[key] !== undefined,
  )

  // A dose or frequency change is invisible to tomorrow's sweep and
  // dispense unless it is audited like its siblings createPrescription and
  // stopPrescription — both of which already wrap in a transaction and
  // write an ActivityEvent.
  const updated = await prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.update({
      where: { id },
      data: {
        ...(input.drugId ? { drugId: input.drugId } : {}),
        ...(input.dose ? { dose: input.dose } : {}),
        ...(input.route ? { route: input.route } : {}),
        ...(input.frequency ? { frequency: input.frequency } : {}),
        ...(input.foodTiming ? { foodTiming: toFoodTimingEnum(input.foodTiming) } : {}),
        ...(input.timeOfDay ? { timeOfDay: input.timeOfDay } : {}),
        ...(input.startDate ? { startDate: parseIsoDate(input.startDate) } : {}),
        ...(input.durationDays ? { durationDays: input.durationDays } : {}),
        ...(input.notes === undefined ? {} : { notes: input.notes || null }),
      },
      include: rxInclude,
    })

    await tx.activityEvent.create({
      data: {
        type: 'prescription',
        patientId: existing.patientId,
        wardId: existing.patient.wardId,
        drugId: rx.drugId,
        actorId: actor.id,
        text: `Prescription updated (${changedFields.join(', ')}): ${rx.drug.label} — ${existing.patient.name} (${existing.patient.ward.code})`,
      },
    })

    return rx
  })

  return toPrescriptionDto(updated)
}

/**
 * Stopping cancels PENDING indent lines from today forward. Lines already
 * dispensed are never touched — the patient received the drug and owes
 * for it.
 */
export async function stopPrescription(
  prisma: PrismaClient,
  actor: SessionUser,
  id: string,
  reason: string,
): Promise<Prescription> {
  const existing = await prisma.prescription.findUnique({
    where: { id },
    include: { patient: { include: { ward: true } }, drug: true },
  })
  if (!existing) throw AppError.notFound(`No prescription found with id ${id}`, ErrorCode.RX_NOT_FOUND)
  assertWardAccess(actor, existing.patient.wardId)

  if (existing.status !== 'active') {
    throw AppError.conflict(ErrorCode.RX_NOT_ACTIVE, `Prescription ${id} is already ${existing.status}`)
  }

  const today = todayUtc()

  // Captured from inside the transaction so the post-commit completion
  // check (below) knows which indents to re-count. A stop order can cancel
  // pending lines spread across several days' indents, unlike dispense
  // which only ever touches one.
  let affectedIndentIds: string[] = []

  const updated = await prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.update({
      where: { id },
      data: {
        status: 'stopped',
        stopReason: reason,
        stoppedAt: new Date(),
        stoppedById: actor.id,
      },
      include: rxInclude,
    })

    const cancellable = {
      prescriptionId: id,
      status: 'pending' as const,
      indent: { indentDate: { gte: today } },
    }

    const affectedLines = await tx.indentLine.findMany({
      where: cancellable,
      select: { indentId: true },
    })
    affectedIndentIds = [...new Set(affectedLines.map((line) => line.indentId))]

    await tx.indentLine.updateMany({
      where: cancellable,
      data: { status: 'cancelled' },
    })

    await tx.activityEvent.create({
      data: {
        type: 'stop',
        patientId: existing.patientId,
        wardId: existing.patient.wardId,
        drugId: existing.drugId,
        actorId: actor.id,
        text: `Stop order: ${existing.drug.label} — ${existing.patient.name} — ${reason}`,
      },
    })

    return rx
  })

  // Moved OUT of the transaction deliberately — see closeIndentIfComplete.
  // A stop order can be what cancels an indent's last pending line, just
  // as a dispense can be what fulfils it; either must be able to close it.
  for (const indentId of affectedIndentIds) {
    await closeIndentIfComplete(prisma, indentId)
  }

  return toPrescriptionDto(updated)
}
