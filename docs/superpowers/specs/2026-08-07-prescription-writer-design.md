# Prescription Writer + Chatbot — Design Spec

**Date:** 2026-08-07
**Status:** Approved, ready for implementation planning
**Scope:** Two frontend features from the `chatbot-feature` branch, re-fitted onto the current React Query + Fastify architecture. The **Prescription Writer** is full-stack (new backend). The **Chatbot** is frontend-only.

---

## 1. Problem

The `chatbot-feature` branch (remote) carries two features, both authored against **old `main`** (merge-base `e45b5dd`), before this branch rebuilt the frontend. That branch's frontend still uses the deleted `data.ts` mock model and prop-drills `patients` / `addPrescription` through `App.tsx`. The current branch instead uses React Query hooks (`frontend/src/api/*`) against a Fastify + Prisma backend. **The two features cannot be merged as-is — they must be re-implemented onto the new architecture.**

The two features:

1. **Prescription Writer** (`frontend/src/pages/PrescriptionWriterPage.tsx`, 925 lines). A doctor picks a patient, then **speaks** (Web Speech API mic) or **writes** (canvas/whiteboard) a medicine name. The branch version parses freeform lines locally into `{drug, dose, frequency, timeOfDay}` and saves via a prop callback. Drug names are **free text with no link to the real catalog** — so nothing it produces can drive indents, dispensing, or billing.

2. **Chatbot** (`frontend/src/components/ChatAssistant.tsx`, 920 lines). A floating multi-conversation assistant widget. Fully **mock**: `generateResponse` does local keyword matching. No API, no LLM.

### Source material to reuse

The user has two reference apps in the repo root to draw implementation from:

- `demo/` — **writing detection.** `src/lib/matchMedicine.js` (Fuse.js fuzzy match over a medicine list) and `src/lib/diffWords.js` (`diffSettledWords` detects newly-settled words on a handwriting canvas).
- `healthy-hands-app-main/` — **speech detection.** `src/components/VoiceAgent.tsx` (Web Speech API → verification card flow) and `src/lib/kaggleSearchEngine.ts` (in-memory multi-tier matcher — exact → brand → prefix → substring → token → soundex → fuzzy — over `kaggleMedicines.json`, built from `Medicine_Names.csv`, 187,528 rows). `scripts/buildKaggleDataset.js` builds that JSON from the CSV.

### What exists in the current backend to build on

- `Drug` catalog model (`backend/prisma/schema.prisma`), seeded with **16 curated drugs** (`backend/prisma/seed-data.ts`).
- `GET /api/drugs?search=` — naive `label contains` search (`backend/src/modules/drugs/service.ts`) + `useDrugs` hook.
- `useCreatePrescription` → `POST /api/patients/:id/prescriptions`, validated by `createPrescriptionSchema` (`packages/shared/src/api.ts`).
- `Medicine_Names.csv` (187,528 rows) sits at the repo root; a copy is under `healthy-hands-app-main/public/`.

---

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Catalog for recognized medicines | **Seed all ~187k CSV rows into the existing `Drug` table** | User's explicit call ("add all csv items to catalog"). Prescriptions already FK to `Drug` (`drugId`), so recognized drugs become prescribable with **no schema refactor** of prescriptions/indents/billing. |
| Match engine location | **Server-side, over the DB** | The 187k live in the DB anyway — matching belongs where the data is. One source of truth, no multi-MB browser bundle, no matcher logic duplicated from the catalog. Latency handled by an in-memory token/soundex index built at boot. |
| Dose/frequency capture | **Structured controls in a details popup** (not freeform parsing) | Recognize only the *drug* by voice/handwriting; capture dose/frequency/timeOfDay/duration via controls that map 1:1 to `createPrescriptionSchema`. Avoids error-prone freeform→enum mapping. |
| Confirm flow | **Two sequential popups** | (1) "Is this the drug?" with candidates; (2) prescription details. Matches the user's described flow and `VoiceAgent`'s verify-card pattern. |
| Chatbot backend | **None — frontend only** | User's explicit call. Port the widget onto the new arch, keep it self-contained. Mock `generateResponse` retained. |
| Sequencing | **Writer first, then Chatbot** | Writer is full-stack and higher-value; Chatbot is a small self-contained port. |

