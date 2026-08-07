# Prescription Writer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a doctor speak or handwrite a medicine name, match it against the full ~187k-row medicine catalog server-side, confirm via a two-popup flow, and save a real prescription.

**Architecture:** Seed all `Medicine_Names.csv` rows into the existing `Drug` table (prescriptions already FK to `Drug`, so no schema refactor). A Fastify plugin builds an in-memory token/soundex index from the `Drug` table at boot; a new `GET /api/drugs/search` runs a tiered matcher (exact → brand → prefix → substring → token → soundex → fuzzy) over it and returns real `Drug` rows. The rebuilt `PrescriptionWriterPage` uses React Query hooks: speak mode (Web Speech API, client-side) and write mode (`iink-ts` handwriting → MyScript cloud) both feed the search endpoint, then Popup 1 confirms the drug and Popup 2 (the existing `PrescriptionForm`, drug preset) captures dose/frequency/etc. and calls `useCreatePrescription`.

**Tech Stack:** Fastify 5 + Prisma + PostgreSQL, React 19 + `@tanstack/react-query`, Zod shared types (`@pharmassist/shared`), Vitest (node env — no DOM render tests), `iink-ts` (MyScript handwriting).

## Global Constraints

- pnpm monorepo: `backend`, `frontend`, `packages/shared`. Shared types live in `@pharmassist/shared` and are imported, never duplicated.
- Frontend Vitest runs in **`environment: 'node'`** (`frontend/vitest.config.ts`) — **no jsdom, no `@testing-library`**. Unit-test **pure functions only**; verify component/UI behavior through the browser preview workflow, not render tests. Do **not** add jsdom/testing-library.
- Backend routes are guarded with `app.guard(...)`. The Writer's create path is **doctor-only** (`app.guard('doctor')`), matching the existing `POST /api/patients/:id/prescriptions`.
- Prescription payloads must match `createPrescriptionSchema` exactly (`packages/shared/src/api.ts`): `{ drugId, dose, route, frequency, foodTiming, timeOfDay[], startDate, durationDays, notes? }`.
- Seeded curated drugs (`backend/prisma/seed-data.ts`, 16 rows with real prices) must not be overwritten by CSV rows. CSV labels are long formulation strings and never collide with curated labels like `"Aspirin 75mg"`, so both coexist.
- Secrets (MyScript keys) are **never** hardcoded or committed. They go in `frontend/.env` (gitignored), read via `import.meta.env.VITE_MYSCRIPT_*`. Handwriting degrades gracefully when absent.
- New backend deps: none required (matcher is hand-written). New frontend dep: `iink-ts`.
- Commit after every task with a `feat`/`test`/`chore` message.

---

## File Structure

**Backend**
- `packages/shared/src/api.ts` — add `drugSearchQuerySchema`, `DrugSearchResult`, `MatchType`.
- `backend/src/modules/drugs/search.ts` (create) — pure matcher: `soundex`, `levenshtein`, `buildDrugIndex`, `searchDrugIndex`.
- `backend/src/modules/drugs/search.test.ts` (create) — unit tests for the matcher.
- `backend/prisma/parse-medicine.ts` (create) — pure `parseMedicineLine(str)` → seed row fields.
- `backend/prisma/parse-medicine.test.ts` (create) — unit tests for the parser.
- `backend/prisma/seed-medicines.ts` (create) — streaming CSV → `createMany` batch loader; `pnpm seed:medicines`.
- `backend/src/plugins/drug-search.ts` (create) — Fastify plugin; decorates `app.drugSearch`.
- `backend/src/modules/drugs/service.ts` (modify) — bound plain `listDrugs` to stocked-only when no search; add `searchDrugs`.
- `backend/src/modules/drugs/routes.ts` (modify) — add `GET /api/drugs/search`.
- `backend/src/modules/drugs/routes.test.ts` (create) — integration test for `/api/drugs/search`.
- `backend/src/app.ts` (modify) — register the drug-search plugin.
- `backend/package.json` (modify) — add `seed:medicines` script.

**Frontend**
- `frontend/src/api/drugs.ts` (modify) — add `useDrugSearch`.
- `frontend/src/lib/mapSearchResult.ts` (create) — pure `searchResultToInitialRx(result)`.
- `frontend/src/lib/mapSearchResult.test.ts` (create) — unit test.
- `frontend/src/lib/diffWords.ts` (create) — ported `diffSettledWords`.
- `frontend/src/lib/diffWords.test.ts` (create) — ported test.
- `frontend/src/components/Whiteboard.tsx` (create) — ported iink-ts canvas.
- `frontend/src/components/VoiceAgent.tsx` (create) — ported speech agent, wired to `useDrugSearch`.
- `frontend/src/components/MedicineSuggestPopup.tsx` (create) — Popup 1 (candidate list).
- `frontend/src/pages/PrescriptionWriterPage.tsx` (create — replaces the branch version) — page assembly + Popup 2 via `PrescriptionForm`.
- `frontend/src/components/PrescriptionForm.tsx` (modify) — allow a locked/preset drug.
- `frontend/src/types.ts` (modify) — add `'prescription-writer'` to `Page`.
- `frontend/src/App.tsx` (modify) — render the page.
- `frontend/src/components/Layout.tsx` (modify) — add the doctor nav item.
- `frontend/package.json` (modify) — add `iink-ts`.
- `frontend/.env.example` (create) — document `VITE_MYSCRIPT_*`.

---

## Task 1: Shared search types

**Files:**
- Modify: `packages/shared/src/api.ts` (append near the drug/prescription schemas)

**Interfaces:**
- Consumes: nothing.
- Produces: `MatchType`, `DrugSearchResult`, `drugSearchQuerySchema`, `DrugSearchQuery`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/api.test.ts` (or append if it exists):

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/shared test -- api.test.ts`
Expected: FAIL — `drugSearchQuerySchema` is not exported.

