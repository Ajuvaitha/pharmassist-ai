# Pharmassist Backend — Phases 5–6 (Hardening & Documentation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear every piece of technical debt the Phase 0–4 reviews logged, make the API safe to deploy split-origin, and replace two API documents that describe an API that was never built.

**Architecture:** No new features. Three shared seams are extracted from code that currently re-derives them per module — date parsing, ward scoping, and query-key naming — then the deployment gaps (CORS, login rate limiting) are closed, the speculative indexes are settled against real `EXPLAIN` output, and the two stale documents are rewritten from the shipped routes.

**Tech Stack:** Node 22, pnpm 10+, TypeScript 5.7, Fastify 5, Prisma 6, PostgreSQL 16, Zod 4, Vitest 3, React 19, Vite 8.

**Source spec:** `docs/superpowers/specs/2026-08-06-pharmassist-backend-design.md`
**Builds on:** Phases 0–2 and 3–4, both complete on branch `feat/backend-foundation`. 209 tests pass (183 backend, 16 shared, 10 frontend).

## Global Constraints

- Node 22, pnpm 10+. Work continues on branch `feat/backend-foundation`.
- **This plan changes no behaviour that a user can observe**, with two deliberate exceptions: CORS headers (Task 4) and login rate limiting (Task 4). Every other task is a refactor, a test, an index, or a document. If a task finds itself changing what an endpoint returns, stop and report.
- The full suite must pass after every task: `pnpm --filter @pharmassist/backend test` (allow 6 minutes), `pnpm --filter @pharmassist/shared test`, `pnpm --filter figma-make-app test`.
- No type suppression anywhere: no `@ts-nocheck`, `@ts-ignore`, `as any`, no `!` non-null assertions. No unused imports.
- `routes.ts` files carry HTTP and Zod validation only. `service.ts` files are the only layer permitted to touch Prisma.
- Money stays `Decimal` end to end for anything persisted, and reaches the client as `number`.
- Ward scoping FAILS CLOSED. `User.wardId` is nullable, so a nurse account with no assigned ward is constructible; every scoping path must throw rather than fall through to an unscoped query. This was a real privilege leak twice in this project.
- Calendar-day columns are `@db.Date`; all day arithmetic is UTC whole-day arithmetic via `backend/src/domain/dates.ts`.

## What This Plan Clears

Every item below was found by a review during Phases 0–4 and deliberately deferred to here.

| Item | Task |
|---|---|
| `parseDate` duplicated in `indents/routes.ts` and `billing/routes.ts`; a third variant `dayRange` in `activity/service.ts` | 1 |
| `activity` service takes `date` as a `string` while billing/indents take a `Date` | 1 |
| `assertWardAccess` lives inside the patients module but is imported by indents, billing and prescriptions | 2 |
| `scopeFor` near-duplicated in `patients/service.ts` and `billing/service.ts`, with a third shape in `activity/service.ts` | 2 |
| Query-key factories exported but bypassed by hand-written literals | 3 |
| `useSweep` invalidates five queries even for `preview: true`, which writes nothing | 3 |
| Unused exports: `SessionWard`, `WARD_SEPARATOR`, `SESSION_COOKIE`, unused key factories | 3 |
| No CORS plugin — a split-origin production deploy breaks cookies silently | 4 |
| No login rate limit — password guessing is unthrottled | 4 |
| Speculative indexes: `User @@index([wardId])`, `ActivityEvent @@index([type, occurredAt])` | 5 |
| `runSweep`'s per-ward loop is not transactional across wards | 5 |
| `API_ENDPOINTS_DETAILED.md` describes `/inpatient/...` paths that were never built | 6 |
| `INPATIENT_AUTO_INDENT_MODULE_SPEC.md` documents `POST /inpatient/indents/fulfill`, shipped as `POST /api/indents/dispense` | 7 |

---

## Task 1: One date seam

**Files:**
- Modify: `backend/src/domain/dates.ts`
- Modify: `backend/src/modules/indents/routes.ts`
- Modify: `backend/src/modules/billing/routes.ts`
- Modify: `backend/src/modules/activity/service.ts`
- Modify: `backend/src/modules/activity/routes.ts`
- Test: `backend/src/domain/dates.test.ts`
- Test: `backend/src/modules/activity/service.test.ts`

**Interfaces:**
- Consumes: existing `startOfUtcDay`, `todayUtc`, `toDateString`.
- Produces: `parseIsoDate(value: string): Date` and `parseOptionalIsoDate(value?: string): Date | undefined` in `dates.ts`; `utcDayRange(date: Date): { gte: Date; lt: Date }` in `dates.ts`; `listActivity` changes its `query.date` from `string` to `Date | undefined`.

**Why.** Three files parse a `YYYY-MM-DD` string into a UTC `Date` with three separate implementations, none using `domain/dates.ts`. A fourth will be added the next time someone writes a dated endpoint. Worse, `activity`'s service takes a date `string` while `billing`, `indents` and `patients` take a `Date` — so a caller moving between modules has to remember which convention applies.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/domain/dates.test.ts`:

