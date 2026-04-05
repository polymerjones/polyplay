# PolyPlay Release Finalization Board — 2026-04-05

Use this file as the active Codex control sheet for the current release-finalization pass.

## Source context
Primary handoff:
- `/Users/paulfisher/Polyplay/docs/polyplay_codex_handoff_2026-04-03.md`

Use alongside any existing planning board already in the repo, but treat this file as the current active note for this batch.

---

## Operating rules for Codex
1. Read the handoff above first.
2. Read this file second.
3. Work only on one active numbered task at a time unless explicitly told to combine tasks.
4. Before editing code, add a short diagnosis note under the active task:
   - files inspected
   - likely root cause
   - narrow implementation plan
5. After editing code, update the same task with:
   - exact fix made
   - exact files changed
   - regression risk
   - QA still needed
6. Run typecheck before closing any implementation pass.
7. Do not auto-commit unless explicitly asked.
8. Keep changes surgical. Do not improve unrelated systems.
9. For ambitious features, do planning/audit first before implementation.

---

## Status legend
- open
- diagnosis in progress
- fix implemented, awaiting QA
- verified
- blocked
- planning only
- audit only
- defer until after release

---

## Release triage
### Highest-priority release-trust items
1. AirPods / now-playing unpause / competing audio stale-state audit
2. Playlist persistence / “playlist disappeared after reopening” audit
3. Gratitude Journal export naming
4. iPhone keyboard overlay accommodation for Gratitude Journal + Import page
5. Theme FX hangover guardrails

### Safer polish items
1. FX toast visibility/location
2. Selectable text that should not be selectable
3. Loop control visibility / Fit ↔ Full concept planning
4. Rename-before-nuke playlist flow

### Ambitious / planning-first items
1. Show Off mode / expanded Cinema Mode
2. Shake gesture vibe switching
3. Theme-based waveform recoloring + preserve origins toggle
4. Cache / garbage / zip-by-playlist longer-term audit

---

## Active task
**Current active task:** `3. Edit loop default-seed bug`

---

## Numbered tasks

### 1. AirPods / now-playing unpause audit
**Status:** audit only

**Observed issue:**
- user reported AirPod unpause was not working at the gym
- likely same family as stale now-playing / resume / competing-app state seen in the car

**Desired behavior:**
- play/pause/unpause from AirPods should remain reliable
- now-playing state should stay in sync after interruptions and competing apps

