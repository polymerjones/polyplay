# PolyPlay Codex Handoff — 2026-03-31 Morning Build

## Purpose
This file is the current handoff for Codex. Use this as the source of truth for the next work session.

## Context
Good afternoon. This is the dump from last night testing and this morning testing.

There have been disruptions with Codex, and I am not sure my latest PNG was actually implemented in the app. The previous logo PNG had a tiny green stroke left from chroma keying. A newer file was created with two Photoshop strokes to hide that edge contamination better. Do not assume the currently visible hero logo is the final intended asset.

## Current priorities
Work from highest user pain / most broken UX first.

1. Loop creation / loop editing workflow
2. Major play controls inactive bugs on iOS and desktop
3. Safari desktop fullscreen / loop workflow problems
4. iOS app settings bottom links not opening
5. Repeat button behavior / label confusion
6. Hero logo asset verification and implementation cleanup
7. Track metadata / artist field improvements
8. Siri support research and implementation planning

---

## 1. LOOPS — major broken / confusing workflow
Loop creation currently feels like the buggiest part of the app on both iOS and desktop.

### Current observed issues
- User ended up wanting a particular timecode loop, but the waveform was zoomed out and not centered around the loop with a useful buffer.
- User tried to use the magnifying glass / loop zoom workflow.
- The `+` button allowed only a few zoom-ins and then seemed to stop working before the loop was actually usable.
- Even after several zoom-ins, it still did not get close enough to the target loop.
- User is confused about what the “final step” is once the desired loop is created.
- There should be a **confirm / done** button next to the magnifying glass.
- That confirm button should match the magnifying glass button styling, but with an obvious **“I’m done” / check** icon.
- User is having an extremely hard time grabbing the loop **start marker**.
- Instead of grabbing the loop marker, the app keeps scrubbing the track to an earlier play position.
- While actively creating/editing a loop, user probably should **not** be able to scrub the playhead outside the loop-marker interaction surface.
- Possible desired behavior:
  - while a loop is being created, loop markers get interaction priority
  - playhead scrubbing inside the waveform editor is guarded / limited
  - the main seek bar may still remain independent so the user can navigate the full song outside of the loop editor

### Loop workflow confusion
- User does not have a clear “confirm loop” step.
- Maybe a confirm step is not strictly required logically, but from a UX standpoint user seems to need one.
- Loop creation and loop editing feel like a state machine the user cannot read.

### Loop cleanup pass plan
- Task: normalize the loop button/toolbar state and exit hints now that editing guards, zoom, and persistence improve. Root causes to address:
  1. `primaryLoopLabel` is currently based on `hasLoopBounds`, but the fallback for `safeLoopEnd` means the button already shows `Edit Loop` even before the user creates a loop. We need to tie the label/behavior to `loopRegion.active`.
  2. Magnifying glass controls should truly behave as a toggle (opening/closing the ± controls without disrupting the session); ensure the handler keeps closing the controls cleanly.
  3. Fullscreen exit hint copy should match iOS vs desktop states and avoid showing exit tips while editing.
  4. Confirm no residual “Finish Loop Edit” messaging or check button logic leaks into this pass.

### Loop cleanup pass applied
- Root causes addressed:
  1. The loop button previously relied on `hasLoopBounds`, which was true anytime the duration was known because `safeLoopEndCandidate` fell back to the track length even without an actual loop. This made the button say `Edit Loop` before any loop existed and never reset to `Set Loop` after clearing.
  2. The fullscreen exit hint text always said “Exit Fullscreen Player” (or the old “Finish Loop Edit To Exit”) regardless of platform or editing state, so iOS users saw the wrong instruction and editing users still saw an exit hint even when exits were disabled.
