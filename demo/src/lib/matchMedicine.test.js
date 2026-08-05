import { describe, it, expect } from 'vitest'
import { matchMedicine, bestMatchClearsThreshold } from './matchMedicine.js'

const medicines = [
  { id: 'med-001', name: 'Paracetamol', unitOfMeasure: 'tablet', commonFrequency: 'TID' },
  { id: 'med-002', name: 'Amoxicillin', unitOfMeasure: 'capsule', commonFrequency: 'TID' },
  { id: 'med-004', name: 'Metformin', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
]

describe('matchMedicine', () => {
  it('returns an exact match as the top result', () => {
    const results = matchMedicine('Paracetamol', medicines)
    expect(results[0].name).toBe('Paracetamol')
  })

  it('is typo-tolerant', () => {
    const results = matchMedicine('Paracetmol', medicines)
    expect(results[0].name).toBe('Paracetamol')
  })

  it('returns an empty array for an empty query', () => {
    expect(matchMedicine('', medicines)).toEqual([])
    expect(matchMedicine('   ', medicines)).toEqual([])
  })

  it('respects the limit option', () => {
    const results = matchMedicine('a', medicines, { limit: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })
})

describe('bestMatchClearsThreshold', () => {
  it('is true when the top match score is at or below the threshold', () => {
    const results = matchMedicine('Metformin', medicines)
    expect(bestMatchClearsThreshold(results)).toBe(true)
  })

  it('is false for an empty match list', () => {
    expect(bestMatchClearsThreshold([])).toBe(false)
  })

  it('is false when the top score is above the threshold', () => {
    expect(bestMatchClearsThreshold([{ score: 0.9 }], 0.4)).toBe(false)
  })
})
