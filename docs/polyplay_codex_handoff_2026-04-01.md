# PolyPlay Codex Handoff — 2026-04-01 Bug Dump

## Session intent
Use this file as the active bug tracker and handoff for the next Codex session.

## Current status
- Purpose: organize the April 1 bug dump cleanly before more changes
- Goal: reduce drift, avoid getting lost in the weeds, and separate diagnosis from fixes
- Codex budget is low, so each task should be narrow and documented before code changes

## Rules for Codex
1. Read this file first before touching code.
2. Add a short note under the relevant section before making changes.
3. For each issue, document:
   - observed behavior
   - expected behavior
   - suspected root cause
   - files to inspect
   - status
4. Do not mark anything done unless it has live QA.
5. Keep commits narrow and avoid unrelated files/folders.

## Status legend
- open
- diagnosis in progress
- fix implemented, awaiting QA
- verified
- blocked

## Top priorities
1. Stabilize loop/fullscreen behavior and remove user-trap/confusing exit behavior
2. Fix import flow regressions, especially metadata/artwork and import-page brick state
3. Clean up now-playing visuals and active-track indicators that are currently glitchy

---

## Bug dump inbox
Raw notes captured from April 1 testing and organized below.

---

## Organized issues

### 1. Loops / fullscreen / cinema / navigation guards
**Status:** diagnosis in progress

**Observed behavior:**
- Pressing the magnifying glass can scramble the layout.
- User made a loop, dragged the end marker to refine it, and the waveform zoomed way out unexpectedly even in magnifying-glass mode.
- When magnifying-glass mode is enabled, zoom should stay static; on release it should not zoom out.
- On release, loop editing should only try to center the highlighted region in the user’s viewport.
- User cannot use zoom in on the default marker starting places.
- User needs a clearer explanation for why fullscreen exit is blocked during loop editing.
- Current intended behavior has evolved: user should actually be allowed to exit fullscreen even when loop edit mode is enabled, and using X or swipe-down should effectively act like the Done action.
- “Swipe Down to Exit” text in its current fullscreen location does not make sense.
- Exiting fullscreen in different ways causes the video artwork frame to flash black for a moment, which looks like a glitch.
- After different loop workflow passes, there is still general confusion around loop editing continuity and viewport behavior.

**Expected behavior:**
- Magnify mode should preserve zoom level and only center the selected region within the current viewport.
- Releasing a loop marker should never zoom the waveform way out.
- Default marker positions should still allow zoom-in controls to work.
- If user exits fullscreen while editing a loop, that should cleanly finalize/commit the edit instead of trapping the user.
- Exit copy and exit behavior should feel obvious and consistent.
- Exiting fullscreen should not flash the video/artwork black.

**Suspected root cause:**
- Loop edit state and fullscreen exit state are still competing with each other.
- Magnify-mode viewport lock/centering logic may still be recalculating too aggressively on drag release.
- Default marker positions may be interacting badly with zoom floor or zoom-window math.
- Fullscreen exit path may unmount/repaint artwork in a way that causes the black flash.

**Files to inspect:**
- `src/components/WaveformLoop.tsx`
- `src/components/FullscreenPlayer.tsx`
- `src/components/PlayerControls.tsx`
- `src/App.tsx`

**Codex notes:**
- Audit all loop viewport behavior after marker release.
- Audit fullscreen exit so X and swipe-down can finalize loop edit instead of trapping the user.
- Revisit exit hint copy placement and wording.

**Diagnosis note — 2026-04-01 Codex:**
- `src/components/WaveformLoop.tsx` is still recalculating `viewRange` from loop bounds too aggressively. While loop editing is active, the effect derives a fresh `dragRange` from `buildWindowedViewRange(...)` whenever `dragViewSpanRef` is null, which lets the waveform jump to a newly computed zoom/window instead of preserving the current magnify viewport.
- The magnify toggle currently resets `manualZoomLevel` back to `0` whenever it is turned off, and loop-edit transitions also clear the zoom state. That makes the magnify glass feel like it scrambles layout rather than preserving the user’s current zoom choice.
- Default loop markers are created with a wide 15% margin in `src/App.tsx`, and the loop viewport logic treats those bounds the same as any other full window. That leaves little apparent effect for zoom-in controls until the user first adjusts the region.
- `src/components/FullscreenPlayer.tsx` still hard-suppresses fullscreen exit whenever `loopRegion.editing` is true (`isExitSuppressed`). That directly causes the trap behavior the bug report described.
- The fullscreen black flash is likely caused by the artwork-video cleanup effect in `src/components/FullscreenPlayer.tsx`, which removes the video `src` and calls `load()` during teardown. Exiting fullscreen unmounts the player and forces the artwork video to blank before the rest of the UI settles.

