import type { Prisma, PrismaClient } from '@prisma/client'
import type { ActivityItem, ActivityQuery, SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toDateString, utcDayRange } from '../../domain/dates'

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

export interface ActivityQueryInput {
  type?: ActivityQuery['type']
  date?: Date
  limit: number
}

export async function listActivity(
  prisma: PrismaClient,
  viewer: SessionUser,
  query: ActivityQueryInput,
): Promise<ActivityItem[]> {
  const events = await prisma.activityEvent.findMany({
    where: {
      ...scopeFor(viewer),
      ...(query.type ? { type: query.type } : {}),
      ...(query.date ? { occurredAt: utcDayRange(query.date) } : {}),
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
