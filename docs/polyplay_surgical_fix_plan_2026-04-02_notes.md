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
**Current active task:** 15. Desktop Safari import-state brick + pre-audio video-art failure

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
  - The row-only bug appears after aura is added because `.trackRow.rowAuraGlow > *` applies `position: relative` to every direct child, which includes the `BorderTrail` layer.
  - That means the perimeter layer loses its intended absolute positioning only on aura rows, which explains the detached partial line artifact in live QA.
  - This is a row-specific stacking/positioning bug triggered by aura-state CSS, not a global geometry problem.
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

### 7. Screenshot follow-up cleanup
**Status:** fix implemented, awaiting QA

**Goal:**
Address the latest screenshot-driven UI bugs without widening into a broad redesign pass.

**Observed behavior:**
- aura rows can still show a detached now-playing perimeter artifact
- fullscreen elapsed seek color still reads gold/orange instead of the user-selected aura color
- Manage Storage only allows title rename, but needs separate editable title and artist fields

**Expected behavior:**
- aura rows should keep the clean now-playing perimeter with no detached edge artifact
- elapsed seek styling should read in the active aura color instead of amber/gold
- Manage Storage should let the user edit title and artist independently in one compact row editor

**Likely files:**
- `src/index.css`
- `src/components/player.css`
- `src/admin/AdminApp.tsx`
- `src/lib/db.ts`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/index.css`
  - `src/components/player.css`
  - `src/admin/AdminApp.tsx`
  - `src/lib/db.ts`
- Suspected root cause:
  - The aura row bug is caused by aura-row CSS forcing `position: relative` onto every direct child, which incorrectly affects the absolute-positioned border trail layer.
  - The elapsed seek color is still inheriting theme-primary / loop-gold styling from `player.css` instead of reading from `--aura-rgb`.
  - Manage Storage already has a rename path, but it only carries `title`, so the narrowest safe change is to widen that existing path to title + artist rather than building a new editor flow.
- Exact fix made:
  - Kept the aura-row child layering fix narrow by excluding `.track-border-trail` from the aura-row direct-child positioning rule, so the active perimeter can stay absolutely positioned after aura is added.
  - Switched the seek/progress accent path in `player.css` from amber/gold styling to `--aura-rgb`, including the loop-progress fill/marker treatment and loop-active mini-player thumb styling.
  - Widened Manage Storage’s existing rename flow so the inline editor now saves both title and artist through one DB update path, and shows the current artist under the title in read mode.
- Files changed:
  - `src/index.css`
  - `src/components/player.css`
  - `src/admin/AdminApp.tsx`
  - `src/lib/db.ts`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. The CSS changes are narrow, but the seek accent now follows aura color across player surfaces, and the storage rename flow now updates artist as well as title.
- QA still needed:
  - Confirm active aura rows no longer show the detached perimeter artifact.
  - Confirm fullscreen and mini-player elapsed seek styling now read in the active aura color instead of amber/gold.
  - Confirm Manage Storage lets the user edit title and artist independently, save both, and see the updated values immediately.
  - Confirm leaving artist blank clears artist text cleanly without breaking row layout elsewhere.

---

### 8. Logo / import / highlight follow-up
**Status:** fix implemented, awaiting QA

**Goal:**
Handle the latest polish/follow-up items without widening into unrelated layout changes.

**Observed behavior:**
- the active-track border still needs a brighter glowing head with a softer, less detectable cutoff
- the import-page “Keep me on Import page” control reads too small
- on iOS, tapping the PolyPlay logo shows a black flash before the sparkle
- aura increases should also kick the logo sparkle with an extra aura-colored accent

**Likely files:**
- `src/components/BorderTrail.tsx`
- `styles.css`
- `src/admin/AdminApp.tsx`
- `src/App.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/BorderTrail.tsx`
  - `styles.css`
  - `src/admin/AdminApp.tsx`
  - `src/App.tsx`
- Suspected root cause:
  - The current perimeter still only has a base stroke plus one moving segment, so it lacks a clearly brighter leading head and long blended falloff.
  - The import-page checkbox row is still using compact utility sizing even though it is an important persistent-flow control.
  - The iOS logo flash is most likely Safari tap highlight/compositing on the logo button rather than the sparkle particles themselves.
  - Aura increases already flow through `handleAuraUp`, so the narrowest safe way to add aura-colored logo sparkle is to reuse the existing logo sparkle system from there instead of adding a second independent effect path.
- Exact fix made:
  - Upgraded the perimeter trail from base + one segment to base + long tail + brighter head on the same exact SVG path, so the line reads as one continuous stream with a hotter leading head and softer cutoff.
  - Increased the import-page `Import` button and `Keep me on Import page` control sizing for better prominence and tap comfort.
  - Removed iOS tap-highlight/compositing flash on the top logo button and made the logo sparkle system reusable from non-click triggers.
  - Added an aura-logo sparkle trigger so any aura increase now kicks the logo sparkle with an additional stronger aura-colored burst.
- Files changed:
  - `src/components/BorderTrail.tsx`
  - `styles.css`
  - `src/admin/AdminApp.tsx`
  - `src/App.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. The border-trail change adds one more SVG stroke layer, and the logo sparkle path now responds to aura events in addition to direct logo taps.