**Implementation log — 2026-04-01 Codex:**
- `src/components/WaveformLoop.tsx`: preserve the current view span while loop editing stays active, so marker release re-centers the loop inside the existing viewport instead of re-deriving a new zoom window.
- `src/components/WaveformLoop.tsx`: stop resetting manual zoom level when the magnify controls are hidden, and allow manual zoom to shrink the viewport below the full loop span so default marker positions still respond to zoom-in.
- `src/components/FullscreenPlayer.tsx`: exiting fullscreen while editing now finalizes loop editing via `onFinishLoopAdjustment()` and then closes, instead of trapping the user.
- `src/components/FullscreenPlayer.tsx`: artwork video teardown now pauses the video without clearing the `src`, avoiding the forced blank frame during fullscreen exit.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The magnify toolbar in `src/components/WaveformLoop.tsx` is currently rendered whenever `loopRegion.active && hasLoopRange && loopRegion.editing` is true. That makes the magnifying glass appear immediately on `Set Loop`, before the user has done any real refinement.
- The cleanest reveal trigger is the existing deadzone-crossing event in the handle-drag flow: the moment a pending handle press becomes an actual drag (`pendingHandle` transitions into `draggingHandle` inside `onPointerMove`), the session has clearly entered refinement mode.

**Implementation log — 2026-04-01 Codex:**
- Follow-up block start: keep magnify hidden on initial `Set Loop`, then reveal it only after the first real loop-handle drag within the current loop-edit session.
- `src/components/WaveformLoop.tsx`: magnify availability is now unlocked only when a pending loop-handle press crosses the drag deadzone and becomes a real drag. The magnifying glass stays hidden on initial `Set Loop`, then becomes available for the rest of that edit session after first refinement.

---

### 2. Import / metadata / artwork / import-page stability
**Status:** diagnosis in progress

**Observed behavior:**
- User made a new playlist, tapped Import, saw a toast, then the app refreshed / bricked itself.
- Strong suspicion that recent metadata-import work may be involved.
- Metadata import did not work for a user MP3 that had embedded artwork.
- Artist-name autofill is not the intended behavior right now:
  - intended behavior was suggestion/autocomplete as user starts typing characters
  - current behavior appears to just persist the prior artist name in the field
- Checkbox layout for import page may not be the best UX.
- The “Do not import metadata” and “Keep me on Import page” checkbox area may need layout/clarity review.

**Expected behavior:**
- Importing after creating a playlist should not refresh or brick the app.
- Metadata import should work for supported MP3s, especially embedded artwork.
- Artist-name autofill should behave like suggestion/autocomplete while typing, not a sticky always-there value.
- Import page options should feel clear and intentional.

**Suspected root cause:**
- Metadata parse / import state may be colliding with playlist creation or import-page state transitions.
- Embedded artwork extraction may be failing on some MP3s or not wiring into the existing art slot correctly.
- Artist-name persistence may have been implemented as remembered field value instead of real autocomplete/suggestion behavior.
- Import page option layout may be causing ambiguity.

**Files to inspect:**
- `src/admin/AdminApp.tsx`
- `src/lib/db.ts`
- `src/lib/mediaSession.ts`
- `src/App.tsx`
- any metadata parsing helpers / import state utilities

**Codex notes:**
- Treat the import-page brick as a top import regression.
- Verify metadata with real MP3s that contain cover art.
- Revisit artist autofill behavior and checkbox layout separately from metadata parsing correctness.

