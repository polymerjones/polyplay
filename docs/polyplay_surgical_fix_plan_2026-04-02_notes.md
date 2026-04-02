# PolyPlay Surgical Fix Plan — 2026-04-02 Notes Dump

## Purpose
Use this file as the active Codex control sheet for today’s fixes.

Goals:
- keep Codex organized
- keep fixes surgical
- preserve context
- avoid drifting into broad mixed passes
- document exactly what is being worked on before code changes

## Operating rules for Codex
1. Read this file first before touching code.
2. Work only on the single active numbered task unless explicitly told to move on.
3. Before editing code, add a short note under the task:
   - diagnosis start
   - files inspected
   - suspected root cause
4. After editing code, update the same task with:
   - exact fix made
   - files changed
   - regression risk
   - QA still needed
5. Do not auto-commit unless explicitly asked.
6. Keep commits narrow and task-specific.
7. If a task turns out bigger than expected, stop and propose a narrower subtask instead of sprawling.
8. Typecheck before closing any implementation pass.

## Status legend
- open
- diagnosis in progress
- fix implemented, awaiting QA
- verified
- blocked

## Active task
**Current active task:** 6. Sloppy / vibed-coded code audit

---

## Numbered tasks

### 1. Row now-playing highlight bug
**Status:** fix implemented, awaiting QA

**Goal:**
Fix the weird row highlight behavior while preserving the now-playing perimeter effect that otherwise feels good.

**Observed behavior:**
- now-playing highlight is working well overall
- rows still show a weird bug/artifact (see screenshot)
- row treatment needs cleanup without breaking the good parts of the effect
- additional note from live QA: the row highlight bug appears after the user has added aura

**Expected behavior:**
- row highlight should feel clean, edge-bound, and visually stable
- no weird stray shape/artifact
- preserve the positive feel of the new highlight treatment

**Likely files:**
- `src/components/TrackRow.tsx`
- `src/components/BorderTrail.tsx`
- `styles.css`
- `src/index.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/TrackRow.tsx`
  - `src/components/BorderTrail.tsx`
  - `src/index.css`
  - `styles.css`
- Suspected root cause:
  - The row-only bug appears after aura is added because rows with aura already render their own border/glow treatment (`rowAuraGlow` plus `rowAuraGlow::before`).
  - The active now-playing perimeter trail then draws on top of that same edge, so the row can show a conflicting second edge/artifact once aura styling is present.
  - This looks like a row-specific layer conflict between aura edge treatment and the active border trail, not a global geometry problem.
- Exact fix made:
  - Added a row-only CSS override so aura rows that are actively playing no longer paint their own border edge under the now-playing perimeter trail.
  - Kept the broader aura glow, but made the active perimeter trail the single authoritative edge for aura rows.
- Files changed:
  - `src/index.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. The fix is limited to aura rows in the active playing state.
- QA still needed:
  - Confirm the row artifact is gone for active rows after aura has been added.
  - Confirm non-aura rows are unchanged.
  - Confirm aura rows still retain their glow treatment while active.
  - Confirm tile highlight behavior is unchanged.

---

### 2. Loop refinement auto-zoom regression
**Status:** fix implemented, awaiting QA

**Goal:**
Stop loop refinement from zooming way out when user drags loop markers.

**Observed behavior:**
- user created a loop and tried to refine it without using magnifying glass
- when grabbing the end marker and bringing it closer to the start marker, the waveform zoomed out massively
- this made refinement difficult and annoying
- this also occurred while using zoom controls
- user tried to move a marker and the waveform zoomed way out, making refinement nearly impossible

**Expected behavior:**
- there should never be drastic zoom-outs when user is moving loop markers
- refinement should preserve the current view/zoom context
- moving markers should feel controlled and local, not like a full viewport reset

**Likely files:**
- `src/components/WaveformLoop.tsx`
- `src/components/FullscreenPlayer.tsx`
- `src/components/PlayerControls.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/WaveformLoop.tsx`
  - `src/App.tsx`
- Suspected root cause:
  - `WaveformLoop` only locks the current viewport span while an active marker drag is underway via `dragViewSpanRef`.
  - As soon as that lock is absent, the editing effect falls back to auto-windowing from the current loop bounds, which can recompute a much wider range than the user was refining inside.
  - That means marker moves can still trigger a zoom-out even after manual zoom has been set, because the refinement session does not keep one authoritative editing viewport span from the moment editing starts through subsequent marker adjustments.
- Exact fix made:
  - Replaced the refinement-session fallback-to-auto-window behavior with an editing-scoped preserved viewport in `src/components/WaveformLoop.tsx`.
  - The loop editor now keeps one editing view range for the whole refinement session and only shifts that range enough to keep the loop markers visible, instead of recomputing a fresh wider auto-window while editing.
  - Manual zoom buttons now update that preserved editing range directly, so zoom adjustments continue to work without letting the next marker drag reset the viewport.
- Files changed:
  - `src/components/WaveformLoop.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. The fix is surgical and isolated to loop-editor viewport behavior, but it changes how the editing viewport is maintained across drag and zoom interactions.
