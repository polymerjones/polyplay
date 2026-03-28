## New tasks to add

### 9. Admin/settings success toast visibility for artwork and similar actions
**Status:** Fixed

**Notes:**
- When artwork is successfully updated, the confirmation toast/status is too low on the page.
- User does not reliably see it because it appears pinned near the very bottom of the long settings/admin page.
- This likely applies to other admin actions that currently surface success/progress too low in the scroll flow.

**Problem:**
- Success feedback is not sufficiently visible after artwork update and similar settings/admin actions.

**Repro:**
- Open Settings / Admin.
- Perform Update Artwork successfully.
- Observe that the toast/status appears too low on the page and can be missed.

**Root cause:**
- Manage Library success messages were being written only to the shared `status` line near the bottom of the admin page.
- On long Settings/Admin screens, that feedback could land below the viewport after actions like `Update Artwork`, so the user never got a strong visible confirmation.

**What the code was doing before:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) already had a fixed top success toast path for import completion, but Manage Library actions like `Update Artwork`, `Replace Audio`, and `Remove Track` only updated the bottom inline status block.
- The inline status block remained useful as persistent page state, but it was not a reliable place for immediate success feedback on a tall page.

**What we tried:**
- Reused the existing fixed top success-toast mechanism instead of creating another notification system.
- Routed the successful completion of `Update Artwork`, `Replace Audio`, and `Remove Track` through that same toast path while keeping the bottom status text intact.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The key was not to move all admin status messaging into a toast, because progress/error text still benefits from staying inline and persistent.

**Final fix:**
- In [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx), generalized the existing top success-notice helper and reused it for Manage Library media-success actions.
- `Update Artwork`, `Replace Audio`, and `Remove Track` now surface an immediate fixed toast near the top of the screen, so the confirmation remains visible on both desktop and iPhone even when the page is scrolled deep into admin controls.
- The bottom status line still updates too, preserving the existing persistent status behavior for the rest of Settings/Admin.

**How to avoid this later:**
- Use the fixed toast surface for short-lived success confirmations on long admin/settings pages.
- Keep inline bottom status for durable context such as progress, validation, and failure states.
- When adding a new admin action, decide explicitly whether its primary feedback should be:
  - fixed transient toast
  - persistent inline status
  - or both

---

### 10. Update dropdowns should default to the currently playing track
**Status:** Fixed

**Notes:**
- The issue where the currently playing track should be the default selected track in the update/replace dropdowns was not resolved.
- This affects update flows like:
  - Update Artwork
  - Replace Audio
  - Remove Track
- User expectation: the track currently playing should already be selected by default.

**Problem:**
- Update-related dropdowns do not reliably default to the currently playing/current track.

**Repro:**
- Start playback on a track.
- Open Settings / Admin.
- Check the update/replace/remove dropdown selections.
- Observe that the currently playing track is not consistently selected by default.

**Root cause:**
- The player was not publishing its active `currentTrackId` anywhere the admin iframe could reuse.
- Manage-side selector hydration fell back to the first returned track row, which made the default feel arbitrary whenever another track was currently playing.

**What the code was doing before:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) kept `currentTrackId` in React state only.
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) defaulted the update/replace/remove selectors to the first track returned from storage when their local state was empty.

**What we tried:**
- Added a narrow shared `localStorage` key for the currently playing track instead of building a heavier live sync path.
- Taught Admin to prefer that persisted active track when initializing or rehydrating the relevant selectors.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important constraint was to use the now-playing track only as the default/fallback, not to override a valid manual choice after the user already changed a selector.

**Final fix:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now persists the active `currentTrackId` to `localStorage`.
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now prefers that persisted active track for `Update Artwork`, `Replace Audio`, `Remove Track`, and the transfer target selector whenever the current selection is empty or invalid.
- If the saved active track no longer exists, Admin safely falls back to the first available track.

**How to avoid this later:**
- If a maintenance flow is supposed to target the current now-playing item, persist or expose that state explicitly instead of inferring from database ordering.
- Keep “default selection” logic separate from “forced live selection” so admin forms do not fight manual user input.

---

### 11. iOS bug: newly imported track shows 0:00 and does not play on first tap
**Status:** Fixed

**Notes:**
- On iOS, after importing a new track, the first tap can show `0:00` and fail to begin playback.
- It feels like the track is still loading or not fully ready.
- User reports this bug test session as generally feeling laggy around playback start.

**Problem:**
- Newly imported track can appear as `0:00` and fail to play on first tap on iOS.
- Playback start feels laggy/unready immediately after import.

