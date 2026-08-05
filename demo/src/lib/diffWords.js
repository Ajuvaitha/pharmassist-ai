export function diffSettledWords(previousWords, currentWords) {
  return currentWords.filter((word, index) => {
    const prev = previousWords[index]
    return !prev || prev.label !== word.label
  })
}
