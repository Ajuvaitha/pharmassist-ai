// Diffs by array index (positional identity), not by stable word identity. If the doctor
// erases/edits a word mid-canvas, every following word shifts index and gets re-reported as
// "new", even if already confirmed. Accepted limitation for this demo (see design doc: doctor
// edits/erases a word on canvas after already confirming it -> out of scope) - not a bug.
export function diffSettledWords(previousWords, currentWords) {
  return currentWords.filter((word, index) => {
    const prev = previousWords[index]
    return !prev || prev.label !== word.label
  })
}