- [ ] **Step 3: Add the types and schema**

In `packages/shared/src/api.ts`, add:

```typescript
export type MatchType =
  | 'exact'
  | 'brand'
  | 'prefix'
  | 'substring'
  | 'token'
  | 'phonetic'
  | 'fuzzy'

export interface DrugSearchResult {
  id: string
  label: string
  name: string
  strength: string
  form: string
  matchType: MatchType
  /** Lower is a better match; used only for ordering. */
  score: number
}

export const drugSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'A search query is required'),
  limit: z.coerce.number().int().positive().max(25).default(8),
})
export type DrugSearchQuery = z.infer<typeof drugSearchQuerySchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/shared test -- api.test.ts`
Expected: PASS.

- [ ] **Step 5: Export from the package index**

Confirm `packages/shared/src/index.ts` re-exports `./api` (it already does for existing schemas). If `DrugSearchResult`/`MatchType` are not surfaced, they are covered by the existing `export * from './api'` / `export type` lines — verify with:

Run: `pnpm --filter @pharmassist/shared build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/api.ts packages/shared/src/api.test.ts
git commit -m "feat(shared): add drug search types and query schema"
```

---

## Task 2: Pure tiered matcher

**Files:**
- Create: `backend/src/modules/drugs/search.ts`
- Test: `backend/src/modules/drugs/search.test.ts`

**Interfaces:**
- Consumes: `DrugSearchResult`, `MatchType` from `@pharmassist/shared`.
- Produces:
  - `soundex(s: string): string`
  - `levenshtein(a: string, b: string, maxDist?: number): number`
  - `interface IndexedDrug { id: string; label: string; name: string; strength: string; form: string; nameLower: string; brandLower: string; tokens: string[]; firstSoundex: string }`
  - `buildDrugIndex(drugs: Array<{ id: string; label: string; name: string; strength: string; form: string }>): IndexedDrug[]`
  - `searchDrugIndex(index: IndexedDrug[], rawQuery: string, limit: number): DrugSearchResult[]`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/drugs/search.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { buildDrugIndex, searchDrugIndex, soundex, levenshtein } from './search'

const index = buildDrugIndex([
  { id: '1', label: 'Amoxicillin 500mg', name: 'Amoxicillin', strength: '500mg', form: 'Capsule' },
  { id: '2', label: 'Aspirin 75mg', name: 'Aspirin', strength: '75mg', form: 'Tablet' },
  { id: '3', label: 'Metformin 500mg', name: 'Metformin', strength: '500mg', form: 'Tablet' },
])

describe('soundex', () => {
  it('encodes similar-sounding names to the same code', () => {
    expect(soundex('amoxicillin')).toBe(soundex('amoxacillin'))
  })
})

describe('levenshtein', () => {
  it('counts single-character edits', () => {
    expect(levenshtein('metformin', 'metformine')).toBe(1)
  })
})

