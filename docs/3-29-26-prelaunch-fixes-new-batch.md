## Intake note

- This file is the canonical log for the new prelaunch bug batch from March 29, 2026.
- Every confirmed finding from dev notes, screenshots, reproduction, code inspection, and fixes-in-progress should be documented here.
- Keep each item updated with status, root cause, attempted fixes, final fix, and any follow-up risk.

---

## New bug batch — latest notes with screenshots

### 32. Major: Manage Storage track-title display bug still persists
**Status:** Fixed in code / device recheck needed

**Notes:**
- File management / Manage Storage is still not reliably showing track titles.
- Rename flow reveals what the item actually is, which confirms the underlying item identity exists.
- This is a continued regression / unresolved bug from prior passes.

**Problem:**
- Manage Storage list does not reliably display track titles, making storage management confusing.

**Repro:**
- Open Settings / Admin.
- Go to Manage Storage / file management.
- Observe blank/missing/incorrect titles in the list.
- Tap Rename and observe that the actual track identity becomes visible.

**Root cause:**
- Manage Storage rows were rendering from `getTrackStorageRows()` titles only, while other admin views had fresher track-title data from `getTrackRowsFromDb()`.
- That made the storage view more vulnerable to stale or weak title fallback behavior than the rename flow.

**What the code was doing before:**
- The storage row label, rename button label, and remove-confirm copy all trusted `row.title` from the storage-row snapshot.

**What we tried:**
- Re-linked storage-row display and actions to the richer track list already loaded in admin state.

**Why that didn't work:**
- N/A. This was a straightforward data-source mismatch.

**Final fix:**
- `src/admin/AdminApp.tsx` now builds a `trackTitleById` map from the full admin track rows and uses that preferred title for:
  - Manage Storage row label
  - Rename button label and starting rename value
  - Remove confirmation copy

**How to avoid this later:**
- Do not let adjacent admin surfaces use different title fallbacks for the same underlying track record.

---

### 33. Gestures: hard swipe down to close Gratitude Journal
**Status:** Fixed in code / mobile gesture verification needed

**Notes:**
- Desired gesture:
  - hard swipe down in the top hero bar or significant blank space closes the Gratitude Journal
- This should feel natural and intentional on mobile.

**Problem:**
- Gratitude Journal currently lacks the desired hard swipe-down close gesture.

**Repro:**
- Open Gratitude Journal.
- Try a strong downward swipe in the hero area / blank space.
- Observe current behavior does not dismiss as desired.

**Root cause:**
- Journal dismissal supported tap-near-edge close and explicit close-button dismissal, but did not have a dedicated downward swipe-dismiss path for the card itself.

**What the code was doing before:**
- The journal modal had no tracked touch-start / touch-end logic for a hard downward swipe gesture.

**What we tried:**
- Added a guarded swipe detector to the journal card.

**Why that didn't work:**
- N/A. The missing logic was added directly.

**Final fix:**
- `src/components/JournalModal.tsx` now closes on a fast / hard downward swipe that starts in the top band of the card.
- The swipe start is intentionally blocked on buttons, inputs, labels, and active edit/import states so the gesture only applies to hero / blank-space dismissal.
- Successful swipe dismissal fires a light haptic before closing.

**How to avoid this later:**
- Modal UX work should explicitly define whether dismissal is button-only, edge-tap, drag, or swipe so mobile expectations are handled up front.

---

### 34. Gestures: hard swipe down in expanded waveform player should minimize to mini player
**Status:** Fixed in code / mobile gesture verification needed

**Notes:**
- Desired gesture:
  - in expanded waveform player, a hard quick swipe down in the top/title/minimize area should collapse back to minimal player mode
- Intended to mirror the existing minimize-button behavior.

**Problem:**
- Expanded waveform player lacks the desired swipe-down minimize gesture.

**Repro:**
- Open expanded waveform player.
- Swipe down hard/quickly in the title area / minimize-button region.
- Observe current behavior does not minimize as desired.

**Root cause:**
- Fullscreen player had a swipe-dismiss implementation, but it was too broad / underspecified relative to the requested “top/title/minimize area” gesture and was not anchored to a clear swipe handle zone.

**What the code was doing before:**
- Touch start/end was attached at the shell level without a dedicated top swipe handle target.

**What we tried:**
- Added a dedicated top swipe zone and constrained swipe-start eligibility to the close button, top swipe handle, or title/meta region.

