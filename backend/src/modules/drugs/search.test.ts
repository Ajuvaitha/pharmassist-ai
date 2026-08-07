import { describe, expect, it } from 'vitest'
import { buildDrugIndex, searchDrugIndex, soundex, levenshtein } from './search'

const index = buildDrugIndex([
  { id: '1', label: 'Amoxicillin 500mg', name: 'Amoxicillin', strength: '500mg', form: 'Capsule' },
  { id: '2', label: 'Aspirin 75mg', name: 'Aspirin', strength: '75mg', form: 'Tablet' },
  { id: '3', label: 'Metformin 500mg', name: 'Metformin', strength: '500mg', form: 'Tablet' },
])

describe('soundex', () => {
  it('encodes similar-sounding names to the same code', () => {
    expect(soundex('amoxicillin')).toBe(soundex('amoxacillin'))
  })
})

describe('levenshtein', () => {
  it('counts single-character edits', () => {
    expect(levenshtein('metformin', 'metformine')).toBe(1)
  })
})

describe('searchDrugIndex', () => {
  it('ranks an exact name match first', () => {
    const results = searchDrugIndex(index, 'aspirin', 5)
    expect(results[0]).toMatchObject({ id: '2', matchType: 'exact' })
  })

  it('finds a prefix match', () => {
    const results = searchDrugIndex(index, 'amox', 5)
    expect(results[0]).toMatchObject({ id: '1', matchType: 'prefix' })
  })

  it('tolerates a misspelling via fuzzy match', () => {
    const results = searchDrugIndex(index, 'metformine', 5)
    expect(results.some((r) => r.id === '3')).toBe(true)
  })

  it('returns nothing for a query shorter than two characters', () => {
    expect(searchDrugIndex(index, 'a', 5)).toEqual([])
  })
})