- QA still needed:
  - Drag end marker closer to start marker without using zoom controls and confirm no massive zoom-out occurs.
  - Use `+/-` zoom controls, then drag either marker and confirm the chosen zoom context is preserved.
  - Check both fullscreen and inline loop editing for the same behavior.
  - Confirm exiting loop editing still restores normal non-editing auto-window behavior.
  - Confirm very small loops near track start or end stay visible without jumping.

---

### 3. Fullscreen accidental exit during loop editing
**Status:** fix implemented, awaiting QA

**Goal:**
Prevent accidental fullscreen exit while user is trying to drag loop markers.

**Observed behavior:**
- user accidentally exited fullscreen mode while trying to move a marker
- most likely a gesture interrupting loop editing

**Expected behavior:**
- loop-marker interaction should not accidentally trigger fullscreen-dismiss gestures
- loop editing should feel protected from accidental exit

**Likely files:**
- `src/components/FullscreenPlayer.tsx`
- `src/components/WaveformLoop.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/FullscreenPlayer.tsx`
  - `src/components/WaveformLoop.tsx`
- Suspected root cause:
  - Fullscreen shell dismiss gestures are still active during loop editing.
  - There is already loop-drag suppression in `FullscreenPlayer`, but it only fully engages once a drag is active and does not broadly protect the editing session itself.
  - That leaves a gap where swipe-dismiss or shell-level outside-dismiss behavior can still fire while the user is trying to manipulate loop markers.
- Exact fix made:
  - Added a narrow fullscreen dismiss guard in `src/components/FullscreenPlayer.tsx` so gesture-based and shell-level outside dismiss paths are blocked while `loopRegion.editing` is true.
  - Existing explicit close buttons are unchanged, so the user can still intentionally exit fullscreen.
- Files changed:
  - `src/components/FullscreenPlayer.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. The change is limited to fullscreen dismiss gating during loop editing and does not alter the explicit close-button path.
- QA still needed:
  - In fullscreen loop editing, drag both loop markers and confirm fullscreen never exits accidentally.
  - Confirm downward swipe / outside-shell dismiss works normally when not editing a loop.
  - Confirm explicit close buttons still exit fullscreen during loop editing.
  - Confirm cinema mode outside-double-tap behavior is unaffected when not editing.

---

### 4. Artist text on rows and playbars
**Status:** fix implemented, awaiting QA

**Goal:**
Show artist text in the right places without cluttering the UI.

**Desired behavior:**
- artist should appear under the title on all playbars under the title text
- artist should appear under the title text on track rows
- artist should stay off tiles for now
- layout should remain clean and not feel cluttered or messy

**Important note:**
- implement carefully to avoid scrambling existing UI or breaking layout

**Likely files:**
- `src/components/TrackRow.tsx`
- `src/components/MiniPlayerBar.tsx`
- `src/components/FullscreenPlayer.tsx`
- possibly `src/App.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/TrackRow.tsx`
  - `src/components/MiniPlayerBar.tsx`
  - `src/components/FullscreenPlayer.tsx`
  - `src/types.ts`
- Suspected root cause:
  - Artist data already exists on `Track`, but these surfaces currently render only title plus secondary utility text.
  - This is a presentation gap, not a data-pipeline issue.
  - Narrowest safe fix is to add one conditional artist line directly under title on rows and playbars only, while leaving tiles untouched.
- Exact fix made:
  - Added a conditional artist line under title on `TrackRow`, `MiniPlayerBar`, and `FullscreenPlayer`.
  - Left tile surfaces unchanged.
  - Reused existing secondary-text styling instead of widening into a layout redesign.
- Files changed:
  - `src/components/TrackRow.tsx`
  - `src/components/MiniPlayerBar.tsx`
  - `src/components/FullscreenPlayer.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
  - `docs/polyplay_qa_checklist_2026-04-02.md`