- Fixes:
  1. Updated `src/components/PlayerControls.tsx` so `hasLoopBounds` now requires `loopRegion.active` before showing `Edit Loop`/`Done`. That keeps the primary button at `Set Loop` until a real loop exists and guarantees it resets to `Set Loop` after `Clear Loop`.
  2. Updated `src/components/FullscreenPlayer.tsx` to compute an exit hint: `Swipe Down to Exit` on iOS, `Exit Fullscreen Player` elsewhere, and a neutral “Loop editing active” message while editing (so no misleading exit copy). The close buttons now share that text while editing stays suppressed, and the button text only switches back to the platform-specific hint once editing ends.
  3. The magnifying glass toggle already opened/closed the ± controls without breaking the session, so no additional change was required there.
- Files changed: `src/components/PlayerControls.tsx`, `src/components/FullscreenPlayer.tsx`.
- Platform impact: loop controls now reliably show `Set Loop`/`Done`/`Edit Loop` as the user expects, and both the top and bottom fullscreen exit buttons reflect the appropriate platform egress hints while suppressing misleading instructions during loop edits.
- Regression risk: low (loop button logic tightened, exit hints only change text). Live QA: still needed to confirm the iOS swipe hint shows up when editing is inactive and both exit buttons stay disabled while editing.

### Session note — loop audit plan
- Issue: markers stay hard to grab because scrubbing jumps the playhead instead of offering a stable loop edit surface.
- Files to inspect: `src/components/WaveformLoop.tsx`, `src/components/MiniPlayerBar.tsx`, `src/components/player.css`.
- Approach: diagnosis-only pass to understand why marker drags trigger playback jumps before attempting any fixes.

### Requested audit points
Please audit the loop workflow logically:
- entering loop mode
- zooming in
- editing start marker
- editing end marker
- confirming done
- exiting loop mode
- returning to normal playback

### Session note — loop audit findings
- Root cause: `.pc-wave__loop-overlay` remains `pointer-events: none` until `loopRegion.editing` flips true, but that flag only updates after a drag exceeds `DRAG_START_DEADZONE_PX` and `onSetLoopRange` is called with `{ editing: true }`. Those first few pixels still fall through to the base waveform, so the user’s initial drag also fires the waveform’s `onSeek` handler and rewinds the playhead before the edit even begins.
- Issue type: hit-area/event-priority mismatch due to delayed editing state—the loop handles never capture the pointer early enough, so `onSeek` grabs the gesture while the user tries to adjust a marker.
- Narrow fix: set the editing flag (or keep the overlay capturing) as soon as a handle becomes pending (on pointerdown) so the overlay blocks the waveform seek while the user is targeting the handle, preventing unintended scrubbing before the drag is recognized.
- Live QA: still needed after the fix to confirm marker drags hold steady and normal waveform seeking remains unaffected.

### Session plan — editing priority fix
- Action: on each loop handle `onPointerDown`, immediately call `onSetLoopRange` with the current safe loop bounds and `{ editing: true, persist: false }` so the overlay captures the pointer before `DRAG_START_DEADZONE_PX` or the first pointermove.
- Files affected: `src/components/WaveformLoop.tsx`.
- Scope: diagnosis + fix for the event-priority glitch; broader loop UX issues remain open.

### Session note — fix applied
- Root cause: loop handles never gained pointer priority until the drag exceeded `DRAG_START_DEADZONE_PX`, so the initial movement hit the waveform and triggered `onSeek`.
- Fix: now each handle `onPointerDown` immediately calls `onSetLoopRange(..., { editing: true, persist: false })`, so the overlay switches to loop-editing mode before the first move and blocks waveform seeks for that interaction.
- Files changed: `src/components/WaveformLoop.tsx`.
- Platform impact: loop editing now blocks unintended scrubbing while still allowing regular seeks elsewhere (since `editing` stays false outside handle drags).
- Regression risk: low for general playback, but live QA still needed to ensure loop editing remains responsive and normal waveform seeking is untouched.

