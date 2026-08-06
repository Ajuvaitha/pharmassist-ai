import type { Prisma, PrismaClient } from '@prisma/client'
import type { CreatePatientRequest, Patient, PatientListQuery, SessionUser } from '@pharmassist/shared'
import { ErrorCode } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toPatientDto } from '../../domain/dto'
import { todayUtc } from '../../domain/dates'

const patientInclude = {
  ward: true,
  prescriptions: {
    include: { drug: true, prescribedBy: true },
    orderBy: { prescribedAt: 'desc' },
  },
} satisfies Prisma.PatientInclude

/**
 * A nurse may only reach their own ward. Denying rather than filtering
 * matters: a filtered-empty result is indistinguishable from "no such
 * patient", and a 404 would leak whether the record exists.
 */
export function assertWardAccess(viewer: SessionUser, wardId: string): void {
  if (viewer.role !== 'nurse') return
  if (viewer.ward && viewer.ward.id === wardId) return
  throw AppError.forbidden('You do not have access to that ward')
}

function scopeFor(viewer: SessionUser, requestedWardId?: string): Prisma.PatientWhereInput {
  if (viewer.role === 'nurse') {
    if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
    if (requestedWardId) assertWardAccess(viewer, requestedWardId)
    return { wardId: viewer.ward.id }
  }
  return requestedWardId ? { wardId: requestedWardId } : {}
}

export async function listPatients(
  prisma: PrismaClient,
  viewer: SessionUser,
  query: PatientListQuery,
  on: Date = todayUtc(),
): Promise<Patient[]> {
  const search = query.search?.trim()

  const patients = await prisma.patient.findMany({
    where: {
      ...scopeFor(viewer, query.wardId),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { mrn: { contains: search, mode: 'insensitive' } },
              { bed: { contains: search, mode: 'insensitive' } },
              { ward: { code: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: patientInclude,
    orderBy: { name: 'asc' },
  })

  return patients.map((patient) => toPatientDto(patient, on))
}

export async function getPatient(
  prisma: PrismaClient,
  viewer: SessionUser,
  id: string,
  on: Date = todayUtc(),
): Promise<Patient> {
  const patient = await prisma.patient.findUnique({ where: { id }, include: patientInclude })

  if (!patient) throw AppError.notFound(`No patient found with id ${id}`)
  assertWardAccess(viewer, patient.wardId)

  return toPatientDto(patient, on)
}

/**
 * MRNs are allocated here rather than in the browser, which invented them
 * with Math.random and could collide. The count-then-format runs inside
 * the same transaction as the insert, and the column is unique, so a
 * concurrent duplicate fails loudly instead of silently sharing an MRN.
 */
async function nextMrn(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.patient.count()
  return `MRN-${String(count + 1).padStart(6, '0')}`
}

export async function createPatient(
  prisma: PrismaClient,
  actor: SessionUser,
  input: CreatePatientRequest,
): Promise<Patient> {
  assertWardAccess(actor, input.wardId)

  const ward = await prisma.ward.findUnique({ where: { id: input.wardId } })
  if (!ward) throw AppError.invalidInput(`No ward found with id ${input.wardId}`)

  const created = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        mrn: await nextMrn(tx),
        name: input.name,
        dateOfBirth: new Date(input.dateOfBirth),
        gender: input.gender,
        phone: input.phone,
        wardId: input.wardId,
        bed: input.bed,
        admissionDate: new Date(input.admissionDate),
        diagnosis: input.diagnosis,
        allergies: input.allergies,
      },
      include: patientInclude,
    })

    await tx.activityEvent.create({
      data: {
        type: 'register',
        patientId: patient.id,
        wardId: patient.wardId,
        actorId: actor.id,
        text: `Patient registered: ${patient.name} — ${ward.code}, ${patient.bed}`,
      },
    })

    return patient
  })

  return toPatientDto(created)
}