- Regression risk:
  - Low. The change is text-only and conditional on a non-empty artist value.
- QA still needed:
  - Confirm artist shows under title on rows.
  - Confirm artist shows under title on mini player.
  - Confirm artist shows under title on fullscreen player.
  - Confirm tiles still do not show artist.
  - Confirm long artist names truncate cleanly and tracks without artist do not leave awkward gaps.

---

### 5. Dependency audit
**Status:** verified

**Goal:**
Do a thorough audit of dependencies used in the app for safety, necessity, and cleanup opportunities.

**Questions to answer:**
- what dependencies are currently in use
- which are unused or low-value
- which could be security/maintenance liabilities
- what can be simplified or removed safely

**Likely files:**
- `package.json`
- `package-lock.json`
- import usage across repo

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `package.json`
  - import usage across `src/`
- Early findings:
  - Runtime dependency surface is currently small: `react`, `react-dom`, `@capacitor/core`, `@capacitor/haptics`, and `music-metadata-browser`.
  - All listed runtime dependencies appear to be referenced by source code.
  - Build/dev dependencies also look conventional for a Vite + React + TypeScript app.
- Suspected audit focus:
  - confirm whether any transitive runtime baggage introduced by `music-metadata-browser` deserves special scrutiny
  - confirm whether Tailwind/PostCSS are still truly needed in the current styling setup
  - check for any stale scripts or packages added for one-off work but no longer used
- Audit findings:
  - Direct runtime dependency surface is small and currently justified:
    - `react`
    - `react-dom`
    - `@capacitor/core`
    - `@capacitor/haptics`
    - `music-metadata-browser`
  - `music-metadata-browser` is only used in `src/admin/AdminApp.tsx`, so it is the main candidate for future isolation/lazy-loading if admin bundle size or parser risk becomes a problem.
  - `music-metadata-browser` brings the heaviest transitive baggage in current runtime deps, including `music-metadata`, `buffer`, `readable-stream`, and `readable-web-to-node-stream`.
  - Tailwind/PostCSS/autoprefixer are still active and justified for the current build:
    - `src/index.css` uses `@tailwind` directives
    - `tailwind.config.ts` and `postcss.config.js` are wired into the app
  - `@capacitor/core` is not directly imported in `src/`, but it remains required by the Capacitor runtime/plugin model and by `@capacitor/haptics`.
  - Script surface is small and coherent; no obviously stale npm scripts were found.
  - One caution worth tracking: recent builds emit a Vite warning about `eval` usage inside `node_modules/file-type/core.js`, coming in transitively through the metadata parsing stack.
- Exact result:
  - No dependency removal or replacement is justified from this audit alone.
  - Best future cleanup path, if desired, is to keep `music-metadata-browser` admin-only and consider lazy-loading it rather than replacing it blindly.
- Files changed:
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - None from this audit pass; no runtime/package changes were made.
- QA still needed:
  - None specific for this task beyond normal app smoke testing, because this was an audit-only pass.

---

### 6. Sloppy / vibed-coded code audit
**Status:** verified

