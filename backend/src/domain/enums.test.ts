import { describe, expect, it } from 'vitest'
import { FoodTiming as PrismaFoodTiming } from '@prisma/client'
import type { FoodTiming } from '@pharmassist/shared'
import { toFoodTimingEnum, toFoodTimingWire } from './enums'

const PAIRS: Array<[PrismaFoodTiming, FoodTiming]> = [
  [PrismaFoodTiming.before_food, 'before-food'],
  [PrismaFoodTiming.after_food, 'after-food'],
  [PrismaFoodTiming.with_food, 'with-food'],
  [PrismaFoodTiming.not_applicable, 'not-applicable'],
]

describe('toFoodTimingWire', () => {
  it.each(PAIRS)('translates Prisma %s to wire %s', (prismaValue, wireValue) => {
    expect(toFoodTimingWire(prismaValue)).toBe(wireValue)
  })
})

describe('toFoodTimingEnum', () => {
  it.each(PAIRS)('translates wire %s to Prisma %s', (prismaValue, wireValue) => {
    expect(toFoodTimingEnum(wireValue)).toBe(prismaValue)
  })
})

describe('round-trip', () => {
  it.each(PAIRS)('wire -> Prisma -> wire is lossless for %s / %s', (prismaValue, wireValue) => {
    expect(toFoodTimingWire(toFoodTimingEnum(wireValue))).toBe(wireValue)
    expect(toFoodTimingEnum(toFoodTimingWire(prismaValue))).toBe(prismaValue)
  })
})