**Scope:**
- diagnosis first
- focus on remote control / media session / resume state
- likely related to competing media apps

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/lib/mediaSession.ts`
    - `src/lib/iosNowPlaying.ts`
    - `ios/App/App/NowPlayingPlugin.swift`
    - `ios/App/App/AppDelegate.swift`
  - Likely root cause:
    - Remote transport wiring does exist: browser Media Session handlers are bound in `src/lib/mediaSession.ts`, iOS remote commands are emitted from `NowPlayingPlugin.swift`, and `src/App.tsx` listens for those commands.
    - The weak point is recovery after interruptions / competing audio ownership changes, not basic remote-command registration.
    - `src/App.tsx` only runs the broader playback resync path on `visibilitychange` / `focus` and a couple of vault-related paths. There is no explicit native audio-session interruption-end or route-reactivation signal.
    - AirPods `play` / unpause currently calls `resumeCurrentTrackPlayback("remote-play")`, but if iOS has already desynced the underlying audio session / now-playing ownership after another app or interruption takes over, there is no native-state callback telling the web layer to repair ownership first.
    - `ios/App/App/AppDelegate.swift` sets the audio session category once at launch, but there is no interruption observer / resume notification path there either.
    - This makes the reported gym / AirPods failure plausibly the same family as the car stale now-playing issue: remote play arrives, but playback/session ownership is stale and the app lacks a dedicated native interruption-recovery handshake.
  - Narrow implementation plan:
    - Keep this in audit mode first.
    - Next safe step is to scope one surgical recovery path, likely an iOS native interruption / activation listener that notifies JS when audio session becomes active again, or a narrower remote-play recovery branch if that can be proven from repro.
    - Do not ship a broad now-playing rewrite without a tighter repro because this touches release-trust-critical playback behavior.
  - Repro matrix / recovery audit:
    - 1. AirPods pause -> AirPods play while PolyPlay remains foreground
      - Likely code path involved:
        - `NowPlayingPlugin.swift` / `mediaSession.ts` remote command -> `src/App.tsx` `resumeCurrentTrack()` -> `resumeCurrentTrackPlayback("remote-play")`
      - JS already has a recovery hook:
        - Yes, but only the direct resume path. No extra interruption repair unless `audio.play()` fails and the iOS-specific reload fallback inside `resumeCurrentTrackPlayback(...)` succeeds.
      - Native iOS session/interruption handling appears missing:
        - Partially. Remote command wiring exists, but there is no explicit interruption-end observer or session-reactivation callback.
      - Likely reproducible enough to fix before release:
        - Maybe. This is the cleanest narrow scenario if it reproduces without another app taking focus.
    - 2. AirPods pause -> another app takes audio focus -> AirPods play
      - Likely code path involved:
        - Remote `play` still routes into `resumeCurrentTrackPlayback("remote-play")`, but now PolyPlay may no longer own the active audio session / now-playing center.
      - JS already has a recovery hook:
        - Weakly. Only generic resume plus focus/visibility resync. No explicit "regain audio focus" event.
      - Native iOS session/interruption handling appears missing:
        - Yes. No native callback is currently bridging audio-session reactivation / interruption end back to JS.
      - Likely reproducible enough to fix before release:
        - Risky unless reproduced very clearly. This is likely the same family as the gym and car reports.
    - 3. Gym scenario / competing media app present
      - Likely code path involved:
        - Same as scenario 2, but with more ambient competition from another media app reclaiming route / now-playing ownership.
      - JS already has a recovery hook:
        - Not a reliable one. `visibilitychange` / `focus` does not necessarily fire for stale now-playing ownership.
      - Native iOS session/interruption handling appears missing:
        - Yes, likely.
      - Likely reproducible enough to fix before release:
        - Not safely without a sharper repro. This should stay audit-first.
    - 4. Car / Bluetooth route scenario
      - Likely code path involved:
        - iOS remote command -> `resumeCurrentTrack()` / `togglePlayPause()` plus now-playing plugin state in `NowPlayingPlugin.swift`
      - JS already has a recovery hook:
        - Partial only. Generic remote handlers exist, but there is no dedicated route-change or interruption-end repair path.
      - Native iOS session/interruption handling appears missing:
        - Yes. No route-change/interruption observer is visible in `AppDelegate.swift` or the plugin.
      - Likely reproducible enough to fix before release:
        - Probably not without device repro. High trust area, so defer broad fixes.
    - 5. Track ended naturally -> remote play / resume behavior
      - Likely code path involved:
        - `audio` `ended` event in `src/App.tsx` -> next-track / repeat logic -> later remote `play` would call `resumeCurrentTrackPlayback("remote-play")`
      - JS already has a recovery hook:
        - Yes, but only if the current track/audio source remains a valid resume target.
      - Native iOS session/interruption handling appears missing:
        - Less central here; this is more about track-end state semantics than interruption handling.
      - Likely reproducible enough to fix before release:
        - Only if a specific wrong-end-state repro appears. Not the first target.
    - 6. App backgrounded vs foregrounded
      - Likely code path involved:
        - `document.visibilitychange` and `window.focus` -> `schedulePlaybackResync(...)` -> `resyncPlaybackAfterInterruption(...)`
      - JS already has a recovery hook:
        - Yes. This is the clearest existing repair path in the app.
      - Native iOS session/interruption handling appears missing:
        - Still yes, but background/foreground itself is at least partially covered by JS resync.
      - Likely reproducible enough to fix before release:
        - Possibly, but this path already has coverage and is probably not the sharpest missing bug.
    - 7. iOS interruption end vs visibility/focus recovery
      - Likely code path involved:
        - Today there is no direct native interruption-end path; the app is indirectly relying on `visibilitychange` / `focus` to trigger `schedulePlaybackResync(...)`
      - JS already has a recovery hook:
        - Only indirectly through focus/visibility.
      - Native iOS session/interruption handling appears missing:
        - Yes. This is the clearest architectural gap from inspection.
      - Likely reproducible enough to fix before release:
        - This is the most plausible single narrow bug family to target if user/device repro confirms interruption-end without reliable focus/visibility transition.

---

### 2. Show Off mode / Cinema Mode expansion
**Status:** planning only

**Goal:**
Organize and audit a more immersive “Show Off mode” before implementation.

**Concept summary:**
A way for the user to experience the song without normal UI controls — mostly artwork and FX.

**Requested ideas:**
- a button that turns on a gyrating waveform / visualizer behind artwork
- hide seek bar in Show Off mode
- full-screen FX canvas feeling
- possible rotation support only in this mode
- lock icon for rotation
- manual rotate button vertical ↔ horizontal
- 1.5 sec lockout so rotate button cannot be spammed
- top or bottom chip bar for FX / lock / exit
- controls fade after 4 sec idle
- tap wakes controls
- swipe left / right switches tracks
- maybe subtle transparent < > buttons when controls wake up
- likely X button exit
- possibly shake phone to exit (needs caution)

**Important:**
- this is planning/audit first
- do not implement until risks are clearer
- rotation only in one mode may be tricky and platform-sensitive

**Planning questions:**
- what is the narrowest viable v1?
- what are the biggest risks with rotation, idle controls, and gesture conflict?
- what should be deferred?

**Codex notes:**
-  

---

### 3. Edit Loop polish follow-up
**Status:** open

**Observed requests:**
- all loop controls should be available immediately when edit loop mode is activated
- user should not have to drag a handle first for tools to appear
- need a full zoom-out function that fits the entire waveform into the viewport
- possible Fit ↔ Full toggle:
  - Fit = fit loop to viewport
  - Full = zoom out to the entire waveform
  - then button toggles back to Fit

**Important:**
- current edit loop mode is close to stable
- avoid regressions at all cost
- treat this as careful design / small follow-up only

**Codex notes:**
- Diagnosis for default-seed trust bug — 2026-04-05 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/components/WaveformLoop.tsx`
    - `src/components/PlayerControls.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Exact likely root cause:
    - The initial Set Loop seed in `src/App.tsx` is not actually creating a tiny loop by itself. `setLoopFromCurrent()` seeds a region from the current playback time to near the track end, with only a small end margin.
    - The more likely bug is stale loop-editor viewport state in `src/components/WaveformLoop.tsx`.
    - `editingViewRangeRef`, `lockedViewRangeRef`, `manualZoomLevel`, and related zoom state are not reset when the active `track.id` changes, and the edit-entry effect can reuse `editingViewRangeRef.current` when entering a new loop-editing session.
    - If the previous loop session had been zoomed into a very small span, a fresh Set Loop on another track can inherit that tiny viewport span. The new loop then appears as a tiny centered segment even though the stored loop bounds were seeded more broadly.
    - That makes this look like a stale-state edge case in loop viewport/edit-session carryover, not a deterministic bad seed formula in `setLoopFromCurrent()`.
  - Evidence:
    - `setLoopFromCurrent()` in `src/App.tsx` seeds `start` from live playback time and `end` from `effectiveDuration - margin`, so it does not naturally create a tiny centered region except near track end.
    - In `WaveformLoop.tsx`, the edit-entry effect decides whether to refocus based on `editingViewRangeRef.current` and current span, and can reuse an old tiny range instead of rebuilding a fresh editing range.
    - The state-reset effect only fully clears those refs when `loopRegion.active` becomes false, and the track-reset effect only resets some zoom flags when there is no track, not when `track.id` changes.
  - Safe to fix before release:
    - Yes, likely. This looks fixable with a narrow state-reset/refocus guard in the loop editor.
  - Safest next implementation step:
    - Keep the fix inside `src/components/WaveformLoop.tsx`.
    - On `track.id` change, clear stale editing viewport refs/zoom state; or, even narrower, force a fresh `buildEditingFocusRange()` when entering loop editing from a non-active state so a new Set Loop session cannot inherit a prior tiny zoom window.
    - Do not change Fit/Full or toolbar behavior in the same pass.
  - Narrow implementation plan:
    - Take the safer narrower path first.
    - In `src/components/WaveformLoop.tsx`, when entering loop editing from a non-editing state, always rebuild a fresh editing focus range instead of reusing `editingViewRangeRef.current`.
    - Leave track-reset behavior, toolbar visibility, Fit/Full, and the seed math untouched in this pass.
  - Exact fix made:
    - In `src/components/WaveformLoop.tsx`, entering a fresh loop-editing session now forces a fresh `buildEditingFocusRange()` instead of allowing the editor to reuse `editingViewRangeRef.current` from a prior loop session.
    - Kept the pass narrow to stale viewport inheritance only. No changes were made to `setLoopFromCurrent()`, Fit/Full behavior, toolbar visibility, drag math, or broader loop state handling.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Exact stale-state guard added:
    - Added an `enteringFreshEditSession = !prevEditingRef.current` guard to the loop-edit entry effect, and included that in the `shouldRefocusEditingRange` condition so a new Set Loop session always rebuilds its focus viewport.
  - Regression risk:
    - Low. This only changes how a fresh edit session chooses its initial viewport and leaves the existing drag/zoom logic intact once editing has begun.
  - QA still needed:
    - Confirm a fresh Set Loop no longer appears as a tiny centered segment after a previously zoomed-in loop session.
    - Confirm existing loop edit sessions still preserve their current viewport while editing.
    - Confirm drag handles, manual zoom, and fit behavior remain unchanged.
  - Follow-up diagnosis for Safari zoom-out corruption + loop-region visibility — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/WaveformLoop.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - Repeated zoom-out presses at the base manual zoom level are still stretching the current manual view range incrementally instead of snapping cleanly back to the full waveform viewport, which can leave the editor in a visually broken intermediate state on Safari.
      - The selected loop region is also currently sharing theme-aware waveform colors in the render path, so playback/theme recoloring can weaken the user’s perception of the chosen loop window.
  - Narrow implementation plan:
    - Keep the fix inside `src/components/WaveformLoop.tsx` only.
    - When zooming out from the base manual level, snap directly to `{ start: 0, end: duration }` instead of repeatedly scaling a manual range.
    - Keep loop-region bars and played loop bars on a stable yellow highlight so the selected loop window stays visually trustworthy regardless of playback/theme colors.
  - Exact follow-up fix made:
    - Changed base-level zoom-out in `src/components/WaveformLoop.tsx` so pressing `-` from the outermost manual zoom level now snaps directly to the full waveform viewport instead of repeatedly stretching the current manual range.
    - Locked the selected loop region to a stable yellow highlight in both the base waveform bars and the played/progress overlay, so playback/theme waveform colors no longer dilute the user’s perception of the chosen loop window.
    - Kept the pass inside `WaveformLoop` only. No Fit/Full toggle, toolbar visibility change, or broader loop-state redesign was added.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to medium. The pass is still localized to loop rendering/zoom behavior, but it changes the outermost zoom-out behavior and loop-region coloring.
  - QA still needed:
    - Confirm repeated zoom-out on Safari desktop no longer produces the scrambled display.
    - Confirm base-level `-` now cleanly returns to the full waveform viewport.
    - Confirm the selected loop region always stays yellow, both before and after the playhead passes through it.
    - Confirm drag/edit/manual zoom behavior otherwise remains unchanged.

---

### 4. FX visibility / layering audit
**Status:** open

**Observed issue:**
- user reported FX may be covered up by backgrounds in different vibe switch modes

**Desired behavior:**
- FX remain visibly readable and intentional
- background layers should not swallow or obscure them unexpectedly

**Codex notes:**
-  

---

### 5. Shake gesture vibe switch evaluation
**Status:** planning only

**Observed issue:**
- phone shake currently triggers iOS Undo prompt in app contexts where no text field is active

**Idea:**
- when no text field is active, shake could trigger a vibe switch
- spawn some FX
- show toast like `Switched it up`
- trigger hero logo sparkles animation too

**Important:**
- preserve standard iOS behavior when editing text fields
- feasibility / UX / accidental-trigger risk must be evaluated first

**Codex notes:**
-  

---

### 6. FX toast location / visibility
**Status:** fix implemented, awaiting QA

**Observed issue:**
- FX change toasts are in a weird and hard-to-see location

**Desired behavior:**
- toasts should be easy to notice, readable, and not awkwardly placed
- should work across iPhone UI constraints

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `styles.css`
    - `src/App.tsx`
    - `docs/polyplay_codex_handoff_2026-04-03.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The default `.fx-toast` is currently bottom-right on small screens, while the theme variant jumps to a separate upper-right position.
    - That split placement makes FX feedback feel inconsistent and easy to miss, especially on iPhone where the lower-right area competes with player chrome and the upper-right theme toast competes with topbar controls.
  - Narrow implementation plan:
    - Keep the fix CSS-only.
    - Move the FX toast to a stable top-center slot with a readable max width.
    - Keep the theme variant only as a small vertical offset difference rather than a completely different corner.
  - Exact fix made:
    - Moved the default FX toast in `styles.css` from a lower-right placement to a top-center placement with a constrained readable width.
    - Kept the theme toast variant, but reduced it to a small extra top offset instead of sending it to a separate corner.
    - Left toast timing/content behavior unchanged.
  - Exact files changed:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is a CSS-only placement adjustment.
  - QA still needed:
    - Confirm FX toasts are easier to notice on iPhone and desktop.
    - Confirm the toast does not overlap header controls awkwardly in either default or theme placement.
    - Confirm long labels like `FX: Fireworks` still fit cleanly.

