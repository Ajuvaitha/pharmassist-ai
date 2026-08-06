import type { Prisma, PrismaClient } from '@prisma/client'
import type { ActivityItem, ActivityQuery, SessionUser } from '@pharmassist/shared'
import { toDateString, utcDayRange } from '../../domain/dates'
import { assertWardAccess } from '../../domain/scoping'

/**
 * A nurse sees their own ward's events plus pharmacy-wide ones that carry
 * no ward — a restock is relevant to everybody. That OR shape is genuinely
 * different from every other module's scoping, so it stays local here;
 * only the no-ward failure mode defers to the shared guard, so that one
 * failure mode lives in one place.
 */
function scopeFor(viewer: SessionUser): Prisma.ActivityEventWhereInput {
  if (viewer.role !== 'nurse') return {}

  if (!viewer.ward) {
    // Defers to the shared guard purely for the no-ward failure mode: the
    // wardId argument is irrelevant here — assertWardAccess throws (403)
    // as soon as it sees a nurse with no ward, before ever comparing it.
    assertWardAccess(viewer, '')

    // TypeScript cannot see that the call above always throws (it returns
    // void, not `never`), so this is unreachable at runtime but still
    // needed to narrow `viewer.ward` below.
    throw new Error('unreachable: assertWardAccess should have thrown')
  }

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