- QA still needed:
  - Confirm the border now reads as one lit perimeter with a brighter glowing head and no visible hard cutoff.
  - Confirm the import-page checkbox and button feel larger and clearer on desktop and iOS.
  - Confirm iOS logo tap no longer shows a black flash before the sparkle.
  - Confirm any aura increase triggers the logo sparkle, including row, mini-player, and fullscreen aura buttons.
  - Confirm the added aura-colored logo burst still feels lightweight and does not spam when aura is tapped repeatedly.
- Follow-up tuning note — 2026-04-02 Codex:
  - Live QA still shows a visible hard cutoff in the moving border cycle.
  - Likely cause is the contrast jump between the short bright head and the darker tail.
  - Narrow next pass: keep the same geometry/path, but lengthen the moving tail and reduce the head/tail contrast so the cycle reads more like one continuous LED strip glow.
- Follow-up tuning fix — 2026-04-02 Codex:
  - Increased the always-lit base slightly, lengthened and brightened the moving tail, and softened the head width/opacity so the cycle blends more gradually.
  - Kept the same measured SVG path and same three-layer structure; this was strictly a contrast/gradient tuning pass in `styles.css`.
- Follow-up glow request — 2026-04-02 Codex:
  - Added a lightweight aura-colored overall strobe to the active perimeter layer, patterned after the existing hint pulse timing but scoped to the border-trail container.
  - Kept it CSS-only and tied to the existing active perimeter element so it does not introduce a new geometry system or extra JS.
- Follow-up blend request — 2026-04-02 Codex:
  - Live QA still wants a brighter moving line with no readable front/back cutoff.
  - Narrow next pass: increase the lit band brightness while bringing the head/tail lengths closer together so the motion reads as one seamless gradient band rather than separate segments.
- Fullscreen title typography pass — 2026-04-02 Codex:
  - Live QA still shows the fullscreen title reading too close to a black/heavy weight.
  - Narrow fix: lower the fullscreen title weight and add a slight spacing/size refinement in the title rule only, with no layout changes.

---

### 9. Default auto-art palette correction
**Status:** fix implemented, awaiting QA

**Goal:**
Correct the default/factory-theme auto-generated artwork so it stays in the intended purple family instead of drifting pink.

**Observed behavior:**
- fallback auto art on the default factory theme is showing an ugly pink waveform result
- this is most visible on tracks using generated waveform artwork instead of imported art

**Likely files:**
- `src/lib/artwork/waveformArtwork.ts`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/lib/artwork/waveformArtwork.ts`
- Suspected root cause:
  - The default/factory waveform palette still hard-codes a cyan-to-purple-to-pink waveform gradient.
  - Specifically, the default `barBottom` is pink, so the fallback art is behaving as coded but no longer matches the intended default theme look.
  - This is a palette bug in the default auto-art generator, not a metadata/import precedence issue.
- Exact fix made:
  - Changed only the default/factory waveform auto-art palette from a cyan-to-purple-to-pink bar gradient to a white-lavender-purple gradient.
  - Kept the default background/glow structure intact and left light/custom theme palettes unchanged.
- Files changed:
  - `src/lib/artwork/waveformArtwork.ts`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is a palette-only change scoped to default-theme generated fallback artwork.
- QA still needed:
  - Generate fallback auto art on the default/factory theme and confirm it now reads purple instead of pink.
  - Confirm light theme auto art is unchanged.
  - Confirm custom crimson/teal/amber auto art palettes are unchanged.

---

### 10. Playlist prev/next nav buttons
**Status:** fix implemented, awaiting QA

**Goal:**
Add narrow previous/next playlist buttons beside the current playlist dropdown and the purple `New` button.

**Observed behavior:**
- current header only exposes the playlist dropdown plus `New`
- user wants adjacent previous/next buttons for faster playlist stepping

**Likely files:**
- `src/App.tsx`
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/App.tsx`
  - `styles.css`
  - `src/lib/db.ts`
  - `src/lib/storage/library.ts`
