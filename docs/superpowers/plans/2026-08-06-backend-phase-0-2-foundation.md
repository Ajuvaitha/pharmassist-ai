# Pharmassist Backend — Phases 0–2 (Foundation & Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a pnpm workspace with a shared types package, a Fastify + Prisma + Postgres backend with the full schema and seed data, and real cookie-based JWT auth wired end-to-end into the existing `LoginPage`.

**Architecture:** Three workspace members — `packages/shared` (domain types, Zod contracts, frequency math; depends on nothing), `backend` (Fastify modules where `routes.ts` handles HTTP and `service.ts` is the only layer touching Prisma), and the existing `frontend` (rewired to call `/api` through a Vite dev proxy). Postgres runs in Docker with a separate `pharmassist_test` database for the test suite.

**Tech Stack:** Node 22, pnpm 10+, TypeScript 5.7, Fastify 5, Prisma 6, PostgreSQL 16, Zod 4, `@node-rs/argon2`, `@fastify/jwt`, `@fastify/cookie`, Vitest 3, TanStack Query 5, React 19, Vite 8.

**Source spec:** `docs/superpowers/specs/2026-08-06-pharmassist-backend-design.md`

## Global Constraints

- Node 22. pnpm 10 or newer (`.mise.toml` pins `node = "22"`).
- All money is `Decimal(10,2)` in Prisma and the `Decimal` type in code. **Never** `Float`. Currency is GHS, a display constant, never a column.
- `packages/shared` imports nothing from `backend` or `frontend`. `backend` and `frontend` never import each other.
- `routes.ts` files contain HTTP and Zod validation only. `service.ts` files are the only place Prisma is touched.
- Every API error response uses the envelope `{ success: false, error: CODE, message: string }`.
- JWT travels in an httpOnly, `SameSite=Lax` cookie named `pharmassist_session`. Never `localStorage`.
- Frontend page markup is preserved. Only data sources and handlers change.
- Existing frontend package name stays `figma-make-app` — Figma Make tooling depends on it. Workspace targeting uses `--filter figma-make-app`.
- Dates that represent calendar days (`startDate`, `admissionDate`, `dateOfBirth`, `indentDate`) use Prisma `@db.Date`, not timestamps.

---

## File Structure

**`packages/shared/`** — the contract. No runtime dependencies beyond Zod.
- `src/frequency.ts` — `Frequency` union and `dosesPerDay()`. The single source for daily quantity.
- `src/domain.ts` — `Ward`, `Patient`, `Prescription`, `Drug`, `InventoryItem`, `Transaction`, `Role` and supporting unions. Replaces `frontend/src/types.ts`.
- `src/ward.ts` — `wardLabel()`, retiring the `.split(' — ')` hack.
- `src/errors.ts` — `ErrorCode` constants and the `ApiError` envelope type.
- `src/auth.ts` — `SessionUser`, `loginRequestSchema`, `LoginRequest`, `LoginResponse`.
- `src/index.ts` — barrel re-export.

**`backend/`**
- `prisma/schema.prisma` — all 11 models.
- `prisma/seed.ts` — wards, drugs, inventory, patients, prescriptions, users.
- `src/env.ts` — Zod-validated environment.
- `src/app.ts` — `buildApp()`, composable for tests.
- `src/server.ts` — process entrypoint.
- `src/plugins/prisma.ts`, `src/plugins/errors.ts`, `src/plugins/auth.ts`.
- `src/modules/auth/{password.ts,service.ts,routes.ts}` + tests.
- `src/test/{setup.ts,helpers.ts}` — test database lifecycle.

**`frontend/`** (modified)
- `src/api/client.ts` — fetch wrapper, error-envelope unwrapping.
- `src/api/auth.ts` — `useMe`, `useLogin`, `useLogout`.
- `src/types.ts` — becomes a re-export of `@pharmassist/shared`.
- `src/main.tsx`, `src/App.tsx`, `src/pages/LoginPage.tsx`, `vite.config.ts` — modified.

---

## Task 1: pnpm workspace and the frequency module

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (repo root)
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/frequency.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/frequency.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: package `@pharmassist/shared`. Exports `type Frequency = 'OD' | 'BD' | 'TDS' | 'QDS' | 'ON'`, `FREQUENCIES: readonly Frequency[]`, `dosesPerDay(frequency: Frequency): number`, `isFrequency(value: string): value is Frequency`.

- [ ] **Step 1: Create the workspace manifest**

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'backend'
  - 'frontend'
```

- [ ] **Step 2: Create the root package.json**

`package.json`:

```json
{
  "name": "pharmassist-ai",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev:frontend": "pnpm --filter figma-make-app dev",
    "dev:backend": "pnpm --filter @pharmassist/backend dev",
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  }
}
```

- [ ] **Step 3: Create the shared package manifest and tsconfig**

`packages/shared/package.json`:

```json
{
  "name": "@pharmassist/shared",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

`packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: pnpm creates the workspace, links `@pharmassist/shared`, and reports the three projects. `frontend` still installs its own deps.

- [ ] **Step 5: Write the failing test**

`packages/shared/src/frequency.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FREQUENCIES, dosesPerDay, isFrequency } from './frequency'

describe('dosesPerDay', () => {
  it('maps each dosing code to its daily dose count', () => {
    expect(dosesPerDay('OD')).toBe(1)
    expect(dosesPerDay('BD')).toBe(2)
    expect(dosesPerDay('TDS')).toBe(3)
    expect(dosesPerDay('QDS')).toBe(4)
    expect(dosesPerDay('ON')).toBe(1)
  })

  it('covers every frequency in FREQUENCIES', () => {
    for (const frequency of FREQUENCIES) {
      expect(dosesPerDay(frequency)).toBeGreaterThan(0)
    }
  })
})

