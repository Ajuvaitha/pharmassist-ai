# Auto-Indent: How Ward Medication Dispensing Actually Works

This is the explanatory companion to `API_ENDPOINTS_DETAILED.md`. That
document lists every route, request, and response; this one explains why
the system is shaped the way it is — the daily cycle, the invariant that
keeps stock and billing honest, and which values are computed on the fly
rather than stored. It does not repeat endpoint-by-endpoint detail; where a
route matters, it is named and you should go to the API reference for its
contract.

Everything below is read from the shipped code: `backend/prisma/schema.prisma`,
`backend/src/modules/indents/service.ts`, `packages/shared/src/frequency.ts`,
`backend/src/domain/dto.ts`, `backend/src/domain/dates.ts`, and
`backend/src/jobs/sweep.ts`.

## 1. The problem

A doctor prescribes a multi-day course — say, `TDS` (three times a day) for
seven days. Before this backend existed, nothing connected that
prescription to a pharmacy pickup or a bill: the UI held three unrelated
mock arrays (prescriptions, a pickup list, a transaction log) and a nurse
or pharmacist reconciled them by hand.

Two failure modes fall out of doing this by hand: it is slow (a nurse
hand-copying a ward's charts into a paper indent slip every morning), and
it is unsafe (a doctor's stop order can lag behind the pharmacy, so a
cancelled medication still gets prepared and billed because nobody told
the pickup list).

The auto-indent system removes both: a scheduled sweep generates the
day's pickup list from live prescription data, and a stop order cancels
future pending lines the instant it is written — there is no separate
list for it to fall out of sync with.

## 2. The daily cycle, and the invariant that makes it safe

```
06:00 sweep  →  ward pickup list  →  dispense (per patient)  →  billing line (per drug line)
```

1. **Sweep** (`runSweep` in `backend/src/modules/indents/service.ts`, scheduled
   by `backend/src/jobs/sweep.ts` at `0 6 * * *`, server time). For every
   ward, it finds every prescription due that day and writes one
   `DailyIndent` row for the ward and one `IndentLine` per due prescription.
   Nothing is dispensed and nothing is billed yet — this step only decides
   *what should be prepared*.
2. **Pickup list** (`getPickupList`, behind `GET /api/wards/:id/pickup-list`
   — see the API reference for the response shape). Reads the indent lines
   for a ward and date back out, grouped by patient, so pharmacy staff can
   see what to prepare in one screen instead of walking the ward.
3. **Dispense** (`dispense`, behind `POST /api/indents/dispense`). A
   pharmacist confirms a patient actually received their medication. This
   is the only step in the cycle that decrements `InventoryItem.currentStock`,
   and the only thing anywhere that creates a `BillingLine`.
4. **Stop order** (`stopPrescription`, behind `POST
   /api/prescriptions/:id/stop`). Can happen at any point in the cycle; it
   cancels that prescription's still-pending indent lines so a later
   dispense cannot act on them.

The invariant that makes the whole system trustworthy:

> **Dispensing is the only thing that takes stock *out*, and the only
> thing that creates a billing line.**

The sweep only plans. The pickup list only displays. Only `dispense`
decrements `InventoryItem.currentStock`, and only `dispense` creates a
`BillingLine`. That means a patient is never charged for medication that
was merely scheduled, and stock is never short by more than what was
actually handed to a ward.

Stock does move in one other place — `restock` in the inventory module
puts stock *in*. It only ever increments, and it never creates a
`BillingLine`, so it cannot make a patient owe anything. Both paths write
an append-only `StockMovement` row in the same transaction as the balance
change, so the movement log always reconciles with `currentStock`.

## 3. The data model

The schema (`backend/prisma/schema.prisma`) has 11 models: `User`, `Ward`,
`Patient`, `Drug`, `InventoryItem`, `StockMovement`, `Prescription`,
`DailyIndent`, `IndentLine`, `BillingLine`, `ActivityEvent`. The path this
document follows runs through six of them:

`Prescription` (the doctor's order) → `DailyIndent` (one row per ward per
day) → `IndentLine` (one row per due prescription within that indent) →
`InventoryItem` / `StockMovement` (stock effect of a dispense) →
`BillingLine` (money effect of a dispense).

Two unique constraints are what let the 06:00 sweep be re-run safely — by
the cron job racing a pharmacist's manual re-trigger, or by an operator
re-running it after a crash — without ever preparing a patient's
medication twice:

- **`DailyIndent @@unique([wardId, indentDate])`** — a ward can have at
  most one indent for a given day. A second sweep run for the same ward
  and day cannot create a second indent; it finds the existing one.
- **`IndentLine @@unique([indentId, prescriptionId])`** — a prescription
  can appear at most once in a given indent. Re-running the sweep inserts
  with `skipDuplicates: true`; any line the first run already created is
  silently skipped rather than duplicated.

Idempotency comes from the database, not from a "check if it exists, then
create" read-then-write in application code. A read-then-check races:
under concurrent callers, two processes can both read "not found" before
either has written, and both proceed to create. The comment in
`runSweep` spells out the concrete case — Prisma's `upsert` here compiles
to a `SELECT` then an `INSERT`, not a single atomic `INSERT ... ON
CONFLICT`, so two callers can both miss the `SELECT` and both attempt the
`INSERT`. The constraint is what actually prevents the duplicate; the
loser's `INSERT` fails with Postgres error `P2002`, which `runSweep`
catches and turns into "read back the row the winner created" rather than
letting it surface as an unhandled 500. A duplicate indent line would mean
a patient's medication gets prepared, dispensed, and billed twice for one
day — the constraint is a correctness guarantee, not an optimization.

## 4. The inclusion rule

A prescription generates an `IndentLine` on a given day only if all five
of these hold, checked across `runSweep` and `planLinesFor` in
`backend/src/modules/indents/service.ts`:

1. `Prescription.status === 'active'` (checked in `runSweep`'s Prisma
   `where`, before rows ever reach `planLinesFor`).
2. `Patient.status === 'admitted'` (same `where`, via the `patient`
   relation).
3. `isSweepable(rx.frequency)` — the frequency has a schedule at all.
4. `isDueOn(rx.frequency, rx.startDate, date)` — due specifically on this
   date.
5. `treatmentDayFor(rx.startDate, date)` is between `1` and
   `rx.durationDays` inclusive — the course hasn't finished.

`planLinesFor` is deliberately pure: given a list of already-filtered
prescriptions and a date, it decides who's due and computes each line's
quantity and treatment day. It does not re-check status or admission —
those are conditions 1 and 2, enforced only by the caller's `where`
clause. Both the scheduled 06:00 job and the manual sweep endpoint go
through this same function, so a manual re-trigger can never compute a
different answer than the cron job would have.

```ts
// backend/src/modules/indents/service.ts
for (const rx of prescriptions) {
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
```

The eight frequency codes (`packages/shared/src/frequency.ts`):

| Code | Meaning | Doses/day | Swept? |
|---|---|---|---|
| `OD` | once daily | 1 | yes |
| `BD` | twice daily | 2 | yes |
| `TDS` | three times daily | 3 | yes |
| `QDS` | four times daily | 4 | yes |
| `ON` | at night | 1 | yes |
| `Weekly` | once every 7 days | 1 | yes, only on its due day |
| `PRN` | as needed | 0 | never |
| `STAT` | immediate, one-off | 0 | never |

`Weekly` is due when the number of whole days since `startDate` is a
multiple of 7 (`isDueOn`: `offsetDays % 7 === 0`) — so it recurs every
seventh day counting from the start date, not from a fixed day of the
week. `PRN` and `STAT` are excluded by `isSweepable` before `isDueOn` is
even consulted: neither has a schedule the sweep can act on, so both are
dispensed ad hoc outside the indent system entirely — there is no
`IndentLine` path for them.

## 5. The dispense transaction

`dispense` (`backend/src/modules/indents/service.ts`) runs as one Prisma
`$transaction`, in this order, for all of a patient's pending lines on a
given ward and date:

1. Load every `IndentLine` for the patient's indent, with drug, inventory,
   and patient included, **ordered by `drugId`**.
2. Separate cancelled lines (a stop order beat this dispense to them) from
   pending ones, and fail with a clear conflict if there's nothing left to
   dispense.
3. **Aggregate required quantity per drug** across all pending lines
   before checking anything.
4. **Check every drug's total requirement against stock, for every line,
   before writing any of it.**
5. Only then, loop over the lines: decrement `InventoryItem.currentStock`,
   record a `StockMovement`, flip the line to `dispensed`, and create its
   `BillingLine` with the drug's current unit price copied onto the row.
6. Write one `ActivityEvent` summarizing the batch.

Two things about the ordering matter, and both are guarding against a
specific way this could go wrong silently:

**Stock is checked for every line before any write happens.** If checking
and writing were interleaved per line, a shortfall discovered on the last
line of a five-line batch would leave the first four already decremented
and billed — a transaction rollback undoes the database rows, but by then
the pharmacist may already have physically handed over four drugs. Doing
all the checks first, before the first write, means a shortfall anywhere
in the batch fails the whole batch before anything is committed and
before anything is handed to the ward.

**The per-drug aggregation happens before the check, not the write.**
`Prescription` is only unique on `(patientId, drugId, startDate)`, so one
patient can hold two active prescriptions for the same drug with
different start dates that are both due the same day — two `IndentLine`
rows for the same drug in one dispense batch. If each line checked stock
independently against a figure read once at the top of the loop, both
lines could pass the same check and both decrement, driving
`currentStock` negative with nothing to stop it. Summing required
quantity per drug first, then checking the sum, closes that gap.

**Unit price is snapshotted onto `BillingLine.unitPrice`, not
referenced.** It's a copy of `Drug.unitPrice` taken at the moment of
dispense, not a live join. If the catalog price changes next month, every
bill already issued keeps the price the patient was actually charged;
only new dispenses pick up the new price.

Row locking gets a mention too: lines are loaded `orderBy: { drugId: 'asc'
}` specifically so that when two pharmacists dispense different patients
who share a drug, both transactions acquire `InventoryItem` row locks in
the same order — otherwise two transactions taking locks in opposite
orders can deadlock.

`dispense` is also idempotent per line: each `IndentLine` update is
conditioned on `status: 'pending'` (`updateMany`, not a blind update by
id), so a second dispense attempt on an already-dispensed line — a
concurrent double-submit under Postgres's READ COMMITTED isolation — lands
as a labelled `BATCH_ALREADY_FULFILLED` conflict rather than a raw unique
constraint violation on the `BillingLine` insert.

## 6. Stop orders

`stopPrescription` (`backend/src/modules/prescriptions/service.ts`) sets
the prescription to `stopped` and cancels its **pending** `IndentLine`
rows from today forward. Lines already `dispensed` are left untouched —
the patient received that medication and owes for it; a stop order is not
a refund mechanism (refunds are explicitly out of scope, see §8).

Cancelling a prescription's last pending line can empty out an indent
entirely. `closeIndentIfComplete` (`backend/src/modules/indents/service.ts`)
is the shared check for that: it counts an indent's remaining `pending`
lines and flips the indent to `dispensed` once none are left. Both
`dispense` and `stopPrescription` call it after their own transaction
commits — not from inside it. The reasoning, from the function's comment:
two concurrent writers that each clear the last pending line only see
their own transaction's snapshot mid-transaction, so counting has to
happen after commit for the writer that lands last to see every commit
that came before it. Before both callers shared this check, a stop order
that cancelled an indent's last pending line left that indent stuck at
`swept` forever, because only `dispense` used to call it.

## 7. Derived vs. stored

Four values are computed at read time and never written to a column:

- **`Prescription.currentDay`** (`toPrescriptionDto` in
  `backend/src/domain/dto.ts`) — `treatmentDayFor(startDate, today)`. A
  stored `currentDay` would be correct only for the moment it was written
  and wrong every day after — it would need a background job just to keep
  incrementing it. Computing it from `startDate` at read time means it is
  always correct for whatever "now" the read happens at, with no
  maintenance job required. (`toPrescriptionDto` also derives display
  `status`: an `active` prescription whose course has elapsed reports as
  `completed`, but a `stopped` prescription is never reinterpreted — a
  clinical stop decision outranks the calendar.)
- **`InventoryItem` `status`** (`stockStatusFor` in
  `backend/src/domain/dto.ts`) — `critical` / `low` / `ok`, computed from
  `currentStock` versus `reorderLevel` (`≤ 20%` of reorder level is
  `critical`, `≤` reorder level is `low`). `currentStock` changes on every
  dispense and restock; a stored status column would need to be
  recomputed on every one of those writes to stay correct; deriving it at
  read time makes that impossible to get out of sync.
- **Ward `sweepStatus`** (`listWards` in `backend/src/modules/wards/service.ts`)
  — read off today's `DailyIndent.status` for that ward (`pending` if none
  exists yet).