```ts
import { parseIsoDate, parseOptionalIsoDate, utcDayRange } from './dates'

describe('parseIsoDate', () => {
  it('parses a calendar date to UTC midnight', () => {
    expect(parseIsoDate('2026-08-06').toISOString()).toBe('2026-08-06T00:00:00.000Z')
  })

  it('is unaffected by the host timezone', () => {
    // A local-time implementation would shift this by the host's offset.
    expect(parseIsoDate('2026-01-01').getUTCDate()).toBe(1)
    expect(parseIsoDate('2026-07-01').getUTCDate()).toBe(1)
  })

  it('rejects a malformed date rather than producing an Invalid Date', () => {
    expect(() => parseIsoDate('06-08-2026')).toThrow()
    expect(() => parseIsoDate('2026-13-01')).toThrow()
    expect(() => parseIsoDate('')).toThrow()
  })
})

describe('parseOptionalIsoDate', () => {
  it('returns undefined for an absent value', () => {
    expect(parseOptionalIsoDate(undefined)).toBeUndefined()
  })

  it('parses a present value', () => {
    expect(parseOptionalIsoDate('2026-08-06')?.toISOString()).toBe('2026-08-06T00:00:00.000Z')
  })
})

describe('utcDayRange', () => {
  it('is half-open — the next day is excluded', () => {
    const range = utcDayRange(new Date('2026-08-06T13:00:00Z'))
    expect(range.gte.toISOString()).toBe('2026-08-06T00:00:00.000Z')
    expect(range.lt.toISOString()).toBe('2026-08-07T00:00:00.000Z')
  })

  it('normalises a value carrying a time component', () => {
    const range = utcDayRange(new Date('2026-08-06T23:59:59Z'))
    expect(range.gte.toISOString()).toBe('2026-08-06T00:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/domain/dates.test.ts`
Expected: FAIL — the three functions are not exported.

- [ ] **Step 3: Add the helpers**

Append to `backend/src/domain/dates.ts`:

```ts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parses a calendar date to UTC midnight. Throws rather than returning an
 * Invalid Date, which would otherwise flow silently into a `@db.Date`
 * query and match nothing.
 */
export function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, received "${value}"`)
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(`"${value}" is not a real calendar date`)
  }

  return parsed
}

export function parseOptionalIsoDate(value?: string): Date | undefined {
  return value === undefined ? undefined : parseIsoDate(value)
}