describe('isFrequency', () => {
  it('accepts known codes', () => {
    expect(isFrequency('TDS')).toBe(true)
  })

  it('rejects unknown codes', () => {
    expect(isFrequency('PRN')).toBe(false)
    expect(isFrequency('')).toBe(false)
    expect(isFrequency('tds')).toBe(false)
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter @pharmassist/shared test`
Expected: FAIL — `Failed to resolve import "./frequency"`.

- [ ] **Step 7: Write the implementation**

`packages/shared/src/frequency.ts`:

```ts
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
```

`packages/shared/src/index.ts`:

```ts
export * from './frequency'
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter @pharmassist/shared test`
Expected: PASS — 3 tests.

- [ ] **Step 9: Update .gitignore**

Replace the contents of `.gitignore` with:

```
node_modules
**/node_modules
frontend/dist
backend/dist
packages/*/dist
.env
.env.*
!.env.example
.DS_Store
*.log
.worktrees
.superpowers
```

- [ ] **Step 10: Verify the frontend still builds**

Run: `pnpm --filter figma-make-app build`
Expected: Vite build succeeds. The workspace conversion must not break the existing app.

- [ ] **Step 11: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml .gitignore packages/shared
git commit -m "feat(shared): add pnpm workspace and frequency module

dosesPerDay is the single source of truth for daily quantity, shared by
the sweep job and the UI so they cannot drift."
```

---

## Task 2: Shared domain types and ward labelling

**Files:**
- Create: `packages/shared/src/ward.ts`
- Create: `packages/shared/src/domain.ts`
- Create: `packages/shared/src/errors.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `frontend/src/types.ts`
- Test: `packages/shared/src/ward.test.ts`

**Interfaces:**
- Consumes: `Frequency` from Task 1.
- Produces: `wardLabel(ward: { code: string; name: string }): string`; `parseWardCode(label: string): string`; domain types `Role`, `Gender`, `MedRoute`, `FoodTiming`, `TimeOfDay`, `PatientStatus`, `PrescriptionStatus`, `Ward`, `Patient`, `Prescription`, `Drug`, `InventoryItem`, `Transaction`; `ErrorCode` const object and `ApiErrorBody` type.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/ward.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseWardCode, wardLabel } from './ward'

describe('wardLabel', () => {
  it('composes code and name with an em-dash separator', () => {
    expect(wardLabel({ code: 'Ward 4A', name: 'General Medicine' }))
      .toBe('Ward 4A — General Medicine')
  })
})

describe('parseWardCode', () => {
  it('extracts the code from a composed label', () => {
    expect(parseWardCode('Ward 4A — General Medicine')).toBe('Ward 4A')
  })

  it('returns the input unchanged when there is no separator', () => {
    expect(parseWardCode('Ward 4A')).toBe('Ward 4A')
  })

  it('keeps an em-dash that appears in the ward name', () => {
    expect(parseWardCode('Ward 7E — Ear — Nose — Throat')).toBe('Ward 7E')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @pharmassist/shared test`
Expected: FAIL — `Failed to resolve import "./ward"`.

- [ ] **Step 3: Write the ward helper**

`packages/shared/src/ward.ts`:

```ts
export const WARD_SEPARATOR = ' — '

/** Composes the display string the UI shows, e.g. "Ward 4A — General Medicine". */
export function wardLabel(ward: { code: string; name: string }): string {
  return `${ward.code}${WARD_SEPARATOR}${ward.name}`
}

/**
 * Recovers the ward code from a composed label. Splits on the first
 * separator only, so a ward name containing an em-dash survives intact.
 */
export function parseWardCode(label: string): string {
  const index = label.indexOf(WARD_SEPARATOR)
  return index === -1 ? label : label.slice(0, index)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @pharmassist/shared test`
Expected: PASS — 6 tests total.

- [ ] **Step 5: Write the domain types**

`packages/shared/src/domain.ts`:

```ts
import type { Frequency } from './frequency'

export type Role = 'pharmacist' | 'nurse' | 'doctor'
export type Gender = 'Male' | 'Female' | 'Other'
export type MedRoute = 'Oral' | 'IV' | 'IM' | 'SC' | 'Topical' | 'Inhaled'
export type FoodTiming = 'before-food' | 'after-food' | 'with-food' | 'not-applicable'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'
export type PatientStatus = 'admitted' | 'discharged'
export type PrescriptionStatus = 'active' | 'stopped' | 'completed'
export type SweepStatus = 'pending' | 'swept' | 'dispensed'
export type StockStatus = 'ok' | 'low' | 'critical'
export type BillingStatus = 'billed' | 'pending' | 'voided'

export interface Ward {
  id: string
  /** Short identifier, e.g. "Ward 4A". */
  code: string
  /** Specialty, e.g. "General Medicine". */
  name: string
  /** Composed display string, e.g. "Ward 4A — General Medicine". */
  label: string
  sweepStatus: SweepStatus
  activePatients: number
}

export interface Drug {
  id: string
  /** Composed display string, e.g. "Furosemide 40mg". */
  label: string
  name: string
  strength: string
  form: string
  category: string
  unitPrice: number
}

export interface Prescription {
  id: string
  drugId: string
  /** Denormalised drug label so list views need no join client-side. */
  drug: string
  dose: string
  route: MedRoute
  frequency: Frequency
  foodTiming: FoodTiming
  timeOfDay: TimeOfDay[]
  startDate: string
  durationDays: number
  /** Derived server-side: days since startDate + 1. Never stored. */
  currentDay: number
  status: PrescriptionStatus
  stopReason?: string
  notes?: string
  prescribedBy: string
  prescribedAt: string
}

export interface Patient {
  id: string
  mrn: string
  name: string
  dateOfBirth: string
  gender: Gender
  phone: string
  /** Ward code, e.g. "Ward 4A". */
  ward: string
  wardId: string
  bed: string
  admissionDate: string
  diagnosis: string
  allergies: string
  status: PatientStatus
  prescriptions: Prescription[]
}

export interface InventoryItem {
  id: string
  drugId: string
  drug: string
  category: string
  unit: string
  currentStock: number
  reorderLevel: number
  /** Derived server-side from currentStock and reorderLevel. Never stored. */
  status: StockStatus
}

export interface Transaction {
  id: string
  batchId: string
  patient: string
  ward: string
  drug: string
  qty: number
  unitPrice: number
  total: number
  timestamp: string
  status: BillingStatus
}
```

- [ ] **Step 6: Write the error contract**

`packages/shared/src/errors.ts`:

```ts
export const ErrorCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  RX_NOT_FOUND: 'RX_NOT_FOUND',
  NOT_FOUND: 'NOT_FOUND',
  BATCH_ALREADY_FULFILLED: 'BATCH_ALREADY_FULFILLED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  ALREADY_BILLED: 'ALREADY_BILLED',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ApiErrorBody {
  success: false
  error: ErrorCode
  message: string
}
```

- [ ] **Step 7: Update the barrel**

`packages/shared/src/index.ts`:

```ts
export * from './domain'
export * from './errors'
export * from './frequency'
export * from './ward'
```

- [ ] **Step 8: Point the frontend at the shared package**

Add the dependency to `frontend/package.json` — insert into the existing `dependencies` object so it reads:

```json
  "dependencies": {
    "@pharmassist/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
```

Replace the entire contents of `frontend/src/types.ts` with:

```ts
/**
 * Domain types live in @pharmassist/shared so the backend and frontend
 * cannot drift. This module re-exports them, plus the frontend-only
 * navigation type.
 */
export type {
  BillingStatus,
  Drug,
  FoodTiming,
  Gender,
  InventoryItem,
  MedRoute,
  Patient,
  PatientStatus,
  Prescription,
  PrescriptionStatus,
  Role,
  StockStatus,
  SweepStatus,
  TimeOfDay,
  Transaction,
  Ward,
} from '@pharmassist/shared'

export type Page =
  | 'login'
  | 'dashboard'
  | 'ward-sweep'
  | 'patient-detail'
  | 'recent-activity'
  | 'patients'
  | 'inventory'
  | 'billing'
  | 'register-patient'
  | 'doctor-patients'
  | 'doctor'
```

- [ ] **Step 9: Install and typecheck**

Run: `pnpm install && pnpm --filter figma-make-app exec tsc --noEmit`
Expected: Errors only where pages reference fields the shared types renamed — specifically `Ward.name` used as a display label. Fix those call sites by using `ward.label`:
- `frontend/src/pages/DashboardPage.tsx` and `frontend/src/pages/WardSweepPage.tsx` currently call `w.name.split(' — ')[0]`. Replace each with `w.code`.
- `frontend/src/components/SweepBar.tsx` — if it renders `ward.name`, change to `ward.label`.

Re-run until clean.

`frontend/src/data.ts` will also report errors, because the shared types require fields the mock records lack. Fix the records properly — do **not** add `// @ts-nocheck`. Specifically:

- Each `WARDS` entry needs `code` and `label`. Split the existing `name`: `{ id: 'w1', code: 'Ward 4A', name: 'General Medicine', label: 'Ward 4A — General Medicine', sweepStatus: 'dispensed', activePatients: 18 }`, and the same shape for `w2` Cardiology, `w3` Orthopaedics, `w4` Oncology.
- Each `INITIAL_PATIENTS` entry needs `wardId` (the matching ward's `id`, e.g. `'w1'` for Ward 4A) and `status: 'admitted'`. Its existing `ward` field already holds the code (`'Ward 4A'`), which is now correct.
- Each prescription needs `drugId`. Use a stable slug of the drug label: `'Amoxicillin 500mg'` → `drugId: 'd-amoxicillin-500mg'`, and so on for every prescription.
- Each `INVENTORY` entry needs `drugId` using the same slug scheme, so a mock prescription and a mock inventory row for the same drug share an id.

These are mock values that Phase 3 deletes, but they must typecheck cleanly in the meantime.

- [ ] **Step 10: Verify the build**

Run: `pnpm --filter figma-make-app build && pnpm --filter @pharmassist/shared test`
Expected: Build succeeds, 6 tests pass.

- [ ] **Step 11: Commit**

```bash
git add packages/shared frontend/package.json frontend/src pnpm-lock.yaml
git commit -m "feat(shared): add domain types, error contract, ward labelling

frontend/src/types.ts becomes a re-export so both sides share one
definition. wardLabel/parseWardCode retire the .split(' — ') hack, which
broke on ward names containing an em-dash."
```

---

## Task 3: Postgres in Docker, Prisma schema, first migration

**Files:**
- Create: `docker-compose.yml`
- Create: `docker/initdb/01-create-test-db.sql`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/.env`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/env.ts`
- Test: `backend/src/env.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: package `@pharmassist/backend`; a migrated `pharmassist` database and an empty `pharmassist_test` database; `loadEnv(source?: NodeJS.ProcessEnv)` returning `{ DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET, PORT, NODE_ENV }`; the generated Prisma client with all 11 models.

- [ ] **Step 1: Create the Docker Postgres setup**

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: pharmassist-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: pharmassist
      POSTGRES_PASSWORD: pharmassist
      POSTGRES_DB: pharmassist
    ports:
      - '5433:5432'
    volumes:
      - pharmassist-db-data:/var/lib/postgresql/data
      - ./docker/initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U pharmassist -d pharmassist']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pharmassist-db-data:
```

Host port is **5433**, not 5432, so this cannot collide with a Postgres already running on the machine.

`docker/initdb/01-create-test-db.sql`:

```sql
-- Runs once on first container start. The test suite needs an isolated
-- database it can truncate freely.
CREATE DATABASE pharmassist_test OWNER pharmassist;
```

- [ ] **Step 2: Start the database**

Run: `docker compose up -d && docker compose ps`
Expected: `pharmassist-db` reports `healthy` within ~15 seconds. Re-run `docker compose ps` if it still says `starting`.

- [ ] **Step 3: Create the backend manifest and tsconfig**

`backend/package.json`:

```json
{
  "name": "@pharmassist/backend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node --import tsx src/server.ts",
    "build": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "seed": "tsx prisma/seed.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@fastify/cookie": "^11.0.0",
    "@fastify/jwt": "^9.0.0",
    "@node-rs/argon2": "^2.0.0",
    "@pharmassist/shared": "workspace:*",
    "@prisma/client": "^6.0.0",
    "fastify": "^5.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 4: Create the environment files**

`backend/.env.example`:

```
DATABASE_URL="postgresql://pharmassist:pharmassist@localhost:5433/pharmassist?schema=public"
TEST_DATABASE_URL="postgresql://pharmassist:pharmassist@localhost:5433/pharmassist_test?schema=public"
JWT_SECRET="replace-me-with-at-least-32-characters-of-random"
PORT=3000
NODE_ENV=development
```

`backend/.env` — same contents, but with a real secret. Generate one:

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Use the output as `JWT_SECRET`. `.env` is gitignored; `.env.example` is committed.

- [ ] **Step 5: Install**

Run: `pnpm install`
Expected: `@pharmassist/backend` resolves `@pharmassist/shared` via the workspace link.

- [ ] **Step 6: Write the Prisma schema**

`backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  pharmacist
  nurse
  doctor
}

enum Gender {
  Male
  Female
  Other
}

enum PatientStatus {
  admitted
  discharged
}

enum MedRoute {
  Oral
  IV
  IM
  SC
  Topical
  Inhaled
}

enum Frequency {
  OD
  BD
  TDS
  QDS
  ON
}

// @map keeps the hyphenated wire format the UI already uses.
enum FoodTiming {
  before_food    @map("before-food")
  after_food     @map("after-food")
  with_food      @map("with-food")
  not_applicable @map("not-applicable")
}

enum TimeOfDay {
  morning
  afternoon
  evening
  night
}

enum PrescriptionStatus {
  active
  stopped
  completed
}

enum IndentStatus {
  pending
  swept
  dispensed
}

enum IndentLineStatus {
  pending
  dispensed
  cancelled
}

enum BillingStatus {
  pending
  billed
  voided
}

enum StockReason {
  dispense
  restock
  adjustment
}

enum ActivityType {
  dispense
  prescription
  stop
  restock
  register
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  displayName  String
  role         Role
  wardId       String?
  ward         Ward?    @relation(fields: [wardId], references: [id])
  createdAt    DateTime @default(now())

  prescriptionsWritten Prescription[]  @relation("PrescribedBy")
  prescriptionsStopped Prescription[]  @relation("StoppedBy")
  indentLinesDispensed IndentLine[]
  billingLinesBilled   BillingLine[]
  stockMovements       StockMovement[]
  activityEvents       ActivityEvent[]

  @@index([wardId])
}

model Ward {
  id   String @id @default(cuid())
  code String @unique
  name String

  users          User[]
  patients       Patient[]
  indents        DailyIndent[]
  billingLines   BillingLine[]
  activityEvents ActivityEvent[]
}

model Patient {
  id            String        @id @default(cuid())
  mrn           String        @unique
  name          String
  dateOfBirth   DateTime      @db.Date
  gender        Gender
  phone         String
  wardId        String
  ward          Ward          @relation(fields: [wardId], references: [id])
  bed           String
  admissionDate DateTime      @db.Date
  diagnosis     String
  allergies     String
  status        PatientStatus @default(admitted)
  createdAt     DateTime      @default(now())

  prescriptions  Prescription[]
  indentLines    IndentLine[]
  billingLines   BillingLine[]
  activityEvents ActivityEvent[]

  @@index([wardId, status])
}

model Drug {
  id        String  @id @default(cuid())
  label     String  @unique
  name      String
  strength  String
  form      String
  category  String
  unitPrice Decimal @db.Decimal(10, 2)

  inventoryItem  InventoryItem?
  prescriptions  Prescription[]
  indentLines    IndentLine[]
  billingLines   BillingLine[]
  stockMovements StockMovement[]
  activityEvents ActivityEvent[]
}

model InventoryItem {
  id           String   @id @default(cuid())
  drugId       String   @unique
  drug         Drug     @relation(fields: [drugId], references: [id])
  currentStock Int
  reorderLevel Int
  updatedAt    DateTime @updatedAt
}

model StockMovement {
  id           String      @id @default(cuid())
  drugId       String
  drug         Drug        @relation(fields: [drugId], references: [id])
  delta        Int
  reason       StockReason
  ref          String?
  actorId      String?
  actor        User?       @relation(fields: [actorId], references: [id])
  indentLineId String?
  createdAt    DateTime    @default(now())

  @@index([drugId, createdAt])
}

model Prescription {
  id             String             @id @default(cuid())
  patientId      String
  patient        Patient            @relation(fields: [patientId], references: [id])
  drugId         String
  drug           Drug               @relation(fields: [drugId], references: [id])
  dose           String
  route          MedRoute
  frequency      Frequency
  foodTiming     FoodTiming
  timeOfDay      TimeOfDay[]
  startDate      DateTime           @db.Date
  durationDays   Int
  status         PrescriptionStatus @default(active)
  stopReason     String?
  notes          String?
  prescribedById String
  prescribedBy   User               @relation("PrescribedBy", fields: [prescribedById], references: [id])
  prescribedAt   DateTime           @default(now())
  stoppedById    String?
  stoppedBy      User?              @relation("StoppedBy", fields: [stoppedById], references: [id])
  stoppedAt      DateTime?

  indentLines IndentLine[]

  @@index([patientId, status])
  @@index([status, startDate])
}

model DailyIndent {
  id          String       @id @default(cuid())
  wardId      String
  ward        Ward         @relation(fields: [wardId], references: [id])
  indentDate  DateTime     @db.Date
  status      IndentStatus @default(pending)
  generatedAt DateTime     @default(now())

  lines IndentLine[]

  // Makes the 06:00 sweep idempotent: a re-run cannot create a second
  // indent for the same ward and day.
  @@unique([wardId, indentDate])
}

model IndentLine {
  id             String           @id @default(cuid())
  indentId       String
  indent         DailyIndent      @relation(fields: [indentId], references: [id], onDelete: Cascade)
  patientId      String
  patient        Patient          @relation(fields: [patientId], references: [id])
  prescriptionId String
  prescription   Prescription     @relation(fields: [prescriptionId], references: [id])
  drugId         String
  drug           Drug             @relation(fields: [drugId], references: [id])
  qty            Int
  treatmentDay   Int
  status         IndentLineStatus @default(pending)
  dispensedById  String?
  dispensedBy    User?            @relation(fields: [dispensedById], references: [id])
  dispensedAt    DateTime?

  billingLine BillingLine?

  // Line-level idempotency for the sweep.
  @@unique([indentId, prescriptionId])
  @@index([patientId, status])
}

model BillingLine {
  id           String        @id @default(cuid())
  indentLineId String        @unique
  indentLine   IndentLine    @relation(fields: [indentLineId], references: [id])
  patientId    String
  patient      Patient       @relation(fields: [patientId], references: [id])
  wardId       String
  ward         Ward          @relation(fields: [wardId], references: [id])
  drugId       String
  drug         Drug          @relation(fields: [drugId], references: [id])
  qty          Int
  // Snapshotted at dispense time so a later catalog price change cannot
  // rewrite billed history.
  unitPrice    Decimal       @db.Decimal(10, 2)
  total        Decimal       @db.Decimal(10, 2)
  status       BillingStatus @default(pending)
  billedById   String?
  billedBy     User?         @relation(fields: [billedById], references: [id])
  billedAt     DateTime?
  createdAt    DateTime      @default(now())

  @@index([patientId, status])
  @@index([wardId, createdAt])
}

model ActivityEvent {
  id         String       @id @default(cuid())
  type       ActivityType
  patientId  String?
  patient    Patient?     @relation(fields: [patientId], references: [id])
  wardId     String?
  ward       Ward?        @relation(fields: [wardId], references: [id])
  drugId     String?
  drug       Drug?        @relation(fields: [drugId], references: [id])
  text       String
  actorId    String?
  actor      User?        @relation(fields: [actorId], references: [id])
  occurredAt DateTime     @default(now())

  @@index([occurredAt])
  @@index([type, occurredAt])
}
```

- [ ] **Step 7: Generate the client and run the first migration**

Run: `pnpm --filter @pharmassist/backend exec prisma migrate dev --name init`
Expected: Prisma creates `backend/prisma/migrations/<timestamp>_init/migration.sql`, applies it, and generates the client. Output ends with `Your database is now in sync with your schema.`

- [ ] **Step 8: Apply the same migration to the test database**

Run: `cd backend && TEST_URL=$(grep TEST_DATABASE_URL .env | cut -d'"' -f2) && DATABASE_URL="$TEST_URL" pnpm exec prisma migrate deploy && cd ..`
Expected: `All migrations have been successfully applied.`

- [ ] **Step 9: Write the failing test for env loading**

`backend/src/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  TEST_DATABASE_URL: 'postgresql://u:p@localhost:5433/db_test',
  JWT_SECRET: 'x'.repeat(32),
  PORT: '3000',
  NODE_ENV: 'development',
}

describe('loadEnv', () => {
  it('parses a valid environment and coerces PORT to a number', () => {
    const env = loadEnv(valid)
    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('development')
  })

  it('defaults PORT when it is absent', () => {
    const { PORT: _omitted, ...rest } = valid
    expect(loadEnv(rest).PORT).toBe(3000)
  })

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => loadEnv({ ...valid, JWT_SECRET: 'too-short' }))
      .toThrow(/JWT_SECRET/)
  })

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = valid
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/)
  })
})
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test`
Expected: FAIL — `Failed to resolve import "./env"`.

- [ ] **Step 11: Write the env module**

`backend/src/env.ts`:

```ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().min(1, 'TEST_DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validates the environment at startup so a misconfigured deploy fails
 * immediately rather than at the first request that needs the value.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment — ${detail}`)
  }

  return result.data
}
```

- [ ] **Step 12: Add the Vitest config**

`backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Service tests share one Postgres database and truncate between
    // tests, so they must not run concurrently.
    fileParallelism: false,
  },
})
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 4 tests.

- [ ] **Step 14: Commit**

```bash
git add docker-compose.yml docker backend/package.json backend/tsconfig.json \
  backend/vitest.config.ts backend/.env.example backend/prisma backend/src pnpm-lock.yaml
git commit -m "feat(backend): add Postgres, Prisma schema, env validation

Eleven models. Unique (wardId, indentDate) and (indentId, prescriptionId)
are what make the 06:00 sweep idempotent. Money is Decimal(10,2)
throughout. Host port 5433 avoids colliding with a local Postgres."
```

---

## Task 4: Seed data

**Files:**
- Create: `backend/prisma/seed-data.ts`
- Create: `backend/prisma/seed.ts`
- Create: `backend/src/test/db.ts`
- Test: `backend/prisma/seed.test.ts`

**Interfaces:**
- Consumes: the generated Prisma client from Task 3; `wardLabel` from Task 2.
- Produces: `seed(prisma: PrismaClient): Promise<void>` — idempotent, safe to re-run. Test helper `getTestPrisma(): PrismaClient` and `resetDatabase(prisma: PrismaClient): Promise<void>`.

**Two data gaps this task closes.** `frontend/src/data.ts` prescribes Digoxin 0.25mg, Ibuprofen 400mg, and Metoclopramide 10mg but gives none of them an inventory row — dispensing those would fail on a missing stock record. And eight of the fifteen drugs have no price, because only seven ever appear in `TRANSACTIONS`. Both are fixed explicitly in the seed rather than defaulted at runtime.

- [ ] **Step 1: Write the seed data module**

`backend/prisma/seed-data.ts`:

```ts
/**
 * Seed values lifted from the pre-backend frontend/src/data.ts.
 *
 * Prices for the seven drugs that appeared in the old TRANSACTIONS array
 * are carried over verbatim. The other eight had no price anywhere, so
 * they are assigned here — explicitly, once, rather than defaulted at
 * runtime where a wrong number would silently reach a patient's bill.
 */

export const WARDS = [
  { code: 'Ward 4A', name: 'General Medicine' },
  { code: 'Ward 5B', name: 'Cardiology' },
  { code: 'Ward 6C', name: 'Orthopaedics' },
  { code: 'Ward 2D', name: 'Oncology' },
] as const

export const DRUGS = [
  { label: 'Amoxicillin 500mg',    name: 'Amoxicillin',    strength: '500mg',  form: 'Capsule', category: 'Antibiotics',       unitPrice: '0.85' },
  { label: 'Furosemide 40mg',      name: 'Furosemide',     strength: '40mg',   form: 'Tablet',  category: 'Diuretics',         unitPrice: '0.30' },
  { label: 'Metformin 500mg',      name: 'Metformin',      strength: '500mg',  form: 'Tablet',  category: 'Antidiabetics',     unitPrice: '0.42' },
  { label: 'Lisinopril 10mg',      name: 'Lisinopril',     strength: '10mg',   form: 'Tablet',  category: 'Antihypertensives', unitPrice: '0.38' },
  { label: 'Tramadol 50mg',        name: 'Tramadol',       strength: '50mg',   form: 'Capsule', category: 'Analgesics',        unitPrice: '0.65' },
  { label: 'Atorvastatin 40mg',    name: 'Atorvastatin',   strength: '40mg',   form: 'Tablet',  category: 'Lipid-lowering',    unitPrice: '1.20' },
  { label: 'Aspirin 75mg',         name: 'Aspirin',        strength: '75mg',   form: 'Tablet',  category: 'Antiplatelets',     unitPrice: '0.12' },
  { label: 'Clopidogrel 75mg',     name: 'Clopidogrel',    strength: '75mg',   form: 'Tablet',  category: 'Antiplatelets',     unitPrice: '1.45' },
  { label: 'Bisoprolol 5mg',       name: 'Bisoprolol',     strength: '5mg',    form: 'Tablet',  category: 'Beta-blockers',     unitPrice: '0.55' },
  { label: 'Ondansetron 8mg',      name: 'Ondansetron',    strength: '8mg',    form: 'Tablet',  category: 'Antiemetics',       unitPrice: '2.10' },
  { label: 'Dexamethasone 4mg',    name: 'Dexamethasone',  strength: '4mg',    form: 'Tablet',  category: 'Corticosteroids',   unitPrice: '0.48' },
  { label: 'Spironolactone 25mg',  name: 'Spironolactone', strength: '25mg',   form: 'Tablet',  category: 'Diuretics',         unitPrice: '0.60' },
  { label: 'Digoxin 0.25mg',       name: 'Digoxin',        strength: '0.25mg', form: 'Tablet',  category: 'Cardiac glycosides', unitPrice: '0.35' },
  { label: 'Ibuprofen 400mg',      name: 'Ibuprofen',      strength: '400mg',  form: 'Tablet',  category: 'Analgesics',        unitPrice: '0.20' },
  { label: 'Metoclopramide 10mg',  name: 'Metoclopramide', strength: '10mg',   form: 'Tablet',  category: 'Antiemetics',       unitPrice: '0.28' },
] as const

/**
 * The first twelve rows carry the stock levels from the old INVENTORY
 * array. The last three are new: those drugs were prescribed but had no
 * inventory row at all, which would make dispensing them impossible.
 */
export const INVENTORY = [
  { drug: 'Amoxicillin 500mg',   currentStock: 340, reorderLevel: 100 },
  { drug: 'Furosemide 40mg',     currentStock: 52,  reorderLevel: 100 },
  { drug: 'Metformin 500mg',     currentStock: 210, reorderLevel: 100 },
  { drug: 'Lisinopril 10mg',     currentStock: 18,  reorderLevel: 50 },
  { drug: 'Tramadol 50mg',       currentStock: 95,  reorderLevel: 100 },
  { drug: 'Atorvastatin 40mg',   currentStock: 288, reorderLevel: 80 },
  { drug: 'Aspirin 75mg',        currentStock: 412, reorderLevel: 100 },
  { drug: 'Clopidogrel 75mg',    currentStock: 7,   reorderLevel: 50 },
  { drug: 'Bisoprolol 5mg',      currentStock: 156, reorderLevel: 80 },
  { drug: 'Ondansetron 8mg',     currentStock: 64,  reorderLevel: 80 },
  { drug: 'Dexamethasone 4mg',   currentStock: 89,  reorderLevel: 60 },
  { drug: 'Spironolactone 25mg', currentStock: 3,   reorderLevel: 50 },
  { drug: 'Digoxin 0.25mg',      currentStock: 120, reorderLevel: 40 },
  { drug: 'Ibuprofen 400mg',     currentStock: 260, reorderLevel: 80 },
  { drug: 'Metoclopramide 10mg', currentStock: 140, reorderLevel: 60 },
] as const

/**
 * Every seeded account uses this password. Development only — the seed
 * refuses to run against NODE_ENV=production.
 */
export const SEED_PASSWORD = 'pharmassist'

export const USERS = [
  { username: 'k.asante',      displayName: 'K. Asante',        role: 'pharmacist', wardCode: null },
  { username: 'a.owusu',       displayName: 'A. Owusu',         role: 'nurse',      wardCode: 'Ward 4A' },
  { username: 'y.darko',       displayName: 'Y. Darko',         role: 'nurse',      wardCode: 'Ward 5B' },
  { username: 'b.kwame',       displayName: 'Dr. B. Kwame',     role: 'doctor',     wardCode: null },
  { username: 'e.asare',       displayName: 'Dr. E. Asare',     role: 'doctor',     wardCode: null },
  { username: 's.acheampong',  displayName: 'Dr. S. Acheampong', role: 'doctor',    wardCode: null },
  { username: 'a.boateng',     displayName: 'Dr. A. Boateng',   role: 'doctor',     wardCode: null },
] as const

export const PATIENTS = [
  {
    mrn: 'MRN-004821', name: 'Margaret Osei', dateOfBirth: '1968-03-14', gender: 'Female',
    phone: '+233 24 456 7890', wardCode: 'Ward 4A', bed: 'Bed 04', admissionDate: '2026-07-29',
    diagnosis: 'Type 2 Diabetes Mellitus, Hypertension', allergies: 'Penicillin',
    prescriptions: [
      { drug: 'Amoxicillin 500mg', dose: '500mg', route: 'Oral', frequency: 'TDS', foodTiming: 'after-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-07-29', durationDays: 7, status: 'active', notes: 'Complete full course even if symptoms improve.', prescribedBy: 'b.kwame', prescribedAt: '2026-07-29T08:15:00Z' },
      { drug: 'Metformin 500mg', dose: '500mg', route: 'Oral', frequency: 'BD', foodTiming: 'with-food', timeOfDay: ['morning', 'night'], startDate: '2026-07-29', durationDays: 14, status: 'active', notes: 'Monitor blood glucose. Hold if eGFR falls below 30.', prescribedBy: 'b.kwame', prescribedAt: '2026-07-29T08:15:00Z' },
      { drug: 'Lisinopril 10mg', dose: '10mg', route: 'Oral', frequency: 'OD', foodTiming: 'not-applicable', timeOfDay: ['morning'], startDate: '2026-07-29', durationDays: 14, status: 'active', notes: 'Check BP before each dose. Hold if systolic < 90 mmHg.', prescribedBy: 'b.kwame', prescribedAt: '2026-07-29T08:15:00Z' },
    ],
  },
  {
    mrn: 'MRN-003145', name: 'James Kofi Antwi', dateOfBirth: '1952-11-07', gender: 'Male',
    phone: '+233 20 345 6789', wardCode: 'Ward 4A', bed: 'Bed 07', admissionDate: '2026-08-01',
    diagnosis: 'Congestive Heart Failure (NYHA Class III)', allergies: 'None known',
    prescriptions: [
      { drug: 'Furosemide 40mg', dose: '40mg', route: 'Oral', frequency: 'OD', foodTiming: 'not-applicable', timeOfDay: ['morning'], startDate: '2026-08-01', durationDays: 5, status: 'active', notes: 'Administer early morning. Monitor fluid balance and electrolytes daily.', prescribedBy: 'b.kwame', prescribedAt: '2026-08-01T07:30:00Z' },
      { drug: 'Spironolactone 25mg', dose: '25mg', route: 'Oral', frequency: 'OD', foodTiming: 'with-food', timeOfDay: ['morning'], startDate: '2026-08-01', durationDays: 5, status: 'active', notes: 'Monitor potassium levels closely.', prescribedBy: 'b.kwame', prescribedAt: '2026-08-01T07:30:00Z' },
      { drug: 'Digoxin 0.25mg', dose: '0.25mg', route: 'Oral', frequency: 'OD', foodTiming: 'before-food', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 3, status: 'stopped', stopReason: 'Toxicity suspected — digoxin level 3.1 ng/mL', prescribedBy: 'b.kwame', prescribedAt: '2026-07-31T09:00:00Z' },
    ],
  },
  {
    mrn: 'MRN-007302', name: 'Abena Frimpong', dateOfBirth: '1975-06-22', gender: 'Female',
    phone: '+233 27 891 2345', wardCode: 'Ward 5B', bed: 'Bed 12', admissionDate: '2026-07-31',
    diagnosis: 'Acute Myocardial Infarction (NSTEMI)', allergies: 'Sulfonamides',
    prescriptions: [
      { drug: 'Atorvastatin 40mg', dose: '40mg', route: 'Oral', frequency: 'ON', foodTiming: 'not-applicable', timeOfDay: ['night'], startDate: '2026-07-31', durationDays: 14, status: 'active', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
      { drug: 'Aspirin 75mg', dose: '75mg', route: 'Oral', frequency: 'OD', foodTiming: 'after-food', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 14, status: 'active', notes: 'Do not crush. Take with a full glass of water.', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
      { drug: 'Clopidogrel 75mg', dose: '75mg', route: 'Oral', frequency: 'OD', foodTiming: 'after-food', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 14, status: 'active', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
      { drug: 'Bisoprolol 5mg', dose: '5mg', route: 'Oral', frequency: 'OD', foodTiming: 'not-applicable', timeOfDay: ['morning'], startDate: '2026-07-31', durationDays: 14, status: 'active', notes: 'Check resting HR before dose. Hold if HR < 50 bpm.', prescribedBy: 'e.asare', prescribedAt: '2026-07-31T10:00:00Z' },
    ],
  },
  {
    mrn: 'MRN-009881', name: 'Kwame Asante', dateOfBirth: '1989-09-03', gender: 'Male',
    phone: '+233 55 234 5678', wardCode: 'Ward 6C', bed: 'Bed 03', admissionDate: '2026-08-02',
    diagnosis: 'Right femur fracture, post-ORIF', allergies: 'None known',
    prescriptions: [
      { drug: 'Tramadol 50mg', dose: '50mg', route: 'Oral', frequency: 'QDS', foodTiming: 'after-food', timeOfDay: ['morning', 'afternoon', 'evening', 'night'], startDate: '2026-08-02', durationDays: 5, status: 'active', notes: 'Max 400mg/day. Avoid alcohol. May cause drowsiness.', prescribedBy: 's.acheampong', prescribedAt: '2026-08-02T14:00:00Z' },
      { drug: 'Ibuprofen 400mg', dose: '400mg', route: 'Oral', frequency: 'TDS', foodTiming: 'after-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-08-02', durationDays: 5, status: 'active', notes: 'Take with food or milk to reduce GI upset.', prescribedBy: 's.acheampong', prescribedAt: '2026-08-02T14:00:00Z' },
    ],
  },
  {
    mrn: 'MRN-002017', name: 'Esi Mensah', dateOfBirth: '1961-01-28', gender: 'Female',
    phone: '+233 24 678 9012', wardCode: 'Ward 2D', bed: 'Bed 09', admissionDate: '2026-07-20',
    diagnosis: 'Breast carcinoma, cycle 3 chemotherapy', allergies: 'Codeine',
    prescriptions: [
      { drug: 'Ondansetron 8mg', dose: '8mg', route: 'Oral', frequency: 'TDS', foodTiming: 'before-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-07-20', durationDays: 21, status: 'active', notes: 'Give 30 min before meals to prevent chemotherapy-induced nausea.', prescribedBy: 'a.boateng', prescribedAt: '2026-07-20T09:00:00Z' },
      { drug: 'Metoclopramide 10mg', dose: '10mg', route: 'Oral', frequency: 'TDS', foodTiming: 'before-food', timeOfDay: ['morning', 'afternoon', 'night'], startDate: '2026-07-20', durationDays: 21, status: 'active', prescribedBy: 'a.boateng', prescribedAt: '2026-07-20T09:00:00Z' },
      { drug: 'Dexamethasone 4mg', dose: '4mg', route: 'Oral', frequency: 'OD', foodTiming: 'after-food', timeOfDay: ['morning'], startDate: '2026-07-20', durationDays: 21, status: 'active', notes: 'Taper dose in final 3 days. Do not stop abruptly.', prescribedBy: 'a.boateng', prescribedAt: '2026-07-20T09:00:00Z' },
    ],
  },
] as const
```

Every field above is copied verbatim from the original `frontend/src/data.ts` records, with three deliberate changes: `ward` becomes `wardCode`, `prescribedBy` becomes a username rather than a display name (so it can be a real FK), and `currentDay` is dropped because it is now derived. Do not "tidy" the clinical values — `foodTiming` in particular varies per drug and is not guessable.

- [ ] **Step 2: Write the failing test**

`backend/prisma/seed.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { getTestPrisma, resetDatabase } from '../src/test/db'
import { seed } from './seed'

const prisma = getTestPrisma()

beforeEach(async () => {
  await resetDatabase(prisma)
})

describe('seed', () => {
  it('creates the full reference dataset', async () => {
    await seed(prisma)

    expect(await prisma.ward.count()).toBe(4)
    expect(await prisma.drug.count()).toBe(15)
    expect(await prisma.inventoryItem.count()).toBe(15)
    expect(await prisma.user.count()).toBe(7)
    expect(await prisma.patient.count()).toBe(5)
    expect(await prisma.prescription.count()).toBe(15)
  })

  it('gives every prescribed drug an inventory row', async () => {
    await seed(prisma)

    const prescriptions = await prisma.prescription.findMany({ select: { drugId: true } })
    const stocked = await prisma.inventoryItem.findMany({ select: { drugId: true } })
    const stockedIds = new Set(stocked.map((item) => item.drugId))

    for (const { drugId } of prescriptions) {
      expect(stockedIds.has(drugId)).toBe(true)
    }
  })

  it('is idempotent — a second run changes no counts', async () => {
    await seed(prisma)
    await seed(prisma)

    expect(await prisma.drug.count()).toBe(15)
    expect(await prisma.patient.count()).toBe(5)
    expect(await prisma.prescription.count()).toBe(15)
  })

  it('stores prices as exact decimals', async () => {
    await seed(prisma)

    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: 'Aspirin 75mg' } })
    expect(drug.unitPrice.toString()).toBe('0.12')
  })

  it('hashes seeded passwords rather than storing them in clear text', async () => {
    await seed(prisma)

    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'k.asante' } })
    expect(user.passwordHash).not.toContain('pharmassist')
    expect(user.passwordHash.startsWith('$argon2')).toBe(true)
  })

  it('scopes nurses to a ward and leaves other roles unscoped', async () => {
    await seed(prisma)

    const nurse = await prisma.user.findUniqueOrThrow({
      where: { username: 'a.owusu' },
      include: { ward: true },
    })
    const pharmacist = await prisma.user.findUniqueOrThrow({ where: { username: 'k.asante' } })

    expect(nurse.ward?.code).toBe('Ward 4A')
    expect(pharmacist.wardId).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test`
Expected: FAIL — cannot resolve `../src/test/db` or `./seed`.

- [ ] **Step 4: Write the test database helper**

`backend/src/test/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { loadEnv } from '../env'

let client: PrismaClient | undefined

/**
 * A Prisma client pinned to TEST_DATABASE_URL. Tests share one client and
 * one database, so vitest.config.ts disables file parallelism.
 */
export function getTestPrisma(): PrismaClient {
  if (!client) {
    const env = loadEnv()
    client = new PrismaClient({ datasources: { db: { url: env.TEST_DATABASE_URL } } })
  }
  return client
}

/**
 * Truncates every domain table. RESTART IDENTITY keeps sequences clean;
 * CASCADE handles the foreign keys so the order of this list does not
 * matter.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ActivityEvent", "BillingLine", "IndentLine", "DailyIndent",
      "StockMovement", "Prescription", "InventoryItem", "Drug",
      "Patient", "User", "Ward"
    RESTART IDENTITY CASCADE
  `)
}
```

- [ ] **Step 5: Write the seed**

`backend/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { hash } from '@node-rs/argon2'
import { DRUGS, INVENTORY, PATIENTS, SEED_PASSWORD, USERS, WARDS } from './seed-data'

/**
 * Idempotent: every write is an upsert keyed on a natural unique column,
 * so re-running against a populated database is a no-op rather than a
 * duplicate-key crash.
 */
export async function seed(prisma: PrismaClient): Promise<void> {
  for (const ward of WARDS) {
    await prisma.ward.upsert({
      where: { code: ward.code },
      update: { name: ward.name },
      create: { code: ward.code, name: ward.name },
    })
  }

  for (const drug of DRUGS) {
    await prisma.drug.upsert({
      where: { label: drug.label },
      update: { unitPrice: drug.unitPrice, category: drug.category },
      create: {
        label: drug.label,
        name: drug.name,
        strength: drug.strength,
        form: drug.form,
        category: drug.category,
        unitPrice: drug.unitPrice,
      },
    })
  }

  for (const item of INVENTORY) {
    const drug = await prisma.drug.findUniqueOrThrow({ where: { label: item.drug } })
    await prisma.inventoryItem.upsert({
      where: { drugId: drug.id },
      update: { reorderLevel: item.reorderLevel },
      create: {
        drugId: drug.id,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
      },
    })
  }

  const passwordHash = await hash(SEED_PASSWORD)

  for (const user of USERS) {
    const ward = user.wardCode
      ? await prisma.ward.findUniqueOrThrow({ where: { code: user.wardCode } })
      : null

    await prisma.user.upsert({
      where: { username: user.username },
      update: { displayName: user.displayName, role: user.role, wardId: ward?.id ?? null },
      create: {
        username: user.username,
        passwordHash,
        displayName: user.displayName,
        role: user.role,
        wardId: ward?.id ?? null,
      },
    })
  }

  for (const patient of PATIENTS) {
    const ward = await prisma.ward.findUniqueOrThrow({ where: { code: patient.wardCode } })

    const record = await prisma.patient.upsert({
      where: { mrn: patient.mrn },
      update: { wardId: ward.id, bed: patient.bed },
      create: {
        mrn: patient.mrn,
        name: patient.name,
        dateOfBirth: new Date(patient.dateOfBirth),
        gender: patient.gender,
        phone: patient.phone,
        wardId: ward.id,
        bed: patient.bed,
        admissionDate: new Date(patient.admissionDate),
        diagnosis: patient.diagnosis,
        allergies: patient.allergies,
      },
    })

    for (const rx of patient.prescriptions) {
      const drug = await prisma.drug.findUniqueOrThrow({ where: { label: rx.drug } })
      const prescriber = await prisma.user.findUniqueOrThrow({
        where: { username: rx.prescribedBy },
      })

      // Prescriptions have no natural unique key, so identity here is
      // (patient, drug, startDate). Re-seeding must not duplicate them.
      const existing = await prisma.prescription.findFirst({
        where: {
          patientId: record.id,
          drugId: drug.id,
          startDate: new Date(rx.startDate),
        },
      })

      if (existing) continue

      await prisma.prescription.create({
        data: {
          patientId: record.id,
          drugId: drug.id,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          foodTiming: rx.foodTiming,
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
    }
  }
}

// Entrypoint for `pnpm --filter @pharmassist/backend seed`.
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database')
  }

  const prisma = new PrismaClient()
  await seed(prisma)
  await prisma.$disconnect()
  console.log('Seed complete')
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 10 tests (4 env + 6 seed).

If the seed tests fail with `relation "Ward" does not exist`, the test database never got the migration. Re-run Task 3 Step 8.

- [ ] **Step 7: Seed the development database**

Run: `pnpm --filter @pharmassist/backend seed`
Expected: `Seed complete`.

- [ ] **Step 8: Verify by hand**

Run: `docker exec pharmassist-db psql -U pharmassist -d pharmassist -c 'SELECT code, name FROM "Ward" ORDER BY code;'`
Expected: four rows — Ward 2D Oncology, Ward 4A General Medicine, Ward 5B Cardiology, Ward 6C Orthopaedics.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma backend/src/test
git commit -m "feat(backend): add idempotent seed with full reference data

Closes two gaps in the old mock data: Digoxin, Ibuprofen and
Metoclopramide were prescribed but had no inventory row, and eight of
fifteen drugs had no price. Both are now explicit rather than defaulted
at runtime."
```

---

## Task 5: Fastify app, error envelope, healthcheck

**Files:**
- Create: `backend/src/errors.ts`
- Create: `backend/src/plugins/prisma.ts`
- Create: `backend/src/plugins/errors.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/test/helpers.ts`
- Test: `backend/src/app.test.ts`

**Interfaces:**
- Consumes: `loadEnv` (Task 3), `ErrorCode` and `ApiErrorBody` (Task 2), `getTestPrisma`/`resetDatabase` (Task 4).
- Produces: `class AppError extends Error` with `constructor(code: ErrorCode, message: string, statusCode: number)` and the shorthands `AppError.notFound`, `AppError.invalidInput`, `AppError.forbidden`, `AppError.conflict`; `buildApp(options?: { prisma?: PrismaClient }): Promise<FastifyInstance>`; the Fastify decoration `app.prisma`; test helper `buildTestApp(): Promise<FastifyInstance>`.

- [ ] **Step 1: Write the failing test**

`backend/src/app.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from './test/helpers'
import { getTestPrisma, resetDatabase } from './test/db'
import { AppError } from './errors'

let app: FastifyInstance

beforeEach(async () => {
  await resetDatabase(getTestPrisma())
  app = await buildTestApp()
})

afterAll(async () => {
  await app?.close()
})

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', database: 'up' })
  })
})