- **Ward `activePatients`** (same function) — a live `Patient` count
  scoped to `status: 'admitted'` for that ward, not a counter maintained
  on admit/discharge.

The common thread: every one of these is a function of other stored data
plus "now" (today's date, current stock, current admissions). Storing the
output would mean storing a value that is only valid until the next
midnight, dispense, restock, admission, or discharge — and then needing
code somewhere to keep it in sync. Deriving it at read time means there
is nothing to keep in sync.

## 8. What is deliberately not built

From the design spec's out-of-scope list
(`docs/superpowers/specs/2026-08-06-pharmassist-backend-design.md`, §12),
still true of the shipped system:

- Discharge workflow
- Bill voiding and refunds
- Refresh-token rotation
- Pagination beyond a `limit` parameter
- Multi-hospital tenancy
- Importing `Medicine_Names.csv`
- Anything from `demo/`

Two further gaps are known and intentional rather than oversights:
`runSweep`'s per-ward loop is not transactional across wards — a crash
partway through leaves some wards swept and others not, but because the
sweep is idempotent (§3), simply re-running it self-heals the gap. And the
06:00 scheduled job (`backend/src/jobs/sweep.ts`) logs a failure without
retrying; recovery is "run the manual sweep endpoint," not an automatic
retry loop.

For endpoint-by-endpoint request/response detail on any of the routes
named above, see `API_ENDPOINTS_DETAILED.md`.