### Rejected alternatives

- **Separate `Medicine` table (187k) + keep `Drug` for stocked items.** Cleaner separation, but prescriptions/indents/billing would need to reference a new table — a cross-module FK refactor. Contradicts "add all to *catalog*."
- **Find-or-create a `Drug` on confirm** (promote only chosen medicines). Rejected by the user in favor of seeding all rows.
- **Client-side matching with a bundled JSON.** Near-zero backend, but the task is explicitly "add backend," and it would duplicate matching logic and ship a multi-MB bundle.

### Known consequence of seeding 187k into `Drug`

The pharmacy's `Drug` table grows from 16 curated rows to ~187k mostly **un-priced, un-stocked** entries (`unitPrice = 0`, no `InventoryItem`). This is **safe for dispensing/billing**, which only ever touch drugs that have an `InventoryItem` (staff add inventory deliberately). The visible effect is that drug-search surfaces elsewhere (e.g. `PrescriptionForm`'s existing dropdown) now query a large table — which is exactly why the search endpoint gets a real ranked matcher and a `pg_trgm` index instead of a naive scan. The 16 curated, stocked drugs remain distinguishable by having an `InventoryItem` / non-zero price.

---

## 3. Feature A — Prescription Writer (full-stack)

### 3.1 Backend

**A1. Dataset build script.** Adapt `healthy-hands-app-main/scripts/buildKaggleDataset.js` into a backend build step that parses `Medicine_Names.csv` into normalized seed rows. Each CSV line (e.g. `nicotinic acid 1000 MG / Simvastatin 40 MG Extended Release Tablet [Simcor 1000/40]`) yields:

- `label` — the full CSV string, trimmed. **Unique**; duplicates deduped.
- `name` — parsed generic (leading formulation before bracket/strength), best-effort.
- `strength` — parsed strength token(s) if present, else `""`.
- `form` — keyword-derived: `Injection` / `Syrup` / `Capsule` / `Tablet` (default `Tablet`).
- `category` — `"Uncategorized"`.
- `unitPrice` — `0`.
- (search aux) brand from `[...]`, token list, soundex codes — see A3.

Output a checked-in JSON artifact (like `kaggleMedicines.json`) that both the seed and the search index consume. The build script is idempotent and re-runnable.

**A2. Migration + seed.** A Prisma migration adds a **`pg_trgm` GIN index** on `Drug.label` (and `Drug.name`) so `contains`/similarity queries over 187k rows are fast. The seed inserts the parsed rows in batches (`createMany`, dedupe on `label`), **preserving the 16 curated drugs** (upsert by label so their real prices/strengths/categories win over any CSV collision).

**A3. Ranked search endpoint.** `GET /api/drugs/search?q=<query>&limit=<n>` returns ranked candidates. Port `kaggleSearchEngine.ts`'s tiered matcher to run **server-side**:

1. exact → 2. brand → 3. prefix → 4. substring → 5. token-level → 6. soundex phonetic → 7. fuzzy (Levenshtein).

Implementation: build an **in-memory index at boot** (token map + soundex buckets, sourced from the same JSON artifact) for tiers 5–7; use SQL (`pg_trgm` similarity / `ILIKE`) for tiers 1–4. Each result carries `{ id, label, name, strength, form, matchType, score }`. `id` is the real `Drug.id`, so the frontend can prescribe directly. `matchType`/`score` drive the confidence UI. The existing `GET /api/drugs?search=` remains for the plain catalog dropdown, or is redirected to the ranked engine — decided in planning; the Writer uses `/search`.

**A4. Prescription creation** is unchanged: `POST /api/patients/:id/prescriptions` with `createPrescriptionSchema`. The Writer supplies the confirmed `drugId` plus dose/frequency/timeOfDay/durationDays from the details popup.

### 3.2 Frontend (`PrescriptionWriterPage`, rebuilt)