### Session plan — diagnose remaining loop UX gaps
- Task: Diagnose the remaining loop workflow problems (zoom not close enough, + zoom failing, centering/buffer, lack of done step) before any further edits.
- Files to inspect: `src/components/WaveformLoop.tsx`, `src/components/player.css`, `src/components/MiniPlayerBar.tsx` (for toolbar/controls/loop state UI).
- Method: keep diagnosis-only; capture whether issues stem from code limits (zoom buffer math, zoom-level limits) versus UX signals (missing buttons, unclear happened); note narrow fixes later.

### Loop diagnosis — zoom math floors
- Root cause: `buildWindowedViewRange` enforces a `minimumReadableSpan` of `trackDuration / MAX_LOOP_VIEW_SCALE` and adds buffer on top, so even manual zoom cannot shrink the viewport beyond roughly 1/2.75 of the track. That floor prevents tight zoom on small loops, making the view always show huge chunks and the zoom never feels close.
- Issue type: code limitation (zoom math + scale constants), not just UX confusion.
- Next narrow fix: raise `MAX_LOOP_VIEW_SCALE` or make `minimumReadableSpan` depend on loop span/manual zoom so zoom can get tighter before hitting a ceiling.
- Live QA: required after adjusting zoom scale to ensure other zoom states remain stable.

### Session plan — zoom ceiling adjustments
- Task: update the magic constants that drive zoom depth so the `+` button can keep shrinking the viewport for tiny loops without destabilizing other views. Focus on `MAX_LOOP_VIEW_SCALE`, `minimumReadableSpan`, and manual-zoom factors/caps.
- Approach: increase `MAX_LOOP_VIEW_SCALE` (and the drag counterpart) so base ranges can start smaller, extend `MANUAL_ZOOM_FACTORS` so zoom keeps decreasing, and compute a smarter `minimumReadableSpan` that honors the actual loop span + buffer instead of forcing the view to always cover a large chunk of the track.

### Session note — zoom ceiling adjustments applied
- Constants updated: `MAX_LOOP_VIEW_SCALE` bumped from 2.75 to 5.0 and `MAX_DRAG_VIEW_SCALE` from 2.3 to 3.3 so the underlying viewport can start from a much tighter range.
- Manual zoom factors now include deeper steps `[1, 0.86, 0.72, 0.58, 0.46, 0.34, 0.26, 0.18, 0.12]` (with matching `MAX_MANUAL_ZOOM_LEVEL`), letting the `+` control keep shrinking the range even when the old max was reached. The buffer between loop and viewport was trimmed slightly (`MANUAL_ZOOM_BUFFER_SEC = 0.16`) to let the zoom get closer to the loop span.
- `buildWindowedViewRange` now clamps to the actual `loopSpan + buffer * 2` (and its tiny-loop min cap) instead of rigidly using `trackDuration / MAX_LOOP_VIEW_SCALE`, so the viewport stays focused on the selected region before manual zoom further tightens it.
- Files changed: `src/components/WaveformLoop.tsx`, `docs/polyplay_codex_handoff_2026-03-31.md`.
- Regression risk: medium for loop flow since it touches zoom math; live QA still required. The done button and marker priority fixes still stand.

### Loop diagnosis — `+` button maxing out
- Root cause: `manualZoomLevel` is clamped 0–`MAX_MANUAL_ZOOM_LEVEL` (4) with discrete factors `[1,0.86,0.72,0.58,0.46]`. Once the user hits level 4, `+` is disabled even though the viewport still feels wide, giving the impression the button stopped working.
- Issue type: code limitation (limited zoom steps + enforced cap).
- Next narrow fix: either add smaller zoom factors (e.g., extend the array) or allow additional increments beyond level 4 to keep the button responsive until the real zoom floor (minimum span) is reached.
- Live QA: required to verify the new range still behaves smoothly.

