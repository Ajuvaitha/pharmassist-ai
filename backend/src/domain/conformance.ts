/**
 * Compile-time-only conformance checks between the Prisma schema's enums
 * and packages/shared's hand-written equivalents.
 *
 * Nothing here has a runtime effect — this file exists so that a Prisma
 * enum and its shared counterpart drifting apart (a member renamed,
 * added, or removed on one side only) fails `tsc` instead of silently
 * continuing to typecheck. Without this, code like
 * `service.ts`'s `toSessionUser` assigning a Prisma `Role` into a
 * `SessionUser.role: Role` (the shared type) only compiles because the
 * two string-literal unions currently happen to coincide; nothing
 * catches the day they no longer do.
 *
 * `AssertExtends<A, B>` fails to compile unless A is assignable to B.
 * Applying it in both directions for a pair of types is equivalent to
 * asserting the two literal unions are exactly the same set.
 */
import type {
  Role as PrismaRole,
  Gender as PrismaGender,
  MedRoute as PrismaMedRoute,
  TimeOfDay as PrismaTimeOfDay,
  PrescriptionStatus as PrismaPrescriptionStatus,
  Frequency as PrismaFrequency,
} from '@prisma/client'
import type {
  Role,
  Gender,
  MedRoute,
  TimeOfDay,
  PrescriptionStatus,
  Frequency,
} from '@pharmassist/shared'

type AssertExtends<A extends B, B> = never

type _RoleFromPrisma = AssertExtends<PrismaRole, Role>
type _RoleToPrisma = AssertExtends<Role, PrismaRole>

type _GenderFromPrisma = AssertExtends<PrismaGender, Gender>
type _GenderToPrisma = AssertExtends<Gender, PrismaGender>

type _MedRouteFromPrisma = AssertExtends<PrismaMedRoute, MedRoute>
type _MedRouteToPrisma = AssertExtends<MedRoute, PrismaMedRoute>

type _TimeOfDayFromPrisma = AssertExtends<PrismaTimeOfDay, TimeOfDay>
type _TimeOfDayToPrisma = AssertExtends<TimeOfDay, PrismaTimeOfDay>

type _PrescriptionStatusFromPrisma = AssertExtends<PrismaPrescriptionStatus, PrescriptionStatus>
type _PrescriptionStatusToPrisma = AssertExtends<PrescriptionStatus, PrismaPrescriptionStatus>

type _FrequencyFromPrisma = AssertExtends<PrismaFrequency, Frequency>
type _FrequencyToPrisma = AssertExtends<Frequency, PrismaFrequency>