- Suspected root cause:
  - The playlist header currently renders the dropdown from `Object.values(runtimeLibrary.playlistsById)` and switches playlists through `setActivePlaylist(...)`, but there are no adjacent navigation controls.
  - There is no separate stored playlist-order array in current app state; the narrowest correct order source is the same ordered array already used by the dropdown render.
  - Existing edge-swipe playlist navigation uses `Object.keys(...)`, but that is a separate path and not the right thing to widen here for this task.
- Exact fix made:
  - Added `<` and `>` playlist navigation buttons between the dropdown and the purple `New` button.
  - Wired those buttons to the same `orderedPlaylists` array used by the dropdown render and the existing `setActivePlaylist(...)` switch path.
  - Disabled prev/next cleanly at the first/last playlist with a greyed-out variant of the existing playlist action styling.
- Files changed:
  - `src/App.tsx`
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is a narrow header UI change that reuses existing playlist switching logic and the dropdown’s own render order.
- QA still needed:
  - Confirm `<` moves to the previous playlist and `>` moves to the next playlist.
  - Confirm the left button is disabled on the first playlist and the right button is disabled on the last playlist.
  - Confirm button order is `dropdown`, `<`, `>`, `New`.
  - Confirm mobile layout still feels clean and the buttons do not wrap awkwardly in common widths.
- Follow-up interaction note — 2026-04-02 Codex:
  - Successful prev/next playlist navigation should feel more affirmative.
  - Narrow next pass: reuse existing aura-feedback systems so a successful nav click triggers the canvas flash, logo sparkle, and a local nav-button burst without changing playlist logic.
- Follow-up interaction fix — 2026-04-02 Codex:
  - Successful prev/next nav now composes the existing aura-feedback family: canvas flash via `triggerEdgeSwipeFlash()`, logo sparkle via the existing logo helper, a centered safe-tap sparkle burst, and a local button burst animation.
  - Disabled buttons remain inert and do not trigger the effects.
- Follow-up nav-flash correction — 2026-04-02 Codex:
  - Live QA shows the wrong canvas flash path was reused: nav clicks are triggering the large edge-swipe side rails.
  - Narrow correction: keep the button burst/logo sparkle/sparkle burst, but swap the nav success flash to a dedicated full-canvas aura flash overlay instead of `triggerEdgeSwipeFlash()`.

---

### 11. Import-page aura accent sync
**Status:** fix implemented, awaiting QA

**Goal:**
Make the default purple import-page accents follow the user’s aura color without changing other import states.

**Observed behavior:**
- the import page dropzones and import button still use the old default purple
- user wants those default accents to match the selected aura color on the current theme
- loaded/armed states and unrelated colors should stay unchanged

**Likely files:**
- `styles.css`
- `src/index.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
  - `src/index.css`
  - `src/components/button.tsx`
- Suspected root cause:
  - The import dropzones use hard-coded purple values in `.transfer-lane__zone` and related hover/drag-over styling.
  - The import button inherits the shared primary-button purple gradient, and the narrowest safe override is a page-specific `.admin-upload-submit` accent override rather than changing all primary buttons globally.
  - The gold `admin-action-armed` state should remain untouched.
- Exact fix made:
  - Replaced the default import dropzone purple border/glow/background accents with aura-color-driven values using `--aura-rgb`.
  - Added a page-specific override for `.admin-upload-submit:not(.admin-action-armed)` so the default import button follows the aura color without changing the armed gold state or other primary buttons.
- Files changed:
  - `styles.css`
  - `src/index.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is a styling-only change scoped to the import page’s default dropzone/button accents.
- QA still needed:
  - Confirm the default import dropzones follow the current aura color.
  - Confirm the default import button follows the current aura color.
  - Confirm loaded/armed states remain gold and unchanged.
  - Confirm other purple primary buttons elsewhere in the app are unchanged.

---