---

### 7. Playlist persistence audit
**Status:** fix implemented, awaiting QA

**Tester note:**
- “I built a playlist with 3 songs. Closed the website. Then opened it and didn’t have the playlist so I missed the save step. Will look at it more tonight.”

**Expected behavior:**
- user should not need to manually save to keep playlists/tracks
- playlist/library should persist naturally

**Important:**
- could be wrong-playlist confusion
- could be persistence bug
- needs diagnosis before assumptions

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/lib/playlistState.ts`
    - `src/lib/library.ts`
    - `src/lib/storage/library.ts`
    - `src/lib/db.ts`
    - `docs/polyplay_codex_handoff_2026-04-03.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - What persists where:
    - Playlist/library data is persisted immediately through the library store, not through a manual save step.
    - `createPlaylist(...)` in `src/App.tsx` writes the new playlist into library state immediately via `setLibrary(created.library)`.
    - Lower-level DB helpers such as `createPlaylistInDb(...)`, `setActivePlaylistInDb(...)`, import paths, and track mutations all call `saveLibrary(...)` in `src/lib/db.ts` / `src/lib/storage/library.ts`.
    - There is no separate “save playlist” user action required for normal persistence.
  - Likely root cause:
    - This does not currently look like newly created playlists simply failing to persist.
    - The higher-risk path is startup restore / active-playlist selection on reopen:
      - `refreshTracks()` in `src/App.tsx` can switch away from an empty active demo playlist to another playlist with tracks.
      - The startup reconcile path in `ensureDemoTracksForFirstRun(...)` can also force demo-playlist activation when `preferDemoActive` is true.
      - On cold start, `preferDemoActive` is still derived partly from `HAS_IMPORTED_KEY` / `HAS_ONBOARDED_KEY`, so a user-created playlist with tracks can be present in storage while the app reopens into demo/onboarding state or another active playlist that makes it look like “my playlist is gone.”
    - So the most likely class is wrong-playlist / startup-restore confusion, with demo/onboarding restore logic as the main suspect.
  - Why this looks plausible:
    - Library persistence is immediate and centralized.
    - The tester’s wording says “didn’t have the playlist,” but there is not yet evidence that the playlist record itself was deleted from storage.
    - The codebase has several startup recovery branches that can legally change `activePlaylistId` on reopen, especially around demo/onboarding conditions.
  - Whether this looks like a real release bug:
    - Yes, likely as a release-trust bug even if the underlying data still exists.
    - If a user reopens the app and lands in the wrong playlist or in demo state, the practical experience is “my playlist disappeared,” which is high-risk for trust.
    - It is not yet proven to be destructive data loss.
  - Safest next implementation step if needed:
    - Keep this audit-only until one clearer repro confirms whether the playlist record is missing or just not active.
    - The safest likely fix target is startup playlist selection, not persistence writes:
      - instrument/log the pre- and post-reconcile `activePlaylistId`, playlist names, non-demo track count, and whether `preferDemoActive` was true on reopen
      - then, if confirmed, narrow the fix so startup demo restore never overrides a valid non-demo active playlist/library on reopen
    - Do not patch create/save flows blindly because they already appear to persist immediately.
  - Desktop Chrome follow-up — 2026-04-05 Codex:
    - Tester environment clarification:
      - Google Chrome on Windows 11 Pro 64-bit
    - Why that matters:
      - This makes general browser persistence failure less likely than on mobile/PWA-style environments.
      - On desktop Chrome, `localStorage`-backed library persistence should be stable unless explicitly cleared, which pushes the diagnosis further toward startup restore logic.
    - More specific likely root cause:
      - The most suspicious branch is the startup `preferDemoActive` calculation in `src/App.tsx`.
      - On startup it becomes `true` not only when `nonDemoTrackCount === 0`, but also when both `HAS_IMPORTED_KEY` and `HAS_ONBOARDED_KEY` are still false.
      - That means a valid user playlist with non-demo tracks can still be treated like a fresh demo user if those flags were never set or were cleared, causing `ensureDemoTracksForFirstRun(...)` to prefer demo-state restore on reopen.
      - This fits the tester report better than “playlist failed to save.”
    - Most probable single bug to target first if repro is confirmed:
      - Startup demo/onboarding restore should not override a valid non-demo library merely because onboarding/import flags are false.
  - Narrow implementation plan:
    - Keep the fix inside startup reconcile only.
    - Stop using stale onboarding/import flags to force `preferDemoActive` when the library already contains non-demo tracks.
    - Preserve demo-first behavior only for true demo-only libraries.
  - Exact fix made:
    - Narrowed the startup reconcile guard in `src/App.tsx` so `preferDemoActive` now depends only on whether the stored library has zero non-demo tracks.
    - Removed the extra condition that could still force demo preference when `HAS_IMPORTED_KEY` and `HAS_ONBOARDED_KEY` were false even though a valid non-demo library already existed.
    - Left playlist creation/persistence writes untouched.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Exact startup selection guard added:
    - Startup demo restore now only gets preferred when the stored library is truly demo-only (`nonDemoTrackCount === 0`).
    - Stale onboarding/import flags alone no longer override a valid non-demo library on reopen.
  - Regression risk:
    - Low. The change is limited to startup demo-selection preference.
  - QA still needed:
    - Confirm a user-created non-demo playlist on desktop Chrome/Windows reopens without being replaced by demo/onboarding state.
    - Confirm true first-run demo-only state still opens into the demo playlist.
    - Confirm factory reset still restores the demo-first experience as expected.

---

### 8. Theme FX hangover guardrails
**Status:** fix implemented, awaiting QA

**Observed issue:**
- themes are having “FX hangovers”
- Rasta and Merica FX are carrying over after theme switches
- user reported Rasta smoke appearing in a different theme

