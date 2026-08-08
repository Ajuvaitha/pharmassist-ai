# SNS Chatbot — Agentic Actions Design

**Date:** 2026-08-08
**Status:** Approved (design)
**Platform:** SNS Agent Workbench (`agents.snsihub.ai`), export format `_platform: "agentbuilder"`, `_version: 1`.
**Builds on:** [2026-08-07-sns-chatbot-advanced-design.md](2026-08-07-sns-chatbot-advanced-design.md) (read-path intent + JOIN answers).

## Context

The advanced chatbot answers questions (read-only): intent extraction → Postgres
`select`/`executeQuery` JOINs → Gemini → `{reply}`. This design adds the **agentic**
capability: the chatbot performs write actions in the app.

**Hard constraint:** SNS Workbench runs in the cloud (`agents.snsihub.ai`) and
**cannot reach the backend REST API** on localhost. Therefore all writes go
directly against the public Neon Postgres, **not** through the Fastify API. The
backend's business logic and side-effects must be replicated on the DB side.

## Goals

- Chatbot executes write actions from natural language.
- **v1 scope:** `restock` inventory and `create_patient`.
- **Deferred:** `run_sweep` and `dispense` — they reimplement clinical scheduling
  math (`planLinesFor`: `isSweepable` / `isDueOn` / `dosesPerDay` / `treatmentDayFor`)
  in SQL, which duplicates TS logic and risks drift. Add once the SQL port is
  validated against the TS source. Prescriptions also deferred (clinical stakes).

## Key decisions

1. **Execution path: raw Postgres, via functions.** SNS cannot call the API, so
   writes hit Neon directly. Each action is a **Postgres function** (in a
   migration), not inline SQL scattered across the `.sns.json`. One reviewable,
   atomic, versioned place per action.
2. **Two-turn confirm.** Writes are guarded: the agent restates the action and
   waits for `yes`/`no`. This needs cross-message state.
3. **Pending state in Postgres.** SNS webhooks are stateless; the pending action
   is stored in a `chatbot_pending_action` table keyed by `sessionId` (the chat
   webhook already provides `body.sessionId`; the normalize node already assigns
   it).
4. **Seeded `chatbot` user** owns the writes (`actorId`), so the activity feed
   attributes assistant actions to a real actor.

## Constraints the SQL must respect

These come from Prisma app-level defaults that are **not** DB-level:

- **`id` is `@default(cuid())` — app-side, no DB default.** Every `INSERT`
  (`StockMovement`, `ActivityEvent`, `Patient`, …) must generate its own id.
  Use `gen_random_uuid()::text` — unique, valid `String` id, just not cuid-shaped
  (acceptable; ids are opaque).
- **`@updatedAt` is app-side.** Raw `UPDATE` must set `updatedAt = now()` manually
  (e.g. `InventoryItem.updatedAt`).
- **`@default(now())` timestamps DO map to real DB defaults** (`createdAt`,
  `occurredAt`, `generatedAt`) — those auto-fill, no need to set them.
- **Postgres identifiers are PascalCase** (Prisma default) → must be
  double-quoted (`"InventoryItem"`, `"currentStock"`).
- **Patient fields are all NOT NULL** (`name`, `dateOfBirth`, `gender`, `phone`,
  `wardId`, `bed`, `admissionDate`, `diagnosis`, `allergies`) → every param
  required at create time.

## Schema addition

