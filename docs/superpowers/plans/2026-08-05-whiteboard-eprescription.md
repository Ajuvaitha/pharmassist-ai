# Whiteboard E-Prescription Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone demo where a doctor writes a prescription by hand on a digital whiteboard; handwritten medicine names are recognized live, confirmed against a mock drug list via a suggestion popup, filled in with structured dosage details, and compiled into a printable e-prescription summary.

**Architecture:** New isolated React 19 + Vite app in `demo/`. A `Whiteboard` component wraps the `iink-ts` `INKV2` editor (MyScript Cloud handwriting recognition over HTTP, with a configurable quiet-period trigger). Recognized words are fuzzy-matched against a local mock medicine list (`fuse.js`); matches open a suggestion popup, then a structured dosage form popup; confirmed entries accumulate in a `PrescriptionSummary` panel with a print-based PDF export.

**Tech Stack:** React 19.2.8, Vite 8.2.0, `iink-ts` 3.3.2 (handwriting capture + MyScript Cloud recognition), `fuse.js` 7.5.0 (fuzzy matching), Vitest 4 + Testing Library 16 (unit/component tests), no backend.

## Global Constraints

- Demo lives entirely under `demo/` at the repo root — own `package.json`, no shared deps/build with `frontend/`.
- No backend server, no database, no persistence beyond browser session state.
- Handwriting recognition uses `iink-ts` `Editor.load(rootEl, "INKV2", options)` talking directly to `cloud.myscript.com` — no proxy server.
- Recognition keys (`VITE_MYSCRIPT_APPLICATION_KEY`, `VITE_MYSCRIPT_HMAC_KEY`) are read from `demo/.env` (gitignored); `demo/.env.example` is committed with placeholder values.
- Recognition trigger is quiet-period based (auto-fires after a pause in writing), not a manual button — configured via `configuration.triggers = { exportContent: "QUIET_PERIOD", exportContentDelay: 800 }`.
- Dosage/frequency/duration/timing are entered through a structured form popup, never parsed from handwriting.
- PDF/print export uses `window.print()` with a print stylesheet — no `jspdf`/`html2canvas` dependency.
- Medicine dataset is a small standalone mock list in `demo/src/data/medicines.js`, not shared with `frontend/`.

---

## Task 1: Scaffold the demo app

**Files:**
- Create: `demo/package.json`
- Create: `demo/vite.config.js`
- Create: `demo/index.html`
- Create: `demo/.gitignore`
- Create: `demo/.env.example`
- Create: `demo/src/main.jsx`
- Create: `demo/src/App.jsx`
- Create: `demo/src/App.css`
- Create: `demo/src/setupTests.js`
- Test: `demo/src/App.test.jsx`

**Interfaces:**
- Produces: `App` default-exported React component rendered at `#root`. Later tasks add children/state to this component but do not change its export shape.

- [ ] **Step 1: Create `demo/package.json`**

```json
{
  "name": "whiteboard-eprescription-demo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "fuse.js": "^7.5.0",
    "iink-ts": "^3.3.2",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.3",
    "@vitejs/plugin-react": "^6.0.4",
    "jsdom": "^30.0.1",
    "vite": "^8.2.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create `demo/vite.config.js`**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    globals: true,
  },
})
```

- [ ] **Step 3: Create `demo/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Whiteboard E-Prescription Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `demo/.gitignore`**

```
node_modules
dist
.env
```

- [ ] **Step 5: Create `demo/.env.example`**

```
VITE_MYSCRIPT_APPLICATION_KEY=
VITE_MYSCRIPT_HMAC_KEY=
```

- [ ] **Step 6: Create `demo/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 7: Create `demo/src/App.jsx`**

```jsx
export default function App() {
  return (
    <div className="app-shell">
      <h1>Whiteboard E-Prescription Demo</h1>
    </div>
  )
}
```

- [ ] **Step 8: Create `demo/src/App.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f4f6f8;
  color: #1a1a1a;
}

.app-shell {
  padding: 24px;
}
```

- [ ] **Step 9: Create `demo/src/setupTests.js`**

```javascript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 10: Write the smoke test — `demo/src/App.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