**Desired behavior:**
- new spawns in the new theme must always use the correct FX and colors
- no lingering wrong-theme effect behavior

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/fx/ambientFxEngine.ts`
    - `src/components/AmbientFxCanvas.tsx`
    - `src/App.tsx`
    - `docs/polyplay_codex_handoff_2026-04-03.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The theme-specific spawn branch is chosen correctly at tap time in `src/fx/ambientFxEngine.ts`, and `AmbientFxCanvas.tsx` already pushes refreshed theme tokens on `themeRefreshKey`.
    - The hangover bug is lower in the render path: active splatters and sparks are still rendered against the live global `this.themeTokens.themeSlot` instead of the theme they were spawned under.
    - That means a Merica or Rasta particle that survives across a theme switch can be reinterpreted as the new theme during render, which matches the reported “hangover” / cross-theme contamination.
    - This looks like mostly stale particle theme identity, not missing theme refresh wiring for brand-new taps.
  - Narrow implementation plan:
    - Keep the pass inside the FX engine only.
    - Stamp splatter-mode particles/sparks with the source `themeSlot` when they are spawned.
    - Switch the render-time Merica/Rasta special cases to read that per-particle theme slot instead of the live global theme slot so old particles fade out in their original language and new spawns always bind to the current theme.
  - Exact fix made:
    - Added per-particle theme identity to the splatter engine so spawned splats and sparks now carry their source `themeSlot`.
    - Added a per-splat palette snapshot so generic splatter particles keep the palette they were born with instead of re-reading the live theme palette after a theme switch.
    - Switched Merica-specific render branches, Merica screen-flash detection, and Merica hot-spark rendering to use the particle’s stored theme slot instead of `this.themeTokens.themeSlot`.
    - Kept the pass inside `src/fx/ambientFxEngine.ts` only. No broader theme-engine redesign or background work was touched.
  - Exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to medium. The change is narrow and render-path-local, but it does add stored theme metadata to splatter particles and changes how theme-specific render branches decide behavior.
  - QA still needed:
    - Confirm switching from Merica to another theme never produces new fireworks-style spawns after the switch.
    - Confirm switching from Rasta to another theme never produces new smoke plumes after the switch.
    - Confirm Merica/Rasta particles already on screen can fade naturally without being recolored or reinterpreted as the new theme.
    - Confirm MX/general splatter colors no longer pick up the new theme mid-fade.
    - Confirm performance remains unchanged on iPhone.
  - Follow-up diagnosis after live QA — 2026-04-05 Codex:
    - Files inspected:
      - `src/App.tsx`
      - `src/components/AmbientFxCanvas.tsx`
      - `src/fx/ambientFxEngine.ts`
    - Exact remaining root cause:
      - The prior engine fix covered old particles being reinterpreted, but it did not fix the source of stale tokens for brand-new spawns.
      - `AmbientFxCanvas.tsx` refreshes engine theme tokens by reading CSS and `data-theme-slot` from the DOM, while `src/App.tsx` applies the new theme classes/attributes in a normal `useEffect`.
      - On a theme switch, that lets the FX canvas refresh against the old DOM theme state before the new theme classes/`data-theme-slot` are committed, so new spawns can still use the previous theme’s FX branch and palette until another state change, such as cycling FX, forces a second refresh.
      - That matches the user report exactly: wrong-theme new spawns persist after a theme switch, then correct themselves once the FX button is cycled.
    - Narrow implementation plan:
      - Keep the fix narrow to theme-token timing.
      - Move the DOM theme class/attribute sync in `src/App.tsx` from passive effect timing to layout-effect timing so the new theme state is applied before the FX canvas reads CSS-backed theme tokens.
      - Leave the earlier per-particle guardrail intact.
    - Exact fix made:
      - Kept the earlier per-particle guardrail in `src/fx/ambientFxEngine.ts` intact.
      - Changed the theme DOM sync in `src/App.tsx` from `useEffect` to `useLayoutEffect` for `data-theme`, `data-theme-slot`, body theme classes, and aura CSS variable updates.
      - That makes the new theme state land before `AmbientFxCanvas` reads CSS-backed theme tokens, so brand-new spawns no longer refresh against stale theme DOM state after a theme switch.
    - Exact files changed:
      - `src/App.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Regression risk:
      - Low. This is a narrow timing change for theme DOM synchronization and does not alter the broader theme-selection model.
  - QA still needed:
    - Confirm selecting Fireworks on Merica, then switching themes, never leaves new fireworks spawns active in the next theme.
  - Follow-up diagnosis after additional live QA — 2026-04-05 Codex:
    - Files inspected:
      - `src/fx/ambientFxEngine.ts`
      - `src/App.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact remaining root cause:
      - The earlier timing fix still left one stale-theme merge path inside `src/fx/ambientFxEngine.ts`: `setThemeTokens(...)` was using `tokens.themeSlot ?? this.themeTokens.themeSlot`.
      - When the app correctly passed `themeSlot: null` on the way out of Rasta/Merica, that `null` was swallowed and the engine kept the previous custom slot, so brand-new spawns in default/light could still take the old custom theme branch.
      - `src/App.tsx` was also preserving the previous custom `auraColor` when switching to light/default, which matches the user report of pink auto-art / aura carryover after leaving the custom theme cycle.
    - Narrow implementation plan:
      - Keep the pass narrow to theme-state clearing only.
      - Make the FX engine treat an explicit `themeSlot: null` as a real clear instead of preserving the previous slot.
      - Clear carried custom aura color when leaving custom themes so light/default do not inherit Merica/Rasta/MX aura state.
      - Leave the broader FX engine and theme system unchanged.
  - Exact follow-up fix made:
    - Changed `src/fx/ambientFxEngine.ts` so `setThemeTokens(...)` preserves the previous `themeSlot` only when the caller omits the field entirely, and correctly clears it when the caller passes `null`.
    - Changed `src/App.tsx` so leaving custom themes clears the carried custom `auraColor` instead of preserving it in light/default.
    - Kept the pass narrow to theme-state clearing. No broader FX behavior or theme art-direction code was touched.
  - Exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The change is limited to clearing stale custom theme state when leaving custom themes.
  - QA still needed:
    - Confirm switching from Rasta to default/light no longer produces new smoke plumes.
    - Confirm switching from Merica to default/light no longer produces new fireworks.
    - Confirm default/light no longer keep pink custom aura/auto-art color carryover after leaving custom themes.
    - Confirm true custom themes still keep their intended aura and FX behavior.
      - Confirm selecting Smoke on Rasta, then switching themes, never leaves new smoke plumes active in the next theme.
      - Confirm theme-switches correct immediately without needing to press the FX cycle button.
      - Confirm factory-reset/default-theme startup no longer inherits stale theme-specific FX behavior from a previous session.
  - Follow-up diagnosis for Rasta smoke scale — 2026-04-05 Codex:
    - Files inspected:
      - `src/fx/ambientFxEngine.ts`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Likely root cause:
      - Rasta smoke plume size is currently capped inside `spawnRastaSmoke(...)` with a relatively modest `baseRadius` and ellipse scale, so the effect reads smaller than requested on touch screens.
      - This is a local sizing issue, not a broader theme-engine problem.
    - Narrow implementation plan:
      - Keep the pass inside `spawnRastaSmoke(...)` only.
      - Increase the base plume radius and the ellipse footprint so each of the three plumes lands closer to thumb-sized without changing the FX type, color palette, or theme switching logic.
  - Exact follow-up fix made:
    - Increased the Rasta smoke plume base radius and ellipse footprint inside `spawnRastaSmoke(...)` so each of the three plumes spawns noticeably larger, closer to thumb-sized on touch screens.
    - Kept the pass local to the Rasta smoke size path only. No changes were made to theme switching, colors, FX selection, or other theme behaviors.
  - Exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is a local Rasta-only size adjustment.
  - QA still needed:
    - Confirm Rasta smoke plumes now read closer to thumb-sized on iPhone.
    - Confirm the plumes still feel smoky and not blob-like.
    - Confirm Merica, MX, and default-theme FX are unchanged.
  - Follow-up diagnosis for Rasta motif / smoke variation — 2026-04-05 Codex:
    - Files inspected:
      - `styles.css`
      - `src/fx/ambientFxEngine.ts`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Likely root cause:
      - The current Rasta background leaf layer is still using the earlier simplified inline SVG motifs in `styles.css`, so it reads as a made-up placeholder rather than the more realistic silhouette the user provided.
      - The Rasta smoke plumes already vary slightly per plume, but the overall three-plume cluster keeps the same left/center/right orientation on each tap, so repeated spawns feel too patterned.
    - Narrow implementation plan:
      - Keep the background change cheap: replace the current inline SVG leaf motifs with a single static silhouette asset derived from the provided reference and continue using the existing slow background-float layer.
      - Keep the FX change local to `spawnRastaSmoke(...)`: add one random cluster rotation per spawn so each three-plume group lands at a different orientation without changing color, count, or performance profile.
  - Exact follow-up fix made:
    - Replaced the earlier inline placeholder Rasta leaf motifs in `styles.css` with three static silhouette assets in `public/` based on the provided reference shape, while keeping the same lightweight background-layer structure and slow float animation.
    - Added one random cluster rotation per Rasta smoke spawn in `spawnRastaSmoke(...)`, so each three-plume smoke group lands at a different orientation instead of repeating the same left/center/right layout every tap.
    - Kept the pass narrow to the Rasta background leaf art source and local Rasta smoke spawn variation only.
  - Exact files changed:
    - `public/rasta-leaf-a.svg`
    - `public/rasta-leaf-b.svg`
    - `public/rasta-leaf-c.svg`
    - `styles.css`
    - `src/fx/ambientFxEngine.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The background change remains a static image-layer swap, and the FX change is a local Rasta-only spawn-orientation variation.
  - QA still needed:
    - Confirm the new Rasta leaf silhouette reads much closer to the provided reference than the old placeholder motif.
    - Confirm the leaf layer still feels subtle and does not overpower the Rasta background.
    - Confirm repeated Rasta smoke taps now land at visibly different orientations.
    - Confirm Rasta smoke color/count/performance still feel unchanged aside from orientation.
  - Follow-up diagnosis for Rasta leaf icon correction — 2026-04-05 Codex:
    - Files inspected:
      - `public/rasta-leaf-a.svg`
      - `public/rasta-leaf-b.svg`
      - `public/rasta-leaf-c.svg`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Likely root cause:
      - The first replacement pass still used an interpreted reusable leaflet shape, so the overall silhouette drifted from the provided reference and read like the wrong icon.
      - This is an asset-geometry problem, not a CSS/background-layer problem.
  - Narrow implementation plan:
    - Keep the pass asset-only.
    - Replace the current SVG leaf geometry with a closer direct silhouette based on the provided reference shape, while preserving the same lightweight static-asset background usage.
  - Exact fix made:
    - Replaced the interpreted/stylized leaf geometry inside the three existing Rasta background SVG assets with a closer direct silhouette built to match the provided reference shape more closely.
    - Kept the pass asset-only. No CSS layer, animation, FX, or theme logic changed.
  - Exact files changed:
    - `public/rasta-leaf-a.svg`
    - `public/rasta-leaf-b.svg`
    - `public/rasta-leaf-c.svg`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Whether the current leaf was replaced or redrawn:
    - Redrawn. The existing SVG geometry was replaced with a new closer silhouette rather than just recoloring or reusing the previous interpreted shape.
  - Regression risk:
    - Low. This is an asset-only correction on the existing lightweight Rasta background layer.
  - QA still needed:
    - Confirm the new leaf silhouette now reads much closer to the provided reference image.
    - Confirm the leaf still feels clean and readable at the background scale used in the Rasta theme.
    - Confirm the Rasta background motion/performance is unchanged.

---

### 9. Theme-based waveform recoloring
**Status:** fix implemented, awaiting QA

**Goal:**
Waveform colors should match themes instead of always feeling blue/purple-based.

**Desired behavior:**
- viewport waveform colors should match the active theme
- use blended gradients for Merica, MX, and Rasta
- preserve readability and performance

**Related idea:**
- admin toggle:
  - `Tracks maintain theme and aura origins` (on by default)
  - when off, waveform art and aura convert to the new theme when theme is switched

**Important:**
- keep the pass narrow to waveform color rendering only
- do not redesign backgrounds, aura, FX, or the broader theme engine

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/components/WaveformLoop.tsx`
    - `src/components/FullscreenPlayer.tsx`
    - `src/lib/artwork/waveformArtwork.ts`
    - `src/lib/themeConfig.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Exact root cause:
    - The visible waveform paths are still using hardcoded generic purple/cyan/pink and light-theme rose values instead of a shared theme-aware palette.
    - `WaveformLoop.tsx` hardcodes idle, progress, loop, and playhead colors inline.
    - `FullscreenPlayer.tsx` hardcodes the decorative generated waveform gradient inline.
    - `src/lib/artwork/waveformArtwork.ts` has a small theme palette table, but it only covers a few themes and still falls back to the older purple-family waveform language.
    - So the waveform system is not globally token-driven; it is split across multiple hardcoded render sites, which is why Merica, MX, and Rasta still read as generic blue/purple.
  - Narrow implementation plan:
    - Add one shared waveform-theme palette helper that reads the active theme from the DOM and returns clean, readable palette stops for idle bars, progress bars, loop bars, playhead, decor, and generated waveform art.
    - Wire only the waveform render paths to that helper: `WaveformLoop.tsx`, `FullscreenPlayer.tsx`, and `src/lib/artwork/waveformArtwork.ts`.
    - Use smooth three-stop gradients for Merica, MX, and Rasta derived from their required theme colors, with lighter loop/playhead variants to preserve contrast and avoid muddy blends.
  - Exact fix made:
    - Added a shared waveform palette helper in `src/lib/waveformTheme.ts` that resolves the active theme from the DOM and returns theme-aware colors for waveform idle bars, progress gradient, loop gradient, playhead, decor waveform, and generated waveform artwork.
    - Replaced the inline hardcoded waveform colors in `src/components/WaveformLoop.tsx` with the shared theme-aware palette.
    - Replaced the inline hardcoded fullscreen decorative waveform gradient in `src/components/FullscreenPlayer.tsx` with the shared theme-aware palette.
    - Replaced the old partial palette table in `src/lib/artwork/waveformArtwork.ts` with the same shared theme-aware palette, so generated waveform art also follows the active theme instead of the older generic blue/purple family.
    - Kept the pass narrow to waveform rendering only. No FX, aura, background, or broader theme-engine behavior was changed.
  - Exact files changed:
    - `src/lib/waveformTheme.ts`
    - `src/components/WaveformLoop.tsx`
    - `src/components/FullscreenPlayer.tsx`
    - `src/lib/artwork/waveformArtwork.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Exact waveform gradient mapping used for Merica:
    - Progress/decor gradient: `#0A3161 -> #FFFFFF -> #B31942`
    - Loop gradient: lightened versions of `#0A3161`, `#FFFFFF`, and `#B31942` to keep the active loop area readable.
  - Exact waveform gradient mapping used for MX:
    - Progress/decor gradient: `#006341 -> #FFFFFF -> #C8102E`
    - Loop gradient: lightened versions of `#006341`, `#FFFFFF`, and `#C8102E` to preserve contrast without muddying the white center.
  - Exact waveform gradient mapping used for Rasta:
    - Progress/decor gradient: `#078930 -> #FCDD09 -> #DA121A`
    - Loop gradient: lightened versions of `#078930`, `#FCDD09`, and `#DA121A` to keep looped sections bright and readable.
  - Regression risk:
    - Low to medium. The change is narrow to waveform rendering, but it touches all visible waveform color paths and generated waveform art palette selection.
  - QA still needed:
    - Confirm the main waveform no longer reads generic blue/purple in Merica, MX, and Rasta.
    - Confirm Merica shows a smooth navy/white/red blend with no muddy center.
    - Confirm MX shows a smooth green/white/red blend with no purple contamination.
    - Confirm Rasta shows a smooth green/yellow/red blend while staying readable.
    - Confirm loop highlights and playhead still stand out clearly in all themes.
    - Confirm fullscreen decorative waveform and generated waveform artwork now match the active theme.

