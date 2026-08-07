export interface SettledWord {
  label: string
  [key: string]: unknown
}

// Diffs by array index (positional identity), not by stable word identity. If the
// doctor erases/edits a word mid-canvas, following words shift index and re-report
// as "new". Accepted limitation (see design doc) — not a bug.
export function diffSettledWords<T extends SettledWord>(previousWords: T[], currentWords: T[]): T[] {
  return currentWords.filter((word, index) => {
    const prev = previousWords[index]
    return !prev || prev.label !== word.label
  })
}
