# PolyPlay Final Planning Board — 2026-04-03

Use this file as the master planning sheet for the current release-finalization pass.

## Purpose
This board is for **planning only**.

Codex should:
- read the tasks
- inspect likely code paths
- propose implementation direction
- estimate complexity/risk
- recommend execution order

Codex should **not**:
- implement code
- commit changes
- widen scope
- improvise new features beyond the listed tasks

---

## Source context
Primary handoff:
- `/Users/paulfisher/Polyplay/docs/polyplay_codex_handoff_2026-04-03.md`

Supplemental task list:
- `polyplay_finalizing_fixes_2026-04-03.md`
- Planning note: this supplemental file was not present in the repo during this pass, so recommendations below are based on the handoff, this planning board, and direct code inspection.

---

## Planning rules for Codex
1. This is a planning-only pass.
2. Do not edit app behavior yet.
3. For each numbered task:
   - inspect likely code path(s)
   - identify most likely root cause
   - list likely files involved
   - estimate complexity/risk
   - recommend:
     - implement now
     - split into smaller task(s)
     - defer until after release
4. If a task is ambiguous, say so explicitly.
5. Favor safer release decisions over broader ambition.
6. Do not auto-commit.

---

## Output format for each task
Under each task, fill in:

- **Planning status:** not reviewed / reviewed
- **Likely root cause:**
- **Likely files involved:**
- **Complexity/risk:** low / medium / high
- **Recommended action:** implement now / split / defer
- **Suggested implementation order:** number or note
- **Notes for implementation:**

---

## Top-level release triage
After reviewing tasks, add a summary for:

### Release blockers
- 5. Repeat button audit
- 8. Notes + microphone breaks Now Playing
- 9. Now Playing / competing audio audit

### Safe to implement before release
- 1. Safari mobile tooltip alignment
- 4. MX theme effect color correction
- 5. Repeat button audit

### Risky / should defer
- 7. Demo playlist deep dive
- 9. Now Playing / competing audio audit
- 11. Shake gesture idea

### Recommended execution order
1. 5. Repeat button audit
2. 1. Safari mobile tooltip alignment
3. 4. MX theme effect color correction
4. 10. Backup systems audit as a narrow QA checklist, not a redesign
5. 8. Notes + microphone recovery only if reduced to one concrete interruption-resume task
6. 2. Merica theme effect redesign only if split into a small theme-specific FX pass
7. 3. Rasta theme effect redesign only if split into a small theme-specific FX pass
8. 6. Onboarding audit cleanup only as narrowly repro'd fixes
9. 7. Demo playlist deep dive after release
10. 9. Broad Now Playing / competing audio audit after release unless a single native repro becomes mandatory
11. 11. Shake gesture idea after release

---

## Active implementation task

### Merica background edge softening + star blur gradient
**Status:** fix implemented, awaiting QA

**Goal:**
Soften the Merica background seams and give the lower star band a clearer top edge with a downward atmospheric fade.

**Notes:**
- Diagnosis start — 2026-04-03 Codex:
- Files inspected:
  - `styles.css`
  - `docs/polyplay_codex_handoff_2026-04-03.md`
  - `docs/polyplay_final_planning_board_2026-04-03.md`
- Suspected root cause:
  - The Merica star rows are rendered as crisp repeated SVG tiles in `body.theme-custom.theme-custom-merica::after`, so the lower band reads too literal and too evenly sharp from top to bottom.
  - The Merica drift field in `body.theme-custom.theme-custom-merica::before` still contains a few hard-stop blue-panel gradients, which creates visible seam lines instead of feathered atmospheric transitions.
  - This looks like a CSS layering problem inside the existing Merica pseudo-layers, not a broader theme-system problem.
