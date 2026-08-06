# Pharmassist Backend — Phases 3–4 (Read Path & The Dispense Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every remaining mock data source in `frontend/` with real API calls, then build the dispense→stock→billing loop that the UI has never actually had.

**Architecture:** Continues the module convention from Phases 0–2 — each `backend/src/modules/<name>/` holds `routes.ts` (HTTP + Zod only), `service.ts` (the only layer touching Prisma), and tests. A new `backend/src/domain/dto.ts` is the single boundary where Prisma rows become the wire shapes `@pharmassist/shared` declares; nothing else may hand a Prisma row to a reply. Phase 4's sweep job and its REST endpoint call one shared service, so a manual re-trigger cannot drift from the scheduled run.

**Tech Stack:** Node 22, pnpm 10+, TypeScript 5.7, Fastify 5, Prisma 6, PostgreSQL 16, Zod 4, node-cron, Vitest 3, TanStack Query 5, React 19, Vite 8.

**Source spec:** `docs/superpowers/specs/2026-08-06-pharmassist-backend-design.md`
**Builds on:** `docs/superpowers/plans/2026-08-06-backend-phase-0-2-foundation.md` (complete, branch `feat/backend-foundation`)

## Global Constraints

- Node 22. pnpm 10 or newer. Work continues on branch `feat/backend-foundation`.
- **Money never crosses the wire as a Prisma `Decimal`.** Prisma serialises `Decimal` to a JSON **string**, but `@pharmassist/shared` declares `unitPrice` and `total` as `number`. Every money field must pass through `decimalToNumber()` in the DTO layer. A route that sends a raw Prisma row containing money is a defect.
- **Enums must be translated at the DTO boundary.** Prisma's `@map` renames only the stored value; the client is keyed by `after_food` while the UI speaks `after-food`. Use `toFoodTimingWire()` from `backend/src/domain/enums.ts`. Never send a raw Prisma enum value to the client.
- `routes.ts` contains HTTP and Zod validation only. `service.ts` is the only layer permitted to touch Prisma. `dto.ts` is pure mapping — no Prisma queries.
- Every API error uses the envelope `{ success: false, error: CODE, message }` with codes from `@pharmassist/shared`'s `ErrorCode`.
- All money is `Decimal(10,2)` in the database. Never `Float`.
- Calendar-day columns use `@db.Date`. Day arithmetic uses UTC whole-day comparison — never local time, never raw millisecond division on timestamps.
- Role guards are enforced **server-side** on every route. Nurses are scoped to their own `wardId`; a nurse requesting another ward gets `FORBIDDEN`, never a filtered-empty list.
- No type suppression anywhere: no `@ts-nocheck`, `@ts-ignore`, `as any`, no `!` non-null assertions.
- Page markup is preserved. Tasks change data sources and handlers, not visual design.
- `packages/shared` imports nothing from `backend` or `frontend`.

## Carried-Forward Debt This Plan Must Clear

From the Phases 0–2 whole-branch review, deferred to here:

| Item | Where it lands |
|---|---|
| `Decimal` → `number` mapper convention | Task 1 |
| `Prescription @@unique([patientId, drugId, startDate])` (seed dedup is currently `findFirst`-then-`create`) | Task 2 |
| `Prescription @@index([status, startDate])` leads on a near-constant column | Task 2 (reorder once the sweep query exists) |
| `app.guard()` composing `authenticate` + `requireRole` | Task 3 |
| Health route touches Prisma inline, violating the layering rule | Task 3 |
| `slugifyDrug` duplication; frontend fabricates `d-<slug>` drug ids that do not exist in the database | Task 9 |
| `frontend/src/data.ts` deletion | Task 7 |

---

## File Structure

**`backend/src/domain/`** (extends existing)
- `dto.ts` — Prisma row → shared wire shape. The only place money and enums are converted.
- `dates.ts` — `startOfUtcDay`, `treatmentDayFor`, `todayUtc`. One implementation of day arithmetic.

**`backend/src/modules/`** (new modules, existing convention)
- `wards/` — list wards with derived sweep status and patient counts.
- `patients/` — list, get, create.
- `prescriptions/` — create, update, stop.
- `inventory/` — list, restock.
- `indents/` — sweep, pickup list, dispense. The heart of Phase 4.
- `billing/` — list grouped by patient, confirm.
- `activity/` — the event feed.
- `health/` — moved out of `app.ts` to obey the layering rule.

**`backend/src/jobs/`**
- `sweep.ts` — node-cron registration calling the indents service.

**`packages/shared/src/`** (extends existing)
- `api.ts` — request/response Zod schemas and types for every new endpoint.
- `pickup.ts` — `PickupPatient` / `PickupLine`, the shape `WardSweepPage` consumes.

**`frontend/src/api/`** (extends existing)
- `wards.ts`, `patients.ts`, `prescriptions.ts`, `inventory.ts`, `indents.ts`, `billing.ts`, `activity.ts` — one hook file per domain, each exporting its query keys.

---

## Task 1: The DTO boundary — money, enums, and derived fields

**Files:**
- Create: `backend/src/domain/dates.ts`
- Create: `backend/src/domain/dto.ts`
- Test: `backend/src/domain/dates.test.ts`
- Test: `backend/src/domain/dto.test.ts`

**Interfaces:**
- Consumes: `toFoodTimingWire` (`backend/src/domain/enums.ts`), shared domain types, `dosesPerDay`/`isDueOn` from `@pharmassist/shared`.
- Produces:
  - `dates.ts`: `todayUtc(): Date`, `startOfUtcDay(date: Date): Date`, `daysBetweenUtc(from: Date, to: Date): number`, `treatmentDayFor(startDate: Date, on: Date): number`, `toDateString(date: Date): string`.
  - `dto.ts`: `decimalToNumber(value: Prisma.Decimal): number`, `toPrescriptionDto(rx, on?): Prescription`, `toPatientDto(patient, on?): Patient`, `toInventoryDto(item): InventoryItem`, `toWardDto(ward, opts): Ward`, `toTransactionDto(line): Transaction`, `stockStatusFor(currentStock, reorderLevel): StockStatus`.

**Why this task is first.** Every read endpoint in Phases 3–4 goes through here. Getting money, enum translation, and day arithmetic right once means the seven modules that follow cannot each get it subtly wrong.

- [ ] **Step 1: Write the failing date tests**

`backend/src/domain/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { daysBetweenUtc, startOfUtcDay, toDateString, treatmentDayFor } from './dates'

describe('startOfUtcDay', () => {
  it('strips the time component', () => {
    expect(startOfUtcDay(new Date('2026-08-06T23:59:59Z')).toISOString())
      .toBe('2026-08-06T00:00:00.000Z')
  })

  it('is idempotent', () => {
    const once = startOfUtcDay(new Date('2026-08-06T13:00:00Z'))
    expect(startOfUtcDay(once).getTime()).toBe(once.getTime())
  })
})

describe('daysBetweenUtc', () => {
  it('counts whole days forward', () => {
    expect(daysBetweenUtc(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))).toBe(5)
  })

  it('ignores the time of day on either end', () => {
    expect(daysBetweenUtc(new Date('2026-08-01T23:00:00Z'), new Date('2026-08-02T01:00:00Z'))).toBe(1)
  })

  it('returns a negative count when the target precedes the origin', () => {
    expect(daysBetweenUtc(new Date('2026-08-06T00:00:00Z'), new Date('2026-08-01T00:00:00Z'))).toBe(-5)
  })

  it('is unaffected by a daylight-saving boundary', () => {
    // Europe/London springs forward on 2026-03-29. UTC arithmetic must not
    // see a 23-hour day.
    expect(daysBetweenUtc(new Date('2026-03-28T00:00:00Z'), new Date('2026-03-30T00:00:00Z'))).toBe(2)
  })
})

describe('treatmentDayFor', () => {
  it('reports day 1 on the start date', () => {
    expect(treatmentDayFor(new Date('2026-08-06T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))).toBe(1)
  })

  it('increments by one per elapsed day', () => {
    expect(treatmentDayFor(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-06T00:00:00Z'))).toBe(6)
  })

  it('reports zero or less before treatment begins', () => {
    expect(treatmentDayFor(new Date('2026-08-06T00:00:00Z'), new Date('2026-08-05T00:00:00Z'))).toBe(0)
  })
})

describe('toDateString', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    expect(toDateString(new Date('2026-08-06T23:30:00Z'))).toBe('2026-08-06')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/domain/dates.test.ts`
Expected: FAIL — cannot resolve `./dates`.

- [ ] **Step 3: Write the date module**

`backend/src/domain/dates.ts`:

```ts
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * All day arithmetic in this system is UTC whole-day arithmetic. A ward
 * indent is generated per calendar day, so a local-time or
 * millisecond-difference implementation would produce off-by-one-day
 * batches across a daylight-saving boundary.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function todayUtc(): Date {
  return startOfUtcDay(new Date())
}

export function daysBetweenUtc(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY)
}

/**
 * 1 on the start date, 2 the next day, and so on. Zero or negative before
 * treatment begins — callers decide whether that is in range.
 */
export function treatmentDayFor(startDate: Date, on: Date): number {
  return daysBetweenUtc(startDate, on) + 1
}

export function toDateString(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test src/domain/dates.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Write the failing DTO tests**

`backend/src/domain/dto.test.ts`:

```ts
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
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/domain/dto.test.ts`
Expected: FAIL — cannot resolve `./dto`.

- [ ] **Step 7: Write the DTO module**

`backend/src/domain/dto.ts`:

```ts
import type { Prisma } from '@prisma/client'
import {
  wardLabel,
  type InventoryItem,
  type Patient,
  type Prescription,
  type StockStatus,
  type SweepStatus,
  type Transaction,
  type Ward,
} from '@pharmassist/shared'
import { toFoodTimingWire } from './enums'
import { toDateString, todayUtc, treatmentDayFor } from './dates'

/**
 * Prisma serialises Decimal to a JSON *string*, but the shared wire types
 * declare money as `number`. Every money field crosses this function on
 * its way out; a route that sends a raw Prisma row ships a string where
 * the client expects a number and `toFixed` throws.
 */
export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber()
}

/** Mirrors the threshold the UI used before it had a backend. */
export function stockStatusFor(currentStock: number, reorderLevel: number): StockStatus {
  if (currentStock <= reorderLevel * 0.2) return 'critical'
  if (currentStock <= reorderLevel) return 'low'
  return 'ok'
}

type PrescriptionRow = {
  id: string
  drugId: string
  dose: string
  route: Prescription['route']
  frequency: Prescription['frequency']
  foodTiming: Parameters<typeof toFoodTimingWire>[0]
  timeOfDay: Prescription['timeOfDay']
  startDate: Date
  durationDays: number
  status: 'active' | 'stopped' | 'completed'
  stopReason: string | null
  notes: string | null
  prescribedAt: Date
  drug: { label: string }
  prescribedBy: { displayName: string }
}

/**
 * `currentDay` is derived, never stored. An `active` prescription whose
 * course has elapsed reports as `completed` — but a `stopped` one is
 * never reinterpreted, because a stop order is a clinical decision that
 * outranks the calendar.
 */
export function toPrescriptionDto(rx: PrescriptionRow, on: Date = todayUtc()): Prescription {
  const currentDay = treatmentDayFor(rx.startDate, on)
  const status = rx.status === 'active' && currentDay > rx.durationDays ? 'completed' : rx.status

  return {
    id: rx.id,
    drugId: rx.drugId,
    drug: rx.drug.label,
    dose: rx.dose,
    route: rx.route,
    frequency: rx.frequency,
    foodTiming: toFoodTimingWire(rx.foodTiming),
    timeOfDay: rx.timeOfDay,
    startDate: toDateString(rx.startDate),
    durationDays: rx.durationDays,
    currentDay,
    status,
    ...(rx.stopReason ? { stopReason: rx.stopReason } : {}),
    ...(rx.notes ? { notes: rx.notes } : {}),
    prescribedBy: rx.prescribedBy.displayName,
    prescribedAt: rx.prescribedAt.toISOString(),
  }
}

type PatientRow = {
  id: string
  mrn: string
  name: string
  dateOfBirth: Date
  gender: Patient['gender']
  phone: string
  wardId: string
  bed: string
  admissionDate: Date
  diagnosis: string
  allergies: string
  status: Patient['status']
  ward: { code: string }
  prescriptions: PrescriptionRow[]
}

export function toPatientDto(patient: PatientRow, on: Date = todayUtc()): Patient {
  return {
    id: patient.id,
    mrn: patient.mrn,
    name: patient.name,
    dateOfBirth: toDateString(patient.dateOfBirth),
    gender: patient.gender,
    phone: patient.phone,
    ward: patient.ward.code,
    wardId: patient.wardId,
    bed: patient.bed,
    admissionDate: toDateString(patient.admissionDate),
    diagnosis: patient.diagnosis,
    allergies: patient.allergies,
    status: patient.status,
    prescriptions: patient.prescriptions.map((rx) => toPrescriptionDto(rx, on)),
  }
}

type InventoryRow = {
  id: string
  drugId: string
  currentStock: number
  reorderLevel: number
  drug: {
    id: string
    label: string
    name: string
    strength: string
    form: string
    category: string
    unitPrice: Prisma.Decimal
  }
}

export function toInventoryDto(item: InventoryRow): InventoryItem {
  return {
    id: item.id,
    drugId: item.drugId,
    drug: item.drug.label,
    category: item.drug.category,
    unit: item.drug.form,
    currentStock: item.currentStock,
    reorderLevel: item.reorderLevel,
    status: stockStatusFor(item.currentStock, item.reorderLevel),
  }
}

export function toWardDto(
  ward: { id: string; code: string; name: string },
  opts: { sweepStatus: SweepStatus; activePatients: number },
): Ward {
  return {
    id: ward.id,
    code: ward.code,
    name: ward.name,
    label: wardLabel(ward),
    sweepStatus: opts.sweepStatus,
    activePatients: opts.activePatients,
  }
}

type BillingRow = {
  id: string
  qty: number
  unitPrice: Prisma.Decimal
  total: Prisma.Decimal
  status: Transaction['status']
  createdAt: Date
  patient: { name: string }
  ward: { code: string }
  drug: { label: string }
  indentLine: { indent: { id: string; indentDate: Date } }
}

