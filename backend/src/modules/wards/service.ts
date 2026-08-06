import type { PrismaClient } from '@prisma/client'
import type { SessionUser, SweepStatus, Ward } from '@pharmassist/shared'
import { toWardDto } from '../../domain/dto'
import { todayUtc } from '../../domain/dates'

/**
 * A nurse sees only their assigned ward. This is the server-side
 * replacement for the ward filtering the dashboard used to do in the
 * browser, where it was advisory rather than enforced.
 */
export async function listWards(
  prisma: PrismaClient,
  viewer: SessionUser,
  on: Date = todayUtc(),
): Promise<Ward[]> {
  const scope = viewer.role === 'nurse' && viewer.ward ? { id: viewer.ward.id } : {}

  const wards = await prisma.ward.findMany({
    where: scope,
    orderBy: { code: 'asc' },
    include: {
      indents: { where: { indentDate: on } },
      _count: { select: { patients: { where: { status: 'admitted' } } } },
    },
  })

  return wards.map((ward) => {
    const indent = ward.indents[0]
    const sweepStatus: SweepStatus = indent ? indent.status : 'pending'
    return toWardDto(ward, { sweepStatus, activePatients: ward._count.patients })
  })
}
