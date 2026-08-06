import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorCode, type ConfirmBillingRequest, type PatientBillingGroup, type SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { decimalToNumber, toTransactionDto } from '../../domain/dto'
import { assertWardAccess } from '../patients/service'
import { startOfUtcDay } from '../../domain/dates'

const lineInclude = {
  patient: true,
  ward: true,
  drug: true,
  indentLine: { include: { indent: true } },
} satisfies Prisma.BillingLineInclude

type LineWithRelations = Prisma.BillingLineGetPayload<{ include: typeof lineInclude }>

export interface BillingQuery {
  wardId?: string
  date?: Date
}

function group(lines: LineWithRelations[]): PatientBillingGroup[] {
  const groups = new Map<string, PatientBillingGroup>()

  for (const line of lines) {
    let entry = groups.get(line.patientId)
    if (!entry) {
      entry = {
        patientId: line.patientId,
        patient: line.patient.name,
        ward: line.ward.code,
        transactions: [],
        total: 0,
        pendingCount: 0,
        billed: true,
      }
      groups.set(line.patientId, entry)
    }

    entry.transactions.push(toTransactionDto(line))
    entry.total += decimalToNumber(line.total)
    if (line.status === 'pending') {
      entry.pendingCount += 1
      entry.billed = false
    }
  }

  // Money is summed from Decimal values one at a time, so round once at
  // the end rather than letting float drift accumulate in the display.
  for (const entry of groups.values()) {
    entry.total = Math.round(entry.total * 100) / 100
  }

  return [...groups.values()]
}

function scopeFor(viewer: SessionUser, requestedWardId?: string): Prisma.BillingLineWhereInput {
  if (viewer.role === 'nurse') {
    if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
    if (requestedWardId) assertWardAccess(viewer, requestedWardId)
    return { wardId: viewer.ward.id }
  }
  return requestedWardId ? { wardId: requestedWardId } : {}
}

export async function listBilling(
  prisma: PrismaClient,
  viewer: SessionUser,
  query: BillingQuery,
): Promise<PatientBillingGroup[]> {
  const lines = await prisma.billingLine.findMany({
    where: {
      ...scopeFor(viewer, query.wardId),
      ...(query.date ? { indentLine: { indent: { indentDate: startOfUtcDay(query.date) } } } : {}),
    },
    include: lineInclude,
    orderBy: { createdAt: 'desc' },
  })

  return group(lines)
}

export async function confirmBilling(
  prisma: PrismaClient,
  actor: SessionUser,
  // ConfirmBillingRequest.date is the wire ISO-string; callers here (the
  // route and the tests) already hold a parsed Date, so this overrides
  // that field rather than intersecting with it — `ConfirmBillingRequest &
  // { date?: Date }` would otherwise demand a value that is simultaneously
  // a string and a Date, which nothing can satisfy.
  input: Omit<ConfirmBillingRequest, 'date'> & { date?: Date },
): Promise<PatientBillingGroup> {
  const patient = await prisma.patient.findUnique({ where: { id: input.patientId } })
  if (!patient) throw AppError.notFound(`No patient found with id ${input.patientId}`)
  assertWardAccess(actor, patient.wardId)

  const where: Prisma.BillingLineWhereInput = {
    patientId: input.patientId,
    ...(input.date ? { indentLine: { indent: { indentDate: startOfUtcDay(input.date) } } } : {}),
  }

  const existing = await prisma.billingLine.findMany({ where, include: lineInclude })
  if (existing.length === 0) {
    throw AppError.notFound(`Nothing to bill for ${patient.name}`)
  }
  if (existing.every((line) => line.status !== 'pending')) {
    throw AppError.conflict(ErrorCode.ALREADY_BILLED, `${patient.name}'s account was already billed`)
  }

  // Conditional on still-pending rather than a blind update. Two concurrent
  // confirms for the same patient can both pass the pre-check above off the
  // same read; the loser must land here as a labelled conflict instead of
  // silently matching zero rows and reporting success on money it never
  // touched.
  const updated = await prisma.billingLine.updateMany({
    where: { ...where, status: 'pending' },
    data: { status: 'billed', billedById: actor.id, billedAt: new Date() },
  })
  if (updated.count === 0) {
    throw AppError.conflict(ErrorCode.ALREADY_BILLED, `${patient.name}'s account was already billed`)
  }

  const updatedLines = await prisma.billingLine.findMany({ where, include: lineInclude })
  const [result] = group(updatedLines)
  return result
}