/** Half-open UTC day range, for filtering a timestamp column by calendar day. */
export function utcDayRange(date: Date): { gte: Date; lt: Date } {
  const start = startOfUtcDay(date)
  return { gte: start, lt: new Date(start.getTime() + MS_PER_DAY) }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test src/domain/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace the three duplicates**

In `backend/src/modules/indents/routes.ts`: delete the local `parseDate` function and import `parseOptionalIsoDate` from `../../domain/dates`, using it at each of its three call sites.

In `backend/src/modules/billing/routes.ts`: do the same.

In `backend/src/modules/activity/service.ts`: delete the local `dayRange` function. Change `listActivity`'s query handling so `date` is a `Date | undefined` rather than a `string`, and use `utcDayRange` from `../../domain/dates`. Define the service's own query interface rather than reusing the wire schema's type directly:

```ts
export interface ActivityQueryInput {
  type?: ActivityQuery['type']
  date?: Date
  limit: number
}
```

In `backend/src/modules/activity/routes.ts`: parse the query with `activityQuerySchema` as now, then convert `date` with `parseOptionalIsoDate` before calling the service — matching how `billing` and `indents` routes already do it.

- [ ] **Step 6: Update the activity tests**

In `backend/src/modules/activity/service.test.ts`, the date-filter test currently passes `date: '2026-08-05'`. Change it to `date: new Date('2026-08-05T00:00:00.000Z')`. Add one test asserting a `Date` carrying a time component still selects the right calendar day:

```ts
  it('normalises a date carrying a time component', async () => {
    await makeEvent('restock', 'on the 5th', new Date('2026-08-05T07:00:00Z'))
    await makeEvent('restock', 'on the 6th', new Date('2026-08-06T07:00:00Z'))

    const items = await listActivity(prisma, await viewerFor('k.asante'), {
      date: new Date('2026-08-05T18:30:00Z'),
      limit: 50,
    })

    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('on the 5th')
  })
```

- [ ] **Step 7: Verify no duplicates remain**

Run: `grep -rn "T00:00:00" backend/src --include=*.ts | grep -v test | grep -v domain/dates.ts || echo "single date seam"`
Expected: `single date seam`.

- [ ] **Step 8: Run the full suite**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — all prior tests plus the new ones.

- [ ] **Step 9: Commit**

```bash
git add backend/src
git commit -m "refactor(backend): give date parsing one seam

Three files parsed a YYYY-MM-DD string into a UTC Date three different
ways, none of them using domain/dates, and the activity service took a
date string while every sibling took a Date. parseIsoDate now throws on a
malformed value instead of producing an Invalid Date that would flow into
a @db.Date query and silently match nothing."
```

---

## Task 2: One ward-scoping seam

**Files:**
- Create: `backend/src/domain/scoping.ts`
- Modify: `backend/src/modules/patients/service.ts`
- Modify: `backend/src/modules/billing/service.ts`
- Modify: `backend/src/modules/activity/service.ts`
- Modify: `backend/src/modules/indents/service.ts`
- Modify: `backend/src/modules/prescriptions/service.ts`
- Test: `backend/src/domain/scoping.test.ts`

**Interfaces:**
- Produces: `assertWardAccess(viewer: SessionUser, wardId: string): void` and `wardScopeFor(viewer: SessionUser, requestedWardId?: string): { wardId: string } | Record<string, never>`, both in `backend/src/domain/scoping.ts`. `patients/service.ts` stops exporting `assertWardAccess`.

**Why.** `assertWardAccess` currently lives in the patients module and is imported by indents, billing and prescriptions — so four modules depend on the patients module for a rule that has nothing to do with patients. `scopeFor` is near-duplicated in patients and billing and takes a third shape in activity. This is the rule that failed open twice in this project; it should exist once, in one file, with its own tests.

**A note on the activity variant.** Activity scoping is genuinely different — a nurse sees their ward's events **plus** pharmacy-wide events carrying no ward. Do not force it into the shared helper. It should call the shared `assertWardAccess`-style guard for the no-ward case and keep its own `OR` clause.

- [ ] **Step 1: Write the failing test**

`backend/src/domain/scoping.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { SessionUser } from '@pharmassist/shared'
import { AppError } from '../errors'
import { assertWardAccess, wardScopeFor } from './scoping'

function user(role: SessionUser['role'], wardId: string | null): SessionUser {
  return {
    id: 'u1',
    username: 'test',
    displayName: 'Test',
    role,
    ward: wardId
      ? { id: wardId, code: 'Ward 4A', name: 'General Medicine', label: 'Ward 4A — General Medicine' }
      : null,
  }
}

describe('assertWardAccess', () => {
  it('permits a nurse their own ward', () => {
    expect(() => assertWardAccess(user('nurse', 'w1'), 'w1')).not.toThrow()
  })

  it('denies a nurse another ward', () => {
    expect(() => assertWardAccess(user('nurse', 'w1'), 'w2')).toThrow(AppError)
  })

  it('denies a nurse with no assigned ward, rather than permitting everything', () => {
    expect(() => assertWardAccess(user('nurse', null), 'w1')).toThrow(AppError)
  })

  it('denies with 403, not 404 — a 404 would leak whether the ward exists', () => {
    const error = (() => {
      try {
        assertWardAccess(user('nurse', 'w1'), 'w2')
        return null
      } catch (e) {
        return e
      }
    })()

    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).statusCode).toBe(403)
  })

  it('is a no-op for a pharmacist and a doctor', () => {
    expect(() => assertWardAccess(user('pharmacist', null), 'w9')).not.toThrow()
    expect(() => assertWardAccess(user('doctor', null), 'w9')).not.toThrow()
  })
})

describe('wardScopeFor', () => {
  it('scopes a nurse to their own ward', () => {
    expect(wardScopeFor(user('nurse', 'w1'))).toEqual({ wardId: 'w1' })
  })

  it('throws for a nurse with no assigned ward', () => {
    expect(() => wardScopeFor(user('nurse', null))).toThrow(AppError)
  })

  it('throws when a nurse requests another ward', () => {
    expect(() => wardScopeFor(user('nurse', 'w1'), 'w2')).toThrow(AppError)
  })

  it('honours a requested ward for a pharmacist', () => {
    expect(wardScopeFor(user('pharmacist', null), 'w3')).toEqual({ wardId: 'w3' })
  })

  it('returns an unscoped filter for a pharmacist with no request', () => {
    expect(wardScopeFor(user('pharmacist', null))).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/domain/scoping.test.ts`
Expected: FAIL — cannot resolve `./scoping`.

- [ ] **Step 3: Write the shared module**

`backend/src/domain/scoping.ts`:

```ts
import type { SessionUser } from '@pharmassist/shared'
import { AppError } from '../errors'

/**
 * A nurse may only reach their assigned ward. Every other role is
 * unrestricted.
 *
 * Fails closed: `User.wardId` is nullable, so a nurse account with no ward
 * is constructible, and letting that fall through to an unscoped query is
 * a privilege leak — it has happened twice in this codebase.
 *
 * This performs NO ward-existence validation. A passing call does not mean
 * `wardId` names a real ward; callers that need that must check it.
 */
export function assertWardAccess(viewer: SessionUser, wardId: string): void {
  if (viewer.role !== 'nurse') return
  if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
  if (viewer.ward.id === wardId) return

  // 403 rather than 404: a 404 would reveal whether the ward exists.
  throw AppError.forbidden('You do not have access to that ward')
}

/**
 * The `wardId` filter fragment for a list query. Spread it into a Prisma
 * `where` alongside other conditions — Prisma ANDs sibling keys, so the
 * scope cannot be widened by whatever it is combined with.
 */
export function wardScopeFor(
  viewer: SessionUser,
  requestedWardId?: string,
): { wardId: string } | Record<string, never> {
  if (viewer.role === 'nurse') {
    if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
    if (requestedWardId) assertWardAccess(viewer, requestedWardId)
    return { wardId: viewer.ward.id }
  }

  return requestedWardId ? { wardId: requestedWardId } : {}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test src/domain/scoping.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Point every module at the shared seam**

- `backend/src/modules/patients/service.ts`: delete its local `assertWardAccess` and `scopeFor`; import both from `../../domain/scoping` and use `wardScopeFor` where `scopeFor` was called. Remove the `export` keyword situation entirely — nothing should import scoping from the patients module any more.
- `backend/src/modules/billing/service.ts`: delete its local `scopeFor`; import `wardScopeFor` and `assertWardAccess` from `../../domain/scoping`.
- `backend/src/modules/indents/service.ts` and `backend/src/modules/prescriptions/service.ts`: change their `assertWardAccess` import from `../patients/service` to `../../domain/scoping`.
- `backend/src/modules/activity/service.ts`: keep its own `scopeFor` — its rule genuinely differs (ward events **plus** ward-less pharmacy-wide events) — but have it call the shared guard for the no-ward case so the failure mode is defined in one place.

- [ ] **Step 6: Verify nothing imports scoping from the patients module**

Run: `grep -rn "assertWardAccess" backend/src --include=*.ts | grep "patients/service" || echo "patients module no longer owns scoping"`
Expected: `patients module no longer owns scoping`.

- [ ] **Step 7: Run the full suite**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS. Every existing scoping test in wards, patients, billing and activity must still pass unchanged — this is a move, not a behaviour change.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "refactor(backend): give ward scoping one seam

assertWardAccess lived in the patients module and was imported by indents,
billing and prescriptions, so four modules depended on patients for a rule
that has nothing to do with patients — and scopeFor was near-duplicated
between patients and billing. This is the rule that failed open twice in
this project, so it now exists once, with its own tests for the
nurse-with-no-ward case. Activity keeps its own variant, which genuinely
differs, but defers to the shared guard for the failure mode."
```

---

## Task 3: Remove what the migration left behind

**Files:**
- Modify: `frontend/src/api/indents.ts`
- Modify: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/ward.ts`
- Modify: `backend/src/plugins/auth.ts`
- Modify: whichever hook files still export an unused key factory

**Interfaces:**
- Produces: no new exports. Removes unused ones.

**Why.** The phased migration left exports nothing imports and one invalidation that fires for an operation that writes nothing. Dead exports are not free: the key-factory ones in particular were exported, ignored in favour of hand-written literals, and that gap was the root cause of two stale-UI bugs found in the Phase 3–4 final review.

- [ ] **Step 1: Find what is genuinely unused**

Run this and read the output — do not assume:

```bash
cd /home/kavin/Projects/pharmassist-ai
for sym in SessionWard WARD_SEPARATOR SESSION_COOKIE patientsQueryKey patientQueryKey billingQueryKey activityQueryKey pickupListQueryKey inventoryQueryKey categoriesQueryKey drugsQueryKey meQueryKey wardsQueryKey; do
  n=$(grep -rn "\b$sym\b" backend/src packages/shared/src frontend/src --include=*.ts --include=*.tsx | grep -v "export " | wc -l)
  echo "$sym: $n non-export references"
done
```

A symbol with 0 non-export references is dead. A symbol used only inside its own defining file does not need to be exported.

- [ ] **Step 2: Remove the dead exports**

For each symbol with zero non-export references: delete it if nothing needs it, or drop the `export` keyword if its own module still uses it. Do NOT delete a symbol that is part of a public contract another package legitimately consumes — check before removing. `SESSION_COOKIE` in particular: confirm no test references it before removing.

- [ ] **Step 3: Stop `useSweep` invalidating on preview**

`frontend/src/api/indents.ts`'s `useSweep` reuses the dispense invalidator, so a `preview: true` call — which writes nothing — triggers five refetches. Make the invalidation conditional on the request not being a preview:

```ts
export function useSweep() {
  const invalidate = useInvalidateAfterDispense()

  return useMutation({
    mutationFn: (input: { date?: string; wardId?: string; preview?: boolean } = {}) =>
      apiPost<SweepResult>('/api/indents/sweep', input),
    onSuccess: (_result, input) => {
      // A preview writes nothing, so there is nothing to refetch.
      if (input?.preview) return
      invalidate()
    },
  })
}
```

Also rename `useInvalidateAfterDispense` to something that reflects both callers, e.g. `useInvalidateWardState` — a sweep is not a dispense.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @pharmassist/backend test && pnpm --filter @pharmassist/shared test && pnpm --filter figma-make-app test`
Run: `pnpm --filter @pharmassist/backend exec tsc --noEmit && pnpm --filter figma-make-app exec tsc --noEmit && pnpm --filter figma-make-app build`
Expected: all clean. `tsc` is the real check here — removing a still-used export breaks the build.

- [ ] **Step 5: Commit**

```bash
git add backend/src packages/shared/src frontend/src
git commit -m "chore: remove exports the phased migration left behind

Dead exports are not free — the query-key factories were exported, then
ignored in favour of hand-written literals, and that gap was the root
cause of two stale-UI bugs found in the last review. Also stops a sweep
preview, which writes nothing, from invalidating five queries."
```

---

## Task 4: CORS and login rate limiting

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/env.ts`
- Modify: `backend/src/env.test.ts`
- Create: `backend/src/plugins/security.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/.env.example`
- Test: `backend/src/plugins/security.test.ts`

**Interfaces:**
- Consumes: `loadEnv`.
- Produces: `securityPlugin`; new env var `CORS_ORIGIN` (optional; when absent, no CORS headers are sent and the app is same-origin only).

**Why.** Development works because Vite proxies `/api`, making the session cookie first-party. A production deploy that serves the frontend from a different origin gets no CORS headers, the browser drops the cookie, and every request is anonymous — with no error explaining it. Separately, `POST /api/auth/login` has no throttle, so password guessing is limited only by network speed.

**The security shape that matters.** With credentials, CORS `origin` must NEVER be `true` or `*` — a wildcard with `credentials: true` is rejected by browsers, and worse, an echo-the-request-origin implementation would let any site make authenticated requests. The origin must come from configuration and be matched exactly.

- [ ] **Step 1: Add the dependencies**

Add to `backend/package.json` dependencies: `"@fastify/cors": "^10.0.0"` and `"@fastify/rate-limit": "^10.0.0"`.

Run: `pnpm install`

If pnpm 11 stalls on a build approval, add the package to the existing `allowBuilds` key in `pnpm-workspace.yaml` and say so in your report.

- [ ] **Step 2: Write the failing test**

`backend/src/plugins/security.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { seed } from '../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../test/db'
import { buildTestApp } from '../test/helpers'

const prisma = getTestPrisma()
let app: FastifyInstance

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
  app = await buildTestApp()
})

