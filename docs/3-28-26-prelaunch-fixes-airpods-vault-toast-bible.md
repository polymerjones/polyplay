## New issues to resolve quickly

### 25. Major: Vault export fails with “Backup too large” even though storage view shows plenty of space
**Status:** Fixed

**Notes:**
- User set up around 5 tracks and attempted Vault export.
- Export failed with a “Backup too large” style message.
- Manage Storage / file management view shows plenty of available room.
- This suggests a mismatch between:
  - actual export size limits
  - browser/native save pipeline limits
  - reported available storage
  - or a bug in export sizing/error handling

**Problem:**
- Vault export can fail with a size-related error even when the in-app storage view suggests there is enough room.

**Repro:**
- Import/setup roughly 5 tracks.
- Open Vault.
- Attempt Export Full Backup.
- Observe “Backup too large” / save-universe failure message.
- Compare against Manage Storage reporting available room.

**Root cause:**
- The backup/export layer in [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts) was enforcing a hard-coded `250 MB` estimated-size ceiling via `BackupSizeError`.
- The storage manager in [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts) reports actual IndexedDB/browser storage headroom, which is much larger and device-dependent.
- Those two numbers were unrelated, so the app could honestly show “plenty of space” in Manage Storage while still rejecting Vault export because of the separate export cap.

**What the code was doing before:**
- Full backup and polyplaylist export both used the same fixed `BACKUP_CAP_BYTES = 250 * 1024 * 1024`.
- When the estimated archive size crossed that ceiling, export threw `BackupSizeError("Backup too large")` before building the ZIP.
- Vault surfaced that as a generic save failure, and Admin surfaced an outdated modal message that specifically claimed the limit was `250MB`.
- Result: users were seeing what looked like a false storage failure when the real issue was a stale export-size policy.

**What we tried:**
- Replaced the fixed backup cap with a platform-aware export cap:
  - constrained mobile devices now use a higher but still bounded export ceiling
  - desktop uses a larger ceiling
  - low-memory devices can still clamp lower through `navigator.deviceMemory` when available
- Updated both Vault and Admin messaging to explain the real numbers:
  - actual backup estimate
  - actual device export limit

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important point was not “storage is wrong,” but “Vault export was using a completely different limit than storage reporting.”

**Final fix:**
- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts) now computes export caps with `getBackupCapBytes()` instead of using one fixed `250MB` constant.
- Full backup and polyplaylist export now compare their estimated archive size against that dynamic cap.
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now shows a precise Vault error when export is too large:
  - backup estimate
  - device export limit
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now shows the same accurate size-based explanation in the admin backup modal.
- Result: normal medium-sized libraries are less likely to be rejected unnecessarily, and if a library is still too large the app now explains the real export constraint instead of implying storage space is the problem.

**How to avoid this later:**
- Do not let backup/export ceilings drift away from the storage limits shown elsewhere in the product without explaining the distinction in UI copy.
- If two different limits exist, they must be named differently:
  - storage capacity
  - export/archive limit
- Size-related user-facing errors should include the measured estimate and the active cap so “too large” is actionable instead of mysterious.

---

### 26. Major: Manage Storage track names not showing correctly
**Status:** Fixed

**Notes:**
- Track names are not showing correctly in the storage manager list.
- Tapping Rename reveals which track it actually is.
- This makes storage management confusing and messy.
- User speculated about needing a “Nuke Cache” button or similar cleanup path, but that should be treated as a separate product idea unless root cause proves it necessary.

**Problem:**
- Manage Storage list is not reliably displaying track names, making the interface confusing.

**Repro:**
- Open Settings / Admin.
- Go to storage/file-management area.
- Observe that track names are missing/incorrect/blank.
- Tap Rename and observe that the actual item identity becomes visible.

**Root cause:**
- The underlying storage rows were still being built from `track.title`, so the data path itself was not the main problem.
- The non-edit Manage Storage row label was relying on a squeezed one-line title area next to action buttons, which made long titles and ugly picker-derived names read badly or collapse into something that did not clearly identify the track.
- That is why tapping `Rename` appeared to “reveal” the correct track: the edit state showed the real title in an input, while the normal display state was much less legible.

**What the code was doing before:**
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts) returned raw `track.title` values for storage rows.
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) rendered that title directly inside a compressed flex row with `truncate`.
- The row layout and label treatment were not intentionally tuned for very long titles or noisy imported filenames, so the visible label could become misleading or hard to read.

**What we tried:**
- Added an explicit Manage Storage display-label formatter instead of trusting raw CSS truncation alone.
- Switched the visible title treatment to middle truncation, which preserves both the recognizable start and end of longer names.
- Tightened the row layout so the title area keeps predictable width next to `Rename` / `Remove`.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The key issue was clarity of the display state, not the rename flow itself.