export function toTransactionDto(line: BillingRow): Transaction {
  return {
    id: line.id,
    // The UI's batchId is the parent indent — stored once, not duplicated
    // onto every billing line.
    batchId: line.indentLine.indent.id,
    patient: line.patient.name,
    ward: line.ward.code,
    drug: line.drug.label,
    qty: line.qty,
    unitPrice: decimalToNumber(line.unitPrice),
    total: decimalToNumber(line.total),
    timestamp: line.createdAt.toISOString(),
    status: line.status,
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test src/domain/`
Expected: PASS — 10 date tests + 17 DTO tests.

- [ ] **Step 9: Commit**

```bash
git add backend/src/domain
git commit -m "feat(backend): add the DTO boundary for money, enums and derived fields

Prisma serialises Decimal to a JSON string while the shared wire types
declare money as number, so every money field now crosses
decimalToNumber. Enum values are translated to their hyphenated wire form
here rather than per call site. currentDay is derived, and an active
prescription past its course reports completed — but a stopped one is
never reinterpreted, because a stop order outranks the calendar.

All day arithmetic is UTC whole-day arithmetic, so a daylight-saving
boundary cannot produce an off-by-one-day ward indent."
```

---

## Task 2: Schema debt — prescription identity and sweep index

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Create: `backend/prisma/migrations/<generated>/migration.sql`
- Test: `backend/prisma/seed.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Prescription @@unique([patientId, drugId, startDate])`; `Prescription @@index([startDate, status])` replacing `@@index([status, startDate])`.

**Why now.** The seed currently de-duplicates prescriptions with `findFirst`-then-`create`, which is not atomic — the Phases 0–2 review flagged it and deferred the real fix to here, because Phase 4's sweep is the first code that would suffer from a duplicate prescription. And `@@index([status, startDate])` leads on `status`, which is `active` for almost every row; the sweep's predicate is "started on or before today, still active", so `startDate` is the selective column and must lead.

This is an ADDITIVE migration on a populated database — do NOT drop and regenerate the init migration as an earlier task did. Use `prisma migrate dev --name prescription_identity` to produce a second migration.

- [ ] **Step 1: Add the constraint and reorder the index**

In `backend/prisma/schema.prisma`, model `Prescription`, replace the index block at the end of the model with:

```prisma
  // A patient cannot hold two prescriptions for the same drug starting the
  // same day. This is what lets the seed upsert instead of racing on
  // findFirst-then-create.
  @@unique([patientId, drugId, startDate])
  @@index([patientId, status])
  // startDate leads: the sweep filters "started on or before today", and
  // status is `active` for nearly every row, so it is not selective.
  @@index([startDate, status])
  @@index([drugId])
```

- [ ] **Step 2: Generate and apply the migration**

Run: `pnpm --filter @pharmassist/backend exec prisma migrate dev --name prescription_identity`

Expected: a NEW migration directory alongside the existing `_init` one. If Prisma reports the constraint cannot be added because of existing duplicate rows, that is a real finding — report it rather than forcing. The seed data has no duplicates, so it should apply cleanly.

Apply to the test database:

Run: `cd backend && TEST_URL=$(grep TEST_DATABASE_URL .env | cut -d'"' -f2) && DATABASE_URL="$TEST_URL" pnpm exec prisma migrate deploy && cd ..`
Expected: `All migrations have been successfully applied.`

- [ ] **Step 3: Replace the seed's racy dedup with an upsert**

In `backend/prisma/seed.ts`, replace the `findFirst`-then-`continue`-then-`create` block for prescriptions with a single upsert keyed on the new constraint:

```ts
      await prisma.prescription.upsert({
        where: {
          patientId_drugId_startDate: {
            patientId: record.id,
            drugId: drug.id,
            startDate: new Date(rx.startDate),
          },
        },
        update: {},
        create: {
          patientId: record.id,
          drugId: drug.id,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          foodTiming: toFoodTimingEnum(rx.foodTiming),
          timeOfDay: [...rx.timeOfDay],
          startDate: new Date(rx.startDate),
          durationDays: rx.durationDays,
          status: rx.status,
          stopReason: 'stopReason' in rx ? rx.stopReason : null,
          notes: 'notes' in rx ? rx.notes : null,
          prescribedById: prescriber.id,
          prescribedAt: new Date(rx.prescribedAt),
        },
      })
```

Delete the now-unused `findFirst` lookup and the `if (existing) continue` guard.

- [ ] **Step 4: Add a test proving the constraint holds**

Append to `backend/prisma/seed.test.ts`, inside the existing top-level `describe('seed', ...)`:

```ts
  it('rejects a duplicate prescription for the same patient, drug and start date', async () => {
    await seed(prisma)

    const existing = await prisma.prescription.findFirstOrThrow()

    await expect(
      prisma.prescription.create({
        data: {
          patientId: existing.patientId,
          drugId: existing.drugId,
          dose: existing.dose,
          route: existing.route,
          frequency: existing.frequency,
          foodTiming: existing.foodTiming,
          timeOfDay: existing.timeOfDay,
          startDate: existing.startDate,
          durationDays: existing.durationDays,
          prescribedById: existing.prescribedById,
        },
      }),
    ).rejects.toThrow()
  })
```

- [ ] **Step 5: Run the suite**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — all prior tests plus the new one. The idempotency test must still pass, now via upsert rather than a read-then-write race.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma
git commit -m "feat(backend): give prescriptions a natural key, reorder the sweep index

The seed de-duplicated prescriptions with findFirst-then-create, which is
not atomic. A unique constraint on (patientId, drugId, startDate) lets it
upsert instead, and makes a duplicate impossible for the sweep to trip
over. The (status, startDate) index led on a column that is 'active' for
nearly every row; the sweep filters on startDate, so that column leads
now."
```

---

## Task 3: Route guard composition, health module, shared API contracts

**Files:**
- Modify: `backend/src/plugins/auth.ts`
- Create: `backend/src/modules/health/routes.ts`
- Create: `backend/src/modules/health/service.ts`
- Modify: `backend/src/app.ts`
- Create: `packages/shared/src/api.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `backend/src/modules/auth/routes.test.ts` (extend)

**Interfaces:**
- Consumes: `app.authenticate`, `app.requireRole`, `requireUser` from Phase 2.
- Produces:
  - `app.guard(...roles: Role[]): preHandlerHookHandler[]` — composes `authenticate` then `requireRole`. Calling with no roles yields authentication only.
  - `checkDatabase(prisma): Promise<{ status: 'ok'; database: 'up' }>` in the health service.
  - `packages/shared/src/api.ts`: `wardListResponseSchema`, `patientListQuerySchema`, `patientQuerySchema`, `createPatientSchema`, `createPrescriptionSchema`, `updatePrescriptionSchema`, `stopPrescriptionSchema`, `restockSchema`, `sweepRequestSchema`, `dispenseRequestSchema`, `confirmBillingSchema`, `activityQuerySchema`, plus the inferred request types.

**Why `app.guard` now.** Phases 3–4 add roughly twenty guarded routes. Without a composed helper each one repeats `preHandler: [app.authenticate, app.requireRole('pharmacist')]`, and the Phases 0–2 review already found that forgetting `authenticate` produced a 500 rather than a denial. One helper makes the unsafe form unavailable.

- [ ] **Step 1: Write the failing guard test**

Append to `backend/src/modules/auth/routes.test.ts`:

```ts
describe('app.guard', () => {
  const guardedRoute: FastifyPluginAsync = async (instance) => {
    instance.get('/api/pharmacist-only', { preHandler: instance.guard('pharmacist') }, async () => ({ ok: true }))
    instance.get('/api/any-signed-in', { preHandler: instance.guard() }, async () => ({ ok: true }))
  }

  async function loginOn(instance: FastifyInstance, username: string) {
    const res = await instance.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username, password: 'pharmassist' },
    })
    const cookie = res.cookies[0]
    return { [cookie.name]: cookie.value }
  }

  it('allows a permitted role', async () => {
    const app2 = await buildTestApp(guardedRoute)
    const cookies = await loginOn(app2, 'k.asante')
    const res = await app2.inject({ method: 'GET', url: '/api/pharmacist-only', cookies })
    await app2.close()
    expect(res.statusCode).toBe(200)
  })

  it('denies a role not on the list with FORBIDDEN', async () => {
    const app2 = await buildTestApp(guardedRoute)
    const cookies = await loginOn(app2, 'a.owusu')
    const res = await app2.inject({ method: 'GET', url: '/api/pharmacist-only', cookies })
    await app2.close()
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('FORBIDDEN')
  })

  it('requires authentication even with no roles listed', async () => {
    const app2 = await buildTestApp(guardedRoute)
    const res = await app2.inject({ method: 'GET', url: '/api/any-signed-in' })
    await app2.close()
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('AUTH_EXPIRED')
  })

  it('admits any signed-in role when no roles are listed', async () => {
    const app2 = await buildTestApp(guardedRoute)
    const cookies = await loginOn(app2, 'b.kwame')
    const res = await app2.inject({ method: 'GET', url: '/api/any-signed-in', cookies })
    await app2.close()
    expect(res.statusCode).toBe(200)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/auth/routes.test.ts`
Expected: FAIL — `instance.guard is not a function`.

- [ ] **Step 3: Add `guard` to the auth plugin**

In `backend/src/plugins/auth.ts`, add to the `FastifyInstance` interface declaration:

```ts
    guard: (...roles: Role[]) => preHandlerHookHandler[]
```

and register the decoration alongside the existing ones:

```ts
  /**
   * The only sanctioned way to protect a route. Composing the pair by hand
   * makes it possible to attach requireRole without authenticate, which
   * denies with a 500 rather than a 403.
   */
  app.decorate('guard', (...roles: Role[]): preHandlerHookHandler[] => {
    return roles.length === 0
      ? [app.authenticate]
      : [app.authenticate, app.requireRole(...roles)]
  })
```

- [ ] **Step 4: Extract the health route into a module**

`backend/src/modules/health/service.ts`:

```ts
import type { PrismaClient } from '@prisma/client'

export interface HealthReport {
  status: 'ok'
  database: 'up'
}

/** Services are the only layer permitted to touch Prisma — including this one. */
export async function checkDatabase(prisma: PrismaClient): Promise<HealthReport> {
  await prisma.$queryRaw`SELECT 1`
  return { status: 'ok', database: 'up' }
}
```

`backend/src/modules/health/routes.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import { checkDatabase } from './service'

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => checkDatabase(app.prisma))
}

export default healthRoutes
```

In `backend/src/app.ts`, delete the inline `app.get('/api/health', ...)` block and register the module instead:

```ts
  await app.register(healthRoutes)
  await app.register(authRoutes)
```

with `import healthRoutes from './modules/health/routes'` at the top.

- [ ] **Step 5: Write the shared API contracts**

`packages/shared/src/api.ts`:

```ts
import { z } from 'zod'
import { FREQUENCIES } from './frequency'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')

export const patientListQuerySchema = z.object({
  wardId: z.string().min(1).optional(),
  search: z.string().trim().optional(),
})
export type PatientListQuery = z.infer<typeof patientListQuerySchema>

export const createPatientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  dateOfBirth: isoDate,
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().trim(),
  wardId: z.string().min(1, 'Ward is required'),
  bed: z.string().trim().min(1, 'Bed is required'),
  admissionDate: isoDate,
  diagnosis: z.string().trim().min(1, 'Diagnosis is required'),
  allergies: z.string().trim(),
})
export type CreatePatientRequest = z.infer<typeof createPatientSchema>

export const createPrescriptionSchema = z.object({
  drugId: z.string().min(1, 'Drug is required'),
  dose: z.string().trim().min(1, 'Dose is required'),
  route: z.enum(['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled']),
  frequency: z.enum(FREQUENCIES),
  foodTiming: z.enum(['before-food', 'after-food', 'with-food', 'not-applicable']),
  timeOfDay: z.array(z.enum(['morning', 'afternoon', 'evening', 'night'])).min(1, 'Pick at least one time of day'),
  startDate: isoDate,
  durationDays: z.number().int().positive('Duration must be at least one day'),
  notes: z.string().trim().optional(),
})
export type CreatePrescriptionRequest = z.infer<typeof createPrescriptionSchema>

export const updatePrescriptionSchema = createPrescriptionSchema.partial()
export type UpdatePrescriptionRequest = z.infer<typeof updatePrescriptionSchema>

export const stopPrescriptionSchema = z.object({
  reason: z.string().trim().min(1, 'A stop reason is required'),
})
export type StopPrescriptionRequest = z.infer<typeof stopPrescriptionSchema>

export const restockSchema = z.object({
  qty: z.number().int().positive('Restock quantity must be greater than 0'),
  ref: z.string().trim().optional(),
})
export type RestockRequest = z.infer<typeof restockSchema>

export const sweepRequestSchema = z.object({
  date: isoDate.optional(),
  wardId: z.string().min(1).optional(),
  preview: z.boolean().default(false),
})
export type SweepRequest = z.infer<typeof sweepRequestSchema>

export const dispenseRequestSchema = z.object({
  patientId: z.string().min(1),
  wardId: z.string().min(1),
  date: isoDate.optional(),
})
export type DispenseRequest = z.infer<typeof dispenseRequestSchema>

export const confirmBillingSchema = z.object({
  patientId: z.string().min(1),
  date: isoDate.optional(),
})
export type ConfirmBillingRequest = z.infer<typeof confirmBillingSchema>

export const activityQuerySchema = z.object({
  type: z.enum(['dispense', 'prescription', 'stop', 'restock', 'register']).optional(),
  date: isoDate.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
})
export type ActivityQuery = z.infer<typeof activityQuerySchema>
```

Add `export * from './api'` to `packages/shared/src/index.ts`, keeping the existing exports.

- [ ] **Step 6: Run the suite**

Run: `pnpm --filter @pharmassist/backend test && pnpm --filter @pharmassist/shared test`
Expected: PASS — the four new guard tests plus everything prior. The existing health test in `src/app.test.ts` must still pass unchanged, since the route path and response shape did not change.

- [ ] **Step 7: Commit**

```bash
git add backend/src packages/shared/src
git commit -m "feat(backend): add app.guard, extract health module, add API contracts

Phases 3-4 add around twenty guarded routes. Composing authenticate and
requireRole by hand at each one makes it possible to attach the role check
without the authentication, which denies with a 500 instead of a 403 —
app.guard removes that option. The health route moves out of app.ts so
that services remain the only layer touching Prisma."
```

---

## Task 4: Wards module

**Files:**
- Create: `backend/src/modules/wards/service.ts`
- Create: `backend/src/modules/wards/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/modules/wards/service.test.ts`

**Interfaces:**
- Consumes: `toWardDto` (Task 1), `todayUtc` (Task 1), `app.guard` (Task 3).
- Produces: `listWards(prisma, viewer, on?): Promise<Ward[]>`; route `GET /api/wards`.

**Behaviour.** `sweepStatus` comes from today's `DailyIndent` for that ward, defaulting to `pending` when none exists. `activePatients` counts `admitted` patients. **A nurse sees only their own ward** — this is the server-side replacement for the client-side filtering `DashboardPage` did.

- [ ] **Step 1: Write the failing test**

`backend/src/modules/wards/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { listWards } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('listWards', () => {
  it('returns every ward for a pharmacist', async () => {
    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.map((w) => w.code).sort()).toEqual(['Ward 2D', 'Ward 4A', 'Ward 5B', 'Ward 6C'])
  })

  it('returns only the assigned ward for a nurse', async () => {
    const wards = await listWards(prisma, await viewerFor('a.owusu'))
    expect(wards).toHaveLength(1)
    expect(wards[0].code).toBe('Ward 4A')
  })

  it('composes the display label', async () => {
    const wards = await listWards(prisma, await viewerFor('a.owusu'))
    expect(wards[0].label).toBe('Ward 4A — General Medicine')
  })

  it('counts admitted patients per ward', async () => {
    const wards = await listWards(prisma, await viewerFor('k.asante'))
    const ward4a = wards.find((w) => w.code === 'Ward 4A')
    expect(ward4a?.activePatients).toBe(2)
  })

  it('excludes discharged patients from the count', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { ward: { code: 'Ward 4A' } } })
    await prisma.patient.update({ where: { id: patient.id }, data: { status: 'discharged' } })

    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.find((w) => w.code === 'Ward 4A')?.activePatients).toBe(1)
  })

  it('reports pending when no indent exists for the day', async () => {
    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.every((w) => w.sweepStatus === 'pending')).toBe(true)
  })

  it("reflects today's indent status", async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 5B' } })
    const today = new Date()
    const indentDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    await prisma.dailyIndent.create({ data: { wardId: ward.id, indentDate, status: 'swept' } })

    const wards = await listWards(prisma, await viewerFor('k.asante'))
    expect(wards.find((w) => w.code === 'Ward 5B')?.sweepStatus).toBe('swept')
    expect(wards.find((w) => w.code === 'Ward 4A')?.sweepStatus).toBe('pending')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/wards`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 3: Write the service**

`backend/src/modules/wards/service.ts`:

```ts
import type { PrismaClient } from '@prisma/client'
import type { SessionUser, SweepStatus, Ward } from '@pharmassist/shared'
import { toWardDto } from '../../domain/dto'
import { todayUtc } from '../../domain/dates'

/**
 * A nurse sees only their assigned ward. This is the server-side
 * replacement for the ward filtering the dashboard used to do in the
 * browser, where it was advisory rather than enforced.
 */
export async function listWards(
  prisma: PrismaClient,
  viewer: SessionUser,
  on: Date = todayUtc(),
): Promise<Ward[]> {
  const scope = viewer.role === 'nurse' && viewer.ward ? { id: viewer.ward.id } : {}

  const wards = await prisma.ward.findMany({
    where: scope,
    orderBy: { code: 'asc' },
    include: {
      indents: { where: { indentDate: on } },
      _count: { select: { patients: { where: { status: 'admitted' } } } },
    },
  })

  return wards.map((ward) => {
    const indent = ward.indents[0]
    const sweepStatus: SweepStatus = indent ? indent.status : 'pending'
    return toWardDto(ward, { sweepStatus, activePatients: ward._count.patients })
  })
}
```

- [ ] **Step 4: Write the routes**

`backend/src/modules/wards/routes.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import type { Ward } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { listWards } from './service'

const wardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/wards', { preHandler: app.guard() }, async (request): Promise<Ward[]> => {
    return listWards(app.prisma, requireUser(request))
  })
}

export default wardRoutes
```

Register it in `backend/src/app.ts` after `authRoutes`.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 7 new ward tests plus everything prior.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(backend): add the wards module

sweepStatus comes from today's indent and activePatients counts admitted
patients, both derived rather than stored. Nurses are scoped to their own
ward server-side, replacing the client-side filter the dashboard used to
apply, which was advisory rather than enforced."
```

---

## Task 5: Patients module

**Files:**
- Create: `backend/src/modules/patients/service.ts`
- Create: `backend/src/modules/patients/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/modules/patients/service.test.ts`

**Interfaces:**
- Consumes: `toPatientDto`, `todayUtc` (Task 1), `app.guard`, `createPatientSchema`, `patientListQuerySchema` (Task 3).
- Produces: `listPatients(prisma, viewer, query, on?): Promise<Patient[]>`; `getPatient(prisma, viewer, id, on?): Promise<Patient>`; `createPatient(prisma, actor, input): Promise<Patient>`; `assertWardAccess(viewer, wardId): void`. Routes `GET /api/patients`, `GET /api/patients/:id`, `POST /api/patients`.

**Ward scoping is a denial, not a filter.** A nurse listing patients gets their ward only. A nurse requesting a patient in another ward gets `FORBIDDEN` — not a 404, which would leak whether the patient exists, and not a silently empty result.

**MRN generation** moves server-side. The frontend currently invents `MRN-#####` with `Math.random`, which can collide. The service allocates the next sequential MRN inside the create transaction.

- [ ] **Step 1: Write the failing test**