---

### 10. Overall app tightness audit
**Status:** audit only

**Goals:**
- audit cache / garbage / cleanup
- keep audio and video artwork smoothness strong
- make sure FX do not cause lag

**Future idea:**
- export zip playlists by playlist

**Important:**
- broader than one surgical fix
- should likely be scoped down if implemented before release

**Codex notes:**
-  

---

### 11. Rename playlist prompt before Nuke Playlist
**Status:** open

**Desired behavior:**
- when user activates Nuke Playlist, show an edit text box first
- default text field should contain the previous playlist name
- after nuke completes, the new empty playlist should be titled with what the user entered

**Important:**
- preserve the countdown sequence concept
- keep it clear and intentional

**Codex notes:**
-  

---

### 12. Onboarding audit cleanup
**Status:** audit only

**Goal:**
Clean up remaining onboarding issues before release.

**Known issue family:**
- tooltip alignment
- selectable onboarding text
- first-run polish

**Codex notes:**
- Audit pass — 2026-04-05 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/components/EmptyLibraryWelcome.tsx`
    - `src/index.css`
    - `styles.css`
  - Known low-risk issues already addressed in earlier passes:
    - tooltip alignment
    - accidental selection/highlighting of onboarding copy
  - Remaining issue family:
    - what is left is mostly first-run polish tied to startup/demo state, not isolated onboarding presentation bugs
    - the empty-library / quick-tour entry copy and CTA wiring already look coherent in current code
    - the remaining trust-sensitive onboarding rough edges overlap task 7 (startup restore) and task 13 (demo playlist deep dive)
  - Decision for this pass:
    - No additional onboarding code change landed in this pass.
    - Stopped short of speculative “cleanup” work because the remaining issues are broader than a safe low-risk polish patch.

---

### 13. Demo playlist deep dive
**Status:** audit only

**Goal:**
Audit demo playlist for potential bug sources before release.

**Focus:**
- first-run trust
- interactions with onboarding
- interactions with new playlist/import flow
- artwork and playback consistency

**Codex notes:**
- Audit pass — 2026-04-05 Codex:
  - Exact code paths reviewed:
    - `src/lib/demoSeed.ts`
      - `seedDemoTracksIfNeeded()`
      - `restoreDemoTracks()`
      - `normalizeDemoLibrary()`
      - `ensureDemoPlaylist()`
      - `ensureDemoPlaylistAttachment()`
      - `upsertBuiltInDemoTrack()`
    - `src/App.tsx`
      - `ensureDemoTracksForFirstRun(...)`
      - startup reconcile effect
      - `isInitialDemoFirstRunState`
      - `isPristineDemoLibraryState`
      - onboarding flag reset effect tied to pristine demo state
  - Likely weak points found:
    - 1. Demo startup logic is spread across multiple layers.
      - Seeding, restore, normalization, attachment, active-playlist preference, and onboarding-state reactions all exist in separate branches.
      - That makes the demo path powerful but also easy to let override user expectation if guards are not tight.
    - 2. Demo/onboarding trust is coupled to storage flags as well as actual library contents.
      - The most fragile family is not asset seeding itself; it is how startup/demo preference and onboarding flags interact.
      - This overlaps the playlist persistence trust bug family.
    - 3. `isPristineDemoLibraryState` actively clears stale onboarding/import flags.
      - That is correct for a true demo-only library, but if the app is ever incorrectly driven into pristine-demo state, it can reinforce the wrong first-run experience.
    - 4. Demo playlist normalization intentionally strips demo tracks out of non-demo playlists when demo is preferred.
      - That is coherent for first-run cleanup, but it is a high-trust behavior and should stay tightly guarded.
    - 5. Demo media/artwork path itself looks stable.
      - Built-in demo assets are direct bundled URLs.
      - Poster repair and duplicate normalization look defensive rather than obviously dangerous.
  - Release blockers if any:
    - No clear blocker from demo media playback/artwork consistency alone.
    - The likely release blocker candidate remains demo startup override behavior:
      - demo-first reconcile overriding a valid non-demo library
      - onboarding flags being reset because the app incorrectly decides it is in pristine demo state
  - Safest next fix if needed:
    - Keep any next change narrow and startup-focused.
    - Prefer tightening the guards around when demo preference and pristine-demo flag resets are allowed, rather than changing demo seeding/media behavior.

---

### 14. Backup systems audit
**Status:** audit only

**Goal:**
Audit all backup file systems for potential issues.

**Focus:**
- vault backups
- journal backups
- export/import edge cases
- naming
- restore reliability

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/lib/backup.ts`
    - `src/lib/saveBlob.ts`
    - `src/components/JournalModal.tsx`
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_codex_handoff_2026-04-03.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Exact backup paths reviewed:
    - Vault export from main app:
      - `src/App.tsx` `saveUniverseBackup(...)`
      - `src/App.tsx` `finishVaultBackupSave(...)`
      - `src/lib/backup.ts` `exportFullBackup(...)`
      - `src/lib/saveBlob.ts` `promptForSaveFilename(...)` / `saveBlobWithBestEffort(...)`
    - Vault import / restore from main app:
      - `src/App.tsx` `onLoadUniverseFile(...)`
      - `src/lib/backup.ts` `importFullBackup(...)`
    - Vault export/import from admin panel:
      - `src/admin/AdminApp.tsx` `onExportFullBackup(...)`
      - `src/admin/AdminApp.tsx` `onImportFullBackupFile(...)`
    - Journal backup export/import:
      - `src/components/JournalModal.tsx` export button / inline save-name step / import button
      - `src/components/JournalModal.tsx` `parseGratitudeBackupImportText(...)`
      - `src/lib/backup.ts` `serializeGratitudeJson(...)` / `getGratitudeBackupFilename()`
    - Shared naming/save behavior:
      - `src/lib/saveBlob.ts`
  - Likely weak points found:
    - 1. Desktop vs iPhone/PWA naming behavior is still split across flows.
      - Main-app Vault export and Journal export both support the safer inline name step for iPhone/PWA via `shouldUseInlineSaveNameStep()`.
      - Admin-panel exports still call `promptForSaveFilename(...)` directly and then save immediately. On iPhone/PWA that helper returns the default filename instead of a real prompt, so admin exports do not actually offer the same rename-before-save behavior.
      - This is a consistency/usability issue, not an immediate data-loss bug.
    - 2. Full Vault restore is destructive by design and does not stage/confirm at the data layer beyond the UI entry point.
      - `importFullBackup(...)` replaces the library, then removes obsolete blobs that are not referenced by the restored backup.
      - That is correct for a full restore, but it means users need the “load universe” expectation to be very clear because restore is effectively replace-not-merge.
      - The helper text in the vault UI does warn, but this remains a high-trust area.
    - 3. Restore success messaging may overstate completeness in one edge case.
      - `importFullBackup(...)` returns `skippedTrackCount` from config application, but the main app success toast only says how many tracks/media were restored.
      - If config application skips some track settings, the user is not told in the main vault success message.
      - This is not a media-loss bug, but it can slightly over-promise “everything restored.”
    - 4. Delayed post-restore settle behavior exists and could still feel like a light refresh.
      - After Vault import, `src/App.tsx` does several follow-up actions: dispatches `polyplay:library-updated`, syncs player state from storage, refreshes tracks, refreshes the vault inspector, starts a 2-second success countdown auto-close, and schedules `schedulePlaybackResync("vault-import-return")`.
      - The resync itself is immediate for `vault-import-return`, but the overlay auto-close/countdown can read like a small delayed refresh/settle rather than a silent background operation.
      - This likely explains the previously reported “minor refresh” feeling after successful iPhone restore.
    - 5. Journal import is intentionally overwrite-only and safer than vault restore, but it is localStorage-only.
      - The Journal flow has a confirm-overwrite step when entries already exist and gives clear success/error messaging.
      - It does not merge entries; it replaces them. That is coherent, but still needs explicit expectation in QA.
    - 6. Silent-failure risk appears reasonably contained, but not zero.
      - Export flows generally surface user-facing canceled/failed/saved states.
      - `importFullBackup(...)` cleans up staged blobs on restore failure, which is good.
      - The most realistic misleading case is not “silent failure,” but “save opened preview/share sheet and the user still must finish the platform save step,” especially on iPhone/PWA.
  - Release blockers if any:
    - No obvious release-blocking data-corruption bug found from code inspection alone.
    - The highest-trust concern is still Vault restore semantics: it is a full replace operation and must be treated carefully in messaging and QA.
    - I do not currently see evidence of a restore path silently dropping the entire library or silently succeeding after a hard failure.
  - Safest fixes if needed:
    - 1. Unify admin export naming with the same inline iPhone/PWA naming step used by the main-app Vault and Journal flows.
    - 2. Consider exposing `skippedTrackCount` in main-app Vault import success UI when non-zero so restore messaging is more exact.
    - 3. If the delayed post-import “refresh” still feels confusing in live QA, narrow that follow-up by auditing whether the vault success countdown auto-close or the playback resync is the visible cause before changing behavior.
  - Regression risk:
    - For diagnosis only: none.
    - If follow-up fixes are made, the highest-risk area is full Vault restore because it is a destructive replace flow.
  - What still needs live QA:
    - Main-app Vault export on desktop: filename prompt, successful zip save, and re-import of the same backup.
    - Main-app Vault export on iPhone/PWA: inline naming step, preview/share save path, and user clarity that they must finish platform save.
    - Main-app Vault import on iPhone: confirm whether the light post-import settle/refresh is harmless and whether the 2-second success auto-close feels clear.
    - Admin-panel full-backup export on iPhone/PWA: confirm current rename behavior is inconsistent with main app.
    - Journal backup export/import on desktop and iPhone/PWA: default name, edited name, overwrite confirmation, and success/error states.
    - Restore expectations QA: confirm users understand Vault restore is replace-not-merge and Journal import is overwrite-not-merge.

