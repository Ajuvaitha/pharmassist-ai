/**
 * Hospital prescribing codes.
 *
 * The first five are taken every day. `Weekly` recurs every seventh day
 * from the prescription's start date. `PRN` (as needed) and `STAT`
 * (immediately, once) have no schedule at all — the ward sweep cannot
 * generate indent lines for them, so they are dispensed ad hoc.
 *
 * dosesPerDay is the single source of truth for daily quantity: the
 * sweep job and the UI both read it, so they cannot disagree.
 */
export const FREQUENCIES = ['OD', 'BD', 'TDS', 'QDS', 'ON', 'Weekly', 'PRN', 'STAT'] as const

export type Frequency = (typeof FREQUENCIES)[number]

const DOSES_PER_DAY: Record<Frequency, number> = {
  OD: 1,
  BD: 2,
  TDS: 3,
  QDS: 4,
  ON: 1,
  Weekly: 1,
  // No scheduled daily dose. Zero is meaningful here, not a fallback.
  PRN: 0,
  STAT: 0,
}

/** Codes the ward sweep can generate indent lines for. */
const SWEEPABLE: ReadonlySet<Frequency> = new Set<Frequency>([
  'OD', 'BD', 'TDS', 'QDS', 'ON', 'Weekly',
])

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function dosesPerDay(frequency: Frequency): number {
  return DOSES_PER_DAY[frequency]
}

export function isSweepable(frequency: Frequency): boolean {
  return SWEEPABLE.has(frequency)
}

export function isFrequency(value: string): value is Frequency {
  return (FREQUENCIES as readonly string[]).includes(value)
}

/** Midnight UTC for a date, so comparisons ignore the time of day. */
function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * Whether a prescription with this frequency calls for a dose on `date`.
 * Nothing is ever due before the start date, and non-sweepable codes are
 * never due at all.
 */
export function isDueOn(frequency: Frequency, startDate: Date, date: Date): boolean {
  if (!isSweepable(frequency)) return false

  const offsetDays = (startOfUtcDay(date) - startOfUtcDay(startDate)) / MS_PER_DAY
  if (offsetDays < 0) return false

  return frequency === 'Weekly' ? offsetDays % 7 === 0 : true
}