`backend/src/modules/patients/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { createPatient, getPatient, listPatients } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('listPatients', () => {
  it('returns all patients for a pharmacist', async () => {
    const patients = await listPatients(prisma, await viewerFor('k.asante'), {})
    expect(patients).toHaveLength(5)
  })

  it('returns only ward patients for a nurse', async () => {
    const patients = await listPatients(prisma, await viewerFor('a.owusu'), {})
    expect(patients).toHaveLength(2)
    expect(patients.every((p) => p.ward === 'Ward 4A')).toBe(true)
  })

  it('searches by name, MRN and bed', async () => {
    const viewer = await viewerFor('k.asante')
    expect((await listPatients(prisma, viewer, { search: 'margaret' }))[0].name).toBe('Margaret Osei')
    expect((await listPatients(prisma, viewer, { search: 'MRN-003145' }))[0].name).toBe('James Kofi Antwi')
    expect((await listPatients(prisma, viewer, { search: 'Bed 12' }))[0].name).toBe('Abena Frimpong')
  })

  it('includes prescriptions with derived currentDay and wire-format foodTiming', async () => {
    const patients = await listPatients(prisma, await viewerFor('k.asante'), {})
    const margaret = patients.find((p) => p.name === 'Margaret Osei')
    const amox = margaret?.prescriptions.find((rx) => rx.drug === 'Amoxicillin 500mg')

    expect(amox?.foodTiming).toBe('after-food')
    expect(amox?.currentDay).toBeGreaterThan(0)
    expect(amox?.prescribedBy).toBe('Dr. B. Kwame')
  })

  it('rejects a nurse asking for another ward', async () => {
    const otherWard = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 5B' } })
    await expect(listPatients(prisma, await viewerFor('a.owusu'), { wardId: otherWard.id }))
      .rejects.toBeInstanceOf(AppError)
  })
})

describe('getPatient', () => {
  it('returns a patient by id', async () => {
    const [first] = await listPatients(prisma, await viewerFor('k.asante'), {})
    const found = await getPatient(prisma, await viewerFor('k.asante'), first.id)
    expect(found.id).toBe(first.id)
  })

  it('rejects an unknown id', async () => {
    await expect(getPatient(prisma, await viewerFor('k.asante'), 'nope'))
      .rejects.toBeInstanceOf(AppError)
  })

  it('denies a nurse a patient outside their ward, rather than pretending it is missing', async () => {
    const outsider = await prisma.patient.findFirstOrThrow({ where: { ward: { code: 'Ward 2D' } } })
    const error = await getPatient(prisma, await viewerFor('a.owusu'), outsider.id).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.statusCode).toBe(403)
  })
})

describe('createPatient', () => {
  const input = {
    name: 'Ama Boateng',
    dateOfBirth: '1990-04-11',
    gender: 'Female' as const,
    phone: '+233 24 111 2222',
    wardId: '',
    bed: 'Bed 15',
    admissionDate: '2026-08-06',
    diagnosis: 'Observation',
    allergies: 'None known',
  }

  it('creates a patient with a generated MRN and no prescriptions', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    const created = await createPatient(prisma, await viewerFor('a.owusu'), { ...input, wardId: ward.id })

    expect(created.name).toBe('Ama Boateng')
    expect(created.mrn).toMatch(/^MRN-\d{6}$/)
    expect(created.status).toBe('admitted')
    expect(created.prescriptions).toEqual([])
  })

  it('allocates a distinct MRN each time', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    const viewer = await viewerFor('a.owusu')
    const a = await createPatient(prisma, viewer, { ...input, wardId: ward.id })
    const b = await createPatient(prisma, viewer, { ...input, name: 'Kofi Mensah', wardId: ward.id })

    expect(a.mrn).not.toBe(b.mrn)
  })

  it('records a register activity event', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    await createPatient(prisma, await viewerFor('a.owusu'), { ...input, wardId: ward.id })

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'register' } })
    expect(event.text).toContain('Ama Boateng')
  })

  it('denies a nurse registering into another ward', async () => {
    const other = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 6C' } })
    await expect(createPatient(prisma, await viewerFor('a.owusu'), { ...input, wardId: other.id }))
      .rejects.toBeInstanceOf(AppError)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/patients`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 3: Write the service**

`backend/src/modules/patients/service.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'
import type { CreatePatientRequest, Patient, PatientListQuery, SessionUser } from '@pharmassist/shared'
import { ErrorCode } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toPatientDto } from '../../domain/dto'
import { todayUtc } from '../../domain/dates'

const patientInclude = {
  ward: true,
  prescriptions: {
    include: { drug: true, prescribedBy: true },
    orderBy: { prescribedAt: 'desc' },
  },
} satisfies Prisma.PatientInclude

/**
 * A nurse may only reach their own ward. Denying rather than filtering
 * matters: a filtered-empty result is indistinguishable from "no such
 * patient", and a 404 would leak whether the record exists.
 */
export function assertWardAccess(viewer: SessionUser, wardId: string): void {
  if (viewer.role !== 'nurse') return
  if (viewer.ward && viewer.ward.id === wardId) return
  throw AppError.forbidden('You do not have access to that ward')
}

function scopeFor(viewer: SessionUser, requestedWardId?: string): Prisma.PatientWhereInput {
  if (viewer.role === 'nurse') {
    if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
    if (requestedWardId) assertWardAccess(viewer, requestedWardId)
    return { wardId: viewer.ward.id }
  }
  return requestedWardId ? { wardId: requestedWardId } : {}
}

export async function listPatients(
  prisma: PrismaClient,
  viewer: SessionUser,
  query: PatientListQuery,
  on: Date = todayUtc(),
): Promise<Patient[]> {
  const search = query.search?.trim()

  const patients = await prisma.patient.findMany({
    where: {
      ...scopeFor(viewer, query.wardId),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { mrn: { contains: search, mode: 'insensitive' } },
              { bed: { contains: search, mode: 'insensitive' } },
              { ward: { code: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: patientInclude,
    orderBy: { name: 'asc' },
  })

  return patients.map((patient) => toPatientDto(patient, on))
}

export async function getPatient(
  prisma: PrismaClient,
  viewer: SessionUser,
  id: string,
  on: Date = todayUtc(),
): Promise<Patient> {
  const patient = await prisma.patient.findUnique({ where: { id }, include: patientInclude })

  if (!patient) throw AppError.notFound(`No patient found with id ${id}`)
  assertWardAccess(viewer, patient.wardId)

  return toPatientDto(patient, on)
}

/**
 * MRNs are allocated here rather than in the browser, which invented them
 * with Math.random and could collide. The count-then-format runs inside
 * the same transaction as the insert, and the column is unique, so a
 * concurrent duplicate fails loudly instead of silently sharing an MRN.
 */
async function nextMrn(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.patient.count()
  return `MRN-${String(count + 1).padStart(6, '0')}`
}

export async function createPatient(
  prisma: PrismaClient,
  actor: SessionUser,
  input: CreatePatientRequest,
): Promise<Patient> {
  assertWardAccess(actor, input.wardId)

  const ward = await prisma.ward.findUnique({ where: { id: input.wardId } })
  if (!ward) throw AppError.invalidInput(`No ward found with id ${input.wardId}`)

  const created = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        mrn: await nextMrn(tx),
        name: input.name,
        dateOfBirth: new Date(input.dateOfBirth),
        gender: input.gender,
        phone: input.phone,
        wardId: input.wardId,
        bed: input.bed,
        admissionDate: new Date(input.admissionDate),
        diagnosis: input.diagnosis,
        allergies: input.allergies,
      },
      include: patientInclude,
    })

    await tx.activityEvent.create({
      data: {
        type: 'register',
        patientId: patient.id,
        wardId: patient.wardId,
        actorId: actor.id,
        text: `Patient registered: ${patient.name} — ${ward.code}, ${patient.bed}`,
      },
    })

    return patient
  })

  return toPatientDto(created)
}
```

- [ ] **Step 4: Write the routes**

`backend/src/modules/patients/routes.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import { createPatientSchema, patientListQuerySchema, type Patient } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { createPatient, getPatient, listPatients } from './service'

const patientRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/patients', { preHandler: app.guard() }, async (request): Promise<Patient[]> => {
    const query = patientListQuerySchema.parse(request.query)
    return listPatients(app.prisma, requireUser(request), query)
  })

  app.get<{ Params: { id: string } }>(
    '/api/patients/:id',
    { preHandler: app.guard() },
    async (request): Promise<Patient> => {
      return getPatient(app.prisma, requireUser(request), request.params.id)
    },
  )

  app.post('/api/patients', { preHandler: app.guard('nurse', 'pharmacist') }, async (request, reply): Promise<Patient> => {
    const input = createPatientSchema.parse(request.body)
    const patient = await createPatient(app.prisma, requireUser(request), input)
    reply.status(201)
    return patient
  })
}

export default patientRoutes
```

Register in `backend/src/app.ts`.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 12 new patient tests plus everything prior.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(backend): add the patients module

Ward scoping denies rather than filters: a filtered-empty list is
indistinguishable from 'no such patient', and a 404 would leak whether
the record exists, so an out-of-ward request gets 403. MRN allocation
moves server-side, where a unique column makes a collision fail loudly
instead of the browser's Math.random silently reusing one."
```

---

## Task 6: Prescriptions module and the drug catalog

**Files:**
- Create: `backend/src/modules/drugs/service.ts`
- Create: `backend/src/modules/drugs/routes.ts`
- Create: `backend/src/modules/prescriptions/service.ts`
- Create: `backend/src/modules/prescriptions/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/modules/prescriptions/service.test.ts`

**Interfaces:**
- Consumes: `toPrescriptionDto`, `toFoodTimingEnum`, `assertWardAccess` (Task 5), the Task 3 schemas.
- Produces: `listDrugs(prisma, search?): Promise<Drug[]>`; `createPrescription(prisma, actor, patientId, input)`; `updatePrescription(prisma, actor, id, input)`; `stopPrescription(prisma, actor, id, reason)`. Routes `GET /api/drugs`, `POST /api/patients/:id/prescriptions`, `PATCH /api/prescriptions/:id`, `POST /api/prescriptions/:id/stop`.

**This task kills the fabricated drug ids.** `PrescriptionForm` currently mints `d-<slug>` ids that exist nowhere in the database. `GET /api/drugs` is the real catalog the form must select from; Task 8 rewires the form to use it. The service rejects an unknown `drugId` with `INVALID_INPUT` rather than creating a dangling reference.

**Stopping is restricted to doctors** and cancels pending indent lines from today forward. Already-dispensed lines are never touched — the patient received the drug and owes for it.

- [ ] **Step 1: Write the failing test**

`backend/src/modules/prescriptions/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { createPrescription, stopPrescription, updatePrescription } from './service'
import { listDrugs } from '../drugs/service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('listDrugs', () => {
  it('returns the catalog with prices as numbers', async () => {
    const drugs = await listDrugs(prisma)
    expect(drugs).toHaveLength(15)

    const aspirin = drugs.find((d) => d.label === 'Aspirin 75mg')
    expect(aspirin?.unitPrice).toBe(0.12)
    expect(typeof aspirin?.unitPrice).toBe('number')
  })

  it('filters by search term', async () => {
    const drugs = await listDrugs(prisma, 'furos')
    expect(drugs).toHaveLength(1)
    expect(drugs[0].label).toBe('Furosemide 40mg')
  })
})

describe('createPrescription', () => {
  async function newRxInput() {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Ibuprofen 400mg' } })
    return {
      drugId: drug.id,
      dose: '400mg',
      route: 'Oral' as const,
      frequency: 'TDS' as const,
      foodTiming: 'after-food' as const,
      timeOfDay: ['morning' as const, 'night' as const],
      startDate: '2026-08-10',
      durationDays: 5,
      notes: 'With food.',
    }
  }

  it('creates a prescription linked to the real drug row', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const rx = await createPrescription(prisma, await viewerFor('b.kwame'), patient.id, await newRxInput())

    expect(rx.drug).toBe('Ibuprofen 400mg')
    expect(rx.status).toBe('active')
    expect(rx.prescribedBy).toBe('Dr. B. Kwame')
  })

  it('stores foodTiming translated to the Prisma enum, and returns it in wire form', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const rx = await createPrescription(prisma, await viewerFor('b.kwame'), patient.id, await newRxInput())

    expect(rx.foodTiming).toBe('after-food')
    const row = await prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } })
    expect(row.foodTiming).toBe('after_food')
  })

  it('rejects a drugId that is not in the catalog', async () => {
    const patient = await prisma.patient.findFirstOrThrow()
    const input = { ...(await newRxInput()), drugId: 'd-ibuprofen-400mg' }

    await expect(createPrescription(prisma, await viewerFor('b.kwame'), patient.id, input))
      .rejects.toBeInstanceOf(AppError)
  })

  it('records a prescription activity event', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    await createPrescription(prisma, await viewerFor('b.kwame'), patient.id, await newRxInput())

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'prescription' } })
    expect(event.text).toContain('Ibuprofen 400mg')
  })
})

describe('updatePrescription', () => {
  it('applies a partial change', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'active' } })
    const updated = await updatePrescription(prisma, await viewerFor('b.kwame'), rx.id, { durationDays: 21 })
    expect(updated.durationDays).toBe(21)
  })

  it('refuses to edit a stopped prescription', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'stopped' } })
    await expect(updatePrescription(prisma, await viewerFor('b.kwame'), rx.id, { durationDays: 3 }))
      .rejects.toBeInstanceOf(AppError)
  })
})

describe('stopPrescription', () => {
  it('marks the prescription stopped with its reason and prescriber', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'active' } })
    const stopped = await stopPrescription(prisma, await viewerFor('b.kwame'), rx.id, 'Adverse reaction')

    expect(stopped.status).toBe('stopped')
    expect(stopped.stopReason).toBe('Adverse reaction')

    const row = await prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } })
    expect(row.stoppedAt).not.toBeNull()
    expect(row.stoppedById).not.toBeNull()
  })

  it('rejects stopping an already-stopped prescription', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'stopped' } })
    await expect(stopPrescription(prisma, await viewerFor('b.kwame'), rx.id, 'Again'))
      .rejects.toBeInstanceOf(AppError)
  })

  it('records a stop activity event carrying the reason', async () => {
    const rx = await prisma.prescription.findFirstOrThrow({ where: { status: 'active' } })
    await stopPrescription(prisma, await viewerFor('b.kwame'), rx.id, 'Toxicity suspected')

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'stop' } })
    expect(event.text).toContain('Toxicity suspected')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/prescriptions`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 3: Write the drug catalog service and routes**

`backend/src/modules/drugs/service.ts`:

```ts
import type { PrismaClient } from '@prisma/client'
import type { Drug } from '@pharmassist/shared'
import { decimalToNumber } from '../../domain/dto'

