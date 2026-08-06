import type { Prisma, PrismaClient } from '@prisma/client'
import type { ActivityItem, ActivityQuery, SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toDateString } from '../../domain/dates'

/**
 * A nurse sees their own ward's events plus pharmacy-wide ones that carry
 * no ward — a restock is relevant to everybody.
 *
 * Fails closed: `User.wardId` is nullable, so a nurse account with no
 * assigned ward is constructible. Falling through to an unscoped `{}`
 * would hand that account every ward's activity.
 */
function scopeFor(viewer: SessionUser): Prisma.ActivityEventWhereInput {
  if (viewer.role !== 'nurse') return {}
  if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
  return { OR: [{ wardId: viewer.ward.id }, { wardId: null }] }
}

function dayRange(date: string): { gte: Date; lt: Date } {
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { gte: start, lt: end }
}

export async function listActivity(
  prisma: PrismaClient,
  viewer: SessionUser,
  query: ActivityQuery,
): Promise<ActivityItem[]> {
  const events = await prisma.activityEvent.findMany({
    where: {
      ...scopeFor(viewer),
      ...(query.type ? { type: query.type } : {}),
      ...(query.date ? { occurredAt: dayRange(query.date) } : {}),
    },
    include: { patient: true, ward: true, drug: true },
    orderBy: { occurredAt: 'desc' },
    take: query.limit,
  })

  return events.map((event) => ({
    id: event.id,
    date: toDateString(event.occurredAt),
    time: event.occurredAt.toISOString().slice(11, 16),
    type: event.type,
    ...(event.patient ? { patient: event.patient.name } : {}),
    ...(event.ward ? { ward: event.ward.code } : {}),
    ...(event.drug ? { drug: event.drug.label } : {}),
    text: event.text,
  }))
}
