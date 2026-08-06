const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * All day arithmetic in this system is UTC whole-day arithmetic. A ward
 * indent is generated per calendar day, so a local-time or
 * millisecond-difference implementation would produce off-by-one-day
 * batches across a daylight-saving boundary.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function todayUtc(): Date {
  return startOfUtcDay(new Date())
}

export function daysBetweenUtc(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY)
}

/**
 * 1 on the start date, 2 the next day, and so on. Zero or negative before
 * treatment begins — callers decide whether that is in range.
 */
export function treatmentDayFor(startDate: Date, on: Date): number {
  return daysBetweenUtc(startDate, on) + 1
}

export function toDateString(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parses a calendar date to UTC midnight. Throws rather than returning an
 * Invalid Date, which would otherwise flow silently into a `@db.Date`
 * query and match nothing.
 */
export function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, received "${value}"`)
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(`"${value}" is not a real calendar date`)
  }

  return parsed
}

export function parseOptionalIsoDate(value?: string): Date | undefined {
  return value === undefined ? undefined : parseIsoDate(value)
}

/** Half-open UTC day range, for filtering a timestamp column by calendar day. */
export function utcDayRange(date: Date): { gte: Date; lt: Date } {
  const start = startOfUtcDay(date)
  return { gte: start, lt: new Date(start.getTime() + MS_PER_DAY) }
}
