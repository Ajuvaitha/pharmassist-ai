import { describe, expect, it } from 'vitest'
import { parseWardCode, wardLabel } from './ward'

describe('wardLabel', () => {
  it('composes code and name with an em-dash separator', () => {
    expect(wardLabel({ code: 'Ward 4A', name: 'General Medicine' }))
      .toBe('Ward 4A — General Medicine')
  })
})

describe('parseWardCode', () => {
  it('extracts the code from a composed label', () => {
    expect(parseWardCode('Ward 4A — General Medicine')).toBe('Ward 4A')
  })

  it('returns the input unchanged when there is no separator', () => {
    expect(parseWardCode('Ward 4A')).toBe('Ward 4A')
  })

  it('keeps an em-dash that appears in the ward name', () => {
    expect(parseWardCode('Ward 7E — Ear — Nose — Throat')).toBe('Ward 7E')
  })
})