**Diagnosis note — 2026-04-01 Codex:**
- Import success currently emits overlapping parent-sync flows from `src/admin/AdminApp.tsx`: `polyplay:user-imported`, `polyplay:library-updated`, and later `polyplay:upload-success`, while `src/App.tsx` handles those as separate refresh/close paths. This is the strongest code-level candidate for the reported “toast, then refresh/brick” behavior because the import path currently mixes library refresh, onboarding state changes, and overlay dismissal in multiple steps instead of one authoritative completion path.
- Metadata parsing for embedded MP3 artwork is brittle in `buildEmbeddedArtworkFile(...)`: it only accepts picture formats that already start with `image/`. Tagged files that report cover format as `jpg`, `jpeg`, `png`, or omit the prefix will be dropped even when the embedded picture data is present.
- Artist behavior is not true autocomplete today. `uploadArtist` is initialized from `ARTIST_MEMORY_KEY`, and metadata import is allowed to overwrite only when the current value is blank or equal to that stored value. That produces a sticky remembered value instead of typed suggestion behavior.
- The native iOS audio picker path (`onPickUploadAudioNative`) does not reset the same touched/autofill refs that the standard picker path resets. That can preserve stale title/artist/artwork state across imports and can suppress later metadata application.

**Implementation log — 2026-04-01 Codex:**
- Block 1 start: consolidate import completion into one authoritative success signal between `src/admin/AdminApp.tsx` and `src/App.tsx`, removing overlapping refresh/close messages from the upload path.
- Block 1 complete: upload success now uses a single `polyplay:import-complete` message for the iframe-parent path, while the upload handler no longer emits the extra `polyplay:user-imported` / `polyplay:library-updated` pair during track import.
- Block 2 start: normalize native and standard audio-pick setup so both paths reset the same title/artist/artwork autofill state before metadata import runs.
- Block 2 complete: both audio pickers now share the same upload-draft reset path, which clears stale title/artist/artwork autofill state before a new file is parsed.
- Block 3 start: relax embedded artwork format handling so MP3 cover art is accepted for common shorthand formats and missing-prefix variants when picture bytes are present.
- Block 3 complete: embedded artwork import now accepts shorthand image formats such as `jpg`, `jpeg`, and `png`, and falls back to byte-signature sniffing when the tag format string is incomplete.
- Block 4 start: replace sticky remembered-artist field population with typed suggestion/autocomplete behavior while preserving metadata autofill when available.
- Block 4 complete: the artist field now starts blank and exposes remembered/library artist names as typed suggestions instead of seeding the prior artist directly into the input.
- Follow-up block start: inspect remaining embedded-art failure and add a legal/support return path back to Admin.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- Embedded artwork can still fail even when `metadata.common.picture` exists because the import path still calls `selectCover(...)` before `buildEmbeddedArtworkFile(...)`. The bundled `music-metadata` `selectCover(...)` helper does not reliably return the parsed cover in this environment, so valid picture data can still be dropped before artwork-file creation.
- The legal/support pages currently have no close/back affordance at all. Because same-origin navigation now loads those pages directly in the admin/settings context, users can read them but have no explicit in-page action that returns them to Admin.

**Follow-up implementation log — 2026-04-01 Codex:**
- Embedded artwork import now uses an app-local picture selector that prefers front-cover tags but falls back to the first parsed picture instead of relying on `selectCover(...)`.
- Admin legal/support links now carry a `returnTo` route back to `admin.html`, and Support / Privacy / Terms each render a close button that returns to Admin via browser history or the explicit `returnTo` fallback.

---

### 3. Playback / media controls / now playing
**Status:** fix implemented, awaiting QA

**Observed behavior:**
- Active-track border/strobe effect does not work correctly.
- Rows show a weird rotating line on a strange axis instead of a clean perimeter effect.
- Intended now-playing strobe/border behavior is not being met.
- Imported metadata artwork / auto art behavior is inconsistent with now playing / island surfaces.
- Side note from testing: same auto art did not appear on the now-playing island bar for user.

**Expected behavior:**
- Active-track border trail should work cleanly and predictably.
- Rows should highlight around the full row perimeter, not with a weird off-axis line.
- Now playing / island visuals should stay consistent with imported artwork / auto art state.

**Suspected root cause:**
- Border-trail implementation is attached to the wrong element or transform context.
- Surface-specific artwork/state rendering may not be synchronized.

