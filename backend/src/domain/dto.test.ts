import { beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { decimalToNumber, stockStatusFor, toInventoryDto, toPrescriptionDto } from './dto'

describe('decimalToNumber', () => {
  it('converts a Prisma Decimal to an exact number', () => {
    expect(decimalToNumber(new Prisma.Decimal('0.12'))).toBe(0.12)
    expect(decimalToNumber(new Prisma.Decimal('1.20'))).toBe(1.2)
    expect(decimalToNumber(new Prisma.Decimal('1234.56'))).toBe(1234.56)
  })

  it('returns a number, not a string — the wire type is number', () => {
    expect(typeof decimalToNumber(new Prisma.Decimal('0.85'))).toBe('number')
  })
})

describe('stockStatusFor', () => {
  it('reports critical at or below a fifth of the reorder level', () => {
    expect(stockStatusFor(20, 100)).toBe('critical')
    expect(stockStatusFor(7, 50)).toBe('critical')
  })

  it('reports low at or below the reorder level', () => {
    expect(stockStatusFor(100, 100)).toBe('low')
    expect(stockStatusFor(52, 100)).toBe('low')
  })

  it('reports ok above the reorder level', () => {
    expect(stockStatusFor(101, 100)).toBe('ok')
  })

  it('reports critical for zero stock', () => {
    expect(stockStatusFor(0, 100)).toBe('critical')
  })
})

describe('toInventoryDto', () => {
  it('exposes price as a number and derives status', () => {
    const dto = toInventoryDto({
      id: 'inv1',
      drugId: 'd1',
      currentStock: 52,
      reorderLevel: 100,
      drug: {
        id: 'd1',
        label: 'Furosemide 40mg',
        name: 'Furosemide',
        strength: '40mg',
        form: 'Tablet',
        category: 'Diuretics',
        unitPrice: new Prisma.Decimal('0.30'),
      },
    })

    expect(dto.drug).toBe('Furosemide 40mg')
    expect(dto.unit).toBe('Tablet')
    expect(dto.category).toBe('Diuretics')
    expect(dto.status).toBe('low')
  })
})

describe('toPrescriptionDto', () => {
  const base = {
    id: 'rx1',
    drugId: 'd1',
    dose: '500mg',
    route: 'Oral' as const,
    frequency: 'TDS' as const,
    foodTiming: 'after_food' as const,
    timeOfDay: ['morning' as const, 'night' as const],
    startDate: new Date('2026-08-01T00:00:00Z'),
    durationDays: 7,
    status: 'active' as const,
    stopReason: null,
    notes: null,
    prescribedAt: new Date('2026-08-01T08:15:00Z'),
    drug: { label: 'Amoxicillin 500mg' },
    prescribedBy: { displayName: 'Dr. B. Kwame' },
  }

  it('translates the Prisma enum key to the hyphenated wire value', () => {
    expect(toPrescriptionDto(base, new Date('2026-08-06T00:00:00Z')).foodTiming)
      .toBe('after-food')
  })

  it('derives currentDay from the start date', () => {
    expect(toPrescriptionDto(base, new Date('2026-08-06T00:00:00Z')).currentDay).toBe(6)
  })

  it('reports an active prescription past its duration as completed', () => {
    const dto = toPrescriptionDto(base, new Date('2026-08-20T00:00:00Z'))
    expect(dto.status).toBe('completed')
  })

  it('does not resurrect a stopped prescription as completed', () => {
    const stopped = { ...base, status: 'stopped' as const, stopReason: 'Toxicity suspected' }
    const dto = toPrescriptionDto(stopped, new Date('2026-08-20T00:00:00Z'))
    expect(dto.status).toBe('stopped')
    expect(dto.stopReason).toBe('Toxicity suspected')
  })

  it('flattens the drug label and prescriber name', () => {
    const dto = toPrescriptionDto(base, new Date('2026-08-06T00:00:00Z'))
    expect(dto.drug).toBe('Amoxicillin 500mg')
    expect(dto.prescribedBy).toBe('Dr. B. Kwame')
  })

  it('formats startDate as a plain calendar date', () => {
    expect(toPrescriptionDto(base, new Date('2026-08-06T00:00:00Z')).startDate).toBe('2026-08-01')
  })

  it('omits absent optional fields rather than sending null', () => {
    const dto = toPrescriptionDto(base, new Date('2026-08-06T00:00:00Z'))
    expect(dto.notes).toBeUndefined()
    expect(dto.stopReason).toBeUndefined()
  })
})
