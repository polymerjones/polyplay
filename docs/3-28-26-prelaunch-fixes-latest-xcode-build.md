## Latest Xcode build findings

### 19. Journal import can temporarily brick app after importing an older journal backup
**Status:** Fixed

**Notes:**
- After importing an older journal backup, the app stopped responding to input.
- The app appeared completely bricked in that session.
- After closing and reopening the app, importing journal worked fine.
- This suggests a state-transition, rehydration, or UI lock issue rather than a permanently bad journal file.

**Problem:**
- Journal import can leave the app non-responsive immediately after import.

**Repro:**
- Use latest Xcode build.
- Import an older journal backup.
- Observe that the app stops responding to input / feels bricked.
- Relaunch app and retry import.
- Observe that the import can then function normally.

**Root cause:**
- The journal import path was writing imported entries straight into `localStorage` instead of replacing them through the gratitude normalization layer.
- That made older backup JSON shapes a likely trigger, because legacy entry data could bypass the same normalization/sorting path used by normal runtime reads and writes.
- The import flow also left several transient journal UI states alive across import, and background playback was intentionally suspended while choosing a file. If import/cancel/focus transitions happened in the wrong order, the modal could feel stuck or non-responsive in that session.

**What the code was doing before:**
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) used `localStorage.setItem(...)` directly for imported entries, then re-read entries afterward.
- The import flow did not fully reset edit/composer/search/pending-import UI state after a successful import.
- Background playback suspension during import relied on later flow events to recover cleanly.

**What we tried:**
- Routed imported entries through the gratitude helper layer instead of writing raw storage directly.
- Added a dedicated replace-and-normalize path in [`src/lib/gratitude.ts`](/Users/paulfisher/Polyplay/src/lib/gratitude.ts) so imported entries are normalized, sorted, and stored the same way as runtime entries.
- Reset transient journal UI state after import and made background playback resume more defensively on success, cancel, and focus-return paths.
- Noted that older JSON exports are the most likely repro source, and fresh exports should be used as the comparison test.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important point was not only "import old JSON safely" but also "fully unwind modal state after import," because the reported symptom was temporary session bricking rather than permanent bad data.

**Final fix:**
- [`src/lib/gratitude.ts`](/Users/paulfisher/Polyplay/src/lib/gratitude.ts) now exposes `replaceGratitudeEntries(...)`, which normalizes and sorts imported entries before persisting them.
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) now uses that helper for imports, clears transient journal UI state after applying an import, and resumes suspended background playback more defensively.
- Result: importing older journal backups is less likely to poison live modal state or leave the session feeling bricked.

**How to avoid this later:**
- Never write imported JSON directly into storage when the feature already has a normalization layer.
- Treat import flows as full state transitions: data replacement, transient UI cleanup, and media/focus resumption should all be part of the same path.
- When testing import regressions, compare fresh exports against older legacy exports so compatibility problems are isolated quickly.

---

### 20. Journal backup save gives two toasts and both disappear too quickly
**Status:** Fixed

**Notes:**
- Saving a journal backup produced two toasts.
- Neither toast stayed on-screen long enough to read comfortably.
- This is a feedback/timing issue rather than a core data-loss bug, but it harms trust and clarity.

**Problem:**
- Journal export/save feedback is too noisy and too brief.

**Repro:**
- Save/export a journal backup.
- Observe that two toasts appear.
- Observe that both disappear too quickly to read.

**Root cause:**
- The `Save Backup` flow in [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) emitted two feedback surfaces for the same outcome:
  - `miniToast`
  - `journalStatus`
- On top of that, the visible status strip auto-cleared too quickly for comfortable reading.

**What the code was doing before:**
- Journal backup save success and failure set both `miniToast` and `journalStatus`.
- `miniToast` auto-dismissed quickly, and `journalStatus` also used a short timeout, so the result felt noisy and fleeting instead of clear.

**What we tried:**
- Reduced journal backup save feedback to a single visible status surface.
- Increased the journal status dwell time so info/success/error messages remain readable.

**Why that didn't work:**
- No failed intermediate patch was kept.
- This was a straightforward duplication issue once the save handler was inspected.

**Final fix:**
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) no longer triggers `miniToast` for journal backup save success/failure.
- The journal status strip remains the single visible feedback path for save/export outcomes.
- Journal status auto-dismiss timing was increased so save feedback is easier to read.

