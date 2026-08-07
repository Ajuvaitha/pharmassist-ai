import { describe, expect, it } from 'vitest'
import { drugSearchQuerySchema } from './api'

describe('drugSearchQuerySchema', () => {
  it('defaults limit to 8 and trims the query', () => {
    expect(drugSearchQuerySchema.parse({ q: '  amox ' })).toEqual({ q: 'amox', limit: 8 })
  })

  it('rejects a missing query', () => {
    expect(() => drugSearchQuerySchema.parse({})).toThrow()
  })

  it('caps limit at 25', () => {
    expect(drugSearchQuerySchema.parse({ q: 'a', limit: '100' }).limit).toBe(25)
  })
})