### Loop diagnosis — viewport centering after edit
- Root cause: when editing finishes, the `loopRegion.editing` flag goes false and the `viewRange` effect soon recalculates `buildWindowedViewRange` without reusing the drag-locked span, so the viewport snaps back to a wider range instead of staying centered with the buffer the user just had.
- Issue type: mix of code behavior and UX expectation (the code resets zoom/offset after editing ends).
- Next narrow fix: persist the `dragViewSpanRef` or last manual zoom so the viewport remains locked on the loop even after the drag completes.
- Live QA: required to confirm centering stays stable and other view transitions continue to work.

### Loop diagnosis — missing final step affordance
- Root cause: the loop toolbar exposes the magnifying glass toggle and ± zoom, but no dedicated “done/check” control, so users have no explicit way to finish editing.
- Issue type: UX gap (not a functional bug in code).
- Next narrow fix: add a “done” button next to the magnifying glass that exits editing mode once the loop looks right.
- Live QA: needed to ensure the new control plays well with existing loop state transitions.

### Session note — check button visibility bug
- Current root cause: the check button was tied to `loopRegion.editing`, so it only showed up while a handle was actively being dragged. Releasing the handle immediately hid the button, which is not the desired persistent edit-mode affordance.
- Next fix plan: tie the check button to the persistent `showManualZoomControls` state (loop zoom mode) instead so it stays visible from the moment the magnifying glass opens until the user explicitly taps Done.

### Session plan — persistent done button
- Task: refactor the toolbar so the Done/check button is always present next to the magnifying glass while the loop adjustment session is live, not just while dragging or while the magnifier is toggled. The button should only go away when the user taps it (exiting the session).
- Approach: add an `isLoopAdjustmentActive` state that flips on when the user opens the zoom controls and stays true until the Done button runs `handleExitLoopEditing`. This keeps the button visible for the entire session even if the magnifier control is toggled; magnifying-glass still opens the helper controls, but the Done button is a separate companion and triggers the final-fit behavior.

### Session note — check button now tied to edit session
- Root cause: the button's visibility depended on transient state (`loopRegion.editing` and current manual zoom controls), so it appeared and disappeared in sync with drag vs magnifier toggling instead of staying visible the whole session.
- Fix: introduced `isLoopAdjustmentActive` (set when the user starts editing via dragging or opening the magnifier) so the toolbar now renders the check button next to the magnifying glass throughout the loop-adjustment session. The Done button now exits editing by resetting the zoom controls, preserving the current viewport, and flipping `isLoopAdjustmentActive` off only when the user taps it.
- Files changed: `src/components/WaveformLoop.tsx`, `docs/polyplay_codex_handoff_2026-03-31.md`.
- Platform impact: the child toolbar now clearly shows both controls together, and the Done action keeps the waveform focused on the selected loop before closing the session.
- Regression risk: medium for loop workflow; live QA required to confirm the session state is reliable and the manual controls still behave as expected after finishing.

### Session note — check button tied to loop zoom mode
- Root cause: the earlier implementation only showed the done button while dragging, because it relied on `loopRegion.editing`. That disappeared the instant the handle lift occurred.
- Fix: the button now renders whenever the manual zoom toolbar is open (`showManualZoomControls`) and triggers `handleExitLoopEditing`, which preserves the viewport, closes the zoom controls (`setShowManualZoomControls(false)`, resetting the manual zoom level), and exits editing via `onSetLoopRange(..., { editing: false })`. That keeps the Done button on-screen throughout the whole adjustment mode instead of only during active drags.
- Files changed: `src/components/WaveformLoop.tsx`, `docs/polyplay_codex_handoff_2026-03-31.md`.
- Platform impact: users now see the Done/check button for the entire loop zoom session rather than just during drag, and exiting the mode preserves their chosen zoom before re-locking.
- Regression risk: medium for loop workflow; live QA still needed to ensure the button behaves reliably and the zoom persistence logic remains stable.