export async function listDrugs(prisma: PrismaClient, search?: string): Promise<Drug[]> {
  const term = search?.trim()

  const drugs = await prisma.drug.findMany({
    where: term ? { label: { contains: term, mode: 'insensitive' } } : {},
    orderBy: { label: 'asc' },
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

`backend/src/modules/drugs/routes.ts`:

```ts
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import type { Drug } from '@pharmassist/shared'
import { listDrugs } from './service'

const querySchema = z.object({ search: z.string().trim().optional() })

const drugRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/drugs', { preHandler: app.guard() }, async (request): Promise<Drug[]> => {
    return listDrugs(app.prisma, querySchema.parse(request.query).search)
  })
}

export default drugRoutes
```

- [ ] **Step 4: Write the prescriptions service**

`backend/src/modules/prescriptions/service.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'
import type {
  CreatePrescriptionRequest,
  Prescription,
  SessionUser,
  UpdatePrescriptionRequest,
} from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toFoodTimingEnum } from '../../domain/enums'
import { toPrescriptionDto } from '../../domain/dto'
import { todayUtc } from '../../domain/dates'
import { assertWardAccess } from '../patients/service'

const rxInclude = { drug: true, prescribedBy: true } satisfies Prisma.PrescriptionInclude

export async function createPrescription(
  prisma: PrismaClient,
  actor: SessionUser,
  patientId: string,
  input: CreatePrescriptionRequest,
): Promise<Prescription> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, include: { ward: true } })
  if (!patient) throw AppError.notFound(`No patient found with id ${patientId}`)
  assertWardAccess(actor, patient.wardId)

  // The browser used to invent ids like `d-ibuprofen-400mg`. Only a real
  // catalog row is acceptable; anything else would dangle.
  const drug = await prisma.drug.findUnique({ where: { id: input.drugId } })
  if (!drug) throw AppError.invalidInput(`No drug found with id ${input.drugId}`)

  const created = await prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.create({
      data: {
        patientId,
        drugId: drug.id,
        dose: input.dose,
        route: input.route,
        frequency: input.frequency,
        foodTiming: toFoodTimingEnum(input.foodTiming),
        timeOfDay: input.timeOfDay,
        startDate: new Date(input.startDate),
        durationDays: input.durationDays,
        notes: input.notes ?? null,
        prescribedById: actor.id,
      },
      include: rxInclude,
    })

    await tx.activityEvent.create({
      data: {
        type: 'prescription',
        patientId,
        wardId: patient.wardId,
        drugId: drug.id,
        actorId: actor.id,
        text: `New prescription: ${drug.label} ${input.frequency} — ${patient.name} (${patient.ward.code})`,
      },
    })

    return rx
  })

  return toPrescriptionDto(created)
}

export async function updatePrescription(
  prisma: PrismaClient,
  actor: SessionUser,
  id: string,
  input: UpdatePrescriptionRequest,
): Promise<Prescription> {
  const existing = await prisma.prescription.findUnique({ where: { id }, include: { patient: true } })
  if (!existing) throw AppError.notFound(`No prescription found with id ${id}`, 'RX_NOT_FOUND')
  assertWardAccess(actor, existing.patient.wardId)

  if (existing.status !== 'active') {
    throw AppError.conflict('RX_NOT_FOUND', 'Only an active prescription can be edited')
  }

  if (input.drugId) {
    const drug = await prisma.drug.findUnique({ where: { id: input.drugId } })
    if (!drug) throw AppError.invalidInput(`No drug found with id ${input.drugId}`)
  }

  const updated = await prisma.prescription.update({
    where: { id },
    data: {
      ...(input.drugId ? { drugId: input.drugId } : {}),
      ...(input.dose ? { dose: input.dose } : {}),
      ...(input.route ? { route: input.route } : {}),
      ...(input.frequency ? { frequency: input.frequency } : {}),
      ...(input.foodTiming ? { foodTiming: toFoodTimingEnum(input.foodTiming) } : {}),
      ...(input.timeOfDay ? { timeOfDay: input.timeOfDay } : {}),
      ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
      ...(input.durationDays ? { durationDays: input.durationDays } : {}),
      ...(input.notes === undefined ? {} : { notes: input.notes || null }),
    },
    include: rxInclude,
  })

  return toPrescriptionDto(updated)
}

/**
 * Stopping cancels PENDING indent lines from today forward. Lines already
 * dispensed are never touched — the patient received the drug and owes
 * for it.
 */
export async function stopPrescription(
  prisma: PrismaClient,
  actor: SessionUser,
  id: string,
  reason: string,
): Promise<Prescription> {
  const existing = await prisma.prescription.findUnique({
    where: { id },
    include: { patient: { include: { ward: true } }, drug: true },
  })
  if (!existing) throw AppError.notFound(`No prescription found with id ${id}`, 'RX_NOT_FOUND')
  assertWardAccess(actor, existing.patient.wardId)

  if (existing.status !== 'active') {
    throw AppError.conflict('RX_NOT_FOUND', `Prescription ${id} is already ${existing.status}`)
  }

  const today = todayUtc()

  const updated = await prisma.$transaction(async (tx) => {
    const rx = await tx.prescription.update({
      where: { id },
      data: {
        status: 'stopped',
        stopReason: reason,
        stoppedAt: new Date(),
        stoppedById: actor.id,
      },
      include: rxInclude,
    })

    await tx.indentLine.updateMany({
      where: {
        prescriptionId: id,
        status: 'pending',
        indent: { indentDate: { gte: today } },
      },
      data: { status: 'cancelled' },
    })

    await tx.activityEvent.create({
      data: {
        type: 'stop',
        patientId: existing.patientId,
        wardId: existing.patient.wardId,
        drugId: existing.drugId,
        actorId: actor.id,
        text: `Stop order: ${existing.drug.label} — ${existing.patient.name} — ${reason}`,
      },
    })

    return rx
  })

  return toPrescriptionDto(updated)
}
```

- [ ] **Step 5: Write the prescription routes**

`backend/src/modules/prescriptions/routes.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import {
  createPrescriptionSchema,
  stopPrescriptionSchema,
  updatePrescriptionSchema,
  type Prescription,
} from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { createPrescription, stopPrescription, updatePrescription } from './service'

const prescriptionRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>(
    '/api/patients/:id/prescriptions',
    { preHandler: app.guard('doctor') },
    async (request, reply): Promise<Prescription> => {
      const input = createPrescriptionSchema.parse(request.body)
      const rx = await createPrescription(app.prisma, requireUser(request), request.params.id, input)
      reply.status(201)
      return rx
    },
  )

  app.patch<{ Params: { id: string } }>(
    '/api/prescriptions/:id',
    { preHandler: app.guard('doctor') },
    async (request): Promise<Prescription> => {
      const input = updatePrescriptionSchema.parse(request.body)
      return updatePrescription(app.prisma, requireUser(request), request.params.id, input)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/api/prescriptions/:id/stop',
    { preHandler: app.guard('doctor') },
    async (request): Promise<Prescription> => {
      const { reason } = stopPrescriptionSchema.parse(request.body)
      return stopPrescription(app.prisma, requireUser(request), request.params.id, reason)
    },
  )
}

export default prescriptionRoutes
```

Register both modules in `backend/src/app.ts`.

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 11 new tests plus everything prior.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(backend): add the prescriptions module and drug catalog

GET /api/drugs is the real catalog. The browser previously invented drug
ids like d-ibuprofen-400mg that existed nowhere, so the service now
rejects any drugId not in the catalog rather than storing a dangling
reference. Stopping cancels pending indent lines from today forward and
leaves dispensed ones alone — the patient received those and owes for
them."
```

---

## Task 7: Inventory and activity modules

**Files:**
- Create: `backend/src/modules/inventory/service.ts`
- Create: `backend/src/modules/inventory/routes.ts`
- Create: `backend/src/modules/activity/service.ts`
- Create: `backend/src/modules/activity/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/modules/inventory/service.test.ts`
- Test: `backend/src/modules/activity/service.test.ts`

**Interfaces:**
- Consumes: `toInventoryDto`, `stockStatusFor` (Task 1), `restockSchema`, `activityQuerySchema` (Task 3).
- Produces: `listInventory(prisma, opts): Promise<InventoryItem[]>`; `restock(prisma, actor, drugId, input): Promise<InventoryItem>`; `listCategories(prisma): Promise<string[]>`; `listActivity(prisma, viewer, query): Promise<ActivityItem[]>`. Routes `GET /api/inventory`, `GET /api/inventory/categories`, `POST /api/inventory/:drugId/restock`, `GET /api/activity`.

**Restock is append-only underneath.** It increments `currentStock` and writes a `StockMovement` in one transaction, so the movement log always reconciles to the running total. Only a pharmacist may restock.

`ActivityItem` is a new shared type matching what `RecentActivityPage` renders today: `{ id, time, date, type, patient?, ward?, drug?, text, status? }`. Add it to `packages/shared/src/domain.ts`.

- [ ] **Step 1: Add the shared ActivityItem type**

Append to `packages/shared/src/domain.ts`:

```ts
export type ActivityType = 'dispense' | 'prescription' | 'stop' | 'restock' | 'register'

export interface ActivityItem {
  id: string
  /** HH:MM, already formatted for display. */
  time: string
  /** YYYY-MM-DD. */
  date: string
  type: ActivityType
  patient?: string
  ward?: string
  drug?: string
  text: string
  status?: BillingStatus
}
```

- [ ] **Step 2: Write the failing inventory test**

`backend/src/modules/inventory/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { listCategories, listInventory, restock } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('listInventory', () => {
  it('returns every stocked drug with a derived status', async () => {
    const items = await listInventory(prisma, {})
    expect(items).toHaveLength(15)

    expect(items.find((i) => i.drug === 'Furosemide 40mg')?.status).toBe('low')
    expect(items.find((i) => i.drug === 'Clopidogrel 75mg')?.status).toBe('critical')
    expect(items.find((i) => i.drug === 'Aspirin 75mg')?.status).toBe('ok')
  })

  it('exposes the drug form as the unit', async () => {
    const items = await listInventory(prisma, {})
    expect(items.find((i) => i.drug === 'Amoxicillin 500mg')?.unit).toBe('Capsule')
  })

  it('filters by category and by search term', async () => {
    expect((await listInventory(prisma, { category: 'Diuretics' })).length).toBe(2)
    expect((await listInventory(prisma, { search: 'aspir' }))[0].drug).toBe('Aspirin 75mg')
  })
})

describe('listCategories', () => {
  it('returns distinct categories in alphabetical order', async () => {
    const categories = await listCategories(prisma)
    expect(categories).toContain('Antibiotics')
    expect(categories).toContain('Diuretics')
    expect([...categories].sort()).toEqual(categories)
    expect(new Set(categories).size).toBe(categories.length)
  })
})

describe('restock', () => {
  it('increases stock and recomputes the status', async () => {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Clopidogrel 75mg' } })
    const updated = await restock(prisma, await viewerFor('k.asante'), drug.id, { qty: 200, ref: 'PO-2026-0480' })

    expect(updated.currentStock).toBe(207)
    expect(updated.status).toBe('ok')
  })

  it('writes a stock movement that reconciles with the new total', async () => {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Clopidogrel 75mg' } })
    await restock(prisma, await viewerFor('k.asante'), drug.id, { qty: 200, ref: 'PO-2026-0480' })

    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { drugId: drug.id } })
    expect(movement.delta).toBe(200)
    expect(movement.reason).toBe('restock')
    expect(movement.ref).toBe('PO-2026-0480')
  })

  it('records a restock activity event', async () => {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Clopidogrel 75mg' } })
    await restock(prisma, await viewerFor('k.asante'), drug.id, { qty: 200 })

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'restock' } })
    expect(event.text).toContain('Clopidogrel 75mg')
    expect(event.text).toContain('200')
  })

  it('rejects an unknown drug', async () => {
    await expect(restock(prisma, await viewerFor('k.asante'), 'nope', { qty: 10 }))
      .rejects.toBeInstanceOf(AppError)
  })
})
```

- [ ] **Step 3: Write the failing activity test**

`backend/src/modules/activity/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { listActivity } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

async function makeEvent(type: 'restock' | 'register', text: string, occurredAt: Date, wardCode?: string) {
  const ward = wardCode ? await prisma.ward.findUniqueOrThrow({ where: { code: wardCode } }) : null
  await prisma.activityEvent.create({
    data: { type, text, occurredAt, wardId: ward?.id ?? null },
  })
}

describe('listActivity', () => {
  it('returns events newest first', async () => {
    await makeEvent('restock', 'older', new Date('2026-08-05T07:00:00Z'))
    await makeEvent('restock', 'newer', new Date('2026-08-06T07:00:00Z'))

    const items = await listActivity(prisma, await viewerFor('k.asante'), { limit: 50 })
    expect(items[0].text).toBe('newer')
  })

  it('splits the timestamp into display date and time', async () => {
    await makeEvent('restock', 'x', new Date('2026-08-06T07:05:00Z'))

    const [item] = await listActivity(prisma, await viewerFor('k.asante'), { limit: 50 })
    expect(item.date).toBe('2026-08-06')
    expect(item.time).toBe('07:05')
  })

  it('filters by type', async () => {
    await makeEvent('restock', 'a restock', new Date('2026-08-06T07:00:00Z'))
    await makeEvent('register', 'a registration', new Date('2026-08-06T08:00:00Z'))

    const items = await listActivity(prisma, await viewerFor('k.asante'), { type: 'restock', limit: 50 })
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('a restock')
  })

  it('filters by date', async () => {
    await makeEvent('restock', 'on the 5th', new Date('2026-08-05T07:00:00Z'))
    await makeEvent('restock', 'on the 6th', new Date('2026-08-06T07:00:00Z'))

    const items = await listActivity(prisma, await viewerFor('k.asante'), { date: '2026-08-05', limit: 50 })
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('on the 5th')
  })

  it('honours the limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      await makeEvent('restock', `event ${i}`, new Date(`2026-08-06T07:0${i}:00Z`))
    }

    expect(await listActivity(prisma, await viewerFor('k.asante'), { limit: 3 })).toHaveLength(3)
  })

  it('scopes a nurse to their own ward, including events with no ward', async () => {
    await makeEvent('restock', 'ward 4A event', new Date('2026-08-06T07:00:00Z'), 'Ward 4A')
    await makeEvent('restock', 'ward 2D event', new Date('2026-08-06T08:00:00Z'), 'Ward 2D')
    await makeEvent('restock', 'pharmacy-wide event', new Date('2026-08-06T09:00:00Z'))

    const texts = (await listActivity(prisma, await viewerFor('a.owusu'), { limit: 50 })).map((i) => i.text)
    expect(texts).toContain('ward 4A event')
    expect(texts).toContain('pharmacy-wide event')
    expect(texts).not.toContain('ward 2D event')
  })
})
```

- [ ] **Step 4: Run both to verify they fail**

Run: `pnpm --filter @pharmassist/backend test src/modules/inventory src/modules/activity`
Expected: FAIL — cannot resolve either `./service`.

- [ ] **Step 5: Write the inventory service**

`backend/src/modules/inventory/service.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'
import type { InventoryItem, RestockRequest, SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toInventoryDto } from '../../domain/dto'

const itemInclude = { drug: true } satisfies Prisma.InventoryItemInclude

export interface InventoryQuery {
  category?: string
  search?: string
}

export async function listInventory(
  prisma: PrismaClient,
  query: InventoryQuery,
): Promise<InventoryItem[]> {
  const search = query.search?.trim()

  const items = await prisma.inventoryItem.findMany({
    where: {
      drug: {
        ...(query.category && query.category !== 'All' ? { category: query.category } : {}),
        ...(search ? { label: { contains: search, mode: 'insensitive' } } : {}),
      },
    },
    include: itemInclude,
    orderBy: { drug: { label: 'asc' } },
  })

  return items.map(toInventoryDto)
}

export async function listCategories(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.drug.findMany({
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  })
  return rows.map((row) => row.category)
}

/**
 * Stock and its movement log are written together, so the append-only
 * movements always reconcile with the running total.
 */
export async function restock(
  prisma: PrismaClient,
  actor: SessionUser,
  drugId: string,
  input: RestockRequest,
): Promise<InventoryItem> {
  const item = await prisma.inventoryItem.findUnique({ where: { drugId }, include: itemInclude })
  if (!item) throw AppError.notFound(`No inventory record found for drug ${drugId}`)

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.inventoryItem.update({
      where: { drugId },
      data: { currentStock: { increment: input.qty } },
      include: itemInclude,
    })

    await tx.stockMovement.create({
      data: {
        drugId,
        delta: input.qty,
        reason: 'restock',
        ref: input.ref ?? null,
        actorId: actor.id,
      },
    })

    await tx.activityEvent.create({
      data: {
        type: 'restock',
        drugId,
        actorId: actor.id,
        text: `Restocked ${item.drug.label} — +${input.qty} ${item.drug.form.toLowerCase()}s${input.ref ? ` (Ref: ${input.ref})` : ''}`,
      },
    })

    return next
  })

  return toInventoryDto(updated)
}
```

- [ ] **Step 6: Write the activity service**

`backend/src/modules/activity/service.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'
import type { ActivityItem, ActivityQuery, SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { toDateString } from '../../domain/dates'

/**
 * A nurse sees their own ward's events plus pharmacy-wide ones that carry
 * no ward — a restock is relevant to everybody.
 *
 * Fails closed: `User.wardId` is nullable, so a nurse account with no
 * assigned ward is constructible. Falling through to an unscoped `{}`
 * would hand that account every ward's activity.
 */
function scopeFor(viewer: SessionUser): Prisma.ActivityEventWhereInput {
  if (viewer.role !== 'nurse') return {}
  if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
  return { OR: [{ wardId: viewer.ward.id }, { wardId: null }] }
}

function dayRange(date: string): { gte: Date; lt: Date } {
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { gte: start, lt: end }
}

export async function listActivity(
  prisma: PrismaClient,
  viewer: SessionUser,
  query: ActivityQuery,
): Promise<ActivityItem[]> {
  const events = await prisma.activityEvent.findMany({
    where: {
      ...scopeFor(viewer),
      ...(query.type ? { type: query.type } : {}),
      ...(query.date ? { occurredAt: dayRange(query.date) } : {}),
    },
    include: { patient: true, ward: true, drug: true },
    orderBy: { occurredAt: 'desc' },
    take: query.limit,
  })

  return events.map((event) => ({
    id: event.id,
    date: toDateString(event.occurredAt),
    time: event.occurredAt.toISOString().slice(11, 16),
    type: event.type,
    ...(event.patient ? { patient: event.patient.name } : {}),
    ...(event.ward ? { ward: event.ward.code } : {}),
    ...(event.drug ? { drug: event.drug.label } : {}),
    text: event.text,
  }))
}
```

- [ ] **Step 7: Write both route files**

`backend/src/modules/inventory/routes.ts`:

```ts
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { restockSchema, type InventoryItem } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { listCategories, listInventory, restock } from './service'

const querySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
})

const inventoryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/inventory', { preHandler: app.guard() }, async (request): Promise<InventoryItem[]> => {
    return listInventory(app.prisma, querySchema.parse(request.query))
  })

  app.get('/api/inventory/categories', { preHandler: app.guard() }, async (): Promise<string[]> => {
    return listCategories(app.prisma)
  })

  app.post<{ Params: { drugId: string } }>(
    '/api/inventory/:drugId/restock',
    { preHandler: app.guard('pharmacist') },
    async (request): Promise<InventoryItem> => {
      const input = restockSchema.parse(request.body)
      return restock(app.prisma, requireUser(request), request.params.drugId, input)
    },
  )
}

export default inventoryRoutes
```

`backend/src/modules/activity/routes.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import { activityQuerySchema, type ActivityItem } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { listActivity } from './service'

const activityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/activity', { preHandler: app.guard() }, async (request): Promise<ActivityItem[]> => {
    const query = activityQuerySchema.parse(request.query)
    return listActivity(app.prisma, requireUser(request), query)
  })
}

export default activityRoutes
```

Register both in `backend/src/app.ts`.

**Note the route order:** `/api/inventory/categories` must be registered before `/api/inventory/:drugId/restock` is irrelevant (different methods), but if you later add `GET /api/inventory/:drugId`, register the literal `categories` path first or it will be captured by the parameter.

- [ ] **Step 8: Run to verify they pass**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 9 inventory + 6 activity tests plus everything prior.

- [ ] **Step 9: Commit**

```bash
git add backend/src packages/shared/src
git commit -m "feat(backend): add the inventory and activity modules

Restock updates the running total and appends its stock movement in one
transaction, so the movement log always reconciles. Stock status is
derived from the reorder level rather than stored, matching the threshold
the UI used before it had a backend. The activity feed scopes a nurse to
their ward plus pharmacy-wide events that carry no ward."
```

---

## Task 8: Frontend read hooks, and wiring Dashboard / Patients / PatientDetail

**Files:**
- Create: `frontend/src/api/wards.ts`
- Create: `frontend/src/api/patients.ts`
- Create: `frontend/src/api/prescriptions.ts`
- Create: `frontend/src/api/query.ts`
- Modify: `frontend/src/App.tsx`

- Modify: `frontend/src/pages/PatientDetailPage.tsx`
- Test: `frontend/src/api/query.test.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost`, `ApiError` (Phase 2), shared types.
- Produces:
  - `query.ts`: `buildQuery(params: Record<string, string | number | undefined>): string` — builds a query string, omitting undefined.
  - `wards.ts`: `wardsQueryKey`, `useWards()`.
  - `patients.ts`: `patientsQueryKey(query?)`, `patientQueryKey(id)`, `usePatients(query?)`, `usePatient(id)`, `useCreatePatient()`.
  - `prescriptions.ts`: `useCreatePrescription()`, `useUpdatePrescription()`, `useStopPrescription()`.

**The shape of this change.** `App.tsx` stops owning `patients` and the four mutation handlers entirely. Each page fetches what it needs. `PatientDetailPage` takes a `patientId` rather than a `Patient` object, so it can refetch itself after a stop order rather than relying on a parent's stale copy.

- [ ] **Step 1: Write the failing query-string test**

`frontend/src/api/query.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildQuery } from './query'