- Exact fix made:
  - Kept the pass CSS-only and limited to `body.theme-custom.theme-custom-merica` in `styles.css`.
  - Replaced the hardest blue field cutoffs in `::before` with feathered horizontal and vertical fade ramps so the drifting base no longer shows sharp rectangular panel edges.
  - Changed the lower repeated star row in `::after` from a flat-fill SVG tile to a gradient-fill SVG tile whose opacity is strongest near the top of the band and fades down to transparent, so the band stays patriotic but softens downward instead of ending in a harsh cutoff.
  - Added one low-opacity radial haze layer behind that lower star band and slightly increased the pseudo-layer blur from `0.2px` to `0.35px` to smooth tile seams without changing the Merica palette or widening into a redesign.
- Exact files changed:
  - `styles.css`
  - `docs/polyplay_final_planning_board_2026-04-03.md`
- Regression risk:
  - Low to medium. The pass is Merica-only and CSS-only, but it changes how the star band reads and how the blue field transitions feather out.
- QA still needed:
  - Confirm the lower star row stays readable enough to feel patriotic while fading downward more atmospherically.
  - Confirm the previous hard blue panel seams are no longer visible during drift.
  - Confirm the Merica background still reads beam-first rather than muddy.
  - Confirm text and controls remain readable on desktop and iPhone.

### Combined theme-effect task: Merica fireworks + MX FX color correction
**Status:** fix implemented, awaiting QA

**Goal:**
Keep the pass limited to theme FX behavior so Merica uses a fireworks treatment and MX stops reading purple.

**Notes:**
- Diagnosis start — 2026-04-03 Codex:
- Files inspected:
  - `src/fx/ambientFxEngine.ts`
  - `src/App.tsx`
  - `docs/polyplay_codex_handoff_2026-04-03.md`
  - `docs/polyplay_final_planning_board_2026-04-03.md`
- Suspected root cause:
  - Merica currently routes through the same generic `splatter` engine branch as every other theme, so it never gets a theme-specific fireworks spawn/render treatment and the toast still says `Splatter`.
  - MX still reads purple because the FX engine uses `auraHue(tokens)` and `weightedHue()` in several branches; with MX the aura is white, so `rgbToHue()` falls back to the engine’s default purple hue path instead of staying inside the green/white/red palette.
- Exact fix made:
  - Kept the change limited to `src/fx/ambientFxEngine.ts` and the FX toast-label path in `src/App.tsx`.
  - Added theme-slot awareness to the ambient FX token resolution so the engine can distinguish Merica and MX without widening into the broader theme system.
  - Replaced Merica’s generic `splatter` tap behavior with a fireworks-style burst inside the existing splatter mode: a brief white flash core, larger palette-colored burst particles, and larger sparkles using only Merica’s blue/white/red palette.
  - Updated the Merica splatter-mode toast label in `src/App.tsx` so it now reads `FX: Fireworks`.
  - Removed MX purple contamination by preventing MX hue selection from falling back to the engine’s generic purple ranges and by assigning MX splatter particles directly from the MX green/white/red palette.
- Exact files changed:
  - `src/fx/ambientFxEngine.ts`
  - `src/App.tsx`
  - `docs/polyplay_final_planning_board_2026-04-03.md`
- Regression risk:
  - Low to medium. The pass is contained to ambient FX behavior for Merica and MX, but it changes theme-aware color and splatter rendering logic in the shared engine.