**How to avoid this later:**
- For a single user action, choose one primary feedback surface unless there is a strong reason to layer another.
- If a flow already has a visible inline status surface, do not also fire a second toast for the same event by default.

---

### 21. App crash when choosing "Take Video" as source for audio import
**Status:** Fixed

**Notes:**
- Selecting "Take Video" as a source for audio import caused an app crash.
- Need to determine whether this option should be supported at all.
- If not, remove or suppress that source choice if possible.
- User also raised a product question:
  - could there instead be a direct "record audio into new track" feature in the future?
- For release, the immediate requirement is to stop the crash.

**Problem:**
- Choosing Take Video for audio import crashes the app.

**Repro:**
- Start audio import flow.
- Choose "Take Video" as the input source.
- Observe crash.

**Root cause:**
- The audio import file inputs advertised video MIME types (`video/mp4`, `video/quicktime`) in their `accept` strings.
- On iOS, that made the system picker offer live video capture sources such as `Take Video` for an audio-import action.
- At the same time, the audio transfer lane logic treated generic `video/*` payloads as artwork, so the UI contract and the runtime handling disagreed about whether video containers belonged in the audio path.

**What the code was doing before:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) accepted `.mp4` / `.mov` container formats for audio import by listing both file extensions and video MIME types in the audio picker `accept` values.
- `runAudioLaneTransfer()` also rejected any `video/*` file as artwork, even though containerized audio files can arrive with video MIME types.
- That combination made the picker invite a source the flow was not prepared to handle safely.

**What we tried:**
- Removed video MIME types from the audio picker `accept` lists so iOS no longer offers `Take Video` for audio import.
- Kept `.mp4` and `.mov` extensions in place so existing containerized media files can still be chosen from files/photo-library sources.
- Tightened validation so audio transfer and audio replacement flows explicitly use `isSupportedTrackFile(...)` instead of routing all `video/*` files to artwork.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The release-safe decision here was to suppress the unsupported live-capture source rather than trying to make arbitrary captured video import safely as audio during prelaunch.

**Final fix:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) no longer advertises `video/mp4` / `video/quicktime` MIME types in audio import, replace, or transfer-lane pickers.
- `.mp4` and `.mov` extensions remain supported for existing files.
- Audio lane and replace flows now validate with `isSupportedTrackFile(...)`, so supported container files stay in the audio path instead of being misrouted as artwork.

**How to avoid this later:**
- Do not expose native capture sources that the downstream import path does not explicitly support end to end.
- Keep picker `accept` filters aligned with the actual runtime routing logic, especially on iOS where MIME hints influence offered source actions.
- If direct recording is desired later, build it as an explicit feature rather than incidentally inheriting `Take Video` from a generic file input.

---

### 22. Row mode needs same aura stroke increments as tile mode
**Status:** Fixed

**Notes:**
- Row mode should visually reflect aura stroke increments the same way tile mode does.
- This is consistency/UI fidelity work.

**Problem:**
- Aura stroke increments are not visually consistent between row mode and tile mode.

**Repro:**
- Compare aura progression in row mode versus tile mode.
- Observe that tile mode has clearer stroke increment treatment than row mode.

**Root cause:**
- Row mode already had an overall aura glow, but it did not expose the same obvious stepped stroke progression that tile mode gets from its layered aura border treatment.
- The row CSS also only had a coarse set of explicit aura step selectors, so the visual progression read flatter and less deliberate than tiles.

**What the code was doing before:**
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) gave `.rowAuraGlow` a general glow and accent treatment, but the inner row surfaces did not get the same kind of stepped inset stroke emphasis that tile mode had.
- Tile mode in [`styles.css`](/Users/paulfisher/Polyplay/styles.css) made aura progression clearer through stronger layered borders and inner hit-surface glow.

**What we tried:**
- Expanded row-mode aura stepping to cover the full `1` through `10` range explicitly.
- Added a visible stepped inset stroke treatment to the row artwork/meta surfaces and a stronger stepped outline on the row thumbnail.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The fix was to make row mode visually communicate progression more like tiles, not to copy tile layout wholesale.