describe('error envelope', () => {
  it('renders an unknown route as a NOT_FOUND envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/nope' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      success: false,
      error: 'NOT_FOUND',
      message: 'Route GET /api/nope not found',
    })
  })

  it('renders a thrown AppError with its code and status', async () => {
    const withBoom = await buildTestApp(async (instance) => {
      instance.get('/api/boom', async () => {
        throw AppError.invalidInput('daily_dosage_qty must be greater than 0')
      })
    })

    const response = await withBoom.inject({ method: 'GET', url: '/api/boom' })
    await withBoom.close()

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      success: false,
      error: 'INVALID_INPUT',
      message: 'daily_dosage_qty must be greater than 0',
    })
  })

  it('hides the detail of an unexpected error behind DATABASE_ERROR', async () => {
    const withExplode = await buildTestApp(async (instance) => {
      instance.get('/api/explode', async () => {
        throw new Error('connection string leaked postgres://user:hunter2@host')
      })
    })

    const response = await withExplode.inject({ method: 'GET', url: '/api/explode' })
    await withExplode.close()

    expect(response.statusCode).toBe(500)
    expect(response.json().error).toBe('DATABASE_ERROR')
    expect(response.json().message).not.toContain('hunter2')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/app.test.ts`
Expected: FAIL — cannot resolve `./test/helpers`.

- [ ] **Step 3: Write the error type**

`backend/src/errors.ts`:

```ts
import { ErrorCode } from '@pharmassist/shared'

/**
 * An error the API is willing to describe to the client. Anything not an
 * AppError is treated as unexpected and reported without detail, so an
 * internal message can never leak a connection string or a stack trace.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'AppError'
  }

  static invalidInput(message: string): AppError {
    return new AppError(ErrorCode.INVALID_INPUT, message, 400)
  }

  static authExpired(message = 'Session expired or missing'): AppError {
    return new AppError(ErrorCode.AUTH_EXPIRED, message, 401)
  }

  static forbidden(message = 'You do not have access to this resource'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403)
  }

  static notFound(message: string, code: ErrorCode = ErrorCode.NOT_FOUND): AppError {
    return new AppError(code, message, 404)
  }

  static conflict(code: ErrorCode, message: string): AppError {
    return new AppError(code, message, 409)
  }
}
```

- [ ] **Step 4: Write the Prisma plugin**

`backend/src/plugins/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

interface PrismaPluginOptions {
  /** Injected by tests so they can share one client against the test DB. */
  prisma?: PrismaClient
}

const prismaPlugin: FastifyPluginAsync<PrismaPluginOptions> = async (app, options) => {
  const client = options.prisma ?? new PrismaClient()
  await client.$connect()

  app.decorate('prisma', client)

  // Only the client this plugin created is ours to close. A test-supplied
  // client outlives the app instance.
  if (!options.prisma) {
    app.addHook('onClose', async () => {
      await client.$disconnect()
    })
  }
}

export default fp(prismaPlugin, { name: 'prisma' })
```

Add `fastify-plugin` to `backend/package.json` dependencies:

```json
    "fastify-plugin": "^5.0.0",
```

- [ ] **Step 5: Write the error plugin**

`backend/src/plugins/errors.ts`:

```ts
import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import { ErrorCode, type ApiErrorBody } from '@pharmassist/shared'
import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '../errors'

function envelope(error: ErrorCode, message: string): ApiErrorBody {
  return { success: false, error, message }
}

const errorsPlugin: FastifyPluginAsync = async (app) => {
  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(envelope(
        ErrorCode.NOT_FOUND,
        `Route ${request.method} ${request.url} not found`,
      ))
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send(envelope(error.code, error.message))
      return
    }

    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')
      reply.status(400).send(envelope(ErrorCode.INVALID_INPUT, detail))
      return
    }

    // Fastify's own validation and auth errors carry a usable statusCode.
    if (error.statusCode === 400 && error.validation) {
      reply.status(400).send(envelope(ErrorCode.INVALID_INPUT, error.message))
      return
    }

    // Anything else is unexpected. Log the real error; tell the client
    // nothing that could expose internals.
    request.log.error({ err: error }, 'Unhandled error')
    reply
      .status(500)
      .send(envelope(ErrorCode.DATABASE_ERROR, 'An internal error occurred'))
  })
}

