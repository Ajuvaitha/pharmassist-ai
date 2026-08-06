import type { PrismaClient, Prisma } from '@prisma/client'
import type { SessionUser, SweepStatus, Ward } from '@pharmassist/shared'
import { toWardDto } from '../../domain/dto'
import { todayUtc } from '../../domain/dates'
import { AppError } from '../../errors'

/**
 * A nurse sees only their assigned ward. wardId is nullable, so a nurse
 * account with no assigned ward is constructible; that case must fail
 * closed rather than fall through to an unscoped, all-wards query.
 */
function wardScope(viewer: SessionUser): Prisma.WardWhereInput {
  if (viewer.role === 'nurse') {
    if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
    return { id: viewer.ward.id }
  }
  return {}
}

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
  const scope = wardScope(viewer)

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