---

### 15. Gratitude Journal export naming
**Status:** fix implemented, awaiting QA

**Observed issue:**
- Gratitude Journal cannot name the file before export

**Desired behavior:**
- allow naming before export, similar to better backup/export flows elsewhere

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/components/JournalModal.tsx`
    - `src/lib/saveBlob.ts`
    - `src/lib/backup.ts`
    - `src/App.tsx`
    - `docs/polyplay_codex_handoff_2026-04-03.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The Gratitude Journal export button already calls `promptForSaveFilename(...)`, but the shared helper intentionally skips prompting on iPhone-like / standalone-PWA save flows by returning the default filename immediately.
    - That means desktop browsers can name the file, but iPhone-style export flows cannot rename before save and fall straight through to preview/share with the default name.
  - Narrow implementation plan:
    - Reuse the existing save helpers and the same deferred inline naming concept already used by the Vault export flow.
    - Keep the change limited to the journal export path in `JournalModal.tsx`, with a small inline filename step only when `shouldUseInlineSaveNameStep()` is true.
    - Do not redesign the broader journal UI or export system.
  - Exact fix made:
    - Kept desktop behavior intact: the Gratitude Journal export still uses `promptForSaveFilename(...)` on platforms where the prompt is supported.
    - Added a deferred inline naming step for `shouldUseInlineSaveNameStep()` platforms in `src/components/JournalModal.tsx`, so iPhone/PWA-style export flows now let the user edit the filename before saving.
    - Reused the existing shared helpers `shouldUseInlineSaveNameStep()`, `normalizeSaveFilename(...)`, `promptForSaveFilename(...)`, `saveTextWithBestEffort(...)`, and the existing default name from `getGratitudeBackupFilename()`.
    - Added only the small journal-specific inline save-name card styling needed to support that deferred naming step.
  - Exact files changed:
    - `src/components/JournalModal.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The change is isolated to the Gratitude Journal export naming flow and reuses existing save/naming helpers.
  - QA still needed:
    - Confirm desktop export still prompts for a filename first and saves with the chosen name.
    - Confirm iPhone/PWA export now shows the inline name step before save.
    - Confirm keeping the default name still exports successfully.
    - Confirm edited names get the `.json` extension automatically.
  - Follow-up diagnosis after iPhone QA — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/JournalModal.tsx`
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact remaining root cause:
      - The inline save-name card did not automatically focus its filename input when it opened, so the user still had to tap once more before naming the backup.
      - The gratitude backup success/error status bubble was also still positioned as an absolutely positioned card-local status element, which can read oddly on iPhone compared with the fixed toast treatments used elsewhere.
    - Narrow implementation plan:
      - Keep the change inside the Gratitude Journal export surface only.
      - Auto-focus the inline backup filename input when the deferred save-name card opens.
      - Move the journal status bubble to a safer fixed bottom-center treatment so backup success/error messages land in a more predictable iPhone location without redesigning the journal.
  - Exact follow-up fix made:
    - Added automatic focus for the Gratitude Journal inline save-name input when the backup naming card opens, using the existing no-scroll focus helper.
    - Moved the journal status bubble to a fixed bottom-center toast position so gratitude backup success/error messages appear in a clearer, more stable iPhone location.
    - Kept the pass narrow to the journal export naming/status surface only.
  - Exact files changed:
    - `src/components/JournalModal.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The change is limited to inline journal backup naming focus and journal status positioning.
  - QA still needed:
    - Confirm tapping Save Backup in the Gratitude Journal naming flow lands the cursor in the filename field automatically on iPhone.
    - Confirm the keyboard opens immediately for the filename field.
    - Confirm gratitude backup success/error messages appear in a clear fixed location on iPhone.
    - Confirm desktop naming behavior remains unchanged.

---

### 16. iPhone keyboard overlay accommodation
**Status:** fix implemented, awaiting QA

**Observed issue:**
- Gratitude Journal and Import page on iPhone 14 with iOS 21 / iOS 26-style large keyboard overlay dominate the screen
- screenshot suggests keyboard overlap makes the UI feel cramped

**Desired behavior:**
- accommodate large iOS keyboard overlay as gracefully as possible
- preserve edit/save/cancel usability
- do not fight iOS unnecessarily

**Important:**
- likely partial accommodation only
- avoid risky keyboard hacks

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/components/JournalModal.tsx`
    - `src/admin/AdminApp.tsx`
    - `styles.css`
    - `docs/polyplay_codex_handoff_2026-04-03.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The journal modal still sizes itself from `100dvh` and large min-height rules, so when the iPhone keyboard overlay reduces the visual viewport the shell remains too tall and the editing area feels cramped.
    - `JournalModal.tsx` already scrolls the active editor into view, but that only helps the focused field, not the overall card density or available viewport height.
    - The import page in `AdminApp.tsx` does not have a keyboard-aware compact mode at all, so the normal header, toasts, spacing, preview blocks, and card density remain in place while the keyboard consumes most of the visible screen.
  - Narrow implementation plan:
    - Add a safe visual-viewport-based height cap for the journal shell on iPhone-width screens while writing/editing.
    - Add a narrow keyboard-active compact class for the journal and admin import page when an editable control is focused and the visual viewport is clearly reduced.
    - Use layout/spacing/scroll accommodations only: compress chrome, reduce nonessential density, and keep important actions reachable. No native keyboard hacks.
  - Exact fix made:
    - Added a narrow keyboard-overlay detection path in `src/components/JournalModal.tsx` and `src/admin/AdminApp.tsx` based on editable focus plus `visualViewport` shrink on phone-width screens.
    - In the Gratitude Journal, applied the real visible viewport height to the modal scene while the keyboard is active and added a compact writing-mode class that trims spacing, reduces editor height slightly, and hides the verse card while writing so the editor/actions remain more reachable.
    - In the import page, added a keyboard-active compact class that reduces header/card density, hides nonessential subtext, hides the video frame preview while typing, and scrolls the focused editable field into clearer view.
    - Kept the pass layout/scroll focused only. No native keyboard workaround or broader page redesign was introduced.
  - Exact files changed:
    - `src/components/JournalModal.tsx`
    - `src/admin/AdminApp.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to medium. The changes are narrow and mobile-editing-specific, but they do add `visualViewport`-driven compact states in two screens.
  - QA still needed:
    - Confirm Gratitude Journal compose/edit is more usable on iPhone 14-class devices with the large keyboard overlay open.
    - Confirm Save/Cancel remain reachable in the journal while editing.
    - Confirm the import page title/artist fields stay usable and centered better while typing on iPhone.
    - Confirm desktop and iPad layout remain unchanged.
    - Confirm artwork preview still appears normally when the keyboard is not active.
  - Regression containment diagnosis — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/JournalModal.tsx`
      - `styles.css`
      - `docs/polyplay_codex_handoff_2026-04-03.md`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact regression cause:
      - The risky part was the `visualViewport` height being written onto the outer `.journalScene` container as `--journal-visible-vh`, with `.journalScene` itself using that value as its actual height.
      - When the iPhone keyboard opened, the fixed full-screen journal layer shrank to the visible viewport height instead of continuing to cover the full app, so the underlying player/page became visible below the modal and the writing surface looked detached.
      - The body scroll lock was still active, so this was not primarily a page-scroll leak. It was a modal-container sizing regression.
  - Narrow containment plan:
      - Roll back the outer modal scene height override and return the journal overlay itself to a full fixed-screen layer.
      - Keep only the safer keyboard-active in-card density reductions so Save/Cancel stay reachable without changing the modal’s screen coverage.
      - Leave the import-page keyboard accommodations untouched in this containment pass.
  - Exact containment fix made:
    - Rolled back the risky `visualViewport`-driven height override on the outer journal scene in `src/components/JournalModal.tsx` / `styles.css`.
    - Restored `.journalScene` to a full fixed-screen overlay so the underlying player/page can no longer show through when the keyboard opens.
    - Kept the safer `is-keyboard-active` compact card behavior inside the journal card only, so the accommodation remains limited to denser in-card layout rather than shrinking the modal layer itself.
    - Did not widen into a broader journal redesign or new keyboard behavior.
  - Exact files changed:
    - `src/components/JournalModal.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is primarily a rollback of the riskiest part of the previous accommodation, with only the safer in-card compact mode left in place.
  - QA still needed:
    - Confirm the Gratitude Journal remains visually isolated and full-screen when the iPhone keyboard opens.
    - Confirm the underlying player/content no longer shows below the journal.
    - Confirm Save/Cancel remain reachable while editing on iPhone.
    - Confirm the import-page keyboard accommodations still behave as before.
    - Confirm desktop and iPad layout remain unchanged.
  - Follow-up diagnosis for journal over-lift — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/JournalModal.tsx`
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The remaining issue is coming from stacked movement helpers inside `src/components/JournalModal.tsx`, not the outer full-screen containment.
      - In compact iPhone mode, the journal currently does all of these at once:
        - focuses the textarea directly
        - runs immediate manual list scrolling
        - runs delayed follow-up scroll passes
        - reruns scroll correction on `visualViewport` resize as the keyboard animates
      - On iPhone, Safari already performs its own focus-driven keyboard accommodation, so those extra passes over-lift the active writing surface toward the top.
    - Narrow implementation plan:
      - Keep the containment fix intact.
      - Reduce movement rather than add more layout logic: use focus without scroll where possible, soften compact-mode scroll correction, and remove the extra late follow-up pass that is most likely pushing the editor too high.
    - Exact follow-up fix made:
      - Switched the journal composer/edit textarea focus path in `src/components/JournalModal.tsx` to use `focus({ preventScroll: true })` when supported, so Safari’s own keyboard accommodation is not compounded by an extra programmatic focus scroll.
      - Softened compact iPhone edit-list scroll correction by reducing the compact insets and by stopping the compact-mode top-alignment correction that was pulling the active editor too high.
      - Removed the extra late follow-up scroll pass so compact keyboard resize handling only does the minimum needed to keep the editor/actions visible.
      - Kept the full-screen containment fix intact. The outer modal sizing was not reopened.
    - Exact files changed:
      - `src/components/JournalModal.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Regression risk:
      - Low. This is a reduction of scroll/focus intervention inside the journal only.
    - QA still needed:
      - Confirm the new-entry textarea stays comfortably visible above the iPhone keyboard without jumping too high.
      - Confirm Save/Cancel remain reachable.
      - Confirm existing-entry edit mode also feels less over-lifted.
      - Confirm the full-screen journal containment fix remains intact.

