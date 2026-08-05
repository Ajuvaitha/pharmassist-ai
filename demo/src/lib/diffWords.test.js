import { describe, it, expect } from 'vitest'
import { diffSettledWords } from './diffWords.js'

describe('diffSettledWords', () => {
  it('reports all words when there is no previous snapshot', () => {
    const current = [{ label: 'Paracetamol' }]
    expect(diffSettledWords([], current)).toEqual(current)
  })

  it('reports only newly appended words', () => {
    const wordA = { label: 'Paracetamol' }
    const wordB = { label: 'Metformin' }
    const previous = [wordA]
    const current = [wordA, wordB]
    expect(diffSettledWords(previous, current)).toEqual([wordB])
  })

  it('reports a word again if its label changed at the same position', () => {
    const previous = [{ label: 'Parac' }]
    const revised = { label: 'Paracetamol' }
    const current = [revised]
    expect(diffSettledWords(previous, current)).toEqual([revised])
  })

  it('reports nothing when nothing changed', () => {
    const wordA = { label: 'Paracetamol' }
    const previous = [wordA]
    const current = [{ label: 'Paracetamol' }]
    expect(diffSettledWords(previous, current)).toEqual([])
  })
})
