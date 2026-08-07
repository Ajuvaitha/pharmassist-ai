import { describe, expect, it } from 'vitest'
import { diffSettledWords } from './diffWords'

describe('diffSettledWords', () => {
  it('reports words newly appended at the end', () => {
    const prev = [{ label: 'amoxicillin' }]
    const next = [{ label: 'amoxicillin' }, { label: 'metformin' }]
    expect(diffSettledWords(prev, next)).toEqual([{ label: 'metformin' }])
  })

  it('reports a word whose label changed at an existing index', () => {
    expect(diffSettledWords([{ label: 'amox' }], [{ label: 'amoxicillin' }]))
      .toEqual([{ label: 'amoxicillin' }])
  })

  it('reports nothing when unchanged', () => {
    expect(diffSettledWords([{ label: 'aspirin' }], [{ label: 'aspirin' }])).toEqual([])
  })
})