### 12. Add 3 custom themes
**Status:** fix implemented, awaiting QA

**Goal:**
Add `Merica`, `MX`, and `Rasta` as new custom themes and wire them into both the runtime theme cycle and the admin theme select.

**Desired behavior:**
- new themes appear in the theme cycle button
- the same themes appear in the admin theme select
- aura color for each theme matches the provided value exactly
- existing theme behavior and persisted theme selection continue to work

**Likely files:**
- `src/App.tsx`
- `src/admin/AdminApp.tsx`
- `src/lib/backup.ts`
- `styles.css`
- `src/index.css`
- `src/components/player.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
  - `src/lib/backup.ts`
  - `styles.css`
  - `src/index.css`
  - `src/components/player.css`
- Current theme plumbing:
  - Theme source of truth currently lives mostly in `src/App.tsx`, where custom theme slot names, cycle order, aura mapping, runtime selection labels, and body class toggles are hardcoded.
  - The same custom-theme slot list and aura mapping are duplicated in `src/admin/AdminApp.tsx` for the admin theme select and parent-frame theme messaging.
  - Backup import/export support independently hardcodes the allowed custom theme slots in `src/lib/backup.ts`, so new slots currently would not round-trip through config backups without widening that parser.
  - CSS slot rendering already follows one stable pattern through `html[data-theme="custom"][data-theme-slot="..."]` and `body.theme-custom.theme-custom-...` selectors in `styles.css`, `src/index.css`, and `src/components/player.css`.
  - Current cycle order is controlled by a hardcoded `order` array in `src/App.tsx`.
  - Current admin theme options are controlled by a hardcoded `ThemeSelection` union and `<select>` guard logic in `src/admin/AdminApp.tsx`.
  - Current aura mapping is controlled by duplicated `THEME_PACK_AURA_COLORS` constants in both `src/App.tsx` and `src/admin/AdminApp.tsx`.
  - Current backup import/export support is controlled by the `customThemeSlot` type plus `asCustomThemeSlot(...)` in `src/lib/backup.ts`.
- Narrow implementation plan:
  - Add one shared theme-definition source for custom theme slot names, display labels, cycle order, and exact aura mapping.
  - Update `src/App.tsx`, `src/admin/AdminApp.tsx`, and `src/lib/backup.ts` to consume that shared source instead of separate hardcoded slot lists.
  - Extend the existing CSS slot pattern for `merica`, `mx`, and `rasta` without redesigning the theme architecture.
- Exact fix made:
  - Added a shared theme-definition source in `src/lib/themeConfig.ts` for custom theme slot names, display labels, cycle order, aura mapping, and slot parsing/validation helpers.
  - Updated `src/App.tsx` so the runtime theme cycle, saved-slot validation, theme labels, and body class toggles all use that shared source.
  - Updated `src/admin/AdminApp.tsx` so the admin theme select options, saved-slot validation, parent-frame theme messaging, and status text all use the same shared source.
  - Updated `src/lib/backup.ts` so config import/export accepts and round-trips the new custom theme slots through the same parser instead of a separate hardcoded three-slot union.
  - Extended the existing custom-theme CSS slot pattern in `styles.css`, `src/index.css`, and `src/components/player.css` for `merica`, `mx`, and `rasta`.
- Theme plumbing note:
  - Theme source of truth now lives in `src/lib/themeConfig.ts`.
  - Runtime cycle order is driven by `THEME_SELECTION_ORDER`.
  - Admin theme options are rendered from `THEME_SELECTION_ORDER`.
  - Aura mapping is driven by `THEME_PACK_AURA_COLORS`.
  - Backup slot support is driven by `parseCustomThemeSlot(...)`.
  - CSS rendering still uses the existing `data-theme-slot` / `theme-custom-*` slot architecture.
- Final cycle order:
  - `dark`
  - `light`
  - `amber`
  - `teal`
  - `crimson`
  - `merica`
  - `mx`
  - `rasta`
- Aura mapping:
  - `merica` → `#B31942`
  - `mx` → `#FFFFFF`
  - `rasta` → `#FCDD09`
  - existing `crimson`, `teal`, and `amber` mappings are unchanged