export default fp(errorsPlugin, { name: 'errors' })
```

- [ ] **Step 6: Write the app factory**

`backend/src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { loadEnv } from './env'
import errorsPlugin from './plugins/errors'
import prismaPlugin from './plugins/prisma'

export interface BuildAppOptions {
  /** Supplied by tests to pin the app to the test database. */
  prisma?: PrismaClient
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = loadEnv()

  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
  })

  await app.register(errorsPlugin)
  await app.register(prismaPlugin, { prisma: options.prisma })

  app.get('/api/health', async () => {
    await app.prisma.$queryRaw`SELECT 1`
    return { status: 'ok', database: 'up' }
  })

  return app
}
```

- [ ] **Step 7: Write the server entrypoint**

`backend/src/server.ts`:

```ts
import { buildApp } from './app'
import { loadEnv } from './env'

const env = loadEnv()
const app = await buildApp()

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
```

- [ ] **Step 8: Write the test helper**

`backend/src/test/helpers.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { buildApp } from '../app'
import { getTestPrisma } from './db'

/**
 * An app instance pinned to the test database, with logging off.
 *
 * Extra routes must be passed in rather than added afterwards: Fastify
 * runs plugins at ready(), so decorations like `app.authenticate` do not
 * exist before then, and routes cannot be added after.
 */
