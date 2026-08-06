/**
 * Hospital dosing codes. `dosesPerDay` is the single source of truth for
 * daily quantity — the sweep job and the UI both read it, so they cannot
 * disagree.
 */
export const FREQUENCIES = ['OD', 'BD', 'TDS', 'QDS', 'ON'] as const

export type Frequency = (typeof FREQUENCIES)[number]

const DOSES_PER_DAY: Record<Frequency, number> = {
  OD: 1,
  BD: 2,
  TDS: 3,
  QDS: 4,
  ON: 1,
}

export function dosesPerDay(frequency: Frequency): number {
  return DOSES_PER_DAY[frequency]
}

export function isFrequency(value: string): value is Frequency {
  return (FREQUENCIES as readonly string[]).includes(value)
}
