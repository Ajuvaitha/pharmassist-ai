# SNS Chatbot — Advanced Workflow Design

**Date:** 2026-08-07
**Status:** Approved (design), pending `postgres.executeQuery` schema
**Platform:** SNS Agent Workbench (`agents.snsihub.ai`), export format `_platform: "agentbuilder"`, `_version: 1`.

## Context

A working baseline chatbot workflow already imports and runs end-to-end
(`docs/chatbot/pharmassist-chatbot.sns.json`):

```
Webhook → Set (normalize) → Switch (keyword intent)
  ├ prescription → postgres.select(Prescription) → Gemini → Respond
  ├ stock/indent → postgres.select(InventoryItem) → Gemini → Respond
  └ fallback     → Gemini → Respond
```

Confirmed working against a public Neon Postgres with seeded data; Gemini
produces the natural-language answer. Two known rough edges:

1. Routing is brittle keyword matching on the raw message.
2. Answers expose raw `patientId` / `drugId` (no names); response is nested
   Gemini JSON, not a clean `{reply}` the frontend widget expects.

## Goals

Add two capabilities (user-selected):

1. **Smart intent + entity extraction** — replace the keyword Switch with an
   LLM-based Information Extractor.
2. **Names not IDs + clean reply** — return patient/drug names via SQL JOINs and
   flatten the reply to `{ "reply": "<text>" }`.

Explicitly out of scope for now (deferred): conversation memory, AI guardrails,
Slack alerts, charts, conversation logging.

## Platform capabilities (verified from the app)

- Tools available include `postgres.select|insert|update|delete|upsert|executeQuery|trigger`,
  `merge`, `informationExtractor`.
- Cross-node expressions use n8n-style `$('NodeName')`, `$json`, `$input.all`.
- Import integrity: `_fingerprint = btoa(nodesStr + "::" + edgesStr).slice(0,64)`
  where `nodesStr = nodes.map(`${type}:${toolId}`).sort().join("|")` and
  `edgesStr = edges.map(`${source}:${target}`).sort().join("|")`. The generator
  reproduces this exactly (verified against a real export).
- Importer structural check: every node needs `id`, `type`, `position`, `data`.

## Target flow

```
Chat Webhook
  → Normalize Input (core.set)
  → Extract Intent (informationExtractor, provider gemini)
        out: { intent: prescription|stock|general, patientMrn, drugName }
  → Route Intent (core_switch on {{ $json.intent }})
      ├ prescription → Query Rx+names (postgres.executeQuery, JOIN) → Gemini → Shape Reply → Respond
      ├ stock        → Query stock+names (postgres.executeQuery, JOIN) → Gemini → Shape Reply → Respond
      └ general      → Gemini → Shape Reply → Respond
```

## Component detail

### Extract Intent (informationExtractor)
- `schemaType: attribute_descriptions`, `provider: gemini`, `credentialId` set by user.
- Attributes:
  - `intent` (string, required) — one of `prescription`, `stock`, `general`.
  - `patientMrn` (string) — patient MRN if present.
  - `drugName` (string) — drug/medication name if present.
- `text` input = `{{ $json.userMessage }}`.

### Route Intent (core_switch)
- Mode `rules`, route on extracted `intent`:
  - `equal "prescription"` → output-0
  - `equal "stock"` → output-1
  - fallback → output-fallback (general)

### executeQuery JOINs (exact field names TBD from export)
Prescriptions:
```sql
SELECT p.dose, p.frequency, p."foodTiming", p."durationDays", p.notes,
       pat.name AS patient, d.name AS drug, d.strength
FROM "Prescription" p
JOIN "Patient" pat ON pat.id = p."patientId"
JOIN "Drug"    d   ON d.id   = p."drugId"
WHERE p.status = 'active'
  AND ($1 = '' OR pat.mrn = $1)   -- $1 = extracted patientMrn
ORDER BY p."prescribedAt" DESC
LIMIT 50;
```
Stock:
```sql
SELECT d.name AS drug, d.strength, i."currentStock", i."reorderLevel",
       (i."currentStock" <= i."reorderLevel") AS needs_reorder
FROM "InventoryItem" i
JOIN "Drug" d ON d.id = i."drugId"
ORDER BY i."currentStock" ASC
LIMIT 100;
```
Postgres identifiers are PascalCase (Prisma default) → must be double-quoted.

### Shape Reply (core.set)
- `mode: manual`, `includeOtherInputFields: false`.
- One assignment: `reply` (expression) = Gemini text
  (`{{ $json.content.parts[0].text }}` — exact path confirmed from a live run).
- Output item = `{ "reply": "..." }`.

## Open items

- `postgres.executeQuery` `toolData` / input field names (SQL string field, param
  binding syntax `$1` vs named) — obtain from a fresh export containing that node.
- Confirm `informationExtractor` output field path for `intent` used by the Switch
  (likely top-level `{{ $json.intent }}`; verify on first run).

## Success criteria

- File imports without the tamper/structure rejection.
- A POST with "can I get more of my heart medication for MRN X" routes to the
  prescription branch and returns a `{reply}` naming patient + drug.
- A stock question returns items with names and a reorder flag.
- Unmatched message hits the general branch.
