import type { DrugSearchResult } from '@pharmassist/shared'

export function soundex(s: string): string {
  const a = s.toUpperCase().replace(/[^A-Z]/g, '')
  if (!a) return ''
  const map: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3', L: '4', M: '5', N: '5', R: '6',
  }
  let code = a[0]!
  let prev = map[a[0]!] ?? '0'
  for (let i = 1; i < a.length && code.length < 4; i++) {
    const c = map[a[i]!] ?? '0'
    if (c !== '0' && c !== prev) code += c
    prev = c
  }
  return code.padEnd(4, '0')
}

export function levenshtein(a: string, b: string, maxDist = 6): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const m = a.length
  const n = b.length
  const row = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i
    for (let j = 1; j <= n; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1]! : 1 + Math.min(row[j]!, prev, row[j - 1]!)
      row[j - 1] = prev
      prev = val
    }
    row[n] = prev
  }
  return row[n]!
}

export interface IndexedDrug {
  id: string
  label: string
  name: string
  strength: string
  form: string
  nameLower: string
  brandLower: string
  tokens: string[]
  firstSoundex: string
}

const STOPWORDS =
  /^(mg|ml|mcg|iu|g|tab|tablet|tablets|cap|capsule|capsules|solution|injectable|injection|oral|topical|extended|release|product|suspension|ointment|gel|patch|cream|drops|spray)$/i

function tokenize(label: string): string[] {
  const words = label
    .toLowerCase()
    .split(/[/\s,()[\].\-:]+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOPWORDS.test(w))
  return Array.from(new Set(words)).slice(0, 5)
}

export function buildDrugIndex(
  drugs: Array<{ id: string; label: string; name: string; strength: string; form: string }>,
): IndexedDrug[] {
  return drugs.map((d) => {
    const brandMatch = d.label.match(/\[(.*?)\]/)
    const tokens = tokenize(d.label)
    return {
      ...d,
      nameLower: d.name.toLowerCase(),
      brandLower: (brandMatch?.[1] ?? '').trim().toLowerCase(),
      tokens,
      firstSoundex: soundex(tokens[0] ?? d.name),
    }
  })
}

function toResult(d: IndexedDrug, matchType: DrugSearchResult['matchType'], score: number): DrugSearchResult {
  return { id: d.id, label: d.label, name: d.name, strength: d.strength, form: d.form, matchType, score }
}

export function searchDrugIndex(index: IndexedDrug[], rawQuery: string, limit: number): DrugSearchResult[] {
  const q = rawQuery.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')
  if (q.length < 2) return []

  const qSdx = soundex(q)
  const qFirstWord = q.split(' ')[0]!
  const hits: DrugSearchResult[] = []
  const seen = new Set<string>()

  for (const d of index) {
    if (seen.has(d.id)) continue
    let hit: DrugSearchResult | null = null

    if (d.nameLower === q || d.label.toLowerCase() === q) hit = toResult(d, 'exact', 0)
    else if (d.brandLower && d.brandLower === q) hit = toResult(d, 'brand', 0.5)
    else if (d.nameLower.startsWith(q) || d.brandLower.startsWith(q) || d.label.toLowerCase().startsWith(q))
      hit = toResult(d, 'prefix', 1)
    else if (d.label.toLowerCase().includes(q)) hit = toResult(d, 'substring', 2)
    else if (d.tokens.some((t) => t.startsWith(q))) hit = toResult(d, 'token', 3)
    else if (d.firstSoundex && qSdx === d.firstSoundex) hit = toResult(d, 'phonetic', 5)
    else if (qFirstWord.length >= 4 && (d.tokens[0]?.length ?? 0) >= 4) {
      const dist = levenshtein(qFirstWord, d.tokens[0]!)
      if (dist <= 2) hit = toResult(d, 'fuzzy', 6 + dist)
    }

    if (hit) {
      hits.push(hit)
      seen.add(d.id)
      if (hits.length >= limit * 3) break
    }
  }

  hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
  return hits.slice(0, limit)
}
