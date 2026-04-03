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
**Current active task:** 35. Theme art-direction recovery pass

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

### 15. New playlist -> Import release blocker — async sequencing hardening
**Status:** fix implemented, awaiting QA

**Goal:**
Harden the async sequencing around playlist creation and immediate Import so the app cannot flicker, brick, or lose admin access after `New playlist -> Import`.

**Observed behavior:**
- `e51d915` is present and working as written
- the remaining bug is not a missing commit/push bug
- after `New playlist` and immediate `Import`, the app can still flicker / brick / lose admin access
- the surviving failure is a sequencing/race bug, not a missing-transition-guard bug

**Likely files:**
- `src/App.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/App.tsx`
  - `src/lib/db.ts`
- Suspected root cause:
  - The direct playlist-transition window is already gated, but `src/App.tsx` still allows uncancelled or overlapping async refresh/reconcile work to apply after that gate clears.
  - `refreshTracks()` mutates runtime library, playlist-required state, track list, and current-track state without a stale-request guard.
  - `createPlaylist()` both writes local playlist state and also triggers overlapping refresh work via a direct `refreshTracks()` call plus a `polyplay:library-updated` dispatch.
  - The global `polyplay:library-updated` listener can launch another `refreshTracks()` while the create/import flow is still settling.
  - The first-run/demo reconcile launched on mount can also land later and overwrite the newer local intent.
  - `openSettingsPanel()` currently waits only for playlist transition and create-modal state, not for the app to be truly settled.
- Exact fix made:
  - In `src/App.tsx`, added a request-sequencing guard for `refreshTracks()` so only the newest refresh run is allowed to apply runtime library, playlist-required, track-list, and current-track mutations.
  - Stale refresh runs now return early before mutating React state, so out-of-order refresh completions are ignored instead of overwriting a newer playlist/import intent.
  - Added a narrow app-settling counter plus a startup-reconcile pending flag so async reconcile/refresh work is explicitly tracked while the app is still settling.
  - `openSettingsPanel()` no longer waits only for playlist transition and modal state; it now queues the requested mode until the app is fully settled, including startup reconcile and in-flight refresh work.
  - Removed the local `polyplay:library-updated` self-dispatches from `createPlaylist()` and `setActivePlaylist()` so those paths no longer fan out into an extra duplicate refresh on top of their direct `refreshTracks()` call.