export async function buildTestApp(
  extraRoutes?: FastifyPluginAsync,
): Promise<FastifyInstance> {
  const app = await buildApp({ prisma: getTestPrisma() })
  if (extraRoutes) await app.register(extraRoutes)
  await app.ready()
  return app
}
```

- [ ] **Step 9: Force NODE_ENV=test for the suite**

Update `backend/vitest.config.ts` to set the environment:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    // Service tests share one Postgres database and truncate between
    // tests, so they must not run concurrently.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
    },
  },
})
```

- [ ] **Step 10: Install and run the tests**

Run: `pnpm install && pnpm --filter @pharmassist/backend test`
Expected: PASS — 14 tests (4 env + 6 seed + 4 app).

- [ ] **Step 11: Verify the server starts**

Run: `pnpm --filter @pharmassist/backend dev`
Then in a second terminal: `curl -s localhost:3000/api/health`
Expected: `{"status":"ok","database":"up"}`. Stop the dev server afterwards.

- [ ] **Step 12: Commit**

```bash
git add backend/src backend/package.json backend/vitest.config.ts pnpm-lock.yaml
git commit -m "feat(backend): add Fastify app, error envelope, healthcheck

buildApp() takes an optional Prisma client so tests can pin it to the
test database. Unexpected errors return DATABASE_ERROR with no detail,
so an internal message cannot leak a connection string."
```

