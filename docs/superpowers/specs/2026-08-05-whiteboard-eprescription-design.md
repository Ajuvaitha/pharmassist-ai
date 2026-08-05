# Whiteboard E-Prescription Demo — Design

Date: 2026-08-05
Status: Approved (pending final spec review)

## Purpose

A standalone demo where a doctor writes a prescription by hand on a digital whiteboard. As they write, the app recognizes each word, and if it matches a known medicine, prompts the doctor to confirm the match and fill in structured dosage details (frequency, quantity, duration, timing). Confirmed medicines accumulate into a live prescription summary, which can be exported as a printable/PDF e-prescription.

This is a demo, not a production feature: no backend, no persistence beyond the browser session, no patient database lookup.

## Architecture & Stack

- New `demo/` folder at repo root. Own React 19 + Vite app, own `package.json`, fully isolated from `frontend/` (no shared deps/build/state).
- Frontend-only. No backend server or API.
- Handwriting recognition via **MyScript iink-ts SDK**, communicating directly with MyScript Cloud from the browser (their standard web-SDK integration pattern — no proxy server needed).
  - Requires a free MyScript developer account for `applicationKey` + `hmacKey`, stored in `.env` as `VITE_MYSCRIPT_APPLICATION_KEY` / `VITE_MYSCRIPT_HMAC_KEY`.
  - These keys ship in the client bundle (unavoidable for a pure browser SDK integration) — acceptable for a demo; not a production secret-handling pattern.
- No persistence layer. Prescription state lives in React state for the session. "Export PDF" is the save/output mechanism.

### Folder structure

```
demo/
  package.json
  vite.config.js
  index.html
  .env.example
  src/
    main.jsx
    App.jsx
    data/medicines.js         # standalone mock medicine list
    lib/matchMedicine.js      # fuzzy-match logic (unit tested)
    components/
      Whiteboard.jsx           # MyScript canvas wrapper
      MedicineSuggestPopup.jsx
      DosageFormPopup.jsx
      PrescriptionSummary.jsx
```

## Whiteboard & Recognition Flow

- `Whiteboard.jsx` mounts a MyScript iink-ts `Editor` (type `TEXT`) on a div. Accepts mouse/touch/pen input.
- The SDK has its own internal debounce and fires recognition automatically after a pause in writing — no custom timer needed.
- On each recognition update, the SDK returns JIIX (word-level text + bounding boxes). The app diffs against previously-seen words and processes only newly-settled words (avoids re-matching words still being actively edited).
- Doctor can write multiple medicines on one continuous canvas; canvas does not clear between medicines. Canvas is scrollable if content grows.
- If MyScript keys are missing/invalid, `Whiteboard.jsx` shows an inline warning ("Add MyScript keys to `.env` to enable recognition") and still allows freehand drawing, but no recognition/popups fire — keeps the app demoable before setup.

## Medicine Matching & Confirmation

- Each newly-settled word is fuzzy-matched (via `fuse.js`) against `data/medicines.js` (`lib/matchMedicine.js`).
- If the best match score clears a threshold, `MedicineSuggestPopup` anchors near that word's bounding box, showing up to 5 candidate medicines plus a "not a medicine" dismiss option (for words that are patient names, notes, etc. — not everything written is a drug).
- If no match clears the threshold, no popup appears; the word is left alone.
- Selecting a candidate opens `DosageFormPopup` at the same anchor point, with fields:
  - Frequency (OD / BID / TID / QID — matches the `frequency_code` pattern already used in `frontend/src/components/PrescriptionEntry.jsx`)
  - Dosage quantity (number)
  - Duration (days, number)
  - Timing (before food / after food / anytime)
- "Add to Prescription" commits the entry to prescription state, closes the popup, and marks the word on canvas (e.g. underline) as confirmed. "Cancel" closes the popup without committing; the word remains clickable to reopen suggestions later.
- Dismissing "not a medicine" simply closes the popup for that word.

## Prescription Summary & Export

- `PrescriptionSummary.jsx` is a persistent panel (side panel on wide screens, below canvas on narrow screens).
- Top: patient name + doctor name text fields (plain inputs, no lookup).
- Body: list of confirmed medicine entries (name, frequency, dosage, duration, timing), each removable via an (x) button.
- "Finalize & Export PDF" button appears once at least one medicine is confirmed. Triggers `window.print()` with a dedicated print stylesheet that hides the canvas/popups/buttons and renders a clean formatted prescription document (patient info header, date, medicine table, doctor signature line). User saves as PDF via the browser's print dialog — avoids adding `jspdf`/`html2canvas` as a dependency.

## Data Model

**Medicine record** (`data/medicines.js`, ~30-50 mock entries):

```js
{ id, name, unitOfMeasure, commonFrequency }
```

**Prescription entry state**:

```js
{ id, medicineId, medicineName, frequency, dosageQty, durationDays, timing }
```

## Edge Cases

- Word recognized but no fuzzy match clears threshold → no popup; word left as plain ink (e.g. patient name, free-text notes).
- Doctor edits/erases a word on canvas after already confirming it → out of scope; confirmed summary entries are independent of canvas state once added (no retroactive sync).
- MyScript keys missing/invalid → see Whiteboard section above; app stays usable in draw-only mode.
- Empty prescription (no medicines confirmed) → Export button disabled/hidden.

## Testing

- Manual/visual verification for the whiteboard + recognition + popup flow (canvas + third-party SDK isn't meaningfully unit-testable).
- Unit test for `lib/matchMedicine.js` fuzzy-matching logic, since it's pure logic.
- No e2e harness — out of scope for a demo.

## Out of Scope

- Backend, database, real patient records.
- Multi-user/collaborative whiteboard.
- Editing canvas strokes after the fact with retroactive summary sync.
- Handwritten dosage/frequency shorthand parsing (dosage entry is structured-form only, per design decision).
- Drug interaction checking, allergy checking, or any clinical safety validation.