**Why that didn't work:**
- N/A. The gesture path now matches the requested region much more closely.

**Final fix:**
- `src/components/FullscreenPlayer.tsx` and `src/components/player.css` now expose a visible top swipe handle and only treat swipe-down gestures from the top/title/minimize region as a fullscreen close-to-mini-player action.

**How to avoid this later:**
- For mobile player gestures, define the swipe-origin zone in both code and UI so gesture intent is obvious and testable.

---

### 35. Haptics: Nuke Playlist needs escalating countdown buildup and strong final hit
**Status:** Fixed in code / on-device feel tuning may still be needed

**Notes:**
- Desired effect:
  - haptic buildup becomes more rapid as timer approaches zero
  - hard strong vibration at zero
- This should reinforce the destructive countdown.

**Problem:**
- Nuke Playlist countdown lacks the desired escalating haptic feedback.

**Repro:**
- Trigger Nuke Playlist countdown.
- Observe current haptic behavior is missing or insufficient.

**Root cause:**
- Nuke countdown armed visually but did not escalate haptically as the timer approached zero.

**What the code was doing before:**
- The countdown interval updated the timer display and then executed the destructive action with no staged countdown haptic ladder.

**What we tried:**
- Added countdown “buckets” with increasing haptic intensity and frequency as the timer closes in on zero.

**Why that didn't work:**
- N/A. This was missing behavior rather than a failed previous patch.

**Final fix:**
- `src/admin/AdminApp.tsx` now fires:
  - initial arming haptic
  - lighter mid-countdown pulses
  - stronger rapid pulses near zero
  - strong final hit at zero before the nuke executes
- Added `fireMediumHaptic()` in `src/lib/haptics.ts` for the mid-stage buildup.

**How to avoid this later:**
- High-stakes destructive countdowns should treat sound, visuals, and haptics as one coordinated feedback sequence.

---

### 36. Haptics: Factory Reset should have stronger staged haptic behavior
**Status:** Fixed in code / on-device feel tuning may still be needed

**Notes:**
- Desired behavior:
  - double haptic as permission window pops up
  - hard vibration when Factory Reset is actually initiated

**Problem:**
- Factory Reset haptic feedback is not staged/strong enough for the seriousness of the action.

**Repro:**
- Trigger Factory Reset flow.
- Observe current haptic feedback is absent or too weak.

**Root cause:**
- Factory Reset only emphasized the completed destructive action, not the confirmation step that introduces the permission prompt.

**What the code was doing before:**
- The flow waited until reset completion to trigger a single heavy haptic.

**What we tried:**
- Added staged haptics at the start of the reset flow plus the final heavy completion haptic.

**Why that didn't work:**
- N/A. This was missing sequencing rather than a broken existing effect.

**Final fix:**
- `src/admin/AdminApp.tsx` now fires a staged pre-confirm haptic pair before `window.confirm(...)`, then still fires the heavy completion haptic once Factory Reset actually completes.

**How to avoid this later:**
- Serious destructive flows should differentiate “warning prompt opening” feedback from “destructive action completed” feedback.

---

### 37. Theme bug: amber / teal / crimson background lines are still purple
**Status:** Fixed in code / visual device pass still needed

**Notes:**
- Custom themes still show purple background lines.
- Amber especially should feel glowing candlelight/golden, not purple.
- This is a theme-consistency bug.

**Problem:**
- Theme-specific background line colors are not matching the selected custom theme.

**Repro:**
- Switch to Amber, Teal, or Crimson theme.
- Observe that the background lines remain purple-toned instead of following the selected theme mood.

**Root cause:**
- The global decorative background-line layer still had a purple hardcoded fallback, so custom themes could visually leak purple line color.

**What the code was doing before:**
- `styles.css` used fixed purple RGBA values in `body::before` for the decorative background circles/lines.

**What we tried:**
- Moved the decorative line color to a theme variable and assigned slot-specific RGB values for crimson, teal, and amber.

**Why that didn't work:**
- N/A. The issue was a hardcoded shared color path.

**Final fix:**
- `styles.css` now uses `--bg-line-rgb` in `body::before`.
- Custom theme slots explicitly set:
  - crimson line RGB
  - teal line RGB
  - amber line RGB

**How to avoid this later:**
- Any full-screen decorative layer should read from theme variables, not fixed brand-default colors.

---

### 38. Importing artwork efficiency: can PolyPlay skip the extra iOS preview window?
**Status:** Audited / no clear app-side fix in current web flow

