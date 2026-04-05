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
**Current active task:** `16. iPhone keyboard overlay accommodation`

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
-  

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
**Status:** open

**Observed issue:**
- FX change toasts are in a weird and hard-to-see location

**Desired behavior:**
- toasts should be easy to notice, readable, and not awkwardly placed
- should work across iPhone UI constraints

**Codex notes:**
-  

---

### 7. Playlist persistence audit
**Status:** open

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
-  

---

### 8. Theme FX hangover guardrails
**Status:** open

**Observed issue:**
- themes are having “FX hangovers”
- Rasta and Merica FX are carrying over after theme switches
- user reported Rasta smoke appearing in a different theme

**Desired behavior:**
- new spawns in the new theme must always use the correct FX and colors
- no lingering wrong-theme effect behavior

**Codex notes:**
-  

---

### 9. Theme-based waveform recoloring
**Status:** planning only

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
- this is a major cosmetic/systemic change
- planning first

**Codex notes:**
-  

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
**Status:** open

**Goal:**
Clean up remaining onboarding issues before release.

**Known issue family:**
- tooltip alignment
- selectable onboarding text
- first-run polish

**Codex notes:**
-  

---

### 13. Demo playlist deep dive
**Status:** open

**Goal:**
Audit demo playlist for potential bug sources before release.

**Focus:**
- first-run trust
- interactions with onboarding
- interactions with new playlist/import flow
- artwork and playback consistency

**Codex notes:**
-  

---

### 14. Backup systems audit
**Status:** open

**Goal:**
Audit all backup file systems for potential issues.

**Focus:**
- vault backups
- journal backups
- export/import edge cases
- naming
- restore reliability

**Codex notes:**
-  

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