describe('searchDrugIndex', () => {
  it('ranks an exact name match first', () => {
    const results = searchDrugIndex(index, 'aspirin', 5)
    expect(results[0]).toMatchObject({ id: '2', matchType: 'exact' })
  })

  it('finds a prefix match', () => {
    const results = searchDrugIndex(index, 'amox', 5)
    expect(results[0]).toMatchObject({ id: '1', matchType: 'prefix' })
  })

  it('tolerates a misspelling via fuzzy match', () => {
    const results = searchDrugIndex(index, 'metformine', 5)
    expect(results.some((r) => r.id === '3')).toBe(true)
  })

  it('returns nothing for a query shorter than two characters', () => {
    expect(searchDrugIndex(index, 'a', 5)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test -- search.test.ts`
Expected: FAIL — module `./search` not found.

- [ ] **Step 3: Implement the matcher**

Create `backend/src/modules/drugs/search.ts`. Port the algorithms from `healthy-hands-app-main/src/lib/kaggleSearchEngine.ts` (already read), adapted to operate on `Drug` rows and return `DrugSearchResult`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/backend test -- search.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/drugs/search.ts backend/src/modules/drugs/search.test.ts
git commit -m "feat(backend): add pure tiered drug matcher (soundex, fuzzy)"
```

---

## Task 3: CSV line parser

**Files:**
- Create: `backend/prisma/parse-medicine.ts`
- Test: `backend/prisma/parse-medicine.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface MedicineSeedRow { label: string; name: string; strength: string; form: string; category: string; unitPrice: string }` and `parseMedicineLine(str: string): MedicineSeedRow | null` (returns `null` for header/blank lines).

- [ ] **Step 1: Write the failing test**

Create `backend/prisma/parse-medicine.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test -- parse-medicine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

Create `backend/prisma/parse-medicine.ts`:

```typescript
export interface MedicineSeedRow {
  label: string
  name: string
  strength: string
  form: string
  category: string
  unitPrice: string
}

function deriveForm(str: string): string {
  const s = str.toLowerCase()
  if (/\binj|injection|injectable\b/.test(s)) return 'Injection'
  if (/\bsyrup|suspension|solution|drops\b/.test(s)) return 'Syrup'
  if (/\bcap|capsule\b/.test(s)) return 'Capsule'
  if (/\bcream|ointment|gel|patch\b/.test(s)) return 'Topical'
  return 'Tablet'
}

function deriveStrength(str: string): string {
  const m = str.match(/\b\d+(?:\.\d+)?\s?(?:mg|ml|mcg|iu|g)\b/i)
  return m ? m[0].trim().replace(/\s+/g, ' ').toUpperCase().replace('MG', 'MG') : ''
}

export function parseMedicineLine(rawLine: string): MedicineSeedRow | null {
  const str = rawLine.trim()
  if (!str || str.toLowerCase() === 'str') return null

  const name = str.replace(/\[.*?\]/g, '').trim() || str

  return {
    label: str,
    name,
    strength: deriveStrength(str),
    form: deriveForm(str),
    category: 'Uncategorized',
    unitPrice: '0',
  }
}
```

Note: if the `strength` test for `'500 MG'` fails on casing, adjust `deriveStrength` to return the raw matched substring (`m[0].trim()`), then re-run — keep the implementation matching the test, not the other way around.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/backend test -- parse-medicine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/parse-medicine.ts backend/prisma/parse-medicine.test.ts
git commit -m "feat(backend): add medicine CSV line parser"
```

---

## Task 4: Medicine seed script

**Files:**
- Create: `backend/prisma/seed-medicines.ts`
- Modify: `backend/package.json` (add `seed:medicines` script)
- Test: `backend/prisma/seed-medicines.test.ts`

**Interfaces:**
- Consumes: `parseMedicineLine` (Task 3), `PrismaClient`.
- Produces: `seedMedicines(prisma: PrismaClient, csvPath: string, opts?: { batchSize?: number }): Promise<{ inserted: number }>`.

- [ ] **Step 1: Write the failing test**

Create `backend/prisma/seed-medicines.test.ts`. It writes a tiny CSV to a temp file and loads it against the test database used elsewhere in the backend suite (see `backend/src/test` for the existing test-db harness — reuse the same `PrismaClient` setup pattern that other integration tests use).

```typescript
import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PrismaClient } from '@prisma/client'
import { seedMedicines } from './seed-medicines'

const prisma = new PrismaClient()
const csv = join(tmpdir(), `meds-${Date.now()}.csv`)
writeFileSync(csv, 'str\nZzztestol 10 MG Tablet\nZzztestol 10 MG Tablet\nYyytestine 5 MG Injection\n')

afterAll(async () => {
  await prisma.drug.deleteMany({ where: { label: { startsWith: 'Zzztestol' } } })
  await prisma.drug.deleteMany({ where: { label: { startsWith: 'Yyytestine' } } })
  await prisma.$disconnect()
})

describe('seedMedicines', () => {
  it('inserts parsed rows and dedupes on label', async () => {
    const { inserted } = await seedMedicines(prisma, csv, { batchSize: 1 })
    expect(inserted).toBeGreaterThanOrEqual(2)
    const zz = await prisma.drug.findUnique({ where: { label: 'Zzztestol 10 MG Tablet' } })
    expect(zz).toMatchObject({ form: 'Tablet', category: 'Uncategorized' })
  })

  it('is idempotent — a second run inserts no duplicates', async () => {
    await seedMedicines(prisma, csv, { batchSize: 1 })
    const count = await prisma.drug.count({ where: { label: 'Zzztestol 10 MG Tablet' } })
    expect(count).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test -- seed-medicines.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the streaming loader**

Create `backend/prisma/seed-medicines.ts`:

```typescript
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { PrismaClient, type Prisma } from '@prisma/client'
import { parseMedicineLine } from './parse-medicine'

export async function seedMedicines(
  prisma: PrismaClient,
  csvPath: string,
  opts: { batchSize?: number } = {},
): Promise<{ inserted: number }> {
  const batchSize = opts.batchSize ?? 5000
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: 'utf-8' }), crlfDelay: Infinity })

  let batch: Prisma.DrugCreateManyInput[] = []
  let inserted = 0
  const flush = async () => {
    if (batch.length === 0) return
    const res = await prisma.drug.createMany({ data: batch, skipDuplicates: true })
    inserted += res.count
    batch = []
  }

  for await (const line of rl) {
    const row = parseMedicineLine(line)
    if (!row) continue
    batch.push(row)
    if (batch.length >= batchSize) await flush()
  }
  await flush()
  return { inserted }
}

// Entrypoint: `pnpm --filter @pharmassist/backend seed:medicines`
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database')
  const prisma = new PrismaClient()
  const csvPath = process.env.MEDICINES_CSV ?? new URL('../../Medicine_Names.csv', import.meta.url).pathname
  const { inserted } = await seedMedicines(prisma, csvPath)
  await prisma.$disconnect()
  console.log(`Medicine seed complete: ${inserted} rows inserted`)
}
```

Note the `createMany` batch relies on `skipDuplicates`, which needs the existing `Drug.label @unique` constraint (already present in `schema.prisma`). No migration is required for this task.

- [ ] **Step 4: Add the package script**

In `backend/package.json` `scripts`, add:

```json
    "seed:medicines": "tsx prisma/seed-medicines.ts",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/backend test -- seed-medicines.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/seed-medicines.ts backend/prisma/seed-medicines.test.ts backend/package.json
git commit -m "feat(backend): add streaming medicine CSV seed loader"
```

---

## Task 5: Drug-search index plugin

**Files:**
- Create: `backend/src/plugins/drug-search.ts`
- Modify: `backend/src/app.ts` (register the plugin after `prismaPlugin`)

**Interfaces:**
- Consumes: `buildDrugIndex`, `searchDrugIndex` (Task 2); `app.prisma` (existing `prismaPlugin` decoration).
- Produces: a Fastify decoration `app.drugSearch` of type `{ search(q: string, limit: number): DrugSearchResult[]; rebuild(): Promise<void> }`. Add the type to Fastify's module augmentation.

- [ ] **Step 1: Write the failing test**

Create `backend/src/plugins/drug-search.test.ts`. It seeds the base curated drugs, builds the app, and searches:

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { buildApp } from '../app'
import { seed } from '../../prisma/seed'

const prisma = new PrismaClient()

beforeAll(async () => { await seed(prisma) })
afterAll(async () => { await prisma.$disconnect() })

describe('app.drugSearch', () => {
  it('finds a curated drug by prefix after boot', async () => {
    const app = await buildApp({ prisma })
    const results = app.drugSearch.search('aspir', 5)
    expect(results[0]?.name).toBe('Aspirin')
    await app.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test -- drug-search.test.ts`
