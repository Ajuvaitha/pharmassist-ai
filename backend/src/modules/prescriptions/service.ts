import type { Prisma, PrismaClient } from '@prisma/client'
import type {
  CreatePrescriptionRequest,
  Prescription,
  SessionUser,
  UpdatePrescriptionRequest,
} from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toFoodTimingEnum } from '../../domain/enums'
import { toPrescriptionDto } from '../../domain/dto'
import { todayUtc } from '../../domain/dates'
import { assertWardAccess } from '../patients/service'

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
        startDate: new Date(input.startDate),
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

  return toPrescriptionDto(created)
}

export async function updatePrescription(
  prisma: PrismaClient,
  actor: SessionUser,
  id: string,
  input: UpdatePrescriptionRequest,
): Promise<Prescription> {
  const existing = await prisma.prescription.findUnique({ where: { id }, include: { patient: true } })
  if (!existing) throw AppError.notFound(`No prescription found with id ${id}`, 'RX_NOT_FOUND')
  assertWardAccess(actor, existing.patient.wardId)

  if (existing.status !== 'active') {
    throw AppError.conflict('RX_NOT_FOUND', 'Only an active prescription can be edited')
  }

  if (input.drugId) {
    const drug = await prisma.drug.findUnique({ where: { id: input.drugId } })
    if (!drug) throw AppError.invalidInput(`No drug found with id ${input.drugId}`)
  }

  const updated = await prisma.prescription.update({
    where: { id },
    data: {
      ...(input.drugId ? { drugId: input.drugId } : {}),
      ...(input.dose ? { dose: input.dose } : {}),
      ...(input.route ? { route: input.route } : {}),
      ...(input.frequency ? { frequency: input.frequency } : {}),
      ...(input.foodTiming ? { foodTiming: toFoodTimingEnum(input.foodTiming) } : {}),
      ...(input.timeOfDay ? { timeOfDay: input.timeOfDay } : {}),
      ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
      ...(input.durationDays ? { durationDays: input.durationDays } : {}),
      ...(input.notes === undefined ? {} : { notes: input.notes || null }),
    },
    include: rxInclude,
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
  if (!existing) throw AppError.notFound(`No prescription found with id ${id}`, 'RX_NOT_FOUND')
  assertWardAccess(actor, existing.patient.wardId)

  if (existing.status !== 'active') {
    throw AppError.conflict('RX_NOT_FOUND', `Prescription ${id} is already ${existing.status}`)
  }

  const today = todayUtc()

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

    await tx.indentLine.updateMany({
      where: {
        prescriptionId: id,
        status: 'pending',
        indent: { indentDate: { gte: today } },
      },
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

  return toPrescriptionDto(updated)
}