Re-author the page on the current architecture — **drop** the prop-drilled `patients` / `doctorName` / `onAddPrescription`; **use** `usePatients`, a new `useDrugSearch(query)` hook (React Query, calls `/api/drugs/search`), and `useCreatePrescription`.

**Layout / routing.** Register the `prescription-writer` page: add it to the `Page` union (`frontend/src/types.ts`), the `App.tsx` switch (rendered with no props now), and the doctor nav in `Layout.tsx` (the `PenIcon` "Prescription Writer" item) — re-fitted from the branch diffs.

**Input modes:**

- **Speak.** Port `VoiceAgent.tsx`. Web Speech API stays **client-side** (browser `SpeechRecognition`). The final transcript is sent to `useDrugSearch` instead of the bundled `searchVoiceMedicines`. Keep the mic UI (animated button, sound wave, states). Handle the no-support / permission-denied cases already in `VoiceAgent`.
- **Write.** Port `demo`'s handwriting canvas + `diffSettledWords`. Recognized settled words feed `useDrugSearch`. (Handwriting→text recognition path from `demo` is reused as-is; if `demo` relies on a browser handwriting recognizer, that stays client-side. Exact recognition mechanism to be confirmed against `demo/src/pages/DoctorPage.tsx` during planning.)

**Two-popup confirm flow (both modes converge here):**

1. **Popup 1 — Confirm drug.** Shows the top match (name/strength/form + `matchType` confidence) and other candidates from `/api/drugs/search`. Doctor confirms the top match, picks another candidate, or retries input. No-match state offers retry.
2. **Popup 2 — Prescription details.** Structured controls: `dose` (text), `frequency` (`FREQUENCIES` enum select), `timeOfDay` (multi-select of morning/afternoon/evening/night), `durationDays` (positive int). Submit → `useCreatePrescription({ patientId, input })`. On success, close and show a confirmation, ready for the next drug.

**Removed from the branch version:** `parseRxText` freeform line parsing, the local `ParsedRx` model, and the `onAddPrescription` prop path.

### 3.3 Testing

- **Backend:** unit-test the CSV parser (name/strength/form derivation, dedupe) and the ranked matcher tiers (exact/prefix/soundex/fuzzy ordering) against known inputs. Integration-test `GET /api/drugs/search` returns real `Drug.id`s.
- **Frontend:** the Writer's confirm→details→create flow drives `useCreatePrescription` with the right payload (mock the search + mutation hooks). Reuse the `VoiceAgent` speech shim; unit tests target the search-wiring and popup state machine, not the browser mic itself.

---

## 4. Feature B — Chatbot (frontend only)

Port `ChatAssistant.tsx` from the branch onto the current frontend. It is **self-contained** — a floating widget mounted once in `Layout.tsx` (`<ChatAssistant />` after the main shell), with no props and no API. Retain the mock `generateResponse`, the multi-conversation sidebar, markdown rendering, and copy/delete. The only integration work is mounting it in the current `Layout.tsx` and confirming it compiles against current `types.ts`. **No backend.**

This ships as a **separate, smaller effort after the Writer** (its own plan/PR), per the sequencing decision.

---

## 5. Out of scope

- Any LLM / chat backend for the Chatbot.
- Server-side OCR (`healthy-hands`'s `ocr.server.ts`) for handwriting — the Write mode uses client-side recognition. Server OCR can be a later enhancement.
- Pricing / inventory for the newly-seeded 187k drugs — they stay un-stocked until staff add inventory.
- Rewriting `PrescriptionForm` or other existing drug-search consumers; they keep working against the (now larger) catalog.

---

## 6. Open items for planning

- Confirm `demo`'s handwriting-to-text mechanism (`demo/src/pages/DoctorPage.tsx`) and whether it needs any dependency beyond the canvas + `matchMedicine`/`diffWords`.
- Decide whether `GET /api/drugs?search=` is left as-is or delegated to the new ranked engine.
- Confirm seed strategy for CI/dev DBs given the 187k row insert (batch size, timeout, whether it runs in test setup or only dev).