---

### 17. Selectable text that should not be selectable
**Status:** fix implemented, awaiting QA

**Observed issue:**
- some display-only UI text can be highlighted/selected
- onboarding text is a known example

**Desired behavior:**
- presentational copy should not be accidentally selectable
- inputs and editable/selectable fields must remain untouched

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `styles.css`
    - `src/index.css`
    - `src/App.tsx`
    - `src/components/EmptyLibraryWelcome.tsx`
    - `docs/polyplay_codex_handoff_2026-04-03.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The app already disables selection in several interactive/button-like areas, but a number of display-only copy blocks still inherit normal text selection behavior.
    - The safest remaining candidates are narrow presentational selectors: onboarding/welcome text, helper hints, playlist-create copy, toast copy, vault summary labels, and a few secondary subtitles.
    - Inputs, textareas, search fields, journal editors, backup naming fields, waveform editing, and any intentionally readable/copyable form controls should remain untouched.
  - Narrow implementation plan:
    - Add `user-select: none` only to the audited presentational selectors instead of any broad app-level blanket rule.
    - Keep the change CSS-only and limited to obvious display-only copy blocks.
    - Leave all real text-entry and intentionally selectable controls unchanged.
  - Exact areas audited:
    - onboarding / welcome copy
    - helper hint text
    - playlist-create helper copy
    - vault summary labels and success countdown copy
    - journal/fx toast copy
    - admin import toast copy
    - a few presentational subtitles such as the topbar version/subtitle and playlist-manager subcopy
  - Exact fix made:
    - Kept the pass CSS-only.
    - Added `user-select: none` / `-webkit-touch-callout: none` only to the audited display-only copy selectors.
    - Did not add any app-wide blanket selection lockout.
  - Exact files changed:
    - `src/index.css`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - What remains intentionally selectable:
    - all `input`, `textarea`, `select`, and search fields
    - journal compose/edit textareas
    - backup naming fields
    - prompts and other editable form controls
    - any intentionally copyable/selectable control text not included in the audited presentational selector list
  - Regression risk:
    - Low. The change is limited to audited display-only copy selectors and leaves editable fields untouched.
  - QA still needed:
    - Confirm onboarding/welcome text no longer highlights accidentally on touch drag.
    - Confirm vault/journal/admin toasts no longer get accidental text selection.
    - Confirm all real input and editor fields remain fully selectable/editable.

---

## Suggested execution order
1. AirPods / now-playing unpause audit
2. Playlist persistence audit
3. Gratitude Journal export naming
4. iPhone keyboard overlay accommodation
5. Theme FX hangover guardrails
6. FX toast location
7. Selectable text audit
8. Onboarding cleanup
9. Backup systems audit
10. Planning-only tasks (Show Off mode, shake gesture, waveform recolor, app tightness)

---

## End-of-day wrap
Before ending the session, update:
- DONE TODAY
- IMPLEMENTED, AWAITING QA
- STILL OPEN
- RECOMMENDED NEXT SESSION START