**Files to inspect:**
- components rendering track rows and tiles
- now playing / mini player / island-bar components
- any border-trail effect implementation

**Codex notes:**
- Keep this visual-only at first.
- First fix correctness before adding any additional flourish.

**Diagnosis note — 2026-04-01 Codex:**
- `src/components/BorderTrail.tsx` currently renders a standalone absolutely positioned span that uses a rotating `conic-gradient` `border-image`. That rotates the gradient as a whole rather than tracing the actual rectangle path, which explains the “weird rotating line on a strange axis” report, especially on rows.
- The row trail is attached to the outer `.trackRow`, which is correct for scope, but the tile trail is currently attached to the outer `.ytm-tile` article instead of the artwork container itself. That misses the requested perimeter target for tile mode.
- The state logic in `BorderTrail` is already close to the requested behavior: paused or mute resolves to white + paused animation, while dim keeps aura color at reduced opacity. The main failure is the rendering primitive and where it is mounted.

**Implementation log — 2026-04-01 Codex:**
- Replaced the old rotating `border-image` trail with an SVG rectangle stroke in `src/components/BorderTrail.tsx`, animated through `stroke-dashoffset` so the trail follows the real perimeter instead of rotating on a detached axis.
- Tile mode now mounts the trail on `.ytm-cover` in `src/components/TrackTile.tsx`, so the active border runs around the artwork container rather than the whole card.
- Row mode still mounts on `.trackRow`, but now uses the same perimeter-following SVG stroke so the trail wraps the full row container correctly.
- Paused or mute still overrides to a white paused stroke, while dim mode keeps the aura-colored animation at reduced opacity.

---

### 4. UI polish / hero / sparkles / animation consistency
**Status:** fix implemented, awaiting QA

**Observed behavior:**
- Fun fix requested: tapping the horizontal PolyPlay logo should flash and emit aura-colored sparkles for a few seconds.
- Repeated taps should be allowed within reason, with guardrails to avoid CPU abuse.
- Matching animation consistency request:
  - current shuffle activation has a great set of effects
  - user wants a matching/similar effect when Repeat 3 is activated

**Expected behavior:**
- PolyPlay logo tap effect should feel premium, aura-colored, lightweight, and safe to spam within guardrails.
- Repeat 3 activation should feel as special/consistent as shuffle activation.

**Suspected root cause:**
- Not implemented yet / polish feature request.

**Files to inspect:**
- hero/header/logo interaction components
- shuffle activation effect logic
- repeat-state activation logic

**Codex notes:**
- Treat logo sparkles as a fun low-priority polish task after bugs.
- Reuse existing animation patterns where possible for repeat-three consistency.

**Diagnosis note — 2026-04-01 Codex:**
- The current horizontal PolyPlay logo in `src/App.tsx` is a plain `img` with no interaction handler, so there is no existing tap target or effect guardrail to build on directly.
- The app already has a lightweight burst system in `src/App.tsx` (`safeTapBursts`) and an existing button sparkle treatment in `src/components/PlayerControls.tsx` (`emitPinkSparkle(...)`). Reusing those is the narrowest path.
- Repeat-three currently only gets a small glow class plus the same short flash used for replay countdown updates. There is no dedicated activation effect when the repeat mode first enters `repeat-3`.

**Implementation log — 2026-04-01 Codex:**
- Block start: reuse the existing burst/effect systems for a guarded logo sparkle effect and a stronger repeat-three activation effect without widening the hero or playback scope.
- `src/App.tsx` + `styles.css`: the horizontal logo is now a dedicated button that triggers a short flash and a staged sequence of aura-colored sparkle bursts using the existing `safeTapBursts` layer.
- Logo sparkle guardrails: reduced-motion respects a single lighter burst, taps are throttled, and pending sparkle timeouts are capped so repeated taps stay responsive without stacking unbounded work.
- `src/components/PlayerControls.tsx` + `src/components/player.css`: repeat-three activation now reuses the existing repeat flash channel plus the same sparkle-burst helper used by shuffle, with a slightly stronger activation pulse only when mode enters `repeat-3`.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The logo tap effect is currently using the generic `safeTapBursts` overlay from `src/App.tsx`. That primitive is intentionally large, soft, and bloom-heavy (`--tap-size` around 120px with broad radial fills in `styles.css`), so even the `"sparkle"` variant still reads like a blob/flare instead of pixie dust when reused for the logo.
- The narrowest fix is to stop using the full-screen burst primitive for the logo and switch to a dedicated tiny-particle sparkle trail localized to the logo button itself.

