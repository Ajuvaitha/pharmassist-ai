# SNS Chatbot Agentic Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the SNS Workbench chatbot perform two write actions — `restock` inventory and `create_patient` — directly against the public Neon Postgres, guarded by a two-turn confirm.

**Architecture:** SNS runs in the cloud and cannot reach the localhost API, so each action is a **Postgres function** (`sql_restock`, `sql_create_patient`) with a `preview` flag: `preview=true` validates + resolves names→ids without writing; `preview=false` commits atomically (id generation, timestamps, multi-writes, activity log). Cross-message confirm state lives in a `ChatbotPendingAction` table keyed by `sessionId`. The SNS `.sns.json` workflow calls these functions via `postgres.executeQuery`.

**Tech Stack:** PostgreSQL (Neon), Prisma (migrations + raw queries), Vitest (integration tests against a real test DB), SNS Agent Workbench (`agentbuilder` export).

## Global Constraints

- **All writes via Postgres, never the API** — SNS cloud cannot reach localhost.
- **`id` has no DB default** (`@default(cuid())` is app-side) — every `INSERT` must supply `id = gen_random_uuid()::text`.
- **`@updatedAt` is app-side** — raw `UPDATE` must set `"updatedAt" = now()`.
- **Identifiers are PascalCase, columns camelCase, both quoted** (`"InventoryItem"`, `"currentStock"`).
- **Enums:** `Role{pharmacist,nurse,doctor}`, `Gender{Male,Female,Other}`, `StockReason` includes `restock`, `ActivityType` includes `restock`/`register`.
- **Bot actor:** seeded `User{username:'chatbot', role:'pharmacist', wardId:null}`; functions set `actorId` to it; activity text tagged `(via assistant)`.
- **Tests:** real Postgres via `getTestPrisma()`; `resetDatabase` TRUNCATEs then `seed` runs in `beforeEach`; `fileParallelism:false`. Call functions with `prisma.$queryRawUnsafe('SELECT fn(...) AS r', ...)` → `rows[0].r` is the parsed jsonb object.
- **Commit after every task.** Conventional commits, author Kavin-Charles only, no AI attribution. Branch: `feat/sns-chatbot-agentic` (already created).

---

## File Structure

- `backend/prisma/schema.prisma` (modify) — add `ChatbotPendingAction` model.
- `backend/prisma/migrations/<ts>_chatbot_pending_action/migration.sql` (generated) — table.
- `backend/prisma/migrations/<ts>_chatbot_action_functions/migration.sql` (create-only, hand-written) — `sql_restock`, `sql_create_patient`.
- `backend/prisma/seed.ts` (modify) — create the `chatbot` user.
- `backend/src/test/db.ts` (modify) — add `"ChatbotPendingAction"` to the TRUNCATE list.
- `backend/src/modules/chatbot/functions.test.ts` (create) — integration tests for both functions.
- `docs/chatbot/pharmassist-chatbot-agentic.sns.json` (create) — the SNS workflow (platform artifact, verified by import + POST).

---