**Final fix:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now formats Manage Storage labels with a dedicated `formatTrackStorageLabel(...)` helper instead of rendering the raw title directly.
- The row title now keeps the full original title in a `title` attribute while the visible text uses a more legible middle-truncated label.
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) now gives the title-wrap a stable full-width flex layout and constrains the title text more deliberately.
- Result: Manage Storage rows should identify tracks more clearly in normal view, instead of only becoming understandable after entering Rename mode.

**How to avoid this later:**
- In storage-management UIs, do not rely on generic one-line truncation as the only identity surface for user files.
- If filenames/titles may be long or noisy, use a deliberate display formatter and preserve the full value on demand.
- When users say “rename reveals the real item,” treat that as a sign the read-only presentation layer is the bug, not necessarily the stored data.

---

### 27. AirPods Pro support: play/pause should work reliably
**Status:** Fixed

**Notes:**
- At minimum, play and pause should work via AirPods Pro controls.
- This likely overlaps with remote transport / audio-session / resume-state handling.

**Problem:**
- AirPods Pro controls are not behaving reliably for play/pause.

**Repro:**
- Connect AirPods Pro.
- Start playback.
- Use AirPods play/pause controls.
- Observe whether playback responds correctly.

**Root cause:**
- AirPods remote commands were already being received through Media Session and the iOS Now Playing bridge, but both paths delegated resume to the same plain `audio.play()` call used by normal UI taps.
- That was too optimistic for iOS/WebKit headset/background scenarios, where the audio element can be paused yet no longer be in a clean, ready-to-resume state.
- As a result, remote play/pause support existed, but it was not robust enough to be called reliable.

**What the code was doing before:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) bound AirPods/remote transport to:
  - `bindMediaSessionTransportActions(...)`
  - `addIosNowPlayingRemoteCommandListener(...)`
- Remote play/toggle ended up calling the same direct `audio.play()` path as the UI.
- Remote pause simply paused the element without explicitly committing the latest playback position before the pause.

**What we tried:**
- Replaced the raw resume path with a shared recovery-aware playback helper.
- Made remote pause persist the current playback position before pausing.
- Added iOS-specific resume recovery that can:
  - repair the source if needed
  - force a reload when readiness has degraded
  - restore the prior playback time
  - retry playback after the media element becomes ready again

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important issue was not command delivery but recovery after command delivery.

**Final fix:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now uses a shared `resumeCurrentTrackPlayback(...)` helper for:
  - headset/media-session play
  - same-track replay
  - normal toggle resume
- That helper now:
  - repairs missing/mismatched `src`
  - refreshes the media element when readiness is too low
  - performs an iOS-specific reload-and-retry recovery path when playback resume initially fails
- Remote pause now goes through a shared `pauseCurrentTrackPlayback(...)` path that commits the latest time before calling `pause()`.
- Result: AirPods play/pause transport should behave more reliably instead of depending on a fragile direct `audio.play()` call.

**How to avoid this later:**
- Treat remote transport as a distinct reliability path, not just a second button wired to the same optimistic playback call.
- Persist playback position before remote pause.
- On iOS, assume headset/background resume may need a media-element recovery step even if UI-tap playback looked fine.

---

### 28. Major: pausing with AirPods Pro can prevent playback from restarting
**Status:** Fixed

**Notes:**
- Pausing the app with AirPods Pro caused playback to become unable to restart.
- Tapping another song and starting playback freed the bug, then the original track could play again.
- Tester was using a 13-minute 32-bit WAV, which may be relevant.
- Could be related to:
  - remote play/pause handling
  - native audio session state
  - large-file decode/resume edge case
  - transport state not recovering correctly after remote pause

**Problem:**
- Remote pause from AirPods can put playback into a state where it will not resume normally.

**Repro:**
- Use AirPods Pro.
- Play a long WAV track (tester used 13-minute 32-bit WAV).
- Pause with AirPods.
- Attempt to resume.
- Observe that playback may fail to restart.
- Tap another song and start playback, then return to the previous track and observe it can resume.

**Root cause:**
- After a remote AirPods pause, the current audio element could remain attached to the same track but drop into a stale state where a direct `audio.play()` no longer recovered cleanly.
- Because the app did not repair/reload the element on remote resume, playback could stay stuck until switching tracks forced a fresh source assignment.
- The user report that “tapping another song freed it” matches that exact failure mode.

**What the code was doing before:**
- AirPods pause called `audio.pause()`.
- AirPods resume called the normal toggle resume path, which tried `audio.play()` directly.
- If that failed on iOS, the app set `isPlaying` false but did not rebuild the media element around the same track.
- Switching to another track later happened to fix the issue because it reassigned `src`, loaded a fresh media element state, and then playback could continue.

**What we tried:**
- Added a proper same-track iOS recovery path instead of requiring a track switch.
- Preserved the resume position before and during recovery.
- Retried playback after a forced reload once the element reported readiness again.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The key insight was that the “switch to another song and come back” workaround was already telling us the fix: rebuild the same-track media state automatically when remote resume fails.