### Session plan — button-driven loop workflow (new source of truth)
- New desired flow: single primary button toggles through Set Loop → Done → Edit Loop, with magnify controls present only while `loopRegion.editing` is true. The old separate check button is gone, and entering/exiting loop mode is driven entirely through this primary button plus `Clear Loop`.
- Task: refactor PlayerControls loop button logic to follow the new states, update the App’s loop state helpers to set `loopRegion.editing`, and remove the explicit Done button from the waveform toolbar. The magnifying glass / zoom controls only show while editing, and `Clear Loop` resets to Set Loop.

### Session plan — Safari fullscreen loop trap diagnosis
- Task: inspect why Safari desktop users can become trapped in fullscreen after looping, why the X button stops working, and whether loop/edit state blocks exit. Diagnosis-only; no code changes yet.
- Files to inspect: `src/components/FullscreenPlayer.tsx`, `src/components/WaveformLoop.tsx` (loop state), and `src/App.tsx` (fullscreen toggle logic). Look for loop editing flags influencing fullscreen exit or event handlers blocked by loops.

### Session note — button workflow implemented
- Root cause: the loop toolbar relied on a separate Done control that appeared/disappeared unpredictably, so the user never had a clear flow for finishing loop edits.
- Fix: the primary loop button now reads Set Loop / Done / Edit Loop depending on whether a loop exists and whether `loopRegion.editing` is active. App helpers `beginLoopAdjustment` / `finishLoopAdjustment` toggle the editing flag, and the WaveformLoop toolbar automatically shows the magnify & zoom controls while editing. The old check button was removed entirely, and `Clear Loop` resets everything back to the Set Loop state.
- Files changed: `src/App.tsx`, `src/components/PlayerControls.tsx`, `src/components/MiniPlayerBar.tsx`, `src/components/FullscreenPlayer.tsx`, `src/components/WaveformLoop.tsx`, `docs/polyplay_codex_handoff_2026-03-31.md`.
- Regression risk: medium for loop flow; live QA still needed to ensure the new button states feel intuitive and the manual zoom/loop persistence still works.

### Session plan — crop shimmer toast
- Task: while `isCropAudioBusy` is true, render a `TextShimmer` status message in the crop audio overlay to reassure users that the crop is running.
- Files to edit: `src/App.tsx`, `styles.css`.

### Session note — crop shimmer toast applied
- Root cause: the crop overlay showed no status while audio was being copied, so users saw a hang with no feedback.
- Fix: added a `TextShimmer` line ("Cropping audio…") beneath the crop buttons while `isCropAudioBusy` is true and gave it minimal styling in `styles.css`.
- Files changed: `src/App.tsx`, `styles.css`.
- Live QA: still needed to confirm the shimmer appears exactly when cropping is in progress and disappears afterward.

### Session plan — zoom persistence & done button fix
- Task: (1) keep the current manual/drag viewport when the user exits loop zoom instead of auto-recalculating a fresh range, and (2) add a done/check control beside the magnifier to exit loop-editing explicitly.
- Files to adjust: `src/components/WaveformLoop.tsx`.
- Approach: make minimal behavior changes to lock `viewRange` and loop editing state until the user explicitly finishes instead of resetting; add the “done” button to the toolbar near the magnifier (matching its visual family).

### Session note — zoom persistence + done control applied
- Root cause: exiting editing immediately ran the loop view-effect, so `viewRange` recalculated with default buffer and the view zoomed/panned away from what the user had on screen. Also, there was no explicit “done” button, forcing people to guess that closing the magnifier meant they were finished.
- Fix: added `shouldPreserveViewRange` + `lockedViewRangeRef` so the toolbar keeps the last editing viewport until the user taps the new check button. The check button now appears beside the magnifying glass, exits editing via `onSetLoopRange(..., { editing: false })`, and leaves the current zoom/buffer locked instead of triggering a recalculation.
- Files changed: `src/components/WaveformLoop.tsx`, `src/components/player.css`.
- Platform impact: loop editing should now hold the zoom state after the user finishes and provide an explicit done control; normal waveform seeking remains unaffected outside loop mode.
- Regression risk: medium for loop workflow, since this touches view persistence/loop state, so live QA is still required. Deeper zoom floor (`MAX_LOOP_VIEW_SCALE`) problem remains open.