## Task 1: Pending-action table, chatbot user, test-reset wiring

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/src/test/db.ts`
- Test: `backend/src/modules/chatbot/functions.test.ts` (create — foundation test only)

**Interfaces:**
- Produces: table `ChatbotPendingAction(sessionId text PK, action text, params jsonb, summary text, createdAt timestamptz default now())`; a seeded `User` with `username='chatbot'`.

- [ ] **Step 1: Add the model to the schema**

In `backend/prisma/schema.prisma`, after the `ActivityEvent` model add:

```prisma
model ChatbotPendingAction {
  sessionId String   @id
  action    String
  params    Json
  summary   String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Generate + apply the migration**

Run:
```bash
cd backend && npm run prisma:migrate -- --name chatbot_pending_action
```
Expected: a new `prisma/migrations/<ts>_chatbot_pending_action/` dir; `Your database is now in sync`.

- [ ] **Step 3: Apply the migration to the test database**

Run:
```bash
cd backend && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```
Expected: `All migrations have been successfully applied` (or `No pending migrations`). `TEST_DATABASE_URL` comes from the same env the tests load.

- [ ] **Step 4: Seed the chatbot user**

In `backend/prisma/seed.ts`, inside `seed()` after the existing users are created, add (Prisma `User` needs `passwordHash` non-null — reuse any placeholder hash string; the chatbot never logs in):

```ts
await prisma.user.upsert({
  where: { username: 'chatbot' },
  update: { displayName: 'PharmAssist Assistant', role: 'pharmacist', wardId: null },
  create: {
    username: 'chatbot',
    passwordHash: 'x', // never authenticates; actor attribution only
    displayName: 'PharmAssist Assistant',
    role: 'pharmacist',
    wardId: null,
  },
})
```

- [ ] **Step 5: Add the pending table to the test TRUNCATE list**

In `backend/src/test/db.ts`, add `"ChatbotPendingAction"` to the `TRUNCATE TABLE` list (first line, alongside `"ActivityEvent"`):

```ts
    TRUNCATE TABLE
      "ChatbotPendingAction", "ActivityEvent", "BillingLine", "IndentLine", "DailyIndent",
      "StockMovement", "Prescription", "InventoryItem", "Drug",
      "Patient", "User", "Ward"
    RESTART IDENTITY CASCADE
```

- [ ] **Step 6: Write the foundation test**

Create `backend/src/modules/chatbot/functions.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { seed } from '../../../prisma/seed'
import { getTestPrisma, resetDatabase } from '../../test/db'

const prisma = getTestPrisma()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seed(prisma)
})

describe('agentic foundation', () => {
  it('seeds a chatbot actor user', async () => {
    const user = await prisma.user.findUnique({ where: { username: 'chatbot' } })
    expect(user?.role).toBe('pharmacist')
  })

  it('round-trips a pending action row', async () => {
    await prisma.chatbotPendingAction.create({
      data: { sessionId: 's1', action: 'restock', params: { drugId: 'd', qty: 5 }, summary: 'x' },
    })
    const row = await prisma.chatbotPendingAction.findUnique({ where: { sessionId: 's1' } })
    expect(row?.action).toBe('restock')
  })
})
```

- [ ] **Step 7: Run the test**

Run: `cd backend && npx vitest run src/modules/chatbot/functions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/prisma/seed.ts backend/src/test/db.ts backend/src/modules/chatbot/functions.test.ts
git commit -m "feat(chatbot): add pending-action table and chatbot actor user"
```

---

## Task 2: `sql_restock` function

**Files:**
- Create: `backend/prisma/migrations/<ts>_chatbot_action_functions/migration.sql`
- Test: `backend/src/modules/chatbot/functions.test.ts` (append)

**Interfaces:**
- Produces: `sql_restock(p_drug text, p_qty int, p_preview boolean) RETURNS jsonb`.
  - error: `{ok:false, error}`; preview: `{ok:true, summary, params:{drugId, qty}}`; commit: `{ok:true, summary}`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/modules/chatbot/functions.test.ts`:

```ts
async function call(fn: string, ...args: unknown[]) {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await prisma.$queryRawUnsafe<{ r: any }[]>(`SELECT ${fn}(${ph}) AS r`, ...args)
  return rows[0].r
}

describe('sql_restock', () => {
  it('rejects a non-positive quantity', async () => {
    const r = await call('sql_restock', 'Aspirin 75mg', 0, true)
    expect(r.ok).toBe(false)
  })

  it('errors on an unknown drug', async () => {
    const r = await call('sql_restock', 'nonexistent-drug', 10, true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/No drug/)
  })

  it('errors and lists matches on an ambiguous drug', async () => {
    const r = await call('sql_restock', 'in', 10, true) // matches many labels
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Ambiguous/)
  })

  it('preview resolves without writing', async () => {
    const before = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    const r = await call('sql_restock', 'Aspirin 75mg', 50, true)
    expect(r.ok).toBe(true)
    expect(r.params.qty).toBe(50)
    const after = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    expect(after.currentStock).toBe(before.currentStock)
  })

  it('commit increments stock and writes movement + activity', async () => {
    const before = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    const r = await call('sql_restock', 'Aspirin 75mg', 50, false)
    expect(r.ok).toBe(true)
    const after = await prisma.inventoryItem.findFirstOrThrow({ where: { drug: { label: 'Aspirin 75mg' } } })
    expect(after.currentStock).toBe(before.currentStock + 50)
    const mv = await prisma.stockMovement.findFirst({ where: { drugId: after.drugId, reason: 'restock', delta: 50 } })
    expect(mv).not.toBeNull()
    const ev = await prisma.activityEvent.findFirst({ where: { type: 'restock', drugId: after.drugId } })
    expect(ev?.text).toMatch(/via assistant/)
    const chatbot = await prisma.user.findUniqueOrThrow({ where: { username: 'chatbot' } })
    expect(mv?.actorId).toBe(chatbot.id)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run src/modules/chatbot/functions.test.ts -t sql_restock`
Expected: FAIL — `function sql_restock(...) does not exist`.

- [ ] **Step 3: Create the function migration**

Run:
```bash
cd backend && npx prisma migrate dev --create-only --name chatbot_action_functions
```
Then replace the generated (empty) `migration.sql` in that new folder with:

```sql
CREATE OR REPLACE FUNCTION sql_restock(p_drug text, p_qty int, p_preview boolean)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_drug_id text;
  v_label   text;
  v_stock   int;
  v_count   int;
  v_actor   text;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be a positive number');
  END IF;

  SELECT count(*) INTO v_count
  FROM "Drug" d JOIN "InventoryItem" i ON i."drugId" = d.id
  WHERE d.label ILIKE '%' || p_drug || '%';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', format('No drug matching "%s"', p_drug));
  ELSIF v_count > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Ambiguous drug — did you mean: ' || (
        SELECT string_agg(d.label, ', ' ORDER BY d.label)
        FROM "Drug" d JOIN "InventoryItem" i ON i."drugId" = d.id
        WHERE d.label ILIKE '%' || p_drug || '%'));
  END IF;

  SELECT d.id, d.label, i."currentStock"
    INTO v_drug_id, v_label, v_stock
  FROM "Drug" d JOIN "InventoryItem" i ON i."drugId" = d.id
  WHERE d.label ILIKE '%' || p_drug || '%';

  IF p_preview THEN
    RETURN jsonb_build_object(
      'ok', true,
      'summary', format('Add %s to %s (%s → %s)', p_qty, v_label, v_stock, v_stock + p_qty),
      'params', jsonb_build_object('drugId', v_drug_id, 'qty', p_qty));
  END IF;

  v_actor := (SELECT id FROM "User" WHERE username = 'chatbot');

  UPDATE "InventoryItem"
     SET "currentStock" = "currentStock" + p_qty, "updatedAt" = now()
   WHERE "drugId" = v_drug_id
   RETURNING "currentStock" INTO v_stock;

  INSERT INTO "StockMovement"(id, "drugId", delta, reason, ref, "actorId")
  VALUES (gen_random_uuid()::text, v_drug_id, p_qty, 'restock', NULL, v_actor);

  INSERT INTO "ActivityEvent"(id, type, "drugId", "actorId", text)
  VALUES (gen_random_uuid()::text, 'restock', v_drug_id, v_actor,
          format('Restocked %s — +%s (via assistant)', v_label, p_qty));

  RETURN jsonb_build_object('ok', true,
    'summary', format('Restocked %s: +%s, new stock %s', v_label, p_qty, v_stock));
END;
$fn$;
```

- [ ] **Step 4: Apply the migration to dev and test databases**

Run:
```bash
cd backend && npx prisma migrate dev && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```
Expected: both report the `chatbot_action_functions` migration applied.

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx vitest run src/modules/chatbot/functions.test.ts -t sql_restock`
Expected: PASS (5 tests). If the "ambiguous" test fails because `'in'` matches exactly one seeded drug, pick a substring that matches ≥2 seeded labels (inspect `prisma/seed-data.ts`).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/migrations backend/src/modules/chatbot/functions.test.ts
git commit -m "feat(chatbot): add sql_restock action function"
```

---

## Task 3: `sql_create_patient` function

**Files:**
- Modify: the same `<ts>_chatbot_action_functions/migration.sql` is already applied — add this function in a **new** create-only migration so it is versioned separately and re-appliable.
- Test: `backend/src/modules/chatbot/functions.test.ts` (append)

**Interfaces:**
- Produces: `sql_create_patient(p_name text, p_dob date, p_gender text, p_phone text, p_ward_code text, p_bed text, p_admission_date date, p_diagnosis text, p_allergies text, p_preview boolean) RETURNS jsonb`.
  - error: `{ok:false, error}`; preview: `{ok:true, summary, params}`; commit: `{ok:true, summary}` with `summary` containing the allocated MRN.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/modules/chatbot/functions.test.ts`:

```ts
describe('sql_create_patient', () => {
  const ok = ['Jane Doe', '1990-05-01', 'Female', '0700000000', 'Ward 4A',
              'B-12', '2026-08-08', 'Pneumonia', 'None'] as const

  it('reports missing required fields', async () => {
    const r = await call('sql_create_patient', null, null, 'Female', '070', 'Ward 4A',
                         'B-1', '2026-08-08', 'Dx', 'None', true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/name/)
    expect(r.error).toMatch(/dateOfBirth/)
  })

  it('errors on an unknown ward code', async () => {
    const r = await call('sql_create_patient', 'Jane Doe', '1990-05-01', 'Female', '070',
                         'Ward ZZ', 'B-1', '2026-08-08', 'Dx', 'None', true)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/ward/i)
  })

  it('preview resolves without creating a patient', async () => {
    const before = await prisma.patient.count()
    const r = await call('sql_create_patient', ...ok, true)
    expect(r.ok).toBe(true)
    expect(await prisma.patient.count()).toBe(before)
  })

  it('commit creates the patient with an MRN and register activity', async () => {
    const before = await prisma.patient.count()
    const r = await call('sql_create_patient', ...ok, false)
    expect(r.ok).toBe(true)
    expect(r.summary).toMatch(/MRN-\d{6}/)
    expect(await prisma.patient.count()).toBe(before + 1)
    const p = await prisma.patient.findFirstOrThrow({ where: { name: 'Jane Doe' } })
    expect(p.gender).toBe('Female')
    const ev = await prisma.activityEvent.findFirst({ where: { type: 'register', patientId: p.id } })
    expect(ev?.text).toMatch(/via assistant/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run src/modules/chatbot/functions.test.ts -t sql_create_patient`
Expected: FAIL — `function sql_create_patient(...) does not exist`.

- [ ] **Step 3: Create the function migration**

Run:
```bash
cd backend && npx prisma migrate dev --create-only --name chatbot_create_patient_function
```
Replace the generated empty `migration.sql` with:

```sql
CREATE OR REPLACE FUNCTION sql_create_patient(
  p_name text, p_dob date, p_gender text, p_phone text,
  p_ward_code text, p_bed text, p_admission_date date,
  p_diagnosis text, p_allergies text, p_preview boolean)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_ward_id text;
  v_missing text[] := '{}';
  v_mrn     text;
  v_id      text;
  v_actor   text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN v_missing := array_append(v_missing, 'name'); END IF;
  IF p_dob IS NULL THEN v_missing := array_append(v_missing, 'dateOfBirth'); END IF;
  IF p_gender IS NULL OR p_gender NOT IN ('Male','Female','Other') THEN v_missing := array_append(v_missing, 'gender'); END IF;
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN v_missing := array_append(v_missing, 'phone'); END IF;
  IF p_bed IS NULL OR btrim(p_bed) = '' THEN v_missing := array_append(v_missing, 'bed'); END IF;
  IF p_admission_date IS NULL THEN v_missing := array_append(v_missing, 'admissionDate'); END IF;
  IF p_diagnosis IS NULL OR btrim(p_diagnosis) = '' THEN v_missing := array_append(v_missing, 'diagnosis'); END IF;
  IF p_allergies IS NULL THEN v_missing := array_append(v_missing, 'allergies'); END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing: ' || array_to_string(v_missing, ', '));
  END IF;

  SELECT id INTO v_ward_id FROM "Ward" WHERE code = p_ward_code;
  IF v_ward_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', format('No ward with code "%s"', p_ward_code));
  END IF;

  IF p_preview THEN
    RETURN jsonb_build_object('ok', true,
      'summary', format('Register %s in %s, bed %s', p_name, p_ward_code, p_bed),
      'params', jsonb_build_object(
        'name', p_name, 'dob', p_dob, 'gender', p_gender, 'phone', p_phone,
        'wardCode', p_ward_code, 'bed', p_bed, 'admissionDate', p_admission_date,
        'diagnosis', p_diagnosis, 'allergies', p_allergies));
  END IF;

  v_mrn   := 'MRN-' || lpad(((SELECT count(*) FROM "Patient") + 1)::text, 6, '0');
  v_id    := gen_random_uuid()::text;
  v_actor := (SELECT id FROM "User" WHERE username = 'chatbot');

  INSERT INTO "Patient"(id, mrn, name, "dateOfBirth", gender, phone, "wardId", bed,
                        "admissionDate", diagnosis, allergies, status)
  VALUES (v_id, v_mrn, p_name, p_dob, p_gender::"Gender", p_phone, v_ward_id, p_bed,
          p_admission_date, p_diagnosis, p_allergies, 'admitted');

  INSERT INTO "ActivityEvent"(id, type, "patientId", "wardId", "actorId", text)
  VALUES (gen_random_uuid()::text, 'register', v_id, v_ward_id, v_actor,
          format('Patient registered: %s — %s, %s (via assistant)', p_name, p_ward_code, p_bed));

  RETURN jsonb_build_object('ok', true, 'summary', format('Registered %s as %s', p_name, v_mrn));
END;
$fn$;
```

- [ ] **Step 4: Apply to dev and test databases**

Run:
```bash
cd backend && npx prisma migrate dev && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```
Expected: `chatbot_create_patient_function` applied to both.

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx vitest run src/modules/chatbot/functions.test.ts`
Expected: PASS (all foundation + restock + create_patient tests).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/migrations backend/src/modules/chatbot/functions.test.ts
git commit -m "feat(chatbot): add sql_create_patient action function"
```

---

## Task 4: SNS agentic workflow (`.sns.json`) + platform verification

This deliverable is a platform artifact — it runs on `agents.snsihub.ai`, not in this repo, so it is verified by import + live POSTs rather than by vitest.

**Files:**
- Create: `docs/chatbot/pharmassist-chatbot-agentic.sns.json` (start from `docs/chatbot/pharmassist-chatbot-advanced.sns.json`)

**Interfaces:**
- Consumes: `sql_restock`, `sql_create_patient`, `ChatbotPendingAction` (Tasks 1–3); the chat webhook payload `{ body: { userMessage, sessionId } }`.

- [ ] **Step 1: Copy the advanced workflow as the base**

```bash
cp docs/chatbot/pharmassist-chatbot-advanced.sns.json docs/chatbot/pharmassist-chatbot-agentic.sns.json
```

- [ ] **Step 2: Add the "Load Pending" node**

A `postgres.executeQuery` node after Normalize Input, before intent extraction:
```sql
SELECT action, params, summary
FROM "ChatbotPendingAction"
WHERE "sessionId" = $1
  AND "createdAt" > now() - interval '5 minutes'
```
Bind `$1 = {{ $('Normalize Input').item.json.sessionId }}`. Output exposes `pending` (0 or 1 row).

- [ ] **Step 3: Extend the Information Extractor**

Change the extractor attributes to classify agentic turns:
- `kind` (string, required) — one of `confirm`, `cancel`, `action`, `query`, `general`.
- `action` (string) — `restock` or `create_patient` when `kind=action`.
- `drug`, `qty` — for restock.
- `name`, `dob`, `gender`, `phone`, `wardCode`, `bed`, `admissionDate`, `diagnosis`, `allergies` — for create_patient.

Prompt guidance: if a pending action exists (pass its `summary` into the extractor `text`), classify a bare "yes"/"ok" as `confirm` and "no"/"cancel" as `cancel`.

- [ ] **Step 4: Route on pending + kind (core_switch)**

Rules (first match wins):
1. pending present AND `kind=confirm` → **Confirm branch**.
2. pending present AND `kind=cancel` → **Cancel branch**.
3. `kind=action` → **Propose branch**.
4. `kind=query` → existing read branches (unchanged).
5. fallback → **general** (Gemini).

- [ ] **Step 5: Build the Propose branch**

- `postgres.executeQuery` calling the right preview function:
  - restock: `SELECT sql_restock($1, $2, true) AS r` with `$1=drug`, `$2=qty`.
  - create_patient: `SELECT sql_create_patient($1,...,$9, true) AS r`.
- Branch on `r.ok`:
  - `false` → Shape Reply `{ reply: r.error }` (store nothing).
  - `true` → `postgres.executeQuery` UPSERT the pending row:
    ```sql
    INSERT INTO "ChatbotPendingAction"("sessionId", action, params, summary, "createdAt")
    VALUES ($1, $2, $3::jsonb, $4, now())
    ON CONFLICT ("sessionId") DO UPDATE
      SET action = EXCLUDED.action, params = EXCLUDED.params,
          summary = EXCLUDED.summary, "createdAt" = now()
    ```
    with `$2=action`, `$3=r.params`, `$4=r.summary`.
  - then Shape Reply `{ reply: r.summary || '. Confirm? (yes/no)' }`.

- [ ] **Step 6: Build the Confirm branch**

- `postgres.executeQuery` calling the commit function using the stored `pending.params`:
  - restock: `SELECT sql_restock(($1->>'drugId')...)` — simplest is a small dispatcher: switch on `pending.action` and call the matching function with values pulled from `pending.params` JSON.
  - create_patient: `SELECT sql_create_patient(($1->>'name'), ($1->>'dob')::date, ...)` with `$1 = pending.params`.
- Then `DELETE FROM "ChatbotPendingAction" WHERE "sessionId" = $1`.
- Shape Reply `{ reply: r.summary }`.

- [ ] **Step 7: Build the Cancel branch**

- `DELETE FROM "ChatbotPendingAction" WHERE "sessionId" = $1`.
- Shape Reply `{ reply: 'Cancelled.' }`.

- [ ] **Step 8: Fix the import fingerprint**

The importer checks `_fingerprint = btoa(nodesStr + "::" + edgesStr).slice(0,64)` where `nodesStr = nodes.map(n => `${type}:${toolId}`).sort().join("|")` and `edgesStr = edges.map(e => `${source}:${target}`).sort().join("|")`. After editing nodes/edges, recompute and set `_fingerprint` (and ensure every node has `id`, `type`, `position`, `data`). Reuse the exact algorithm from `docs/superpowers/specs/2026-08-07-sns-chatbot-advanced-design.md`.

- [ ] **Step 9: Verify on the platform (manual)**

Import the file — must load without tamper/structure rejection. Then POST to the chat webhook and confirm each:

| # | POST `userMessage` (same `sessionId`) | Expected `reply` |
|---|---|---|
| 1 | "restock 50 aspirin" | "Add 50 to Aspirin 75mg (… → …). Confirm? (yes/no)" |
| 2 | "yes" | "Restocked Aspirin 75mg: +50, new stock …" |
| 3 | "restock 999 zzz" | "No drug matching \"zzz\"" (no pending stored) |
| 4 | "register a patient" (missing fields) | "Missing: name, dateOfBirth, …" |
| 5 | "add patient Jane Doe, F, dob 1990-05-01, phone …, Ward 4A bed B-12, admitted 2026-08-08, dx pneumonia, no allergies" | "Register Jane Doe in Ward 4A, bed B-12. Confirm? (yes/no)" |
| 6 | "no" | "Cancelled." (patient NOT created) |
| 7 | a read question e.g. "what's low on stock?" | existing stock answer (unchanged) |

Confirm in the app that restock #2 appears in the activity feed attributed to the chatbot user, tagged `(via assistant)`.

- [ ] **Step 10: Commit**

```bash
git add docs/chatbot/pharmassist-chatbot-agentic.sns.json
git commit -m "feat(chatbot): add agentic SNS workflow with two-turn confirm"
```

---

## Self-Review Notes

- **Spec coverage:** pending table (Task 1) ✓; raw-SQL constraints — id/updatedAt/enums baked into function SQL (Tasks 2–3) ✓; two-turn confirm flow (Task 4 steps 4–7) ✓; seeded chatbot actor (Task 1) ✓; restock + create_patient only, sweep/dispense deferred ✓; all success criteria mapped to Task 4 step 9 table ✓.
- **Deferred by design:** `sql_run_sweep`, `sql_dispense`, prescription writes, conversation history beyond one pending action, undo.
- **Known limitation:** MRN allocation under true concurrency can raise a unique-violation to the caller (not retried in SQL); acceptable for chatbot-rate traffic, matches the low volume of a single assistant.
