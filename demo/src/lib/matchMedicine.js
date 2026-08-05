import Fuse from 'fuse.js'

const FUSE_OPTIONS = {
  keys: ['name'],
  threshold: 0.4,
  includeScore: true,
}

export function matchMedicine(query, medicines, { limit = 5 } = {}) {
  if (!query || !query.trim()) return []
  const fuse = new Fuse(medicines, FUSE_OPTIONS)
  return fuse
    .search(query.trim(), { limit })
    .map(({ item, score }) => ({ ...item, score }))
}

export function bestMatchClearsThreshold(matches, maxScore = 0.4) {
  return matches.length > 0 && matches[0].score <= maxScore
}