afterEach(async () => {
  await app.close()
})

function login(payload: { username: string; password: string }) {
  return app.inject({ method: 'POST', url: '/api/auth/login', payload })
}

describe('login rate limiting', () => {
  it('permits a normal number of attempts', async () => {
    const first = await login({ username: 'k.asante', password: 'pharmassist' })
    expect(first.statusCode).toBe(200)
  })

  it('throttles repeated failed attempts from one caller', async () => {
    const statuses: number[] = []
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await login({ username: 'k.asante', password: 'wrong' })
      statuses.push(response.statusCode)
    }

    // Early attempts are ordinary auth failures; later ones must be throttled.
    expect(statuses[0]).toBe(401)
    expect(statuses).toContain(429)
  })

  it('returns the error envelope when throttled, not a bare Fastify error', async () => {
    let throttled: Awaited<ReturnType<typeof login>> | null = null
    for (let attempt = 0; attempt < 12 && !throttled; attempt += 1) {
      const response = await login({ username: 'k.asante', password: 'wrong' })
      if (response.statusCode === 429) throttled = response
    }

    expect(throttled).not.toBeNull()
    expect(throttled?.json()).toMatchObject({ success: false })
  })

  it('does not throttle ordinary reads', async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await app.inject({ method: 'GET', url: '/api/health' })
      expect(response.statusCode).toBe(200)
    }
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/plugins/security.test.ts`
Expected: FAIL — no 429 is ever returned.

- [ ] **Step 4: Add `CORS_ORIGIN` to the environment**

In `backend/src/env.ts`, add to the schema:

```ts
  /**
   * Comma-separated list of origins permitted to send credentialed
   * requests. Leave unset for a same-origin deployment (the Vite dev proxy
   * makes development same-origin). Never set this to "*" — a wildcard
   * cannot be combined with credentials.
   */
  CORS_ORIGIN: z.string().optional(),
```

Add a test to `backend/src/env.test.ts` asserting it is optional and that a value of `*` is rejected — add a `.refine` to the schema enforcing that, since a wildcard with credentials is the exact mistake this guards against.

Add to `backend/.env.example`:

```
# Comma-separated origins allowed to send credentialed requests.
# Leave unset for a same-origin deployment. Never "*".
# CORS_ORIGIN="https://pharmassist.example.org"
```

- [ ] **Step 5: Write the security plugin**

`backend/src/plugins/security.ts`:

```ts
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fp from 'fastify-plugin'
import { ErrorCode } from '@pharmassist/shared'
import type { FastifyPluginAsync } from 'fastify'
import { loadEnv } from '../env'

const securityPlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv()

  const origins = env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? []

  if (origins.length > 0) {
    await app.register(cors, {
      // An exact allow-list. Never `true` and never `*`: the session is a
      // credentialed cookie, and echoing the request origin would let any
      // site make authenticated requests on a signed-in user's behalf.
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    })
  }

  await app.register(rateLimit, {
    global: false,
    // Returns the envelope the rest of the API uses, rather than
    // Fastify's default error shape.
    errorResponseBuilder: () => ({
      success: false,
      error: ErrorCode.FORBIDDEN,
      message: 'Too many attempts. Wait a moment and try again.',
    }),
  })
}