- Files changed:
  - `src/App.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium.
  - The change is narrow to sequencing and admin-open gating, but it does alter which async refreshes are allowed to commit state and slightly delays settings opening until the app is settled.
- QA still needed:
  - Create a new empty playlist and immediately click `Import`; confirm no flicker/brick/admin lock occurs and upload opens normally.
  - Repeat the same flow on desktop and iOS.
  - Open `Import` from an already-settled existing playlist and confirm behavior is unchanged.
  - Create a playlist, switch playlists rapidly, then open `Import`; confirm stale refreshes do not yank the app back to older state.
  - Confirm startup / first-run demo reconcile still behaves normally on a pristine install.

---

### 16. Manage Storage artist text display
**Status:** verified

**Goal:**
Show artist name under each track title in Settings → Manage Storage without cluttering the row layout.

**Desired behavior:**
- title remains primary
- artist appears directly underneath when present
- no empty placeholder space when artist is missing
- layout stays clean and readable

**Likely files:**
- `src/admin/AdminApp.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/admin/AdminApp.tsx`
  - `src/lib/db.ts`
- Suspected root cause:
  - No missing data pipeline issue. Artist data is already available on the storage rows (`row.artist`) and the manage-storage row renderer already has a conditional secondary line for artist text.
  - The current implementation already matches the requested behavior: title is primary, artist renders directly under it only when present, and missing artist values do not leave placeholder space.
- Exact fix made:
  - No code change was needed in this pass because the Manage Storage view already implements the requested artist-under-title behavior.
- Files changed:
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - None. No runtime code changed.
- QA still needed:
  - Confirm the current Manage Storage rows show artist under title when available.
- Confirm tracks without artist do not leave an empty gap.

---

### 17. Hero panel edge feathering
**Status:** fix implemented, awaiting QA

**Goal:**
Soften the visible rectangular edge around the hero/header panel so it blends into the background more naturally.

**Desired behavior:**
- hero stays readable and structured
- outer rectangle feels softer and more feathered
- no muddy or washed-out look
- no layout redesign

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Suspected root cause:
  - The hard box read comes from the `.topbar` panel using a fairly uniform dark fill plus a compact drop shadow, which makes the rounded rectangle stop abruptly against the page background.
  - The existing decorative glow on `.topbar::before` helps internally, but it does not feather the outer perimeter enough, so the panel still feels pasted on top of the scene.
- Exact fix made:
  - Tuned the `.topbar` background slightly lighter/airier and softened the main drop shadow so the panel does not terminate as abruptly.
  - Added one subtle outer feather halo on `.topbar::after` using low-opacity gradients around the panel edge.
  - Kept the treatment lightweight and CSS-only, with no layout or content changes.
  - Follow-up theme rule:
    - Custom theme-specific `.topbar` backgrounds must preserve the same softened/feathered hero-panel treatment and must not reintroduce a hard boxed rectangle.
  - Follow-up exact fix:
    - Updated the `merica`, `mx`, and `rasta` `.topbar` theme overrides so their hero backgrounds use the same softer layered structure as the feathered base hero instead of flatter card-like fills.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to hero/header panel edge treatment.
- QA still needed:
  - Confirm the hero/header box edge reads softer on desktop Safari.
- Confirm the panel still feels crisp and readable, not muddy.
- Confirm custom themes still look intentional with the softened edge.

---

### 18. Merica theme background FX enhancement
**Status:** fix implemented, awaiting QA

**Goal:**
Give the `merica` theme richer background FX with brighter lights and star detail while keeping the pass narrow and tasteful.

**Desired behavior:**
- Merica should feel more alive than before
- brighter stars and background lights
- still premium, not noisy
- no changes to other themes

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Suspected root cause:
  - Merica already had custom background FX layers, but they were relatively sparse and soft compared with the brighter visual direction requested.
  - The narrowest safe place to enrich the theme is the existing `body.theme-custom.theme-custom-merica::before` and `::after` layers, which already own the theme-specific atmospheric background treatment.
- Exact fix made:
  - Added brighter point-light/star accents and stronger soft glow blooms to the existing Merica background FX layers.
  - Kept the implementation CSS-only and scoped to Merica’s theme-specific pseudo-element backgrounds.
  - Did not change aura mapping, theme plumbing, or other themes.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to Merica theme background FX only.
- QA still needed:
  - Confirm Merica shows brighter stars/lights without looking busy.
- Confirm readability and contrast on controls/text remain good.
- Confirm MX and Rasta remain unchanged.

---

### 19. Rasta theme drifting smoke background
**Status:** fix implemented, awaiting QA

**Goal:**
Add a subtle full-screen drifting smoke cloud to the Rasta theme background without affecting interactivity or readability.

**Desired behavior:**
- transparent smoke layer across the whole screen
- background-only, behind UI
- subtle and atmospheric, not muddy
- no obstruction of buttons or controls

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Suspected root cause / integration note:
  - Rasta already has theme-specific full-screen pseudo-element layers on `body.theme-custom.theme-custom-rasta::before` and `::after`.
  - The safest place to add smoke is inside those existing background layers, so the effect remains screen-wide, non-interactive, and theme-scoped.
- Exact fix made:
  - Added a soft drifting smoke treatment to the existing Rasta background layer using low-opacity radial gradients with slow motion.
  - Kept the effect transparent and background-only; no control or layout styling changed.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is CSS-only and limited to Rasta theme background FX.
- QA still needed:
  - Confirm the smoke covers the full screen behind the UI.
  - Confirm it feels subtle and atmospheric, not heavy or muddy.
- Confirm controls/text remain easy to read and unaffected.

---

### 20. Merica white-star background enhancement
**Status:** fix implemented, awaiting QA

**Goal:**
Add more white presence to Merica’s background and introduce actual slow-drifting white star shapes across the full screen.

**Desired behavior:**
- Merica keeps its blue/white/red identity
- background uses a bit more white light
- visible white star shapes drift and rotate slowly across the screen
- effect stays subtle and premium

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Suspected root cause / integration note:
  - Merica already had brighter point lights, but its white contribution was still mostly glow dots and soft blooms rather than distinct star shapes.
  - The narrowest safe place to add actual stars is the existing full-screen Merica background pseudo-element layer, so the effect stays theme-scoped and behind the UI.
- Exact fix made:
  - Increased the white bloom presence in Merica’s background layers.
  - Added actual white star shapes using layered conic-gradient star forms in the full-screen Merica background.
  - Switched Merica’s secondary background layer to a slower drift/rotation animation so the stars wrap the screen gently without becoming noisy.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is CSS-only and limited to the Merica theme.
- QA still needed:
  - Confirm Merica shows more white presence in the background.
  - Confirm the white stars are visible but still subtle.
  - Confirm the drift/rotation feels slow and premium, not busy.
  - Confirm readability and controls remain unaffected.

---

### 21. Hero logo box edge feathering
**Status:** fix implemented, awaiting QA

**Goal:**
Remove or soften the remaining hard-edged rectangle behind the hero logo.

**Desired behavior:**
- no obvious hard box behind the logo
- edges fade naturally into the header/background
- logo stays crisp and readable

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Suspected root cause:
  - The remaining visible rectangle appears to come from the hero logo/image rendering layer rather than the overall `.topbar` shell.
  - The actual PNG asset is transparent, so the rectangle is not baked into the file.
  - The more likely culprit is the logo element’s `mix-blend-mode: screen`, which can make the entire image bounds read like a blended rectangle on some backgrounds.
- Follow-up note:
    - The remaining visible rectangle also appears aligned to the centered `.topbar-title` block, so a container-level feather helps catch any remaining compositing edge around the title/logo area as a whole.
  - Follow-up root cause:
    - The remaining box is likely a Safari/browser filter-region artifact from the raster hero logo image using multiple `drop-shadow(...)` filters, not from the PNG asset itself.
- Exact fix made:
  - Removed the hero logo image blend-mode layer that was likely causing the rectangular read across the image bounds.
  - Kept the logo glow, placement, size, and soft edge mask so the logo still feels luminous without the box artifact.
  - Added a soft mask to the `.topbar-title` container itself so any remaining centered title-block edge fades out rather than reading as a hard rectangle.
  - Moved the hero glow treatment off the image filter stack and onto the logo button wrapper, so the image itself can render without a rectangular filter/compositing region.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to hero logo presentation only.
- QA still needed:
  - Confirm the hard rectangle behind the logo is no longer visible.
- Confirm the logo still looks crisp and not clipped too aggressively.
- Confirm Safari renders the fade cleanly.

---

### 22. Hero center slab removal / hero box cleanup
**Status:** fix implemented, awaiting QA

**Goal:**
Remove the remaining centered rectangular slab behind the PolyPlay logo area.

**Desired behavior:**
- no visible centered box/slab behind the logo
- keep the full-width header treatment
- keep readability and structure
- if needed, use only soft radial glow / haze, not a boxed center patch

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Suspected root cause:
  - The remaining visible slab was not the PNG asset.
  - The strongest remaining source was the centered `.topbar-title` compositing stack from the prior cleanup passes: container mask, image mask, and wrapper glow/filter treatment all centered on the logo block.
  - That stack was likely forcing a centered rectangular compositing layer even after the broader hero panel had been softened.
- Exact fix made:
  - Removed the centered title/logo masking treatment that was likely creating the visible slab.
  - Removed the image-level and container-level mask path so the centered block is no longer being composed as its own faded rectangle.
  - Replaced the centered effect with one non-rectangular radial glow on the logo button wrapper so the logo still has atmosphere without a boxed center patch.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to hero title/logo presentation.
- QA still needed:
  - Confirm the centered rectangular slab is gone on desktop Safari.
- Confirm the logo still feels luminous and readable.
- Confirm no new clipping or muddy edge artifacts appear.

---

### 23. Journal backup naming before download
**Status:** fix implemented, awaiting QA

**Goal:**
Prompt for a custom filename before downloading a journal backup, matching the existing Vault backup naming flow.

**Desired behavior:**
- journal backup export prompts for a filename first
- prompt is prefilled with the current gratitude backup default filename
- user can keep or edit the name
- export continues with that chosen filename

**Likely files:**
- `src/components/JournalModal.tsx`
- `src/lib/saveBlob.ts`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/JournalModal.tsx`
  - `src/App.tsx`
  - `src/lib/saveBlob.ts`
