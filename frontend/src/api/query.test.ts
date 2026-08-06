import { describe, expect, it } from 'vitest'
import { buildQuery } from './query'

describe('buildQuery', () => {
  it('returns an empty string when every value is undefined', () => {
    expect(buildQuery({ a: undefined, b: undefined })).toBe('')
  })

  it('omits undefined values but keeps zero and empty strings out', () => {
    expect(buildQuery({ limit: 50, search: undefined })).toBe('?limit=50')
  })

  it('encodes values that need it', () => {
    expect(buildQuery({ search: 'Ward 4A & co' })).toBe('?search=Ward+4A+%26+co')
  })

  it('joins multiple params', () => {
    expect(buildQuery({ wardId: 'w1', search: 'ama' })).toBe('?wardId=w1&search=ama')
  })
})