Please think through this like a real user, not just from current code behavior.

---

## 2. Safari desktop loop / fullscreen problems
### Reported issues
- On Safari desktop, user made a loop and then **could not exit fullscreen player**
- The `X` button at the top was not working
- Workflow feels confusing / trapped
- At one point the app appeared frozen
- Safari had to be quit and reloaded

### Requested work
Audit fullscreen + loop + exit behavior on Safari desktop.
Think logically about:
- how the user enters fullscreen
- how the user exits fullscreen
- what happens when loop edit mode is active
- whether fullscreen exit gets blocked by loop state
- whether the UI is leaving the user trapped

---

## 3. iOS app settings bottom links
### Problem
Bottom links in app settings are not opening when tapped:
- Terms
- Privacy
- Support

### Requested work
Audit link tap behavior on iOS app build.
Determine whether:
- Capacitor / in-app navigation is swallowing the taps
- external links are blocked
- the wrong open mechanism is being used

---

## 4. Repeat button confusion
### Current confusion
User pressed Repeat button once and the `2` button appeared and `2 repeat` was activated.

That is not the desired UX.

### Desired repeat logic
From the `off` position:
1. First press should be **plain repeat button only** = repeat track indefinitely
2. Next state should be **1**
3. Then **2**
4. Then **3**
5. etc. only if more repeat counts are truly supported

### Important clarification
- First button press from off should **not** immediately imply a numbered repeat count.
- The first state should clearly mean **standard repeat indefinitely**.

### Repeat button fix plan
- Task: update the repeat button state machine so it cycles `off -> repeat (indefinite) -> repeat once -> repeat 2 -> repeat 3 -> off`. Currently it jumps straight to numbered counts and keeps using the limited `repeat-2`/`repeat-3` states. We'll extend `RepeatTrackMode` to include a plain `repeat` and `repeat-1` state, adjust storage parsing, and only use the badge/threepeat counter for the numbered modes. This keeps the UX plain when repeat is active but not yet bound to a specific count, then surfaces the numeric badge when the user opts into 1/2/3 repeats.

### Repeat fix applied
- Root cause: the toggle cycle skipped the plain repeat state and went straight from Off to the numbered `repeat-2` state, so the first press already showed “2 repeat.” The badge and remaining counter also treated every active state as a “count” this prevented showing just the plain repeat state.
- Fix: expanded `RepeatTrackMode` to include `repeat` and `repeat-1`, updated `parseRepeatTrackMode`/storage handling, and made the new cycle go `off -> repeat -> repeat-1 -> repeat-2 -> repeat-3 -> off`. Only the `repeat-1/2/3` states use the threepeat counter and leave a numeric badge, while `repeat` shows no badge and simply indicates repeat is on. Additionally, the same guard ensures the “Repeat” button now announces the next state (e.g., “Switch to repeat once” after enabling repeat).
- Files changed: `src/types.ts`, `src/App.tsx`, `src/components/PlayerControls.tsx`, `docs/polyplay_codex_handoff_2026-03-31.md`.
- Regression risk: medium-high (repeat state machine touches playback/loop hooks). Live QA is still vital to confirm each toggle state behaves correctly, the indefinite repeat is actionable, and the numeric badge shows exactly for the numbered counts.

---

## 5. Hero logo / PNG asset uncertainty
### Problem
I am not sure the newest PNG was actually implemented.
The older visible version had a tiny green edge/stroke from chroma keying.
A new version was made with added Photoshop strokes to hide that.

### Requested work
Please verify:
- which exact logo asset is currently used in the hero
- whether the latest intended PNG is actually the one in app
- whether old cached assets or stale references are still being used

