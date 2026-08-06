import { describe, expect, it } from 'vitest'
import { FREQUENCIES, dosesPerDay, isDueOn, isFrequency, isSweepable } from './frequency'

describe('FREQUENCIES', () => {
  it('covers every code the prescribing form offers', () => {
    expect([...FREQUENCIES]).toEqual(['OD', 'BD', 'TDS', 'QDS', 'ON', 'Weekly', 'PRN', 'STAT'])
  })
})

describe('dosesPerDay', () => {
  it('maps each scheduled code to its exact daily dose count', () => {
    expect(dosesPerDay('OD')).toBe(1)
    expect(dosesPerDay('BD')).toBe(2)
    expect(dosesPerDay('TDS')).toBe(3)
    expect(dosesPerDay('QDS')).toBe(4)
    expect(dosesPerDay('ON')).toBe(1)
    expect(dosesPerDay('Weekly')).toBe(1)
  })

  it('reports no scheduled daily dose for as-needed and one-off codes', () => {
    expect(dosesPerDay('PRN')).toBe(0)
    expect(dosesPerDay('STAT')).toBe(0)
  })
})

describe('isSweepable', () => {
  it('includes every code the ward sweep can act on', () => {
    expect(FREQUENCIES.filter(isSweepable)).toEqual(['OD', 'BD', 'TDS', 'QDS', 'ON', 'Weekly'])
  })

  it('excludes as-needed and one-off codes', () => {
    expect(isSweepable('PRN')).toBe(false)
    expect(isSweepable('STAT')).toBe(false)
  })
})

describe('isDueOn', () => {
  const start = new Date('2026-08-03T00:00:00Z')

  it('reports a daily code due on the start date and every day after', () => {
    expect(isDueOn('TDS', start, new Date('2026-08-03T00:00:00Z'))).toBe(true)
    expect(isDueOn('TDS', start, new Date('2026-08-04T00:00:00Z'))).toBe(true)
    expect(isDueOn('TDS', start, new Date('2026-08-09T00:00:00Z'))).toBe(true)
  })

  it('reports a weekly code due only every seventh day from the start', () => {
    expect(isDueOn('Weekly', start, new Date('2026-08-03T00:00:00Z'))).toBe(true)
    expect(isDueOn('Weekly', start, new Date('2026-08-04T00:00:00Z'))).toBe(false)
    expect(isDueOn('Weekly', start, new Date('2026-08-09T00:00:00Z'))).toBe(false)
    expect(isDueOn('Weekly', start, new Date('2026-08-10T00:00:00Z'))).toBe(true)
    expect(isDueOn('Weekly', start, new Date('2026-08-17T00:00:00Z'))).toBe(true)
  })

  it('ignores the time of day when comparing dates', () => {
    expect(isDueOn('Weekly', start, new Date('2026-08-10T23:59:00Z'))).toBe(true)
  })

  it('never reports as-needed or one-off codes as due', () => {
    expect(isDueOn('PRN', start, new Date('2026-08-03T00:00:00Z'))).toBe(false)
    expect(isDueOn('STAT', start, new Date('2026-08-03T00:00:00Z'))).toBe(false)
  })

  it('reports nothing due before the start date', () => {
    expect(isDueOn('OD', start, new Date('2026-08-02T00:00:00Z'))).toBe(false)
    expect(isDueOn('Weekly', start, new Date('2026-07-27T00:00:00Z'))).toBe(false)
  })
})

describe('isFrequency', () => {
  it('accepts known codes', () => {
    expect(isFrequency('TDS')).toBe(true)
    expect(isFrequency('PRN')).toBe(true)
  })

  it('rejects unknown codes', () => {
    expect(isFrequency('QID')).toBe(false)
    expect(isFrequency('')).toBe(false)
    expect(isFrequency('tds')).toBe(false)
  })
})