**Repro:**
- On iOS, import a new track.
- Tap the newly imported track right away.
- Observe that it may show `0:00`, fail to play on first tap, or feel delayed/laggy before playback starts.

**Root cause:**
- Evidence in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) pointed to an iOS media-readiness race.
- After switching to a freshly loaded blob-backed audio source, the app immediately attempted `audio.play()` right after `load()`.
- If that first play attempt lost the race with metadata/readiness on iOS, the app dropped back to `isPlaying = false` and did not retry when the media became ready moments later.

**What the code was doing before:**
- On source switch, the player reset displayed time/duration to `0`, called `audio.load()`, and then tried one immediate pending-autoplay call.
- Later `loadedmetadata` / `durationchange` events updated duration, but they did not recover the failed first-play attempt.

**What we tried:**
- Kept the existing source-switch behavior.
- Added a narrow retry path for failed pending autoplay on iOS, scoped to the same active track/source.
- Wired that retry to media-readiness events (`loadedmetadata`, `durationchange`, `canplay`).

**Why that didn't work:**
- No failed intermediate patch was kept.
- The core issue was that a one-shot immediate `play()` attempt is not robust enough for freshly loaded object-URL media on iOS.

**Final fix:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now remembers when a pending autoplay fails during a fresh track switch on iOS.
- When the same source becomes ready enough to play, the app retries playback automatically instead of requiring the user to tap again.
- The retry state is cleared on teardown so it cannot leak into unrelated playback changes.

**How to avoid this later:**
- Treat source assignment and actual media readiness as separate states on iOS/Safari.
- For fresh imports and blob-backed audio, avoid assuming one immediate `play()` call after `load()` is always enough.

---

### 12. iOS Now Playing / Dynamic Island should show still album art if possible
**Status:** Fixed

**Notes:**
- User wants still album art to appear in the iOS Now Playing surface / Dynamic Island if supported.
- Need to audit whether the current native/plugin/Now Playing integration is already sending artwork correctly to the system UI.
- Need to confirm platform limits separately from app bugs.

**Problem:**
- Still album art does not appear in the iOS Now Playing / Dynamic Island surface as expected.

**Repro:**
- Start playback on iPhone.
- Observe the iOS Now Playing / Dynamic Island presentation.
- Check whether still album art appears there.

**Root cause:**
- The app’s native iOS Now Playing path was never receiving artwork data.
- [`src/lib/iosNowPlaying.ts`](/Users/paulfisher/Polyplay/src/lib/iosNowPlaying.ts) only exposed title/subtitle fields for `setNowPlayingItem`.
- [`ios/App/App/NowPlayingPlugin.swift`](/Users/paulfisher/Polyplay/ios/App/App/NowPlayingPlugin.swift) never set `MPMediaItemPropertyArtwork`, so iOS had no still image to show.

**What the code was doing before:**
- Browser `MediaSession` metadata already attempted to provide artwork on the web side.
- The native iOS plugin path only set title/artist/album/playback fields in `MPNowPlayingInfoCenter`.
- No artwork payload crossed the JS/native bridge.

**What we tried:**
- Extended the JS bridge to send still artwork with the current track.
- Preferred a data URL derived from `artBlob` for imported tracks, since browser blob URLs are not directly usable by native iOS.
- Added native support for resolving artwork from either a data URL or a URL and creating `MPMediaItemArtwork`.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The core issue was not a mysterious platform refusal; the plugin simply was not being given artwork and never set native artwork metadata.

**Final fix:**
- [`src/lib/iosNowPlaying.ts`](/Users/paulfisher/Polyplay/src/lib/iosNowPlaying.ts) now accepts and forwards artwork fields.
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now sends the current track’s still art when syncing the iOS Now Playing item.
- [`ios/App/App/NowPlayingPlugin.swift`](/Users/paulfisher/Polyplay/ios/App/App/NowPlayingPlugin.swift) now creates `MPMediaItemArtwork` and writes it into `MPNowPlayingInfoCenter`.

**How to avoid this later:**
- Treat browser `MediaSession` and native iOS Now Playing as separate metadata paths.
- When auditing missing lock-screen / Dynamic Island art, verify explicitly whether `MPMediaItemPropertyArtwork` is being set natively.

**Follow-up note:**
- Device testing exposed an additional regression with oversized/HDR still images after the initial native-artwork fix.
- That was addressed by normalizing imported still artwork before storage and shrinking the artwork payload sent through the iOS Now Playing bridge.
