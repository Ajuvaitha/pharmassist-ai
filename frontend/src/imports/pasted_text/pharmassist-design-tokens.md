# Pharmassist — Figma Design Prompt

## Product Context
Pharmassist is a hospital inpatient medication dispensing and ward logistics tool used by pharmacists and nurses. It is a clinical operations tool, not a consumer or marketing product — it must read as precise, calm, and trustworthy under time pressure (used during a live morning ward sweep, not browsed casually). Light mode only. No emojis anywhere — use a consistent line-icon set (e.g. Lucide/Feather-style) for all status and action indicators instead.

## Design Tokens

**Color** (light mode, clinical-neutral, one restrained accent — not the default cream/terracotta or dark/acid-accent AI look)
- Background: `#F7F8FA` (cool off-white, not warm cream)
- Surface / card: `#FFFFFF`
- Border / hairline: `#E2E5EA`
- Text primary: `#1B222C`
- Text secondary: `#5B6472`
- Accent (primary actions, active states): `#1E5F74` (deep teal-blue — reads clinical, not corporate-blue-generic)
- Success / in-stock / dispensed: `#2E7D5B`
- Warning / low-stock / pending: `#B5842A`
- Critical / stopped / out-of-stock: `#B23B3B`
- Info / active-in-progress: `#3A6EA5`

**Typography**
- Display / headers: Inter (Semibold/Bold) — clean, high-legibility grotesque, used with restraint for page titles and section headers only
- Body: Inter (Regular/Medium) — same family as display, differentiated by weight and size only, to keep the interface feeling unified rather than decorative
- Data / IDs / timestamps / batch numbers: IBM Plex Mono (Regular) — monospaced for anything tabular or reference-numeric (patient IDs, batch IDs, transaction IDs), so numeric data is easy to scan and compare at a glance
- Base size 14px for tables/data-dense views, 16px for forms, type scale in 4px increments

**Layout**
- Left sidebar navigation, fixed width, icon + label, current page indicated by accent-colored left border (not a filled background block)
- Persistent top bar: hospital/ward context, logged-in user + role badge, date/time
- Content area: card-based sections with 1px hairline borders, 8px corner radius, generous internal padding (16–24px) — density matters more than whitespace here, but never cramped
- Tables are the primary content pattern (drug lists, patient lists, transactions) — use zebra-free rows with hairline dividers, right-aligned numeric columns, monospace for ID columns
- Status is always shown as a small pill/tag using the color tokens above, paired with a short text label (never color alone — accessibility)

**Signature element**
- The ward sweep status indicator: a horizontal progress/state bar per ward (Pending → Swept → Dispensed) rendered as three connected segments that fill left-to-right with the accent color as the sweep progresses. This appears on the Dashboard and at the top of the Ward Sweep page, and is the one recognizable visual motif tying the whole app together — everything else stays quiet and functional around it.

## Pages to Design

1. **Login** — Hospital/system logo mark (simple wordmark, no illustration), role selection (Pharmacist / Nurse / Doctor-stub), username + password fields, ward selector (appears conditionally for Nurse role)

2. **Dashboard / Home** — Role-aware layout:
   - Sweep status bar per ward (signature element) for Pharmacist view
   - Summary metric cards: active patients, active prescriptions, pending pickups, low-stock alerts
   - Recent activity list (dispenses, cancellations, new prescriptions) as a compact timeline/table
   - Nurse view is scoped to their assigned ward only

3. **Ward Sweep & Pickup** — Ward selector tabs at top, sweep status bar, consolidated drug pick-list table (drug name, unit, total qty), expandable row per drug revealing patient-level breakdown (patient, bed, treatment day, qty), prominent "Confirm Dispense & Auto-Bill" primary button with a confirmation step, secondary "Trigger Sweep" button styled as a lower-emphasis action

4. **Patients** — List view: searchable/filterable table (name, MRN, ward, bed, admission date, active prescription count). Detail view (drawer or full page): patient demographics header, active prescriptions as cards with day-progress indicators ("Day 3 of 7" shown as a small inline progress bar), Stop-Order button per prescription opening a modal with reason dropdown + notes field, past/cancelled prescriptions collapsed below

5. **Inventory** — Drug stock table with status pill (OK/Low/Critical) per reorder-level logic, search/filter by category, restock action opens a simple form (quantity, reference, timestamp auto-filled)

6. **Billing Ledger** — Transaction table (ID, batch ID, patient, ward, drug, qty, unit price, total, timestamp, status), filters by patient/ward/date range, per-patient running total summary panel

7. **Doctor (stub)** — Minimal placeholder: a single centered card stating prescription entry happens in the external e-prescription system, with a read-only list of the doctor's recently submitted prescriptions below for reference

## Tone
Precise, quiet, and legible under pressure. No decorative illustration, no gradients beyond subtle card elevation, no playful copy. Every color communicates a real state (stock level, sweep progress, prescription status) — never used decoratively.