Expected: FAIL — `app.drugSearch` undefined.

- [ ] **Step 3: Implement the plugin**

Create `backend/src/plugins/drug-search.ts`:

```typescript
import fp from 'fastify-plugin'
import type { DrugSearchResult } from '@pharmassist/shared'
import { buildDrugIndex, searchDrugIndex, type IndexedDrug } from '../modules/drugs/search'

declare module 'fastify' {
  interface FastifyInstance {
    drugSearch: {
      search(q: string, limit: number): DrugSearchResult[]
      rebuild(): Promise<void>
    }
  }
}

export default fp(async (app) => {
  let index: IndexedDrug[] = []

  const rebuild = async () => {
    const drugs = await app.prisma.drug.findMany({
      select: { id: true, label: true, name: true, strength: true, form: true },
    })
    index = buildDrugIndex(drugs)
    app.log.info(`drug-search index built: ${index.length} drugs`)
  }

  await rebuild()

  app.decorate('drugSearch', {
    search: (q: string, limit: number) => searchDrugIndex(index, q, limit),
    rebuild,
  })
}, { name: 'drug-search', dependencies: ['prisma'] })
```

Confirm `prismaPlugin` sets `name: 'prisma'` via `fastify-plugin`; if it does not declare a name, drop the `dependencies` array and instead register `drugSearchPlugin` strictly after `prismaPlugin` in `app.ts` (which the next step already does).

- [ ] **Step 4: Register in app.ts**

In `backend/src/app.ts`, import and register after `prismaPlugin`:

```typescript
import drugSearchPlugin from './plugins/drug-search'
// ...
await app.register(prismaPlugin, { prisma: options.prisma })
await app.register(drugSearchPlugin)
await app.register(authPlugin)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/backend test -- drug-search.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/plugins/drug-search.ts backend/src/plugins/drug-search.test.ts backend/src/app.ts
git commit -m "feat(backend): build in-memory drug-search index at boot"
```

---

## Task 6: Search route + bounded catalog list

**Files:**
- Modify: `backend/src/modules/drugs/service.ts` (bound plain list to stocked-only)
- Modify: `backend/src/modules/drugs/routes.ts` (add `/api/drugs/search`)
- Test: `backend/src/modules/drugs/routes.test.ts`

**Interfaces:**
- Consumes: `app.drugSearch.search` (Task 5), `drugSearchQuerySchema`, `DrugSearchResult` (Task 1), `app.guard()` (existing).
- Produces: `GET /api/drugs/search?q=&limit=` returning `DrugSearchResult[]`; unchanged `GET /api/drugs` now returns **only stocked drugs** (those with an `InventoryItem`) when no `search` is given.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/drugs/routes.test.ts`. Use the existing integration-test helper that logs in and returns an authenticated `inject` (mirror another module's `routes.test.ts`, e.g. `patients`):

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { buildApp } from '../../app'
import { seed } from '../../../prisma/seed'
import { authCookieFor } from '../../test/auth' // reuse the existing helper name; adjust to the real one

const prisma = new PrismaClient()
let cookie: string

beforeAll(async () => { await seed(prisma) })
afterAll(async () => { await prisma.$disconnect() })

describe('GET /api/drugs/search', () => {
  it('returns ranked results for a query', async () => {
    const app = await buildApp({ prisma })
    cookie = await authCookieFor(app, 'doctor')
    const res = await app.inject({ method: 'GET', url: '/api/drugs/search?q=aspir', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ name: string }>
    expect(body[0]?.name).toBe('Aspirin')
    await app.close()
  })

  it('rejects a missing query with 400', async () => {
    const app = await buildApp({ prisma })
    const res = await app.inject({ method: 'GET', url: '/api/drugs/search', headers: { cookie } })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('GET /api/drugs (no search)', () => {
  it('returns only stocked drugs', async () => {
    const app = await buildApp({ prisma })
    const res = await app.inject({ method: 'GET', url: '/api/drugs', headers: { cookie } })
    const body = res.json() as Array<{ label: string }>
    // The seed stocks 15 of the 16 curated drugs via INVENTORY.
    expect(body.length).toBeLessThanOrEqual(16)
    await app.close()
  })
})
```

