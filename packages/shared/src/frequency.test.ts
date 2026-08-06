import { describe, expect, it } from 'vitest'
import { FREQUENCIES, dosesPerDay, isFrequency } from './frequency'

describe('dosesPerDay', () => {
  it('maps each dosing code to its daily dose count', () => {
    expect(dosesPerDay('OD')).toBe(1)
    expect(dosesPerDay('BD')).toBe(2)
    expect(dosesPerDay('TDS')).toBe(3)
    expect(dosesPerDay('QDS')).toBe(4)
    expect(dosesPerDay('ON')).toBe(1)
  })

  it('covers every frequency in FREQUENCIES', () => {
    for (const frequency of FREQUENCIES) {
      expect(dosesPerDay(frequency)).toBeGreaterThan(0)
    }
  })
})

describe('isFrequency', () => {
  it('accepts known codes', () => {
    expect(isFrequency('TDS')).toBe(true)
  })

  it('rejects unknown codes', () => {
    expect(isFrequency('PRN')).toBe(false)
    expect(isFrequency('')).toBe(false)
    expect(isFrequency('tds')).toBe(false)
  })
})