- Narrowest safe reuse path:
  - Journal backup export already uses the shared save helper path via `saveTextWithBestEffort(...)`.
  - The only missing piece is the pre-save filename prompt used by Vault backups through `promptForSaveFilename(...)`.
  - The narrow fix is to reuse that prompt in `JournalModal`, using `getGratitudeBackupFilename()` as the default suggested name, then continue the existing journal export save flow with the chosen filename.
- Exact fix made:
  - Reused the Vault-style naming prompt in the journal backup export button before the save begins.
  - Prefilled the prompt with the existing journal default filename from `getGratitudeBackupFilename()`.
  - If the user confirms or edits the name, the existing journal JSON export continues unchanged through `saveTextWithBestEffort(...)`.
  - If the user cancels, the export stops cleanly and shows an informational status instead of silently continuing.
- Files changed:
  - `src/components/JournalModal.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to the journal backup export click path and reuses the existing shared filename prompt helper already used by Vault backups.
- QA still needed:
  - Confirm journal backup prompts for a filename before saving.
  - Confirm the prompt is prefilled with the current gratitude default backup name.
  - Confirm editing the filename changes the downloaded/saved file name.
  - Confirm canceling the prompt does not export a file.
  - Confirm the journal backup contents and `.json` format are unchanged.

---

### 24. Loop refinement stabilization on iPhone
**Status:** fix implemented, awaiting QA

**Goal:**
Stabilize loop editing on iPhone so the viewport, markers, and edit/done state behave predictably during refinement.

**Desired behavior:**
- entering loop edit should present a practical editable viewport
- markers should not get smashed together on edit entry
- markers should not get stuck on the far edge during refinement
- finishing loop edit should hide the yellow in/out edit markers
- loop playback should not fall into a limbo/skipping state

**Likely files:**
- `src/components/WaveformLoop.tsx`
- `src/App.tsx`
- `src/components/player.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/WaveformLoop.tsx`
  - `src/App.tsx`
- Likely root cause:
  - The loop editor still falls back to a full-track/default viewport whenever the loop has not been marked as “adjusted”, even when the user is entering edit on an already-valid small loop.
  - On iPhone that full-track fallback makes tight loops render as visually collapsed markers, which reads like the start/end got smashed together.
  - Once the viewport is too wide, dragging near the edge can feel stuck because handle motion is clamped to the current visible range and the editor is not aggressively re-fitting around the active loop on edit entry.
  - The yellow edit markers are also still rendered outside edit mode because the overlay markers/handles are not gated tightly enough to `loopRegion.editing`.
- Additional root cause found during implementation:
  - `App.tsx` was permitting loop regions down to `0.1s` while `WaveformLoop.tsx` uses `0.5s` as its minimum editable/readable loop span.
  - That mismatch could create ultra-tight loops that look smashed on entry and can push playback into a skip/limbo feel during refinement.
- Exact fix made:
  - Aligned the app-level minimum loop span with the waveform editor minimum so loop state cannot collapse below the editor’s supported range.
  - Changed loop edit entry to seed a focused editing viewport around the active loop instead of falling back to a full-track/default span on iPhone.
  - Added edge breathing room when keeping the loop inside the current view so the end marker does not pin itself against the far side as easily during refinement.
  - Gated the yellow edit markers/handles to edit mode only, so pressing Done hides the yellow edit affordances.
- Files changed:
  - `src/App.tsx`
  - `src/components/WaveformLoop.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. The changes are scoped to loop editing/view state, but they do alter the edit-entry viewport and loop minimum bounds.
- QA still needed:
  - Confirm entering Edit Loop on iPhone opens to a practical loop-focused viewport.
  - Confirm very small loops no longer show smashed-together markers on edit entry.
  - Confirm dragging the end marker no longer leaves it pinned on the far edge.
  - Confirm loop playback no longer falls into a skipping/limbo state while refining.
  - Confirm pressing Done hides the yellow edit markers.
  - Confirm manual `+/-` zoom still works before and after refinement.
  - Confirm Zoom to Fit still behaves correctly after the viewport stabilization.

---

### 25. iOS theme-change toast positioning
**Status:** fix implemented, awaiting QA

**Goal:**
Keep the theme-change toast fully visible on iPhone without redesigning the toast system.

**Desired behavior:**
- toast remains fully on-screen on iOS
- placement respects safe areas and narrow widths
- toast stays readable and clean

**Likely files:**
- `styles.css`
- `src/App.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/App.tsx`
  - `styles.css`