describe('buildQuery', () => {
  it('returns an empty string when every value is undefined', () => {
    expect(buildQuery({ a: undefined, b: undefined })).toBe('')
  })

  it('omits undefined values but keeps zero and empty strings out', () => {
    expect(buildQuery({ limit: 50, search: undefined })).toBe('?limit=50')
  })

  it('encodes values that need it', () => {
    expect(buildQuery({ search: 'Ward 4A & co' })).toBe('?search=Ward+4A+%26+co')
  })

  it('joins multiple params', () => {
    expect(buildQuery({ wardId: 'w1', search: 'ama' })).toBe('?wardId=w1&search=ama')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter figma-make-app test`
Expected: FAIL — cannot resolve `./query`.

- [ ] **Step 3: Write the query helper**

`frontend/src/api/query.ts`:

```ts
/**
 * Builds a query string, dropping undefined values so an absent filter
 * does not become the literal string "undefined" on the wire.
 */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    search.set(key, String(value))
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}
```

- [ ] **Step 4: Write the ward hooks**

`frontend/src/api/wards.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { Ward } from '@pharmassist/shared'
import { apiGet } from './client'

export const wardsQueryKey = ['wards'] as const

export function useWards() {
  return useQuery<Ward[]>({
    queryKey: wardsQueryKey,
    queryFn: () => apiGet<Ward[]>('/api/wards'),
  })
}
```

- [ ] **Step 5: Write the patient hooks**

`frontend/src/api/patients.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreatePatientRequest, Patient } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'
import { wardsQueryKey } from './wards'

export interface PatientsQuery {
  wardId?: string
  search?: string
}

export const patientsQueryKey = (query: PatientsQuery = {}) => ['patients', query] as const
export const patientQueryKey = (id: string) => ['patients', 'detail', id] as const

export function usePatients(query: PatientsQuery = {}) {
  return useQuery<Patient[]>({
    queryKey: patientsQueryKey(query),
    queryFn: () => apiGet<Patient[]>(`/api/patients${buildQuery({ ...query })}`),
  })
}

export function usePatient(id: string | null) {
  return useQuery<Patient>({
    queryKey: patientQueryKey(id ?? ''),
    queryFn: () => apiGet<Patient>(`/api/patients/${id}`),
    enabled: id !== null,
  })
}

export function useCreatePatient() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePatientRequest) => apiPost<Patient>('/api/patients', input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['patients'] })
      // A new admission changes the ward's patient count.
      client.invalidateQueries({ queryKey: wardsQueryKey })
    },
  })
}
```

- [ ] **Step 6: Write the prescription hooks**

`frontend/src/api/prescriptions.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CreatePrescriptionRequest,
  Prescription,
  UpdatePrescriptionRequest,
} from '@pharmassist/shared'
import { apiPatch, apiPost } from './client'

/** Every prescription change invalidates patient data, which embeds them. */
function useInvalidatePatients() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ['patients'] })
}

export function useCreatePrescription() {
  const invalidate = useInvalidatePatients()

  return useMutation({
    mutationFn: ({ patientId, input }: { patientId: string; input: CreatePrescriptionRequest }) =>
      apiPost<Prescription>(`/api/patients/${patientId}/prescriptions`, input),
    onSuccess: invalidate,
  })
}

export function useUpdatePrescription() {
  const invalidate = useInvalidatePatients()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePrescriptionRequest }) =>
      apiPatch<Prescription>(`/api/prescriptions/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useStopPrescription() {
  const invalidate = useInvalidatePatients()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost<Prescription>(`/api/prescriptions/${id}/stop`, { reason }),
    onSuccess: invalidate,
  })
}
```

- [ ] **Step 7: Add `apiPatch` to the client**

`frontend/src/api/client.ts` has `apiGet` and `apiPost` but no PATCH. Add alongside them, following the same shape as `apiPost` — including its no-body handling, since a bodyless request must not send a `Content-Type` header:

```ts
export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
}
```

- [ ] **Step 8: Add a shared loading/error component**

Create `frontend/src/components/AsyncState.tsx`:

```tsx
import { ApiError } from '../api/client'

/**
 * Matches the muted empty-state styling the pages already use, so a
 * loading or failed panel does not look foreign next to loaded content.
 */
export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
      {label}
    </div>
  )
}

export function ErrorPanel({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? error.message
      : 'Could not reach the server. Check your connection and try again.'

  return (
    <div style={{
      padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA',
      borderRadius: 6, fontSize: 13, color: '#DC2626',
    }}>
      {message}
    </div>
  )
}
```

- [ ] **Step 9: Rewire App.tsx**

In `frontend/src/App.tsx`: delete the `INITIAL_PATIENTS` import, the `patients` state, and the `registerPatient` / `addPrescription` / `editPrescription` / `stopPrescription` handlers entirely. Keep `page`, `selectedPatientId`, `navigate` and the session logic.

Change `openPatient` to take an id, and the render switch to pass ids rather than objects:

```tsx
  const openPatient = (patientId: string) => {
    setSelectedPatientId(patientId)
    setPage('patient-detail')
  }
```

The switch becomes:

```tsx
      case 'dashboard':
        return <DashboardPage role={role} ward={ward} />;
      case 'ward-sweep':
        return <WardSweepPage />;
      case 'patients':
        return <PatientsPage onSelectPatient={openPatient} />;
      case 'patient-detail':
        return selectedPatientId
          ? <PatientDetailPage patientId={selectedPatientId} onBack={() => navigate('patients')} />
          : null;
      case 'inventory':
        return <InventoryPage />;
      case 'billing':
        return <BillingPage />;
      case 'register-patient':
        return <RegisterPatientPage />;
      case 'doctor-patients':
        return <DoctorPatientsPage doctorName={user} />;
      case 'doctor':
        return <DoctorPage />;
      case 'recent-activity':
        return <RecentActivityPage />;
      default:
        return <DashboardPage role={role} ward={ward} />;
```

Delete the now-unused `selectedPatient` lookup and the `Patient` / `Prescription` type imports.

Tasks 8 and 9 change the remaining page signatures to match. Until both are done the frontend will not typecheck — that is expected mid-task; it must typecheck by the end of Task 9.

- [ ] **Step 10: Rewire PatientsPage and PatientDetailPage**

`frontend/src/pages/PatientsPage.tsx` — change the props and add the query, leaving all markup below untouched:

```tsx
import { useState } from 'react';
import { usePatients } from '../api/patients';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

interface PatientsPageProps {
  onSelectPatient: (patientId: string) => void;
}

export default function PatientsPage({ onSelectPatient }: PatientsPageProps) {
  const [search, setSearch] = useState('');
  const { data: patients, isLoading, error } = usePatients();

  const filtered = (patients ?? []).filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn.toLowerCase().includes(search.toLowerCase()) ||
    p.ward.toLowerCase().includes(search.toLowerCase()) ||
    p.bed.toLowerCase().includes(search.toLowerCase())
  );
```

Inside the list container, before the existing "no patients match" block, add:

```tsx
        {isLoading && <LoadingPanel label="Loading patients…" />}
        {error && <ErrorPanel error={error} />}
```

and change `{filtered.length === 0 && (` to `{!isLoading && !error && filtered.length === 0 && (`.

Change the row's click handler from `onSelectPatient(p)` to `onSelectPatient(p.id)`.

`frontend/src/pages/PatientDetailPage.tsx` — change the props to take an id and own its own data and stop mutation:

```tsx
import { useState } from 'react';
import type { Prescription } from '../types';
import { usePatient } from '../api/patients';
import { useStopPrescription } from '../api/prescriptions';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

interface PatientDetailPageProps {
  patientId: string;
  onBack: () => void;
}
```

and inside the component, replacing the destructured `patient` prop:

```tsx
export default function PatientDetailPage({ patientId, onBack }: PatientDetailPageProps) {
  const { data: patient, isLoading, error } = usePatient(patientId);
  const stop = useStopPrescription();
  const [stoppingRx, setStoppingRx] = useState<Prescription | null>(null);
  const [stopReason, setStopReason] = useState(STOP_REASONS[0]);
  const [stopNotes, setStopNotes] = useState('');

  if (isLoading) return <LoadingPanel label="Loading patient…" />;
  if (error) return <ErrorPanel error={error} />;
  if (!patient) return null;

  const activePrescriptions = patient.prescriptions.filter(rx => rx.status === 'active');
  const pastPrescriptions = patient.prescriptions.filter(rx => rx.status !== 'active');
  const doctorName = patient.prescriptions[0]?.prescribedBy ?? null;

  const handleStop = () => {
    if (!stoppingRx) return;
    stop.mutate(
      { id: stoppingRx.id, reason: `${stopReason}${stopNotes ? ' — ' + stopNotes : ''}` },
      { onSuccess: () => { setStoppingRx(null); setStopNotes(''); } },
    );
  };
```

Leave every other line of the file unchanged.

**DashboardPage is deliberately NOT wired in this task.** It reads wards, patients, inventory and billing; the inventory and billing hooks do not exist until Tasks 9 and 13. Wiring it here would mean writing imports that cannot resolve. Task 13 wires it, once all four hooks exist.
`useInventory` and `useBilling` are created in Task 9 and Task 13 respectively. Create the two hook files as part of this task if the imports do not yet resolve — their full source is given in those tasks; copying it forward is correct, not duplication.

- [ ] **Step 11: Verify the frontend tests still pass**

Run: `pnpm --filter figma-make-app test`
Expected: PASS — 6 existing + 4 new `buildQuery` tests. `tsc` will still report errors from pages not yet rewired; that is expected until Task 9 completes.

- [ ] **Step 12: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add read hooks and wire dashboard, patients, detail

App.tsx no longer owns patient state or the prescription handlers; each
page fetches what it needs. PatientDetailPage takes an id rather than a
Patient object so it refetches itself after a stop order instead of
rendering a parent's stale copy. The dashboard drops its client-side ward
filtering — the server scopes a nurse now."
```

---

## Task 9: Finish the read path — inventory, activity, doctor pages, and delete `data.ts`

**Files:**
- Create: `frontend/src/api/inventory.ts`
- Create: `frontend/src/api/activity.ts`
- Create: `frontend/src/api/drugs.ts`
- Modify: `frontend/src/pages/InventoryPage.tsx`
- Modify: `frontend/src/pages/RecentActivityPage.tsx`
- Modify: `frontend/src/pages/DoctorPatientsPage.tsx`
- Modify: `frontend/src/pages/RegisterPatientPage.tsx`
- Modify: `frontend/src/components/PrescriptionForm.tsx`
- Delete: `frontend/src/data.ts`

**Interfaces:**
- Produces: `useInventory(query?)`, `useRestock()`, `useActivity(query?)`, `useDrugs(search?)`.

**The `data.ts` deletion is the point of this task.** When it lands, no page reads a mock array. Anything still importing it is a page that was missed.

**`PrescriptionForm` stops fabricating drug ids.** Its free-text drug input becomes a select backed by `GET /api/drugs`, and `slugifyDrug` is deleted — the backend rejects any `drugId` not in the catalog, so a fabricated one would now fail the request.

- [ ] **Step 1: Write the three hook files**

`frontend/src/api/inventory.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InventoryItem, RestockRequest } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'

export interface InventoryQuery {
  category?: string
  search?: string
}

export const inventoryQueryKey = (query: InventoryQuery = {}) => ['inventory', query] as const
export const categoriesQueryKey = ['inventory', 'categories'] as const

export function useInventory(query: InventoryQuery = {}) {
  return useQuery<InventoryItem[]>({
    queryKey: inventoryQueryKey(query),
    queryFn: () => apiGet<InventoryItem[]>(`/api/inventory${buildQuery({ ...query })}`),
  })
}

export function useCategories() {
  return useQuery<string[]>({
    queryKey: categoriesQueryKey,
    queryFn: () => apiGet<string[]>('/api/inventory/categories'),
  })
}

export function useRestock() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ drugId, input }: { drugId: string; input: RestockRequest }) =>
      apiPost<InventoryItem>(`/api/inventory/${drugId}/restock`, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['inventory'] })
      client.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}
```

`frontend/src/api/activity.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { ActivityItem, ActivityType } from '@pharmassist/shared'
import { apiGet } from './client'
import { buildQuery } from './query'

export interface ActivityQueryInput {
  type?: ActivityType
  date?: string
  limit?: number
}

export const activityQueryKey = (query: ActivityQueryInput = {}) => ['activity', query] as const

export function useActivity(query: ActivityQueryInput = {}) {
  return useQuery<ActivityItem[]>({
    queryKey: activityQueryKey(query),
    queryFn: () => apiGet<ActivityItem[]>(`/api/activity${buildQuery({ ...query })}`),
  })
}
```

`frontend/src/api/drugs.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { Drug } from '@pharmassist/shared'
import { apiGet } from './client'
import { buildQuery } from './query'

export const drugsQueryKey = (search?: string) => ['drugs', search ?? ''] as const

export function useDrugs(search?: string) {
  return useQuery<Drug[]>({
    queryKey: drugsQueryKey(search),
    queryFn: () => apiGet<Drug[]>(`/api/drugs${buildQuery({ search })}`),
    // The catalog changes rarely; avoid refetching it on every mount.
    staleTime: 5 * 60_000,
  })
}
```

- [ ] **Step 2: Rewire InventoryPage**

Replace the `INVENTORY` import and the `CATEGORIES` constant with hooks, and drop the local `stocks` override map entirely — the server owns stock now:

```tsx
import { useState } from 'react';
import type { InventoryItem } from '../types';
import { useCategories, useInventory, useRestock } from '../api/inventory';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [restocking, setRestocking] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockRef, setRestockRef] = useState('');

  const { data: items, isLoading, error } = useInventory({ search: search || undefined, category });
  const { data: fetchedCategories } = useCategories();
  const restockMutation = useRestock();

  const CATEGORIES = ['All', ...(fetchedCategories ?? [])];
  const filtered = items ?? [];

  const handleRestock = () => {
    if (!restocking) return;
    const qty = parseInt(restockQty);
    if (!qty || qty <= 0) return;

    restockMutation.mutate(
      { drugId: restocking.drugId, input: { qty, ref: restockRef.trim() || undefined } },
      {
        onSuccess: () => {
          setRestocking(null);
          setRestockQty('');
          setRestockRef('');
        },
      },
    );
  };
```

Delete the `getStock` and `getStatus` helpers — the server sends `currentStock` and `status` already. Replace every `getStock(item)` with `item.currentStock` and every `getStatus(item)` with `item.status`. Add `{isLoading && <LoadingPanel />}` and `{error && <ErrorPanel error={error} />}` inside the table container above the rows.

- [ ] **Step 3: Rewire RecentActivityPage**

Delete the hardcoded `ALL_ACTIVITY` array and the local `ActivityItem` interface, importing the shared type and the hook instead:

```tsx
import { useState } from 'react';
import type { ActivityItem } from '@pharmassist/shared';
import { useActivity } from '../api/activity';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';
```

Inside the component, replace the constant with the query, keeping the existing filter UI:

```tsx
  const { data: activity, isLoading, error } = useActivity({ limit: 100 });
  const ALL_ACTIVITY: ActivityItem[] = activity ?? [];
