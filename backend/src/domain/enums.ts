import { FoodTiming as PrismaFoodTiming } from '@prisma/client'
import type { FoodTiming } from '@pharmassist/shared'

/**
 * Prisma's @map on FoodTiming only renames the value STORED in Postgres.
 * The generated client is keyed by the underscored member name
 * ('after_food'), while the shared type — and the UI — speaks the
 * hyphenated wire format ('after-food'). Writing is type-safe by
 * accident (a hyphenated string is a compile error for the Prisma
 * client). Reading is not: a Prisma row returned straight to the client
 * ships the underscored value to a UI that does not recognise it, with
 * no type error. These two lookups are the only place that translation
 * happens; every read and write path should go through them.
 *
 * The `satisfies Record<...>` on each table means adding a member to
 * either enum without updating both tables fails `tsc` rather than
 * falling through to `undefined` at runtime.
 */
const WIRE_BY_PRISMA_FOOD_TIMING = {
  [PrismaFoodTiming.before_food]: 'before-food',
  [PrismaFoodTiming.after_food]: 'after-food',
  [PrismaFoodTiming.with_food]: 'with-food',
  [PrismaFoodTiming.not_applicable]: 'not-applicable',
} satisfies Record<PrismaFoodTiming, FoodTiming>

const PRISMA_FOOD_TIMING_BY_WIRE = {
  'before-food': PrismaFoodTiming.before_food,
  'after-food': PrismaFoodTiming.after_food,
  'with-food': PrismaFoodTiming.with_food,
  'not-applicable': PrismaFoodTiming.not_applicable,
} satisfies Record<FoodTiming, PrismaFoodTiming>

/** Translates a Prisma FoodTiming (read from the database) to the shared wire format. */
export function toFoodTimingWire(value: PrismaFoodTiming): FoodTiming {
  return WIRE_BY_PRISMA_FOOD_TIMING[value]
}

/** Translates a wire-format FoodTiming (from the UI) to the Prisma enum member. */
export function toFoodTimingEnum(value: FoodTiming): PrismaFoodTiming {
  return PRISMA_FOOD_TIMING_BY_WIRE[value]
}
