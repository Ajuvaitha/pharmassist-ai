import type { SessionUser } from '@pharmassist/shared'
import { AppError } from '../errors'

/**
 * A nurse may only reach their assigned ward. Every other role is
 * unrestricted.
 *
 * Fails closed: `User.wardId` is nullable, so a nurse account with no ward
 * is constructible, and letting that fall through to an unscoped query is
 * a privilege leak — it has happened twice in this codebase.
 *
 * This performs NO ward-existence validation. A passing call does not mean
 * `wardId` names a real ward; callers that need that must check it.
 */
export function assertWardAccess(viewer: SessionUser, wardId: string): void {
  if (viewer.role !== 'nurse') return
  if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
  if (viewer.ward.id === wardId) return

  // 403 rather than 404: a 404 would reveal whether the ward exists.
  throw AppError.forbidden('You do not have access to that ward')
}

/**
 * The `wardId` filter fragment for a list query. Spread it into a Prisma
 * `where` alongside other conditions — Prisma ANDs sibling keys, so the
 * scope cannot be widened by whatever it is combined with.
 */
export function wardScopeFor(
  viewer: SessionUser,
  requestedWardId?: string,
): { wardId: string } | Record<string, never> {
  if (viewer.role === 'nurse') {
    if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
    if (requestedWardId) assertWardAccess(viewer, requestedWardId)
    return { wardId: viewer.ward.id }
  }

  return requestedWardId ? { wardId: requestedWardId } : {}
}