- Files changed:
  - `src/lib/themeConfig.ts`
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
  - `src/lib/backup.ts`
  - `styles.css`
  - `src/index.css`
  - `src/components/player.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Backup compatibility implications:
  - No migration was required.
  - Existing saved `crimson`, `teal`, and `amber` custom theme slots remain valid and unchanged.
  - New backups can now store and restore `merica`, `mx`, and `rasta` through the same config field.
- Regression risk:
  - Low to medium. The behavioral change is narrow and centralized, but theme styling spans runtime surfaces, admin theme selection, and backup round-tripping.
- QA still needed:
  - Confirm the cycle button walks through the full order above and preserves existing behavior for `dark`, `light`, `amber`, `teal`, and `crimson`.
  - Confirm the admin theme select shows all eight options in the same order.
  - Confirm `merica`, `mx`, and `rasta` each apply the expected aura color exactly.
  - Confirm existing saved `crimson`, `teal`, and `amber` preferences still load correctly after refresh.
  - Confirm config backup export/import preserves the selected custom theme for both old and new slots.
- Follow-up theme tuning note — 2026-04-02 Codex:
  - Live QA shows `merica`, `mx`, and `rasta` still read too close to single-color themes in the main UI, especially in the body background and hero bar.
  - Narrow follow-up: keep the same theme architecture and slot mapping, but retune only the body/topbar background layers so those three themes visibly blend all three provided colors instead of one dominant tone.
- Follow-up exact fix made:
  - Retuned only the `body.theme-custom.theme-custom-merica|mx|rasta` and matching `.topbar` background layers in `styles.css`.
  - Each of those three themes now uses a tricolor gradient blend across the main UI background and hero bar while preserving the rest of the slot styling.
- Follow-up files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Follow-up regression risk:
  - Low. This is a background-layer tuning pass limited to the three new themes.
- Follow-up QA still needed:
  - Confirm `merica` reads as blue / white / red across the main background and hero bar.
  - Confirm `mx` reads as green / white / red across the main background and hero bar.
  - Confirm `rasta` reads as green / yellow / red across the main background and hero bar.
  - Confirm contrast/readability of header controls and hero logo remains acceptable on all three.
- Follow-up FX diagnosis note — 2026-04-02 Codex:
  - The new themes now render as tricolor backgrounds, but the richer FX layers still mostly derive from a single aura/accent color path.
  - `src/fx/ambientFxEngine.ts` currently resolves only `accentRgb` and `auraRgb`, so canvas bubbles/splatter cannot express a proper three-color theme gradient.
  - `src/lib/bubbles.ts` still uses a hardcoded purple/pink/blue/amber hue distribution, which means CSS bubble layers are not theme-aware enough for `merica`, `mx`, or `rasta`.
  - `.pp-oracle-orb` in `styles.css` is also still using a fixed purple/pink orb recipe instead of theme-derived palette colors.
  - Narrow fix path: add explicit FX palette CSS variables for the three new themes, feed those into the ambient FX engine and bubble spawn path, and retune only bubbles / paint / orb surfaces to use that palette while leaving aura mapping unchanged.
- Follow-up FX exact fix made:
  - Added explicit `--fx-color-1-rgb`, `--fx-color-2-rgb`, and `--fx-color-3-rgb` CSS variables and mapped them for `merica`, `mx`, and `rasta` in `styles.css`.
  - Updated `src/fx/ambientFxEngine.ts` so canvas bubbles and splatter now read that three-color FX palette from CSS and render gradients from the palette instead of relying only on a single aura/accent hue path.
  - Updated `src/lib/bubbles.ts` and `src/components/BubbleLayer.tsx` so spawned bubble hues now derive from the active theme FX palette instead of the old hardcoded purple/pink distribution.
  - Updated the PolyOracle orb and CSS bubble gradients in `styles.css` to use the same theme FX palette variables.
- Follow-up FX files changed:
  - `styles.css`
  - `src/fx/ambientFxEngine.ts`
  - `src/lib/bubbles.ts`
  - `src/components/BubbleLayer.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Follow-up FX gradient mapping:
  - `merica`
    - FX color 1: blue `#0A3161`
    - FX color 2: white `#FFFFFF`
    - FX color 3: red `#B31942`
  - `mx`
    - FX color 1: green `#006341`
    - FX color 2: white `#FFFFFF`
    - FX color 3: red `#C8102E`
  - `rasta`
    - FX color 1: green `#078930`
    - FX color 2: yellow `#FCDD09`
    - FX color 3: red `#DA121A`