export default fp(securityPlugin, { name: 'security' })
```

Register it in `backend/src/app.ts` BEFORE the route modules, after `errorsPlugin`.

- [ ] **Step 6: Throttle the login route only**

In `backend/src/modules/auth/routes.ts`, add a rate-limit config to the login route only — reads must stay unthrottled:

```ts
  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply): Promise<LoginResponse> => {
```

Keep the handler body exactly as it is.

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS, including the four new security tests.

**If the rate-limit tests are flaky because `app.inject` shares a source IP across tests**, that is expected — all injected requests come from the same synthetic address, which is exactly what the test wants. If instead the limiter never triggers, check that `global: false` plus the per-route `config.rateLimit` is wired, since a global limiter would also throttle the health check and fail the last test.

- [ ] **Step 8: Verify CORS is off by default and exact when on**

Run the dev server with no `CORS_ORIGIN` set and confirm no `access-control-allow-origin` header is returned:

```bash
pnpm --filter @pharmassist/backend dev
```

then in another terminal:

```bash
curl -si -H 'Origin: https://evil.example' localhost:3000/api/health | grep -i 'access-control-allow-origin' || echo "no CORS headers (same-origin mode) — correct"
```

Stop the dev server afterwards. Report the actual output.

- [ ] **Step 9: Commit**

```bash
git add backend packages pnpm-lock.yaml
git commit -m "feat(backend): add exact-origin CORS and a login rate limit

Development works because Vite proxies /api and the session cookie is
first-party. A split-origin production deploy gets no CORS headers, the
browser silently drops the cookie, and every request arrives anonymous
with nothing explaining why. The allow-list is exact and never a wildcard:
the session is a credentialed cookie, so echoing the request origin would
let any site act as a signed-in user. Login is throttled; reads are not."
```

---

## Task 5: Settle the speculative indexes against real EXPLAIN output

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<generated>/migration.sql`
- Create: `backend/scripts/explain-queries.ts`
- Modify: `backend/package.json` (add an `explain` script)

**Interfaces:**
- Produces: `backend/scripts/explain-queries.ts`, runnable with `pnpm --filter @pharmassist/backend explain`, printing the plan for each hot query.

**Why.** Two indexes were added on reasoning alone and flagged as speculative by review: `User @@index([wardId])` on a table of a few rows, and `ActivityEvent @@index([type, occurredAt])` which only pays if the feed actually filters by type. Guessing again would repeat the mistake. This task measures first, then changes the schema to match what the planner actually does — and leaves the script behind so the next person can re-measure.

**This is an ADDITIVE migration on a populated database.** Do not delete or regenerate the existing migrations.

- [ ] **Step 1: Write the EXPLAIN script**

`backend/scripts/explain-queries.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { loadEnv } from '../src/env'

/**
 * Prints the planner's chosen strategy for each query the app runs hot.
 * Index decisions in this schema are made from this output, not from
 * reasoning about selectivity — two indexes were previously added on
 * reasoning and flagged as speculative.
 */
const QUERIES: { label: string; sql: string }[] = [
  {
    label: 'sweep: active prescriptions for a ward, started on or before today',
    sql: `
      SELECT p.id FROM "Prescription" p
      JOIN "Patient" pt ON pt.id = p."patientId"
      WHERE p.status = 'active'
        AND p."startDate" <= CURRENT_DATE
        AND pt."wardId" = (SELECT id FROM "Ward" LIMIT 1)
        AND pt.status = 'admitted'
    `,
  },
  {
    label: 'pickup list: lines for one indent',
    sql: `
      SELECT l.id FROM "IndentLine" l
      WHERE l."indentId" = (SELECT id FROM "DailyIndent" LIMIT 1)
        AND l.status <> 'cancelled'
    `,
  },
  {
    label: 'billing: lines for one ward',
    sql: `SELECT b.id FROM "BillingLine" b WHERE b."wardId" = (SELECT id FROM "Ward" LIMIT 1)`,
  },
  {
    label: 'activity feed: most recent, unfiltered',
    sql: `SELECT e.id FROM "ActivityEvent" e ORDER BY e."occurredAt" DESC LIMIT 50`,
  },
  {
    label: 'activity feed: filtered by type',
    sql: `SELECT e.id FROM "ActivityEvent" e WHERE e.type = 'dispense' ORDER BY e."occurredAt" DESC LIMIT 50`,
  },
  {
    label: 'wards list: admitted patient count per ward',
    sql: `SELECT "wardId", count(*) FROM "Patient" WHERE status = 'admitted' GROUP BY "wardId"`,
  },
  {
    label: 'users: by ward (is User.wardId worth an index?)',
    sql: `SELECT id FROM "User" WHERE "wardId" = (SELECT id FROM "Ward" LIMIT 1)`,
  },
]

async function main(): Promise<void> {
  const env = loadEnv()
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })

  for (const query of QUERIES) {
    const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
      `EXPLAIN (ANALYZE, BUFFERS) ${query.sql}`,
    )
    console.log(`\n=== ${query.label} ===`)
    for (const row of rows) console.log(row['QUERY PLAN'])
  }

  await prisma.$disconnect()
}

await main()
```

Add to `backend/package.json` scripts: `"explain": "tsx scripts/explain-queries.ts"`.

- [ ] **Step 2: Run it and READ the output**

Run: `pnpm --filter @pharmassist/backend explain`

Record, for each query: whether the planner chose a **Seq Scan** or an **Index Scan**, and which index. Paste the full output into your report.

**Interpret honestly.** The seeded dataset is tiny — 5 patients, 15 prescriptions — and Postgres correctly prefers a sequential scan on a small table regardless of available indexes. A Seq Scan here is therefore NOT evidence that an index is useless. What you are looking for is:
- an index that the planner would not use even at scale because its leading column is not the one being filtered
- an index on a table that will never grow (`User`, `Ward`)

If the dataset is too small to distinguish, say so plainly rather than drawing a false conclusion.

- [ ] **Step 3: Seed a larger dataset and re-measure**

To get a meaningful plan, insert bulk rows into the two tables that actually grow — `ActivityEvent` and `BillingLine` — then re-run. Write this as a throwaway block inside the script guarded by an env flag, or as a separate SQL file you run with `docker exec pharmassist-db psql`:

```sql
INSERT INTO "ActivityEvent" (id, type, text, "occurredAt")
SELECT
  'seed-' || g,
  (ARRAY['dispense','prescription','stop','restock','register'])[1 + (g % 5)]::"ActivityType",
  'bulk event ' || g,
  NOW() - (g || ' minutes')::interval
FROM generate_series(1, 100000) g;
```

Re-run the explain script. Now the activity queries are meaningful. Record which index each uses.

**Clean up afterwards**: `DELETE FROM "ActivityEvent" WHERE id LIKE 'seed-%';` — do not leave 100k synthetic rows in the development database.

- [ ] **Step 4: Change the schema to match the measurements**

Based on what you actually observed:
- If the unfiltered activity feed uses `@@index([occurredAt])` and the type-filtered feed uses `@@index([type, occurredAt])`, keep both.
- If the type-filtered feed also uses `@@index([occurredAt])` and ignores the composite, DROP `@@index([type, occurredAt])`.
- `User @@index([wardId])`: the table holds one row per staff member and will never be large. Unless the plan shows otherwise, drop it — an index on a table that fits in a page costs writes and buys nothing.

Make the changes, then generate an ADDITIVE migration:

Run: `pnpm --filter @pharmassist/backend exec prisma migrate dev --name index_tuning`

Apply to the test database:

Run: `cd backend && TEST_URL=$(grep TEST_DATABASE_URL .env | cut -d'"' -f2) && DATABASE_URL="$TEST_URL" pnpm exec prisma migrate deploy && cd ..`

**Do not blindly auto-confirm any Prisma prompt.** An earlier task in this project piped `y` into a migration prompt; that was benign for an index change but the habit is dangerous. Read what it asks before answering.

- [ ] **Step 5: Verify**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — dropping an unused index changes no behaviour.

Run: `ls backend/prisma/migrations/` and confirm the earlier migrations are all still present.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "perf(backend): settle the speculative indexes against EXPLAIN output

Two indexes were added on reasoning about selectivity and flagged as
speculative. Rather than reason again, this measures: the explain script
is committed so the next person can re-measure instead of guessing, and
the schema now matches what the planner actually does on a dataset large
enough to be meaningful."
```

---

## Task 6: Rewrite `API_ENDPOINTS_DETAILED.md` from the shipped code

**Files:**
- Rewrite: `API_ENDPOINTS_DETAILED.md`
- Create: `backend/scripts/list-routes.ts`
- Modify: `backend/package.json` (add a `routes` script)

**Why.** The document describes an API that was never built. It specifies `/api/v1/inpatient/prescriptions`, `/inpatient/indents/fulfill` and a `daily_dosage_qty` field; what shipped is `/api/patients/:id/prescriptions`, `/api/indents/dispense`, and a `qty` derived from the dosing frequency. Someone integrating against this document today would fail on every call. It is closer to writing fresh than editing.

**The document must be generated from, and checked against, the running app** — not written from memory or from the plan. A document that drifts on day one is worse than no document.

- [ ] **Step 1: Write a route-listing script**

`backend/scripts/list-routes.ts`:

```ts
import { buildApp } from '../src/app'

/**
 * Prints every route the app actually registers. The API document is
 * written from this output, so it cannot describe an endpoint that does
 * not exist.
 */
const app = await buildApp()
await app.ready()
console.log(app.printRoutes({ commonPrefix: false }))
await app.close()
```

Add to `backend/package.json` scripts: `"routes": "tsx scripts/list-routes.ts"`.

Run: `pnpm --filter @pharmassist/backend routes`

Record the complete output. This is the authoritative list.

- [ ] **Step 2: Capture real request and response payloads**

Start the backend and exercise every endpoint, capturing actual responses. Sign in as `k.asante` / `pharmassist` (pharmacist), and separately as `b.kwame` (doctor, for prescribing) and `a.owusu` (nurse, for a scoped read and a 403).

For each endpoint record: method, path, required role, request body (where applicable), a real success response, and at least one real error response. Use `2026-08-03` as the working date — the seeded prescriptions are active then.

Capture the errors too, by actually causing them: a wrong password (401), a nurse reading another ward (403), an unknown patient (404), a second dispense (409 `BATCH_ALREADY_FULFILLED`), a second bill confirmation (409 `ALREADY_BILLED`), an unknown `drugId` on a prescription (400 `INVALID_INPUT`).

- [ ] **Step 3: Write the document**

Replace `API_ENDPOINTS_DETAILED.md` entirely. Structure it as:

1. **Base URL and authentication.** State plainly that the session is a JWT in an httpOnly, `SameSite=Lax` cookie named `pharmassist_session`, set by `POST /api/auth/login`, and that clients must send credentials with every request. Note that there is no `Authorization: Bearer` header — an integrator will otherwise assume there is.
2. **Roles**, and which role each endpoint requires.
3. **Ward scoping**, stated once: a nurse is restricted to their assigned ward server-side, and an out-of-ward request returns `403`, not `404` — because a 404 would leak whether the record exists.
4. **A summary table** of every endpoint from Step 1's output.
5. **One section per endpoint** with the real payloads captured in Step 2.
6. **The error envelope** `{ success: false, error: CODE, message }` and the full `ErrorCode` table, read from `packages/shared/src/errors.ts` — including `RX_NOT_ACTIVE` and `INTERNAL_ERROR`, which were added during implementation.
7. **A note on money**: values are JSON numbers with two decimal places; the currency is GHS and is not carried in the payload.
8. **A note on dates**: `YYYY-MM-DD` for calendar days, ISO-8601 for timestamps, everything UTC.

Every example must be output you actually captured. Do not invent a field.

- [ ] **Step 4: Verify the document against the code**

Run this and resolve every mismatch:

```bash
cd /home/kavin/Projects/pharmassist-ai
echo "=== documented paths not in the app ==="
comm -23 \
  <(grep -oP '`(?:GET|POST|PATCH|DELETE) \K/api[^`]*' API_ENDPOINTS_DETAILED.md | sed 's/:[a-zA-Z]*/:param/g' | sort -u) \
  <(pnpm --filter @pharmassist/backend routes 2>/dev/null | grep -oP '/api[^\s(]*' | sed 's/:[a-zA-Z]*/:param/g' | sort -u)
echo "=== app paths not documented ==="
comm -13 \
  <(grep -oP '`(?:GET|POST|PATCH|DELETE) \K/api[^`]*' API_ENDPOINTS_DETAILED.md | sed 's/:[a-zA-Z]*/:param/g' | sort -u) \
  <(pnpm --filter @pharmassist/backend routes 2>/dev/null | grep -oP '/api[^\s(]*' | sed 's/:[a-zA-Z]*/:param/g' | sort -u)
```

Both lists must be empty. If the `comm` comparison is awkward because of how you formatted the paths, adjust the extraction — but do not skip the check, and paste its output in your report.

- [ ] **Step 5: Verify every documented error code exists**

Run: `grep -oP "^\| \`\K[A-Z_]+" API_ENDPOINTS_DETAILED.md | sort -u` and compare against `grep -oP "^  \K[A-Z_]+(?=:)" packages/shared/src/errors.ts | sort -u`. Every documented code must exist; every existing code should be documented.

- [ ] **Step 6: Commit**

```bash
git add API_ENDPOINTS_DETAILED.md backend
git commit -m "docs: rewrite the API reference from the shipped routes

The document described an API that was never built — /api/v1/inpatient
paths, an indents/fulfill endpoint, a daily_dosage_qty field. Anyone
integrating against it would have failed on every call. It is now written
from printRoutes output and real captured payloads, and a committed
script regenerates that list so the next drift is visible."
```

---

## Task 7: Rewrite `INPATIENT_AUTO_INDENT_MODULE_SPEC.md` from the shipped system

**Files:**
- Rewrite: `INPATIENT_AUTO_INDENT_MODULE_SPEC.md`

**Why.** This document describes the same never-built API plus a SQL schema that does not match the shipped one and a sweep query that was never run. Unlike Task 6's reference, this one is the *explanatory* document — it should describe how the system works and why, so someone new can reason about it. It is the last artefact still describing the imaginary version.

- [ ] **Step 1: Read the shipped system**

Read these before writing a word:
- `backend/prisma/schema.prisma` — the real schema, 11 models.
- `backend/src/modules/indents/service.ts` — `runSweep`, `getPickupList`, `dispense`, `closeIndentIfComplete`.
- `packages/shared/src/frequency.ts` — the eight dosing codes and which are sweepable.
- `backend/src/jobs/sweep.ts` — the schedule.
- `docs/superpowers/specs/2026-08-06-pharmassist-backend-design.md` — the design intent.

- [ ] **Step 2: Write the document**

Replace `INPATIENT_AUTO_INDENT_MODULE_SPEC.md` entirely. It should explain, in this order:

1. **The problem.** Ward medication is prepared per patient per day; doing it by hand is slow and a stopped order can still be dispensed.
2. **The daily cycle.** Sweep at 06:00 → ward pickup list → dispense per patient → bill per patient. State plainly the invariant that makes the whole thing safe: **dispensing is the only thing that moves stock and the only thing that creates a billing line.**
3. **The data model.** The real 11 models with their actual field names, and specifically what each of the two idempotency constraints buys: `DailyIndent @@unique([wardId, indentDate])` and `IndentLine @@unique([indentId, prescriptionId])` are what let the sweep be re-run without preparing a patient's medication twice.
4. **The inclusion rule** — the five conditions a prescription must meet to generate a line on a given day, with the real function names. Include the table of the eight frequency codes: which are swept daily, that `Weekly` recurs every seventh day from the start date, and that `PRN` and `STAT` are never swept because they have no schedule.
5. **The dispense transaction**, step by step, and *why* the order matters: stock is checked for every line before any write, so a shortfall on the last line cannot leave earlier ones deducted; the unit price is snapshotted so a later catalog change cannot rewrite a past bill.
6. **Stop orders.** Cancelling pending future lines while leaving dispensed ones untouched — the patient received those and owes for them — and that cancelling the last pending line closes the indent.
7. **Derived vs stored.** `currentDay`, stock `status`, ward `sweepStatus` and `activePatients` are computed at read time, never stored. Say why: a stored `currentDay` is wrong the next morning.
8. **What is deliberately not built**, from the spec's out-of-scope list, so a reader does not go looking for a discharge workflow.

Do not include SQL that is not in a migration. If you want to show the sweep's selection, show the real TypeScript from `planLinesFor`.

- [ ] **Step 3: Verify the claims**

For every model, field name and function name the document mentions, confirm it exists:

```bash
cd /home/kavin/Projects/pharmassist-ai
for name in $(grep -oP '`\K[a-zA-Z_][a-zA-Z0-9_]*(?=`)' INPATIENT_AUTO_INDENT_MODULE_SPEC.md | sort -u); do
  grep -rq "\b$name\b" backend/src backend/prisma/schema.prisma packages/shared/src || echo "NOT FOUND IN CODE: $name"
done
```

Every reported name is either a real drift you must fix, or prose that happened to be in backticks — judge each, and report the ones you deliberately kept.

- [ ] **Step 4: Confirm no stale API paths survive anywhere**

Run: `grep -rn "inpatient/\|/api/v1\|daily_dosage_qty\|indents/fulfill" *.md || echo "no stale API references remain"`
Expected: `no stale API references remain`.

- [ ] **Step 5: Commit**

```bash
git add INPATIENT_AUTO_INDENT_MODULE_SPEC.md
git commit -m "docs: rewrite the auto-indent spec from the shipped system

The document described a SQL schema that does not match the one that
shipped and a sweep query that was never run. It now explains the real
daily cycle, the two unique constraints that make a re-run safe, why the
dispense transaction checks all stock before writing any of it, and which
values are derived rather than stored."
```

---

## Done criteria for Phases 5–6

- `pnpm -r test` passes; both packages typecheck; the frontend builds.
- Date parsing exists in exactly one place; no module re-derives it.
- Ward scoping exists in exactly one place, with its own tests for the nurse-with-no-ward case.
- No exported symbol is unreferenced.
- CORS is off by default, exact when configured, and never a wildcard with credentials.
- Login is rate-limited; reads are not.
- Every index in the schema is either measured or trivially justified.
- Both MD documents describe only endpoints that exist, verified by a script.

## Still deferred after this plan

From the spec's out-of-scope list, untouched and intentional: discharge workflow, bill voiding and refunds, refresh-token rotation, pagination beyond a `limit`, multi-hospital tenancy, importing `Medicine_Names.csv`, and anything from `demo/`. Also still open: `runSweep`'s per-ward loop is not transactional across wards (a crash mid-loop leaves some wards swept; a re-run self-heals it), and the 06:00 job logs a failure without retrying.