- QA still needed:
  - Confirm Merica splatter mode now reads as premium fireworks rather than paint splatter.
  - Confirm the Merica toast says `FX: Fireworks`.
  - Confirm Merica fireworks only use blue, white, and red.
  - Confirm MX effects no longer drift purple in splatter, gravity, or pop mode.
  - Confirm performance remains acceptable on iPhone.
  - Follow-up diagnosis — 2026-04-03 Codex:
    - The first fireworks pass fixed theme specificity and per-burst color, but the Merica bursts still read too small because the burst radius, particle velocity, and streak geometry are still tuned like compact spark clusters rather than large chrysanthemum-style shells.
  - Follow-up exact fix made:
    - Kept the pass limited to `spawnMericaFireworks(...)` in `src/fx/ambientFxEngine.ts`.
    - Increased the central bloom radius and lifespan, increased burst count, increased outward particle travel and velocity, and stretched the burst ellipses into longer narrow streaks so each shell reads larger and more sky-filling.
    - Increased Merica sparkle size and speed so the shell perimeter reads more like long fireworks spokes rather than a tight spark cluster.
  - Follow-up exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `docs/polyplay_final_planning_board_2026-04-03.md`
  - Follow-up regression risk:
    - Low to medium. The pass is still Merica-only in behavior, but it increases burst size and on-screen FX occupancy.
  - Follow-up QA still needed:
    - Confirm Merica fireworks now feel large enough relative to the screen.
    - Confirm the bursts read like long-spoke fireworks rather than compact spark blobs.
    - Confirm performance remains acceptable on iPhone.
  - Follow-up refinement — 2026-04-03 Codex:
    - Updated only the Merica sparkle color so every fireworks spawn now carries bright amber spark highlights inspired by the reference image, while the main burst body still stays single-color per spawn.
  - Follow-up refinement — 2026-04-03 Codex:
    - Reduced the Merica glitter particle sizes so the amber highlights read as finer sparks rather than chunky glitter pieces.
  - Follow-up refinement — 2026-04-03 Codex:
    - Increased the Merica burst travel distance and outward velocity so the shells explode harder and spread farther across the screen.
  - Follow-up refinement — 2026-04-03 Codex:
    - Tightened the Merica amber highlights so they render as hotter, sharper spark streaks instead of soft pillowy dots.
  - Follow-up refinement — 2026-04-03 Codex:
    - Added a stronger white-hot spawn flash and shortened the Merica shell persistence with slightly fewer long-lived streaks, so repeat taps read sooner and the effect costs less CPU.
  - Follow-up refinement — 2026-04-03 Codex:
    - Strengthened the Merica spawn flash with a brighter white core and lifted blue-burst brightness so blue fireworks read more clearly against the background.
  - Follow-up refinement — 2026-04-03 Codex:
    - Tightened the Merica shell streak geometry and increased shell alpha so the fireworks read a little skinnier and brighter.
  - Follow-up refinement — 2026-04-03 Codex:
    - Added a quick brightness flicker to the Merica shell streaks so the fireworks shimmer briefly instead of holding one flat brightness level.
  - Follow-up refinement — 2026-04-03 Codex:
    - Added a fast Merica spawn-scale burst so the shell streaks explode outward quickly on spawn instead of only growing at a steady rate.
  - Follow-up refinement — 2026-04-03 Codex:
    - Corrected the Merica spawn-burst timing so the shell now starts tighter and expands fast, instead of starting oversized and shrinking first.
  - Follow-up refinement — 2026-04-03 Codex:
    - Reduced how often Merica chooses white-only shells, added alternate blue/red burst shades, and randomized burst rotation/spacing so repeated fireworks do not look identical.
  - Follow-up refinement — 2026-04-03 Codex:
    - Changed the Merica shell streak render from smooth solid pills to thinner segmented trail pieces with a brighter tip, so the fireworks feel less like perfect vector lines and closer to broken pyrotechnic streaks.
  - Follow-up refinement — 2026-04-03 Codex:
    - Thinned the Merica streak segments further and added a few tiny hard bright ember pixels inside the trails so the burst mix includes sharper spark points instead of only chubbier soft segments.
  - Follow-up refinement — 2026-04-03 Codex:
    - Added a few extra-hot Merica crackle particles in flash white and amber so each burst can throw a couple of tiny bright popping points above the normal spark field.
  - Follow-up refinement — 2026-04-03 Codex:
    - Lengthened and thinned the Merica shell streaks, brightened the shell-tip read, reduced supporting particle counts slightly for CPU safety, and added a stronger short-lived screen flash at spawn for a more explosive hit.

---

## Tasks to review