- Follow-up FX aura note:
  - Aura mapping remained unchanged.
  - The existing exact aura values for `merica`, `mx`, and `rasta` are still used anywhere aura color itself is the intended source.
- Follow-up FX regression risk:
  - Low to medium. The pass is limited to FX color rendering, but it touches both canvas FX and the CSS bubble/orb layer.
- Follow-up FX QA still needed:
  - Confirm `merica` FX reads as blue / white / red instead of mostly red aura.
  - Confirm `mx` FX reads as green / white / red instead of mostly white aura.
  - Confirm `rasta` FX reads as green / yellow / red instead of mostly yellow aura.
  - Confirm orb, bubbles, and splatter/paint all feel richer without hurting readability or looking noisy.
  - Confirm older themes still look unchanged.

---

### 13. Loop zoom-to-fit button
**Status:** fix implemented, awaiting QA

**Goal:**
Add a small manual zoom-to-fit helper in loop editing that neatly fits the active loop inside the waveform viewport.

**Desired behavior:**
- the button centers the active loop region in the current waveform viewport
- fit includes about 5% buffer before the start marker and after the end marker
- it is a manual helper, not an automatic zoom jump
- it does not fight the current manual zoom controls or loop refinement flow

**Likely files:**
- `src/components/WaveformLoop.tsx`
- possibly `src/components/player.css` or `styles.css` for the toolbar button only

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/WaveformLoop.tsx`
- Suspected root cause / integration note:
  - `WaveformLoop` already owns the editing viewport state via `viewRange`, `editingViewRangeRef`, and `manualZoomLevel`, so the safest place for zoom-to-fit is inside that component’s existing loop toolbar.
  - The fit action should preserve the current editing session and marker state; it only needs to replace the editing viewport with a neatly centered fitted range.
  - The 5% buffer should be computed from the current loop span, not from full track duration, so the helper remains useful for short loops.
  - To avoid fighting the existing `+/-` zoom controls, the fit action should explicitly update the editing viewport refs and reset manual zoom level back to the base fitted state rather than introducing a second competing zoom mode.
- Exact fix made:
  - Added a small manual fit button to the existing loop zoom toolbar in `src/components/WaveformLoop.tsx`.
  - The fit action keeps the current loop editing session and marker positions intact, but replaces the editing viewport with a centered fitted range.
  - The fitted range uses the active loop span plus a 5% buffer on each side, with the existing minimum readable span guard still applied.
  - The helper resets `manualZoomLevel` back to `0` when used, so it returns the editor to the base fitted view without fighting the existing `+/-` manual zoom path.
- Files changed:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Exact fit behavior used:
  - centered on the current loop region
  - uses a target span of `loopSpan * 1.1`
  - clamps through the existing `centerRangeOnLoop(...)` helper and `MIN_MANUAL_VIEW_SPAN_SEC`
- How the 5% buffer was computed:
  - buffer is based on loop span, not track span
  - 5% before the start marker and 5% after the end marker
  - total fit span = `loopSpan + 10%`
- Zoom-controls preservation note:
  - existing `+/-` zoom controls were preserved unchanged
  - zoom-to-fit only updates the same editing viewport state they already use
  - it does not change loop editing mode or marker state
- Regression risk:
  - Low. The change is isolated to the loop-editor toolbar and existing viewport state inside `WaveformLoop`.
- QA still needed:
  - Confirm the fit button recenters the current loop cleanly inside the waveform viewport.
  - Confirm there is visible breathing room before and after the loop, roughly 5% of loop span each side.
  - Confirm pressing fit does not exit editing mode or move the markers.
- Confirm `+/-` zoom controls still work before and after using fit.
- Confirm very short loops still remain readable because the minimum span guard is still respected.

---

### 14. Support page background artifact cleanup
**Status:** fix implemented, awaiting QA

**Goal:**
Remove the weird drifting/falling background artifact on the support page while keeping the page polished and calm.

**Desired behavior:**
- support page background should feel clean and stable
- no drifting sprite, falling shape, or unintended moving background artifact
- keep the page visually polished without redesigning it

**Likely files:**
- `public/support.html`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `public/support.html`
- Suspected root cause:
  - The support page still had multiple animated decorative overlay layers in `public/support.html`, especially `.support-shell::before`, `.support-shell::after`, and `.support-panel::after`.
  - Those layers use the `scroll` and `move` keyframes, so instead of reading as subtle polish they can register as a drifting/falling sprite while the page scrolls.
  - The page also had floating hero orb animation, which added more perceived background movement than the support page needs.
- Exact fix made:
  - Kept the support page decorative layers, but removed the background motion from the support shell, support panel overlay, and hero orbs so the page now reads as static and calm.
  - Left the underlying gradients and glow treatment in place, so the support page still feels polished without the unintended moving artifact.
- Files changed:
  - `public/support.html`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to support-page decorative animation and does not touch support content, layout, or form behavior.
- QA still needed:
  - Confirm the drifting/falling background artifact is gone on desktop Safari.
- Confirm the support page still feels polished, not flat.
- Confirm support form, policy links, and close/back behavior are unchanged.

---

### 15. Desktop Safari import-state brick + pre-audio video-art failure
**Status:** fix implemented, awaiting QA

**Goal:**
Diagnose the Safari release-blocking import/admin state failures without widening into unrelated UI work.

**Observed behavior:**
- after factory reset on desktop Safari:
  - user uses playlist nav
  - clicks `New`
  - names playlist and confirms
  - clicks `Import`
  - screen flickers and the site becomes effectively bricked, including loss of access to admin
- if user selects video artwork before selecting audio, the artwork does not work

**Likely files:**
- `src/App.tsx`
- `src/admin/AdminApp.tsx`
- `src/lib/db.ts`
- `src/lib/playlistState.ts`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
  - `src/lib/db.ts`
  - `src/lib/playlistState.ts`
- Suspected root cause:
  - The video-art-before-audio bug is explicit in the current upload flow: `onPickUploadArtwork(...)` in `src/admin/AdminApp.tsx` clears the artwork and exits early whenever `uploadAudio` is empty, so the current import draft is intentionally audio-first and will not arm artwork ahead of audio.
  - The Safari “New playlist → Import → flicker / brick” issue does not look like the new prev/next playlist buttons themselves; those buttons only call the existing `setActivePlaylist(...)` path in `src/App.tsx`.
  - The more likely failure point is the upload/admin render-state path immediately after creating a brand-new empty active playlist. The main app opens the admin iframe in upload mode from a no-tracks / onboarding state, while the import flow and related UI still assume an audio-first draft with a valid active playlist context.
  - Safari is likely exposing a timing/state issue in that parent/iframe import-open sequence, not a playlist-order bug. The two bugs appear related by the same broader assumption: the import flow is built around “audio first, then everything else,” and behaves poorly when the surrounding playlist/import state is still empty or transitional.
- Follow-up diagnosis note:
  - The hardening pass should stay in the parent app / admin boundary and the upload draft setup path only.
- Exact fix made:
  - In `src/App.tsx`, added a narrow parent-side guard so the upload/settings iframe will not open while playlist creation or playlist switching is still in flight.
  - If the user clicks `Import` during that transition window, the requested admin mode is queued and then opened on the next frame after the playlist transition settles. This hardens the Safari `New playlist -> immediate Import` sequence without changing playlist ordering logic.
  - In `src/admin/AdminApp.tsx`, removed the silent artwork clear on pre-audio artwork selection.
  - Manual still image and video artwork can now be selected before audio and remain armed when the user picks audio afterward.
  - The later audio-pick reset path now preserves preselected manual artwork for the specific `art first, audio second` flow, while metadata autofill still clears and rebuilds its own text state normally.
  - If artwork is selected before audio, the UI now shows a visible status message telling the user that artwork is ready and audio is still needed.
- Files changed:
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium.
  - The Safari fix is intentionally narrow, but it changes the timing of when the settings/upload iframe opens after playlist transitions.
  - The art-first change is narrow too, but it changes draft-preservation behavior for manual artwork during audio selection.
- QA still needed:
  - Create a new empty playlist and immediately click `Import`; confirm Safari does not flicker/brick and the upload panel opens normally.
  - Open `Import` from an existing playlist and confirm behavior is unchanged.
  - Select video artwork first, then audio; confirm the artwork stays armed and imports correctly.
  - Select still image artwork first, then audio; confirm the artwork stays armed and imports correctly.
  - Confirm no silent clearing happens when artwork is selected before audio.
  - Confirm metadata-derived artwork still behaves normally when audio is selected first.

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
- Fullscreen:
  - title font weight looks too heavy / too close to a black weight and clashes with the rest of the fullscreen typography

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