Before implementing, open the real auth-helper in `backend/src/test` and replace `authCookieFor` / the role argument with whatever the existing integration tests use. Do not invent a helper.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test -- drugs/routes.test.ts`
Expected: FAIL — route `/api/drugs/search` returns 404.

- [ ] **Step 3: Bound the plain list**

In `backend/src/modules/drugs/service.ts`, change `listDrugs` so that with no search term it returns only drugs that have an inventory item:

```typescript
export async function listDrugs(prisma: PrismaClient, search?: string): Promise<Drug[]> {
  const term = search?.trim()

  const drugs = await prisma.drug.findMany({
    where: term
      ? { label: { contains: term, mode: 'insensitive' } }
      : { inventoryItem: { isNot: null } },
    orderBy: { label: 'asc' },
    take: 100,
  })

  return drugs.map((drug) => ({
    id: drug.id,
    label: drug.label,
    name: drug.name,
    strength: drug.strength,
    form: drug.form,
    category: drug.category,
    unitPrice: decimalToNumber(drug.unitPrice),
  }))
}
```

The `take: 100` cap protects any caller that still passes a `search` term against the now-187k table.

- [ ] **Step 4: Add the search route**

In `backend/src/modules/drugs/routes.ts`:

```typescript
import { drugSearchQuerySchema, type DrugSearchResult } from '@pharmassist/shared'
// ...
app.get('/api/drugs/search', { preHandler: app.guard() }, async (request): Promise<DrugSearchResult[]> => {
  const { q, limit } = drugSearchQuerySchema.parse(request.query)
  return app.drugSearch.search(q, limit)
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/backend test -- drugs/routes.test.ts`
Expected: PASS. Then run the full backend suite to catch regressions in existing drug consumers:

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/drugs/service.ts backend/src/modules/drugs/routes.ts backend/src/modules/drugs/routes.test.ts
git commit -m "feat(backend): add GET /api/drugs/search and bound the plain catalog list"
```

---

## Task 7: Frontend search hook + result mapper

**Files:**
- Modify: `frontend/src/api/drugs.ts` (add `useDrugSearch`)
- Create: `frontend/src/lib/mapSearchResult.ts`
- Test: `frontend/src/lib/mapSearchResult.test.ts`

**Interfaces:**
- Consumes: `DrugSearchResult`, `CreatePrescriptionRequest` from `@pharmassist/shared`; `apiGet`, `buildQuery` (existing).
- Produces:
  - `useDrugSearch(q: string): UseQueryResult<DrugSearchResult[]>` — disabled when `q.trim().length < 2`.
  - `searchResultToInitialRx(result: DrugSearchResult): { drugId: string; dose: string }` — seeds Popup 2's form.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/mapSearchResult.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { searchResultToInitialRx } from './mapSearchResult'

describe('searchResultToInitialRx', () => {
  it('carries the real drug id and seeds an empty dose', () => {
    const initial = searchResultToInitialRx({
      id: 'drug-1', label: 'Amoxicillin 500mg', name: 'Amoxicillin',
      strength: '500mg', form: 'Capsule', matchType: 'exact', score: 0,
    })
    expect(initial).toEqual({ drugId: 'drug-1', dose: '500mg' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/frontend test -- mapSearchResult.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapper**

Create `frontend/src/lib/mapSearchResult.ts`:

```typescript
import type { DrugSearchResult } from '@pharmassist/shared'

/** Seeds the details form (Popup 2) from a confirmed search result. */
export function searchResultToInitialRx(result: DrugSearchResult): { drugId: string; dose: string } {
  return { drugId: result.id, dose: result.strength }
}
```

- [ ] **Step 4: Add the hook**

In `frontend/src/api/drugs.ts` add:

```typescript
import type { Drug, DrugSearchResult } from '@pharmassist/shared'
// ...
const drugSearchQueryKey = (q: string) => ['drugs', 'search', q] as const

export function useDrugSearch(q: string) {
  const query = q.trim()
  return useQuery<DrugSearchResult[]>({
    queryKey: drugSearchQueryKey(query),
    queryFn: () => apiGet<DrugSearchResult[]>(`/api/drugs/search${buildQuery({ q: query, limit: 8 })}`),
    enabled: query.length >= 2,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/frontend test -- mapSearchResult.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/drugs.ts frontend/src/lib/mapSearchResult.ts frontend/src/lib/mapSearchResult.test.ts
git commit -m "feat(frontend): add useDrugSearch hook and result mapper"
```

---

## Task 8: Frontend deps + MyScript env

**Files:**
- Modify: `frontend/package.json` (add `iink-ts`)
- Create: `frontend/.env.example`

**Interfaces:**
- Produces: `iink-ts` available to import; documented `VITE_MYSCRIPT_APPLICATION_KEY` / `VITE_MYSCRIPT_HMAC_KEY`.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter @pharmassist/frontend add iink-ts@^3.3.2`
Expected: `frontend/package.json` gains `"iink-ts": "^3.3.2"`; lockfile updates.

- [ ] **Step 2: Document the env keys**

Create `frontend/.env.example`:

```bash
# MyScript iink handwriting recognition (Write mode of the Prescription Writer).
# Get keys from https://developer.myscript.com. Drawing works without them;
# only handwriting-to-text recognition needs them.
VITE_MYSCRIPT_APPLICATION_KEY=
VITE_MYSCRIPT_HMAC_KEY=
```

Confirm `frontend/.env` is gitignored (root `.gitignore` already ignores `.env`). **Do not** create or commit a real `.env` with keys.

- [ ] **Step 3: Verify install**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit`
Expected: no errors (no usage yet; this just confirms the dep resolves).

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/.env.example pnpm-lock.yaml
git commit -m "chore(frontend): add iink-ts dep and document MyScript env keys"
```

---

## Task 9: Handwriting canvas (Write mode)

**Files:**
- Create: `frontend/src/lib/diffWords.ts`
- Test: `frontend/src/lib/diffWords.test.ts`
- Create: `frontend/src/components/Whiteboard.tsx`

**Interfaces:**
- Consumes: `iink-ts` (Task 8).
- Produces:
  - `diffSettledWords(previous: SettledWord[], current: SettledWord[]): SettledWord[]` where `interface SettledWord { label: string }` (extra fields allowed).
  - `<Whiteboard onWordSettled={(w: { label: string; box: { x: number; y: number; width: number; height: number } }) => void} />`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/diffWords.test.ts` (port of `demo/src/lib/diffWords.test.js`, typed):

```typescript
import { describe, expect, it } from 'vitest'
import { diffSettledWords } from './diffWords'

describe('diffSettledWords', () => {
  it('reports words newly appended at the end', () => {
    const prev = [{ label: 'amoxicillin' }]
    const next = [{ label: 'amoxicillin' }, { label: 'metformin' }]
    expect(diffSettledWords(prev, next)).toEqual([{ label: 'metformin' }])
  })

  it('reports a word whose label changed at an existing index', () => {
    expect(diffSettledWords([{ label: 'amox' }], [{ label: 'amoxicillin' }]))
      .toEqual([{ label: 'amoxicillin' }])
  })

  it('reports nothing when unchanged', () => {
    expect(diffSettledWords([{ label: 'aspirin' }], [{ label: 'aspirin' }])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmassist/frontend test -- diffWords.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement diffWords**

Create `frontend/src/lib/diffWords.ts` (port of `demo/src/lib/diffWords.js`, keep the index-identity comment):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pharmassist/frontend test -- diffWords.test.ts`
Expected: PASS.

- [ ] **Step 5: Port the Whiteboard component**

Create `frontend/src/components/Whiteboard.tsx` by porting `demo/src/components/Whiteboard.jsx` (already read) to TSX. Keep the load-chain serialization, the JIIX bounding-box config, and the QUIET_PERIOD trigger verbatim. Apply exactly these changes:
- Type the prop: `interface WhiteboardProps { onWordSettled: (w: { label: string; box: { x: number; y: number; width: number; height: number } }) => void }`.
- Import `diffSettledWords` and `type SettledWord` from `../lib/diffWords`.
- Read keys from `import.meta.env.VITE_MYSCRIPT_APPLICATION_KEY` / `..._HMAC_KEY`.
- Type the exported-word handler: cast the JIIX payload to `{ words?: SettledWord[] }`; skip words without `label?.trim()` or `['bounding-box']`.
- Keep the `keysMissing` banner but reword to point at `frontend/.env`.
- Replace the CSS classnames with inline styles matching the app's existing look (white card, `#D9E8EF` border) — the app does not use `App.css` classes.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit`
Expected: no errors. (Runtime handwriting is verified in the browser in Task 12/13.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/diffWords.ts frontend/src/lib/diffWords.test.ts frontend/src/components/Whiteboard.tsx
git commit -m "feat(frontend): port handwriting whiteboard and word-diff for write mode"
```

---

## Task 10: Voice agent (Speak mode)

**Files:**
- Create: `frontend/src/components/VoiceAgent.tsx`

**Interfaces:**
- Consumes: `useDrugSearch` (Task 7), `DrugSearchResult`.
- Produces: `<VoiceAgent onRecognize={(transcript: string) => void} />` — owns the mic + Web Speech API; on a final transcript, calls `onRecognize(transcript)`. **Matching is delegated to the parent** (which runs `useDrugSearch`), unlike the healthy-hands original that matched inline.

- [ ] **Step 1: Port and rewire the component**

Create `frontend/src/components/VoiceAgent.tsx` by porting `healthy-hands-app-main/src/components/VoiceAgent.tsx` (already read). Apply exactly these changes:
- **Remove** the `searchVoiceMedicines` import and all inline search/verify/confirm state (`searchResults`, `VerifyCard`, `OtherMatches`, `RelatedDrugs`, `handleConfirm`). Those move to the parent page (Task 11/12). Keep only: the `SpeechRecognition` shim (`getSR`), `MicButton`, `SoundWave`, the listening/processing state machine, and the transcript.
- Replace lucide-react icons (not a dependency here) with the app's existing inline-SVG icon style, or add minimal inline SVGs. **Do not** add `lucide-react`.
- Replace shadcn `Button`/`cn`/Tailwind classes with inline styles matching the app (this project styles with inline `style={{}}`, not Tailwind).
- On `onend` → when a final transcript exists, call `props.onRecognize(transcript.trim())`, then reset to idle.
- Keep the no-support and permission-denied messaging.
- Prop type: `interface VoiceAgentProps { onRecognize: (transcript: string) => void }`.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/VoiceAgent.tsx
git commit -m "feat(frontend): port voice agent, delegating match to the page"
```

---

## Task 11: Candidate popup + preset prescription form

**Files:**
- Create: `frontend/src/components/MedicineSuggestPopup.tsx`
- Modify: `frontend/src/components/PrescriptionForm.tsx` (support a locked, preset drug)

**Interfaces:**
- Consumes: `DrugSearchResult`; existing `PrescriptionForm` props (`initial`, `prescribedBy`, `onSave`, `onCancel`).
- Produces:
  - `<MedicineSuggestPopup results={DrugSearchResult[]} isLoading={boolean} onSelect={(r: DrugSearchResult) => void} onDismiss={() => void} />`.
  - `PrescriptionForm` gains an optional `lockedDrug?: { id: string; label: string }`; when set, the drug `<select>` is replaced by a read-only field showing `label`, and `drugId` is forced to `lockedDrug.id`.

- [ ] **Step 1: Modify PrescriptionForm to accept a locked drug**

In `frontend/src/components/PrescriptionForm.tsx`:
- Add `lockedDrug?: { id: string; label: string }` to `PrescriptionFormProps`.
- Initialize `const [drugId, setDrugId] = useState(lockedDrug?.id ?? initial?.drugId ?? '')`.
- When `lockedDrug` is set, render (instead of the `<select>`):

```tsx
<div>
  <label style={lbl}>Drug</label>
  <div style={{ ...inp, display: 'flex', alignItems: 'center', background: '#F0F9FB' }}>
    {lockedDrug.label}
  </div>
</div>
```

- Skip calling `useDrugs()` when `lockedDrug` is set is optional; leaving it is harmless. Keep the rest of the form unchanged.

- [ ] **Step 2: Type-check the form change**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit`
Expected: no errors (existing callers pass no `lockedDrug`).

- [ ] **Step 3: Build the candidate popup**

Create `frontend/src/components/MedicineSuggestPopup.tsx`. A centered modal (overlay + card) listing candidates; the first is highlighted as the top match with its `matchType` shown. Port the *shape* of `demo/src/components/MedicineSuggestPopup.jsx` but render as a centered modal (not canvas-anchored) using inline styles:

```tsx
import type { DrugSearchResult } from '@pharmassist/shared'

interface Props {
  results: DrugSearchResult[]
  isLoading: boolean
  onSelect: (r: DrugSearchResult) => void
  onDismiss: () => void
}

const MATCH_LABEL: Record<DrugSearchResult['matchType'], string> = {
  exact: 'Exact match', brand: 'Brand match', prefix: 'Prefix match',
  substring: 'Contains', token: 'Root match', phonetic: 'Sounds like', fuzzy: 'Closest match',
}

export default function MedicineSuggestPopup({ results, isLoading, onSelect, onDismiss }: Props) {
  return (
    <div onClick={onDismiss} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Is this the medicine?</h3>
        {isLoading && <p style={muted}>Searching…</p>}
        {!isLoading && results.length === 0 && <p style={muted}>No match found. Try again.</p>}
        {results.map((r, i) => (
          <button key={r.id} onClick={() => onSelect(r)} style={row(i === 0)}>
            <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{r.label}</span>
            <span style={badge}>{MATCH_LABEL[r.matchType]}</span>
          </button>
        ))}
        <button onClick={onDismiss} style={cancel}>Cancel</button>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const card: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: 20, width: 'min(480px, 92vw)', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }
const muted: React.CSSProperties = { fontSize: 13, color: '#64748B' }
const row = (top: boolean): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: `1px solid ${top ? '#0AADA8' : '#D9E8EF'}`, background: top ? '#F0FBFA' : '#fff', cursor: 'pointer', textAlign: 'left' })
const badge: React.CSSProperties = { fontSize: 11, color: '#0AADA8', fontWeight: 600, whiteSpace: 'nowrap' }
const cancel: React.CSSProperties = { marginTop: 4, padding: '8px 12px', borderRadius: 8, border: '1px solid #D9E8EF', background: '#fff', cursor: 'pointer', fontSize: 13 }
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MedicineSuggestPopup.tsx frontend/src/components/PrescriptionForm.tsx
git commit -m "feat(frontend): add candidate popup and lockable prescription form"
```

---

## Task 12: Assemble PrescriptionWriterPage

**Files:**
- Create: `frontend/src/pages/PrescriptionWriterPage.tsx` (replaces the branch version — write fresh on the new architecture)

**Interfaces:**
- Consumes: `usePatients` (`api/patients`), `useCreatePrescription` (`api/prescriptions`), `useDrugSearch` (Task 7), `searchResultToInitialRx` (Task 7), `VoiceAgent` (Task 10), `Whiteboard` (Task 9), `MedicineSuggestPopup` (Task 11), `PrescriptionForm` with `lockedDrug` (Task 11), `useMe` (`api/auth`) for the prescriber name.
- Produces: default-exported `PrescriptionWriterPage` component taking **no props** (data comes from hooks).

- [ ] **Step 1: Build the page**

Create `frontend/src/pages/PrescriptionWriterPage.tsx`:

```tsx
import { useState } from 'react'
import type { DrugSearchResult, CreatePrescriptionRequest } from '@pharmassist/shared'
import { usePatients } from '../api/patients'
import { useCreatePrescription } from '../api/prescriptions'
import { useMe } from '../api/auth'
import { useDrugSearch } from '../api/drugs'
import { searchResultToInitialRx } from '../lib/mapSearchResult'
import VoiceAgent from '../components/VoiceAgent'
import Whiteboard from '../components/Whiteboard'
import MedicineSuggestPopup from '../components/MedicineSuggestPopup'
import PrescriptionForm from '../components/PrescriptionForm'
import AsyncState from '../components/AsyncState'

type Mode = 'speak' | 'write'

export default function PrescriptionWriterPage() {
  const { data: me } = useMe()
  const patientsQuery = usePatients()
  const createRx = useCreatePrescription()

  const [patientId, setPatientId] = useState('')
  const [mode, setMode] = useState<Mode>('speak')
  const [query, setQuery] = useState('')          // recognized text feeding the search
  const [showSuggest, setShowSuggest] = useState(false)
  const [confirmed, setConfirmed] = useState<DrugSearchResult | null>(null) // opens Popup 2
  const [savedCount, setSavedCount] = useState(0)

  const searchQuery = useDrugSearch(query)

  const onRecognize = (text: string) => {
    if (!text.trim()) return
    setQuery(text.trim())
    setShowSuggest(true)
  }

  const handleSelectCandidate = (r: DrugSearchResult) => {
    setShowSuggest(false)
    setConfirmed(r)               // open Popup 2 (details)
  }

  const handleSave = (rx: CreatePrescriptionRequest) => {
    createRx.mutate(
      { patientId, input: rx },
      {
        onSuccess: () => {
          setConfirmed(null)
          setQuery('')
          setSavedCount((n) => n + 1)
        },
      },
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Prescription Writer</h1>

      {/* Patient select */}
      <AsyncState query={patientsQuery}>
        {(patients) => (
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} style={select}>
            <option value="">Select a patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.mrn}</option>
            ))}
          </select>
        )}
      </AsyncState>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setMode('speak')} style={tab(mode === 'speak')}>Speak</button>
        <button onClick={() => setMode('write')} style={tab(mode === 'write')}>Write</button>
      </div>

      {/* Input surface (disabled until a patient is chosen) */}
      <div style={{ opacity: patientId ? 1 : 0.5, pointerEvents: patientId ? 'auto' : 'none' }}>
        {mode === 'speak'
          ? <VoiceAgent onRecognize={onRecognize} />
          : <Whiteboard onWordSettled={(w) => onRecognize(w.label)} />}
      </div>

      {savedCount > 0 && (
        <p style={{ fontSize: 13, color: '#0AADA8' }}>{savedCount} prescription(s) added.</p>
      )}

      {/* Popup 1: confirm drug */}
      {showSuggest && (
        <MedicineSuggestPopup
          results={searchQuery.data ?? []}
          isLoading={searchQuery.isLoading}
          onSelect={handleSelectCandidate}
          onDismiss={() => setShowSuggest(false)}
        />
      )}

      {/* Popup 2: prescription details */}
      {confirmed && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, width: 'min(560px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Prescription details</h3>
            <PrescriptionForm
              prescribedBy={me?.displayName ?? ''}
              lockedDrug={{ id: confirmed.id, label: confirmed.label }}
              initial={searchResultToInitialRx(confirmed)}
              onSave={handleSave}
              onCancel={() => setConfirmed(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

const select: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #D9E8EF', fontSize: 14 }
const tab = (active: boolean): React.CSSProperties => ({ padding: '8px 18px', borderRadius: 8, border: `1px solid ${active ? '#0AADA8' : '#D9E8EF'}`, background: active ? '#0AADA8' : '#fff', color: active ? '#fff' : '#0F172A', cursor: 'pointer', fontWeight: 600, fontSize: 13 })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
```

Confirm the real prop names of `AsyncState` (`frontend/src/components/AsyncState.tsx`) and adapt the render-prop usage to match; if `AsyncState` takes different props, replace it with an inline `patientsQuery.isLoading` / `.data` guard.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PrescriptionWriterPage.tsx
git commit -m "feat(frontend): assemble prescription writer page with two-popup flow"
```

---

## Task 13: Wire routing and verify end-to-end

**Files:**
- Modify: `frontend/src/types.ts` (add `'prescription-writer'` to `Page`)
- Modify: `frontend/src/App.tsx` (render the page)
- Modify: `frontend/src/components/Layout.tsx` (doctor nav item + `PenIcon`)

**Interfaces:**
- Consumes: `PrescriptionWriterPage` (Task 12).
- Produces: navigable `prescription-writer` route in the doctor sidebar.

- [ ] **Step 1: Extend the Page union**

In `frontend/src/types.ts`, add `| 'prescription-writer'` to the `Page` type (mirrors the branch diff).

- [ ] **Step 2: Render in App.tsx**

In `frontend/src/App.tsx`, import `PrescriptionWriterPage` and add a case (no props):

```tsx
case 'prescription-writer':
  return <PrescriptionWriterPage />
```

- [ ] **Step 3: Add the doctor nav item**

In `frontend/src/components/Layout.tsx`, add a `PenIcon` (copy the SVG from the branch's `Layout.tsx` diff) and insert into `NAV_DOCTOR`:

```tsx
{ page: 'prescription-writer', label: 'Prescription Writer', icon: <PenIcon /> },
```

(Place it before `My Prescriptions`, matching the branch.)

- [ ] **Step 4: Type-check and unit tests**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit && pnpm --filter @pharmassist/frontend test`
Expected: no type errors; all unit tests pass.

- [ ] **Step 5: Browser verification (the real proof)**

Start the dev servers (backend + frontend) via the project's launch config, seed the medicines once, and verify in the browser preview:

```bash
pnpm --filter @pharmassist/backend seed:medicines
```

Then, using the browser preview workflow:
1. Log in as a doctor; open **Prescription Writer** from the sidebar.
2. Select a patient. In **Speak** mode, use the mic (or, if the preview has no mic, temporarily drive `onRecognize('amoxicillin')` to exercise the path) → Popup 1 lists ranked candidates from `/api/drugs/search` → pick one → Popup 2 (`PrescriptionForm`) opens with the drug locked and dose preset → fill frequency/timeOfDay/duration → Save.
3. Confirm the network tab shows `POST /api/patients/:id/prescriptions` returning 200, and the patient's prescriptions now include it.
4. Switch to **Write** mode; if MyScript keys are set in `frontend/.env`, handwrite a name and confirm the same popup flow fires; if not, confirm the graceful "add keys" banner shows and drawing still works.

Capture a screenshot of a completed save as proof.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(frontend): wire prescription-writer route into doctor nav"
```

---

## Self-Review

**Spec coverage:**
- Seed all CSV → `Drug` (decision A): Tasks 3, 4. ✓
- Server-side tiered matcher: Task 2, exposed via boot index Task 5. ✓
- `GET /api/drugs/search`: Task 6. ✓
- Bounded plain catalog (blast-radius fix the spec flagged): Task 6, Step 3. ✓
- Rebuilt page on React Query (drop prop-drill): Task 12. ✓
- Speak = Web Speech client-side: Task 10. ✓
- Write = demo canvas: Task 9. ✓
- Two-popup confirm→details: Tasks 11–12. ✓
- Routing/nav re-fit: Task 13. ✓
- Structured dose entry via existing form: Tasks 11–12. ✓

**Placeholder scan:** No "TBD"/"handle edge cases" left. Ports (Whiteboard, VoiceAgent) reference exact in-repo source files already read, with each required change enumerated — not "similar to". Test helper names in Tasks 5–6 explicitly instruct verifying the real helper before use.

**Type consistency:** `DrugSearchResult`/`MatchType` (Task 1) are the single shape returned by `searchDrugIndex` (Task 2), `app.drugSearch.search` (Task 5), the route (Task 6), and `useDrugSearch` (Task 7), and consumed by the popup and mapper (Tasks 7, 11). `searchResultToInitialRx` returns `{ drugId, dose }` matching `PrescriptionForm`'s `initial` (Task 11). `onRecognize(transcript)` (Task 10) and `onWordSettled({label,box})` (Task 9) both feed the page's single `onRecognize` (Task 12).

**Open confirmations folded into steps (not placeholders):** real `AsyncState` props (Task 12), real auth-test helper (Task 6), `prismaPlugin` name for the `dependencies` array (Task 5).