**Goal:**
Do a thorough audit of code that may be sloppy, fragile, duplicated, overgrown, or “vibed coded.”

**Focus:**
- fragile logic
- duplicate logic
- overly magical state transitions
- dead code / stale helpers
- hard-to-follow flows
- obvious cleanup opportunities

**Important:**
- this is an audit first, not a massive rewrite

**Likely areas:**
- import/admin pipeline
- loop/fullscreen flow
- visual effect layers
- utility/helpers with overlapping responsibilities

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/admin/AdminApp.tsx`
  - `src/components/WaveformLoop.tsx`
  - `src/components/FullscreenPlayer.tsx`
  - `src/lib/db.ts`
- Audit findings:
  - `src/admin/AdminApp.tsx` is the clearest overgrown hotspot.
    - It mixes import flow, artwork flow, theme settings, playlist management, backup/import-export, gratitude journaling, destructive resets, and modal orchestration in one component.
    - The metadata import path is now working better, but it still depends on many parallel refs (`uploadTitleTouchedRef`, `uploadArtistTouchedRef`, autofill refs, live value refs, artwork refs, request-id refs), which makes the logic harder to reason about and easier to regress.
    - The same component also has multiple distinct media-file flows (`upload`, `selected artwork`, `selected audio`, `transfer lane`) with overlapping helper shapes, which is a maintainability risk.
  - `src/components/WaveformLoop.tsx` is functional but state-heavy and fairly brittle.
    - The viewport system now relies on several interacting concepts: `viewRange`, `manualZoomLevel`, `shouldPreserveViewRange`, `lockedViewRangeRef`, `editingViewRangeRef`, `dragViewSpanRef`, `pendingHandle`, `draggingHandle`, and committed-drag refs.
    - It works as a surgical path, but this is still a “many interlocking flags and refs” design that will be easy to destabilize with future tweaks.
  - `src/components/FullscreenPlayer.tsx` has a similar gesture-state layering problem.
    - Cinema mode, swipe-dismiss, outside-dismiss, loop-gesture suppression, and artwork-mode state are all coordinated inside one component.
    - The recent fixes are narrow, but the component remains susceptible to interaction bugs because gesture responsibilities are spread across several ad hoc guards.
  - `src/lib/db.ts` was not the main fragility source in this pass.
    - It is large, but the recent artwork issues were mostly upstream in import/application logic rather than DB precedence itself.
- Exact result:
  - No code changes were made in this audit pass.
  - Highest-value future refactor target is still `src/admin/AdminApp.tsx`.
  - Best narrow next cleanup subtask would be: extract the import/media metadata flow from `AdminApp` into a dedicated hook or module with a smaller explicit state machine.
- Files changed:
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - None from this audit pass; no runtime behavior changed.
- QA still needed:
  - None specific for this task, since this was diagnosis/audit only.

---

## Suggested execution order
1. Loop refinement auto-zoom regression
2. Fullscreen accidental exit during loop editing
3. Row now-playing highlight cleanup
4. Artist text on rows and playbars
5. Dependency audit
6. Sloppy / vibed-coded code audit

## QA notes inbox
Use this section for quick real-device notes before sorting them into tasks.

- Desktop:
  - row highlight still has a weird bug
  - loop refinement zoomed way out when moving end marker closer to start marker
  - fullscreen accidentally exited during loop editing
- Desktop and iOS:
  - artist should show under title on playbars and rows, but not on tiles

## Commit / staging rules
When a task is done and ready:
- stage only the files for that task
- show `git status --short`
- confirm exact files before commit

Suggested commit format:
- `Fix loop refinement viewport jump`
- `Prevent accidental fullscreen exit during loop editing`
- `Show artist text on playbars and rows`
- `Audit dependencies and cleanup opportunities`

## End-of-day wrap format
At the end of the session, update:
- DONE TODAY
- IMPLEMENTED, AWAITING QA
- STILL OPEN
- RECOMMENDED NEXT SESSION START