**Final fix:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now performs an iOS-specific same-track recovery when resume fails after remote pause:
  - pauses the element
  - reassigns the current track source
  - reloads the element
  - waits for `loadedmetadata` / `canplay`
  - restores the saved playback time
  - retries `play()`
- Result: the app no longer needs a manual “play another song first” workaround to recover from the AirPods remote-pause wedge state.

**How to avoid this later:**
- When a user workaround involves changing tracks to recover playback, inspect the same-track resume path before assuming the media file itself is bad.
- Long/large WAV files are useful stress cases and should stay in the transport regression test set.
- For remote-control regressions, test both:
  - command delivery
  - same-track resume recovery after pause

---

### 29. Importing toast should be much louder / more obvious
**Status:** Fixed

**Notes:**
- User wants the “IMPORTING” toast to be much bigger / louder / more visually obvious.
- There is interest in possibly using a custom animated toast if a design is provided.
- This is a UX feedback-clarity task.

**Problem:**
- Importing feedback is too quiet / subtle and does not reassure the user strongly enough.

**Repro:**
- Trigger import flow.
- Observe current importing toast.
- Compare against desired more prominent feedback.

**Root cause:**
- The import flow in [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) was only updating the subtle bottom admin status line to `Importing...`.
- That status line is easy to miss during a heavy media import, especially when the user is waiting on artwork processing and blob storage work.
- So the app was working, but the visible reassurance was too quiet for the importance of the action.

**What the code was doing before:**
- `onUpload(...)` set `status` to `Importing...`.
- The primary visible top toast only appeared after success through the existing success-notice path.
- There was no large, dedicated “import in progress” surface.

**What we tried:**
- Added a dedicated import-progress banner at the top of the admin surface.
- Gave it stronger hierarchy:
  - import eyebrow
  - large import title
  - clear subtext telling the user to keep the window open while media is being stored
- Cleared that banner when the flow transitions into success or failure.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The issue was not missing state, just the lack of a loud enough visual treatment for the existing state.

**Final fix:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now has a dedicated `importNotice` state and top-of-screen import-progress banner for the main track import flow.
- The import banner appears immediately when import begins and is cleared when the flow either:
  - succeeds and hands off to the success toast
  - fails and falls back to error/status handling
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css) now includes a larger, louder `.admin-import-toast` style instead of relying on the tiny bottom status line.
- Result: import now feels visibly active instead of ambiguously silent.

**How to avoid this later:**
- For long-running media actions, do not rely on low-emphasis status text as the only “work is happening” signal.
- Use a dedicated progress surface for operations users may otherwise mistake for a hang.
- Reserve subtle status strips for secondary details, not for the primary reassurance message during heavy import/export tasks.

---

### 30. Bible verse button should split into forward/backward cycling controls
**Status:** Fixed

**Notes:**
- Request: take the existing Bible verse button and split it into two horizontal triangles.
- Keep the same general color/theme language as the current verse button.
- Purpose:
  - one side goes backward
  - one side goes forward
  - user can cycle through Bible verses instead of only getting a random one

**Problem:**
- Current Bible verse control is too one-directional/random and does not support intentional cycling.

**Repro:**
- Use the Bible verse control.
- Observe that the user cannot step backward/forward through verses as desired.

**Root cause:**
- The journal already tracked verse position with `verseIndex`, but the UI still exposed that state through a single “next/random-feeling” verse button.
- That made the control too one-directional even though the underlying state model already supported indexed cycling.

**What the code was doing before:**
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) rendered a single floating verse button that always advanced the verse index forward.
- Verse feedback and haptics were already centralized enough to reuse, but there was no backward control.

**What we tried:**
- Extracted verse cycling into a shared helper that accepts `-1` or `+1`.
- Split the UI into two horizontal controls:
  - previous verse
  - next verse
- Kept the same golden visual language and existing verse flash/haptic feedback.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The key here was not rewriting verse state, just exposing the already-existing index state in a more intentional control shape.

**Final fix:**
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) now uses a shared `cycleVerse(...)` helper and renders separate previous/next buttons.
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css) now styles those buttons as paired horizontal controls that keep the same warm/golden verse-button identity.
- Verse flash and light haptic feedback still fire for both directions.
- Result: the Bible verse control now supports intentional backward/forward cycling instead of only one-way stepping.

**How to avoid this later:**
- If the state model already supports ordered navigation, the UI should expose that intentionally instead of pretending the feature is random-only.
- Reuse the same feedback layer when splitting a control, so the interaction remains familiar even when the affordance improves.

---

### 31. Product naming question: “Binge” / “Bidge”
**Status:** Open question

**Notes:**
- Need naming sanity check / trademark/app-name existence research before treating as real naming candidates.
- This is not yet a bug fix, but a product/branding question captured here so it does not get lost.

**Problem:**
- Need to determine whether “Binge” is already too established as an app name, and whether “Bidge” is a viable alternative.

**Repro:**
- Research naming availability / conflicts / app-store existence / brand confusion.

**Root cause:**

**What the code was doing before:**
- Not applicable.

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**