### 1. Safari mobile tooltip alignment
**Observed issue:**
Tooltip is not aligned with its button on Safari mobile.

**Desired behavior:**
Tooltip should anchor correctly to the intended button and remain visually aligned on mobile Safari.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: the onboarding tooltip is absolutely positioned from a wrapper that can shift width on mobile Safari, and the current mixed `right`/`left` anchoring plus animated transforms likely causes offset drift relative to the `New` button.
- Likely files involved: `styles.css`, `src/App.tsx`
- Complexity/risk: low
- Recommended action: implement now
- Suggested implementation order: 2
- Notes for implementation:
  - Diagnosis start — 2026-04-03 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `styles.css`
    - `docs/polyplay_final_planning_board_2026-04-03.md`
  - Suspected root cause:
    - The tooltip is rendered as an absolutely positioned sibling inside `.playlist-selector__action-wrap`, so its offset parent is the entire action cluster, not the `New` button.
    - On mobile Safari, that means the bubble centers against the full `prev / next / New` control row and can look detached from the intended trigger as the wrap width shifts.
    - This is mostly a positioning-structure problem, not a copy or onboarding-state problem.
  - Exact fix made:
    - Wrapped the `New` button and tooltip in a dedicated `.playlist-selector__tutorial-anchor` container in `src/App.tsx`.
    - Updated `styles.css` so the tooltip and arrow always anchor from `left: 50%` of that button wrapper, removing the earlier cluster-level positioning that was causing the detached Safari mobile alignment.
    - Kept the tooltip copy, visibility behavior, and onboarding flow unchanged.
  - Exact files changed:
    - `src/App.tsx`
    - `styles.css`
    - `docs/polyplay_final_planning_board_2026-04-03.md`
  - Regression risk:
    - Low. The change is limited to the onboarding tooltip anchor and positioning.
  - QA still needed:
    - Confirm the tooltip centers above the `New` button on iPhone Safari.
    - Confirm the bubble no longer appears centered over the full `prev / next / New` cluster.
    - Confirm desktop alignment still feels correct.
    - Confirm the tooltip still appears and dismisses exactly once as before.

---

### 2. Merica theme effect redesign
**Observed issue:**
Current splatter effect should be replaced.

**Desired behavior:**
Replace splatter with a fireworks effect.
Toast should say `Fireworks`.
Each spawn should choose a random color from the Merica palette:
- blue `#0A3161`
- white `#FFFFFF`
- red `#B31942`

Include flash and big fireworks sparkles.
Keep it premium, exciting, and not tacky.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: the ambient FX system only supports shared global modes (`gravity`, `pop`, `splatter`), so Merica still inherits the generic splatter implementation instead of a theme-specific fireworks renderer and theme-specific toast label.
- Likely files involved: `src/fx/ambientFxEngine.ts`, `src/components/AmbientFxCanvas.tsx`, `src/App.tsx`, `styles.css`
- Complexity/risk: medium
- Recommended action: split
- Suggested implementation order: 6
- Notes for implementation: split into two substeps: first add theme-aware FX labeling and mode presentation for Merica; second replace only the Merica `splatter` branch with a controlled fireworks burst that uses the existing theme palette tokens and keeps mobile caps/perf intact.

---

### 3. Rasta theme effect redesign
**Observed issue:**
Current splatter effect should be replaced.

**Desired behavior:**
Replace splatter with smoke plumes.
Toast should say `Smoke`.
Draw 3 hex-gradient smoke clouds/plumes using the Rasta palette:
- green `#078930`
- yellow `#FCDD09`
- red `#DA121A`