**Final fix:**
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) now defines row aura steps across the full `1` to `10` range.
- Row mode now applies a clearer stepped inset stroke to `.trackRow__art` and `.trackRow__metaHit`, plus a stronger stepped aura outline on `.trackRow__thumb`.
- Result: row-mode aura progression now reads much closer to tile mode instead of feeling like one generic glow state.

**How to avoid this later:**
- When the same data state exists in multiple layouts, compare the actual perceived progression in each layout instead of assuming shared color/glow variables are enough.
- If one layout has a clearly legible stepped visual treatment, carry that progression language across the alternate layout intentionally.

---

### 23. Gesture: hard swipe down should exit Vault menu
**Status:** Fixed

**Notes:**
- Requested gesture behavior:
  - hard swipe down exits Vault menu
- Need to determine whether the existing Vault overlay supports gesture dismiss in a release-safe way.

**Problem:**
- Vault menu currently lacks the desired hard swipe-down exit gesture.

**Repro:**
- Open Vault menu.
- Attempt a hard swipe downward.
- Observe current behavior does not match desired dismiss gesture.

**Root cause:**
- The Vault overlay had explicit close buttons and keyboard escape handling, but no touch-gesture dismissal path.
- As a result, mobile users had no direct gesture equivalent for quickly throwing the modal away.

**What the code was doing before:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) rendered the Vault overlay as a standard modal section with button-based close behavior only.
- No Vault-specific touchstart/touchend gesture logic existed.

**What we tried:**
- Added a Vault-only touch gesture handler at the overlay level.
- Guarded the gesture so it only closes on a deliberate mostly-vertical downward swipe with enough distance or velocity to count as a hard dismiss.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important constraint was to avoid accidental closes from ordinary touch noise, so the implementation uses threshold checks instead of reacting to any downward drag.

**Final fix:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now tracks touch start/end on the Vault overlay and calls `closeVaultOverlay()` when the gesture is a strong downward swipe.
- The dismiss only triggers when the swipe is predominantly vertical and exceeds the configured distance/velocity guardrails.

**How to avoid this later:**
- Gesture dismissals for overlays should be scoped per overlay, not added globally.
- Use distance and sideways-drift thresholds so “swipe to dismiss” stays intentional instead of fighting normal touch exploration.

---

### 24. FX aura color does not apply until user triggers Aura +
**Status:** Fixed

**Notes:**
- Latest Xcode build shows the FX layer staying on the old/default aura color until the user activates `Aura +`.
- This looks like an initialization / theme-sync issue rather than an FX rendering failure.

**Problem:**
- FX aura color does not take effect immediately on load.
- The correct aura color only appears after the user triggers an aura interaction.

**Repro:**
- Launch the app with a non-default aura color already selected.
- Observe the FX layer color on first load.
- Trigger `Aura +`.
- Observe the FX color update only after that interaction.

**Root cause:**
- The ambient FX canvas was reading theme tokens from CSS inside its own effect during initialization.
- The app writes the resolved `--aura-rgb` CSS variable in a separate parent effect.
- On first load, the FX engine could initialize before that parent effect had written the current aura color, so it kept the fallback/default aura color until a later interaction forced another theme-token refresh.

**What the code was doing before:**
- [`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx) called `readThemeTokensFromCss()` during init/update and trusted the DOM to already contain the latest aura color.
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) separately set `--aura-rgb` from React state in its theme effect.
- That made the FX engine dependent on effect ordering instead of explicit state.

**What we tried:**
- Passed the resolved aura RGB string directly from [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) into [`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx).
- Merged that explicit aura value into the FX engine theme-token updates so initialization no longer depends on DOM timing.

**Why that didn't work:**
- No failed intermediate patch was kept.
- Once the init-order dependency was identified, the fix was to remove the timing dependency rather than trying to force another incidental refresh.

**Final fix:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now computes the resolved aura RGB for the current theme state and passes it directly to [`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx).
- [`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx) now merges that explicit aura value into the theme tokens used by the ambient FX engine on init, resize, and theme refresh.
- Result: FX uses the correct aura color immediately on load, without requiring the user to trigger `Aura +`.

**How to avoid this later:**
- Do not make first-render visual systems depend on CSS variables that are themselves written in later effects when the same data already exists in React state.
- For initialization-sensitive rendering paths, prefer passing resolved state directly instead of depending on DOM effect ordering.