- Exact root cause:
  - The theme toast is rendered by the normal `fxToast` path in `App.tsx`, but the special `.fx-toast--theme` placement in `styles.css` positions it with `left: 50%` plus a fixed `translateX(72px)`.
  - On iPhone widths, that fixed horizontal offset can push the toast partially off-screen.
  - The theme toast also lacked an explicit viewport-aware width cap, so narrow devices had no guardrail once the placement drifted right.
- Exact fix made:
  - Kept the existing theme toast behavior and render path unchanged.
  - Replaced the fragile centered-plus-offset placement with a safe-area-aware right anchor for `.fx-toast--theme`.
  - Added a viewport-constrained max width so the toast stays fully visible on narrow iPhone screens.
  - Allowed normal text wrapping for the theme toast so longer theme names remain readable instead of forcing overflow.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to the special topbar theme-toast placement.
- QA still needed:
  - Confirm the theme-change toast stays fully on-screen on iPhone.
  - Confirm it still appears near the theme button region instead of over the playbar.
  - Confirm longer theme names wrap cleanly without looking awkward.
  - Confirm non-theme toasts still use their existing placement unchanged.

---

### 26. Hero button flash glitch cleanup
**Status:** fix implemented, awaiting QA

**Goal:**
Remove the disconnected solid flash artifact from hero button interactions while preserving intentional button feedback.

**Desired behavior:**
- hero button feedback feels attached to the button/action
- no broad solid flash or disconnected area flash
- interaction still feels intentional and alive

**Likely files:**
- `styles.css`
- `src/App.tsx`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/App.tsx`
  - `styles.css`
  - `src/index.css`
- Exact root cause:
  - The hero/topbar controls themselves are not spawning a full-screen flash.
  - The glitch is most likely the compact hero use of the `theme-bloom` animation on the topbar theme button, combined with the persistent hero-button glow layer.
  - In the hero cluster, that bloom is strong enough to read like a detached solid flash instead of an element-attached pulse.
- Exact fix made:
  - Kept the normal theme button feedback behavior intact outside the hero controls.
  - Replaced the topbar hero theme button’s reuse of the generic `theme-bloom` animation with a subtler hero-specific pulse.
  - The new hero pulse stays attached to the button by using a mild scale/brightness/shadow lift instead of an expanding solid bloom.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This only changes the special topbar theme button bloom behavior.
- QA still needed:
  - Confirm the solid flash/glitch is gone when changing theme from the hero button.
  - Confirm the button still feels responsive and intentional.
  - Confirm larger/non-hero theme controls still use their existing bloom behavior unchanged.

---

### 27. Merica theme background motion polish
**Status:** fix implemented, awaiting QA

**Goal:**
Give the Merica theme background the same subtle living feel as the other themes without making it busy.

**Desired behavior:**
- Merica background drifts and shimmers tastefully
- motion feels subtle and premium
- readability and performance stay intact

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Exact root cause of the static feel:
  - Merica already had motion, but it was comparatively weak.
  - Its main field layer only used the generic `wave-sweep`, and the star layer only used a very slow drift/rotation.
  - Unlike richer themes, there was almost no luminance/opacity shimmer riding on top of that motion, so the background read more static than alive.
- Exact fix made:
  - Kept the existing Merica background layers and overall composition intact.
  - Added a subtle field shimmer to the main `::before` layer so the blue/white/red field breathes slightly as it drifts.
  - Added a light shimmer to the star layer on `::after` so the drifting stars feel alive instead of static.
  - Kept both timings slow and low-contrast to avoid busy motion or readability issues.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is CSS-only and limited to Merica background motion.
- QA still needed:
  - Confirm Merica feels more alive without becoming noisy.
  - Confirm the stars drift and shimmer subtly.
  - Confirm readability and button contrast remain unchanged.
  - Confirm other themes are unaffected.

---

### 28. Theme FX performance audit
**Status:** audit complete

**Goal:**
Audit whether theme gradient FX are causing visible slowdown and make the narrowest safe improvement without redesigning the visual system.

**Desired behavior:**
- preserve the current look as much as possible
- remove any clearly avoidable expensive work
- avoid premature raster/image replacements unless evidence actually supports that

**Likely files:**
- `styles.css`
- `src/fx/ambientFxEngine.ts`
- `src/components/BubbleLayer.tsx`
- `src/lib/bubbles.ts`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
  - `src/fx/ambientFxEngine.ts`
  - `src/components/BubbleLayer.tsx`
  - `src/lib/bubbles.ts`
- Most likely bottleneck:
  - The main risk is not static gradient backgrounds by themselves.
  - The costier path is large full-screen pseudo-elements and overlays that combine many layered gradients with animated compositing properties like `filter`, plus other full-screen FX layers running at the same time.
  - The clearest avoidable offender found in the current theme work is animated `filter` on Merica’s full-screen shimmer layers, which is more expensive than animating opacity/transform alone.
- Whether prerasterized gradients are justified:
  - Not yet.
  - The current evidence points more strongly to compositing/animation cost than to the static gradient definitions themselves.
  - Replacing the theme gradients with prerasterized images would add asset complexity and reduce flexibility without addressing the main avoidable cost if the slowdown is really coming from animated filters and stacked full-screen layers.
- Exact improvement made:
  - Removed animated `filter` changes from Merica’s full-screen shimmer keyframes.
  - Kept the motion on opacity while preserving the existing drift transforms, which is the narrower and safer performance improvement.
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This only reduces compositing cost on Merica’s background shimmer and does not redesign the theme system.
- QA still needed:
  - Confirm Merica still feels alive after the filter-animation removal.
  - Confirm no obvious loss of richness in the background motion.
  - Compare iPhone smoothness with Merica versus the previous build.
  - Confirm other themes are unchanged.

---

### 29. Loop zoom control layout cleanup
**Status:** fix implemented, awaiting QA

**Goal:**
Make the loop zoom row read clearly as primary `- / +` zoom controls with `Fit` as a secondary helper action.

**Desired behavior:**
- `-` and `+` remain the primary zoom controls
- `Fit` is visually separate and secondary
- layout stays readable on desktop and iPhone

**Likely files:**
- `src/components/WaveformLoop.tsx`
- `src/components/player.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
- Exact layout issue:
  - `Fit` is currently rendered inside the expandable zoom-controls group between the zoom buttons and the label.
  - That placement makes it read like part of the primary zoom cluster instead of a secondary helper action.
  - The cleaner interpretation is to keep `- / +` grouped together and move `Fit` out as its own smaller companion action.