Do not assume the currently visible asset is correct.

### Logo swap note
- Task: swap in the new horizontal PNG located at `priv mockups/grok mocks/official horz green no shadow alpha.png`. Replace the asset referenced by `src/assets/polyplay-hero-logo.png` and `public/polyplay-hero-logo.png` so both the in-app hero and the support page use the updated wordmark. Keep everything else untouched; this is purely an asset swap.

### Logo swap applied
- Root cause: Hero and support page still referenced the outdated PNG, so the new horizontal wordmark never appeared live.
- Fix: copied `priv mockups/grok mocks/official horz green no shadow alpha.png` over `src/assets/polyplay-hero-logo.png` and `public/polyplay-hero-logo.png` so both the React hero bar and `/support` page load the new asset. No code or markup changes were necessary.
- Files changed: `src/assets/polyplay-hero-logo.png`, `public/polyplay-hero-logo.png`, `docs/polyplay_codex_handoff_2026-03-31.md`.
- Platform impact: the hero header and support page now show the updated horizontal wordmark with no other UI change.
- Regression risk: none (asset swap only). Live QA: still needed to confirm the new PNG renders correctly on iOS/desktop at runtime.

---

## 6. Track metadata / import improvements
### Requested feature
When user imports an MP3 that already contains metadata, including album art:
- the app should make use of important metadata if practical

### Requested import enhancement
Add a text field on the Import page for **Artist Name** (not required).

### Desired Now Playing behavior
- If artist name is entered:
  - Now Playing should show `Track Title — Artist Name`
  - App identity can still remain PolyPlay Audio separately
- If no artist is entered:
  - fallback artist can simply be `PolyPlay Audio`

### Memory / autofill
- Include a memory for autofill for the artist field if practical

---

## 7. Major play controls inactive bug — iOS and desktop
This needs a serious audit.

### Reported issues
- Need a full audit of the circumstances where user can be inside the app and the play button / controls stop working
- Player controls not resuming while plugged into car after switching to Notes app
- Now Playing on the car screen works until controls somehow become inactive / stale / desynced
- There is likely stale state somewhere between app playback state, media session state, and external controls

### Requested work
Please do a full logic audit for:
- app foreground/background transitions
- switching to Notes app and back
- external control state
- car / media controls
- stale playback state
- situations where buttons visually exist but do not perform action

---

## 8. Siri support
### Requested research / planning
How do we go about getting Siri support such as:
- “Hey Siri, play my PolyPlaylist shuffled”
- “Hey Siri, resume play”
- “Hey Siri, play PolyPlay”

This may be a planning / research item first, not necessarily immediate implementation.

Please clarify:
- what would be required technically
- whether this is App Intents / SiriKit / media intent territory
- what scope would be realistic

---

## Screenshot notes
### Screenshot 1
Hero / main app view shows:
- current hero logo implementation
- onboarding card
- player controls
- overall current visual hierarchy

### Screenshot 2
Loop editor / loop zoom view shows:
- desired loop region is still difficult to isolate
- zoom controls are not getting user close enough
- marker handling and loop UX are still rough

---

## Recommended working order for Codex
Please do not bounce randomly. Work in this order unless a tighter dependency appears.

1. Audit and stabilize **loop creation / loop editing UX**
2. Fix **Safari desktop fullscreen exit / loop trap**
3. Audit **inactive play controls / stale media state**
4. Fix **iOS settings bottom links**
5. Fix **repeat button logic / label progression**
6. Verify and clean up **hero logo asset implementation**
7. Implement **artist field / metadata import improvements**
8. Research **Siri support**

---

## Guardrails for Codex
- Do not assume previous fixes actually worked unless explicitly re-verified.
- Be honest about uncertainty.
- Inspect first before editing.
- Keep each pass narrow.
- Prefer one real fix over three speculative ones.
- Think through the user workflow, not just the current code path.
- For loop UX especially, prioritize user intent and usability over preserving a confusing current interaction model.