Should feel smoky, warm, and atmospheric rather than like paint splatter.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: Rasta also inherits the shared splatter renderer, so the current effect language is wrong at the engine level rather than just needing CSS color tweaks.
- Likely files involved: `src/fx/ambientFxEngine.ts`, `src/components/AmbientFxCanvas.tsx`, `src/App.tsx`, `styles.css`
- Complexity/risk: medium
- Recommended action: split
- Suggested implementation order: 7
- Notes for implementation:
  - Diagnosis start — 2026-04-03 Codex:
  - Files inspected:
    - `src/fx/ambientFxEngine.ts`
    - `src/components/AmbientFxCanvas.tsx`
    - `src/App.tsx`
    - `docs/polyplay_final_planning_board_2026-04-03.md`
  - Suspected root cause:
    - Rasta still routes through the generic `splatter` branch, so its tap FX language is paint-like radial blobs rather than plume-shaped smoke clusters.
    - The current theme-aware FX changes also leave old particles alive across theme switches because theme-token refresh does not clear active particles, which is why Merica fireworks could remain visible until the user cycled FX.
    - This is still an FX-engine behavior problem, not a background-art problem.
  - Exact fix made:
    - Kept the pass limited to the FX engine, FX refresh path, and the toast label path.
    - Replaced Rasta’s generic splatter tap behavior with a dedicated smoke-plume variant in `src/fx/ambientFxEngine.ts` that spawns 3 large, slow, soft plume clouds using the Rasta green/yellow/red palette.
    - Updated the splatter-mode toast label in `src/App.tsx` so Rasta now says `FX: Smoke`.
    - Cleared active FX particles on `themeRefreshKey` changes in `src/components/AmbientFxCanvas.tsx` so old theme-specific particles do not persist after switching themes.
    - Also tightened Merica fireworks color behavior in the shared FX engine so each burst now uses one randomly chosen theme color for the whole burst instead of mixing multiple theme colors inside one spawn.
  - Exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `src/components/AmbientFxCanvas.tsx`
    - `src/App.tsx`
    - `docs/polyplay_final_planning_board_2026-04-03.md`
  - Regression risk:
    - Low to medium. The pass stays within theme FX behavior, but it touches shared engine branching and theme-refresh cleanup.
  - QA still needed:
    - Confirm Rasta splatter mode now reads as smoke plumes rather than paint splatter.
    - Confirm the Rasta toast says `FX: Smoke`.
    - Confirm the 3 plume colors stay within the Rasta palette.
    - Confirm switching away from Merica no longer leaves fireworks particles on screen until FX is cycled.
    - Confirm performance remains acceptable on iPhone.

---

### 4. MX theme effect color correction
**Observed issue:**
MX theme effects are reading purple.

**Desired behavior:**
Use a rasterized gradient derived from the MX palette instead:
- green `#006341`
- white `#FFFFFF`
- red `#C8102E`

No purple contamination. Preserve performance.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: the FX engine still allows purple-biased fallback hue generation through `weightedHue()` and heavily favors `auraHue()`, while the MX theme uses a white aura, so the effect can drift toward the app's default purple family instead of staying locked to the MX tricolor palette.
- Likely files involved: `src/fx/ambientFxEngine.ts`, `src/App.tsx`, `styles.css`
- Complexity/risk: low to medium
- Recommended action: implement now
- Suggested implementation order: 3
- Notes for implementation: keep this surgical by changing MX palette resolution and/or hue selection only for MX theme FX; do not redesign the full effect behavior in the same pass.

---

### 5. Repeat button audit
**Observed issue:**
A user reported that the regular repeat button did not repeat the current song and instead went to the next playlist item.