- Exact fix made:
  - Kept the zoom controls grouped as `Loop Zoom`, `-`, and `+`.
  - Moved `Fit` out of that controls cluster and rendered it as its own smaller secondary button to the right.
  - Styled `Fit` as a quieter helper action so it no longer competes with the primary zoom buttons.
- Files changed:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low. This is limited to loop zoom control layout and styling.
- QA still needed:
  - Confirm `-` and `+` now read clearly as the primary zoom controls.
  - Confirm `Fit` reads as a separate helper action.
  - Confirm the row still feels clean on desktop and iPhone.
  - Confirm `Fit` still works correctly after the layout move.

---

### 30. iOS loop marker drag regression + Fit button placement correction
**Status:** fix implemented, awaiting QA

**Goal:**
Stabilize loop marker dragging on iPhone and place `Fit` next to the magnifier as a separate helper action.

**Desired behavior:**
- marker dragging feels direct and stable on iPhone
- no dancing, jittering, or jumping during drag
- `Fit` sits next to the magnifier at all times
- `-` and `+` remain the primary zoom controls

**Likely files:**
- `src/components/WaveformLoop.tsx`
- `src/components/player.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
- Exact root cause:
  - During drag, marker time is computed from `secondsFromClientX(...)`, which uses the live `safeViewRange`.
  - But the same drag path is also updating loop state and edit viewport state, so the visible range can shift while the pointer is still moving.
  - On iPhone that creates a moving coordinate system, which makes the handle appear to dance/jitter under the finger.
  - `Fit` was also still tied to the zoom-controls reveal state instead of living consistently beside the magnifier as its own helper action.
- Exact fix made:
  - Froze the drag pointer mapping range at drag start, so iPhone marker movement is calculated against a stable view range instead of the live moving viewport.
  - Changed drag updates to clamp against the current drag snapshot, so the opposite marker bound stays stable during the gesture.
  - Cleared the frozen drag range when editing ends or the drag completes.
  - Moved `Fit` to live immediately next to the magnifier button at all times, while keeping `-` and `+` together as the revealed primary zoom controls.
  - Tightened the mobile loop zoom row sizing so the toolbar fits comfortably on narrow iPhone screens without pushing the `+` button off-screen.
  - Follow-up correction: locked the edit viewport during active drag so the marker is no longer dragged against a moving visible range.
  - Follow-up correction: hid the `Loop Zoom` label and tightened spacing further on very narrow iPhone widths so the toolbar reads cleaner and stays on-screen.
- Files changed:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. The change is narrow to loop dragging and toolbar layout, but it alters the drag coordinate path on iPhone.
- QA still needed:
  - Confirm iPhone loop marker dragging feels stable and no longer jitters/dances.
  - Confirm the marker tracks the finger directly without jumping.
  - Confirm `Fit` now sits next to the magnifier at all times.
  - Confirm `-` and `+` still read clearly as the zoom controls.
  - Confirm the full loop zoom row stays fully on-screen on narrow iPhone widths.
  - Confirm the drag no longer “dances” because the viewport stays fixed while the finger is down.
  - Confirm desktop loop editing still behaves normally.

---

### 31. Loop edit zoom/navigation refactor plan
**Status:** planning complete

**Goal:**
Stop patching the current loop edit system and define a cleaner, explicit model for loop bounds, viewport state, and interaction state.

**Desired behavior:**
- loop bounds are managed independently from viewport framing
- drag interaction does not mutate multiple coupled states at once
- Fit / `+` / `-` operate only on viewport state
- edit entry and Done are deterministic
- iOS and desktop share the same core loop model

**Likely files / modules for refactor:**
- `src/components/WaveformLoop.tsx`
- `src/App.tsx`
- `src/components/player.css`
- optionally a new helper module such as `src/lib/loopEditorState.ts`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `src/components/WaveformLoop.tsx`
  - `src/App.tsx`
- Exact current conflict points in code:
  - `App.tsx`
    - `setLoopRange(...)` owns loop bounds, active state, editing state, audio seek correction, and persistence decisions all in one function.
    - `beginLoopAdjustment()` / `finishLoopAdjustment()` only flip the shared loop object into and out of editing, so the editor has no separate draft/edit session state.
  - `WaveformLoop.tsx`
    - loop bounds and viewport are interwoven through `safeStart`, `safeEnd`, `viewRange`, `manualZoomLevel`, `hasAdjustedLoop`, `shouldPreserveViewRange`, `editingViewRangeRef`, and drag refs.
    - edit entry, fit, drag, and zoom all converge in the same `useEffect` path that recomputes `viewRange`.
    - drag handling (`onPointerMove`) updates loop bounds live through `onSetLoopRange(...)` while viewport maintenance effects are also reacting to those same bounds.
    - `manualZoomLevel` is currently derived against whichever base range the editor thinks is current, so fit and zoom are entangled instead of being independent viewport transforms.
    - toolbar visibility/placement logic is mixed into the same component as drag and viewport logic, increasing coupling.

**Proposed state model:**
- 1. Loop bounds state
  - `committedLoop`: `{ start, end, active }`
  - invariant: `end - start >= MIN_LOOP_SECONDS`
  - owned by parent/app state and persisted
- 2. Edit session state
  - `editSession`: `null | { draftStart, draftEnd, dragHandle, enteredAt }`
  - exists only while editing
  - draft bounds are local to the editor until commit
- 3. Viewport state
  - `viewport`: `{ start, end, zoomLevel, mode }`
  - `mode`: `"follow-loop" | "manual" | "fit"`
  - independent of loop bounds
  - no persistence needed
- 4. Interaction state
  - `interaction`: `"idle" | "editing" | "dragging-start" | "dragging-end"`
  - explicit, single source of truth

**Proposed event flow:**
- Enter edit mode
  - read committed loop
  - create `editSession` with `draftStart = committed.start`, `draftEnd = committed.end`
  - create viewport with `mode = "fit"` and a deterministic fit range around the draft loop
  - show edit affordances
- Drag start marker
  - switch interaction to `dragging-start`
  - freeze viewport for duration of drag
  - update only `editSession.draftStart`
  - clamp against `draftEnd - MIN_LOOP_SECONDS`
  - do not mutate parent committed loop during drag
- Drag end marker
  - switch interaction to `dragging-end`
  - freeze viewport for duration of drag
  - update only `editSession.draftEnd`
  - clamp against `draftStart + MIN_LOOP_SECONDS`
  - do not mutate parent committed loop during drag
- Tap Fit
  - keep current draft loop
  - recompute viewport around `draftStart` / `draftEnd`
  - set `viewport.mode = "fit"` and `zoomLevel = 0`
- Tap `+` / `-`
  - keep current draft loop
  - adjust only `viewport.zoomLevel`
  - recompute viewport from the same draft loop center/span rules
  - set `viewport.mode = "manual"`
- Press Done
  - commit `draftStart` / `draftEnd` to parent via one persistence call
  - clear `editSession`
  - hide edit affordances
  - keep either the current viewport or a stable post-edit playback framing, but do it once, not through drag logic

**Safest implementation order in small steps:**
- 1. Refactor drag interaction state only
  - introduce explicit `editSession` draft bounds
  - stop writing parent loop state during drag
  - commit only on pointer up / drag end
- 2. Refactor viewport state only
  - isolate viewport model and fit/manual zoom calculations into pure helpers
  - remove viewport recomputation from generic loop-bound effects
- 3. Reconnect `+`, `-`, and `Fit`
  - make them operate only on viewport state
  - no loop-bound writes
- 4. Rewire edit entry / Done behavior
  - deterministic edit entry fit
  - one commit on Done
  - one clear exit path
- 5. Test iOS and desktop separately after each implementation step
  - test iOS first for drag stability
  - test desktop second for layout and precision regressions

**Narrowest safe first implementation step:**
- Start with drag-state isolation only.
- Do not move any buttons or polish anything in that same step.
- Success criteria for step 1:
  - no jitter during drag
  - no viewport churn during drag
  - committed loop only changes when drag ends

**Regression risk:**
- Medium if attempted all at once.
- Low to medium if done in the staged order above with QA after each step.

**QA / verification plan after refactor steps:**
- iOS
  - drag start marker repeatedly
  - drag end marker repeatedly
  - verify no jitter and no jumping
  - test Fit, `+`, `-` independently

---

### 32. Loop edit zoom/navigation refactor — Step 1 only
**Status:** fix implemented, awaiting QA

**Goal:**
Implement drag-state isolation only, without touching broader loop UI behavior.

**Scope:**
- local draft loop bounds during edit mode
- no parent/committed loop writes during drag
- commit only when drag ends
- keep viewport frozen during drag

**Files in scope:**
- `src/components/WaveformLoop.tsx`
- `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`

**Codex notes:**
- Implementation start — 2026-04-02 Codex:
- Following approved Step 1 only from Task 31.
- Explicitly out of scope for this pass:
  - Fit placement changes
  - zoom button polish
  - edit-entry visuals
  - Done behavior
- Exact drag-state changes made:
  - Introduced local draft loop bounds inside `WaveformLoop` for edit mode.
  - While editing, the waveform overlay and loop highlight now read from local draft bounds instead of forcing every drag movement through the parent loop state.
  - Pointer drag now updates only local draft bounds during the gesture.
  - Parent loop writes are deferred until pointer up / drag end, where one committed `onSetLoopRange(..., { persist: true, editing: true })` call is made.
  - The viewport remains frozen during drag by keeping the editing view range locked while the local draft bounds change underneath it.
- Files changed:
  - `src/components/WaveformLoop.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. This is a meaningful drag-path refactor, but it is contained to edit-mode loop handling in `WaveformLoop`.