---

## Requested response format from Codex
For each task, report back with:
- exact root cause
- exact fix made
- files changed
- platform impact
- regression risk
- whether live QA is still needed

---

## Status
This is a morning-build handoff. Several areas are still unstable. Do not treat current behavior as production-ready.

## Session Start
- Priorities noted: (1) stabilize loop creation/editing, (2) audit major play control inactivity, (3) resolve Safari desktop fullscreen loop traps.
- Next focus: begin with the loop creation/loop editing audit to understand why loop markers are still unwieldy for users.

### New guardrail audit note
- Issue: Investigate loop edit mode guardrails to ensure Cinema mode/fullscreen exits/swipe-down exits do not trap the user once editing is active. Will diagnose before touching code.
- Files to inspect: `src/components/WaveformLoop.tsx`, `src/components/FullscreenPlayer.tsx`, `src/components/PlayerControls.tsx`, `src/App.tsx` (navigation/state hooks). Using diagnosis-only approach first.

### Guardrail diagnosis in progress
- Root cause: entering Cinema mode is not blocked while `loopRegion.editing` is true, yet closing/swipe exits are suppressed via `isExitSuppressed`. That allows the user to open Cinema mid-loop-edit and then get trapped because the close/swipe guards stay active and the UI no longer surfaces loop controls.
- Transitions that must be guarded: Cinema entry (`setIsCinemaMode(true)` on artwork click), fullscreen close (✕ button) and swipe-down exit (already gated by `isExitSuppressed`), and any UI path that removes the loop controls while editing is still running.
- Narrow fix idea: gate Cinema entry by `isExitSuppressed` (or `loopRegion.editing`) so the button is disabled while editing, or surface a toast explaining loop editing must finish first. Keep existing exit guards as-is.

### Guardrail fix planned
- Will update `src/components/FullscreenPlayer.tsx` so the artwork click that enters Cinema mode short-circuits when `isExitSuppressed`/`loopRegion.editing` is true. No other paths should change. This keeps the existing exit suppression intact while preventing the user from opening Cinema mid-edit.

### Guardrail fix applied
- Root cause: Cinema mode could be activated via the artwork click even while `loopRegion.editing` (or any guard using `isExitSuppressed`) was true, trapping users because exit gestures were then disabled without the loop controls visible. 
- Fix: added a check in `src/components/FullscreenPlayer.tsx` so the onClick handler returns early when `isExitSuppressed` or `loopRegion.editing` is true before flipping `isCinemaMode`. This means Cinema mode cannot open until loop editing finishes, while the existing exit guards and loop state remain untouched.
- Files changed: `src/components/FullscreenPlayer.tsx`.
- Platform impact: Safari/iOS fullscreen now enforces loop guardrails, preventing the runaway Cinema trap.
- Regression risk: low; only the artwork tap path is gated. Live QA: still recommended to confirm loop editing flows still enter fullscreen when idle.

### Guardrail observation
- Disclaimer: Cinema remains blocked indefinitely after a loop exists because `isExitSuppressed` still relies on `showLoopEditor`, which stays true for any active loop—even after editing finishes. Need to gate Cinema strictly on `loopRegion.editing` so the user can reopen Cinema once they tap Done.

### Guardrail correction applied
- Root cause: `isExitSuppressed` used `showLoopEditor`, so reopening Cinema was impossible after a loop was created even though editing had finished. `showLoopEditor` stays true whenever the loop is active, so the guard never released.
- Fix: `isExitSuppressed` now tracks only `loopRegion.editing`, and the exit buttons always show the live hint text (`Swipe Down to Exit` on iOS, etc.) once editing ends. Cinema entry is now gated exactly by `loopRegion.editing`, so users can drop in/out of Cinema once they are done adjusting the loop.