**Desired behavior:**
Regular repeat should behave correctly and predictably.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: the runtime distinguishes `repeat` from counted repeat modes, but the `ended` handler only replays automatically through `handleThreepeatReplay()` for counted modes; plain `repeat` then falls through to shuffle/adjacent-track advance, which matches the reported bug.
- Likely files involved: `src/App.tsx`, `src/components/PlayerControls.tsx`, `src/types.ts`
- Complexity/risk: low to medium
- Recommended action: implement now
- Suggested implementation order: 1
- Notes for implementation:
  - Diagnosis start — 2026-04-03 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/components/PlayerControls.tsx`
    - `docs/polyplay_final_planning_board_2026-04-03.md`
  - Suspected root cause:
    - The repeat button correctly cycles into the plain `repeat` mode and persists that state.
    - But `src/App.tsx` only replays automatically through `handleThreepeatReplay(...)`, which explicitly returns `false` unless the mode is `repeat-1`, `repeat-2`, or `repeat-3`.
    - That leaves plain `repeat` with no replay branch in `onEnded`, so playback falls through into shuffle/adjacent-track advance instead of restarting the current track.
  - Exact fix made:
    - Added a plain-repeat replay path in `src/App.tsx` so `repeatTrackMode === "repeat"` now seeks back to the start of the current track and calls `play()` again when the audio `ended` event fires.
    - Left counted repeat modes, button progression, labels, haptics, toasts, shuffle behavior, and loop-mode behavior unchanged.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_final_planning_board_2026-04-03.md`
  - Regression risk:
    - Low. The behavior change is isolated to the plain `repeat` branch inside the `ended` handler.
  - QA still needed:
    - Confirm plain `repeat` restarts the same track at natural track end.
    - Confirm `repeat-1`, `repeat-2`, and `repeat-3` still decrement/replay exactly as before.
    - Confirm shuffle still advances to another track when repeat is off.
    - Confirm loop-region playback behavior is unchanged.
    - Confirm remote next/previous controls are unaffected.

---

### 6. Onboarding audit cleanup
**Observed issue:**
Onboarding may still have cleanup needs.

**Desired behavior:**
Tooltips, first-run messaging, and first playlist flow should feel clean and not fight the main player.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: onboarding is spread across quick-tour phase state, multiple persisted hint flags, empty-library welcome logic, playlist creation guidance, and topbar/player hints, so cleanup risk comes from cross-state overlap rather than one obvious broken component.
- Likely files involved: `src/App.tsx`, `src/components/EmptyLibraryWelcome.tsx`, `src/components/MiniPlayerBar.tsx`, `src/components/PlayerControls.tsx`, `styles.css`, `src/components/player.css`
- Complexity/risk: medium to high
- Recommended action: split
- Suggested implementation order: 8
- Notes for implementation: do not do a broad "cleanup" pass; reduce this to one repro at a time such as duplicate guidance, stale hint persistence, or tooltip conflict with the main player.

---

### 7. Demo playlist deep dive
**Observed issue:**
Need a deeper audit of the demo playlist for potential bugs.

**Desired behavior:**
Demo playlist should inspire trust and behave cleanly in first-run/onboarding/import scenarios.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: the demo playlist lifecycle is handled by several startup reconcile paths plus demo seeding/restore/normalization logic, so broad auditing here risks destabilizing first-run behavior that is currently heavily guarded.
- Likely files involved: `src/App.tsx`, `src/lib/demoSeed.ts`, `src/lib/library.ts`, `src/lib/backup.ts`
- Complexity/risk: high
- Recommended action: defer
- Suggested implementation order: after release
- Notes for implementation: only reopen before release if a concrete demo repro appears; otherwise preserve the current startup/demo behavior and audit it with device QA after the release build is stable.

---

### 8. Notes + microphone breaks Now Playing
**Observed issue:**
Using Notes + microphone on iPhone while plugged into car can break Now Playing and playback may not auto-resume.

**Desired behavior:**
PolyPlay should recover gracefully from interruptions and auto-resume when appropriate.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: current recovery logic is mostly browser-level (`visibilitychange`, `focus`, playback resync) and does not appear to include explicit native audio-interruption lifecycle handling for iPhone microphone capture scenarios, so Notes + microphone likely leaves playback and Now Playing state desynced after the interruption ends.
- Likely files involved: `src/App.tsx`, `src/lib/iosNowPlaying.ts`, `src/lib/mediaSession.ts`, `ios/App/App/NowPlayingPlugin.swift`
- Complexity/risk: high
- Recommended action: split
- Suggested implementation order: 5
- Notes for implementation: narrow this to one task such as "recover playback/Now Playing after iOS interruption end" with a verified repro; broad interruption/platform work is too risky to improvise late.