**Implementation log — 2026-04-01 Codex:**
- Follow-up block start: replace the oversized logo burst with a dedicated lightweight pixie-dust particle treatment, and replace the broken border-image trail with a perimeter-following stroke attached to the correct tile/row surfaces.
- `src/App.tsx` + `styles.css`: the logo tap effect no longer uses the generic full-screen `safeTapBursts` primitive. It now spawns small localized logo sparkles with short drift/twinkle motion inside the logo button itself, which reads as pixie dust instead of a large bloom/blob.
- Logo guardrails remain narrow: taps are still throttled, pending timers are capped, active sparkles are capped, and reduced-motion keeps the sequence lighter.

---

### 5. Settings / links / support
**Status:** diagnosis in progress

**Observed behavior:**
- Terms, Privacy, and Support buttons on iOS still do not work.

**Expected behavior:**
- All three links should open correctly on iOS.

**Suspected root cause:**
- Existing attempted fix may not actually be wired into the iOS interaction path.

**Files to inspect:**
- settings/footer link rendering
- Capacitor/browser/open-url handling
- iOS-specific link/open helpers

**Codex notes:**
- This remains open and unverified despite prior work.

**Diagnosis note — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx` attempts to open links through a Capacitor `Browser` plugin, but the repo does not currently include `@capacitor/browser`. On iOS, the fallback `window.open(...)` path is likely a no-op inside the webview, which explains why Terms, Privacy, and Support still fail.
- `SUPPORT_URL` is currently `/support` while the actual static asset in `public/` is `support.html`. Even if native opening is repaired, Support still points at the wrong path for this static app build.

**Implementation log — 2026-04-01 Codex:**
- Block 5 start: fix support URL and bypass the broken Browser / `window.open(...)` path for same-origin static pages so iOS settings links can navigate reliably inside the app webview.
- Block 5 complete: support now points at `/support.html`, and same-origin legal/support links navigate directly within the admin webview instead of relying on the unavailable Capacitor Browser path.

---

### 6. Auto art / visual generation bugs
**Status:** open

**Observed behavior:**
- Weird oversaturated bright pink auto art happened again.
- Same auto art did not appear on now-playing island bar for user.
- Visual consistency is off.

**Expected behavior:**
- Auto art should not suddenly produce bizarre oversaturated pink results.
- Auto art should remain consistent across player surfaces, including island/now-playing displays.

**Suspected root cause:**
- Auto art generation/render pipeline may be unstable.
- Color-treatment or theme blending may be leaking into art rendering.
- Different surfaces may use different image/art sources.

**Files to inspect:**
- auto art generation path
- artwork rendering across tiles/rows/now-playing/island
- theme blending / compositing logic

**Codex notes:**
- Fix correctness first; polish can wait.

---

## Commits / checkpoints
- Metadata-assisted import was implemented but needs real-world QA and may be implicated in import regressions.
- Loop system is improved but still unstable in live use.
- Repeat state machine was recently updated and still needs QA.
- Cinema guard was adjusted to unlock after editing, but broader fullscreen/loop UX still needs work.

## Blockers
- Codex rate limit is low, so work should stay diagnosis-first and narrow.
- Avoid broad multi-feature passes until core regressions are stabilized.

## QA checklist
- [ ] Reproduce issue
- [ ] Root cause documented
- [ ] Fix implemented
- [ ] Typecheck/build passes
- [ ] Live QA completed

## Suggested next Codex session order
1. Import-page brick / metadata-artwork regression
2. Loop viewport + fullscreen exit behavior
3. iOS settings links
4. Active-track border trail correctness
5. Auto art correctness
6. Artist autocomplete behavior
7. Polish items (logo sparkles / repeat-three matching animation)

## Next Codex session starter
Use this MD as the working source of truth.
Start by summarizing the top 3 open bugs, propose the single next task, and update this file with a session-start note before editing code.