```sql
CREATE TABLE "chatbot_pending_action" (
  session_id  text PRIMARY KEY,
  action      text NOT NULL,          -- 'restock' | 'create_patient'
  params      jsonb NOT NULL,         -- already-resolved ids + values
  summary     text NOT NULL,          -- human confirmation line, rendered at turn 1
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- One row per session (PRIMARY KEY on `session_id`) — a new action `UPSERT`s over
  any stale pending.
- TTL: the confirm query ignores rows where `created_at < now() - interval '5 minutes'`.
- Seed a `chatbot` User row with `role = 'pharmacist'` (no service role exists in
  the `Role` enum; pharmacist covers inventory + registration), `wardId = NULL`.
  Functions read its id for `actorId`.

## Target flow

```
Chat Webhook
 → Normalize Input (core.set)         out: { userMessage, sessionId }
 → Load Pending (postgres.executeQuery)
        SELECT * FROM "chatbot_pending_action"
        WHERE session_id = $1 AND created_at > now() - interval '5 minutes'
 → Extract Intent (informationExtractor, gemini)
        out: { kind, action, params }
        kind:   confirm | cancel | action | query | general
        action: restock | create_patient        (when kind = action)
 → Route Intent (core_switch):
    ├ pending + kind=confirm → call sql_<pending.action>(<pending.params>, preview:=false)
    │                          → DELETE pending row → Shape Reply(result)
    ├ pending + kind=cancel  → DELETE pending row → reply "Cancelled."
    ├ kind=action            → call sql_<action>(<params>, preview:=true)
    │      ├ ok    → UPSERT chatbot_pending_action(session_id, action, resolvedParams, summary)
    │      │         → reply "<summary>. Confirm? (yes/no)"
    │      └ error → reply <error>, store nothing
    ├ kind=query             → existing read branches (Rx / stock JOINs) → Gemini → reply
    └ kind=general           → Gemini → reply
```

- **Turn 1 (`action`)** resolves names→ids and validates. Errors surface here
  ("no drug named X", "ambiguous: A, B, C", "missing: phone, bed"). On success the
  fully-resolved params are stored — turn 2 never re-parses.
- **Turn 2 (`confirm`)** commits with `preview:=false` using stored resolved
  params, then deletes the pending row.

## Function contracts

Each function returns `jsonb`. Shared rules baked in:
`id = gen_random_uuid()::text`; set `updatedAt = now()` on updates; write the
matching `ActivityEvent` with text tagged `(via assistant)`;
`actorId = (SELECT id FROM "User" WHERE username = 'chatbot')`; whole body is one
transaction (function = atomic).

### `sql_restock(drug text, qty int, preview bool) RETURNS jsonb`

- Resolve: `"Drug"` JOIN `"InventoryItem"` on `label ILIKE '%'||drug||'%'`.
  0 rows → `{ok:false, error:"No drug matching '<drug>'"}`;
  >1 rows → `{ok:false, error:"Ambiguous: <labels>"}`.
- `qty <= 0` → error.
- **preview** → `{ok:true, summary:"Add <qty> to <label> (<n> → <n+qty>)",
  params:{drugId, qty}}`. No writes.
- **commit** →
  `UPDATE "InventoryItem" SET "currentStock" = "currentStock" + qty, "updatedAt" = now()`
  + `INSERT "StockMovement"(id, drugId, delta=qty, reason='restock', actorId)`
  + `INSERT "ActivityEvent"(id, type='restock', drugId, actorId, text)`.
  Returns `{ok:true, summary:"Restocked <label>: +<qty>, new stock <n>"}`.

### `sql_create_patient(name text, dob date, gender text, phone text, ward_code text, bed text, admission_date date, diagnosis text, allergies text, preview bool) RETURNS jsonb`

- Resolve ward by `code`; not found → error.
- Validate all fields present; missing → `{ok:false, error:"Missing: <fields>"}`.
- MRN allocated inside the tx: `'MRN-' || lpad(((SELECT count(*) FROM "Patient")+1)::text, 6, '0')`.
  Unique column protects concurrent duplicates (retry on conflict).
- **preview** → `{ok:true, summary:"Register <name> in <ward_code>, bed <bed>",
  params:{...}}`. No writes.
- **commit** → `INSERT "Patient"(...)` + `INSERT "ActivityEvent"(type='register')`.
  Returns `{ok:true, summary:"Registered <name> as <mrn>"}`.

## Out of scope (v1)

- `run_sweep`, `dispense` (SQL port of scheduling math — deferred).
- Prescription writes.
- Conversation memory beyond the single pending action (no multi-turn history).
- Rollback/undo of a committed action.

## Success criteria

- File imports without tamper/structure rejection (fingerprint reproduced).
- "restock 50 paracetamol" → agent replies with resolved summary + "Confirm?";
  a following "yes" writes stock + movement + activity and replies with new stock.
- "no" after a proposed action leaves the DB unchanged and clears pending.
- An ambiguous / unknown drug is reported at turn 1 with no pending stored.
- "register a patient" with missing fields is told exactly which fields are needed.
- A read question still routes to the existing query branches unchanged.
- Assistant writes appear in the activity feed attributed to the `chatbot` user,
  text tagged `(via assistant)`.