describe('App', () => {
  it('renders the demo heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /whiteboard e-prescription demo/i }),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 11: Install dependencies**

Run: `cd demo && npm install`
Expected: installs succeed, `demo/node_modules` and `demo/package-lock.json` created.

- [ ] **Step 12: Run the test to verify it passes**

Run: `cd demo && npm test`
Expected: PASS — 1 test passed (`App > renders the demo heading`).

- [ ] **Step 13: Verify the app builds**

Run: `cd demo && npm run build`
Expected: build succeeds, `demo/dist` created with no errors.

- [ ] **Step 14: Commit**

```bash
git add demo/package.json demo/package-lock.json demo/vite.config.js demo/index.html demo/.gitignore demo/.env.example demo/src/main.jsx demo/src/App.jsx demo/src/App.css demo/src/setupTests.js demo/src/App.test.jsx
git commit -m "feat(demo): scaffold whiteboard e-prescription demo app"
```

---

## Task 2: Mock medicine data + fuzzy matching

**Files:**
- Create: `demo/src/data/medicines.js`
- Create: `demo/src/lib/matchMedicine.js`
- Test: `demo/src/lib/matchMedicine.test.js`

**Interfaces:**
- Consumes: nothing (pure data + logic layer).
- Produces:
  - `medicines: Array<{ id: string, name: string, unitOfMeasure: string, commonFrequency: string }>` (default export of `data/medicines.js`).
  - `matchMedicine(query: string, medicines: Array<Medicine>, options？: { limit?: number }) => Array<Medicine & { score: number }>` — named export.
  - `bestMatchClearsThreshold(matches: Array<{ score: number }>, maxScore？: number) => boolean` — named export.

- [ ] **Step 1: Create `demo/src/data/medicines.js`**

```javascript
const medicines = [
  { id: 'med-001', name: 'Paracetamol', unitOfMeasure: 'tablet', commonFrequency: 'TID' },
  { id: 'med-002', name: 'Amoxicillin', unitOfMeasure: 'capsule', commonFrequency: 'TID' },
  { id: 'med-003', name: 'Ibuprofen', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
  { id: 'med-004', name: 'Metformin', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
  { id: 'med-005', name: 'Amlodipine', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-006', name: 'Atorvastatin', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-007', name: 'Omeprazole', unitOfMeasure: 'capsule', commonFrequency: 'OD' },
  { id: 'med-008', name: 'Cetirizine', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-009', name: 'Azithromycin', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-010', name: 'Losartan', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-011', name: 'Salbutamol', unitOfMeasure: 'inhaler puff', commonFrequency: 'QID' },
  { id: 'med-012', name: 'Metronidazole', unitOfMeasure: 'tablet', commonFrequency: 'TID' },
  { id: 'med-013', name: 'Ciprofloxacin', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
  { id: 'med-014', name: 'Pantoprazole', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-015', name: 'Doxycycline', unitOfMeasure: 'capsule', commonFrequency: 'BID' },
  { id: 'med-016', name: 'Levothyroxine', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-017', name: 'Hydrochlorothiazide', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-018', name: 'Prednisone', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-019', name: 'Clopidogrel', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-020', name: 'Simvastatin', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-021', name: 'Gabapentin', unitOfMeasure: 'capsule', commonFrequency: 'TID' },
  { id: 'med-022', name: 'Sertraline', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-023', name: 'Tramadol', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
  { id: 'med-024', name: 'Furosemide', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-025', name: 'Warfarin', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-026', name: 'Diazepam', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
  { id: 'med-027', name: 'Ranitidine', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
  { id: 'med-028', name: 'Loratadine', unitOfMeasure: 'tablet', commonFrequency: 'OD' },
  { id: 'med-029', name: 'Diclofenac', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
  { id: 'med-030', name: 'Insulin Glargine', unitOfMeasure: 'unit', commonFrequency: 'OD' },
]

export default medicines
```

- [ ] **Step 2: Write the failing tests — `demo/src/lib/matchMedicine.test.js`**

```javascript
import { describe, it, expect } from 'vitest'
import { matchMedicine, bestMatchClearsThreshold } from './matchMedicine.js'

const medicines = [
  { id: 'med-001', name: 'Paracetamol', unitOfMeasure: 'tablet', commonFrequency: 'TID' },
  { id: 'med-002', name: 'Amoxicillin', unitOfMeasure: 'capsule', commonFrequency: 'TID' },
  { id: 'med-004', name: 'Metformin', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
]

describe('matchMedicine', () => {
  it('returns an exact match as the top result', () => {
    const results = matchMedicine('Paracetamol', medicines)
    expect(results[0].name).toBe('Paracetamol')
  })

  it('is typo-tolerant', () => {
    const results = matchMedicine('Paracetmol', medicines)
    expect(results[0].name).toBe('Paracetamol')
  })

  it('returns an empty array for an empty query', () => {
    expect(matchMedicine('', medicines)).toEqual([])
    expect(matchMedicine('   ', medicines)).toEqual([])
  })

  it('respects the limit option', () => {
    const results = matchMedicine('a', medicines, { limit: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })
})

describe('bestMatchClearsThreshold', () => {
  it('is true when the top match score is at or below the threshold', () => {
    const results = matchMedicine('Metformin', medicines)
    expect(bestMatchClearsThreshold(results)).toBe(true)
  })

  it('is false for an empty match list', () => {
    expect(bestMatchClearsThreshold([])).toBe(false)
  })

  it('is false when the top score is above the threshold', () => {
    expect(bestMatchClearsThreshold([{ score: 0.9 }], 0.4)).toBe(false)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd demo && npm test -- matchMedicine`
Expected: FAIL with "Failed to resolve import './matchMedicine.js'" (module doesn't exist yet).

- [ ] **Step 4: Implement `demo/src/lib/matchMedicine.js`**

```javascript
import Fuse from 'fuse.js'

const FUSE_OPTIONS = {
  keys: ['name'],
  threshold: 0.4,
  includeScore: true,
}

export function matchMedicine(query, medicines, { limit = 5 } = {}) {
  if (!query || !query.trim()) return []
  const fuse = new Fuse(medicines, FUSE_OPTIONS)
  return fuse
    .search(query.trim(), { limit })
    .map(({ item, score }) => ({ ...item, score }))
}

export function bestMatchClearsThreshold(matches, maxScore = 0.4) {
  return matches.length > 0 && matches[0].score <= maxScore
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd demo && npm test -- matchMedicine`
Expected: PASS — all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add demo/src/data/medicines.js demo/src/lib/matchMedicine.js demo/src/lib/matchMedicine.test.js
git commit -m "feat(demo): add mock medicine list and fuzzy-match logic"
```

---

## Task 3: Word-settle diffing logic

**Files:**
- Create: `demo/src/lib/diffWords.js`
- Test: `demo/src/lib/diffWords.test.js`

**Context:** `iink-ts`'s `INKV2` editor only fires its `exported` event after the configured quiet-period pause, so every export snapshot already represents "settled" ink. What's still needed is figuring out which words in that snapshot are *new* since the last snapshot, so a word that already triggered a suggestion popup doesn't trigger it again on every subsequent export (which re-sends the whole word list). Word identity is positional: MyScript's `INKV2` JIIX `words` array is ordered left-to-right/top-to-bottom in writing order, so index `i` in one export corresponds to the same word slot in the next export unless recognition revises that word's label as more context is written — in which case it should be treated as new to report and shown again.

**Interfaces:**
- Consumes: nothing beyond plain arrays of `{ label: string }`-shaped objects.
- Produces: `diffSettledWords(previousWords: Array<{ label: string }>, currentWords: Array<{ label: string }>) => Array<{ label: string }>` — named export, returns the subset of `currentWords` (same object references) that are new or relabeled compared to `previousWords` at the same index.

- [ ] **Step 1: Write the failing tests — `demo/src/lib/diffWords.test.js`**

```javascript
import { describe, it, expect } from 'vitest'
import { diffSettledWords } from './diffWords.js'

describe('diffSettledWords', () => {
  it('reports all words when there is no previous snapshot', () => {
    const current = [{ label: 'Paracetamol' }]
    expect(diffSettledWords([], current)).toEqual(current)
  })

  it('reports only newly appended words', () => {
    const wordA = { label: 'Paracetamol' }
    const wordB = { label: 'Metformin' }
    const previous = [wordA]
    const current = [wordA, wordB]
    expect(diffSettledWords(previous, current)).toEqual([wordB])
  })

  it('reports a word again if its label changed at the same position', () => {
    const previous = [{ label: 'Parac' }]
    const revised = { label: 'Paracetamol' }
    const current = [revised]
    expect(diffSettledWords(previous, current)).toEqual([revised])
  })

  it('reports nothing when nothing changed', () => {
    const wordA = { label: 'Paracetamol' }
    const previous = [wordA]
    const current = [{ label: 'Paracetamol' }]
    expect(diffSettledWords(previous, current)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd demo && npm test -- diffWords`
Expected: FAIL with "Failed to resolve import './diffWords.js'" (module doesn't exist yet).

- [ ] **Step 3: Implement `demo/src/lib/diffWords.js`**

```javascript
export function diffSettledWords(previousWords, currentWords) {
  return currentWords.filter((word, index) => {
    const prev = previousWords[index]
    return !prev || prev.label !== word.label
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd demo && npm test -- diffWords`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add demo/src/lib/diffWords.js demo/src/lib/diffWords.test.js
git commit -m "feat(demo): add word-settle diffing logic for recognition exports"
```

---

## Task 4: Whiteboard component (iink-ts integration)

**Files:**
- Create: `demo/src/components/Whiteboard.jsx`

**Context:** This task wires the real MyScript SDK to the DOM and network, which cannot be meaningfully unit-tested without live credentials and a browser pointer stream (per the design doc's Testing section). Verification for this task is manual/visual, done in Task 8 once the component is wired into `App.jsx`. This task's deliverable is the component compiling and rendering its "keys missing" state correctly, which the build step verifies.

**Interfaces:**
- Consumes: `matchMedicine`/nothing directly — this component only deals with recognition, not matching.
- Produces: `Whiteboard` default-exported React component with props:
  - `onWordSettled: (word: { label: string, box: { x: number, y: number, width: number, height: number } }) => void` — called once per newly-settled recognized word, with its pixel-space bounding box (relative to the whiteboard's own container).

- [ ] **Step 1: Create `demo/src/components/Whiteboard.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { Editor, convertBoundingBoxMillimeterToPixel } from 'iink-ts'
import { diffSettledWords } from '../lib/diffWords.js'

const APPLICATION_KEY = import.meta.env.VITE_MYSCRIPT_APPLICATION_KEY || ''
const HMAC_KEY = import.meta.env.VITE_MYSCRIPT_HMAC_KEY || ''

export default function Whiteboard({ onWordSettled }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const previousWordsRef = useRef([])
  const [keysMissing] = useState(!APPLICATION_KEY || !HMAC_KEY)

  useEffect(() => {
    let cancelled = false

    async function setup() {
      const editor = await Editor.load(containerRef.current, 'INKV2', {
        configuration: {
          server: {
            scheme: 'https',
            host: 'cloud.myscript.com',
            applicationKey: APPLICATION_KEY,
            hmacKey: HMAC_KEY,
          },
          recognition: {
            type: 'TEXT',
            lang: 'en_US',
          },
          triggers: {
            exportContent: 'QUIET_PERIOD',
            exportContentDelay: 800,
          },
        },
      })

      if (cancelled) {
        editor.destroy()
        return
      }

      editorRef.current = editor

      editor.event.addExportedListener((exports) => {
        const jiix = exports['application/vnd.myscript.jiix']
        if (!jiix?.words) return

        const newWords = diffSettledWords(previousWordsRef.current, jiix.words)
        previousWordsRef.current = jiix.words

        newWords.forEach((word) => {
          if (!word.label?.trim() || !word['bounding-box']) return
          const box = convertBoundingBoxMillimeterToPixel(word['bounding-box'])
          onWordSettled({ label: word.label, box })
        })
      })

      editor.event.addErrorListener((err) => {
        console.warn('iink-ts recognition error (check MyScript keys):', err)
      })
    }

    setup()

    return () => {
      cancelled = true
      editorRef.current?.destroy()
      editorRef.current = null
    }
  }, [onWordSettled])

  return (
    <div className="whiteboard">
      {keysMissing && (
        <div className="whiteboard-warning">
          Add MyScript keys to <code>demo/.env</code> to enable handwriting recognition. Drawing
          still works without them.
        </div>
      )}
      <div ref={containerRef} className="whiteboard-surface" />
    </div>
  )
}
```

- [ ] **Step 2: Verify the project still builds**

Run: `cd demo && npm run build`
Expected: build succeeds with no errors (component isn't wired into `App.jsx` yet, so this only checks it compiles standalone — confirmed by the next task's build check once it's imported).

- [ ] **Step 3: Commit**

```bash
git add demo/src/components/Whiteboard.jsx
git commit -m "feat(demo): add Whiteboard component wrapping iink-ts INKV2 editor"
```

---

## Task 5: MedicineSuggestPopup component

**Files:**
- Create: `demo/src/components/MedicineSuggestPopup.jsx`
- Test: `demo/src/components/MedicineSuggestPopup.test.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (receives matched candidates as a prop — the caller runs `matchMedicine`).
- Produces: `MedicineSuggestPopup` default-exported React component with props:
  - `position: { x: number, y: number }` — top-left anchor in pixels, relative to a `position: relative` ancestor.
  - `candidates: Array<{ id: string, name: string, unitOfMeasure: string, commonFrequency: string }>`
  - `onSelect: (candidate) => void`
  - `onDismiss: () => void`

- [ ] **Step 1: Write the failing tests — `demo/src/components/MedicineSuggestPopup.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import MedicineSuggestPopup from './MedicineSuggestPopup.jsx'

const candidates = [
  { id: 'med-001', name: 'Paracetamol', unitOfMeasure: 'tablet', commonFrequency: 'TID' },
  { id: 'med-004', name: 'Metformin', unitOfMeasure: 'tablet', commonFrequency: 'BID' },
]

describe('MedicineSuggestPopup', () => {
  it('lists every candidate name', () => {
    render(
      <MedicineSuggestPopup
        position={{ x: 0, y: 0 }}
        candidates={candidates}
        onSelect={() => {}}
        onDismiss={() => {}}
      />,
    )
    expect(screen.getByText('Paracetamol')).toBeInTheDocument()
    expect(screen.getByText('Metformin')).toBeInTheDocument()
  })

  it('calls onSelect with the clicked candidate', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <MedicineSuggestPopup
        position={{ x: 0, y: 0 }}
        candidates={candidates}
        onSelect={onSelect}
        onDismiss={() => {}}
      />,
    )
    await user.click(screen.getByText('Metformin'))
    expect(onSelect).toHaveBeenCalledWith(candidates[1])
  })

  it('calls onDismiss when "not a medicine" is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <MedicineSuggestPopup
        position={{ x: 0, y: 0 }}
        candidates={candidates}
        onSelect={() => {}}
        onDismiss={onDismiss}
      />,
    )
    await user.click(screen.getByRole('button', { name: /not a medicine/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd demo && npm test -- MedicineSuggestPopup`
Expected: FAIL with "Failed to resolve import './MedicineSuggestPopup.jsx'" (component doesn't exist yet).

- [ ] **Step 3: Implement `demo/src/components/MedicineSuggestPopup.jsx`**

```jsx
export default function MedicineSuggestPopup({ position, candidates, onSelect, onDismiss }) {
  return (
    <div className="popup" style={{ left: position.x, top: position.y }}>
      <div className="popup-title">Is this a medicine?</div>
      <ul className="popup-list">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            <button type="button" onClick={() => onSelect(candidate)}>
              {candidate.name}
              <span className="popup-meta">
                {' '}
                &mdash; {candidate.unitOfMeasure}, usually {candidate.commonFrequency}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="popup-dismiss" onClick={onDismiss}>
        Not a medicine
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd demo && npm test -- MedicineSuggestPopup`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add demo/src/components/MedicineSuggestPopup.jsx demo/src/components/MedicineSuggestPopup.test.jsx
git commit -m "feat(demo): add MedicineSuggestPopup component"
```

---

## Task 6: DosageFormPopup component

**Files:**
- Create: `demo/src/components/DosageFormPopup.jsx`
- Test: `demo/src/components/DosageFormPopup.test.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (receives the selected medicine as a prop).
- Produces: `DosageFormPopup` default-exported React component with props:
  - `position: { x: number, y: number }`
  - `medicine: { id: string, name: string, unitOfMeasure: string, commonFrequency: string }`
  - `onConfirm: (details: { frequency: string, dosageQty: number, durationDays: number, timing: string }) => void`
  - `onCancel: () => void`

- [ ] **Step 1: Write the failing tests — `demo/src/components/DosageFormPopup.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import DosageFormPopup from './DosageFormPopup.jsx'

const medicine = { id: 'med-001', name: 'Paracetamol', unitOfMeasure: 'tablet', commonFrequency: 'TID' }

describe('DosageFormPopup', () => {
  it('shows the medicine name and pre-fills its common frequency', () => {
    render(
      <DosageFormPopup
        position={{ x: 0, y: 0 }}
        medicine={medicine}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText(/Paracetamol/)).toBeInTheDocument()
    expect(screen.getByLabelText(/frequency/i)).toHaveValue('TID')
  })

  it('calls onConfirm with the entered details', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <DosageFormPopup
        position={{ x: 0, y: 0 }}
        medicine={medicine}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )

    await user.clear(screen.getByLabelText(/dosage quantity/i))
    await user.type(screen.getByLabelText(/dosage quantity/i), '2')
    await user.clear(screen.getByLabelText(/duration/i))
    await user.type(screen.getByLabelText(/duration/i), '5')
    await user.selectOptions(screen.getByLabelText(/timing/i), 'after food')
    await user.click(screen.getByRole('button', { name: /add to prescription/i }))

    expect(onConfirm).toHaveBeenCalledWith({
      frequency: 'TID',
      dosageQty: 2,
      durationDays: 5,
      timing: 'after food',
    })
  })

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <DosageFormPopup
        position={{ x: 0, y: 0 }}
        medicine={medicine}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd demo && npm test -- DosageFormPopup`
Expected: FAIL with "Failed to resolve import './DosageFormPopup.jsx'" (component doesn't exist yet).

- [ ] **Step 3: Implement `demo/src/components/DosageFormPopup.jsx`**

```jsx
import { useState } from 'react'

const FREQUENCIES = ['OD', 'BID', 'TID', 'QID']
const TIMINGS = ['before food', 'after food', 'anytime']

export default function DosageFormPopup({ position, medicine, onConfirm, onCancel }) {
  const [frequency, setFrequency] = useState(medicine.commonFrequency || FREQUENCIES[0])
  const [dosageQty, setDosageQty] = useState(1)
  const [durationDays, setDurationDays] = useState(5)
  const [timing, setTiming] = useState(TIMINGS[0])

  function handleSubmit(event) {
    event.preventDefault()
    onConfirm({
      frequency,
      dosageQty: Number(dosageQty),
      durationDays: Number(durationDays),
      timing,
    })
  }

  return (
    <div className="popup" style={{ left: position.x, top: position.y }}>
      <div className="popup-title">{medicine.name}</div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="dosage-frequency">Frequency</label>
        <select
          id="dosage-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          {FREQUENCIES.map((freq) => (
            <option key={freq} value={freq}>
              {freq}
            </option>
          ))}
        </select>

        <label htmlFor="dosage-qty">Dosage quantity</label>
        <input
          id="dosage-qty"
          type="number"
          min="1"
          value={dosageQty}
          onChange={(e) => setDosageQty(e.target.value)}
        />

        <label htmlFor="dosage-duration">Duration (days)</label>
        <input
          id="dosage-duration"
          type="number"
          min="1"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
        />

        <label htmlFor="dosage-timing">Timing</label>
        <select id="dosage-timing" value={timing} onChange={(e) => setTiming(e.target.value)}>
          {TIMINGS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <div className="popup-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">Add to Prescription</button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd demo && npm test -- DosageFormPopup`
Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add demo/src/components/DosageFormPopup.jsx demo/src/components/DosageFormPopup.test.jsx
git commit -m "feat(demo): add DosageFormPopup component"
```

---

## Task 7: PrescriptionSummary component

**Files:**
- Create: `demo/src/components/PrescriptionSummary.jsx`
- Test: `demo/src/components/PrescriptionSummary.test.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks directly.
- Produces: `PrescriptionSummary` default-exported React component with props:
  - `patientName: string`, `onPatientNameChange: (value: string) => void`
  - `doctorName: string`, `onDoctorNameChange: (value: string) => void`
  - `entries: Array<{ id: string, medicineName: string, frequency: string, dosageQty: number, durationDays: number, timing: string }>`
  - `onRemoveEntry: (id: string) => void`
  - `onExport: () => void`

- [ ] **Step 1: Write the failing tests — `demo/src/components/PrescriptionSummary.test.jsx`**

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import PrescriptionSummary from './PrescriptionSummary.jsx'

const entries = [
  {
    id: 'entry-1',
    medicineName: 'Paracetamol',
    frequency: 'TID',
    dosageQty: 1,
    durationDays: 5,
    timing: 'after food',
  },
]

describe('PrescriptionSummary', () => {
  it('hides the export button when there are no entries', () => {
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={() => {}}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={[]}
        onRemoveEntry={() => {}}
        onExport={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /finalize.*export/i })).not.toBeInTheDocument()
  })

  it('shows entries and an enabled export button when entries exist', () => {
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={() => {}}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={entries}
        onRemoveEntry={() => {}}
        onExport={() => {}}
      />,
    )
    expect(screen.getByText(/Paracetamol/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalize.*export/i })).toBeEnabled()
  })

  it('calls onRemoveEntry with the entry id', async () => {
    const user = userEvent.setup()
    const onRemoveEntry = vi.fn()
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={() => {}}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={entries}
        onRemoveEntry={onRemoveEntry}
        onExport={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: /remove Paracetamol/i }))
    expect(onRemoveEntry).toHaveBeenCalledWith('entry-1')
  })

  it('calls onPatientNameChange as the patient field is edited', async () => {
    const user = userEvent.setup()
    const onPatientNameChange = vi.fn()
    render(
      <PrescriptionSummary
        patientName=""
        onPatientNameChange={onPatientNameChange}
        doctorName=""
        onDoctorNameChange={() => {}}
        entries={[]}
        onRemoveEntry={() => {}}
        onExport={() => {}}
      />,
    )
    await user.type(screen.getByLabelText(/patient name/i), 'A')
    expect(onPatientNameChange).toHaveBeenCalledWith('A')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd demo && npm test -- PrescriptionSummary`
Expected: FAIL with "Failed to resolve import './PrescriptionSummary.jsx'" (component doesn't exist yet).

- [ ] **Step 3: Implement `demo/src/components/PrescriptionSummary.jsx`**

```jsx
export default function PrescriptionSummary({
  patientName,
  onPatientNameChange,
  doctorName,
  onDoctorNameChange,
  entries,
  onRemoveEntry,
  onExport,
}) {
  return (
    <div className="summary-panel">
      <div className="summary-header">
        <label htmlFor="patient-name">Patient name</label>
        <input
          id="patient-name"
          value={patientName}
          onChange={(e) => onPatientNameChange(e.target.value)}
        />

        <label htmlFor="doctor-name">Doctor name</label>
        <input
          id="doctor-name"
          value={doctorName}
          onChange={(e) => onDoctorNameChange(e.target.value)}
        />
      </div>

      <ul className="summary-entries">
        {entries.map((entry) => (
          <li key={entry.id}>
            <div>
              <strong>{entry.medicineName}</strong>
              <div className="summary-entry-detail">
                {entry.frequency} &middot; {entry.dosageQty} &middot; {entry.durationDays} days
                &middot; {entry.timing}
              </div>
            </div>
            <button
              type="button"
              aria-label={`Remove ${entry.medicineName}`}
              onClick={() => onRemoveEntry(entry.id)}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>

      {entries.length > 0 && (
        <button type="button" onClick={onExport}>
          Finalize &amp; Export PDF
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd demo && npm test -- PrescriptionSummary`
Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add demo/src/components/PrescriptionSummary.jsx demo/src/components/PrescriptionSummary.test.jsx
git commit -m "feat(demo): add PrescriptionSummary component"
```

---

## Task 8: Wire everything together in App.jsx + print stylesheet

**Files:**
- Modify: `demo/src/App.jsx`
- Modify: `demo/src/App.css`

**Context:** This is the integration task: it connects `Whiteboard`'s recognized words to `matchMedicine`, opens `MedicineSuggestPopup` and `DosageFormPopup`, and feeds confirmed entries into `PrescriptionSummary`. Because it depends on the real MyScript SDK receiving live pointer input and network responses, it is verified manually in a browser (Step 4 below), not by an automated test — consistent with the design doc's Testing section.

**Interfaces:**
- Consumes:
  - `Whiteboard` (Task 4): `onWordSettled({ label, box })`
  - `matchMedicine`, `bestMatchClearsThreshold` (Task 2)
  - `MedicineSuggestPopup` (Task 5): `position`, `candidates`, `onSelect`, `onDismiss`
  - `DosageFormPopup` (Task 6): `position`, `medicine`, `onConfirm`, `onCancel`
  - `PrescriptionSummary` (Task 7): `patientName`, `onPatientNameChange`, `doctorName`, `onDoctorNameChange`, `entries`, `onRemoveEntry`, `onExport`
- Produces: nothing further — this is the top-level component.

- [ ] **Step 1: Replace `demo/src/App.jsx` with the wired-up version**

```jsx
import { useCallback, useState } from 'react'
import Whiteboard from './components/Whiteboard.jsx'
import MedicineSuggestPopup from './components/MedicineSuggestPopup.jsx'
import DosageFormPopup from './components/DosageFormPopup.jsx'
import PrescriptionSummary from './components/PrescriptionSummary.jsx'
import medicines from './data/medicines.js'
import { matchMedicine, bestMatchClearsThreshold } from './lib/matchMedicine.js'

let nextEntryId = 1

export default function App() {
  const [patientName, setPatientName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [entries, setEntries] = useState([])
  const [pendingSuggestion, setPendingSuggestion] = useState(null)
  const [pendingDosage, setPendingDosage] = useState(null)

  const handleWordSettled = useCallback((word) => {
    const matches = matchMedicine(word.label, medicines)
    if (!bestMatchClearsThreshold(matches)) return

    setPendingSuggestion({
      position: { x: word.box.x, y: word.box.y + word.box.height + 8 },
      candidates: matches.slice(0, 5),
    })
  }, [])

  function handleSelectCandidate(candidate) {
    setPendingDosage({ position: pendingSuggestion.position, medicine: candidate })
    setPendingSuggestion(null)
  }

  function handleDismissSuggestion() {
    setPendingSuggestion(null)
  }

  function handleConfirmDosage(details) {
    setEntries((prev) => [
      ...prev,
      {
        id: `entry-${nextEntryId++}`,
        medicineName: pendingDosage.medicine.name,
        ...details,
      },
    ])
    setPendingDosage(null)
  }

  function handleCancelDosage() {
    setPendingDosage(null)
  }

  function handleRemoveEntry(id) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  function handleExport() {
    window.print()
  }

  return (
    <div className="app-shell">
      <h1>Whiteboard E-Prescription Demo</h1>
      <div className="app-layout">
        <div className="whiteboard-column">
          <Whiteboard onWordSettled={handleWordSettled} />
          {pendingSuggestion && (
            <MedicineSuggestPopup
              position={pendingSuggestion.position}
              candidates={pendingSuggestion.candidates}
              onSelect={handleSelectCandidate}
              onDismiss={handleDismissSuggestion}
            />
          )}
          {pendingDosage && (
            <DosageFormPopup
              position={pendingDosage.position}
              medicine={pendingDosage.medicine}
              onConfirm={handleConfirmDosage}
              onCancel={handleCancelDosage}
            />
          )}
        </div>
        <PrescriptionSummary
          patientName={patientName}
          onPatientNameChange={setPatientName}
          doctorName={doctorName}
          onDoctorNameChange={setDoctorName}
          entries={entries}
          onRemoveEntry={handleRemoveEntry}
          onExport={handleExport}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Append layout + popup + print styles to `demo/src/App.css`**

```css
.app-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  align-items: start;
}

.whiteboard-column {
  position: relative;
}

.whiteboard {
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  overflow: hidden;
}

.whiteboard-surface {
  width: 100%;
  height: 480px;
}

.whiteboard-warning {
  background: #fff4e5;
  color: #8a5300;
  padding: 8px 12px;
  font-size: 0.85rem;
  border-bottom: 1px solid #f0c987;
}

.popup {
  position: absolute;
  z-index: 10;
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 12px;
  min-width: 220px;
}

.popup-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.popup-list {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
}

.popup-list button {
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border: none;
  background: none;
  cursor: pointer;
}

.popup-list button:hover {
  background: #f4f6f8;
}

.popup-meta {
  color: #667085;
  font-size: 0.8rem;
}

.popup form label {
  display: block;
  font-size: 0.8rem;
  margin-top: 8px;
}

.popup form input,
.popup form select {
  width: 100%;
  padding: 4px 6px;
}

.popup-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
}

.summary-panel {
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  padding: 16px;
}

.summary-entries {
  list-style: none;
  margin: 12px 0;
  padding: 0;
}

.summary-entries li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eaecf0;
}

.summary-entry-detail {
  color: #667085;
  font-size: 0.8rem;
}

@media print {
  .whiteboard-column,
  .popup {
    display: none !important;
  }

  .app-layout {
    display: block;
  }
}
```

- [ ] **Step 3: Verify the app builds**

Run: `cd demo && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual verification in a browser**

This step requires MyScript developer keys in `demo/.env` (see Task 9's README) to exercise real recognition; without them the whiteboard still renders and is drawable, but no suggestion popups will appear (only the "keys missing" banner from Task 4).

Run: `cd demo && npm run dev`, open the printed local URL in a browser, and confirm:
1. The whiteboard surface accepts mouse-drawn strokes.
2. With valid keys: after writing a medicine name and pausing briefly, a suggestion popup appears near the word.
3. Selecting a candidate opens the dosage form popup; submitting it adds a row to the prescription summary on the right.
4. Clicking a summary row's remove button removes it.
5. "Finalize & Export PDF" only appears once at least one entry exists, and clicking it opens the browser print dialog showing a clean prescription layout (whiteboard/popups hidden).

- [ ] **Step 5: Run the full test suite**

Run: `cd demo && npm test`
Expected: PASS — all tests across all files pass (App, matchMedicine, diffWords, MedicineSuggestPopup, DosageFormPopup, PrescriptionSummary).

- [ ] **Step 6: Commit**

```bash
git add demo/src/App.jsx demo/src/App.css
git commit -m "feat(demo): wire whiteboard, matching, popups and summary together"
```

---

## Task 9: Setup docs

**Files:**
- Create: `demo/README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Create `demo/README.md`**

```markdown
# Whiteboard E-Prescription Demo

A standalone demo: a doctor writes a prescription by hand on a digital whiteboard. Handwritten
medicine names are recognized live and matched against a mock drug list; confirmed medicines get
structured dosage details and build up into a printable e-prescription.

This is a demo only — no backend, no persistence beyond the browser session.

## Setup

1. `npm install`
2. Get a free MyScript developer account and application/HMAC key pair:
   https://developer.myscript.com/getting-started/web
3. Copy `.env.example` to `.env` and fill in your keys:
   ```
   VITE_MYSCRIPT_APPLICATION_KEY=your-application-key
   VITE_MYSCRIPT_HMAC_KEY=your-hmac-key
   ```
4. `npm run dev`

Without keys, the whiteboard still renders and can be drawn on, but handwriting recognition (and
therefore the medicine suggestion popups) won't fire — a banner in the app explains this.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm test` — run the unit/component test suite
```

- [ ] **Step 2: Commit**

```bash
git add demo/README.md
git commit -m "docs(demo): add setup instructions for MyScript keys"
```

---

## Self-Review Notes

- **Spec coverage:** architecture/stack (Task 1), medicine data + matching (Task 2), recognition + word-settling (Tasks 3-4), suggestion popup (Task 5), structured dosage form (Task 6), summary panel + print export (Task 7-8), edge cases — keys-missing banner (Task 4), empty-prescription export hidden (Task 7 test), setup docs (Task 9) — all covered.
- **Type consistency checked:** `word.label` / `word.box` (Whiteboard → App), `candidate.id/name/unitOfMeasure/commonFrequency` (matchMedicine → MedicineSuggestPopup → DosageFormPopup), `entry.id/medicineName/frequency/dosageQty/durationDays/timing` (App → PrescriptionSummary) match across every task that produces/consumes them.
- **No placeholders:** every step has complete, runnable code; no "TBD" or "similar to Task N" shortcuts.
