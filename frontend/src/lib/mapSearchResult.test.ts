import { describe, expect, it } from 'vitest'
import { searchResultToInitialRx } from './mapSearchResult'

describe('searchResultToInitialRx', () => {
  it('carries the real drug id and seeds an empty dose', () => {
    const initial = searchResultToInitialRx({
      id: 'drug-1', label: 'Amoxicillin 500mg', name: 'Amoxicillin',
      strength: '500mg', form: 'Capsule', matchType: 'exact', score: 0,
    })
    expect(initial).toEqual({ drugId: 'drug-1', dose: '500mg' })
  })

  it('falls back to 1 tablet when strength is empty', () => {
    const initial = searchResultToInitialRx({
      id: 'drug-2', label: 'Custom Drug', name: 'Custom',
      strength: '', form: 'Tablet', matchType: 'prefix', score: 1,
    })
    expect(initial).toEqual({ drugId: 'drug-2', dose: '1 tablet' })
  })
})
