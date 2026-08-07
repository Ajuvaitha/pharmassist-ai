import { describe, expect, it } from 'vitest'
import { parseMedicineLine } from './parse-medicine'

describe('parseMedicineLine', () => {
  it('skips the header and blank lines', () => {
    expect(parseMedicineLine('str')).toBeNull()
    expect(parseMedicineLine('   ')).toBeNull()
  })

  it('keeps the full string as the unique label', () => {
    const row = parseMedicineLine('Amoxicillin 500 MG Oral Capsule [Amoxil]')
    expect(row?.label).toBe('Amoxicillin 500 MG Oral Capsule [Amoxil]')
  })

  it('derives the generic name by stripping the bracketed brand', () => {
    expect(parseMedicineLine('Amoxicillin 500 MG Oral Capsule [Amoxil]')?.name)
      .toBe('Amoxicillin 500 MG Oral Capsule')
  })

  it('derives form from keywords, defaulting to Tablet', () => {
    expect(parseMedicineLine('Ceftriaxone 1 G Injection')?.form).toBe('Injection')
    expect(parseMedicineLine('Cough Syrup 100 ML')?.form).toBe('Syrup')
    expect(parseMedicineLine('Omeprazole 20 MG Capsule')?.form).toBe('Capsule')
    expect(parseMedicineLine('Metformin 500 MG')?.form).toBe('Tablet')
  })

  it('extracts a strength token when present', () => {
    expect(parseMedicineLine('Metformin 500 MG')?.strength).toBe('500 MG')
    expect(parseMedicineLine('Saline flush')?.strength).toBe('')
  })

  it('assigns uncategorized, zero price', () => {
    const row = parseMedicineLine('Metformin 500 MG')
    expect(row).toMatchObject({ category: 'Uncategorized', unitPrice: '0' })
  })
})