- QA still needed:
  - Confirm iPhone drag no longer jitters.
  - Confirm the viewport stays stable during drag.
  - Confirm committed loop state updates only after drag ends.
  - Confirm desktop drag precision still feels intact.

---

### 33. Loop edit zoom/navigation refactor — Step 2 only
**Status:** fix implemented, awaiting QA

**Goal:**
Make viewport state explicit for edit mode and stop generic effects from recomputing loop framing unpredictably.

**Scope:**
- explicit edit viewport mode only
- keep Step 1 drag-state isolation intact
- no button layout changes
- no broader loop polish

**Files in scope:**
- `src/components/WaveformLoop.tsx`
- `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`

**Codex notes:**
- Implementation start — 2026-04-02 Codex:
- Following approved Step 2 only from Task 31.
- Target:
  - explicit edit viewport mode (`fit`, `manual`, `locked`)
  - remove generic edit-mode framing churn from shared effects
- Exact viewport-state changes made:
  - Added an explicit edit viewport mode inside `WaveformLoop`: `fit`, `manual`, and `locked`.
  - Edit mode now uses that explicit viewport mode to decide how framing behaves, instead of relying on generic effects to infer whether the loop should be re-fit.
  - `fitLoopToView()` now explicitly sets `fit` mode.
  - `+` / `-` now explicitly set `manual` mode.
  - active drag explicitly sets `locked` mode, and drag end moves back to `manual`.
  - The shared edit-mode viewport effect now follows the mode:
    - `fit` => recompute a loop-focused framing
    - `manual` => preserve the current editing range and only keep the loop within it
    - `locked` => keep the viewport fixed