```

Add the loading and error panels above the grouped list.

- [ ] **Step 4: Rewire DoctorPatientsPage**

Change its props to drop the injected data and handlers:

```tsx
interface DoctorPatientsPageProps {
  doctorName: string;
}
```

and inside the component:

```tsx
export default function DoctorPatientsPage({ doctorName }: DoctorPatientsPageProps) {
  const { data, isLoading, error } = usePatients();
  const createRx = useCreatePrescription();
  const updateRx = useUpdatePrescription();
  const patients = data ?? [];
```

Replace the existing `handleAdd` / `handleEdit` bodies so they call the mutations and close the form on success:

```tsx
  const handleAdd = (rx: CreatePrescriptionRequest) => {
    if (!selectedPatient) return;
    createRx.mutate(
      { patientId: selectedPatient.id, input: rx },
      { onSuccess: () => { setMode('view'); setEditingRx(null); } },
    );
  };

  const handleEdit = (rx: CreatePrescriptionRequest) => {
    if (!editingRx) return;
    updateRx.mutate(
      { id: editingRx.id, input: rx },
      { onSuccess: () => { setMode('view'); setEditingRx(null); } },
    );
  };
```

Import `usePatients`, `useCreatePrescription`, `useUpdatePrescription`, `CreatePrescriptionRequest`, and the async panels. Add the loading and error panels near the top of the rendered output.

While here, fix the three pre-existing `as any` casts flagged in the Phases 0–2 review. They read optional flags off a details array; give that array a type instead:

```tsx
  const details: { label: string; value: string; wide?: boolean; alert?: boolean }[] = [
```

then drop the `as any` from `item.wide` and both `item.alert` reads.

- [ ] **Step 5: Rewire RegisterPatientPage**

Drop the `WARDS as WARD_LIST` import and the `onRegister` prop; fetch wards and post the form:

```tsx
import { useState } from 'react';
import type { Patient } from '../types';
import { useWards } from '../api/wards';
import { useCreatePatient } from '../api/patients';
import { ErrorPanel } from '../components/AsyncState';

const BEDS = Array.from({ length: 20 }, (_, i) => `Bed ${String(i + 1).padStart(2, '0')}`);

export default function RegisterPatientPage() {
  const { data: wards } = useWards();
  const createPatient = useCreatePatient();
  const [submitted, setSubmitted] = useState(false);
  const [registeredName, setRegisteredName] = useState('');

  const [form, setForm] = useState({
    name: '',
    dateOfBirth: '',
    gender: 'Female' as Patient['gender'],
    phone: '',
    wardId: '',
    bed: BEDS[0],
    admissionDate: new Date().toISOString().split('T')[0],
    diagnosis: '',
    allergies: 'None known',
  });
```

Delete `generateMRN` — the server allocates MRNs now, and the browser's `Math.random` version could collide. Change the ward `<select>` to be value-keyed by id:

```tsx
                <select value={form.wardId} onChange={set('wardId')} style={inp} required>
                  <option value="">Select a ward…</option>
                  {(wards ?? []).map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
```

and replace `handleSubmit` with:

```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.wardId) return;

    createPatient.mutate(
      {
        name: form.name.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone.trim(),
        wardId: form.wardId,
        bed: form.bed,
        admissionDate: form.admissionDate,
        diagnosis: form.diagnosis.trim(),
        allergies: form.allergies.trim(),
      },
      {
        onSuccess: (patient) => {
          setRegisteredName(patient.name);
          setSubmitted(true);
          setForm({
            name: '', dateOfBirth: '', gender: 'Female', phone: '',
            wardId: '', bed: BEDS[0],
            admissionDate: new Date().toISOString().split('T')[0],
            diagnosis: '', allergies: 'None known',
          });
        },
      },
    );
  };
```

Render `{createPatient.error && <ErrorPanel error={createPatient.error} />}` above the submit button.

- [ ] **Step 6: Make PrescriptionForm select a real drug**

In `frontend/src/components/PrescriptionForm.tsx`, delete `slugifyDrug` entirely and replace the free-text drug input with a catalog select. Change the props so `onSave` emits the API request shape:

```tsx
import { useState } from 'react';
import type { FoodTiming, MedRoute, Prescription, TimeOfDay } from '../types';
import { FREQUENCIES, type CreatePrescriptionRequest, type Frequency } from '@pharmassist/shared';
import { useDrugs } from '../api/drugs';

interface PrescriptionFormProps {
  initial?: Partial<Prescription>;
  prescribedBy: string;
  onSave: (rx: CreatePrescriptionRequest) => void;
  onCancel: () => void;
}
```

Inside the component, add `const { data: drugs } = useDrugs();` and change the drug state to hold an id: `const [drugId, setDrugId] = useState(initial?.drugId ?? '');`. Replace the drug `<input>` with:

```tsx
          <select required value={drugId} onChange={e => setDrugId(e.target.value)} style={inp}>
            <option value="">Select a drug…</option>
            {(drugs ?? []).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
```

and `handleSubmit` with:

```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugId || !dose.trim()) return;
    onSave({
      drugId,
      dose: dose.trim(),
      route,
      frequency,
      foodTiming,
      timeOfDay,
      startDate,
      durationDays: parseInt(durationDays) || 7,
      notes: notes.trim() || undefined,
    });
  };
```

`prescribedBy` and `prescribedAt` leave the payload — the server records the authenticated prescriber and the server clock, which the client cannot be trusted to report.

- [ ] **Step 7: Delete the mock data**

```bash
git rm frontend/src/data.ts
```

- [ ] **Step 8: Verify nothing still imports it**

Run: `grep -rn "from '\.\./data'\|from './data'" frontend/src || echo "no mock imports remain"`
Expected: `no mock imports remain`. Any hit is a page this task missed.

- [ ] **Step 9: Typecheck, test, build**

Run: `pnpm --filter figma-make-app exec tsc --noEmit && pnpm --filter figma-make-app test && pnpm --filter figma-make-app build`
Expected: All three clean. This is the first point since Task 8 began where the frontend typechecks.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git rm --cached frontend/src/data.ts 2>/dev/null || true
git commit -m "feat(frontend): wire remaining read pages and delete the mock data

data.ts is gone; no page reads a mock array. InventoryPage drops its local
stock override map and RecentActivityPage its hardcoded event list, both
of which pretended to be state. PrescriptionForm now selects from the real
drug catalog instead of minting ids like d-ibuprofen-400mg that existed
nowhere, and no longer sends prescribedBy or prescribedAt — the server
records the authenticated prescriber and its own clock. Also removes the
three pre-existing as-any casts in DoctorPatientsPage."
```

---

## Task 10: The sweep — generating daily ward indents

**Files:**
- Create: `packages/shared/src/pickup.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `backend/src/modules/indents/service.ts`
- Test: `backend/src/modules/indents/sweep.test.ts`

**Interfaces:**
- Consumes: `isDueOn`, `isSweepable`, `dosesPerDay` (shared), `treatmentDayFor`, `todayUtc` (Task 1).
- Produces: `runSweep(prisma, opts): Promise<SweepResult>` where `opts` is `{ date?: Date; wardId?: string; preview?: boolean }`; `SweepResult` is `{ date: string; wards: { wardId: string; wardCode: string; indentId: string | null; lineCount: number; patientCount: number; status: SweepStatus }[] }`.

**This is the heart of the system.** It materialises, for each ward and calendar day, one `DailyIndent` and one `IndentLine` per due prescription.

**Inclusion rule — a prescription generates a line on date D when all hold:**
1. `status === 'active'` (a stopped one never generates)
2. `isSweepable(frequency)` — PRN and STAT are dispensed ad hoc, never swept
3. `isDueOn(frequency, startDate, D)` — every day for daily codes; every seventh day for Weekly
4. `treatmentDayFor(startDate, D) <= durationDays` — the course has not elapsed
5. The patient is still `admitted`

Quantity is `dosesPerDay(frequency)`.

**Idempotency** comes from the two unique constraints, not from checking first: `@@unique([wardId, indentDate])` on the indent and `@@unique([indentId, prescriptionId])` on the line. Use `upsert` and `createMany({ skipDuplicates: true })` so a concurrent second run cannot double-insert.

- [ ] **Step 1: Add the shared pickup types**

`packages/shared/src/pickup.ts`:

```ts
import type { MedRoute, SweepStatus } from './domain'

export interface PickupLine {
  lineId: string
  drug: string
  dose: string
  route: MedRoute
  qty: number
  treatmentDay: number
  durationDays: number
  status: 'pending' | 'dispensed' | 'cancelled'
}

/** The shape WardSweepPage renders, one entry per patient. */
export interface PickupPatient {
  patientId: string
  name: string
  mrn: string
  bed: string
  medicines: PickupLine[]
  dispensed: boolean
}

export interface WardPickupList {
  wardId: string
  wardCode: string
  date: string
  status: SweepStatus
  patients: PickupPatient[]
}

export interface SweepWardResult {
  wardId: string
  wardCode: string
  indentId: string | null
  lineCount: number
  patientCount: number
  status: SweepStatus
}

export interface SweepResult {
  date: string
  preview: boolean
  wards: SweepWardResult[]
}
```

Add `export * from './pickup'` to `packages/shared/src/index.ts`.

- [ ] **Step 2: Write the failing sweep test**

`backend/src/modules/indents/sweep.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { runSweep } from './service'

const prisma = getTestPrisma()

/** Margaret Osei's Amoxicillin TDS runs 2026-07-29 for 7 days. */
const DURING_COURSE = new Date('2026-08-03T00:00:00Z')

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('runSweep', () => {
  it('creates one indent per ward for the date', async () => {
    const result = await runSweep(prisma, { date: DURING_COURSE })

    expect(result.date).toBe('2026-08-03')
    expect(result.wards).toHaveLength(4)
    expect(await prisma.dailyIndent.count()).toBe(4)
  })

  it('sets quantity from the dosing frequency', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const line = await prisma.indentLine.findFirstOrThrow({
      where: { drug: { label: 'Amoxicillin 500mg' } },
    })
    // TDS = three doses a day.
    expect(line.qty).toBe(3)
  })

  it('records the treatment day', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const line = await prisma.indentLine.findFirstOrThrow({
      where: { drug: { label: 'Amoxicillin 500mg' } },
    })
    // Started 2026-07-29; 2026-08-03 is day 6.
    expect(line.treatmentDay).toBe(6)
  })

  it('is idempotent — a second run adds nothing', async () => {
    await runSweep(prisma, { date: DURING_COURSE })
    const first = await prisma.indentLine.count()

    await runSweep(prisma, { date: DURING_COURSE })
    expect(await prisma.indentLine.count()).toBe(first)
    expect(await prisma.dailyIndent.count()).toBe(4)
  })

  it('excludes a stopped prescription', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const digoxin = await prisma.indentLine.findFirst({
      where: { drug: { label: 'Digoxin 0.25mg' } },
    })
    expect(digoxin).toBeNull()
  })

  it('excludes a prescription whose course has elapsed', async () => {
    // Amoxicillin: 2026-07-29 + 7 days, so day 8 is out of range.
    await runSweep(prisma, { date: new Date('2026-08-05T00:00:00Z') })

    const line = await prisma.indentLine.findFirst({
      where: { drug: { label: 'Amoxicillin 500mg' } },
    })
    expect(line).toBeNull()
  })

  it('excludes a prescription that has not started', async () => {
    await runSweep(prisma, { date: new Date('2026-07-28T00:00:00Z') })
    expect(await prisma.indentLine.count()).toBe(0)
  })

  it('never generates a line for a PRN or STAT prescription', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Ibuprofen 400mg' } })
    const prescriber = await prisma.user.findUniqueOrThrow({ where: { username: 'b.kwame' } })

    for (const frequency of ['PRN', 'STAT'] as const) {
      await prisma.prescription.create({
        data: {
          patientId: patient.id,
          drugId: drug.id,
          dose: '400mg',
          route: 'Oral',
          frequency,
          foodTiming: 'after_food',
          timeOfDay: ['morning'],
          startDate: new Date(frequency === 'PRN' ? '2026-08-02' : '2026-08-01'),
          durationDays: 10,
          prescribedById: prescriber.id,
        },
      })
    }

    await runSweep(prisma, { date: DURING_COURSE })

    const lines = await prisma.indentLine.findMany({
      where: { prescription: { frequency: { in: ['PRN', 'STAT'] } } },
    })
    expect(lines).toHaveLength(0)
  })

  it('generates a Weekly line only on its due day', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Dexamethasone 4mg' } })
    const prescriber = await prisma.user.findUniqueOrThrow({ where: { username: 'b.kwame' } })

    await prisma.prescription.create({
      data: {
        patientId: patient.id, drugId: drug.id, dose: '4mg', route: 'Oral',
        frequency: 'Weekly', foodTiming: 'after_food', timeOfDay: ['morning'],
        startDate: new Date('2026-08-03'), durationDays: 28,
        prescribedById: prescriber.id,
      },
    })

    await runSweep(prisma, { date: new Date('2026-08-03T00:00:00Z') })
    expect(await prisma.indentLine.count({ where: { drug: { label: 'Dexamethasone 4mg' }, prescription: { frequency: 'Weekly' } } })).toBe(1)

    await runSweep(prisma, { date: new Date('2026-08-04T00:00:00Z') })
    const onTheFourth = await prisma.indentLine.count({
      where: {
        prescription: { frequency: 'Weekly' },
        indent: { indentDate: new Date('2026-08-04T00:00:00Z') },
      },
    })
    expect(onTheFourth).toBe(0)
  })

  it('excludes a discharged patient', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    await prisma.patient.update({ where: { id: patient.id }, data: { status: 'discharged' } })

    await runSweep(prisma, { date: DURING_COURSE })

    expect(await prisma.indentLine.count({ where: { patientId: patient.id } })).toBe(0)
  })

  it('can sweep a single ward', async () => {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
    const result = await runSweep(prisma, { date: DURING_COURSE, wardId: ward.id })

    expect(result.wards).toHaveLength(1)
    expect(await prisma.dailyIndent.count()).toBe(1)
  })

  it('writes nothing in preview mode but still reports the counts', async () => {
    const result = await runSweep(prisma, { date: DURING_COURSE, preview: true })

    expect(result.preview).toBe(true)
    expect(result.wards.some((w) => w.lineCount > 0)).toBe(true)
    expect(await prisma.dailyIndent.count()).toBe(0)
    expect(await prisma.indentLine.count()).toBe(0)
  })

  it('marks a swept indent as swept', async () => {
    await runSweep(prisma, { date: DURING_COURSE })

    const indent = await prisma.dailyIndent.findFirstOrThrow({ where: { ward: { code: 'Ward 4A' } } })
    expect(indent.status).toBe('swept')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/indents`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 4: Write the sweep service**

`backend/src/modules/indents/service.ts`:

```ts
import type { PrismaClient } from '@prisma/client'
import {
  dosesPerDay,
  isDueOn,
  isSweepable,
  type SweepResult,
  type SweepWardResult,
} from '@pharmassist/shared'
import { toDateString, todayUtc, treatmentDayFor } from '../../domain/dates'

export interface SweepOptions {
  date?: Date
  wardId?: string
  preview?: boolean
}

interface PlannedLine {
  prescriptionId: string
  patientId: string
  drugId: string
  qty: number
  treatmentDay: number
}

/**
 * Decides which prescriptions are due on a date. Pure given its inputs —
 * the scheduled job and the manual endpoint both go through here, so a
 * re-trigger cannot diverge from the 06:00 run.
 */
function planLinesFor(
  prescriptions: {
    id: string
    patientId: string
    drugId: string
    frequency: Parameters<typeof dosesPerDay>[0]
    startDate: Date
    durationDays: number
  }[],
  date: Date,
): PlannedLine[] {
  const planned: PlannedLine[] = []

  for (const rx of prescriptions) {
    // PRN is as-needed and STAT is a one-off; neither has a schedule the
    // sweep can act on.
    if (!isSweepable(rx.frequency)) continue
    if (!isDueOn(rx.frequency, rx.startDate, date)) continue

    const treatmentDay = treatmentDayFor(rx.startDate, date)
    if (treatmentDay < 1 || treatmentDay > rx.durationDays) continue

    planned.push({
      prescriptionId: rx.id,
      patientId: rx.patientId,
      drugId: rx.drugId,
      qty: dosesPerDay(rx.frequency),
      treatmentDay,
    })
  }

  return planned
}

export async function runSweep(prisma: PrismaClient, opts: SweepOptions = {}): Promise<SweepResult> {
  const date = opts.date ?? todayUtc()
  const preview = opts.preview ?? false

  const wards = await prisma.ward.findMany({
    where: opts.wardId ? { id: opts.wardId } : {},
    orderBy: { code: 'asc' },
  })

  const results: SweepWardResult[] = []

  for (const ward of wards) {
    const prescriptions = await prisma.prescription.findMany({
      where: {
        status: 'active',
        startDate: { lte: date },
        patient: { wardId: ward.id, status: 'admitted' },
      },
      select: {
        id: true,
        patientId: true,
        drugId: true,
        frequency: true,
        startDate: true,
        durationDays: true,
      },
    })

    const planned = planLinesFor(prescriptions, date)
    const patientCount = new Set(planned.map((line) => line.patientId)).size

    if (preview) {
      results.push({
        wardId: ward.id,
        wardCode: ward.code,
        indentId: null,
        lineCount: planned.length,
        patientCount,
        status: 'pending',
      })
      continue
    }

    // Unique (wardId, indentDate) makes this safe to re-run; unique
    // (indentId, prescriptionId) plus skipDuplicates makes the lines safe
    // too, without a read-then-write race.
    const indent = await prisma.dailyIndent.upsert({
      where: { wardId_indentDate: { wardId: ward.id, indentDate: date } },
      update: {},
      create: { wardId: ward.id, indentDate: date, status: 'pending' },
    })

    if (planned.length > 0) {
      await prisma.indentLine.createMany({
        data: planned.map((line) => ({ ...line, indentId: indent.id })),
        skipDuplicates: true,
      })
    }

    const updated = await prisma.dailyIndent.update({
      where: { id: indent.id },
      // An indent that produced lines has been swept. One already marked
      // dispensed is not walked backwards by a re-run.
      data: indent.status === 'dispensed' ? {} : { status: 'swept' },
    })

    results.push({
      wardId: ward.id,
      wardCode: ward.code,
      indentId: indent.id,
      lineCount: await prisma.indentLine.count({ where: { indentId: indent.id } }),
      patientCount,
      status: updated.status,
    })
  }

  return { date: toDateString(date), preview, wards: results }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test src/modules/indents`
Expected: PASS — 13 sweep tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src packages/shared/src
git commit -m "feat(backend): add the daily ward indent sweep

Materialises one indent per ward per calendar day and one line per due
prescription, with quantity from the dosing frequency. Idempotency comes
from the unique constraints and skipDuplicates rather than a read-then-
write check, so a concurrent re-run cannot double-insert a patient's
medication. PRN and STAT never generate lines — they have no schedule —
and Weekly generates only on its due day. A re-run never walks an
already-dispensed indent backwards."
```

---

## Task 11: Pickup list and dispense — the atomic loop

**Files:**
- Modify: `backend/src/modules/indents/service.ts`
- Create: `backend/src/modules/indents/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/modules/indents/dispense.test.ts`

**Interfaces:**
- Consumes: `runSweep` (Task 10), `assertWardAccess` (Task 5), `decimalToNumber` (Task 1).
- Produces: `getPickupList(prisma, viewer, wardId, date?): Promise<WardPickupList>`; `dispense(prisma, actor, input): Promise<DispenseResult>` where `DispenseResult` is `{ patientId: string; lines: number; total: number }`. Routes `POST /api/indents/sweep`, `GET /api/wards/:id/pickup-list`, `POST /api/indents/dispense`.

**This is the highest-risk code in the project** — it moves stock and creates money in one operation.

**The dispense transaction, in order:**
1. Load the patient's `pending` lines for that ward and date. None → `404`. Every line already dispensed → `409 BATCH_ALREADY_FULFILLED`.
2. Check stock for **every** line **before** writing anything. Any shortfall → `409 INSUFFICIENT_STOCK` and nothing commits.
3. Decrement `currentStock`; append `StockMovement(reason: dispense)` carrying `indentLineId`.
4. Mark the lines `dispensed` with actor and timestamp.
5. Create one `BillingLine` per line, `status: pending`, with `unitPrice` **snapshotted from the catalog now** — a later price change must not rewrite billed history.
6. Append one `ActivityEvent`.
7. If every line in the ward's indent is now dispensed or cancelled, flip the indent to `dispensed`.

All of it inside a single `prisma.$transaction`. Only a pharmacist may dispense.

- [ ] **Step 1: Write the failing dispense test**

`backend/src/modules/indents/dispense.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { dispense, getPickupList, runSweep } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()
const DATE = new Date('2026-08-03T00:00:00Z')

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

async function ward4a() {
  return prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
}

async function margaret() {
  return prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
  await runSweep(prisma, { date: DATE })
})

describe('getPickupList', () => {
  it('groups lines by patient', async () => {
    const list = await getPickupList(prisma, await viewerFor('k.asante'), (await ward4a()).id, DATE)

    expect(list.wardCode).toBe('Ward 4A')
    expect(list.patients.length).toBeGreaterThan(0)
    expect(list.patients[0].medicines.length).toBeGreaterThan(0)
  })

  it('reports a patient as not dispensed before pickup', async () => {
    const list = await getPickupList(prisma, await viewerFor('k.asante'), (await ward4a()).id, DATE)
    expect(list.patients.every((p) => p.dispensed === false)).toBe(true)
  })

  it('denies a nurse another ward', async () => {
    const other = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 2D' } })
    await expect(getPickupList(prisma, await viewerFor('a.owusu'), other.id, DATE))
      .rejects.toBeInstanceOf(AppError)
  })
})

describe('dispense', () => {
  it('marks the lines dispensed and reports the total', async () => {
    const patient = await margaret()
    const result = await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    expect(result.lines).toBeGreaterThan(0)
    expect(result.total).toBeGreaterThan(0)

    const remaining = await prisma.indentLine.count({ where: { patientId: patient.id, status: 'pending' } })
    expect(remaining).toBe(0)
  })

  it('deducts exactly the dispensed quantity from stock', async () => {
    const patient = await margaret()
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: drug.id } })

    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: drug.id } })
    expect(after.currentStock).toBe(before.currentStock - 3) // TDS
  })

  it('writes a stock movement linked to the indent line', async () => {
    const patient = await margaret()
    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { reason: 'dispense' } })
    expect(movement.delta).toBeLessThan(0)
    expect(movement.indentLineId).not.toBeNull()
  })

  it('creates pending billing lines with the price snapshotted at dispense time', async () => {
    const patient = await margaret()
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })

    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const line = await prisma.billingLine.findFirstOrThrow({ where: { drugId: drug.id } })
    expect(line.status).toBe('pending')
    expect(line.unitPrice.toString()).toBe('0.85')
    expect(line.total.toString()).toBe('2.55') // 3 x 0.85

    // A later catalog change must not rewrite billed history.
    await prisma.drug.update({ where: { id: drug.id }, data: { unitPrice: '9.99' } })
    const unchanged = await prisma.billingLine.findUniqueOrThrow({ where: { id: line.id } })
    expect(unchanged.unitPrice.toString()).toBe('0.85')
  })

  it('rejects a second dispense for the same patient and day', async () => {
    const patient = await margaret()
    const input = { patientId: patient.id, wardId: (await ward4a()).id, date: DATE }
    const viewer = await viewerFor('k.asante')

    await dispense(prisma, viewer, input)

    const error = await dispense(prisma, viewer, input).catch((e) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('BATCH_ALREADY_FULFILLED')
  })

  it('rolls back entirely when any line is short of stock', async () => {
    const patient = await margaret()
    const short = await prisma.drug.findUniqueOrThrow({ where: { label: 'Lisinopril 10mg' } })
    const other = await prisma.drug.findUniqueOrThrow({ where: { label: 'Amoxicillin 500mg' } })

    await prisma.inventoryItem.update({ where: { drugId: short.id }, data: { currentStock: 0 } })
    const otherBefore = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: other.id } })

    const error = await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    }).catch((e) => e)

    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('INSUFFICIENT_STOCK')

    // Nothing at all committed.
    const otherAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { drugId: other.id } })
    expect(otherAfter.currentStock).toBe(otherBefore.currentStock)
    expect(await prisma.billingLine.count()).toBe(0)
    expect(await prisma.indentLine.count({ where: { patientId: patient.id, status: 'dispensed' } })).toBe(0)
  })

  it('rejects a patient with no pending lines for the day', async () => {
    const patient = await margaret()
    await expect(dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: new Date('2026-07-28T00:00:00Z'),
    })).rejects.toBeInstanceOf(AppError)
  })

  it('records a dispense activity event', async () => {
    const patient = await margaret()
    await dispense(prisma, await viewerFor('k.asante'), {
      patientId: patient.id, wardId: (await ward4a()).id, date: DATE,
    })

    const event = await prisma.activityEvent.findFirstOrThrow({ where: { type: 'dispense' } })
    expect(event.text).toContain('Margaret Osei')
  })

  it('flips the ward indent to dispensed once every line is done', async () => {
    const wardId = (await ward4a()).id
    const viewer = await viewerFor('k.asante')
    const patients = await prisma.patient.findMany({ where: { wardId, status: 'admitted' } })

    for (const patient of patients) {
      const pending = await prisma.indentLine.count({ where: { patientId: patient.id, status: 'pending' } })
      if (pending > 0) await dispense(prisma, viewer, { patientId: patient.id, wardId, date: DATE })
    }

    const indent = await prisma.dailyIndent.findFirstOrThrow({ where: { wardId, indentDate: DATE } })
    expect(indent.status).toBe('dispensed')
  })

  it('shows the patient as dispensed in the pickup list afterwards', async () => {
    const patient = await margaret()
    const wardId = (await ward4a()).id
    await dispense(prisma, await viewerFor('k.asante'), { patientId: patient.id, wardId, date: DATE })

    const list = await getPickupList(prisma, await viewerFor('k.asante'), wardId, DATE)
    expect(list.patients.find((p) => p.patientId === patient.id)?.dispensed).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/indents/dispense.test.ts`
Expected: FAIL — `getPickupList` and `dispense` are not exported.

- [ ] **Step 3: Add the pickup list and dispense to the indents service**

Append to `backend/src/modules/indents/service.ts`:

```ts
import type { DispenseRequest, SessionUser, WardPickupList } from '@pharmassist/shared'
import { ErrorCode } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { decimalToNumber } from '../../domain/dto'
import { assertWardAccess } from '../patients/service'

export async function getPickupList(
  prisma: PrismaClient,
  viewer: SessionUser,
  wardId: string,
  date: Date = todayUtc(),
): Promise<WardPickupList> {
  assertWardAccess(viewer, wardId)

  const ward = await prisma.ward.findUnique({ where: { id: wardId } })
  if (!ward) throw AppError.notFound(`No ward found with id ${wardId}`)

  const indent = await prisma.dailyIndent.findUnique({
    where: { wardId_indentDate: { wardId, indentDate: date } },
    include: {
      lines: {
        where: { status: { not: 'cancelled' } },
        include: { patient: true, drug: true, prescription: true },
        orderBy: [{ patient: { bed: 'asc' } }, { drug: { label: 'asc' } }],
      },
    },
  })

  if (!indent) {
    return { wardId, wardCode: ward.code, date: toDateString(date), status: 'pending', patients: [] }
  }

  const byPatient = new Map<string, WardPickupList['patients'][number]>()

  for (const line of indent.lines) {
    let entry = byPatient.get(line.patientId)
    if (!entry) {
      entry = {
        patientId: line.patientId,
        name: line.patient.name,
        mrn: line.patient.mrn,
        bed: line.patient.bed,
        medicines: [],
        dispensed: true,
      }
      byPatient.set(line.patientId, entry)
    }

    entry.medicines.push({
      lineId: line.id,
      drug: line.drug.label,
      dose: line.prescription.dose,
      route: line.prescription.route,
      qty: line.qty,
      treatmentDay: line.treatmentDay,
      durationDays: line.prescription.durationDays,
      status: line.status,
    })

    // A patient counts as dispensed only when every one of their lines is.
    if (line.status !== 'dispensed') entry.dispensed = false
  }

  return {
    wardId,
    wardCode: ward.code,
    date: toDateString(date),
    status: indent.status,
    patients: [...byPatient.values()],
  }
}

export interface DispenseResult {
  patientId: string
  lines: number
  total: number
}

/**
 * Moves stock and creates money in one all-or-nothing transaction.
 *
 * Stock is checked for every line BEFORE any write, so a shortfall on the
 * last line cannot leave the first few already deducted. The unit price is
 * snapshotted here rather than referenced, so a later catalog change
 * cannot rewrite what a patient was billed.
 */
export async function dispense(
  prisma: PrismaClient,
  actor: SessionUser,
  input: DispenseRequest & { date?: Date },
): Promise<DispenseResult> {
  const date = input.date ?? todayUtc()
  assertWardAccess(actor, input.wardId)

  return prisma.$transaction(async (tx) => {
    const lines = await tx.indentLine.findMany({
      where: {
        patientId: input.patientId,
        indent: { wardId: input.wardId, indentDate: date },
        status: { not: 'cancelled' },
      },
      include: { drug: { include: { inventoryItem: true } }, patient: { include: { ward: true } }, indent: true },
    })

    if (lines.length === 0) {
      throw AppError.notFound('No pending medication for that patient on that date')
    }

    const pending = lines.filter((line) => line.status === 'pending')
    if (pending.length === 0) {
      throw AppError.conflict(
        ErrorCode.BATCH_ALREADY_FULFILLED,
        `Medication for ${lines[0].patient.name} was already dispensed on ${toDateString(date)}`,
      )
    }

    // Check every line before writing any of them.
    for (const line of pending) {
      const stock = line.drug.inventoryItem
      if (!stock) {
        throw AppError.conflict(ErrorCode.INSUFFICIENT_STOCK, `${line.drug.label} has no inventory record`)
      }
      if (stock.currentStock < line.qty) {
        throw AppError.conflict(
          ErrorCode.INSUFFICIENT_STOCK,
          `${line.drug.label}: ${stock.currentStock} in stock, ${line.qty} required`,
        )
      }
    }

    let total = 0

    for (const line of pending) {
      await tx.inventoryItem.update({
        where: { drugId: line.drugId },
        data: { currentStock: { decrement: line.qty } },
      })

      await tx.stockMovement.create({
        data: {
          drugId: line.drugId,
          delta: -line.qty,
          reason: 'dispense',
          indentLineId: line.id,
          actorId: actor.id,
        },
      })

      await tx.indentLine.update({
        where: { id: line.id },
        data: { status: 'dispensed', dispensedById: actor.id, dispensedAt: new Date() },
      })

      const unitPrice = line.drug.unitPrice
      const lineTotal = unitPrice.mul(line.qty)
      total += decimalToNumber(lineTotal)

      await tx.billingLine.create({
        data: {
          indentLineId: line.id,
          patientId: line.patientId,
          wardId: input.wardId,
          drugId: line.drugId,
          qty: line.qty,
          unitPrice,
          total: lineTotal,
          status: 'pending',
        },
      })
    }

    const patient = pending[0].patient
    const summary = pending.map((line) => `${line.drug.label} × ${line.qty}`).join(' + ')

    await tx.activityEvent.create({
      data: {
        type: 'dispense',
        patientId: patient.id,
        wardId: input.wardId,
        drugId: pending[0].drugId,
        actorId: actor.id,
        text: `Dispensed ${summary} — ${patient.name} (${patient.ward.code})`,
      },
    })

    const stillOpen = await tx.indentLine.count({
      where: { indentId: pending[0].indentId, status: 'pending' },
    })

    if (stillOpen === 0) {
      await tx.dailyIndent.update({
        where: { id: pending[0].indentId },
        data: { status: 'dispensed' },
      })
    }

    return { patientId: input.patientId, lines: pending.length, total }
  })
}
```

- [ ] **Step 4: Write the indent routes**

`backend/src/modules/indents/routes.ts`:

```ts
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { dispenseRequestSchema, sweepRequestSchema, type SweepResult, type WardPickupList } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { dispense, getPickupList, runSweep, type DispenseResult } from './service'

const dateQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })

function parseDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined
}

const indentRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/indents/sweep', { preHandler: app.guard('pharmacist') }, async (request): Promise<SweepResult> => {
    const input = sweepRequestSchema.parse(request.body ?? {})
    return runSweep(app.prisma, {
      date: parseDate(input.date),
      wardId: input.wardId,
      preview: input.preview,
    })
  })

  app.get<{ Params: { id: string } }>(
    '/api/wards/:id/pickup-list',
    { preHandler: app.guard() },
    async (request): Promise<WardPickupList> => {
      const { date } = dateQuerySchema.parse(request.query)
      return getPickupList(app.prisma, requireUser(request), request.params.id, parseDate(date))
    },
  )

  app.post('/api/indents/dispense', { preHandler: app.guard('pharmacist') }, async (request): Promise<DispenseResult> => {
    const input = dispenseRequestSchema.parse(request.body)
    return dispense(app.prisma, requireUser(request), { ...input, date: parseDate(input.date) })
  })
}

export default indentRoutes
```

Register in `backend/src/app.ts`.

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 14 new pickup/dispense tests plus everything prior.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(backend): add the pickup list and atomic dispense

Dispensing is the only thing that moves stock and the only thing that
creates a billing line. Stock is checked for every line before any write,
so a shortfall on the last line cannot leave earlier ones already
deducted — the whole batch rolls back. The unit price is snapshotted onto
the billing line rather than referenced, so a later catalog change cannot
rewrite what a patient was billed."
```

---

## Task 12: Billing module and the scheduled sweep

**Files:**
- Create: `backend/src/modules/billing/service.ts`
- Create: `backend/src/modules/billing/routes.ts`
- Create: `backend/src/jobs/sweep.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/package.json`
- Test: `backend/src/modules/billing/service.test.ts`

**Interfaces:**
- Consumes: `toTransactionDto` (Task 1), `dispense`/`runSweep` (Tasks 10–11), `confirmBillingSchema` (Task 3).
- Produces: `listBilling(prisma, viewer, query): Promise<PatientBillingGroup[]>`; `confirmBilling(prisma, actor, input): Promise<PatientBillingGroup>`; `registerSweepJob(app): void`. Routes `GET /api/billing`, `POST /api/billing/confirm`.

Add to `packages/shared/src/pickup.ts`:

```ts
import type { Transaction } from './domain'

export interface PatientBillingGroup {
  patientId: string
  patient: string
  ward: string
  transactions: Transaction[]
  total: number
  pendingCount: number
  billed: boolean
}
```

The cron job uses `node-cron`. Add `"node-cron": "^3.0.3"` and `"@types/node-cron": "^3.0.11"` to `backend/package.json`, then `pnpm install`.

**The job calls `runSweep` — the same function the endpoint calls.** One code path, so a manual re-trigger cannot drift from the scheduled run. It is registered only in `server.ts`, never in `buildApp`, so tests never start a scheduler.

- [ ] **Step 1: Write the failing billing test**

`backend/src/modules/billing/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { dispense, runSweep } from '../indents/service'
import { confirmBilling, listBilling } from './service'
import type { SessionUser } from '@pharmassist/shared'

const prisma = getTestPrisma()
const DATE = new Date('2026-08-03T00:00:00Z')

async function viewerFor(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { ward: true } })
  return {
    id: user.id, username: user.username, displayName: user.displayName, role: user.role,
    ward: user.ward
      ? { id: user.ward.id, code: user.ward.code, name: user.ward.name, label: `${user.ward.code} — ${user.ward.name}` }
      : null,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
  await runSweep(prisma, { date: DATE })

  const ward = await prisma.ward.findUniqueOrThrow({ where: { code: 'Ward 4A' } })
  const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
  await dispense(prisma, await viewerFor('k.asante'), { patientId: patient.id, wardId: ward.id, date: DATE })
})

describe('listBilling', () => {
  it('groups billing lines by patient with a total', async () => {
    const groups = await listBilling(prisma, await viewerFor('k.asante'), {})

    expect(groups).toHaveLength(1)
    expect(groups[0].patient).toBe('Margaret Osei')
    expect(groups[0].transactions.length).toBeGreaterThan(0)
    expect(groups[0].total).toBeGreaterThan(0)
    expect(groups[0].billed).toBe(false)
  })

  it('sends money as numbers, not Decimal strings', async () => {
    const [group] = await listBilling(prisma, await viewerFor('k.asante'), {})

    expect(typeof group.total).toBe('number')
    expect(typeof group.transactions[0].unitPrice).toBe('number')
    expect(typeof group.transactions[0].total).toBe('number')
  })

  it('scopes a nurse to their own ward', async () => {
    const groups = await listBilling(prisma, await viewerFor('y.darko'), {})
    expect(groups).toHaveLength(0)
  })
})

describe('confirmBilling', () => {
  it('marks the patient group billed', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const group = await confirmBilling(prisma, await viewerFor('k.asante'), { patientId: patient.id, date: DATE })

    expect(group.billed).toBe(true)
    expect(group.pendingCount).toBe(0)

    const lines = await prisma.billingLine.findMany({ where: { patientId: patient.id } })
    expect(lines.every((l) => l.status === 'billed')).toBe(true)
    expect(lines.every((l) => l.billedAt !== null)).toBe(true)
  })

  it('rejects confirming an already-billed group', async () => {
    const patient = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-004821' } })
    const viewer = await viewerFor('k.asante')
    await confirmBilling(prisma, viewer, { patientId: patient.id, date: DATE })

    const error = await confirmBilling(prisma, viewer, { patientId: patient.id, date: DATE }).catch((e) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error.code).toBe('ALREADY_BILLED')
  })

  it('rejects a patient with nothing to bill', async () => {
    const other = await prisma.patient.findFirstOrThrow({ where: { mrn: 'MRN-002017' } })
    await expect(confirmBilling(prisma, await viewerFor('k.asante'), { patientId: other.id, date: DATE }))
      .rejects.toBeInstanceOf(AppError)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/billing`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 3: Write the billing service**

`backend/src/modules/billing/service.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'
import { ErrorCode, type ConfirmBillingRequest, type PatientBillingGroup, type SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { decimalToNumber, toTransactionDto } from '../../domain/dto'
import { assertWardAccess } from '../patients/service'

const lineInclude = {
  patient: true,
  ward: true,
  drug: true,
  indentLine: { include: { indent: true } },
} satisfies Prisma.BillingLineInclude

type LineWithRelations = Prisma.BillingLineGetPayload<{ include: typeof lineInclude }>

export interface BillingQuery {
  wardId?: string
  date?: Date
}

function group(lines: LineWithRelations[]): PatientBillingGroup[] {
  const groups = new Map<string, PatientBillingGroup>()

  for (const line of lines) {
    let entry = groups.get(line.patientId)
    if (!entry) {
      entry = {
        patientId: line.patientId,
        patient: line.patient.name,
        ward: line.ward.code,
        transactions: [],
        total: 0,
        pendingCount: 0,
        billed: true,
      }
      groups.set(line.patientId, entry)
    }

    entry.transactions.push(toTransactionDto(line))
    entry.total += decimalToNumber(line.total)
    if (line.status === 'pending') {
      entry.pendingCount += 1
      entry.billed = false
    }
  }

  // Money is summed from Decimal values one at a time, so round once at
  // the end rather than letting float drift accumulate in the display.
  for (const entry of groups.values()) {
    entry.total = Math.round(entry.total * 100) / 100
  }

  return [...groups.values()]
}

function scopeFor(viewer: SessionUser, requestedWardId?: string): Prisma.BillingLineWhereInput {
  if (viewer.role === 'nurse') {
    if (!viewer.ward) throw AppError.forbidden('Your account has no assigned ward')
    if (requestedWardId) assertWardAccess(viewer, requestedWardId)
    return { wardId: viewer.ward.id }
  }
  return requestedWardId ? { wardId: requestedWardId } : {}
}

export async function listBilling(
  prisma: PrismaClient,
  viewer: SessionUser,
  query: BillingQuery,
): Promise<PatientBillingGroup[]> {
  const lines = await prisma.billingLine.findMany({
    where: {
      ...scopeFor(viewer, query.wardId),
      ...(query.date ? { indentLine: { indent: { indentDate: query.date } } } : {}),
    },
    include: lineInclude,
    orderBy: { createdAt: 'desc' },
  })

  return group(lines)
}

export async function confirmBilling(
  prisma: PrismaClient,
  actor: SessionUser,
  input: ConfirmBillingRequest & { date?: Date },
): Promise<PatientBillingGroup> {
  const patient = await prisma.patient.findUnique({ where: { id: input.patientId } })
  if (!patient) throw AppError.notFound(`No patient found with id ${input.patientId}`)
  assertWardAccess(actor, patient.wardId)

  const where: Prisma.BillingLineWhereInput = {
    patientId: input.patientId,
    ...(input.date ? { indentLine: { indent: { indentDate: input.date } } } : {}),
  }

  const existing = await prisma.billingLine.findMany({ where, include: lineInclude })
  if (existing.length === 0) {
    throw AppError.notFound(`Nothing to bill for ${patient.name}`)
  }
  if (existing.every((line) => line.status !== 'pending')) {
    throw AppError.conflict(ErrorCode.ALREADY_BILLED, `${patient.name}'s account was already billed`)
  }

  await prisma.billingLine.updateMany({
    where: { ...where, status: 'pending' },
    data: { status: 'billed', billedById: actor.id, billedAt: new Date() },
  })

  const updated = await prisma.billingLine.findMany({ where, include: lineInclude })
  const [result] = group(updated)
  return result
}
```

- [ ] **Step 4: Write the billing routes**

`backend/src/modules/billing/routes.ts`:

```ts
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { confirmBillingSchema, type PatientBillingGroup } from '@pharmassist/shared'
import { requireUser } from '../../plugins/auth'
import { confirmBilling, listBilling } from './service'

const querySchema = z.object({
  wardId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function parseDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined
}

const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/billing', { preHandler: app.guard() }, async (request): Promise<PatientBillingGroup[]> => {
    const query = querySchema.parse(request.query)
    return listBilling(app.prisma, requireUser(request), {
      wardId: query.wardId,
      date: parseDate(query.date),
    })
  })

  app.post('/api/billing/confirm', { preHandler: app.guard('pharmacist') }, async (request): Promise<PatientBillingGroup> => {
    const input = confirmBillingSchema.parse(request.body)
    return confirmBilling(app.prisma, requireUser(request), { ...input, date: parseDate(input.date) })
  })
}

export default billingRoutes
```

Register in `backend/src/app.ts`.

- [ ] **Step 5: Write the scheduled job**

`backend/src/jobs/sweep.ts`:

```ts
import cron from 'node-cron'
import type { FastifyInstance } from 'fastify'
import { runSweep } from '../modules/indents/service'

/** 06:00 every day, server time. */
const SCHEDULE = '0 6 * * *'

/**
 * Calls the same service the manual endpoint calls, so a re-trigger cannot
 * drift from the scheduled run. Registered only from server.ts — tests
 * build the app without ever starting a scheduler.
 */
export function registerSweepJob(app: FastifyInstance): void {
  cron.schedule(SCHEDULE, () => {
    void runSweep(app.prisma)
      .then((result) => {
        const lines = result.wards.reduce((sum, ward) => sum + ward.lineCount, 0)
        app.log.info({ date: result.date, wards: result.wards.length, lines }, 'Daily ward sweep complete')
      })
      .catch((error) => {
        app.log.error({ err: error }, 'Daily ward sweep failed')
      })
  })

  app.log.info({ schedule: SCHEDULE }, 'Daily ward sweep scheduled')
}
```

In `backend/src/server.ts`, after the app is built and before `listen`:

```ts
import { registerSweepJob } from './jobs/sweep'

registerSweepJob(app)
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm install && pnpm --filter @pharmassist/backend test`
Expected: PASS — 6 new billing tests plus everything prior. No test should hang; if the suite does not exit, the scheduler leaked into `buildApp`.

- [ ] **Step 7: Commit**

```bash
git add backend packages/shared pnpm-lock.yaml
git commit -m "feat(backend): add the billing module and the 06:00 sweep job

Billing groups by patient and sends money as numbers rather than the
Decimal strings Prisma would otherwise serialise. The scheduled job calls
the same runSweep the endpoint does, so a manual re-trigger cannot drift
from the nightly run, and it is registered only in server.ts so tests
never start a scheduler."
```

---

## Task 13: Wire WardSweepPage and BillingPage — closing the loop in the UI

**Files:**
- Create: `frontend/src/api/indents.ts`
- Create: `frontend/src/api/billing.ts`
- Modify: `frontend/src/pages/WardSweepPage.tsx`
- Modify: `frontend/src/pages/BillingPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Produces: `usePickupList(wardId, date?)`, `useDispense()`, `useSweep()`, `useBilling(query?)`, `useConfirmBilling()`.

**The state split matters here.** In both pages the `'confirming'` step is genuine UI state and stays local — routing it through the server would make cancelling a confirm dialog need a round trip. Only `'dispensed'` and `'billed'` become server-derived. Getting this backwards is the most likely mistake in this task.

- [ ] **Step 1: Write the hook files**

`frontend/src/api/indents.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SweepResult, WardPickupList } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'
import { wardsQueryKey } from './wards'

export const pickupListQueryKey = (wardId: string, date?: string) =>
  ['pickup-list', wardId, date ?? 'today'] as const

export function usePickupList(wardId: string | null, date?: string) {
  return useQuery<WardPickupList>({
    queryKey: pickupListQueryKey(wardId ?? '', date),
    queryFn: () => apiGet<WardPickupList>(`/api/wards/${wardId}/pickup-list${buildQuery({ date })}`),
    enabled: wardId !== null,
  })
}

/** Dispensing changes stock, billing and the ward's sweep status too. */
function useInvalidateAfterDispense() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: ['pickup-list'] })
    client.invalidateQueries({ queryKey: ['billing'] })
    client.invalidateQueries({ queryKey: ['inventory'] })
    client.invalidateQueries({ queryKey: ['activity'] })
    client.invalidateQueries({ queryKey: wardsQueryKey })
  }
}

export function useDispense() {
  const invalidate = useInvalidateAfterDispense()

  return useMutation({
    mutationFn: (input: { patientId: string; wardId: string; date?: string }) =>
      apiPost<{ patientId: string; lines: number; total: number }>('/api/indents/dispense', input),
    onSuccess: invalidate,
  })
}

export function useSweep() {
  const invalidate = useInvalidateAfterDispense()

  return useMutation({
    mutationFn: (input: { date?: string; wardId?: string; preview?: boolean } = {}) =>
      apiPost<SweepResult>('/api/indents/sweep', input),
    onSuccess: invalidate,
  })
}
```

`frontend/src/api/billing.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PatientBillingGroup } from '@pharmassist/shared'
import { apiGet, apiPost } from './client'
import { buildQuery } from './query'

export interface BillingQueryInput {
  wardId?: string
  date?: string
}

export const billingQueryKey = (query: BillingQueryInput = {}) => ['billing', query] as const

export function useBilling(query: BillingQueryInput = {}) {
  return useQuery<PatientBillingGroup[]>({
    queryKey: billingQueryKey(query),
    queryFn: () => apiGet<PatientBillingGroup[]>(`/api/billing${buildQuery({ ...query })}`),
  })
}

export function useConfirmBilling() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: { patientId: string; date?: string }) =>
      apiPost<PatientBillingGroup>('/api/billing/confirm', input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['billing'] })
      client.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}
```

- [ ] **Step 2: Rewire WardSweepPage**

Replace the imports and the derived data, keeping every piece of markup below:

```tsx
import { useState } from 'react';
import { useWards } from '../api/wards';
import { useDispense, usePickupList, useSweep } from '../api/indents';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import SweepBar from '../components/SweepBar';
import StatusPill from '../components/StatusPill';

export default function WardSweepPage() {
  const { data: wards } = useWards();
  const [activeWardId, setActiveWardId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Only the confirm step is local. Whether a patient has been dispensed
  // comes from the server.
  const [confirming, setConfirming] = useState<string | null>(null);

  const wardId = activeWardId ?? wards?.[0]?.id ?? null;
  const { data: pickup, isLoading, error } = usePickupList(wardId);
  const dispenseMutation = useDispense();
  const sweepMutation = useSweep();

  const activeWard = (wards ?? []).find(w => w.id === wardId);
  const rawPickList = pickup?.patients ?? [];
  const pickList = search
    ? rawPickList.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.mrn.toLowerCase().includes(search.toLowerCase()) ||
        p.bed.toLowerCase().includes(search.toLowerCase()) ||
        p.medicines.some(m => m.drug.toLowerCase().includes(search.toLowerCase()))
      )
    : rawPickList;

  const allDispensed = pickList.length > 0 && pickList.every(p => p.dispensed);

  const dispense = (patientId: string) => {
    if (!wardId) return;
    dispenseMutation.mutate({ patientId, wardId }, { onSuccess: () => setConfirming(null) });
  };
```

Delete the old `buildPatientPickList` function and the `patientState` map entirely. Throughout the JSX:
- `WARDS.map(ward => ...)` becomes `(wards ?? []).map(ward => ...)`, keyed on `ward.id`, labelled `ward.code`, and its click handler sets `setActiveWardId(ward.id)` plus clears `expanded` and `confirming`.
- `activeWard` may now be undefined while wards load; guard the `SweepBar` with `{activeWard && <SweepBar ward={allDispensed ? { ...activeWard, sweepStatus: 'dispensed' } : activeWard} />}`.
- `const state = patientState[patient.patientId]` becomes `const isDispensed = patient.dispensed;` and `const isConfirming = confirming === patient.patientId;`.
- The confirm button calls `setConfirming(patient.patientId)`; cancel calls `setConfirming(null)`.
- Add `{isLoading && <LoadingPanel label="Loading pick list…" />}` and `{error && <ErrorPanel error={error} />}` inside the list container, and change the empty-state guard to `{!isLoading && !error && pickList.length === 0 && (`.

Wire the previously inert top-right button to trigger a sweep:

```tsx
        <button
          onClick={() => sweepMutation.mutate({ wardId: wardId ?? undefined })}
          disabled={sweepMutation.isPending}
          style={{ /* keep the existing style object unchanged */ }}
        >
          {sweepMutation.isPending ? 'Running sweep…' : 'Run sweep'}
        </button>
```

- [ ] **Step 3: Rewire BillingPage**

```tsx
import { useState } from 'react';
import { useBilling, useConfirmBilling } from '../api/billing';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

export default function BillingPage() {
  const [wardFilter, setWardFilter] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  // Local confirm step only; `billed` is server state.
  const [confirming, setConfirming] = useState<string | null>(null);

  const { data, isLoading, error } = useBilling();
  const confirmMutation = useConfirmBilling();

  const allGroups = data ?? [];
  const wards = ['All', ...Array.from(new Set(allGroups.map(g => g.ward)))];
  const groups = allGroups.filter(g => wardFilter === 'All' || g.ward === wardFilter);

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const billedCount = groups.filter(g => g.billed).length;

  const confirmBill = (patientId: string) => {
    confirmMutation.mutate({ patientId }, { onSuccess: () => setConfirming(null) });
  };
```

Delete `groupByPatient` and the `patientBillState` map — the server groups and owns billed status now. In the JSX, replace `group.patient` as the key with `group.patientId`, `const isBilled = state === 'billed'` with `const isBilled = group.billed`, `const isConfirming` with `confirming === group.patientId`, `groupTotal` with `group.total`, and `pendingCount` with `group.pendingCount`. Add the loading and error panels above the group list.

- [ ] **Step 4: Rewire DashboardPage**

All four hooks it needs now exist. Replace its `WARDS` / `INVENTORY` / `TRANSACTIONS` imports and its `patients` prop with queries:

```tsx
import { useState } from 'react';
import type { Role } from '../types';
import { useWards } from '../api/wards';
import { usePatients } from '../api/patients';
import { useInventory } from '../api/inventory';
import { useBilling } from '../api/billing';
import { ErrorPanel, LoadingPanel } from '../components/AsyncState';
import StatusPill from '../components/StatusPill';

interface DashboardPageProps {
  role: Role;
  ward: string;
}
```

and at the top of the component body:

```tsx
export default function DashboardPage({ role, ward }: DashboardPageProps) {
  const [drill, setDrill] = useState<DrillKey>(null);
  const [wardSearch, setWardSearch] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const wardsQuery = useWards();
  const patientsQuery = usePatients();
  const inventoryQuery = useInventory();
  const billingQuery = useBilling();

  const isLoading = wardsQuery.isLoading || patientsQuery.isLoading
    || inventoryQuery.isLoading || billingQuery.isLoading;
  const error = wardsQuery.error ?? patientsQuery.error
    ?? inventoryQuery.error ?? billingQuery.error;

  // The server scopes a nurse to their ward now, so the old client-side
  // filtering on ward.split(' — ') is gone.
  const visibleWards = wardsQuery.data ?? [];
  const activePatients = patientsQuery.data ?? [];
  const allActivePrescriptions = activePatients.flatMap(p =>
    p.prescriptions.filter(rx => rx.status === 'active').map(rx => ({
      ...rx, patientName: p.name, patientId: p.id, ward: p.ward, bed: p.bed,
    }))
  );
  const rxByPatient = activePatients.map(p => ({
    patient: p,
    prescriptions: p.prescriptions.filter(rx => rx.status === 'active'),
  })).filter(g => g.prescriptions.length > 0);
  const pendingPickups = (billingQuery.data ?? [])
    .flatMap(g => g.transactions)
    .filter(t => t.status === 'pending');
  const lowStockItems = (inventoryQuery.data ?? [])
    .filter(i => i.status === 'low' || i.status === 'critical');
```

Delete the previous `visibleWards`, `activePatients`, `allActivePrescriptions`, `rxByPatient`, `pendingPickups` and `lowStockItems` expressions that these replace. In the ward list, `w.name.split(' — ')[0]` becomes `w.code` and the specialty line becomes `w.name`. Immediately after the page's heading block, add:

```tsx
      {isLoading && <LoadingPanel />}
      {error && <ErrorPanel error={error} />}
```

Every metric tile and drill-down below stays exactly as it is — the variables they read now come from the server.

- [ ] **Step 5: Typecheck, test, build**

Run: `pnpm --filter figma-make-app exec tsc --noEmit && pnpm --filter figma-make-app test && pnpm --filter figma-make-app build`
Expected: All clean.

- [ ] **Step 6: Verify the whole loop by hand**

Start both servers (`pnpm --filter @pharmassist/backend dev`, `pnpm --filter figma-make-app dev`), sign in as `k.asante` / `pharmassist`, then:

1. **Ward Sweep** → click **Run sweep**. Expected: patients appear with their medicines and quantities matching their dosing frequency (a TDS drug shows 3).
2. Note a drug's stock on the **Inventory** page.
3. Back on Ward Sweep, dispense one patient. Expected: their row shows dispensed and survives a page reload.
4. **Inventory** → expected: that drug's stock has dropped by exactly the dispensed quantity.
5. **Billing Ledger** → expected: that patient now appears with pending lines and a non-zero total. **This is the link that never existed before** — dispensing created the bill.
6. Confirm the bill. Expected: the group shows billed, and survives a reload.
7. **Recent Activity** → expected: dispense and restock entries, newest first.
8. Sign in as `a.owusu` / `pharmassist`. Expected: Ward 4A data only, and no Billing or Inventory in the navigation.

Report the actual results. If any step fails, that is a real finding — do not paper over it.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): wire ward sweep and billing, closing the loop

Dispensing now moves real stock and creates the billing line the ledger
shows — three pages that were three unrelated mock arrays are one
workflow. Both pages keep their 'confirming' step as local UI state and
take 'dispensed' and 'billed' from the server, so cancelling a confirm
dialog still costs no round trip."
```

---

## Done criteria for Phases 3–4

- `pnpm -r test` passes across all three packages.
- `frontend/src/data.ts` no longer exists and nothing imports it.
- Dispensing is the only way stock moves and the only way a billing line is created.
- A shortfall anywhere in a batch rolls the whole batch back.
- Running the sweep twice produces no duplicate medication.
- A nurse cannot read or act on another ward, enforced server-side.
- Money reaches the client as `number`, never a `Decimal` string.

## Deferred beyond this plan

Phase 5 (remaining write paths not covered here) and Phase 6 (rewriting `API_ENDPOINTS_DETAILED.md` and `INPATIENT_AUTO_INDENT_MODULE_SPEC.md` from shipped code). Also still open from the Phases 0–2 review: no CORS plugin and no login rate limit, which a split-origin production deploy would need.