---

## Task 6: Password hashing and the auth service

**Files:**
- Create: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `backend/src/modules/auth/password.ts`
- Create: `backend/src/modules/auth/service.ts`
- Test: `backend/src/modules/auth/password.test.ts`
- Test: `backend/src/modules/auth/service.test.ts`

**Interfaces:**
- Consumes: `Role` (Task 2), `wardLabel` (Task 2), seed data (Task 4), `AppError` (Task 5).
- Produces:
  - Shared: `interface SessionUser { id, username, displayName, role, ward: { id, code, name, label } | null }`; `loginRequestSchema` (Zod); `type LoginRequest`; `interface LoginResponse { user: SessionUser }`.
  - Backend: `hashPassword(plain: string): Promise<string>`; `verifyPassword(hash: string, plain: string): Promise<boolean>`; `authenticate(prisma: PrismaClient, username: string, password: string): Promise<SessionUser>`; `getSessionUser(prisma: PrismaClient, userId: string): Promise<SessionUser>`; `toSessionUser(user): SessionUser`.

- [ ] **Step 1: Write the shared auth contract**

`packages/shared/src/auth.ts`:

```ts
import { z } from 'zod'
import type { Role } from './domain'

export interface SessionWard {
  id: string
  code: string
  name: string
  label: string
}

/** The authenticated identity. Role and ward come from the database record. */
export interface SessionUser {
  id: string
  username: string
  displayName: string
  role: Role
  ward: SessionWard | null
}

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

export interface LoginResponse {
  user: SessionUser
}
```

Add to `packages/shared/src/index.ts`:

```ts
export * from './auth'
export * from './domain'
export * from './errors'
export * from './frequency'
export * from './ward'
```

- [ ] **Step 2: Write the failing password test**

`backend/src/modules/auth/password.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('produces an argon2 hash that is not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple')

    expect(hash.startsWith('$argon2')).toBe(true)
    expect(hash).not.toContain('correct horse')
  })

  it('salts, so the same password hashes differently each time', async () => {
    const [first, second] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ])

    expect(first).not.toBe(second)
  })

  it('verifies a correct password', async () => {
    const hash = await hashPassword('pharmassist')
    expect(await verifyPassword(hash, 'pharmassist')).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('pharmassist')
    expect(await verifyPassword(hash, 'Pharmassist')).toBe(false)
  })

  it('returns false rather than throwing on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'pharmassist')).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/auth/password.test.ts`
Expected: FAIL — cannot resolve `./password`.

- [ ] **Step 4: Write the password module**

`backend/src/modules/auth/password.ts`:

```ts
import { hash, verify } from '@node-rs/argon2'

export function hashPassword(plain: string): Promise<string> {
  return hash(plain)
}

/**
 * Returns false for a malformed or unrecognised hash rather than
 * throwing, so a corrupted row reads as a failed login instead of a 500
 * that tells an attacker the account exists.
 */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain)
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm --filter @pharmassist/backend test src/modules/auth/password.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 6: Write the failing service test**

`backend/src/modules/auth/service.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { AppError } from '../../errors'
import { authenticate, getSessionUser } from './service'

const prisma = getTestPrisma()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('authenticate', () => {
  it('returns the session user for correct credentials', async () => {
    const user = await authenticate(prisma, 'k.asante', 'pharmassist')

    expect(user.username).toBe('k.asante')
    expect(user.displayName).toBe('K. Asante')
    expect(user.role).toBe('pharmacist')
    expect(user.ward).toBeNull()
  })

  it('takes role from the database, not from the request', async () => {
    const doctor = await authenticate(prisma, 'b.kwame', 'pharmassist')
    expect(doctor.role).toBe('doctor')
  })

  it('includes the composed ward label for ward-scoped users', async () => {
    const nurse = await authenticate(prisma, 'a.owusu', 'pharmassist')

    expect(nurse.ward).toMatchObject({
      code: 'Ward 4A',
      name: 'General Medicine',
      label: 'Ward 4A — General Medicine',
    })
  })

  it('rejects a wrong password', async () => {
    await expect(authenticate(prisma, 'k.asante', 'wrong'))
      .rejects.toBeInstanceOf(AppError)
  })

  it('rejects an unknown username with the same error as a wrong password', async () => {
    const unknown = await authenticate(prisma, 'nobody', 'pharmassist').catch((e) => e)
    const wrongPassword = await authenticate(prisma, 'k.asante', 'wrong').catch((e) => e)

    expect(unknown.message).toBe(wrongPassword.message)
    expect(unknown.statusCode).toBe(401)
  })

  it('never exposes the password hash on the session user', async () => {
    const user = await authenticate(prisma, 'k.asante', 'pharmassist')
    expect(JSON.stringify(user)).not.toContain('argon2')
  })
})

describe('getSessionUser', () => {
  it('rebuilds the session user from an id', async () => {
    const authenticated = await authenticate(prisma, 'a.owusu', 'pharmassist')
    const rehydrated = await getSessionUser(prisma, authenticated.id)

    expect(rehydrated).toEqual(authenticated)
  })

  it('rejects an id that no longer exists', async () => {
    await expect(getSessionUser(prisma, 'missing-id'))
      .rejects.toBeInstanceOf(AppError)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/auth/service.test.ts`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 8: Write the auth service**

`backend/src/modules/auth/service.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'
import { wardLabel, type SessionUser } from '@pharmassist/shared'
import { AppError } from '../../errors'
import { verifyPassword } from './password'

const withWard = { ward: true } satisfies Prisma.UserInclude

type UserWithWard = Prisma.UserGetPayload<{ include: typeof withWard }>

/** Strips the password hash and composes the ward display label. */
export function toSessionUser(user: UserWithWard): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    ward: user.ward
      ? {
          id: user.ward.id,
          code: user.ward.code,
          name: user.ward.name,
          label: wardLabel(user.ward),
        }
      : null,
  }
}

/**
 * An unknown username and a wrong password produce the identical error,
 * so the response cannot be used to enumerate valid accounts.
 */
export async function authenticate(
  prisma: PrismaClient,
  username: string,
  password: string,
): Promise<SessionUser> {
  const invalid = () => AppError.authExpired('Invalid username or password')

  const user = await prisma.user.findUnique({
    where: { username },
    include: withWard,
  })

  if (!user) {
    // Hash anyway so a missing account is not measurably faster than a
    // wrong password.
    await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', password)
    throw invalid()
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    throw invalid()
  }

  return toSessionUser(user)
}

export async function getSessionUser(
  prisma: PrismaClient,
  userId: string,
): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: withWard,
  })

  if (!user) {
    throw AppError.authExpired('Session refers to an account that no longer exists')
  }

  return toSessionUser(user)
}
```

- [ ] **Step 9: Run the full suite**

Run: `pnpm --filter @pharmassist/backend test && pnpm --filter @pharmassist/shared test`
Expected: PASS — 27 backend tests (4 env + 6 seed + 4 app + 5 password + 8 auth service) and 6 shared tests.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src backend/src/modules/auth
git commit -m "feat(auth): add argon2 password hashing and auth service

Unknown username and wrong password return an identical error, and the
unknown-user path still runs a verify, so responses cannot be used to
enumerate accounts. toSessionUser strips the hash at the boundary."
```

---

## Task 7: JWT cookie session, role guards, auth routes

**Files:**
- Create: `backend/src/plugins/auth.ts`
- Create: `backend/src/modules/auth/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/modules/auth/routes.test.ts`

**Interfaces:**
- Consumes: `authenticate` / `getSessionUser` (Task 6), `AppError` (Task 5), `loginRequestSchema` (Task 6).
- Produces: the cookie name constant `SESSION_COOKIE = 'pharmassist_session'`; Fastify decorations `app.authenticate` (preHandler) and `app.requireRole(...roles: Role[])` (preHandler factory); `request.user: SessionUser` on authenticated requests; routes `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.

- [ ] **Step 1: Write the failing test**

`backend/src/modules/auth/routes.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'
import { buildTestApp } from '../../test/helpers'

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