- Files changed:
  - `src/components/WaveformLoop.tsx`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. This is still contained to `WaveformLoop`, but it changes how edit-mode framing decisions are made.
- QA still needed:
  - Confirm edit entry opens to a clean fit state.
  - Confirm drag keeps the viewport locked.
  - Confirm `+` / `-` behave as manual viewport controls without unpredictable reframing.
  - Confirm Fit still re-frames cleanly.
  - Confirm iPhone and desktop now behave more consistently.
- Desktop
  - verify precision drag still feels correct
  - verify viewport controls still read clearly
  - verify Done hides edit affordances without changing the active loop unexpectedly

---

### 34. Loop zoom toolbar usability cleanup
**Status:** fix implemented, awaiting QA

**Goal:**
Make the loop zoom toolbar fit cleanly on smaller screens and guarantee a safe zoom-out escape path.

**Scope:**
- loop zoom toolbar layout/usability only
- narrow/mobile widths only where relevant
- no broader loop-state refactor reopening beyond the zoom-out escape path needed for usability

**Files in scope:**
- `src/components/WaveformLoop.tsx`
- `src/components/player.css`
- `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Clipping root cause appears to be the mobile toolbar width math: the visible `Fit` button plus the opened control cluster can exceed narrow viewport space, while `.pc-wave-toolbar__controls.is-open` still uses a fixed-ish max-width budget.
- Label intrusion root cause is that the label remains part of the same constrained inline control cluster on widths where the cluster is already space-starved.
- Zoom-out trap root cause is behavioral: `Fit` resets `manualZoomLevel` to `0`, and `-` is disabled purely from `manualZoomLevel <= 0` even when the current viewport is still tighter than the full track.
- Exact fix made:
  - Tightened the mobile toolbar width math so the row uses a centered bounded width and gives the open `- / +` cluster a larger real max-width budget on narrow screens.
  - Kept `Fit` separate, but reduced mobile control sizing and spacing so the right-side control no longer gets clipped as easily.
  - Hid the `Loop Zoom` label on narrow widths so it no longer competes with the actual controls.
  - Changed zoom-out availability to follow the actual current viewport span instead of `manualZoomLevel` alone.
  - `-` can now keep widening the viewport after `Fit` until the full track view is reached, so the user has a guaranteed zoom-out escape path.
- Files changed:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. This is still localized to the loop zoom toolbar and edit viewport controls, but it changes the zoom-out behavior after `Fit`.
- QA still needed:
  - Confirm the toolbar fits cleanly on iPhone without clipping the right-side control.
  - Confirm the label no longer crowds `+` / `-`.
  - Confirm pressing `Fit` still works.
  - Confirm `-` can always widen the viewport back out until the full track is visible.
  - Confirm desktop toolbar layout remains unchanged.
- Follow-up note — 2026-04-02 Codex:
  - Live QA showed two remaining issues:
    - `Fit` was being too loose because the explicit fitted range could still get replaced by generic `fit`-mode framing on the next effect pass.
    - On some iPhone widths the toolbar still felt oversized and the `Loop Zoom` label was still consuming too much space.
  - Narrow follow-up fix:
    - preserve the explicit fitted range when `Fit` is tapped
    - shrink the mobile toolbar controls further and hide the label on a slightly wider mobile breakpoint

---

### 35. Theme art-direction recovery pass
**Status:** in progress

**Goal:**
Recover the premium atmospheric beam/light language that existed before this session so the custom backgrounds feel layered, cinematic, and intentional again.

**Desired behavior:**
- backgrounds should regain angled beam/light structure rather than reading as plain horizontal drift
- motifs should support the beam atmosphere rather than replacing it
- `merica` should feel cinematic and patriotic, `mx` should feel blended and culturally correct, and `rasta` should feel smoky and textured
- no readability or control contrast regressions

**Likely files:**
- `styles.css`

**Codex notes:**
- Diagnosis start — 2026-04-02 Codex:
- Files inspected:
  - `styles.css`
- Suspected root cause / integration note:
  - earlier in the session, the custom themes still relied more heavily on angled beam/light gradients in their pseudo-layers.
  - later iterations shifted emphasis into flatter haze, striping, and motif overlays, which reduced premium depth and made some motifs read incorrectly.
- Exact fix made:
  - Identified the specific lost art-direction layer as the angled beam/light structure formerly carried by the theme `::before` pseudo-layers, especially the diagonal linear light slices that were later replaced by flatter haze and motif treatments.
  - In `styles.css`, restored that beam-first structure across `merica`, `mx`, and `rasta` by bringing angled light gradients back into the active pseudo-layers and reducing the dominance of flatter overlay treatments.
  - Tightened `merica` so stars and stripe hints now sit inside the beam field rather than reading as wallpaper.
  - Tightened `mx` so the tricolor stays smoothly blended while the skull motifs are reduced to a subtler, cleaner supporting accent instead of the primary read.
  - Tightened `rasta` so the darker textured haze keeps its rootsy poster feel but now regains angled light depth rather than plain horizontal drift.
  - Kept the pass CSS-only and limited to the theme background layers and motif overlays.
- Follow-up QA note:
  - Live review showed Merica was still reading as too many diagonal lines moving together, while the stars/stripes were too hard to perceive.
  - Narrow follow-up adjustment:
    - reduce the diagonal/same-direction motion language
    - make the stripe structure horizontal and clearer
    - use fewer, larger stars with subtler rotation/drift
  - Live review also showed Rasta still felt too gradient-blended, with the core reggae hex colors not reading strongly enough and the smoke clouds not visibly separating from the background.
  - Narrow follow-up adjustment:
    - make `#078930`, `#F6E20A`, and `#DA121A` more prominent in the base background
    - remove some of the muddy intermediary blending
    - make the smoke a clearer drifting layer
  - Live review after that pass:
    - the Rasta color treatment became too hard-edged
    - smoke still was not reading clearly as smoke clouds
  - Narrow corrective adjustment:
    - soften the color boundaries again while keeping the hex colors visible
    - enlarge and brighten the smoke layer so it reads as actual clouds
  - Live review also requested the same reduction in muddy gradient blending for MX, with stronger direct reads of the flag palette.
  - Narrow follow-up adjustment:
    - make `#006341`, `#FFFFFF`, and `#C8102E` more prominent in the MX base background
    - reduce the blended in-between field so the primary tricolor reads more clearly
  - Live review after that:
    - Merica still read as generic diagonal beams, with stars not visible enough and motion not registering
    - Rasta smoke still did not read clearly as clouds, and movement needed to stay drifty rather than flat
    - MX also needed to keep subtle ambient movement while holding the stronger tricolor read
  - Narrow corrective adjustment:
    - replace the Merica pseudo-layer emphasis with explicit star motifs in the blue field plus restrained horizontal stripe wear
    - enlarge and brighten the Rasta blue-white smoke masses with heavier blur so the cloud layer separates from the base colors
    - keep MX on a clearer tricolor field but shift its atmosphere to a softer slow drift instead of a flatter static blend
  - Live follow-up request:
    - the hero-bar star and `FX` buttons should theme-match in custom themes
    - keep the current purple treatment for plain light mode and dark mode
  - Narrow follow-up adjustment:
    - add custom-theme-specific chip colors and glows for the hero star and `FX` buttons only
    - leave non-custom themes on the existing purple control styling
  - Live Merica follow-up:
    - the stars need to drift and wrap the screen faster
    - the white stripe read got lost and needs to come back
  - Narrow corrective adjustment:
    - switch the Merica stars from slow transform drift to faster horizontal wrap motion using repeating star tiles
    - restore clearer worn white stripe bands beneath the red stripes so the flag structure reads again
  - Live Rasta follow-up:
    - the background colors are too washed out
    - smoke should drift upward and wrap from the top of the screen to the bottom
    - sparse floating rotating black marijuana leaf silhouettes should be present
  - Narrow corrective adjustment:
    - rebuild the Rasta base with stronger distressed vertical red-yellow-green bands
    - convert the smoke to vertically repeating upward-travel layers so the motion actually wraps
    - add low-density black leaf silhouettes as a separate drifting overlay
  - Live Merica follow-up:
    - star rows should not be confined just to the top edge
    - stripes need to stay transparent rather than reading like a flat jpeg overlay
    - the earlier patriotic spotlight/beams feel should come back
  - Narrow corrective adjustment:
    - distribute the star rows through multiple vertical bands of the screen
    - lower stripe opacity so the field stays translucent
    - restore subtle diagonal white spotlight beams under the flag treatment
  - Live Rasta follow-up:
    - the leaf silhouettes are reading like blurred vertical streaks instead of separate marijuana leaves
  - Narrow corrective adjustment:
    - stop tiling and blurring the leaf layer
    - place a few individual black leaf silhouettes with slow floating motion so each reads independently
  - Merica + MX redesign pass:
    - Merica needed to move back toward beam-first cinematic atmosphere instead of flat symbolic wallpaper
    - MX needed smoother tricolor blending and more cultural personality without hard-panel edges
  - Narrow redesign adjustment:
    - make Merica beam-first, with stars and stripes dissolved into shimmer and glow
    - make MX haze-first, with subtle drifting sugar-skull motifs secondary to the blended tricolor field
  - Rasta redesign pass:
    - Rasta needed to move away from simple color blocking and into a darker textured haze treatment
    - the leaf icon needed to match the supplied silhouette language more closely
  - Narrow redesign adjustment:
    - make Rasta dark-base and haze-first, with distressed paint texture and warm smoke-led blending
    - use a cleaner cutout leaf silhouette sparingly as a subtle ambient motif
  - Art-direction recovery pass:
    - the premium feel regressed because the backgrounds lost their angled beam/light structure and became too horizontally drifted and overlay-driven
    - motif layers were starting to read more strongly than the underlying atmospheric field
  - Narrow recovery adjustment:
    - restore angled beam gradients as the main structural language for Merica, MX, and Rasta
    - reduce motif dominance so stars, skulls, and leaves read as integrated accents rather than pasted wallpaper or doodles
- Files changed:
  - `styles.css`
  - `docs/polyplay_surgical_fix_plan_2026-04-02_notes.md`
- Regression risk:
  - Low to medium. This pass is CSS-only and limited to the theme background layers, but it rebalances the composition hierarchy across Merica, MX, and Rasta.
- QA still needed:
  - Confirm Merica, MX, and Rasta all regain angled beam/light depth rather than plain horizontal drift.
  - Confirm Merica still reads patriotic and cinematic without reverting to wallpaper stars/stripes.
  - Confirm MX keeps smooth tricolor blending and that the skull motifs now read correctly and subtly.
  - Confirm Rasta keeps its smoky textured poster feel while regaining beam depth.
  - Confirm text and controls remain readable across all three themes.

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
