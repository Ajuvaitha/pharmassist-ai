import { describe, expect, it } from 'vitest'
import { daysBetweenUtc, parseIsoDate, parseOptionalIsoDate, startOfUtcDay, toDateString, treatmentDayFor, utcDayRange } from './dates'

describe('startOfUtcDay', () => {
  it('strips the time component', () => {
    expect(startOfUtcDay(new Date('2026-08-06T23:59:59Z')).toISOString())
      .toBe('2026-08-06T00:00:00.000Z')
  })

  it('is idempotent', () => {
    const once = startOfUtcDay(new Date('2026-08-06T13:00:00Z'))
    expect(startOfUtcDay(once).getTime()).toBe(once.getTime())
  })
})

describe('daysBetweenUtc', () => {
  it('counts whole days forward', () => {
    expect(daysBetweenUtc(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))).toBe(5)
  })

  it('ignores the time of day on either end', () => {
    expect(daysBetweenUtc(new Date('2026-08-01T23:00:00Z'), new Date('2026-08-02T01:00:00Z'))).toBe(1)
  })

  it('returns a negative count when the target precedes the origin', () => {
    expect(daysBetweenUtc(new Date('2026-08-06T00:00:00Z'), new Date('2026-08-01T00:00:00Z'))).toBe(-5)
  })

  it('is unaffected by a daylight-saving boundary', () => {
    // Europe/London springs forward on 2026-03-29. UTC arithmetic must not
    // see a 23-hour day.
    expect(daysBetweenUtc(new Date('2026-03-28T00:00:00Z'), new Date('2026-03-30T00:00:00Z'))).toBe(2)
  })
})

describe('treatmentDayFor', () => {
  it('reports day 1 on the start date', () => {
    expect(treatmentDayFor(new Date('2026-08-06T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))).toBe(1)
  })

  it('increments by one per elapsed day', () => {
    expect(treatmentDayFor(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))).toBe(6)
  })

  it('reports zero or less before treatment begins', () => {
    expect(treatmentDayFor(new Date('2026-08-06T00:00:00Z'), new Date('2026-08-05T00:00:00Z'))).toBe(0)
  })
})

describe('toDateString', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    expect(toDateString(new Date('2026-08-06T23:30:00Z'))).toBe('2026-08-06')
  })
})

describe('parseIsoDate', () => {
  it('parses a calendar date to UTC midnight', () => {
    expect(parseIsoDate('2026-08-06').toISOString()).toBe('2026-08-06T00:00:00.000Z')
  })

  it('is unaffected by the host timezone', () => {
    // A local-time implementation would shift this by the host's offset.
    expect(parseIsoDate('2026-01-01').getUTCDate()).toBe(1)
    expect(parseIsoDate('2026-07-01').getUTCDate()).toBe(1)
  })

  it('rejects a malformed date rather than producing an Invalid Date', () => {
    expect(() => parseIsoDate('06-08-2026')).toThrow()
    expect(() => parseIsoDate('2026-13-01')).toThrow()
    expect(() => parseIsoDate('')).toThrow()
  })
})

describe('parseOptionalIsoDate', () => {
  it('returns undefined for an absent value', () => {
    expect(parseOptionalIsoDate(undefined)).toBeUndefined()
  })

  it('parses a present value', () => {
    expect(parseOptionalIsoDate('2026-08-06')?.toISOString()).toBe('2026-08-06T00:00:00.000Z')
  })
})

describe('utcDayRange', () => {
  it('is half-open — the next day is excluded', () => {
    const range = utcDayRange(new Date('2026-08-06T13:00:00Z'))
    expect(range.gte.toISOString()).toBe('2026-08-06T00:00:00.000Z')
    expect(range.lt.toISOString()).toBe('2026-08-07T00:00:00.000Z')
  })

  it('normalises a value carrying a time component', () => {
    const range = utcDayRange(new Date('2026-08-06T23:59:59Z'))
    expect(range.gte.toISOString()).toBe('2026-08-06T00:00:00.000Z')
  })
})