function login(username: string, password = 'pharmassist') {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  })
}

describe('POST /api/auth/login', () => {
  it('returns the session user and sets an httpOnly cookie', async () => {
    const response = await login('k.asante')

    expect(response.statusCode).toBe(200)
    expect(response.json().user).toMatchObject({
      username: 'k.asante',
      displayName: 'K. Asante',
      role: 'pharmacist',
    })

    const cookie = response.cookies.find((c) => c.name === 'pharmassist_session')
    expect(cookie).toBeDefined()
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite?.toLowerCase()).toBe('lax')
    expect(cookie?.path).toBe('/')
  })

  it('never puts the token anywhere but the cookie', async () => {
    const response = await login('k.asante')
    expect(response.body).not.toContain('eyJ')
  })

  it('rejects a wrong password with AUTH_EXPIRED', async () => {
    const response = await login('k.asante', 'wrong')

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('AUTH_EXPIRED')
  })

  it('rejects a malformed body with INVALID_INPUT', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('INVALID_INPUT')
  })

  it('ignores any role supplied in the request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'a.owusu', password: 'pharmassist', role: 'pharmacist' },
    })

    expect(response.json().user.role).toBe('nurse')
  })
})

describe('GET /api/auth/me', () => {
  it('returns the session user when a valid cookie is present', async () => {
    const cookie = (await login('a.owusu')).cookies[0]

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { [cookie.name]: cookie.value },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().user.ward.label).toBe('Ward 4A — General Medicine')
  })

  it('returns AUTH_EXPIRED without a cookie', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBe('AUTH_EXPIRED')
  })

  it('returns AUTH_EXPIRED for a forged cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { pharmassist_session: 'not.a.real.token' },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const cookie = (await login('k.asante')).cookies[0]

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { [cookie.name]: cookie.value },
    })

    expect(response.statusCode).toBe(200)
    const cleared = response.cookies.find((c) => c.name === 'pharmassist_session')
    expect(cleared?.value).toBe('')
  })
})

describe('requireRole', () => {
  // Routes are passed to the builder because Fastify runs plugins at
  // ready(): app.requireRole does not exist before then, and routes
  // cannot be added after.
  const guardedRoute: FastifyPluginAsync = async (instance) => {
    instance.get(
      '/api/only-pharmacists',
      { preHandler: [instance.authenticate, instance.requireRole('pharmacist')] },
      async () => ({ ok: true }),
    )
  }

  it('allows a role on the list', async () => {
    const guarded = await buildTestApp(guardedRoute)
    const cookie = (await guarded.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'k.asante', password: 'pharmassist' },
    })).cookies[0]

    const response = await guarded.inject({
      method: 'GET',
      url: '/api/only-pharmacists',
      cookies: { [cookie.name]: cookie.value },
    })
    await guarded.close()

    expect(response.statusCode).toBe(200)
  })

  it('rejects a role not on the list with FORBIDDEN', async () => {
    const guarded = await buildTestApp(guardedRoute)
    const cookie = (await guarded.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'a.owusu', password: 'pharmassist' },
    })).cookies[0]

    const response = await guarded.inject({
      method: 'GET',
      url: '/api/only-pharmacists',
      cookies: { [cookie.name]: cookie.value },
    })
    await guarded.close()

    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('FORBIDDEN')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @pharmassist/backend test src/modules/auth/routes.test.ts`
Expected: FAIL — `app.authenticate is not a function`, or a 404 on `/api/auth/login`.

- [ ] **Step 3: Write the auth plugin**

`backend/src/plugins/auth.ts`:

```ts
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import type { Role, SessionUser } from '@pharmassist/shared'
import { loadEnv } from '../env'
import { AppError } from '../errors'
import { getSessionUser } from '../modules/auth/service'

export const SESSION_COOKIE = 'pharmassist_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
    requireRole: (...roles: Role[]) => preHandlerHookHandler
    issueSession: (reply: FastifyReply, user: SessionUser) => Promise<void>
    clearSession: (reply: FastifyReply) => void
  }

  interface FastifyRequest {
    user: SessionUser
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    user: { sub: string }
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv()

  await app.register(cookie)
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    // The token lives in a cookie, never in a header or the response
    // body, so a script injected into the page cannot read it.
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: `${SESSION_MAX_AGE_SECONDS}s` },
  })

  app.decorate('issueSession', async (reply: FastifyReply, user: SessionUser) => {
    const token = await reply.jwtSign({ sub: user.id })

    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
  })

  app.decorate('clearSession', (reply: FastifyReply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
  })

  app.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify()
    } catch {
      throw AppError.authExpired()
    }

    // Re-read the user each request so a role or ward change takes effect
    // without waiting for the token to expire.
    request.user = await getSessionUser(request.server.prisma, request.user.sub)
  })

  app.decorate('requireRole', (...roles: Role[]): preHandlerHookHandler => {
    return async (request: FastifyRequest) => {
      if (!roles.includes(request.user.role)) {
        throw AppError.forbidden(
          `This action requires one of: ${roles.join(', ')}`,
        )
      }
    }
  })
}

export default fp(authPlugin, { name: 'auth', dependencies: ['prisma'] })
```

- [ ] **Step 4: Write the auth routes**

`backend/src/modules/auth/routes.ts`:

```ts
import { loginRequestSchema, type LoginResponse } from '@pharmassist/shared'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from './service'

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/login', async (request, reply): Promise<LoginResponse> => {
    // Parsed, not merged: any extra field in the body — a role, a ward —
    // is discarded rather than trusted.
    const credentials = loginRequestSchema.parse(request.body)

    const user = await authenticate(app.prisma, credentials.username, credentials.password)
    await app.issueSession(reply, user)

    return { user }
  })

  app.get(
    '/api/auth/me',
    { preHandler: [app.authenticate] },
    async (request): Promise<LoginResponse> => ({ user: request.user }),
  )

  app.post('/api/auth/logout', async (_request, reply) => {
    app.clearSession(reply)
    return { success: true }
  })
}

export default authRoutes
```

- [ ] **Step 5: Register the plugin and routes**

Modify `backend/src/app.ts` — add the two imports and the two registrations so the file reads:

```ts
import Fastify, { type FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { loadEnv } from './env'
import authPlugin from './plugins/auth'
import errorsPlugin from './plugins/errors'
import prismaPlugin from './plugins/prisma'
import authRoutes from './modules/auth/routes'

export interface BuildAppOptions {
  /** Supplied by tests to pin the app to the test database. */
  prisma?: PrismaClient
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = loadEnv()

  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
  })

  await app.register(errorsPlugin)
  await app.register(prismaPlugin, { prisma: options.prisma })
  await app.register(authPlugin)

  app.get('/api/health', async () => {
    await app.prisma.$queryRaw`SELECT 1`
    return { status: 'ok', database: 'up' }
  })

  await app.register(authRoutes)

  return app
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @pharmassist/backend test`
Expected: PASS — 38 tests (27 from before + 11 auth route tests).

- [ ] **Step 7: Verify by hand against the dev server**

Run the server: `pnpm --filter @pharmassist/backend dev`

In a second terminal:

```bash
curl -s -c /tmp/pharma-cookies -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"a.owusu","password":"pharmassist"}'
```

Expected: JSON containing `"role":"nurse"` and `"label":"Ward 4A — General Medicine"`.

```bash
curl -s -b /tmp/pharma-cookies localhost:3000/api/auth/me
```

Expected: the same user. Then confirm the cookie is httpOnly:

```bash
grep pharmassist_session /tmp/pharma-cookies
```

Expected: a line beginning `#HttpOnly_`. Stop the dev server afterwards.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(auth): add JWT cookie sessions, role guards, auth routes

Token lives only in an httpOnly SameSite=Lax cookie, never in the
response body, so injected script cannot read it. authenticate re-reads
the user each request so a role change takes effect without waiting for
expiry. Login parses the body rather than merging it, so a role supplied
by the client is discarded."
```

---

## Task 8: Frontend API client, Vite proxy, Query provider

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/queryClient.ts`
- Create: `frontend/src/api/auth.ts`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes: `ApiErrorBody`, `ErrorCode`, `SessionUser`, `LoginRequest`, `LoginResponse` from `@pharmassist/shared`.
- Produces: `class ApiError extends Error` with `code: ErrorCode` and `status: number`; `apiGet<T>(path: string): Promise<T>`; `apiPost<T>(path: string, body?: unknown): Promise<T>`; `queryClient`; hooks `useMe()`, `useLogin()`, `useLogout()`.

- [ ] **Step 1: Add the dependencies**

Modify `frontend/package.json` so `dependencies` and `devDependencies` read:

```json
  "dependencies": {
    "@pharmassist/shared": "workspace:*",
    "@tanstack/react-query": "^5.60.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "oxfmt": "^0.2.0",
    "typescript": "^5.7.0",
    "vite": "^8.0.0",
    "vitest": "^3.0.0"
  }
```

Add a `test` script to the same file's `scripts` block:

```json
    "test": "vitest run",
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`frontend/src/api/client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, apiPost } from './client'

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet', () => {
  it('returns the parsed body on success', async () => {
    mockFetch(200, { user: { username: 'k.asante' } })

    await expect(apiGet('/api/auth/me')).resolves.toEqual({
      user: { username: 'k.asante' },
    })
  })

  it('sends credentials so the session cookie travels with the request', async () => {
    const fetchMock = mockFetch(200, {})

    await apiGet('/api/auth/me')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('throws an ApiError carrying the envelope code and status', async () => {
    mockFetch(401, {
      success: false,
      error: 'AUTH_EXPIRED',
      message: 'Session expired or missing',
    })

    const error = await apiGet('/api/auth/me').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('AUTH_EXPIRED')
    expect(error.status).toBe(401)
    expect(error.message).toBe('Session expired or missing')
  })

  it('falls back to a generic message when the body is not an envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })),
    )

    const error = await apiGet('/api/auth/me').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
    expect(error.code).toBe('DATABASE_ERROR')
  })
})

describe('apiPost', () => {
  it('serialises the body as JSON', async () => {
    const fetchMock = mockFetch(200, { user: {} })

    await apiPost('/api/auth/login', { username: 'k.asante', password: 'x' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'k.asante', password: 'x' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('handles a 204 with no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(apiPost('/api/auth/logout')).resolves.toBeNull()
  })
})
```

- [ ] **Step 3: Add the Vitest config**

`frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter figma-make-app test`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 5: Write the API client**

`frontend/src/api/client.ts`:

```ts
import { ErrorCode, type ApiErrorBody } from '@pharmassist/shared'

/** A failed API call, carrying the server's error code so callers can branch. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    'message' in value
  )
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    // The session lives in an httpOnly cookie, so every request must
    // carry credentials or the server sees an anonymous caller.
    credentials: 'include',
    ...init,
  })

  if (response.status === 204) {
    return null as T
  }

  const raw = await response.text()
  let parsed: unknown = null

  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    if (isErrorBody(parsed)) {
      throw new ApiError(parsed.error, parsed.message, response.status)
    }
    // A proxy error or an HTML error page — not our envelope.
    throw new ApiError(
      ErrorCode.DATABASE_ERROR,
      `Request failed with status ${response.status}`,
      response.status,
    )
  }

  return parsed as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm --filter figma-make-app test`
Expected: PASS — 6 tests.

- [ ] **Step 7: Write the query client**

`frontend/src/api/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // An expired session or a permission failure will not resolve by
        // retrying; only transient faults will.
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})
```

- [ ] **Step 8: Write the auth hooks**

`frontend/src/api/auth.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, LoginResponse, SessionUser } from '@pharmassist/shared'
import { ApiError, apiGet, apiPost } from './client'

export const meQueryKey = ['auth', 'me'] as const

/**
 * Resolves to null rather than throwing when there is no session, so the
 * app can render the login screen instead of an error boundary.
 */
export function useMe() {
  return useQuery<SessionUser | null>({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        const response = await apiGet<LoginResponse>('/api/auth/me')
        return response.user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
  })
}

export function useLogin() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      apiPost<LoginResponse>('/api/auth/login', credentials),
    onSuccess: (response) => {
      client.setQueryData(meQueryKey, response.user)
    },
  })
}

