# Chatbot (Frontend-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the floating AI-assistant chat widget from the `chatbot-feature` branch onto the current frontend, keeping it fully client-side (mock responses, no backend).

**Architecture:** `ChatAssistant.tsx` is a self-contained floating widget with local state (conversations, messages) and a local keyword responder (`generateResponse`). It has **no props and no API calls**. The only integration is mounting it once inside `Layout.tsx` and confirming it compiles against the current `types.ts` / React 19. No backend, no LLM.

**Tech Stack:** React 19, inline styles (matching the app), Vitest node env (no DOM tests).

## Global Constraints

- **No backend.** Do not add any chat endpoint, LLM dependency, or network call. Retain the mock `generateResponse`.
- The widget must not depend on removed mock data (`frontend/src/data.ts` is deleted). It is self-contained; confirm no stray imports from `../data`.
- Ships **after** the Prescription Writer (its own branch/PR).
- Frontend Vitest is node env — unit-test only pure helpers; verify the widget in the browser preview.
- Commit after every task.

---

## File Structure

- `frontend/src/components/ChatAssistant.tsx` (create) — ported widget (from `origin/chatbot-feature`).
- `frontend/src/components/Layout.tsx` (modify) — mount `<ChatAssistant />` once, wrapping the shell in a fragment.
- Optionally `frontend/src/lib/renderChatContent.test.ts` — only if pure render helpers are extracted.

---

## Task 1: Port the ChatAssistant widget

**Files:**
- Create: `frontend/src/components/ChatAssistant.tsx`

**Interfaces:**
- Consumes: nothing (self-contained; no props).
- Produces: default-exported `ChatAssistant` component.

- [ ] **Step 1: Extract the branch version of the file**

The branch's `ChatAssistant.tsx` was already extracted to the scratchpad during brainstorming; if unavailable, re-extract:

```bash
git show origin/chatbot-feature:frontend/src/components/ChatAssistant.tsx > frontend/src/components/ChatAssistant.tsx
```

- [ ] **Step 2: Reconcile with the current codebase**

Open the new `frontend/src/components/ChatAssistant.tsx` and:
- Confirm it imports **nothing** from `../data`, `../types` mock models, or any prop-drilled state. It should only import from `react`. Remove/replace any stray import that no longer exists.
- Confirm it uses inline styles (it does) — no Tailwind/lucide/shadcn deps to add.
- Keep `generateResponse`, the multi-conversation sidebar, markdown rendering (`renderContent`/`renderInline`), and copy/delete handlers as-is.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit`
Expected: no errors. Fix any type gaps introduced by React 19 / current `tsconfig` (e.g. explicit `React.ReactNode` typing already present in the source).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatAssistant.tsx
git commit -m "feat(frontend): port self-contained chat assistant widget"
```

---

## Task 2: Mount the widget in Layout and verify

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `ChatAssistant` (Task 1).
- Produces: the widget rendered once on every authenticated page.

- [ ] **Step 1: Mount the widget**

In `frontend/src/components/Layout.tsx`:
- Import it: `import ChatAssistant from './ChatAssistant'`.
- Wrap the returned shell in a fragment and render the widget after it (mirrors the branch diff):

```tsx
return (
  <>
    <div style={{ display: 'flex', height: '100vh', /* …existing… */ }}>
      {/* …existing sidebar + main… */}
    </div>
    <ChatAssistant />
  </>
)
```

Do **not** copy the branch's icon-relocation churn — this branch's `Layout.tsx` already defines its icons. Only add the import, the fragment wrapper, and the `<ChatAssistant />` line.

- [ ] **Step 2: Type-check and unit tests**

Run: `pnpm --filter @pharmassist/frontend exec tsc --noEmit && pnpm --filter @pharmassist/frontend test`
Expected: no type errors; all existing unit tests pass.

- [ ] **Step 3: Browser verification**

Using the browser preview workflow: log in, confirm the floating chat button appears bottom-corner on every page, opens the panel, accepts a message, shows a mock reply, supports new conversation / sidebar / copy / delete, and does **not** issue any network request when messaging (check the network tab — proof it is frontend-only).

Capture a screenshot of the open chat with a mock exchange as proof.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat(frontend): mount chat assistant in the app shell"
```

---

## Self-Review

**Spec coverage:** Chatbot = frontend-only port, mounted in `Layout`, mock retained, no backend (spec §4). Tasks 1–2. ✓

**Placeholder scan:** No vague steps; the one reconciliation step enumerates exactly what to check/strip. ✓

**Type consistency:** Widget is propless and self-contained; the only external touchpoint is the `<ChatAssistant />` mount in `Layout`. ✓