---

### 9. Now Playing / competing audio audit
**Observed issue:**
Competing media apps like Rumble may reclaim Now Playing. Pressing mute may fall back to another app. End-of-track transitions may load next track without auto-playing.

**Desired behavior:**
Now Playing should remain stable and predictable across track transitions, mute behavior, interruptions, and competing media apps.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: this is not one bug; it mixes Media Session transport binding, iOS Now Playing ownership, mute-state semantics, track-transition autoplay, and competition with external apps, so the reported failures likely come from multiple control surfaces that are only partially synchronized.
- Likely files involved: `src/App.tsx`, `src/lib/mediaSession.ts`, `src/lib/iosNowPlaying.ts`, `ios/App/App/NowPlayingPlugin.swift`, possibly native iOS audio-session glue outside the current JS bridge
- Complexity/risk: high
- Recommended action: defer
- Suggested implementation order: after release unless reduced to one specific blocker repro
- Notes for implementation: treat this as an audit umbrella, not a pre-release implementation task; if release pressure requires action, carve out one concrete subtask such as end-of-track autoplay continuity or mute behavior, not the whole competing-audio problem.

---

### 10. Backup systems audit
**Observed issue:**
Need a full audit of backups before release.

**Desired behavior:**
Vault backups, journal backups, export naming, restore behavior, and data safety should feel trustworthy.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: backup behavior now spans full Vault export/import, config import/export, journal backup import/export, save-name prompting, demo-track exclusion, and mobile save fallbacks; the main risk before release is missed edge-case QA, not one obvious broken code path from inspection alone.
- Likely files involved: `src/lib/backup.ts`, `src/App.tsx`, `src/components/JournalModal.tsx`, `src/lib/saveBlob.ts`
- Complexity/risk: medium to high
- Recommended action: split
- Suggested implementation order: 4
- Notes for implementation: make this a checklist audit first: full backup export/import, journal backup export/import, filename prompts, restore of repeat/theme/layout, and demo-track exclusion. Only implement if that audit reveals one narrow bug.

---

### 11. Shake gesture idea
**Observed issue:**
Shaking iPhone on the play screen triggers the iOS undo prompt.

**Idea to evaluate:**
Potentially use shake to trigger a random theme change with toast:
`Switched it up`

**Desired behavior:**
Only pursue this if safe and realistic after release blockers are stable.

**Planning notes:**
- Planning status: reviewed
- Likely root cause: this is an opportunistic feature idea, not a defect; it would also intersect with motion sensors, gesture conflicts, and iOS system behavior around shake/undo.
- Likely files involved: `src/App.tsx`, possibly a new motion-sensor utility or Capacitor/native bridge if pursued seriously
- Complexity/risk: medium
- Recommended action: defer
- Suggested implementation order: after release
- Notes for implementation: do not pursue before release; the current user-facing issue is the iOS undo prompt, and replacing that with a feature adds new product and platform risk for no release safety gain.

---

## Final recommendation section
After reviewing all tasks, write:

### Best next 3 tasks before release
1. 5. Repeat button audit, because the current code inspection strongly supports the reported wrong-next-track behavior and the fix should be narrow.
2. 1. Safari mobile tooltip alignment, because it appears localized to onboarding tooltip positioning and is low risk.
3. 4. MX theme effect color correction, because the purple contamination looks like a contained palette-selection bug rather than a full FX redesign.

### Tasks to avoid right now
- 7. Demo playlist deep dive without a concrete repro
- 9. Broad Now Playing / competing audio rewrite
- 11. Shake gesture idea
- 6. General onboarding cleanup not tied to one reproducible issue

### One-sentence release advice
- Fix the confirmed narrow regressions first, and resist broad playback/onboarding/theme redesigns unless they can be reduced to one clearly reproducible release blocker.