**Notes:**
- Current flow shows a preview window with an accept/check button after selecting a photo from gallery.
- User would prefer to skip that extra preview and instead rely on PolyPlay's own artwork-preview UI, ideally with haptic feedback.
- Need to determine whether this is possible or whether the iOS picker flow forces that preview.
- Screenshot evidence captured on March 29, 2026 shows the iPhone image-preview UI with a top-left close button, centered Photos title pill, and top-right confirm check before returning to PolyPlay.
- Current code inspection suggests PolyPlay is using a normal browser file input for artwork selection in admin import/update flows, not a custom in-app preview controller.

**Problem:**
- Artwork import flow may feel redundant/slow because of the extra iOS preview/accept stage.

**Repro:**
- Select photo from gallery for artwork.
- Observe preview/accept screen before returning to app.
- Compare against desired in-app acceptance flow.

**Root cause:**
- Likely iOS Photos / browser file-picker confirmation behavior, not an extra PolyPlay-owned preview layer.
- Current evidence points to the artwork flow being launched from plain file inputs in `src/admin/TransferLaneDropZone.tsx` and `src/admin/AdminApp.tsx`, which means the intermediate preview may be imposed by Safari / iOS photo selection UX.
- This is not yet fully confirmed for every artwork-entry path, so treat this as an evidence-backed working diagnosis.

**What the code was doing before:**
- Admin artwork import/update uses `<input type="file">` via `TransferLaneDropZone` with `accept="image/*,video/mp4,video/quicktime,.mov"`.
- No explicit app-side “preview before accept” step is visible in the current artwork picker path before the selected file returns to PolyPlay.

**What we tried:**
- Inspected current artwork picker code paths in admin import/update flow.

**Why that didn't work:**
- No PolyPlay-owned extra preview step was found to remove; the observed preview appears to come from iPhone Photos / Safari picker UX.

**Final fix:**
- No app-side code fix applied in this pass.
- Current conclusion: in the web-based artwork flow, this extra preview is likely system-controlled and may not be skippable from normal file-input usage.

**How to avoid this later:**
- When a picker UX looks redundant on iPhone, first verify whether it is browser/OS-owned before spending time trying to remove it in app code.
- Keep notes split between “PolyPlay UI” and “system picker UI” so product decisions do not get blocked by the wrong layer.

---

### 39. Repeat Track button: add third mode “3PEAT”
**Status:** Fixed in code / playback verification needed

**Notes:**
- Desired third toggle mode:
  - loop icon with number 3
  - distinct tint
  - track (or track-loop) repeats 3 more times
  - then advances to next track and resets to no repeat
- Haptic feedback desired:
  - normal haptic for repeat changes
  - harder haptic for entering 3PEAT

**Problem:**
- Current repeat control does not support the desired limited-repeat mode.

**Repro:**
- Use Repeat Track button.
- Observe that only the existing repeat modes are available.

**Root cause:**
- Repeat Track was modeled as a boolean on/off state, so there was no room for a limited-repeat mode with remaining-count behavior.

**What the code was doing before:**
- Repeat toggled only between off and repeat-one.

**What we tried:**
- Replaced the boolean repeat state with an explicit repeat mode enum.

**Why that didn't work:**
- N/A. This required a state-model upgrade, not a bug patch on existing boolean logic.

**Final fix:**
- `src/types.ts` now defines `RepeatTrackMode = "off" | "loop-one" | "threepeat"`.
- `src/App.tsx` now cycles repeat as:
  - off
  - loop-one
  - threepeat
  - off
- Threepeat behavior:
  - starts with 3 extra repeats
  - decrements on each track end
  - resets to off after the final extra repeat
  - then advances normally
- UI updates:
  - repeat button now shows badge `1` for loop-one and `3` for threepeat
  - threepeat gets a distinct tint
  - entering threepeat uses a heavier haptic

**How to avoid this later:**
- Controls that are likely to gain more than two states should start from an explicit mode enum, not a boolean.

---

### 40. Playback design question: playlist switching currently hard-stops playback
**Status:** Implemented with user-preferred behavior

**Notes:**
- Current behavior:
  - switching playlists stops playback abruptly
- User idea A:
  - keep current track running until another track is selected
- User idea B:
  - if A is too risky, add ~1.5 second fade-out when playlist switches
  - fade-out would be cut short if user starts another track

**Problem:**
- Playlist switching currently feels abrupt.

**Repro:**
- Start playback.
- Switch playlists.
- Observe abrupt stop.