export function useLogout() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () => apiPost<{ success: true }>('/api/auth/logout'),
    onSuccess: () => {
      client.setQueryData(meQueryKey, null)
      // Drop every cached query — the next user must not see the previous
      // user's patients.
      client.clear()
    },
  })
}
```

- [ ] **Step 9: Add the dev proxy**

Modify `frontend/vite.config.ts`. Inside the returned config object, add a `server` block immediately after the `build` block, leaving `base`, `plugins`, and `resolve` untouched:

```ts
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    server: {
      proxy: {
        // Same-origin in development, so the session cookie is a
        // first-party cookie and no CORS or CSRF token is needed.
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: false,
        },
      },
    },
```

- [ ] **Step 10: Mount the provider**

Replace the contents of `frontend/src/main.tsx` with:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { queryClient } from './api/queryClient'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 11: Verify the build and tests**

Run: `pnpm --filter figma-make-app exec tsc --noEmit && pnpm --filter figma-make-app test && pnpm --filter figma-make-app build`
Expected: All three succeed.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api frontend/src/main.tsx frontend/vite.config.ts \
  frontend/package.json frontend/vitest.config.ts pnpm-lock.yaml
git commit -m "feat(frontend): add API client, Vite proxy, Query provider

Every request sends credentials so the httpOnly session cookie travels
with it. The dev proxy keeps /api same-origin, making the cookie
first-party and removing any need for CORS or a CSRF token. Logout
clears the whole cache so the next user cannot see cached patients."
```

---

## Task 9: Wire LoginPage, App, and Layout to the real session

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `useMe`, `useLogin`, `useLogout` (Task 8), `ApiError` (Task 8), `parseWardCode` (Task 2).
- Produces: `LoginPage` with no props; `Layout` gains a required `onLogout: () => void` prop.

**What changes conceptually.** The role picker and ward dropdown disappear — a user cannot choose their own permissions. Role and ward now arrive from `GET /api/auth/me`. `App.tsx` stops owning `loggedIn`, `role`, `user`, and `ward`; the server owns them. It keeps `patients` on mock data for now — Phase 3 removes that.

- [ ] **Step 1: Rewrite LoginPage**

Replace the entire contents of `frontend/src/pages/LoginPage.tsx` with:

```tsx
import { useState } from 'react'
import { ApiError } from '../api/client'
import { useLogin } from '../api/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    login.mutate({ username, password })
  }

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Could not reach the server. Check your connection and try again.'
        : null

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F0F9FB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Wordmark */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32,
              background: '#0AADA8',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9h10M9 4v10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>
              Pharmassist
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0, marginLeft: 42 }}>
            Hospital Medication Dispensing System
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: '#fff',
          border: '1px solid #D9E8EF',
          borderRadius: 8,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="e.g. k.asante"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>
          </div>

          {errorMessage && (
            <div style={{
              padding: '10px 14px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 6,
              fontSize: 13,
              color: '#DC2626',
            }}>
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            style={{
              background: '#0AADA8',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '11px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: login.isPending ? 'default' : 'pointer',
              opacity: login.isPending ? 0.7 : 1,
              transition: 'opacity 0.12s',
            }}
          >
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>

          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, textAlign: 'center' }}>
            Your role and assigned ward come from your account.
          </p>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 20 }}>
          Korle Bu Teaching Hospital · Pharmacy Dept.
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#64748B',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #D9E8EF',
  borderRadius: 6,
  fontSize: 14,
  color: '#0F172A',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}
```

- [ ] **Step 2: Rewire App.tsx**

Replace the top of `frontend/src/App.tsx` — everything from the imports through `handleLogin` — so the file begins:

```tsx
import { useState } from 'react';
import type { Page, Patient, Prescription } from './types';
import { INITIAL_PATIENTS } from './data';
import { useLogout, useMe } from './api/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WardSweepPage from './pages/WardSweepPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import InventoryPage from './pages/InventoryPage';
import BillingPage from './pages/BillingPage';
import RegisterPatientPage from './pages/RegisterPatientPage';
import DoctorPatientsPage from './pages/DoctorPatientsPage';
import DoctorPage from './pages/DoctorPage';
import RecentActivityPage from './pages/RecentActivityPage';
import Layout from './components/Layout';

export default function App() {
  const { data: me, isLoading } = useMe();
  const logout = useLogout();

  const [page, setPage] = useState<Page | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Phase 3 replaces this with server data.
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);

  const navigate = (p: Page) => {
    setPage(p);
    if (p !== 'patient-detail') setSelectedPatientId(null);
  };

  const openPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setPage('patient-detail');
  };
```

Leave `registerPatient`, `addPrescription`, `editPrescription`, and `stopPrescription` exactly as they are.

Then replace everything from `if (!loggedIn) return <LoginPage onLogin={handleLogin} />;` to the end of the file with:

```tsx
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F0F9FB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#64748B',
      }}>
        Loading…
      </div>
    );
  }

  if (!me) return <LoginPage />;

  const role = me.role;
  const user = me.displayName;
  const ward = me.ward?.label ?? '';
  // Doctors land on their own patient list; everyone else on the dashboard.
  const activePage: Page = page ?? (role === 'doctor' ? 'doctor-patients' : 'dashboard');
  const selectedPatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : null;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage role={role} ward={ward} patients={patients} />;
      case 'ward-sweep':
        return <WardSweepPage patients={patients} />;
      case 'patients':
        return <PatientsPage patients={patients} onSelectPatient={openPatient} />;
      case 'patient-detail':
        return selectedPatient
          ? <PatientDetailPage patient={selectedPatient} onBack={() => navigate('patients')} onStopPrescription={stopPrescription} />
          : null;
      case 'inventory':
        return <InventoryPage />;
      case 'billing':
        return <BillingPage />;
      case 'register-patient':
        return <RegisterPatientPage onRegister={registerPatient} />;
      case 'doctor-patients':
        return (
          <DoctorPatientsPage
            patients={patients}
            doctorName={user}
            onAddPrescription={addPrescription}
            onEditPrescription={editPrescription}
          />
        );
      case 'doctor':
        return <DoctorPage />;
      case 'recent-activity':
        return <RecentActivityPage />;
      default:
        return <DashboardPage role={role} ward={ward} patients={patients} />;
    }
  };

  return (
    <Layout
      role={role}
      page={activePage}
      user={user}
      ward={ward}
      onNavigate={navigate}
      onLogout={() => logout.mutate()}
    >
      {renderPage()}
    </Layout>
  );
}
```

- [ ] **Step 3: Add logout to Layout and fix its ward splitting**

In `frontend/src/components/Layout.tsx`:

Change the import on line 1 and the props interface to:

```tsx
import { parseWardCode } from '@pharmassist/shared';
import type { Role, Page } from '../types';

interface LayoutProps {
  role: Role;
  page: Page;
  user: string;
  ward: string;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  children: React.ReactNode;
}
```

Change the component signature to accept the new prop:

```tsx
export default function Layout({ role, page, user, ward, onNavigate, onLogout, children }: LayoutProps) {
```

Replace both occurrences of `{ward.split(' — ')[0]}` with `{parseWardCode(ward)}` — one in the sidebar user footer, one in the header breadcrumb.

Make the existing user chip a working sign-out control. Replace the chip's opening `<div style={{` … `background: '#F8FBFC',\n            }}>` wrapper with a `button`:

```tsx
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '4px 10px', border: '1px solid #D9E8EF',
                borderRadius: 20, cursor: 'pointer', background: '#F8FBFC',
                fontFamily: 'inherit',
              }}
            >
```

and change its closing `</div>` (the one immediately after the chevron `</svg>`) to `</button>`.

- [ ] **Step 4: Typecheck and build**

Run: `pnpm --filter figma-make-app exec tsc --noEmit && pnpm --filter figma-make-app build`
Expected: Both succeed. If `tsc` reports that `DashboardPage` expects `Role` but got something wider, confirm `me.role` is typed `Role` from `@pharmassist/shared` — do not cast.

- [ ] **Step 5: Verify the full loop by hand**

Terminal 1: `pnpm --filter @pharmassist/backend dev`
Terminal 2: `pnpm --filter figma-make-app dev`

In a browser at the Vite URL:
1. Sign in as `a.owusu` / `pharmassist`. Expected: the nurse navigation (Dashboard, Ward Pickup, Patients, Register Patient), the sidebar showing `Ward 4A`, and the role chip reading `Nurse`.
2. Reload the page. Expected: still signed in — the session survives, because it is a cookie and not React state.
3. Click the user chip. Expected: returned to the login screen.
4. Sign in as `k.asante` / `pharmassist`. Expected: the pharmacist navigation, and no ward line in the sidebar.
5. Try `k.asante` with a wrong password. Expected: the inline red message `Invalid username or password`.

- [ ] **Step 6: Confirm the token is not reachable from JavaScript**

In the browser devtools console, run:

```js
document.cookie
```

Expected: the output does **not** contain `pharmassist_session`. If it does, the `httpOnly` flag is not being set and Task 7 Step 3 needs revisiting before going further.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): wire login, session, and logout to the API

Removes the role picker and ward dropdown — a user can no longer choose
their own permissions; both now come from GET /api/auth/me. App.tsx
stops owning loggedIn/role/user/ward. Layout's decorative user chip
becomes a real sign-out control, and parseWardCode replaces its
.split(' — ') calls."
```

---

## Done criteria for Phases 0–2

- `pnpm -r test` passes: 6 shared, 38 backend, 6 frontend.
- `docker compose up -d` plus `pnpm --filter @pharmassist/backend seed` produces a populated database from scratch.
- A user can sign in, reload without losing the session, and sign out.
- Role and ward are server-controlled; no client input can change them.
- `document.cookie` cannot see the session token.

## What Phases 3–6 still need

Tracked in the spec, not in this plan. Plan 2 covers the read path (wards, patients, inventory, activity endpoints and the six pages that consume them), which is also where `frontend/src/data.ts` and its `@ts-nocheck` are finally deleted. Plan 3 covers the indent loop — sweep job, pickup list, dispense, billing — the only phase touching money, stock, and atomicity together. Plan 4 covers the write path and the documentation rewrite.