**Root cause:**
- Playlist refresh logic tore down the current audio whenever the current track was not present in the newly visible playlist track list.

**What the code was doing before:**
- Switching playlists caused `refreshTracks()` to call `teardownCurrentAudio()` if the active track was not in the new visible playlist.

**What we tried:**
- Kept the current track alive as long as it still exists in the full library catalog, even if it is no longer in the newly selected playlist view.

**Why that didn't work:**
- N/A. The abrupt stop was directly tied to teardown logic.

**Final fix:**
- `src/App.tsx` now preserves the currently playing track through playlist switches unless that track is actually gone from the library.
- The current-track lookup now uses a full track catalog, not just the visible playlist subset.

**How to avoid this later:**
- Distinguish “visible in current playlist” from “currently loaded in player” so playlist-view changes do not implicitly become playback-stop actions.

---

### 41. Toast: Vibe button should show “Vibe switch.”
**Status:** Fixed in code

**Notes:**
- Similar to FX toggle toasts.
- Desired copy:
  - `Vibe switch.`

**Problem:**
- Vibe toggle currently lacks the desired feedback toast.

**Repro:**
- Press Vibe button.
- Observe current feedback does not include the desired toast.

**Root cause:**
- Vibe mode changed state silently, unlike the FX toggle which already surfaced a toast.

**What the code was doing before:**
- `cycleNoveltyMode()` updated novelty state only.

**What we tried:**
- Reused the existing FX toast pipeline for the Vibe copy.

**Why that didn't work:**
- N/A.

**Final fix:**
- `src/App.tsx` now sets the toast copy to `Vibe switch.` whenever the Vibe button cycles mode.

**How to avoid this later:**
- Similar surface-level toggles should share the same feedback contract unless there is a clear reason not to.

---

### 42. Major: Safari on iPhone Vault export opens about:blank and does not complete
**Status:** Fixed in code / iPhone Safari verification still needed

**Notes:**
- On Safari browser on iPhone, exporting Vault opened a new tab with `about:blank`.
- User saw a “Preparing backup...” style state and nothing useful happened.
- Gratitude Journal export seemed fine, but Vault export path did not work.
- Screenshot evidence captured on March 29, 2026 shows a blank Safari tab with `about:blank` in the address bar and a minimal “Preparing backup...” message rendered near the top.
- Current code inspection in `src/App.tsx` matches this behavior exactly.

**Problem:**
- Vault export is still broken on Safari iPhone browser.

**Repro:**
- Open app in Safari on iPhone.
- Attempt Vault export.
- Observe new tab opens to `about:blank` and export does not complete usefully.

**Root cause:**
- `saveUniverseBackup()` can call `openPendingPreviewWindow()` on iOS / standalone PWA before the backup blob is ready.
- `openPendingPreviewWindow()` explicitly runs `window.open("", "_blank")`, sets the document title to `Preparing backup`, and injects a small “Preparing backup…” HTML placeholder into that new tab.
- If the later save/share flow fails, stalls, or is blocked before `openBlobPreview()` replaces that window with the actual blob preview, the user is left staring at `about:blank`.
- This root cause is strongly supported by the current code and the screenshot.

**What the code was doing before:**
- In `src/App.tsx`, iPhone-oriented export tries to pre-open a window so Safari will allow a later blob preview/share step.
- That placeholder window is intentionally seeded with the exact “Preparing backup…” copy seen in the screenshot.
- The success path then depends on `saveBlobWithBestEffort()` eventually calling `openBlobPreview()` with the finished blob.

**What we tried:**
- Removed the placeholder-window handoff from the Universe backup export path and switched it to the same shared best-effort save helper used by other exports.

**Why that didn't work:**
- N/A. The placeholder tab itself was the failure surface.

**Final fix:**
- `src/App.tsx` no longer pre-opens a blank “Preparing backup” tab for Universe backup export.
- Universe backup now uses the shared `src/lib/saveBlob.ts` helper directly after the blob is ready, avoiding the `about:blank` placeholder-tab trap.

**How to avoid this later:**
- Avoid pre-opened placeholder windows unless delayed blob handoff has been proven stable on iPhone Safari under real export timing.
- Avoid placeholder-window export flows unless the handoff from “pre-opened tab” to “real blob/share target” is proven reliable on iPhone Safari.
- When using a pre-opened window as a popup-blocker workaround, document the exact fallback and failure states so QA can verify them on-device.
