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
**Current active task:** `Import-page Enter/Return submit reliability`

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - fix implemented for import-page Enter/Return submit reliability
- Focus:
  - restore Enter/Return activation of the Import action on the import page for desktop and iOS
- Files inspected so far:
  - `src/admin/AdminApp.tsx`
- Findings:
  - The import page already had a form `onSubmit` and a form-level Enter handler.
  - The failure was a reliability seam in how Enter/Return reached that submit path from field focus states.
  - Title and Artist were the main text-entry fields where users expect Return to activate Import.
- Narrow implementation plan:
  - add one shared keyboard-submit helper for the import form
  - reuse it on the form and explicitly on the Title/Artist inputs
  - keep the existing import behavior unchanged
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Added a shared `requestUploadSubmitFromKeyboard(...)` helper in `src/admin/AdminApp.tsx`.
    - Wired the import form to use that helper.
    - Wired the Title and Artist inputs to use that helper directly.
    - Added `enterKeyHint="done"` to the Title and Artist inputs for cleaner iOS keyboard behavior.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow keyboard-submit reliability fix only.
  - Regression risk:
    - Low.
    - Main risk is just confirming Enter still stays suppressed for textarea/range/file inputs and that normal button click import remains unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - On desktop, focus Title or Artist and press Enter; confirm Import runs.
    - On iOS, focus Title or Artist and press Return/Done; confirm Import runs.
    - Confirm textarea/select/range/file controls do not trigger accidental submit.
    - Confirm tapping the Import button still works normally.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - fix implemented for playlist-backup filename suffix and Gratitude prompt lag/shimmer polish
- Focus:
  - rename playlist-backup default suffix from `polyplaylist.polyplaylist` to `polyplay.polyplaylist`
  - remove the laggy/shimmery Gratitude typing treatment
- Files inspected so far:
  - `src/lib/backup.ts`
  - `src/components/GratitudePrompt.tsx`
  - `src/App.tsx`
  - `styles.css`
- Findings:
  - Playlist-backup filenames came from `getPolyplaylistFilename(...)`, so the suffix change was a single helper seam.
  - The Gratitude prompt applied `is-typing` whenever it was open/focused, which painted a full animated shimmer overlay over the card/text area.
  - Gratitude typing also triggered a separate reactive body effect on each throttled keystroke from `App.tsx`.
- Narrow implementation plan:
  - change only the playlist-backup filename helper
  - remove the Gratitude prompt `is-typing` usage and stop firing the per-keystroke reactive callback
  - keep the rest of the Gratitude prompt flow unchanged
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Changed playlist-backup default filename format to end with `-polyplay.polyplaylist`.
    - Removed the Gratitude prompt `is-typing` class usage so the shimmering overlay no longer appears over the prompt/text field.
    - Removed the Gratitude per-keystroke reactive typing path from `App.tsx`.
    - Added a lightweight local Gratitude keypress pulse that briefly lifts the card/textarea border only, without obstructing text.
  - Exact files changed:
    - `src/lib/backup.ts`
    - `src/components/GratitudePrompt.tsx`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. These are narrow presentation/naming seams only.
  - Regression risk:
    - Low.
    - Main risk is only confirming the new filename appears everywhere playlist backup uses the helper and that the Gratitude prompt still opens/completes normally.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Export a playlist backup and confirm the filename now ends in `-polyplay.polyplaylist`.
    - Confirm playlist backup import still accepts the new filename normally.
    - Open Gratitude prompt and confirm typing feels responsive.
    - Confirm there is no shimmering overlay over the text field/card while typing.
    - Confirm keypress still produces a subtle visible FX without slowing typing.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - diagnosis confirmed for playlist-level reverse-order toggle
- Focus:
  - add a safe per-playlist reverse-view preference with clean placement in playlist management UI
- Files inspected so far:
  - `src/lib/storage/library.ts`
  - `src/lib/playlistState.ts`
  - `src/lib/db.ts`
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
  - `styles.css`
- Findings:
  - Playlist metadata can safely carry a small persisted flag without changing track records.
  - Visible playlist tracks already derive from playlist `trackIds` through `getVisibleTracksFromLibrary(...)`.
  - Playback next/prev already derive from a playlist-owned navigation list in `src/App.tsx`.
  - The cleanest non-noisy UI placement is the existing playlist manager in admin/settings, where playlists already have actions like Activate / Rename / Delete.
- Narrow implementation plan:
  - add a persisted playlist-level `isReversed` flag
  - derive visible and playback track order from a copied-reversed id list when that flag is true
  - place a labeled `Reverse Order` checkbox row in the playlist manager only
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Added persisted `isReversed` playlist metadata in library storage.
    - Added a shared `getOrderedPlaylistTrackIds(...)` helper that returns a copied reversed array when needed.
    - Updated visible-track derivation and playback-navigation derivation to consume that helper.
    - Added `setPlaylistReverseOrderInDb(...)` for narrow persistence.
    - Added a `Reverse Order` checkbox in the existing playlist manager row in admin/settings.
  - Exact files changed:
    - `src/lib/storage/library.ts`
    - `src/lib/playlistState.ts`
    - `src/lib/db.ts`
    - `src/App.tsx`
    - `src/admin/AdminApp.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes, with normal QA.
    - This is a non-destructive playlist view/order preference, not a track reorder system.
  - Regression risk:
    - Low to moderate.
    - Main risk is making sure visible playlist order and playback navigation stay aligned when reverse is on.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Toggle `Reverse Order` on a playlist and confirm tracks display in reverse.
    - Toggle it back off and confirm original order returns.
    - Confirm shuffle still works.
    - Confirm autoplay and next/prev still work.
    - Confirm artwork/fullscreen/current-track behavior is unchanged.
    - Confirm each playlist preserves its own reverse setting.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - fix implemented for imported-playlist missing-artwork copy leakage
- Focus:
  - stop surfacing unnecessary `Missing artwork` text in normal player surfaces after playlist import
- Files inspected so far:
  - `src/lib/backup.ts`
  - `src/lib/db.ts`
  - `src/components/MiniPlayerBar.tsx`
  - `src/components/FullscreenPlayer.tsx`
- Findings:
  - Imported playlist tracks can legitimately have no stored artwork while still rendering clean fallback/default artwork.
  - Mini player and fullscreen were surfacing `track.missingArt` as visible copy.
  - That warning text is noisy in normal playback because the app already has a visual fallback path.
- Narrow implementation plan:
  - keep `missingArt` state unchanged for diagnostics/admin
  - remove the visible `Missing artwork` copy from mini player and fullscreen only
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Removed `Missing artwork` copy from the mini player metadata area.
    - Removed `Missing artwork` copy from the fullscreen player metadata area.
    - Left `missingArt` state intact for non-player diagnostics/admin use.
  - Exact files changed:
    - `src/components/MiniPlayerBar.tsx`
    - `src/components/FullscreenPlayer.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is presentation-only and does not change artwork/media logic.
  - Regression risk:
    - Low.
    - The only intended change is removing noisy warning copy where fallback art already exists.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Import a playlist and confirm mini player no longer shows `Missing artwork`.
    - Open fullscreen on a track without stored art and confirm the warning copy is gone.
    - Confirm `Missing audio` messaging still appears when truly needed.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - fix implemented for imported-playlist theme switch lock seam
- Focus:
  - keep playlist theme recall without making active imported playlists feel theme-locked
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/db.ts`
- Findings:
  - Active-playlist theme recall was reading `themeSelection` from `runtimeLibrary`.
  - Manual theme change persisted the playlist theme to DB, but `runtimeLibrary` still held the old imported playlist theme briefly.
  - That stale in-memory value caused the active-playlist recall effect to immediately snap the UI back, making imported playlists feel theme-locked.
- Narrow implementation plan:
  - update the active playlist’s `themeSelection` in `runtimeLibrary` immediately when the user changes theme
  - keep the existing DB persistence and playlist recall model intact
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Added a narrow `runtimeLibrary` sync helper for active-playlist theme selection in `src/App.tsx`.
    - Main-app manual theme changes now update the active playlist’s in-memory `themeSelection` immediately before the DB write.
    - Admin iframe theme-change messages now also sync the active playlist’s in-memory `themeSelection` so the same snap-back does not happen there.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This keeps playlist theme recall but fixes the stale-state lock seam only.
  - Regression risk:
    - Low to moderate.
    - Main risk is making sure playlist recall still works on navigation while manual theme changes remain respected immediately.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Open an imported playlist and manually switch themes; confirm the new theme sticks immediately.
    - Switch away and back; confirm that playlist now recalls the new theme.
    - Confirm non-imported playlists still behave the same.
    - Confirm admin/settings theme changes do not snap back on the active playlist.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - fix implemented for playlist-import success countdown parity
- Focus:
  - make playlist-backup import reuse the same 2-second vault-import close countdown
- Files inspected so far:
  - `src/App.tsx`
- Findings:
  - Full vault import already starts the shared success-close countdown.
  - Playlist-backup import was setting success status only and leaving the Vault overlay open.
  - The existing countdown UI text was hardcoded to `Vault imported successfully`, so playlist import needed a tiny label seam correction to reuse it cleanly.
- Narrow implementation plan:
  - reuse the existing countdown mechanism for playlist import success
  - add a tiny success-title state so the countdown card can say the right thing for vault vs playlist import
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Playlist-backup import now starts the same 2-second close countdown as full vault import.
    - Added a tiny import-success title state so the shared countdown card now says either:
      - `Vault imported successfully`
      - `Playlist imported successfully`
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This reuses the existing countdown behavior and only adjusts the label seam.
  - Regression risk:
    - Low.
    - Main risk is only making sure vault import still shows the original title and that the countdown clears correctly.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm playlist import now shows the 2-second close countdown.
    - Confirm the countdown title reads `Playlist imported successfully`.
    - Confirm full vault import still shows the same countdown with `Vault imported successfully`.
    - Confirm `Close now` still works in both cases.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - diagnosis confirmed for playlist-backup export naming on the main Vault page
- Focus:
  - make playlist backup export use the same inline filename step as full vault backup
  - make playlist backup import accept the saved file type more reliably
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/saveBlob.ts`
  - `src/lib/backup.ts`
- Findings:
  - Playlist backup export on the Vault page was using the direct `promptForSaveFilename(...)` path.
  - On iPhone-like devices, `promptForSaveFilename(...)` returns the initial filename immediately, so the user does not get an inline naming step there.
  - Full vault backup already uses a deferred naming flow on iPhone via pending blob/name state.
  - Playlist backup import already accepts `.polyplaylist`, but broadening the accept list is a safe compatibility improvement for iOS file picking.
- Narrow implementation plan:
  - mirror the full-vault deferred naming flow for playlist backup on the Vault page
  - preserve the default filename as `playlistname-date-polyplaylist`
  - broaden playlist-backup file input/save accept compatibility without changing archive behavior
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Playlist backup export on the main Vault page now uses the same deferred inline save-name flow as full vault backup on iPhone-like devices.
    - Added a dedicated pending playlist-backup save card so the user can edit the default filename before saving.
    - Reused the existing normalized filename logic so the default remains `playlistname-date-polyplaylist.polyplaylist`.
    - Broadened playlist-backup save/import accept compatibility to include `application/octet-stream` alongside `.polyplaylist` / zip types for iOS file picking.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow Vault-page save/import UX correction only.
  - Regression risk:
    - Low.
    - Main risk is making sure deferred naming only changes the playlist-backup path and that desktop save behavior remains unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - On iPhone, confirm `Export Playlist Backup` now presents the inline filename box before save.
    - Confirm the default filename is `playlistname-date-polyplaylist.polyplaylist`.
    - Confirm the saved `.polyplaylist` file is selectable again through `Import Playlist Backup`.
    - Confirm desktop export/import behavior remains unchanged.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - diagnosis confirmed for playlist-backup controls surface move
- Focus:
  - move playlist backup import/export controls from admin/settings to the main Vault overlay
- Files inspected so far:
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
  - `src/lib/backup.ts`
- Findings:
  - Full backup controls already live on the main Vault overlay in `src/App.tsx`.
  - Playlist backup import/export handlers currently exist only in `src/admin/AdminApp.tsx`.
  - The playlist backup behavior is already implemented; this is a surface move, not a behavior change.
- Narrow implementation plan:
  - add playlist backup export/import handlers and input to the main Vault overlay
  - reuse existing `exportPolyplaylist()` / `importPolyplaylist()` behavior
  - remove playlist-backup buttons from the admin backup section to avoid duplicate homes
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Added playlist-backup export/import controls directly to the main Vault overlay in `src/App.tsx`.
    - Added main-app handlers for:
      - playlist backup export
      - playlist backup import
    - Reused the existing `exportPolyplaylist()` / `importPolyplaylist()` behavior and vault toast messaging style.
    - Removed the playlist-backup buttons and file input from `src/admin/AdminApp.tsx` so Vault is now the single home for that action.
  - Exact files changed:
    - `src/App.tsx`
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a surface move only; the playlist-backup behavior itself was reused unchanged.
  - Regression risk:
    - Low.
    - Main risk is just making sure the vault-page import/export buttons and file inputs behave cleanly.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Open Vault and confirm `Export Playlist Backup` and `Import Playlist Backup` are visible there.
    - Confirm those controls are no longer shown in admin/settings backups.
    - Confirm playlist backup export/import still works from the new location.
    - Confirm vault full-backup controls remain unchanged.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - diagnosis confirmed for playlist-owned theme recall and loop-carrying polyplaylist zip backup
- Focus:
  - make playlist navigation apply playlist-owned themes
  - make `.polyplaylist` zip import/export preserve playlist theme and loop state
  - keep import additive
- Files inspected so far:
  - `src/lib/storage/library.ts`
  - `src/lib/db.ts`
  - `src/lib/backup.ts`
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
- Findings:
  - The existing `.polyplaylist` zip export/import path is already additive and playlist-scoped.
  - `buildPolyplaylistConfig(...)` already captures per-track loop state, but the actual zip archive path does not currently carry or apply that loop config.
  - Playlist records do not currently store theme ownership metadata.
  - Theme changes are currently global/localStorage-driven rather than playlist-owned.
  - Polyplaylist export filenames already sanitize names, but the current format is `polyplaylist-name-date` rather than the requested `playlistname-date-polyplaylist`.
- Narrow implementation plan:
  - add optional `themeSelection` metadata to playlist records
  - persist active playlist theme when the user changes theme
  - apply playlist theme when the active playlist changes
  - extend the `.polyplaylist` archive manifest to carry playlist config/loop metadata
  - apply imported loops/theme to the newly created local playlist/tracks during zip import
  - switch the default polyplaylist filename format to `playlistname-date-polyplaylist` with filename-safe sanitization
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Added optional `themeSelection` metadata to playlist records in the library model.
    - New playlists now default to the current theme selection.
    - Main-app theme changes now persist the chosen theme onto the active playlist.
    - Active playlist changes now apply the playlist-owned theme in the main app.
    - The `.polyplaylist` archive manifest now carries embedded playlist config, including loop state and playlist theme selection.
    - Polyplaylist zip import now restores imported playlist theme metadata and writes imported loop state onto the newly created local track ids.
    - Backup UI labels were clarified to `Playlist Backup`.
    - Default polyplaylist filenames now use the requested order: `playlistname-date-polyplaylist.polyplaylist`, with filename-safe sanitization.
  - Exact files changed:
    - `src/lib/storage/library.ts`
    - `src/lib/db.ts`
    - `src/lib/backup.ts`
    - `src/lib/playlistState.ts`
    - `src/App.tsx`
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Moderate.
    - This reuses the existing playlist/archive system rather than introducing a parallel one, but it does touch playlist state, import/export, and theme switching together.
  - Regression risk:
    - Moderate.
    - Highest-risk areas are active-playlist theme switching, archive import fidelity, and playlist creation/activation consistency.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Create two playlists with different themes and confirm switching playlists changes theme automatically.
    - Change theme while a playlist is active and confirm that playlist recalls the new theme later.
    - Export a playlist backup and confirm filename format is `playlistname-date-polyplaylist.polyplaylist`.
    - Import a playlist backup into an existing library and confirm:
      - it adds a new playlist
      - it does not overwrite existing playlists
      - imported loops are present on the restored tracks
      - imported playlist theme is recalled when that playlist becomes active

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - diagnosis confirmed for oversized full vault backup crash on iPhone
- Focus:
  - add a release-safe pre-zip guardrail so large full backups fail safely instead of crashing WebView during zip assembly
- Files inspected so far:
  - `src/lib/backup.ts`
  - `src/admin/AdminApp.tsx`
  - `src/App.tsx`
  - `src/lib/platform.ts`
- Findings:
  - Full vault export can reach `[VAULT EXPORT READY] 21/21`, proving per-track media collection completes.
  - The WebView then crashes immediately afterward, before save/share completion.
  - That points to post-collection in-memory zip assembly in `buildZip(...)`, not a specific track fetch.
  - The current mobile full-backup cap is `512 MB`, which is appropriate for logical backup size but too high for safe in-memory zip assembly on constrained iPhone WebView.
- Narrow implementation plan:
  - keep export architecture unchanged
  - add a stricter full-vault pre-zip build cap on constrained mobile only
  - throw the existing `BackupSizeError` before `buildZip(...)`
  - update the user-facing copy to describe this as a safe export limit on the device
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Added a constrained-mobile full-vault backup build cap in `src/lib/backup.ts`.
    - Full vault backup now uses a stricter pre-zip safe cap of `192 MB` on constrained mobile devices before attempting `buildZip(...)`.
    - Reused the existing `BackupSizeError` path so oversized full backups fail safely before zip assembly instead of crashing WebView.
    - Updated the user-facing copy in both app/admin callers to say `safe export limit` instead of the more general `export limit`.
    - Removed the temporary per-track vault-export console instrumentation added during diagnosis.
  - Exact files changed:
    - `src/lib/backup.ts`
    - `src/admin/AdminApp.tsx`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow containment guardrail around the confirmed unsafe stage.
  - Regression risk:
    - Low to moderate.
    - Low because smaller full backups still follow the same path.
    - Moderate because some backups that previously attempted export on iPhone will now be blocked earlier.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm smaller full backups still export on iPhone.
    - Confirm oversized full backups now fail safely without WebView crash.
    - Confirm the safe-limit message is clear in both admin and main-app flows.
    - Confirm Export Config / smaller backup paths remain usable.

**Diagnosis note — 2026-04-10 Codex:**
- Status:
  - diagnosis confirmed for full vault export crash instrumentation
- Focus:
  - add temporary per-track export logging in the exact vault-media collection loop without changing export behavior
- Files inspected so far:
  - `src/lib/backup.ts`
  - `src/admin/AdminApp.tsx`
  - `src/App.tsx`
- Findings:
  - Full backup progress text such as `Collecting vault media… (46/48 tracks)` is emitted from `buildTrackMediaEntries(...)` in `src/lib/backup.ts`.
  - The same function also performs the actual per-track media iteration for export.
  - That makes `buildTrackMediaEntries(...)` the narrowest safe seam for temporary instrumentation.
- Narrow implementation plan:
  - add compact console logging at the top of each track iteration
  - include cheap fields already present on the track:
    - export index
    - title
    - id
    - audioKey
    - duration
  - add a second completion log after the existing media fetches so `blob.size` can be included when already available
  - do not change export flow, ordering, or error handling
- Follow-up diagnosis note — 2026-04-10 Codex:
  - Status:
    - first instrumentation narrowed the export failure to a specific per-track collection step on larger failing runs
  - New finding:
    - failing repros can stop after `[VAULT EXPORT] 20/21` without reaching `[VAULT EXPORT READY] 20/21`
    - that means the crash can still occur inside per-track media collection for the current track, before zip build
  - Narrow follow-up implementation plan:
    - extend the existing temporary logs to include `artKey` and `artVideoKey`
    - add one compact log before each collect call:
      - audio
      - artwork
      - artwork video
    - keep this diagnosis-only and do not alter export behavior
- Fix implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Added temporary per-track vault-export console logging inside `buildTrackMediaEntries(...)` in `src/lib/backup.ts`.
    - Each track now logs a start line before media collection begins:
      - `[VAULT EXPORT] 46/48`
      - with `{ title, id, audioKey, duration, size: null }`
    - Each track also logs a completion line after the existing media fetches:
      - `[VAULT EXPORT READY] 46/48`
      - with `{ title, id, audioKey, duration, size }`
      - where `size` is the fetched audio blob size when available
  - Exact files changed:
    - `src/lib/backup.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is temporary instrumentation only and does not change export behavior.
  - Regression risk:
    - Low.
    - The only change is added console logging inside the existing loop.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Re-run full vault export on iPhone.
    - Capture the last `[VAULT EXPORT]` or `[VAULT EXPORT READY]` line before the crash.
    - Use that track id/title to inspect the failing media item in the next pass.
- Follow-up instrumentation implemented — 2026-04-10 Codex:
  - Exact fix made:
    - Extended the existing temporary export logs to include `artKey` and `artVideoKey` on both `[VAULT EXPORT]` and `[VAULT EXPORT READY]`.
    - Added compact per-media collection logs before each existing fetch:
      - `[VAULT EXPORT AUDIO]`
      - `[VAULT EXPORT ARTWORK]`
      - `[VAULT EXPORT VIDEO]`
    - These logs include `{ title, id, key, duration }` so the next failing run can identify which media field on the current track dies before the ready log.
  - Exact files changed:
    - `src/lib/backup.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This remains diagnosis-only logging with no export behavior changes.
  - Regression risk:
    - Low.
    - The only added behavior is extra console output.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Run `npm run ios:update`.
    - Rebuild/run from Xcode.
    - Reproduce the failing full vault export.
    - Capture the last one of:
      - `[VAULT EXPORT AUDIO]`
      - `[VAULT EXPORT ARTWORK]`
      - `[VAULT EXPORT VIDEO]`
      - `[VAULT EXPORT READY]`
    - That last line should identify the exact failing media step.

**Diagnosis note — 2026-04-09 Codex:**
- Status:
  - diagnosis confirmed for import page storage indicator
- Focus:
  - add a minimal storage-status bar to the top of the import form using existing storage summary logic
- Files inspected so far:
  - `src/admin/AdminApp.tsx`
  - `src/lib/db.ts`
  - `src/index.css`
- Findings:
  - `AdminApp` already maintains `storageUsage` via `getStorageUsageSummary()` in `refreshStorage()`.
  - `refreshStorage()` already runs on initial admin load and again after import/storage-changing actions, so the import page can reuse those values directly and stay current without new architecture work.
  - The import form already has a clean placement seam just below the intro copy and above the primary import controls.
  - The existing manage-storage section already renders:
    - used bytes
    - cap bytes
    - percent used
  - Remaining bytes can be derived locally from the same summary.
- Narrow implementation plan:
  - keep this UI-only inside `AdminApp`
  - add a compact top-of-import storage status bar that shows:
    - used / limit
    - remaining
    - a subtle progress bar
  - do not change import flow or storage logic
- Fix implemented — 2026-04-09 Codex:
  - Exact fix made:
    - Added a compact storage status bar near the top of the import form in `src/admin/AdminApp.tsx`.
    - The new UI reuses the existing `storageUsage` summary and shows:
      - used / limit
      - remaining
      - a subtle progress bar
    - The bar updates through the existing `refreshStorage()` path, so no new import or storage architecture was added.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a localized import-page presentation change only.
  - Regression risk:
    - Low.
    - It reuses existing storage values and does not alter import behavior or storage calculations.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the storage bar appears cleanly at the top of Import.
    - Confirm used / limit and remaining values look correct.
    - Confirm the values update after a successful import.
    - Confirm the import flow and layout remain clean on small screens.

**Diagnosis note — 2026-04-09 Codex:**
- Status:
  - diagnosis confirmed for repeat-button flash/sparkle parity
- Focus:
  - make repeat-toggle visual confirmation match shuffle-toggle visual confirmation on every repeat state change
- Files inspected so far:
  - `src/components/PlayerControls.tsx`
- Findings:
  - Shuffle already uses the shared `emitPinkSparkle(...)` path inside `onShuffleClick(...)`.
  - Repeat is toggled in `onRepeatClick(...)`.
  - The repeat handler currently only emits sparkle/flash when the next landed mode is `repeat-3`.
  - That means repeat does not provide the same visual confirmation on:
    - `off -> repeat`
    - `repeat -> repeat-1`
    - `repeat-1 -> repeat-2`
    - `repeat-3 -> off`
- Narrow implementation plan:
  - keep playback logic unchanged
  - reuse the existing `emitPinkSparkle(...)` path in `onRepeatClick(...)`
  - trigger the same sparkle/flash confirmation for every repeat state change while preserving reduced-motion behavior and the existing special `repeat-3` activation styling
- Fix implemented — 2026-04-09 Codex:
  - Exact fix made:
    - Updated `onRepeatClick(...)` in `src/components/PlayerControls.tsx` so every repeat state change now triggers the same sparkle/flash confirmation path.
    - Preserved reduced-motion behavior.
    - Preserved the existing special `repeat-3` activation styling without widening into playback logic changes.
  - Exact files changed:
    - `src/components/PlayerControls.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a presentation-only change inside the existing repeat-toggle handler.
  - Regression risk:
    - Low.
    - The change reuses the existing sparkle/flash path and does not alter repeat mode behavior.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm repeat on, repeat one, repeat two/three, and back to default all trigger the same visual confirmation.
    - Confirm shuffle visual feedback is unchanged.
    - Confirm rapid repeat cycling does not feel noisy.

**Diagnosis note — 2026-04-09 Codex:**
- Status:
  - diagnosis confirmed for Safari desktop factory reset placeholder / broken splash + demo art
- Focus:
  - prevent broken bundled-asset placeholders from surfacing during cold-start reset recovery in Safari desktop
- Files inspected so far:
  - `src/components/SplashOverlay.tsx`
  - `src/components/TrackTile.tsx`
  - `src/lib/demoSeed.ts`
  - `src/index.css`
- Findings:
  - The splash video is hidden until ready, so the visible broken/question-mark state is most likely the fallback image path rather than the video surface itself.
  - `SplashOverlay` currently renders the fallback `<img src={logoImage}>` immediately, which lets Safari surface a broken image placeholder if the bundled image is not decoded/resolved yet.
  - Demo tiles also render bundled art URLs directly into `<img src=...>` in `TrackTile`, which allows the same first-render broken/missing surface if Safari is late to resolve/reset those bundled assets.
  - The underlying reset/demo seed model does not look corrupted; this is a visual readiness/fallback problem.
- Narrow implementation plan:
  - preload the splash fallback image before rendering it, and otherwise show a text-only/branded fallback shell
  - add a narrow demo-art preload/retry containment in `TrackTile` so bundled demo art does not surface as a broken image during the first post-reset render
  - keep reset flow and demo seed model unchanged
- Fix implemented — 2026-04-09 Codex:
  - Exact fix made:
    - Updated `SplashOverlay` so the fallback logo image is preloaded before it is ever rendered. Until it is actually ready, the splash shows the branded fallback shell without exposing a broken image placeholder.
    - Updated `TrackTile` so demo tracks no longer render bundled art URLs directly on first paint. Demo tile art now preloads first and retries once with a cache-busted URL before falling back.
  - Exact files changed:
    - `src/components/SplashOverlay.tsx`
    - `src/components/TrackTile.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a localized visual readiness/fallback containment only.
  - Regression risk:
    - Low.
    - Splash behavior is unchanged once video or logo is actually ready.
    - Demo-art containment is limited to demo tiles and does not alter reset flow or demo seed data.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Factory reset in Safari desktop and confirm splash never shows a broken placeholder.
    - Confirm splash fallback appears cleanly if video is delayed.
    - Confirm demo tile art appears correctly after reset.
    - Confirm demo art remains correct after first interaction/reopen.
    - Confirm non-reset startup path is unchanged.
    - Confirm iOS/PWA behavior is unchanged.

**Diagnosis note — 2026-04-09 Codex:**
- Status:
  - diagnosis confirmed for artwork / fullscreen media not following active playback across playlist navigation
- Focus:
  - determine why off-playlist active playback keeps controls but loses artwork/video media
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/db.ts`
  - `src/components/FullscreenPlayer.tsx`
  - `src/components/MiniPlayerBar.tsx`
- Findings:
  - `currentTrack` in `src/App.tsx` falls back to `allTracksCatalog` when the actively playing track is not in the currently viewed playlist.
  - `allTracksCatalog` is built from `getAllTracksFromDb({ includeMediaUrls: false, includeBlobs: false })`, so off-playlist fallback tracks usually do not carry `artUrl` or `artVideoUrl`.
  - The current-track hydration effect only calls `getTrackPlaybackMediaFromDb(currentTrackId)`, and that API currently returns:
    - `audioUrl`
    - `artBlob`
    - `missingAudio`
    - but not `artUrl` or `artVideoUrl`
  - The `currentTrack` merge in `src/App.tsx` only overlays:
    - `audioUrl`
    - `artBlob`
    - `missingAudio`
    - but not `artUrl` or `artVideoUrl`
  - `MiniPlayerBar`, `FullscreenPlayer`, the blurred backdrop, and now-playing artwork all read `track.artUrl` / `track.artVideoUrl` for visuals.
  - Result:
    - controls follow active playback context correctly
    - but visual media remains blank/stale when the active track is off-playlist because the current-track media hydration path never supplies the missing art/video URLs
- Narrow implementation plan:
  - keep playback and playlist model unchanged
  - expand the current-track hydration path to supply visual media fields needed by `currentTrack` when it is off-playlist
  - merge hydrated `artUrl` / `artVideoUrl` into `currentTrack` the same way `audioUrl` is already merged
- Fix implemented — 2026-04-09 Codex:
  - Exact fix made:
    - Extended `getTrackPlaybackMediaFromDb(...)` in `src/lib/db.ts` to return `artUrl` and `artVideoUrl` in addition to `audioUrl`, `artBlob`, and `missingAudio`.
    - Extended `hydratedCurrentTrackMedia` in `src/App.tsx` to store `artUrl` and `artVideoUrl`.
    - Extended the `currentTrack` merge in `src/App.tsx` so off-playlist active playback now overlays hydrated `artUrl` / `artVideoUrl` the same way it already overlays `audioUrl`.
  - Exact files changed:
    - `src/lib/db.ts`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow extension of current-track hydration only and does not broaden library-wide media loading.
  - Regression risk:
    - Low to moderate.
    - Low because the fix is confined to the active current-track media path.
    - Moderate because mini player, fullscreen, backdrop, and now-playing artwork all consume the corrected current-track media.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Start playback from playlist A, switch to playlist B, and confirm mini-player art follows the active track.
    - Open fullscreen in that off-playlist state and confirm still-image/video media follows the active track.
    - Use `Next` while staying on the other playlist and confirm artwork updates each time.
    - Confirm backdrop updates correctly with off-playlist playback.
    - Confirm on-playlist playback visuals remain unchanged.
    - Confirm no regression in now-playing / lock-screen artwork.

**Diagnosis note — 2026-04-09 Codex:**
- Status:
  - diagnosis confirmed for playlist navigation / playback context mismatch
- Focus:
  - determine why next/prev behavior and controls depend on the viewed playlist instead of active playback context
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/playlistState.ts`
  - `src/lib/iosNowPlaying.ts`
  - `docs/polyplay_control_center.md`
- Findings:
  - The app keeps `tracks` as the currently visible playlist track list, derived strictly from `library.activePlaylistId` through `getVisibleTracksFromLibrary(...)` in `src/lib/playlistState.ts`.
  - `playNext()` and `playPrev()` in `src/App.tsx` both operate on that `tracks` array.
  - Hardware/media next/previous uses the exact same path:
    - Media Session handlers call `playNext()` / `playPrev()`
    - iOS remote command listener also calls `playNext()` / `playPrev()`
  - `currentTrack` is more global than `tracks`:
    - it resolves first from `tracks`
    - then falls back to `allTracksCatalog`
    - so a track can keep playing even when the user navigates to a different playlist
  - This creates a context mismatch:
    - playback context = `currentTrackId/currentTrack`
    - navigation context = `activePlaylistId -> tracks`
  - When the viewed playlist does not contain the current track, `playNext()` / `playPrev()` try to navigate within the wrong list.
  - When the viewed playlist is blank, `hasTracks` becomes false, which suppresses the mini player even if `currentTrack` still exists elsewhere.
- Narrow implementation plan:
  - keep playlist architecture intact
  - derive next/prev navigation from the playback-owning playlist context rather than the currently viewed playlist
  - stop gating control visibility solely on `hasTracks` when there is an active `currentTrack`
  - keep hardware/media next/prev on the same corrected path as in-app controls
- Fix implemented — 2026-04-09 Codex:
  - Exact fix made:
    - Added a narrow `playbackPlaylistId` context in `src/App.tsx`.
    - That playback-owned playlist id is set when a track is started from the current view, and is re-derived on restore/fallback if the current track belongs to another playlist.
    - `playNext()` and `playPrev()` now navigate from `playbackNavigationTracks`, which are derived from the playback-owned playlist instead of the currently viewed `tracks`.
    - Autoplay-to-next on `ended` now uses the same playback-owned navigation list.
    - Mini-player visibility now follows `currentTrack` instead of `hasTracks`, so an empty viewed playlist does not hide controls while playback is active elsewhere.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_control_center.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This preserves the current playlist model and corrects only the playback/navigation context seam.
  - Regression risk:
    - Low to moderate.
    - Low for the mini-player visibility change.
    - Moderate because next/prev, autoplay, and hardware/media controls all depend on the corrected playback-owned navigation source.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Start playback from playlist A, switch to playlist B, and confirm hardware/media `nextTrack` advances correctly.
    - Repeat with in-app `Next` and `Previous`.
    - Confirm returning to playlist A is no longer required.
    - Open a blank playlist while another track is active and confirm controls remain visible.
    - Confirm autoplay-to-next still works when the viewed playlist differs from the playback-owning playlist.
    - Confirm non-playing blank playlists still render normally.

**Diagnosis note — 2026-04-09 Codex:**
- Status:
  - diagnosis confirmed for shuffle not functioning on iOS
- Focus:
  - determine why enabling Shuffle has no effect on next-track selection
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/aura.ts`
  - `src/lib/db.ts`
  - `docs/polyplay_control_center.md`
- Findings:
  - Shuffle state is a boolean stored under `polyplay_shuffleEnabled` and loaded normally in `src/App.tsx`.
  - Manual `Next` and autoplay-to-next both branch on `isShuffleEnabled` in `src/App.tsx`, so they are intended to use the same shuffle path.
  - The shuffle path does not use a persisted shuffled queue. It calls `pickAuraWeightedTrack(...)` from `src/lib/aura.ts`.
  - `pickAuraWeightedTrack(...)` filters candidates with `Boolean(track.audioUrl) && !track.missingAudio`.
  - After the release-safety lazy hydration changes, normal playlist/runtime track state intentionally does not carry hydrated `audioUrl` for the full visible playlist:
    - broad refresh uses `getAllTracksFromDb({ includeMediaUrls: false, includeBlobs: false })`
    - visible tracks use `getTracksByIdsFromDb(..., { includeMediaUrls: true, includeAudioUrl: false, ... })`
  - That means valid imported tracks usually have `hasAudioSource === true` but `audioUrl === undefined` until they become the current track.
  - Result:
    - the shuffle candidate pool is often empty or invalid for normal imported tracks
    - autoplay `onEnded` falls back to linear `getAdjacentTrackId(...)` when the shuffle picker returns `null`
    - manual `playNext()` can also fail to honor shuffle because it relies on the same picker
- Narrow implementation plan:
  - keep shuffle behavior narrow
  - change the shuffle picker/readiness check to use persisted audio availability semantics (`hasAudioSource` / true missing-audio state), not hydrated `audioUrl`
  - keep autoplay and manual `Next` on the same path
  - do not change previous-track behavior or introduce a new queue system
- Fix implemented — 2026-04-09 Codex:
  - Exact fix made:
    - Updated `pickAuraWeightedTrack(...)` in `src/lib/aura.ts` so shuffle candidate eligibility no longer depends on pre-hydrated `audioUrl`.
    - The picker now treats a track as playable when it has persisted playback backing (`hasAudioSource`) and is not truly marked `missingAudio`.
    - The existing aura-weighted selection model was preserved.
  - Exact files changed:
    - `src/lib/aura.ts`
    - `docs/polyplay_control_center.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is the narrow readiness correction identified in diagnosis and does not redesign shuffle.
  - Regression risk:
    - Low to moderate.
    - Low because non-shuffle paths and `Previous` are unchanged.
    - Moderate because both manual `Next` and autoplay depend on this picker.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm Shuffle on iPhone changes `Next` order on a fresh playlist.
    - Confirm autoplay-to-next also follows shuffle.
    - Confirm `Previous` still behaves normally.
    - Confirm imported tracks without pre-hydrated `audioUrl` now participate in shuffle.
    - Confirm non-shuffle playback order remains unchanged.

**Note — 2026-04-07 Codex:**
- Added a final pre-submission checklist document for the current stabilization build:
  - `docs/polyplay_ios_app_store_submission_checklist_2026-04-07.md`
- This is a packaging/QA aid only.
- No code changed in this pass.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow Rasta import-overlay blur follow-up
- Focus:
  - keep the Rasta leaf visible in normal iOS theme usage, but make it more abstract specifically behind the Import overlay on iOS
- Files inspected so far:
  - `styles.css`
  - `src/App.tsx`
- Findings:
  - The Rasta leaf blur is still applied on iOS, but the Import/settings overlay makes the underlying leaf read more sharply again.
  - The cleanest containment seam is a body class tied only to the upload/settings overlay open state.
- Narrow implementation plan:
  - add a body class in `src/App.tsx` when the upload overlay is open
  - add an iOS-only Rasta CSS override for that state in `styles.css`
  - keep desktop and normal non-overlay Rasta unchanged
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Added an `is-import-overlay-open` body class in `src/App.tsx` when the settings overlay is open in upload/import mode.
    - Added an iOS-only Rasta override in `styles.css` that applies a stronger blur and slightly lower opacity to the leaf only while that import overlay is open.
  - Exact files changed:
    - `src/App.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow iOS-only visual containment for the Rasta Import overlay state.
  - Regression risk:
    - Low.
    - Desktop is unchanged, and normal non-overlay Rasta stays on the existing iOS blur path.
  - QA completed:
    - `npm run typecheck`
- QA still needed:
  - Confirm the Rasta leaf stays visible but more abstract behind Import on iPhone.
  - Confirm normal Rasta screens on iPhone remain visually acceptable.
  - Confirm desktop Rasta is unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis refined after device rebuild
- Focus:
  - fix the Rasta leaf specifically inside the iOS import iframe
- Files inspected so far:
  - `src/index.css`
  - `styles.css`
  - `src/admin/AdminApp.tsx`
- Findings:
  - The recognizable leaf in the screenshot is inside the admin/import iframe, not just behind the parent overlay.
  - The iframe body gets theme classes, but it was not getting its own iOS-specific Rasta leaf treatment.
- Narrow implementation plan:
  - add `is-ios` to the iframe body in `src/admin/AdminApp.tsx`
  - add an iframe-body-specific Rasta leaf blur override in `styles.css`
  - keep desktop and main-app Rasta behavior unchanged
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Added `is-ios` to the admin/import iframe body in `src/admin/AdminApp.tsx`.
    - Added `body.admin-frame-body.is-ios.theme-custom.theme-custom-rasta::after` in `styles.css` with a stronger blur and lower opacity for the iframe leaf layer.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow iframe-only iOS visual correction.
  - Regression risk:
    - Low.
    - Desktop is unchanged, and the main app’s non-iframe Rasta treatment is unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the leaf is no longer clearly recognizable inside Import on iPhone.
    - Confirm the iframe still feels like Rasta, not blank or washed out.
    - Confirm desktop Import remains unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow theme FX color correction
- Focus:
  - make ambient FX colors match the selected theme in light, amber, and crimson modes
- Files inspected so far:
  - `styles.css`
  - `src/fx/ambientFxEngine.ts`
- Findings:
  - The ambient FX engine reads `--fx-color-1-rgb`, `--fx-color-2-rgb`, `--fx-color-3-rgb`, `--aura-rgb`, and `--color-accent` from CSS.
  - `merica`, `mx`, and `rasta` already define explicit FX palette variables.
  - `light`, `amber`, and `crimson` define accent/aura tokens, but do not define `--fx-color-*`, so the FX engine falls back to the root purple palette.
- Narrow implementation plan:
  - add explicit `--fx-color-1-rgb`, `--fx-color-2-rgb`, and `--fx-color-3-rgb` only for `light`, `custom/amber`, and `custom/crimson`
  - keep the change in `styles.css`
  - do not alter FX engine behavior or broader theme styling
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Added explicit `--fx-color-1-rgb`, `--fx-color-2-rgb`, and `--fx-color-3-rgb` values for `light`, `custom/amber`, and `custom/crimson` in `styles.css`.
    - Light mode now resolves to a pink/rose FX palette instead of inheriting the root purple palette.
    - Amber now resolves to warm candle/amber/gold FX colors.
    - Crimson now resolves to a crimson/red FX palette instead of purple.
  - Exact files changed:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow theme-token correction only.
  - Regression risk:
    - Low.
    - The ambient FX engine behavior is unchanged; only the three affected theme palettes now provide explicit values instead of falling back to root purple tokens.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm light mode FX now reads pink rather than purple.
    - Confirm amber FX now reads warm amber/gold rather than purple-orange.
    - Confirm crimson FX now reads crimson/red rather than purple.
    - Confirm merica, mx, and rasta FX colors are unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow import-panel loading containment
- Focus:
  - prevent the Import/settings iframe mount from revealing odd transitional background layers
- Files inspected so far:
  - `src/App.tsx`
  - `src/index.css`
  - `src/admin/AdminApp.tsx`
- Findings:
  - The upload/import surface is mounted as an `iframe` inside the settings overlay.
  - The app currently shows the iframe container immediately, but has no app-side loading veil while `/admin.html?mode=upload` is painting.
  - That leaves a brief window where the user can see awkward transitional background content before the frame is visually ready.
- Narrow implementation plan:
  - add a settings-frame loading state in `src/App.tsx`
  - set that state when opening the settings/upload panel and clear it on iframe `load`
  - add a theme-matched loading veil over the iframe area with a centered shimmer message
  - keep the change scoped to the settings/import overlay only
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Added a settings-frame loading state in `src/App.tsx`.
    - Opening the settings/upload panel now arms that loading state before the iframe is shown.
    - The iframe clears the loading state on `load`.
    - Wrapped the iframe in a local shell and added a centered loading veil over the frame area.
    - The veil uses the active theme styling and shows a shimmer message:
      - `Loading import panel…` for upload mode
      - `Loading settings panel…` for manage mode
  - Exact files changed:
    - `src/App.tsx`
    - `src/index.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow app-side overlay containment for the iframe mount path.
  - Regression risk:
    - Low.
    - It only changes the presentation while the settings iframe is loading.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm Import no longer reveals odd background layers while loading.
    - Confirm the loading veil matches the active theme and clears once the panel is ready.
    - Confirm Manage/Settings mode still opens normally.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for waveform switch-mask follow-up
- Focus:
  - make the flash visible inside the waveform viewport
  - make sure the mask retriggers on every track change, including wraparound next/prev
- Files inspected so far:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
- Findings:
  - The current mask mainly affects the outer waveform shell, which is too subtle on device because the viewport contents are what the user is watching.
  - The current `is-track-switching` flag is state-driven, so a fast or overlapping track change can fail to retrigger the CSS animation cleanly if the class never fully leaves/re-enters between switches.
- Narrow implementation plan:
  - move the visual emphasis into `.pc-wave__viewport`
  - trigger the switch-mask class imperatively on each track-id change, with remove/reflow/add semantics
  - keep the previous-waveform hold and real peak-resolution path unchanged
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `src/components/WaveformLoop.tsx` so the track-switch mask class is retriggered imperatively on every track-id change instead of relying on state transitions alone.
    - Updated `src/components/player.css` so the visible flash now happens inside `.pc-wave__viewport`, not just on the outer waveform shell.
    - Strengthened the viewport-level brightness/saturation lift during track switching so the effect reads on iOS and desktop Safari.
    - Kept the earlier previous-waveform hold behavior unchanged.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `src/components/player.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low.
    - This remains a narrow transition-layer polish and does not change playback or peak generation logic.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the flash is now visible inside the waveform viewport on iOS.
    - Confirm the flash is now visible on desktop Safari.
    - Confirm wraparound `Next` from last track to first track now retriggers the effect.
- Status:
  - diagnosis confirmed for waveform switch dead-time follow-up
- Focus:
  - prevent the waveform from going flat during track handoff
  - make the track-switch mask actually visible in the iOS build
- Files inspected so far:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
- Findings:
  - The earlier track-switch pulse could fire, but the unresolved waveform path still dropped the canvas into a loading/transparent state.
  - That means users can still see a flat viewport before the next track’s real peaks arrive.
  - On iOS, the existing aura-pulse treatment on the container is too subtle to convincingly mask that dead time.
- Narrow implementation plan:
  - keep the previous waveform visible during track handoff until new peaks resolve
  - add a short dedicated track-switch mask class to the waveform container
  - keep the existing long-track containment and real peak-resolution logic intact
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `src/components/WaveformLoop.tsx` so track switching no longer immediately drops the waveform into a flat transparent loading state.
    - The previous rendered waveform now stays visible during the handoff until the next track’s peaks resolve or the short mask window expires.
    - Added an `is-track-switching` class to the waveform container and a short dedicated mask animation in `src/components/player.css`.
    - Kept the existing long-track containment and on-demand short-track real-peak logic unchanged.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `src/components/player.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to moderate.
    - Low for the visual mask itself.
    - Low to moderate because the previous waveform now persists briefly during handoff before the next waveform resolves, but that is intentional and tightly time-bounded.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm iOS no longer shows a flat waveform viewport during track changes.
    - Confirm the switch now reads as a brief masked handoff into the next waveform.
    - Confirm rapid next/prev does not feel smeary or overly flashy.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow waveform transition pulse follow-up
- Focus:
  - make sure waveform track-switch pulse actually fires across player surfaces
- Files inspected so far:
  - `src/components/WaveformLoop.tsx`
  - `src/components/MiniPlayerBar.tsx`
  - `src/components/FullscreenPlayer.tsx`
- Findings:
  - The earlier track-switch pulse effect in `WaveformLoop` is currently gated by `enableAuraPulse`.
  - Fullscreen intentionally passes `enableAuraPulse={false}`, so the track-switch pulse is also suppressed there.
  - The earlier effect also depended on carrying a non-null previous track id, which can be skipped if the selected track briefly transitions through `null`.
- Narrow implementation plan:
  - keep the aura-event pulse toggle behavior unchanged
  - make track-switch pulse independent of `enableAuraPulse`
  - use an explicit mounted/previous-id guard so the pulse survives transient `null` handoffs without flashing on first mount
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `src/components/WaveformLoop.tsx` so track-switch pulse no longer depends on `enableAuraPulse`.
    - Kept the aura-event listener gated by `enableAuraPulse`, but made the local track-id transition pulse always available for waveform surfaces.
    - Replaced the earlier fragile previous-id logic with an explicit mount guard plus previous-track tracking, so transient `null` handoffs no longer suppress the next switch pulse.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low.
    - This only changes when the existing waveform pulse class is triggered on track changes.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm waveform track-switch pulse now appears in mini player.
    - Confirm waveform track-switch pulse now appears in fullscreen where appropriate.
    - Confirm first mount still stays calm and does not flash unnecessarily.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow waveform transition masking
- Focus:
  - soften the visible waveform dead time on track switch without changing waveform architecture
- Files inspected so far:
  - `src/components/WaveformLoop.tsx`
  - `src/components/player.css`
- Findings:
  - `WaveformLoop` already supports a local `is-aura-pulse` visual treatment through the existing waveform container class.
  - That pulse is currently only triggered by the aura event path, not by track changes.
  - The cleanest seam is to reuse the existing waveform pulse locally on track-id change, rather than adding a new loader or broader animation system.
- Narrow implementation plan:
  - keep the real waveform-resolution path unchanged
  - reuse the existing waveform aura-pulse class on track switch
  - skip the initial mount so it only reads as a transition between tracks
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `src/components/WaveformLoop.tsx` so the existing waveform `is-aura-pulse` effect now also triggers on track-id changes.
    - The pulse is local to the waveform component and reuses the existing class-based animation path.
    - The initial mount is skipped so the effect reads as a track-switch transition only, not a first-load flash.
    - The underlying waveform-resolution logic was left unchanged in this pass.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow perception-layer polish on top of the existing waveform component.
  - Regression risk:
    - Low.
    - The change only adds a brief waveform pulse on track change and does not alter playback, loop state, or peak generation logic.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm waveform dead time during track switching now reads more intentional instead of flat/blank.
    - Confirm the pulse does not feel noisy during rapid next/prev changes.
    - Confirm the initial app load does not flash unnecessarily.
    - Confirm mini player behavior improves without affecting fullscreen loop editing.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow waveform visibility correction
- Focus:
  - prevent inactive waveform bars from blending into the loop viewport background
  - stop short tracks from presenting the fallback/lazy waveform as if it were resolved waveform data
- Files inspected so far:
  - `src/components/WaveformLoop.tsx`
  - `src/components/FullscreenPlayer.tsx`
  - `src/lib/waveformTheme.ts`
  - `src/lib/db.ts`
  - `src/components/player.css`
- Findings:
  - `WaveformLoop` currently treats `!track.audioBlob` as effectively resolved and falls back to `fallbackPeaks()`, which means normal imported tracks without eager blob hydration can show the synthetic placeholder waveform indefinitely.
  - Runtime `Track` rows currently only carry real `waveformPeaks` for demos; normal imported tracks do not persist decoded peak arrays in DB state.
  - Because lazy hydration removed eager `audioBlob` loading, short imported tracks can enter the loop viewport with no real peaks and settle on the placeholder shape.
  - The inactive waveform bars are rendered with a single idle fill color, and on some theme/background combinations that color can collapse visually into the viewport background.
- Narrow implementation plan:
  - keep long-track lazy-hydration containment intact
  - add a short-track-only on-demand peak fetch in `WaveformLoop` when no cached/stored peaks exist
  - cache/store those generated peaks once resolved so the synthetic fallback does not persist for short tracks
  - add a contrast-floor underlay for inactive waveform bars so they stay visible against the viewport background
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `src/components/WaveformLoop.tsx` so the loop viewport no longer treats `!track.audioBlob` as an immediately resolved waveform state.
    - If no real peaks are cached/stored and the selected track is short enough, `WaveformLoop` now loads the audio blob on demand from DB and generates real peaks locally.
    - That short-track on-demand path is capped at 12 minutes, preserving the existing long-track lazy-hydration containment.
    - Once generated, peaks are cached and stored so the synthetic fallback waveform does not keep presenting as the resolved waveform for short tracks.
    - Updated inactive waveform rendering to draw a subtle contrast underlay behind non-loop bars, so the unplayed portion no longer disappears into the viewport background.
    - Added the corresponding palette field in `src/lib/waveformTheme.ts` to provide that contrast floor.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `src/lib/waveformTheme.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This stays inside the current-track waveform path and preserves the long-track containment strategy.
  - Regression risk:
    - Low to moderate.
    - Low for the inactive-bar contrast floor.
    - Low to moderate for the short-track peak fetch because it adds an on-demand DB/audio decode path for waveform resolution, but only for short tracks without existing peaks.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the inactive/unplayed waveform remains visible against the viewport in Merica and other themes.
    - Confirm short imported tracks no longer settle on the synthetic fallback waveform once selected.
    - Confirm longer tracks still respect the lazy-hydration containment and do not trigger eager heavy waveform work.
    - Confirm loop editing, playhead progress, and loop markers still render correctly in mini and fullscreen players.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow Merica firework sequencing correction
- Focus:
  - make the Merica multi-burst accent fire in sequence instead of simultaneously
  - keep the first burst at the tap point
  - make the second and third bursts spawn independently at random positions
- Files inspected so far:
  - `src/fx/ambientFxEngine.ts`
- Findings:
  - The Merica accent path currently fires by calling `spawnMericaFireworks(...)` three times in the same tap handler branch.
  - That means all three fireworks detonate immediately in the same frame.
  - The current follow-up positions are fixed offsets from the tap point, not independently randomized spawn points.
  - The FX engine does not yet have a tiny scheduler for delayed Merica follow-up bursts, so the cleanest seam is a small timeout queue inside the engine itself.
- Narrow implementation plan:
  - keep ordinary non-accent Merica taps unchanged
  - keep the first accent burst at the user tap point immediately
  - schedule bursts two and three with short staggered delays
  - randomize the second and third burst positions within the canvas bounds
  - clear any pending Merica follow-up timers on engine stop/destroy
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated the Merica accent branch in `src/fx/ambientFxEngine.ts` so the first firework still spawns immediately at the tap point.
    - Added a tiny engine-owned timeout queue for accent follow-up bursts.
    - The second and third accent fireworks now fire in sequence at `0.3s` and `0.6s` after the first burst.
    - The second and third bursts now choose independent random positions within the canvas instead of using fixed offsets from the tap point.
    - Pending Merica follow-up timers now clear on engine stop, destroy, and theme change.
  - Exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow FX-engine behavior correction isolated to the Merica accent path.
  - Regression risk:
    - Low.
    - Ordinary non-accent Merica taps are unchanged.
    - The change is scoped to the every-6th-tap accent branch and timer cleanup.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the first Merica firework still goes off immediately at the tap point.
    - Confirm the second and third fireworks fire at roughly `0.3s` intervals instead of all at once.
    - Confirm the second and third bursts appear in independent random spots rather than stacked near the tap.
    - Confirm reduced-motion behavior still feels controlled.
    - Confirm switching away from Merica mid-sequence does not leave delayed follow-up bursts firing afterward.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow tile/Rasta visual cleanup
- Focus:
  - remove the visible dark rounded backing seam behind track tiles
  - restore the Rasta leaf on iOS so it remains visible but abstractly blurred
- Files inspected so far:
  - `styles.css`
  - `src/components/TrackTile.tsx`
- Findings:
  - The tile image is rendered inside `.ytm-cover`, but the clickable wrapper `.ytm-tile-hit` still has its own solid dark background in `styles.css`.
  - With the current rounded corners/shadow stack, that dark base can read as a separate black rounded plate behind the tile art.
  - The Rasta leaf is still present in `body.theme-custom.theme-custom-rasta::after`, but the iOS-only override currently applies a strong `blur(18px)` to a low-opacity layer, which can blur it into near-invisibility on iOS.
- Narrow implementation plan:
  - keep the tile layout, art badges, and general tile shadow system intact
  - remove the visible dark backing seam by making the tile hit surface transparent and letting `.ytm-cover` remain the visual backing
  - keep the iOS-only Rasta override but rebalance blur/opacity so the leaf remains visible and abstract instead of disappearing
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `.ytm-tile-hit` in `styles.css` so the tile hit surface no longer paints its own solid dark backing.
    - Left `.ytm-cover` as the actual visual tile backing, which removes the separate black rounded plate look behind the art.
    - Updated the iOS-only Rasta override in `styles.css` so the leaf now uses a softer blur and higher opacity, staying abstract without disappearing.
  - Exact files changed:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow CSS-only visual cleanup.
  - Regression risk:
    - Low.
    - The tile fix only changes the hit-surface background fill.
    - The Rasta change only affects the iOS-only leaf override for that theme.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the dark rounded backplate is no longer visible behind tiles.
    - Confirm tile depth/shadow still looks intentional after the backing seam is removed.
    - Confirm the Rasta leaf is visible again on iOS while remaining blurred and abstract.
    - Confirm non-iOS Rasta appearance is unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis only
- Focus:
  - identify why long-form loop crop crashes or refreshes the app
  - identify why the default loop markers feel too close together on hour-plus tracks
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/audio/cropAudio.ts`
  - `src/components/WaveformLoop.tsx`
  - `src/lib/artwork/waveformArtwork.ts`
- Findings:
  - `setLoopFromCurrent()` in `src/App.tsx` initializes the default region span from a ratio, but then clamps it to `DEFAULT_SET_LOOP_SPAN_MAX_SECONDS = 12`.
  - On a 60+ minute track, that cap dominates, so the default start/end markers land only about 12 seconds apart. This is why they feel visually cramped on long-form audio.
  - The crop/export path is the heavier seam. `cropCurrentLoopToWav()` loads the track blob from storage and calls `cropAudioBlobToWav(...)`.
  - `cropAudioBlobToWav(...)` currently reads the entire source blob into an `ArrayBuffer`, decodes the entire file with `decodeAudioData(...)`, allocates a new `AudioBuffer` for the crop, then encodes a new WAV in memory.
  - For a 60+ minute source, this creates multiple large in-memory representations of the same asset at once: compressed blob bytes, decoded PCM, cropped PCM, and encoded WAV output.
  - Region loop playback itself does not appear to be the crash seam. The playback path loops by seeking `audio.currentTime` within the existing media element, not by decoding or slicing the full source for preview.
  - `WaveformLoop` and `buildPeaksFromAudioBlob(...)` can also fully decode a blob, but that path only runs when `track.audioBlob` is present. After the recent lazy-hydration containment, the selected/current track no longer eagerly hydrates `audioBlob`, so waveform rendering is not the leading cause in the normal long-track crop flow.
- Exact likely root cause:
  - Long-track crop is most likely failing from memory pressure in the in-browser crop/export pipeline, not from loop playback state or a render loop.
  - Default loop marker spacing is too tight because the initialization logic is effectively fixed to a maximum 12-second loop on long tracks.
- Narrow next step:
  - Keep this as a containment fix, not a crop-system redesign.
  - Split the follow-up into two surgical fixes:
    - add a long-source guard or safer strategy in `cropAudioBlobToWav(...)` / crop entry so hour-plus media does not try to fully decode in-memory on constrained devices
    - widen only the default loop-span initialization for long durations without changing manual loop editing behavior
  - Do not widen into waveform architecture, import changes, or full media-processing redesign in the same pass.
- Safe before release:
  - Likely yes, if kept narrow.
  - The loop-span fix is low risk.
  - The crop containment is moderate risk because it touches decoding/export behavior, but it is still safer than broader player or import changes if approached as a guardrail/containment patch.
- Regression risk if fixed:
  - Low for default loop-marker spacing if isolated to `setLoopFromCurrent()`.
  - Moderate for crop containment because audio export and replace/duplicate flows depend on the crop output format and timing.
- Fix not yet implemented:
  - Superseded by the containment implementation below.
- QA still needed after implementation:
  - Reproduce crop on a 60+ minute track on iPhone and confirm the app no longer refreshes or crashes.
  - Confirm shorter-track crop still works for both replace-existing and duplicate-to-new-track flows.
  - Confirm the default loop markers open with a visibly wider, more usable region on long tracks.
  - Confirm manual loop adjustment, loop playback, and stored loop persistence remain unchanged.
- Implementation pass opening note — 2026-04-07 Codex:
  - Confirmed containment to implement now:
    - keep short-track crop/export behavior unchanged
    - widen only the default long-track loop initialization
    - add an iOS long-track crop guardrail before the current full in-memory decode/export path can run
  - Files planned for edit:
    - `src/App.tsx`
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Added a narrow default-loop helper in `src/App.tsx` so long tracks now initialize a larger loop region instead of being effectively capped at 12 seconds.
    - Long tracks at or above 20 minutes now open with a loop span in the 45–120 second range, using a small duration ratio while preserving the previous short-track behavior.
    - Added an iOS-only long-track crop guardrail in `src/App.tsx` so the app blocks unsafe crop attempts before opening the crop prompt or starting the export path.
    - The guardrail message is: `This track is too long to crop safely on this device. Try desktop.`
    - Kept the existing replace-existing and duplicate-to-new-track crop flows unchanged for tracks below the guard threshold.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - How default loop behavior changed:
    - Before:
      - all tracks used the same 6–12 second default loop span logic
      - hour-plus tracks therefore opened with an initial region only about 12 seconds wide
    - After:
      - tracks below 20 minutes keep the previous default span behavior
      - tracks at or above 20 minutes now open with a larger initial region derived from a 45–120 second long-track range
  - Long-track crop guardrail:
    - Scope:
      - iOS only
      - current track duration at or above 20 minutes
    - Behavior:
      - the crop prompt does not open
      - if the crop path is somehow reached anyway, the same message is thrown as a safety backstop before blob fetch/decode begins
  - Why this is the safest release fix:
    - It prevents the known crash-prone decode/export path on the device family where the failure is most likely, without redesigning crop architecture.
    - It preserves normal short-track crop behavior and keeps the loop-spacing fix isolated to default initialization only.
  - What remains intentionally deferred:
    - any general long-audio crop/export solution in browser/webview
    - streaming or chunked media processing
    - waveform-generation redesign
    - any broader import/player architecture changes
  - Regression risk:
    - Low for default loop-marker sizing because it only affects initial loop creation on long tracks.
    - Low to moderate for the crop containment because it adds a new iOS block condition, but it is narrow and fail-safe.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm 60+ minute tracks no longer crash/refresh the app when crop is attempted on iPhone.
    - Confirm the guardrail message appears immediately and the crop prompt stays closed.
    - Confirm shorter-track crop still works for both replace-existing and duplicate-to-new-track flows.
    - Confirm long tracks now open with a much more usable default loop region.
    - Confirm manual loop adjustment, loop playback, and saved loop persistence are unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow Rasta smoke spawn polish
- Focus:
  - make the second Rasta smoke plume feel offset and organic
- Files inspected so far:
  - `src/fx/ambientFxEngine.ts`
  - `src/components/AmbientFxCanvas.tsx`
- Findings:
  - Rasta tap FX are spawned entirely inside `spawnRastaSmoke(...)` in `src/fx/ambientFxEngine.ts`.
  - The duplicate feel is not coming from CSS or a second render system; it is one cluster of three splats emitted from that function.
  - All three plumes currently inherit the same cluster rotation with only small jitter, which makes the second plume feel too closely stacked with the first on some taps.
  - Per-plume position and rotation are already defined in the FX engine, so the cleanest seam is there.
- Narrow implementation plan:
  - Keep the existing three-plume Rasta cluster.
  - Give only the second plume an extra random 10–20px offset from the tap point.
  - Give that second plume an independent random rotation rather than keeping it near the shared cluster rotation.
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `spawnRastaSmoke(...)` in `src/fx/ambientFxEngine.ts` so only the second plume now gets an additional random 10–20px radial offset from the tap point.
    - Updated that same second plume to use an independent random rotation instead of staying clustered near the shared plume rotation.
    - Kept the existing three-plume Rasta cluster, colors, motion, and overall smoke behavior intact.
  - Exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow FX-engine adjustment inside the Rasta tap spawn path only.
  - Regression risk:
    - Low.
    - The change affects only the second Rasta smoke plume on tap.
    - Other themes, other FX modes, and the rest of the Rasta plume cluster are unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the second Rasta smoke plume no longer feels stacked directly on the first.
    - Confirm the offset still feels subtle and tied to the tap point.
    - Confirm fullscreen and theme transitions do not produce obvious Rasta FX discontinuities.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis confirmed for narrow Rasta iOS-only blur tweak
- Focus:
  - make the Rasta leaf background more abstract on iOS only
- Files inspected so far:
  - `styles.css`
  - `src/App.tsx`
- Findings:
  - The recognizable leaf is rendered as the theme pseudo-element `body.theme-custom.theme-custom-rasta::after` in `styles.css`.
  - It is not a React node or runtime image overlay.
  - The current leaf uses `url("/rastaweed.png")` plus light color washes and only `filter: saturate(0.92) brightness(0.78)`, so there is no existing blur on that element.
  - The app already manages global body classes in `src/App.tsx`, which provides a clean seam for an iOS-only class.
- Likely root cause / visual seam:
  - On iOS, the leaf pseudo-element stays too crisp and recognizable because it is rendered without enough blur.
- Narrow implementation plan:
  - Add a single `is-ios` body class in `src/App.tsx`.
  - Add one iOS-only CSS override for `body.is-ios.theme-custom.theme-custom-rasta::after`.
  - Use a practical CSS blur value to achieve the requested “roughly 70% Gaussian blur” look without affecting the rest of the theme.
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Added a body-level `is-ios` class toggle in `src/App.tsx`.
    - Added an iOS-only override in `styles.css` for `body.is-ios.theme-custom.theme-custom-rasta::after` so the Rasta leaf pseudo-element now uses `blur(18px)` on top of its existing saturation/brightness treatment.
    - Left the rest of the Rasta theme and all non-iOS platforms unchanged.
  - Exact files changed:
    - `src/App.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow CSS-only visual change scoped to one pseudo-element on iOS.
  - Regression risk:
    - Low.
    - The change affects only the Rasta leaf background element on iOS.
    - Smoke, other theme layers, and non-iOS platforms are unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the Rasta leaf reads more abstractly on iPhone/iPad.
    - Confirm the rest of the Rasta atmosphere is unchanged.
    - Confirm non-iOS Rasta appearance is unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - tiny UX follow-up confirmed
- Focus:
  - add matching transient feedback when entering `dim`
- Files inspected so far:
  - `src/App.tsx`
- Findings:
  - `cycleDimMode()` already handles the `normal -> dim -> mute -> normal` desktop path and now already emits `Audio Muted` when entering `mute`.
  - The existing transient `showFxToast(...)` path is already the chosen pattern for this control family.
- Narrow implementation plan:
  - Keep the change inside `cycleDimMode()`.
  - Emit `Audio Dimmed` only when entering `dim`.
  - Keep `normal` silent and leave the existing mute toast intact.
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `cycleDimMode()` in `src/App.tsx` so entering `dim` now emits `Audio Dimmed` through the existing `showFxToast(...)` path.
    - Left `normal` silent and preserved the existing `Audio Muted` toast for the `mute` transition.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low.
    - The change is limited to one additional transient toast on the existing dim-mode transition.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm desktop `normal -> dim` shows `Audio Dimmed`.
    - Confirm the following `dim -> mute` transition still shows `Audio Muted`.
    - Confirm returning to `normal` stays silent.
    - Confirm no extra duplicate toasts appear during normal cycling.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis in progress for narrow mute-awareness feedback
- Focus:
  - add clear mute feedback without widening toast architecture
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/toastUtils.ts`
  - `src/components/PlayerControls.tsx`
- Findings:
  - Mute is toggled through `cycleDimMode()` in `src/App.tsx`.
  - The app already has a lightweight transient toast path via `fxToast` / `showFxToast(...)` used for repeat/theme/FX/vibe feedback.
  - The shimmer/persistent toast path is `vaultToast`, which is tied to workflow/process messages and `isBusyToastMessage(...)`, not general playback state.
  - There is no existing persistent, state-linked toast architecture for mute-like toggles.
- Likely root cause / UX seam:
  - Mute changes playback state visually, but the toggle path does not currently emit a toast or status confirmation.
- Narrow implementation plan:
  - Keep this in `cycleDimMode()`.
  - Use the existing transient `fxToast` pattern for a simple `Audio Muted` message when entering mute.
  - Avoid adding a persistent state-linked toast system for this one control.
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `cycleDimMode()` in `src/App.tsx` so entering `mute` now emits `Audio Muted` through the existing `showFxToast(...)` path.
    - Left unmute behavior silent to avoid duplicate/noisy toggle toasts.
    - Did not change the broader toast architecture or add a persistent mute-state toast.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow UX confirmation on an existing toggle path using an existing transient toast mechanism.
  - Toast behavior:
    - Transient.
    - It uses the existing `fxToast` path, which auto-clears quickly.
  - Regression risk:
    - Low.
    - The change is limited to showing one toast when mute is activated.
    - No playback logic, toast timing system, or persistent state handling was changed.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm pressing Mute shows `Audio Muted` immediately on both mini and fullscreen player controls.
    - Confirm repeated presses do not create noisy duplicate toasts beyond normal mute activations.
    - Confirm leaving mute does not leave stale toast UI behind.
    - Confirm repeat/theme/FX/vibe toasts still behave normally.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis in progress for narrow long-track auto-art cleanup
- Focus:
  - remove visible theme badge/text from long-track fallback auto art
- Files inspected so far:
  - `src/lib/db.ts`
  - `src/components/TrackRow.tsx`
  - `src/components/TrackTile.tsx`
- Findings:
  - The visible theme badge/text is baked directly into the long-track fallback poster SVG generated by `buildThemeNotePoster(...)` in `src/lib/db.ts`.
  - The badge is not a runtime UI overlay.
  - This fallback poster is used specifically in the long iOS auto-art skip path when waveform auto art is intentionally avoided for long imports.
  - Separate UI `AUTO` badges on tiles/rows are different components and are out of scope for this task.
- Likely root cause / UI seam:
  - The fallback SVG template itself includes a badge rectangle plus theme-name/`PolyPlay` text.
- Narrow implementation plan:
  - Keep the existing gradient, glow, and music-note composition.
  - Remove only the baked badge/text elements from the SVG template.
  - Do not change auto-art triggering logic or broader artwork generation behavior.
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated the long-track fallback poster generator in `src/lib/db.ts` so `buildThemeNotePoster(...)` no longer includes the baked theme badge rectangle or theme-name/`PolyPlay` text.
    - Kept the existing gradient background, glow shapes, and music-note composition unchanged.
    - Did not change the fallback-art trigger path or any broader auto-art generation logic.
  - Exact files changed:
    - `src/lib/db.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is a narrow generation-template cleanup for the long-track fallback poster only.
  - Regression risk:
    - Low.
    - The poster generator still returns the same kind of stored SVG artwork and is used in the same long-track fallback path.
    - The only intended visual change is removal of the visible badge/text.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Re-import or regenerate a long guarded track and confirm the fallback poster no longer shows theme text/badge.
    - Confirm the remaining poster composition still looks balanced in playbar, fullscreen, and now playing.
    - Confirm broader waveform auto art and UI `AUTO` badges are unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis in progress for narrow presentation cleanup
- Focus:
  - remove visible `Imported` source label/text from track UI
- Files inspected so far:
  - `src/components/TrackRow.tsx`
  - `src/components/TrackTile.tsx`
  - `src/components/MiniPlayerBar.tsx`
  - `src/components/FullscreenPlayer.tsx`
  - `src/admin/AdminApp.tsx`
  - `src/lib/db.ts`
- Findings:
  - The visible `Imported` text in the main app is rendered directly in `src/components/TrackRow.tsx` via `track.sub || "Imported"`.
  - Grid tiles do not render that label.
  - Mini player and fullscreen player do not render `track.sub`; they only show title/artist/time/aura and missing-media messages.
  - Admin import code and DB/storage normalization still write `sub: "Imported"` for imported tracks, but that is state/storage metadata, not the user-facing label seam for this task.
- Likely root cause / UI seam:
  - This is presentation-only noise from the list-row metadata renderer, not an import logic issue.
- Narrow implementation plan:
  - Keep import/storage/source state unchanged.
  - Remove only the visible `Imported` fallback from `TrackRow`.
  - Preserve any non-default custom `sub` value if one exists.
  - Avoid widening into badge or metadata redesign.
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Updated `src/components/TrackRow.tsx` so the list-row metadata no longer renders the default `Imported` fallback.
    - The row now hides that source line when `track.sub` is empty or equal to `Imported`, while still showing any non-default custom `sub` label if one exists.
    - No import/storage/state logic was changed.
  - Exact files changed:
    - `src/components/TrackRow.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Safe before release:
    - Yes. This is presentation-only and scoped to the visible list-row renderer.
  - Regression risk:
    - Low.
    - The only intended change is removal of the visible default `Imported` label in list rows.
    - Grid, mini player, fullscreen, import logic, and stored metadata are unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm list rows no longer show `Imported`.
    - Confirm rows still look balanced with artist-only, sub-only, and no-artist cases.
    - Confirm any non-default custom `sub` value still appears if such a track exists.
    - Confirm grid tiles, mini player, fullscreen player, and admin surfaces are visually unchanged.

**Diagnosis note — 2026-04-07 Codex:**
- Status:
  - diagnosis in progress for release-trust playback regression
- Focus:
  - imported tracks falsely showing `Missing audio`
  - tap/row selection not starting playback
  - next-track selection advancing without autoplay
  - possible now-playing / lock-screen metadata linkage
- Files inspected so far:
  - `src/lib/db.ts`
  - `src/App.tsx`
  - `src/lib/mediaSession.ts`
  - `src/components/MiniPlayerBar.tsx`
  - `src/components/FullscreenPlayer.tsx`
  - `src/components/TrackGrid.tsx`
  - `src/components/TrackRow.tsx`
  - `src/components/TrackTile.tsx`
- Likely root cause:
  - The recent lazy playback hydration change stopped broad `audioUrl` hydration on refresh, which was intentional.
  - But `toTrack(...)` in `src/lib/db.ts` still derives `missingAudio` from the absence of hydrated `audioUrl` / `audioBlob`, even when hydration was intentionally skipped. That makes imported tracks with a valid persisted `audioKey` appear missing in normal library state.
  - At the same time, `playTrack(...)` in `src/App.tsx` still requires `selectedTrack.audioUrl` to already exist before it arms `pendingAutoPlayRef`. Since `allTracksRef` is intentionally loaded with `includeMediaUrls: false`, tap-to-play and autoplay-to-next-track are blocked before current-track hydration can finish.
  - Manual Play still works because `togglePlayPause()` only requires `currentTrack.audioUrl`, and the selected/current-track effect hydrates that later via `getTrackPlaybackMediaFromDb(...)`.
  - The same false `missingAudio` flag also suppresses iOS now-playing and Media Session metadata sync, because those effects bail out when `currentTrack.missingAudio` is true even if the track later has a valid hydrated `audioUrl`.
- Narrow implementation plan:
  - Keep lazy playback hydration.
  - Decouple `missingAudio` from “audio URL not hydrated yet” so normal library rows are not misclassified.
  - Adjust tap/autoplay gating so a track with persisted audio backing can arm pending autoplay before `audioUrl` hydration completes.
  - Re-check current-track merged state so now-playing metadata follows the real hydrated playback state instead of the pre-hydration placeholder state.
- Implementation pass opening note — 2026-04-07 Codex:
  - Confirmed containment to implement now:
    - separate persisted audio backing from hydrated playback URL state
    - make `missingAudio` mean truly absent/broken media, not deferred hydration
    - let tap/autoplay arm from persisted audio availability without reintroducing eager library-wide media hydration
  - Files planned for edit:
    - `src/types.ts`
    - `src/lib/db.ts`
    - `src/App.tsx`
- Fix not yet implemented:
  - This pass is diagnosis only. No code changes made yet.
- QA still needed after implementation:
  - Confirm imported tracks no longer show `Missing audio` in mini player, fullscreen, or admin rows during normal playback state.
  - Confirm tapping a tile or row starts playback without needing a second manual Play press.
  - Confirm track end and Next both autoplay the next imported track.
  - Confirm lock-screen / now-playing title, artwork, and transport controls return for imported tracks.
- Fix implemented — 2026-04-07 Codex:
  - Exact fix made:
    - Added `hasAudioSource` to the runtime `Track` model so persisted audio backing is tracked separately from whether `audioUrl` has already been hydrated into UI state.
    - Updated `toTrack(...)` in `src/lib/db.ts` so `missingAudio` now reflects only true absence of any persisted/bundled audio source during normal lazy-hydrated catalog reads, instead of treating deferred hydration as missing media.
    - Updated `getTrackPlaybackMediaFromDb(...)` to return `missingAudio` for the selected/current-track hydration path based on whether a persisted audio source actually resolves to a playback URL. This preserves the ability for a genuinely broken selected track to surface as missing after on-demand fetch.
    - Updated the current-track merged state in `src/App.tsx` so the selected track can replace the placeholder `missingAudio` value with the hydrated truth from `getTrackPlaybackMediaFromDb(...)`.
    - Updated `playTrack(...)` in `src/App.tsx` so tap-to-play and autoplay arm from `hasAudioSource` rather than requiring a pre-hydrated `audioUrl`.
    - Kept lazy playback hydration intact. No eager full-library audio URL/blob hydration was reintroduced.
  - Exact files changed:
    - `src/types.ts`
    - `src/lib/db.ts`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - How readiness modeling changed:
    - Before:
      - `missingAudio` could become true simply because `audioUrl`/`audioBlob` had not been hydrated yet.
    - After:
      - `hasAudioSource` answers whether the track has persisted audio backing.
      - `missingAudio` in the broad lazy-hydrated catalog now means no persisted/bundled audio source is known.
      - The selected/current-track hydration path can still mark `missingAudio` true if a supposedly backed track fails to resolve to a playback URL on demand.
  - How playback gating changed:
    - Before:
      - `playTrack(...)` required `selectedTrack.audioUrl` to already exist before arming autoplay.
    - After:
      - `playTrack(...)` arms autoplay when the selected track has persisted audio backing and is not known-missing, allowing current-track hydration to provide the actual `audioUrl` after selection.
  - Why this is the safest release fix:
    - It corrects only the meaning of readiness state and the autoplay gate that depended on the wrong meaning.
    - It preserves the existing lazy hydration containment and does not widen into a player redesign or earlier media loading.
  - What remains intentionally deferred:
    - any broader player architecture changes
    - any eager library-wide hydration rollback
    - long-audio crop follow-up
    - mute toast, artwork badge, or theme/UI polish work
    - broader AirPods / competing-audio audit outside this same readiness seam
  - Regression risk:
    - Low to moderate.
    - Low because the change is narrow and keeps the lazy hydration architecture intact.
    - Moderate because tracks with stale `audioKey` pointers but no actual blob will now surface as missing only once selected/current-track hydration runs, not necessarily in every broad list state.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm imported tracks no longer show `Missing audio` in mini player/fullscreen during normal playback state.
    - Confirm tapping a tile and row from a cold state starts playback without a second manual Play press.
    - Confirm natural track-end advance autoplays the next track.
    - Confirm manual Next/Prev still autoplay correctly.
    - Confirm manual Play behavior remains unchanged.
    - Confirm lock-screen / now-playing metadata and artwork return for valid imported tracks.
    - Spot-check a genuinely broken/missing-media record if available to ensure selected-track missing-audio messaging still appears.

**Diagnosis note — 2026-04-06 Codex:**
- Files inspected so far:
  - `src/App.tsx`
  - `src/lib/db.ts`
  - `src/lib/player/media.ts`
  - `src/types.ts`
- Likely root cause:
  - The earlier hydration containment stopped full-library blob hydration, but visible playlist tracks still get hydrated with media URLs during `refreshTracks()`.
  - `toTrack(...)` still builds `audioUrl` by materializing the stored media blob into an object URL. For long imported video-as-audio tracks on iPhone, that is still enough to trigger memory pressure and refresh/reopen instability.
  - The existing long-iOS no-auto-art guard also leaves those tracks without fallback poster art, which is why they can appear blank in playbar/fullscreen/now playing when waveform art is skipped.
- Narrow implementation plan:
  - Keep general refresh metadata-light and artwork-safe by stopping audio URL hydration for non-current tracks.
  - Move playback audio URL hydration to the current-track path only.
  - Replace the long-iOS skipped-auto-art fallback with a cheap stored note poster in the current theme gradient so it appears across playbar, fullscreen, and now playing without expensive media analysis.
- Fix implemented — 2026-04-06 Codex:
  - Exact fix made:
    - Updated track hydration in `src/lib/db.ts` so general refresh can now include artwork URLs without also materializing audio URLs.
    - Updated `refreshTracks()` in `src/App.tsx` to hydrate visible tracks with artwork URLs only, not playback audio URLs.
    - Moved playback audio URL hydration to the current-track path only.
    - Removed eager current-track audio-blob hydration after refresh; crop now loads the current track’s audio blob on demand only when the user actually crops audio.
    - Added a cheap stored fallback poster for long iOS guarded imports in `src/lib/db.ts`: a small SVG music-note poster in the current theme gradient. This is written as real artwork so it shows in playbar, fullscreen, and now playing.
  - Exact files changed:
    - `src/lib/db.ts`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to moderate.
    - Playback source loading now happens later, at current-track hydration time rather than visible-list refresh time.
    - Crop now depends on on-demand audio-blob loading instead of prehydrated audio blobs.
    - The long-iOS auto-art fallback is intentionally simpler than waveform art, but it is much safer for memory.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Re-import a long video track on iPhone and confirm the app no longer enters a refresh/reopen loop.
    - Confirm the fallback note poster appears in the playbar, fullscreen player, and now playing.
    - Confirm regular imported tracks still play normally after refresh/reopen.
    - Confirm audio crop still works when invoked on an imported track.

**Diagnosis note — 2026-04-06 Codex:**
- Files inspected so far:
  - `src/admin/AdminApp.tsx`
  - `src/App.tsx`
  - `src/components/EmptyLibraryWelcome.tsx`
  - `src/admin/TransferLaneDropZone.tsx`
  - `styles.css`
- Likely UX seam:
  - The main player already exposes an `Import` action near the top, but once the upload page opens the real first step is visually buried.
  - In the admin upload form, title/artist fields appear before the audio picker, so the user sees metadata fields before the actual track-selection action.
  - The only submit button sits low in the form, below artwork controls and optional frame-selection UI, which makes import feel farther away than it is.
  - First-run guidance says “import your first track,” but it does not explicitly tell the user to tap Import, choose audio first, then review metadata if needed.
- Narrow implementation plan:
  - Keep the import engine unchanged.
  - Reorder the upload form so audio selection is the first visible action.
  - Surface a primary Import button near the top once audio is armed, while keeping the existing lower submit button.
  - Tighten the welcome/import hint copy so it describes the actual sequence in plain language.
- Fix implemented — 2026-04-06 Codex:
  - Exact fix made:
    - Reordered the admin upload form so the audio drop zone is now the first visible action.
    - Added clearer helper copy at the top of the import form explaining that audio comes first and metadata/artwork can be reviewed after.
    - Added a second primary Import button near the top of the upload form, next to a compact readiness summary, while keeping the existing lower submit button in place.
    - Added clearer hints to the audio and artwork drop zones so the first step and optional artwork step are less ambiguous.
    - Added a calm onboarding tooltip to the main app’s header Import button when the upload hint is active.
    - Tightened empty-state/onboarding copy so it explicitly says to tap Import, choose audio first, then review details and import.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `src/App.tsx`
    - `src/components/EmptyLibraryWelcome.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low.
    - This pass changes only layout order, helper copy, and duplicate access to the existing submit flow.
    - Import logic, metadata parsing, and storage behavior are unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the import page now shows the audio step high enough on mobile without feeling buried.
    - Confirm the new top Import button submits exactly like the existing lower Import button.
    - Confirm the main app header Import tooltip appears only during the upload-guidance phase and does not collide badly on small screens.
    - Confirm onboarding copy feels clear but not overly noisy during first-run flow.

**Diagnosis note — 2026-04-06 Codex:**
- Files inspected so far:
  - `src/App.tsx`
  - `src/admin/AdminApp.tsx`
  - `src/lib/backup.ts`
  - `src/lib/toastUtils.ts`
- Likely UX seam:
  - Export already has progress labels, but some wording is vague or abrupt, especially `Zipping backup now.` and `Preparing download…`.
  - Import is less trustworthy because the main app starts restore work without any explicit “opening/reading backup” phase message, and admin import only shows a broad `Importing backup…` label for the whole operation.
  - Backup-size and storage-related helper text can be made plainer so users understand the difference between device export limits and general app storage pressure.
- Narrow implementation plan:
  - Keep this pass to copy plus tiny phase-label sequencing only.
  - Add an optional progress callback to full-backup import so both app surfaces can show `opening`, `restoring`, and `finalizing` states without changing restore behavior.
  - Tighten the most visible vault import/export and storage-cap messages to calmer, more literal wording.
- Fix implemented — 2026-04-06 Codex:
  - Exact fix made:
    - Added an optional progress callback to `importFullBackup(...)` so vault import can now surface explicit restore phases: `Opening vault backup…`, `Restoring vault media…`, and `Finalizing vault restore…`.
    - Updated export-phase labels to clearer wording around collecting media and building the vault zip.
    - Updated the main app vault toast copy to use clearer import/export wording and calmer success/error text.
    - Updated the admin backup/import progress and status copy to match the same vault wording.
    - Expanded the busy-toast shimmer matcher so all active vault-process labels shimmer consistently, including the new opening/restoring/finalizing labels.
    - Tightened backup-size helper text so it reads as a device export-limit problem rather than a vague storage failure.
  - Exact files changed:
    - `src/lib/backup.ts`
    - `src/lib/toastUtils.ts`
    - `src/App.tsx`
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low.
    - This pass only changes user-facing status wording and adds optional import progress callbacks.
    - The underlying backup/export/import behavior is unchanged.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm vault export in the main app shows clearer active shimmer text through the full save flow.
    - Confirm admin full-backup export shows the updated active shimmer labels and final status wording.
    - Confirm app and admin import both show opening/restoring/finalizing progress without conflicting duplicate messages.
    - Confirm backup-size errors read clearly on mobile and do not imply the wrong kind of storage limit.

**Diagnosis note — 2026-04-06 Codex:**
- Files inspected so far:
  - `src/App.tsx`
  - `src/components/AmbientFxCanvas.tsx`
  - `src/fx/ambientFxEngine.ts`
- Likely cadence seam:
  - America/Merica tap fireworks already route through the ambient FX engine, not the DOM safe-tap burst layer.
  - `App.tsx` forwards taps to `AmbientFxCanvas`, which calls `ambientFxEngine.onTap(...)`.
  - In `ambientFxEngine.ts`, Merica currently uses only a rolling tap-window intensity value and always spawns a single `spawnMericaFireworks(...)` burst per tap.
  - There is no existing per-theme cadence counter, which is why there is no distinct “every 6th tap” accent today.
- Narrow implementation plan:
  - Keep the fix inside `src/fx/ambientFxEngine.ts`.
  - Add a small Merica-only tap counter and trigger a stronger multi-burst accent on every 6th tap.
  - Reuse the existing `spawnMericaFireworks(...)` renderer with small positional offsets instead of redesigning the effect system.
  - Preserve normal single-burst behavior for all non-6th taps.
- Fix implemented — 2026-04-06 Codex:
  - Exact fix made:
    - Added a Merica-only tap cadence counter inside `src/fx/ambientFxEngine.ts`.
    - Every 6th Merica tap now triggers a stronger multi-burst accent by reusing the existing `spawnMericaFireworks(...)` renderer at the tapped point plus two nearby offset burst points.
    - Reduced-motion Merica taps keep a smaller two-burst accent instead of the full three-burst variant.
    - The cadence counter resets when the theme slot changes or when the FX canvas is cleared so the accent pattern does not leak across theme switches or resets.
  - Exact files changed:
    - `src/fx/ambientFxEngine.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low.
    - The change is scoped to Merica-theme tap fireworks only.
    - Normal non-6th taps still use the existing single-burst behavior.
    - The only intentional behavior change is the stronger accent cadence on every 6th Merica tap.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm Merica theme produces the usual single burst on taps 1-5.
    - Confirm tap 6 produces a visibly stronger multi-burst accent.
    - Confirm the cadence repeats reliably on taps 12, 18, and so on.
    - Confirm theme switching or fullscreen transitions do not leave the cadence out of phase in an obvious way.
    - Confirm reduced-motion behavior still feels controlled rather than noisy.

**Diagnosis note — 2026-04-06 Codex:**
- Files inspected so far:
  - `src/admin/AdminApp.tsx`
  - `src/lib/db.ts`
  - `src/lib/artwork/waveformArtwork.ts`
  - `src/lib/storage/db.ts`
  - `src/lib/storage/library.ts`
  - `src/lib/iosMediaImport.ts`
  - `src/App.tsx`
  - `ios/App/App/PolyplayBridgeViewController.swift`
- Working hypothesis:
  - The highest-risk path is long-audio import without user/embedded artwork. `addTrackToDb(...)` writes the large audio blob first, then falls back to auto artwork generation via `generateWaveformArtwork(...)`, which decodes the entire audio file in Web Audio.
  - For hour-plus MP3s, that decode step is likely far larger in memory than the compressed file size and can plausibly crash/reload the webview, which matches the observed long importing toast followed by screen refresh and failed import.
  - The parent/overlay refresh path in `src/App.tsx` looks more like a secondary amplifier after success messaging, not the first obvious root cause.
- Narrow audit plan:
  - Confirm whether metadata parse, auto-waveform artwork generation, IndexedDB/localStorage writes, or parent refresh is the first dangerous step for long files.
  - Keep scope limited to the long-audio import path only.
  - Do not implement until the root cause is tight enough for a surgical fix.
- Diagnosis update:
  - User clarified the bug appears iOS-only. That matches the code path: iOS uses the native picker bridge and then re-materializes the selected file into JS with `fetch(...).blob()` in `src/lib/iosMediaImport.ts` before metadata parse or import begin.
  - Primary likely root cause is memory pressure, not timeout and not a logical refresh loop. The most dangerous step is the no-artwork fallback inside `src/lib/db.ts`, where `addTrackToDb(...)` stores the large audio blob and then calls `generateWaveformArtwork(...)`. That path runs `blob.arrayBuffer()` and `decodeAudioData(...)` in `src/lib/artwork/waveformArtwork.ts`, which is a poor fit for hour-plus audio on iOS/WKWebView.
  - Metadata parse in `src/admin/AdminApp.tsx` is also heavy because it reads the whole file into a `Uint8Array`, but it happens earlier during file selection. The observed "long importing toast -> screen refresh" lines up better with the import-submit path than with metadata inspection.
  - The overlay/app refresh path in `src/App.tsx` is a secondary amplifier only after success messaging. It eagerly reloads all track blobs on refresh, which can worsen iOS memory pressure, but it does not appear to be the first failure trigger here.
  - There is an additional risk multiplier: `addTrackToDb(...)` writes the audio blob to IndexedDB before the auto-artwork fallback finishes. If iOS reloads/crashes during waveform-art generation, the library row is never saved but the large blob may already exist as orphaned storage, which fits the report that the app can feel bricked afterward.
- Safest next implementation step:
  - Keep the fix surgical to iOS long-audio import.
  - Skip waveform-based auto artwork generation for imports above a conservative size/duration threshold on iOS and fall back directly to a cheap static placeholder poster, or allow no poster and let existing UI handle missing art.
  - In the same narrow pass, reorder or guard the import write so a failure before `saveLibrary(...)` does not leave a large orphaned blob behind.
- Containment plan — 2026-04-06 Codex:
  - Files to change:
    - `src/lib/db.ts`
    - `src/lib/artwork/waveformArtwork.ts` only if a tiny helper is needed
  - Narrow implementation plan:
    - Add an iOS-only long-audio guard in `addTrackToDb(...)` so imports above a conservative byte threshold do not call waveform-based auto-art generation.
    - Keep fallback behavior cheap: allow no generated poster rather than decoding the full audio blob on iOS.
    - Wrap blob writes in cleanup so if import fails after audio/blob storage begins, any newly written blob keys are deleted before the error escapes.
- Fix implemented — 2026-04-06 Codex:
  - Exact fix made:
    - Added an iOS-only long-audio containment guard in `src/lib/db.ts` so imports with no provided artwork skip waveform-based auto-art generation when the audio file is larger than `25 MB` or longer than `20 minutes`.
    - The guard checks file size first, then only falls back to a metadata-only duration probe when the size threshold did not already trigger.
    - The guarded path now allows the track import to continue without generated poster art instead of decoding the full audio blob in Web Audio on iOS.
    - `addTrackToDb(...)` now resolves/validates the target playlist before blob writes begin.
    - `addTrackToDb(...)` now tracks newly written blob keys and deletes them if any later import step fails before the library save completes, including failures during blob writes and failures in `saveLibrary(...)`.
  - Exact files changed:
    - `src/lib/db.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to moderate.
    - Main behavior change is intentional: some long iOS imports without artwork will now land with no generated poster instead of auto waveform art.
    - The guard is scoped to iOS plus long audio plus no supplied artwork, so shorter imports and imports with embedded/manual art keep their old behavior.
    - Blob cleanup touches import persistence, so failed-import recovery should be checked once on device.
  - QA still needed:
    - Repro the original 1h+ MP3 import on iOS with no manual artwork and confirm import succeeds without webview refresh.
    - Repeat on both a new playlist and an existing playlist.
    - Confirm the imported track remains playable and visible after closing/reopening the app.
    - Confirm smaller iOS imports without artwork still get generated poster art.
    - Confirm imports with embedded artwork still preserve that artwork.
- Diagnosis start — 2026-04-06 Codex:
  - Scope:
    - playlist deletion from admin
    - track/media cleanup after playlist deletion
    - shared-media protection across playlists
    - vault export size behavior and orphaned blob inclusion
  - Files to inspect:
    - `src/admin/AdminApp.tsx`
    - `src/lib/db.ts`
    - `src/lib/storage/db.ts`
    - `src/lib/storage/library.ts`
    - `src/lib/backup.ts`
  - Working questions:
    - Does deleting a playlist remove only the playlist row, or also unreferenced tracks and blobs?
    - Does vault export walk library references only, or can orphaned blobs still bloat the archive/export-size calculation?
    - Could a reported `734 MB` vault size plausibly come from retained imported MP3 blobs after playlist deletion?
- Diagnosis update — 2026-04-06 Codex:
  - Files inspected:
    - `src/admin/AdminApp.tsx`
    - `src/lib/db.ts`
    - `src/lib/backup.ts`
    - `src/lib/storage/db.ts`
  - Likely root cause:
    - Playlist deletion itself appears to remove the playlist row and delete blobs for tracks that become unreferenced by all remaining playlists.
    - Shared tracks are intentionally protected by reference counting across playlists.
    - Full backup export does not iterate raw blob-store keys, so truly orphaned blobs by themselves should not inflate the vault export estimate.
    - The sharper issue is that full backup export includes every non-demo track still present in `library.tracksById`, even if that track is no longer referenced by any playlist. If orphaned/unreferenced track records exist in the library, their audio blobs will still be exported and still count against the `512 MB` mobile cap.
    - This means a reported `734 MB` vault estimate is much more likely to come from retained track records and their referenced MP3 blobs than from blob-store garbage alone.
  - Narrow implementation direction:
    - Keep diagnosis-only for now.
    - Safest next fix is probably to make full backup export prune to tracks actually referenced by surviving non-demo playlists, and optionally add a targeted orphan-track/blob cleanup pass rather than raising the backup cap.
  - Concrete codepath findings:
    - Admin playlist deletion flows through `src/admin/AdminApp.tsx` `onDeletePlaylist(...)`, which calls `deletePlaylistInDb(...)`, then refreshes playlists, tracks, and storage.
    - `src/lib/db.ts` `deletePlaylistInDb(...)` deletes the playlist record first, recomputes references with `countTrackReferences(...)`, and deletes track blobs plus `tracksById` entries only for tracks that are no longer referenced anywhere.
    - `src/lib/db.ts` `clearPlaylistInDb(...)` uses the same reference-counting pattern for nuking/emptying a playlist while preserving shared tracks.
    - `src/lib/db.ts` `getStorageUsageSummary()` reads raw blob-store stats from `listBlobStats()`, so admin storage totals can stay high if blob-store garbage already exists from earlier failures even when backup export would not include those blobs.
    - `src/lib/backup.ts` `exportFullBackup(...)` calls `sanitizeLibraryForFullBackup(loadLibrary())`, but that sanitizer removes demo content only; it does not prune tracks that have zero remaining playlist references.
    - `src/lib/backup.ts` `buildTrackMediaEntries(...)` exports media by walking the track records passed in, so any stale non-demo `tracksById` entry with live blob keys will still be packaged into the vault backup.
  - Release judgment:
    - This looks safe to fix before release if kept surgical.
    - The most surgical change is in full-backup export scoping, not playlist deletion semantics and not backup-cap widening.
  - Implementation decision — 2026-04-06 Codex:
    - Confirmed root cause for the release-trust issue:
      - full vault backup currently includes all non-demo `tracksById` rows, not only tracks still reachable from surviving playlists
      - this can keep deleted/unreachable media in the backup even when playlist deletion itself handled shared-reference protection correctly
    - Narrowest release-safe fix:
      - apply export-time filtering only, by pruning full-backup library content to tracks referenced by surviving non-demo playlists before media collection runs
    - Deferred on purpose:
      - broad delete-time storage/orphan cleanup redesign
      - admin storage-meter reconciliation for pre-existing orphan blobs
  - Fix implemented — 2026-04-06 Codex:
    - Exact fix made:
      - Updated full-backup sanitization so vault export now prunes non-demo tracks to only those still reachable from surviving non-demo playlists before media collection runs.
      - Updated full-backup track counting to use that same sanitized/reachable set so backup eligibility matches actual export contents.
    - Fix type:
      - export-time filtering only
    - Exact files changed:
      - `src/lib/backup.ts`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Why this was the safest release fix:
      - It addresses the trust-critical user-visible problem directly: deleted/unreachable media should no longer keep inflating vault export size.
      - It leaves playlist deletion semantics, shared-track protection, storage accounting, and restore/import behavior untouched.
      - It avoids a riskier delete-time cleanup change late in stabilization.
    - Intentionally deferred:
      - deleting pre-existing orphan blobs from the blob store
      - reconciling admin storage totals with exportable live media
      - broader storage/backup redesign
    - Regression risk:
      - Low.
      - The main intentional behavior change is that tracks not reachable from any surviving non-demo playlist are no longer included in full vault backups.
      - If the product later wants “library-resident but unassigned” tracks to be preserved in full backups, that would need an explicit design, but no such ownership model was evident in the current code.
    - QA completed:
      - `npm run typecheck`
  - QA still needed:
      - Delete a playlist containing unique long tracks, then confirm full backup estimate/export size drops.
      - Delete one playlist while another still references shared tracks and confirm shared media remains exportable.
      - Confirm remaining playlists/tracks still load normally after deletion.
      - Confirm full backup no longer includes unreachable tracks/media.
      - Smoke-test full backup import/export flow on an existing non-demo library.
- Diagnosis start — 2026-04-06 Codex:
  - Scope:
    - full vault import path only
    - post-import restore/rehydration/refresh behavior
    - iPhone flashing / repeated redraw / bricked reopen loop
  - Files to inspect:
    - `src/admin/AdminApp.tsx`
    - `src/lib/backup.ts`
    - `src/App.tsx`
    - `src/lib/storage/library.ts`
    - any iOS-specific lifecycle/reopen hooks touched after import
  - Working questions:
    - where does full vault import write restored library/media/config
    - what post-import messages or refreshes fire after restore completes
    - can restored heavy media cause repeated refresh/reconcile/playback reinit on iOS
    - is there a loop between import completion, overlay reopen/close, and app rehydration
  - Diagnosis update — 2026-04-06 Codex:
    - Files inspected:
      - `src/App.tsx`
      - `src/admin/AdminApp.tsx`
      - `src/lib/backup.ts`
      - `src/lib/db.ts`
      - `src/lib/player/media.ts`
      - `src/lib/storage/library.ts`
    - Findings:
      - Full vault import reads the whole zip into memory in `src/lib/backup.ts` `importFullBackup(...)`, restores every media blob into IndexedDB, saves the restored library, applies imported config, then deletes obsolete old blobs.
      - After import, both the in-app vault flow (`src/App.tsx` `onLoadUniverseFile(...)`) and the admin iframe flow (`src/admin/AdminApp.tsx` `onImportFullBackupFile(...)`) trigger post-restore refresh activity.
      - The critical refresh path is `src/App.tsx` `refreshTracks()`, which calls `getAllTracksFromDb()`.
      - `src/lib/db.ts` `getAllTracksFromDb()` maps every track through `toTrack(...)`, and `toTrack(...)` eagerly calls `getBlob(...)` for audio/art/video blobs and returns `audioBlob`/`artBlob` for every track, not just the current track.
      - On a heavy restored vault, this means the app immediately rehydrates the entire restored media set into JS memory right after import.
      - The import path also triggers redundant refresh pressure:
        - in-app flow dispatches `polyplay:library-updated` and also directly awaits `refreshTracks()`
        - admin iframe flow posts both `config-imported` and `library-updated`, and the parent app refresh handlers react to both
      - That redundancy alone does not explain an infinite loop, but under heavy payload on iPhone it likely increases the chance of a webview crash during post-import hydration.
      - Once the large restored library has already been persisted, app reopen/startup will hit the same eager hydration path again, which can create the observed "flashing / repeated redraw / effectively bricked" behavior on iOS.
    - Likely root cause:
      - not generic ZIP parsing
      - not a simple message-loop by itself
      - most likely iOS memory collapse caused by eager full-library blob rehydration immediately after restore, with repeated refresh triggers increasing the odds of crash and persisted restored state causing the same crashy hydration path again on reopen
    - Narrow implementation direction:
      - safest next fix is likely a containment change in post-import/startup hydration, not in the ZIP parser
      - likely target: stop `refreshTracks()` from eagerly materializing every restored blob into JS memory during restore/reopen, or at minimum avoid the redundant post-import refresh fan-out on heavy restore paths
  - Implementation decision — 2026-04-06 Codex:
    - Confirmed release-safe fix target:
      - remove eager blob hydration from the general track catalog refresh path
    - Narrow implementation plan:
      - make `getAllTracksFromDb()` / `toTrack(...)` stop fetching `audioBlob` and `artBlob` for every track during normal refresh
      - preserve URLs/metadata/catalog behavior
      - patch any direct blob-dependent operation only if it needs an explicit on-demand fetch fallback
    - Deferred on purpose:
      - ZIP/import flow redesign
      - broader event-fanout cleanup unless a tiny direct change proves necessary
  - Fix implemented — 2026-04-06 Codex:
    - Exact fix made:
      - General library refresh no longer hydrates media blobs for the full library.
 - Diagnosis start — 2026-04-06 Codex:
   - Scope:
     - Rasta auto-art instability only
     - whether art is truly regenerating or just being visually re-animated
   - Files inspected:
     - `src/components/FullscreenPlayer.tsx`
     - `src/App.tsx`
     - `src/admin/AdminApp.tsx`
     - `src/lib/db.ts`
     - `styles.css`
   - Findings:
     - I do not see an interval/effect loop repeatedly regenerating auto artwork in storage during normal playback.
     - Auto-art regeneration in `src/lib/db.ts` is currently tied to explicit theme changes through `regenerateAutoArtworkForThemeChangeInDb(...)`, not to a repeating timer.
     - The strongest match for the reported "changes every 5 seconds" behavior is in `src/components/FullscreenPlayer.tsx`, where generated artwork (`track.artworkSource === "auto"`) is intentionally animated with a canvas overlay on a `4000ms` loop via `requestAnimationFrame`.
     - Rasta also layers animated smoke/leaf background motion in `styles.css`, which likely amplifies the impression that the poster itself keeps changing.
   - Likely root cause:
     - This looks much more like unstable presentation of generated art than repeated DB-side art regeneration.
     - Specifically, fullscreen auto-art animation is enabled for all auto-generated art, and the Rasta theme makes that motion especially noticeable.
 - Narrow implementation direction:
   - Safest next fix is likely to keep generated art visually stable in this path by disabling or gating the fullscreen generated-art animation, rather than touching theme watchers, storage, or auto-art generation itself.
 - Implementation decision — 2026-04-06 Codex:
   - Confirmed release-safe fix target:
     - `src/components/FullscreenPlayer.tsx` generated-art presentation only
   - Narrow implementation plan:
     - disable the repeating generated-art canvas animation loop so auto-generated poster art remains visually stable in fullscreen
     - leave artwork-video handling unchanged
     - leave DB/theme-triggered auto-art regeneration unchanged
 - Fix implemented — 2026-04-06 Codex:
   - Exact fix made:
     - Disabled the fullscreen generated-art animation loop in `src/components/FullscreenPlayer.tsx` by turning off the auto-art canvas overlay path.
     - Auto-generated poster art now remains visually static in fullscreen/current-art presentation instead of cycling on the previous ~4 second loop.
     - Artwork-video behavior remains unchanged.
     - Theme-change-triggered DB regeneration remains unchanged.
   - Exact files changed:
     - `src/components/FullscreenPlayer.tsx`
     - `docs/polyplay_release_tasks_2026-04-05.md`
   - Why this was the safest release fix:
     - It fixes the confirmed presentation-layer cause directly without touching storage, theme watchers, or regeneration logic.
     - It avoids broader fullscreen art redesign and preserves existing artwork/video handling.
   - Intentionally deferred:
     - any future redesign of generated-art animation as an explicit opt-in effect
     - Rasta smoke/background polish unrelated to the repeated poster-change symptom
   - Regression risk:
     - Low.
     - The main behavior change is intentional: auto-generated poster art is now visually stable instead of animated in fullscreen.
   - QA completed:
     - `npm run typecheck`
   - QA still needed:
     - Confirm Rasta auto art stays visually stable for the same track over time.
     - Confirm explicit theme change still regenerates auto art when intended.
     - Confirm non-video auto-art tracks still render correctly.
     - Confirm artwork-video tracks are unchanged.
     - Confirm fullscreen transitions still work normally.
 - Diagnosis start — 2026-04-06 Codex:
   - Scope:
     - waveform visibility before playback only
     - whether pre-play waveform blanking is data-readiness, rendering, or styling
   - Files inspected:
     - `src/components/WaveformLoop.tsx`
     - `src/components/player.css`
     - `src/App.tsx`
     - `src/lib/db.ts`
     - `src/lib/artwork/waveformArtwork.ts`
     - `src/lib/waveformTheme.ts`
     - `src/components/MiniPlayerBar.tsx`
     - `src/components/FullscreenPlayer.tsx`
   - Findings:
     - The waveform component already has multiple fallback paths that should allow pre-play rendering even before decoded peaks exist:
       - cached `track.waveformPeaks`
       - stored/runtime peak cache
       - synthetic `fallbackPeaks()`
     - General track hydration no longer ships `audioBlob` with the full catalog after the recent iOS vault-import containment change. Active-track blobs are now loaded asynchronously on demand in `src/App.tsx`.
     - `WaveformLoop` can still render without `audioBlob`, so the new lazy hydration is a secondary amplifier, not the primary cause.
     - The stronger issue is render invalidation: `WaveformLoop` draws its canvases from `getBoundingClientRect()` inside effects that depend on peaks/time/duration state, but it does not observe container size/layout changes and has no local `ResizeObserver`.
     - If the waveform first draws while the player area is still settling or measuring at zero width/height, the canvases can remain blank until some later state change causes another draw.
     - Playback start reliably changes `currentTime`, which re-runs the decor canvas draw path and can make the waveform suddenly appear, matching the observed symptom.
     - Theme contrast is unlikely to be the primary cause: idle waveform colors are opaque enough in `src/lib/waveformTheme.ts`, and the pre-play canvas is not intentionally hidden once a track exists.
   - Likely root cause:
     - The blank pre-play waveform is most likely a canvas redraw/measurement bug, not missing waveform data generation.
     - Specifically, `WaveformLoop` does not redraw when its viewport size becomes valid after initial layout, so a first blank/zero-size draw can persist until playback-driven state changes arrive.
 - Narrow implementation direction:
   - Safest next fix is likely to add a tiny waveform-local redraw trigger for viewport size/layout changes, or otherwise force one redraw after the player area settles, without changing audio import, playback, or waveform generation logic.
 - Implementation decision — 2026-04-06 Codex:
   - Confirmed release-safe fix target:
     - `src/components/WaveformLoop.tsx` presentation/layout only
   - Narrow implementation plan:
     - add a waveform-local layout redraw trigger
     - use a tightly scoped `ResizeObserver` on the waveform container and a small post-layout redraw after track change
     - keep waveform generation and playback behavior unchanged
 - Fix implemented — 2026-04-06 Codex:
   - Exact fix made:
     - Added a waveform-local layout redraw trigger in `src/components/WaveformLoop.tsx`.
     - `WaveformLoop` now observes the waveform container with `ResizeObserver` and bumps a local layout version only when the measured waveform viewport size changes to a valid non-zero size.
     - Added a narrow two-`requestAnimationFrame` post-layout redraw after track change so a too-early first canvas draw does not persist.
     - Wired both waveform canvas draw effects to that local layout version so the waveform redraws when the viewport becomes valid, without changing playback or waveform generation logic.
   - Exact files changed:
     - `src/components/WaveformLoop.tsx`
     - `docs/polyplay_release_tasks_2026-04-05.md`
   - Redraw trigger type:
     - both
     - `ResizeObserver` for valid size/layout changes
     - a one-shot post-layout settle redraw after track change
   - Why this was the safest release fix:
     - It stays entirely inside waveform presentation/layout behavior.
     - It does not change track loading, waveform generation, audio playback, or broader app layout.
     - It directly addresses the confirmed zero-size/too-early draw failure mode.
   - Intentionally deferred:
     - any broader waveform rendering refactor
     - any app-wide layout invalidation system
     - any unrelated visual polish to waveform styling
   - Regression risk:
     - Low.
     - Main tradeoff is a small amount of additional redraw work when the waveform container resizes or a track changes, but the observer is scoped locally and only reacts to actual size changes.
   - QA completed:
     - `npm run typecheck`
   - QA still needed:
     - Load a track and confirm waveform is visible before pressing play.
     - Confirm waveform still updates correctly during playback.
     - Confirm switching tracks redraws correctly before playback.
     - Confirm mini player and fullscreen loop editor still render waveform correctly.
     - Confirm no obvious regressions on iPhone/Safari where layout timing is more sensitive.
 - Diagnosis start — 2026-04-06 Codex:
   - Scope:
     - factory reset path only
     - Safari splash overlay behavior after reset/startup
     - splash asset visibility, not broader onboarding redesign
   - Files inspected:
     - `src/App.tsx`
     - `src/admin/AdminApp.tsx`
     - `src/components/SplashOverlay.tsx`
     - `src/index.css`
   - Findings:
     - Factory reset from admin clears splash/onboarding keys in `src/admin/AdminApp.tsx`, then posts `polyplay:factory-reset` to the parent.
     - The parent reset handler in `src/App.tsx` sets `showSplash(true)` and `isSplashDismissing(false)`, so the splash overlay is explicitly re-shown after reset.
     - The splash assets themselves are present locally (`logo.png` and `polyplay_splashvideo_logo480.mp4`), so this does not look like a missing-file problem.
     - In `src/components/SplashOverlay.tsx`, the fallback logo is shown only while `!isVideoReady`.
     - `isVideoReady` is set eagerly from:
       - `video.readyState >= HAVE_CURRENT_DATA`
       - `onLoadedData`
       - `onCanPlay`
     - On Safari, those conditions can become true before the video has actually painted a usable frame and even when autoplay is blocked or deferred.
     - Once `isVideoReady` flips true, the fallback logo is removed and the video fades in. If Safari has not painted the first frame yet, the splash can appear black/blank, which matches the “missing splash image” report.
   - Likely root cause:
     - The splash overlay’s readiness logic is too optimistic for Safari.
     - It treats media readiness as visual readiness and hides the fallback image too early, especially on reset when the splash is forced back into view and autoplay/user-gesture conditions are sensitive.
 - Narrow implementation direction:
   - Safest next fix is likely inside `src/components/SplashOverlay.tsx`:
     - keep the fallback logo visible until actual playback/frame-progress is confirmed, or
     - otherwise make the fallback independent of early `canplay`/`loadeddata` signals on Safari.
 - Implementation decision — 2026-04-06 Codex:
   - Confirmed release-safe fix target:
     - `src/components/SplashOverlay.tsx` readiness/display logic only
   - Narrow implementation plan:
     - stop treating `readyState` / `loadeddata` / `canplay` as sufficient to hide the fallback
     - require stronger evidence of visible playback, with actual video time/frame progress, before removing the fallback logo
     - leave reset sequencing and splash assets unchanged
 - Fix implemented — 2026-04-06 Codex:
   - Exact fix made:
     - Updated `src/components/SplashOverlay.tsx` so the fallback splash logo is no longer removed on early media-readiness signals alone.
     - Replaced the old `isVideoReady` behavior with a stronger visible-playback gate: the splash video now has to show actual playback progress (`currentTime > 0.02`) before the fallback logo is hidden.
     - The splash video still attempts autoplay as before, but if Safari reports readiness before a visible frame is on screen, the fallback remains visible instead of going blank.
   - Exact files changed:
     - `src/components/SplashOverlay.tsx`
     - `docs/polyplay_release_tasks_2026-04-05.md`
   - Stronger signal now controlling fallback removal:
     - actual playback/frame progress via `currentTime > 0.02`
     - observed from play/resume attempts and `timeupdate`, instead of `readyState` / `loadeddata` / `canplay` alone
   - Why this was the safest release fix:
     - It stays entirely inside splash readiness/display logic.
     - It leaves factory reset sequencing, onboarding flow, and splash assets untouched.
     - It directly addresses the Safari-specific early-readiness mismatch that was hiding the fallback too soon.
   - Intentionally deferred:
     - any broader splash/onboarding redesign
     - any Safari/PWA-specific branching beyond the stronger readiness gate
   - Regression risk:
     - Low.
     - The main behavior change is intentional: the fallback image can remain visible slightly longer before the video takes over.
   - QA completed:
     - `npm run typecheck`
  - QA still needed:
    - Run factory reset in Safari browser mode and confirm the splash shows a visible image immediately.
    - Test Safari PWA mode separately if possible.
    - Confirm splash still transitions into video normally.
    - Confirm skip/close/tap-to-start behavior still works.
    - Confirm non-Safari browsers are unchanged.
 - Diagnosis start — 2026-04-06 Codex:
   - Scope:
     - theme-to-aura mapping only
     - custom theme selection for Amber / Teal / Crimson
     - global aura override vs theme CSS variable behavior
   - Files inspected:
     - `src/lib/themeConfig.ts`
     - `src/App.tsx`
     - `src/admin/AdminApp.tsx`
     - `styles.css`
   - Findings:
     - The actual theme aura constants are already correct:
       - Amber `#f0b35b`
       - Teal `#42c7c4`
       - Crimson `#cf6f82`
     - CSS theme-slot aura variables are also correct in `styles.css`.
     - The likely bug is in theme-switch runtime logic, not the constants.
     - In both `src/App.tsx` and `src/admin/AdminApp.tsx`, custom-theme switching only updates `auraColor` when `preserveTrackThemeAuraOrigins` is false.
     - When preserve-origins is true, the code skips updating or clearing the global aura override, which can leave a stale prior aura color in state/localStorage and override the correct theme aura.
   - Likely root cause:
     - The preserve-origins flag is incorrectly affecting the global UI aura mapping seam.
     - It should control track/theme-origin conversion behavior, not prevent the selected theme pack from applying its intended aura color to the UI.
  - Narrow implementation direction:
    - Safest next fix is to make explicit theme selection always apply the matching global aura color for custom theme packs, regardless of preserve-origins.
    - Keep preserve-origins only on the track regeneration path.
 - Fix implemented — 2026-04-06 Codex:
   - Exact fix made:
     - Updated explicit theme-switch handling in `src/App.tsx` so custom theme selection now always applies that pack’s matching global aura color (`THEME_PACK_AURA_COLORS[...]`) and persists it to `AURA_COLOR_KEY`, regardless of the preserve-origins setting.
     - Updated the admin theme-switch path in `src/admin/AdminApp.tsx` to mirror the same behavior and to always post the matching `polyplay:aura-color-updated` message for custom theme selection.
     - Preserve-origins now remains only on the track regeneration branch, not on the global UI aura mapping branch.
   - Exact files changed:
     - `src/App.tsx`
     - `src/admin/AdminApp.tsx`
     - `docs/polyplay_release_tasks_2026-04-05.md`
   - Why this was the safest release fix:
     - The theme aura constants and CSS were already correct.
     - The bug was a narrow runtime override issue where stale `auraColor` could survive theme changes.
     - This fix corrects the explicit theme-selection seam without redesigning theme state or track-origin behavior.
   - Regression risk:
     - Low.
     - The intentional behavior change is that selecting Amber / Teal / Crimson now always updates the global aura to the pack’s intended color, even when preserve-origins is on.
   - QA completed:
     - `npm run typecheck`
  - QA still needed:
    - Confirm Amber theme shows an amber aura.
    - Confirm Teal theme shows a teal/turquoise aura.
    - Confirm Crimson theme shows a crimson aura.
    - Confirm theme switching still works from both main app and admin.
    - Confirm preserve-origins still only affects track-regeneration behavior, not UI aura color.
 - Diagnosis start — 2026-04-06 Codex:
   - Scope:
     - YTM-style tile shell/background/masking only
     - false square / black backing behind rounded corners
   - Files inspected:
     - `src/components/TrackTile.tsx`
     - `src/components/BorderTrail.tsx`
     - `styles.css`
     - `src/index.css`
   - Findings:
     - The tile content is rendered inside `.ytm-tile-hit`, which already has the intended rounded mask (`border-radius: 16px; overflow: hidden; background: #0e121c`).
     - The outer `.ytm-tile` shell also paints its own dark background gradient while keeping `overflow: visible`.
     - That creates a second backing layer behind the real rounded hit area and can read as a square/black rectangle behind the corners when the inner masked cover and outer shell disagree visually.
     - `ytm-cover` inherits radius but does not clip its own media explicitly, so tightening the cover clipping is also low-risk.
   - Likely root cause:
     - The tile has two competing background layers:
       - outer shell `.ytm-tile`
       - inner masked tile body `.ytm-tile-hit`
     - The outer shell background is the likely false square backing seam.
  - Narrow implementation direction:
    - Safest next fix is to make the outer `.ytm-tile` shell background transparent and let the rounded `.ytm-tile-hit` own the visible tile body.
    - Also add local clipping on `.ytm-cover` so media/pseudo content cannot escape the intended rounded tile mask.
 - Fix implemented — 2026-04-06 Codex:
   - Exact fix made:
     - Removed the outer `.ytm-tile` shell backing fill by changing its background to transparent.
     - Added `overflow: hidden` to `.ytm-cover` so cover media and cover pseudo-layers clip to the inherited rounded radius.
   - Exact files changed:
     - `styles.css`
     - `docs/polyplay_release_tasks_2026-04-05.md`
   - Why this was safe to fix before release:
     - The issue was a narrow layer/mask seam in the tile stack, not a broader tile architecture problem.
     - The rounded tile body already lived on `.ytm-tile-hit`, so removing the duplicate outer backing layer is low risk.
   - Regression risk:
     - Low.
     - Main behavioral change is only that the visible tile body is now owned by one rounded masked layer instead of two competing layers.
   - QA completed:
     - `npm run typecheck`
 - QA still needed:
   - Confirm rounded tile corners render cleanly with no black/square backing.
   - Check both default and custom themes.
   - Check tiles with real artwork and fallback artwork.
   - Confirm active/aura-hit states still render correctly.
 - Diagnosis start — 2026-04-06 Codex:
   - Scope:
     - Rasta smoke composition only
     - whether the doubled cloud look comes from duplicate layers or a single overbuilt composition
   - Files inspected:
     - `styles.css`
     - `src/index.css`
     - `src/App.tsx`
   - Findings:
     - I do not see two separate smoke components mounting from JS.
     - Rasta uses:
       - `body.theme-custom.theme-custom-rasta::before` for the main blurred smoke/haze field
       - `body.theme-custom.theme-custom-rasta::after` for the leaf layer, but that layer also includes two extra radial haze gradients
       - the global `.track-backdrop.is-visible`, which is also blurred and slightly more opaque for Rasta (`0.23`)
     - So the “double cloud” look is most likely compositional overlap:
       - one real smoke field in `::before`
       - plus secondary haze in `::after`
       - plus the blurred track backdrop behind everything
     - The generic `body.theme-custom::before` is not a separate extra smoke layer here; the Rasta-specific `::before` overrides that same pseudo-element.
   - Likely root cause:
     - Not duplicate mounting.
     - The Rasta smoke effect is being visually doubled by overlapping haze sources across multiple layers.
     - The sharpest suspect is the extra radial haze gradients in `body.theme-custom.theme-custom-rasta::after`, because that layer already carries the weed silhouette and should not also read like a second smoke cloud.
   - Narrow implementation direction:
     - Safest next fix is likely to simplify the Rasta `::after` layer so it carries only the leaf silhouette support art, not extra haze clouds.
     - If that alone is insufficient in QA, the next narrow trim would be reducing Rasta track-backdrop opacity slightly.
      - `src/lib/db.ts` now supports lighter track hydration modes:
        - general catalog load: no media URLs, no blobs
        - visible playlist load: media URLs only, no blobs
        - active-track demand load: audio/art blobs only for the selected track
      - `src/App.tsx` `refreshTracks()` now loads lightweight catalog metadata for all tracks, then hydrates only the visible track set with media URLs.
      - `src/App.tsx` now hydrates `audioBlob` / `artBlob` only for the active track via an on-demand effect.
    - Exact files changed:
      - `src/lib/db.ts`
      - `src/App.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Where eager hydration was removed or deferred:
      - Removed from the general `refreshTracks() -> getAllTracksFromDb()` path for the whole library.
      - Deferred to:
        - visible-track URL hydration
        - active-track blob hydration only
    - Event/refresh fan-out changes:
      - None in this pass.
      - Redundant post-import refresh fan-out remains deferred because the primary release risk was full-library media hydration.
    - Why this was the safest release fix:
      - It directly targets the confirmed memory-risk seam without redesigning vault import, backup format, or playback architecture.
      - It preserves visible playlist behavior and current-track functionality while removing the worst all-library memory spike.
    - Intentionally deferred:
      - deduplicating post-import message/refresh fan-out
      - broader startup/import lifecycle cleanup
      - blob-store cleanup or backup redesign
    - Regression risk:
      - Low to moderate.
      - Main risk is any code that implicitly expected every track in the catalog to already carry `audioBlob`/`artBlob`.
      - This was contained by preserving on-demand hydration for the active track and keeping visible-track media URLs intact.
    - QA completed:
      - `npm run typecheck`
    - QA still needed:
      - Import a small vault and confirm no regression.
      - Import a heavier vault and confirm no flashing/reopen instability.
      - Force-close and reopen after heavy vault import and confirm app reopens normally.
      - Confirm playlists/tracks still appear after restore.
      - Confirm active-track playback still works.
      - Confirm waveform/crop/now-playing artwork still work when accessing the active track on demand.
      - Confirm admin iframe import and in-app vault import both still work.

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
  - Follow-up diagnosis for missing immediate zoom controls + explicit full zoom — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/WaveformLoop.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - The loop zoom toolbar is still gated behind `hasUnlockedManualZoom`, which is only set after handle dragging begins.
      - That means a fresh loop-edit session can still feel unreasonably zoomed or tight while hiding the very controls needed to escape that state.
      - The current toolbar also exposes `Fit` plus `+/-`, but there is still no explicit `Full` action that guarantees a full-track viewport reset in one press.
  - Narrow implementation plan:
      - Keep the pass inside `src/components/WaveformLoop.tsx` only.
      - Make loop zoom controls available immediately when loop edit mode opens.
      - Add a `Full` button that always resets the editor viewport to `{ start: 0, end: duration }`.
      - Do not redesign loop seed math, drag behavior, or broader player controls in this pass.
  - Exact fix made:
    - In `src/components/WaveformLoop.tsx`, the loop zoom toolbar is no longer hidden until after a handle drag. It now appears immediately whenever an active loop enters edit mode.
    - Added a `Full` button next to `Fit` that always resets the editor viewport to the full waveform range in one press.
    - Kept the pass narrow to loop-editor viewport controls only. No broader player-control or loop-seed redesign was added.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The pass only changes loop-toolbar availability and adds an explicit full-range viewport action.
  - QA still needed:
    - Confirm the loop toolbar now appears immediately on a fresh Set Loop/edit-loop entry.
    - Confirm `Full` always returns the waveform viewport to the entire track.
    - Confirm `Fit`, `+`, `-`, and handle dragging still behave normally after the toolbar is shown immediately.
    - Confirm the initial loop markers still feel reasonable when entering edit mode on both desktop and Safari.
  - Follow-up diagnosis for oversized default loop seed — 2026-04-05 Codex:
    - Files inspected:
      - `src/App.tsx`
      - `src/components/WaveformLoop.tsx`
      - `src/components/PlayerControls.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - The viewport controls are now available, but `setLoopFromCurrent()` in `src/App.tsx` is still seeding the loop from the current playhead almost all the way to the end of the track.
      - That makes the initial selected loop region visually huge and unreasonable, which reads like the same bug to the user even after zoom controls are fixed.
  - Narrow implementation plan:
      - Keep the pass surgical in `src/App.tsx`.
      - Change `Set Loop` so it seeds a tighter default region near the current playhead instead of extending nearly to track end.
      - Preserve existing edit-mode entry and broader loop editor behavior.
  - Exact fix made:
    - In `src/App.tsx`, `setLoopFromCurrent()` no longer seeds from the current playhead almost to the track end.
    - It now creates a tighter default loop window near the current playhead using a bounded target span, while still clamping safely near track end.
    - Kept the pass limited to initial loop seed sizing only. No broader loop editor or toolbar behavior was changed in this step.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This only changes the initial loop bounds created by `Set Loop`.
  - QA still needed:
    - Confirm a fresh `Set Loop` now creates a much more reasonable initial loop region.
    - Confirm `Set Loop` still behaves correctly near the end of a track.
    - Confirm the new default seed still works with `Fit`, `Full`, `+`, `-`, and handle dragging.
  - Follow-up diagnosis for `Full` not sticking — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/WaveformLoop.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - The `Full` button is setting the viewport to the full track, but the edit-session refocus effect is immediately treating that full-span range as "too wide" and rebuilding a tighter loop-centered range.
      - So `Full` is landing briefly, then getting overridden by the existing refocus heuristic.
  - Narrow implementation plan:
      - Keep the pass inside `src/components/WaveformLoop.tsx`.
      - Add an explicit full-range viewport mode so `Full` can persist without being auto-refocused back around the loop.
      - Leave `Fit`, drag, and default edit-entry behavior intact.
  - Exact fix made:
    - In `src/components/WaveformLoop.tsx`, `Full` now switches the editor into an explicit full-range viewport mode instead of reusing the generic manual mode.
    - The loop-edit refocus logic now respects that full-range mode and no longer immediately re-centers the viewport around the loop after `Full` is clicked.
    - Kept the pass narrow to viewport-mode handling only.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The change is localized to the loop editor’s viewport-mode state machine.
  - QA still needed:
    - Confirm `Full` now truly stays at the full waveform viewport after click.
    - Confirm `Fit` still re-centers around the loop correctly after using `Full`.
    - Confirm dragging a handle after `Full` still transitions back into normal edit behavior.
  - Follow-up diagnosis for `-` zoom-out stepping — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/WaveformLoop.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - The manual zoom model still uses discrete inward zoom levels only.
      - Once the user reaches the outermost manual level, pressing `-` jumps straight to full range instead of allowing a few wider intermediate zoom-out steps.
  - Narrow implementation plan:
      - Keep the pass inside `src/components/WaveformLoop.tsx`.
      - Let repeated `-` presses progressively expand the current viewport toward the full waveform.
      - Keep `Full` as the explicit one-press full reset.
  - Exact fix made:
    - In `src/components/WaveformLoop.tsx`, the `-` zoom-out control no longer jumps straight from the outer manual level to full range.
    - Repeated `-` presses now progressively widen the current viewport, and only snap to the full waveform when the expanded range is already close enough.
    - `Full` remains the explicit one-press full reset.
  - Exact files changed:
    - `src/components/WaveformLoop.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The change is localized to manual loop-editor zoom-out stepping.
  - QA still needed:
    - Confirm repeated `-` presses now widen the loop viewport in visible steps.
    - Confirm repeated `-` eventually reaches the full waveform.
    - Confirm `Full` still jumps straight to the full waveform immediately.
  - Follow-up diagnosis for auto-art gradient mismatch — 2026-04-05 Codex:
    - Files inspected:
      - `src/lib/artwork/waveformArtwork.ts`
      - `src/lib/waveformTheme.ts`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - The live waveform now uses the shared per-theme waveform palette, but auto-generated waveform artwork still renders bars with a separate artwork-specific bar gradient.
      - That leaves the auto art visually adjacent to, but not actually matching, the live waveform theme gradient.
  - Narrow implementation plan:
      - Keep the pass inside `src/lib/artwork/waveformArtwork.ts`.
      - Make generated waveform bars use the same shared per-theme gradient stops as the live waveform.
      - Leave the artwork background/glow treatment intact.
  - Exact fix made:
    - In `src/lib/artwork/waveformArtwork.ts`, auto-generated waveform artwork now uses the same shared per-theme waveform gradient stops as the live waveform renderer.
    - Kept the existing artwork background and glow treatment intact, so only the generated bar coloration changed.
  - Exact files changed:
    - `src/lib/artwork/waveformArtwork.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The pass is limited to generated waveform art coloring.
  - QA still needed:
    - Confirm auto-generated waveform art now matches the live waveform gradient for Merica, MX, Rasta, and default themes.
    - Confirm background/glow treatment still looks intentional and readable behind the recolored bars.
  - Follow-up diagnosis for auto-art waveform contrast — 2026-04-05 Codex:
    - Files inspected:
      - `src/lib/artwork/waveformArtwork.ts`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - The generated waveform bars now match the live theme gradients, but the auto-art background and vignette are still dark enough that the waveform does not separate as strongly as it should.
      - The current art has enough theme atmosphere, but not quite enough local contrast around the waveform.
  - Narrow implementation plan:
      - Keep the pass inside `src/lib/artwork/waveformArtwork.ts`.
      - Lighten the background/glow slightly and add a subtle local contrast lift behind the waveform band.
      - Do not redesign the auto-art composition.
  - Exact fix made:
    - In `src/lib/artwork/waveformArtwork.ts`, the generated auto-art now has a lighter central lift behind the waveform, a softer outer vignette, and a subtle shadow pass behind the bars.
    - Kept the overall composition intact while making the waveform read more clearly against the background.
  - Exact files changed:
    - `src/lib/artwork/waveformArtwork.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The pass is limited to generated waveform artwork contrast treatment.
  - QA still needed:
    - Confirm the waveform stands out more clearly in auto art across Merica, MX, Rasta, and default themes.
    - Confirm the background still feels premium and not washed out.
  - Follow-up diagnosis for preserve-origins admin toggle — 2026-04-05 Codex:
    - Files inspected:
      - `src/App.tsx`
      - `src/admin/AdminApp.tsx`
      - `src/lib/db.ts`
      - `src/lib/artwork/waveformArtwork.ts`
      - `src/lib/backup.ts`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - Theme-aware waveform recoloring exists, but there is no persisted app setting that decides whether theme-derived visuals should stay with their original theme or be regenerated when the user switches themes.
      - The app also lacked a small DB helper for re-generating stored auto artwork on theme change.
    - Narrow implementation plan:
      - Add one persisted admin/app toggle: `Tracks maintain theme and aura origins`, default ON.
      - When ON, theme switching preserves stored auto artwork and the current aura color.
      - When OFF, theme switching regenerates auto artwork for tracks whose artwork source is `auto` and updates the theme-derived aura color.
      - Keep the change surgical; do not redesign track metadata or the broader theme engine.
  - Exact fix made:
    - Added a persisted `Tracks maintain theme and aura origins` setting, defaulting to ON.
    - Added an admin checkbox for that setting in `src/admin/AdminApp.tsx`.
    - Updated `src/App.tsx` theme switching so OFF regenerates theme-derived auto artwork and updates aura color, while ON preserves them.
    - Added `regenerateAutoArtworkForThemeChangeInDb(...)` in `src/lib/db.ts` to re-render stored auto posters from the source audio using the target theme selection.
    - Extended `src/lib/artwork/waveformArtwork.ts` so generated waveform art can be rendered for an explicit theme selection.
    - Added the setting to config backup/import in `src/lib/backup.ts`.
  - Exact files changed:
    - `src/App.tsx`
    - `src/admin/AdminApp.tsx`
    - `src/lib/db.ts`
    - `src/lib/artwork/waveformArtwork.ts`
    - `src/lib/waveformTheme.ts`
    - `src/lib/backup.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Medium. The pass is still bounded, but it touches theme switching, admin settings, stored auto artwork regeneration, and config persistence.
  - QA still needed:
    - With the setting ON, switch themes and confirm existing auto artwork and aura color stay unchanged.
    - With the setting OFF, switch themes and confirm existing auto artwork regenerates and aura color updates to the new theme behavior.
    - Confirm Merica, MX, Rasta, and default themes all behave correctly.
    - Confirm the setting persists across reload and config backup/import.
  - Follow-up diagnosis for admin checkbox layout spacing — 2026-04-05 Codex:
    - Files inspected:
      - `src/admin/AdminApp.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely root cause:
      - The setting row was placed inside the same two-column settings grid used for label/value controls.
      - That layout pushed the checkbox card into the right column while leaving the left label column mostly empty, making the checkbox feel visually detached from its text.
  - Narrow implementation plan:
      - Keep the pass inside `src/admin/AdminApp.tsx`.
      - Render this setting as a single-column stacked setting block instead of forcing it through the two-column label/value grid.
  - Exact fix made:
    - In `src/admin/AdminApp.tsx`, the setting was moved out of the two-column label/value layout and into a stacked single-column block.
    - The setting card now uses an explicit two-column mini-grid for checkbox + copy, with a constrained full-width container and `minmax(0,1fr)` text column so the explanatory text cannot collapse into a thin far-right strip.
    - Kept the pass layout-only. Setting behavior was not changed.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is a layout-only admin UI adjustment.
  - QA still needed:
    - Confirm the checkbox and text now read as one setting block on desktop and mobile widths.

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
  - Follow-up diagnosis for PNG leaf swap + stronger Rasta field — 2026-04-05 Codex:
    - Files inspected:
      - `gfxdesign/rastaweed.png`
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Likely root cause:
      - The SVG correction still leaves room for silhouette drift, while the actual provided PNG already has the exact reference geometry the user wants.
      - The Rasta field itself is currently more smoke/neutral-brown forward than color-forward, so the green/yellow/red read is less unmistakable than MX.
  - Narrow implementation plan:
    - Replace the current SVG leaf layer in the Rasta background with the provided PNG as a subtle static image layer.
    - Slightly strengthen the Rasta tricolor atmosphere in `styles.css` only, without widening into FX or broader theme redesign.
  - Exact follow-up fix made:
    - Copied the provided reference PNG into `public/rastaweed.png` and switched the Rasta background leaf layer in `styles.css` from the SVG assets to two subtle static PNG instances.
    - Tightened the Rasta background atmosphere so the green/yellow/red field reads more unmistakably, with slightly stronger tricolor radial color presence and less gray/neutral smoke dominance.
    - Kept the pass narrow to the Rasta background asset source and background color field only.
  - Exact files changed:
    - `public/rastaweed.png`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This remains a static background-layer swap plus a local Rasta-only color-balance adjustment.
  - QA still needed:
    - Confirm the Rasta leaf now uses the actual provided PNG silhouette.
    - Confirm the PNG reads subtle and integrated, not pasted on.
    - Confirm the Rasta tricolor field now reads more unmistakably like the MX theme does.
    - Confirm background performance remains unchanged.

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
  - Follow-up diagnosis for pre-play waveform readiness — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/WaveformLoop.tsx`
      - `src/components/FullscreenPlayer.tsx`
      - `src/lib/artwork/waveformArtwork.ts`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Likely root cause:
      - The waveform components still initialize local peak state from `fallbackPeaks(...)`, so users briefly see fake undeveloped bars before real peaks land.
      - Real peaks are resolved asynchronously from `track.waveformPeaks` or `buildPeaksFromAudioBlob(...)`, but that happens after the first paint.
      - The desired behavior is not “fully themed before play”; it is “waveform shape visible before play,” even if the base state is neutral/dark and playback adds the reveal.
    - Narrow implementation plan:
      - Keep the pass inside waveform readiness only.
      - Add a small runtime waveform peak cache keyed by track id.
      - Prefer stored peaks or cached peaks immediately on mount/track change.
      - When an audio-backed waveform is still loading, render the neutral/base waveform state instead of fake fallback bars.
  - Exact follow-up fix made for pre-play waveform readiness — 2026-04-05 Codex:
    - Added a small runtime waveform peak cache in `src/lib/artwork/waveformArtwork.ts` so previously resolved peaks can render immediately on revisit instead of waiting for a fresh decode.
    - Updated `src/components/WaveformLoop.tsx` to prefer stored/cached peaks on first render and otherwise show a subdued neutral placeholder waveform before real audio-backed peaks finish resolving.
    - Guarded `WaveformLoop` against the zero-peaks giant-block state by skipping draw when no peaks exist instead of forcing a single full-width bar.
    - Updated `src/components/FullscreenPlayer.tsx` to use the same stored/cached peak preference and to render a neutral grey decorative waveform while real peaks are still resolving, so the auto-art area no longer feels blank or undeveloped before playback.
    - Kept the pass narrow to waveform readiness/rendering only. No playback, theme engine, or loop behavior was changed.
  - Exact files changed for the follow-up:
    - `src/components/WaveformLoop.tsx`
    - `src/components/FullscreenPlayer.tsx`
    - `src/lib/artwork/waveformArtwork.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is limited to pre-play waveform rendering state and peak reuse.
  - QA still needed:
    - Confirm the waveform is visible before first play instead of feeling blank or undeveloped.
    - Confirm unresolved pre-play state reads as neutral/grey rather than a giant solid block.
    - Confirm real peaks replace the neutral placeholder once available.
    - Confirm theme-aware waveform colors still appear correctly after peaks resolve.

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

  - Diagnosis note — 2026-04-06 Codex:
    - Files inspected:
      - `src/index.css`
      - `styles.css`
    - Likely root cause:
      - The welcome card heading keeps stretching because the line-height/letter-spacing combo plus wide padding make the block too tall, and the guided-cta gradients feel heavy for such a simple call-to-action.
      - The CTA’s decorative double-gradient lines create visual imbalance that makes the card appear off-center.
    - Implementation plan:
      - Harmonize the heading/body typography so the intro text stays compact, center the CTA, and simplify its gradient so the whole card reads calmer without touching logic.

  - Follow-up diagnosis — 2026-04-06 Codex:
    - Files inspected:
      - `src/components/EmptyLibraryWelcome.tsx`
      - `src/index.css`
      - `styles.css`
    - Likely root cause:
      - The welcome card’s heavy gradients, vibrant glow, and tight typography feel too dominant on iPhone, leaving just a sliver of player space and forcing the title to wrap.
      - The onboarding player also shows the default compact layout, which still feels visually dense while the user is on the welcome card.
    - Narrow implementation plan:
      - Dial down the welcome card’s background to a simpler surface, shrink the skull motifs, and soften the glow so it reads like a minimal callout.
      - Reduce the title’s weight/size so “Hey new person! Welcome to PolyPlay.” sits on a single line even on narrow screens.
      - Tighten spacing/padding on mobile and keep the player compact without extra chrome while the welcome card is visible.
      - Re-test mobile onboarding after these visual tweaks and ensure the welcome card no longer obstructs the viewport.
  - Exact fix made:
    - Simplified `EmptyLibraryWelcome`’s surface to a dark translucent fill with a subtle dual gradient, softer border, and lighter shadow so the card still feels polished without overwhelming the viewport.
    - Tuned the title/body typography to slightly larger clamps and heavier weight so “Hey new person! Welcome to PolyPlay.” stays on one line while still feeling bold, and treated the body copy with lighter color for better contrast.
    - Trimmed CTA padding/margins so the welcome card leaves room for the player on narrow screens while the close button and guided actions remain accessible.
  - Selectors touched:
    - `.empty-library-card` (background, padding, shadow)
    - `.empty-library-card__title` (line height, weight, max-width)
    - `.empty-library-card__actions` (justified center)
    - `.empty-library-card__primary` (simplified background, border, shadow)
  - Exact files changed:
    - `src/components/EmptyLibraryWelcome.tsx`
    - `src/index.css`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. These are visual tweaks to the onboarding card presentation.
  - QA still needed:
    - Play through the onboarding flow on iPhone and confirm the welcome title sits on one line, the card no longer feels overwhelming, and the action CTA stays visible without additional scrolling.
    - Ensure the thinner styling still looks intentional on desktop.

---

### 13. Support page logo polish + systems findings doc
**Status:** open

**Desired behavior:**
- support page should use the simpler original PolyPlay logo treatment, not a theme-highlighted/glowing hero treatment
- current release-batch findings should be documented in one clean summary doc

**Important:**
- keep the support-page pass visual-only and narrow
- documentation should summarize systems changed, current behavior, and QA still needed

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `public/support.html`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The support page is still using the hero logo asset plus glow/shimmer treatment, which makes the page feel theme-styled instead of neutral support-facing branding.
    - Findings from the current release-safe batch are spread across the active release task board and ad-hoc handoffs rather than one concise system summary.
  - Narrow implementation plan:
    - Keep the support-page change inside `public/support.html`.
    - Replace the logo treatment with a simpler original-logo presentation and remove the extra highlight effects.
    - Add one summary doc under `docs/` covering the systems changed in this batch and the remaining QA focus.
  - Exact fix made:
    - In `public/support.html`, replaced the glowing theme-treated hero wordmark presentation with a simpler original-logo treatment and removed the extra highlight/shimmer styling.
    - Added `/Users/paulfisher/Polyplay/docs/polyplay_release_systems_findings_2026-04-05.md` to summarize the main systems changed in this release-safe batch, their intended behavior, and the remaining QA priorities.
  - Exact files changed:
    - `public/support.html`
    - `docs/polyplay_release_systems_findings_2026-04-05.md`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This pass is limited to support-page visual treatment and documentation.
  - QA still needed:
    - Confirm the support page now uses the simpler logo treatment cleanly on desktop and mobile.
    - Confirm the systems findings doc reflects the current batch accurately.
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
  - Follow-up diagnosis for live player title selection — 2026-04-05 Codex:
    - Files inspected:
      - `src/components/player.css`
      - `src/components/MiniPlayerBar.tsx`
      - `src/components/FullscreenPlayer.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The mini player title was explicitly restored to `user-select: text` for pointer-fine environments.
      - In practice, that creates conflict with fast player gestures and FX interactions because drag/tap movement near the active title can begin text selection instead of staying purely interactive.
      - The same tradeoff is not worth carrying in the live player for release; explicit copy affordances can be added later in Admin or another non-transport surface.
  - Narrow implementation plan:
    - Remove live-player title selection behavior from the mini player.
    - Keep fullscreen player metadata non-selectable as well so the active playback surfaces remain gesture-safe and consistent.
    - Do not add a new copy button in the playbar for this release.
  - Exact follow-up fix made:
    - Removed the mini-player title `user-select: text` behavior that had been restored for pointer-fine environments.
    - Marked mini-player title/subtitle and fullscreen player metadata as non-selectable so the active playback surfaces stay tap/drag safe.
    - Deliberately did not add a new copy affordance in the playbar for this release pass.
  - Exact files changed:
    - `src/components/player.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This only removes live-player text selection and does not touch editable/admin surfaces.
  - QA still needed:
    - Confirm dragging/tapping around the active player title no longer starts text selection.
    - Confirm fullscreen player metadata also no longer highlights accidentally.
    - Confirm Admin/manage surfaces still allow rename/copy workflows where expected.

---

### 18. iPhone import-page flashing + Merica idle waveform visibility
**Status:** fix implemented, awaiting QA

**Observed issue:**
- on iPhone, pressing `Import` can flash the settings/import page instead of keeping it open reliably
- after successful import, the main UI can appear to refresh multiple times
- Merica waveform can look nearly invisible until playback progress paints it

**Desired behavior:**
- import page should open and stay open reliably on iPhone
- successful import should trigger one clean parent refresh/close path, not stacked refresh flashes
- Merica waveform should remain visible before playback progress reaches it

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/admin/AdminApp.tsx`
    - `src/lib/waveformTheme.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The admin header has a swipe-to-dismiss gesture with a low velocity threshold. On iPhone, a normal tap/finger drift during the iframe transition can plausibly register as a dismiss gesture and immediately close the page.
    - Track import success in upload mode currently posts overlapping parent messages (`user-imported`, `library-updated`, then `import-complete`), which can stack multiple `refreshTracks()` passes and look like UI flashing on slower devices.
    - Merica idle waveform bars are using a lighter, lower-alpha idle fill than the darker themes, so the unplayed portion can wash out against the Merica player shell until the progress gradient paints over it.
  - Narrow implementation plan:
    - Keep swipe-dismiss out of the upload/import route so opening Import is stable on iPhone.
    - Collapse upload success messaging to one parent refresh/close path when the page is supposed to close, while preserving the keep-import-open path.
    - Increase only the Merica idle waveform visibility without changing the shared progress gradient behavior.
  - Exact fix made:
    - Disabled the settings-header swipe-dismiss path while the admin page is in `upload` mode, and tightened the velocity-based close rule for the remaining manage-mode swipe so a short tap drift is less likely to count as a dismissal.
    - Collapsed upload-mode success messaging so closing the import page uses one parent close/refresh path instead of stacking `user-imported` + `library-updated` + `import-complete` on the same successful track import.
    - Increased Merica idle waveform contrast by making its unplayed bars more opaque and slightly less washed toward white.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `src/lib/waveformTheme.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to medium. The import-page change is limited to upload-mode dismiss behavior and upload success messaging only. The waveform change is Merica-only.
  - QA still needed:
    - On iPhone, tap `Import` repeatedly and confirm the page stays open instead of flashing closed.
    - Import a track into a newly created playlist and confirm the app returns cleanly without visible repeated refresh pulses.
    - Repeat the same flow after a factory reset if you want to stress the original repro path.
    - In Merica, confirm the idle waveform is visible before the playhead reaches it and still looks clean once progress paints over it.
  - Follow-up diagnosis for import/settings white flash — 2026-04-05 Codex:
    - Files inspected:
      - `admin.html`
      - `styles.css`
      - `src/index.css`
      - `src/App.tsx`
      - `src/admin/AdminApp.tsx`
    - Likely root cause:
      - The settings/import surface lives in an iframe document (`admin.html`) that only links `styles.css` before React boots.
      - `styles.css` defaults `:root` to the light palette, while the admin-specific dark surface and theme sync are only applied later by `src/admin-main.tsx` and `AdminApp` effects.
      - On mobile Safari and iPhone app transitions, that creates a first-paint window where the iframe can briefly show the light default background before the saved theme classes/data attributes are applied.
  - Narrow implementation plan:
      - Keep this pass limited to first-paint stability.
      - Prime `admin.html` with the saved theme before stylesheet/app mount and give the iframe document an explicit fallback background so the overlay never reveals the light default during open.
  - Exact fix made for white flash follow-up:
    - Added a pre-mount theme bootstrap in `admin.html` that reads the saved theme from localStorage and applies `data-theme` / `data-theme-slot` before the admin stylesheet and React app paint.
    - Added inline first-paint background rules for the iframe document (`html`, `body`, `#admin-root`) so the settings/import iframe opens on a stable dark/custom/light backdrop immediately instead of briefly showing the light default.
  - Exact files changed for white flash follow-up:
    - `admin.html`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk for white flash follow-up:
    - Low. This only affects initial iframe document paint and uses the same saved theme keys the app already owns.
  - Remaining QA for white flash follow-up:
    - On mobile Safari and in the iPhone app, open `Import` and `Settings` repeatedly and confirm there is no white/light flash before the overlay content appears.
    - Repeat the same check after switching between dark, light, and custom themes to confirm the first-paint backdrop matches the saved theme.

---

### 19. Rename-before-nuke playlist flow
**Status:** fix implemented, awaiting QA

**Observed issue:**
- `Nuke Playlist` cleared the active playlist immediately after the arm/confirm flow
- there was no chance to name the replacement empty playlist before the clear happened

**Desired behavior:**
- before the nuke countdown completes, show a text field seeded with the current playlist name
- when the user confirms, the active playlist should first take that name, then be cleared
- after the nuke, the new empty playlist should be titled whatever the user entered

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/admin/AdminApp.tsx`
    - `src/lib/db.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The current nuke path only arms a countdown and then runs `clearPlaylistInDb(activePlaylist.id)`.
    - The playlist object itself survives the clear, which means the cleanest fix is to rename that active playlist first and then clear it, rather than introducing a new replacement-playlist architecture.
  - Narrow implementation plan:
    - Seed a playlist-name field when the nuke modal opens.
    - Require a non-empty name in the nuke modal.
    - On confirm, rename the active playlist if needed, then run the existing clear flow.
  - Exact fix made:
    - Added a rename field to the existing `Nuke Playlist` modal, prefilled with the current active playlist name.
    - The destructive confirm action is disabled if the rename field is blank.
    - On confirm, the active playlist is renamed first if needed, then cleared using the existing `clearPlaylistInDb(...)` path.
    - Updated the completion status text so it reflects the resulting empty playlist name.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This stays inside the existing nuke modal and reuses the current rename + clear helpers.
  - QA still needed:
    - Open `Nuke Playlist` and confirm the text field is prefilled with the current playlist name.
    - Change the name, complete the nuke flow, and confirm the resulting empty playlist keeps the new name.
    - Leave the default name unchanged and confirm the old behavior still works, now with the explicit prompt.
    - Confirm blank name blocks the destructive confirm button.
  - Follow-up diagnosis for nuke sequence order — 2026-04-05 Codex:
    - Files inspected:
      - `src/admin/AdminApp.tsx`
      - `src/App.tsx`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The first pass put the rename field inside the already-armed countdown modal, which is the wrong sequence.
      - On successful playlist clear, Admin was only refreshing its own data and emitting a generic library update. It was not posting the dedicated nuke success signal the parent app already knows how to animate, and it was not closing Settings afterward.
    - Narrow implementation plan:
      - Split playlist nuke into two steps:
        - rename prompt modal first
        - countdown/armed modal second
      - If rename is canceled, abort the whole sequence.
      - On successful nuke, post `polyplay:nuke-success` and `polyplay:close-settings` so the parent app returns to the main player and runs the existing nuke animation.
  - Exact follow-up fix made:
    - Split the playlist nuke flow into two modals:
      - rename confirmation first
      - countdown/armed state second
    - Cancel at the rename step now aborts the entire sequence.
    - Successful playlist nuke now posts `polyplay:nuke-success` and `polyplay:close-settings` to the parent app so the existing main-player nuke animation can run and Settings closes afterward.
    - The countdown modal now treats the playlist name as already locked in, instead of editing it mid-arm.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low to medium. The change stays inside the existing nuke UI flow and reuses the same clear helper, but it does alter the sequence and adds parent-app signaling.
  - QA still needed:
    - Press `Nuke Playlist` and confirm the rename prompt appears first with the current playlist name.
    - Press `Cancel` from the rename prompt and confirm the whole sequence is aborted.
    - Press `OK`, confirm the countdown starts only after that, then complete the nuke and confirm Settings closes and the main player shows the nuke animation/return flow.
    - After the nuke, confirm the empty playlist has the chosen name and import works normally.
  - Follow-up fix for accidental outside-close:
    - Removed backdrop-click dismissal from the rename-first nuke prompt.
    - The rename modal should now exit only through `Escape`, `Cancel`, or `OK`.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Follow-up diagnosis for demo-playlist nuke regression:
    - Files inspected:
      - `src/admin/AdminApp.tsx`
      - `src/App.tsx`
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - Playlist nuke success was posting `polyplay:nuke-success`, but the parent app was treating that like the full app-data nuke path and calling `hardResetLibraryInDb()` after the shake animation.
      - That is the wrong behavior for playlist clear. It can briefly show stale art, then wipe/reseed state, and it can also destroy the intended renamed empty playlist result, especially around the demo playlist.
  - Narrow implementation plan:
      - Split playlist-nuke visuals from full app-data nuke behavior.
      - On playlist-nuke success, immediately blank the main player UI, run the green flash/shake animation, then refresh from DB without wiping storage.
      - Keep the full hard-reset nuke path only for actual app-data reset use cases.
  - Exact follow-up fix made:
    - Split `polyplay:nuke-success` away from the full app-data nuke path in the parent app.
    - Added a playlist-nuke visual sequence that immediately blanks tracks/player state, runs the shake animation plus a bright green flash overlay, then refreshes from DB without calling `hardResetLibraryInDb()`.
    - Kept the full hard-reset nuke sequence intact for actual app-data wipe scenarios only.
  - Exact files changed:
    - `src/App.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Medium. The change is still surgical, but it alters the parent-side destructive animation flow.
  - QA still needed:
    - Nuke the demo playlist and confirm the UI blanks immediately instead of briefly showing old art.
    - Confirm the bright green flash/shake plays and then the app returns to the main player cleanly.
    - Confirm the renamed empty playlist name survives after the nuke, including for the former demo playlist.
    - Confirm importing into the renamed empty playlist works normally afterward.

---

### 20. MX skull background motif
**Status:** fix implemented, awaiting QA

**Observed request:**
- replace the generic MX skull motif with the user-provided sombrero skull concept
- keep it as white lines over transparent so it can sit cleanly in the MX background

**Desired behavior:**
- MX theme background uses a transparent white-line skull motif
- no solid background box, just line art
- keep the change cosmetic and scoped to the MX theme background layer only

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause / current state:
    - The MX theme currently uses an inline SVG skull motif embedded directly in CSS `body.theme-custom.theme-custom-mx::after`.
    - For the new art direction, a dedicated transparent SVG asset is cleaner than trying to force a raster cleanup pipeline during a release pass.
  - Narrow implementation plan:
    - Create a standalone transparent white-stroke SVG motif for MX.
    - Swap the inline CSS data-URI motif to the new asset.
    - Keep positions/sizing/animation structure intact unless tiny tuning is needed after visual QA.
  - Exact fix made:
    - Added a dedicated transparent white-line SVG skull-with-sombrero motif for MX.
    - Replaced the old inline MX skull data-URI backgrounds with the new asset.
    - Slightly increased the motif sizing and adjusted positions so the new art reads as a background element rather than a tiny badge.
  - Exact files changed:
    - `public/mx-skull-sombrero-lines.svg`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is cosmetic and scoped to the MX theme background pseudo-element only.
  - QA still needed:
    - Switch to MX theme and confirm the skull reads as white lines over transparent with no dark box/background.
    - Confirm the scale feels intentional on both phone and desktop.
    - Confirm the motif does not overpower the topbar, track tiles, or player chrome.
  - Follow-up diagnosis for real user asset:
    - Files inspected:
      - `gfxdesign/dayofdead.png`
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The current MX motif is still using the temporary placeholder line asset instead of the user-provided skull artwork.
      - The provided PNG already matches the intended treatment closely enough to use directly as the themed background element.
  - Narrow implementation plan:
      - Copy the provided skull PNG into `public/`.
      - Repoint the MX theme background to the new raster asset.
      - Keep the same background-layer structure and only retune sizing/position if needed.
  - Exact follow-up fix made:
    - Copied the user-provided `dayofdead.png` into `public/` as the MX background asset.
    - Swapped the MX theme motif from the temporary placeholder asset to the real PNG.
    - Tuned MX motif size/position slightly for the new raster proportions.
  - Exact files changed:
    - `public/mx-dayofdead-lines.png`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This remains cosmetic and scoped to the MX background pseudo-element only.
  - QA still needed:
    - Switch to MX theme and confirm the provided skull art appears instead of the placeholder.
    - Confirm the linework reads cleanly and does not show a visible rectangular box.
    - Confirm sizing/placement feels right on phone and desktop.
  - Follow-up diagnosis for motion density:
    - Files inspected:
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The current MX motif field only uses 2 skull background layers and a gentle transform on the whole pseudo-element.
      - That makes the art feel pinned near the top instead of drifting around the screen as a repeating atmospheric motif field.
  - Narrow implementation plan:
      - Increase the MX skull motif count to 6 layered backgrounds.
      - Animate the background-position values directly so the field drifts across the screen over time.
      - Keep opacity subtle so the extra density does not overpower the UI.
  - Exact follow-up fix made:
    - Expanded the MX motif field to 6 skull background layers instead of the sparse 2-layer setup.
    - Matched the MX keyframes to all motif/background layers so the skull field actually drifts around the screen.
    - Kept the opacity subtle while increasing density and travel distance.
  - Exact files changed:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is cosmetic and scoped to MX theme background motion only.
  - QA still needed:
    - Switch to MX and confirm multiple skulls are visible across the screen, not stuck at the top.
    - Confirm the drift feels subtle and atmospheric rather than busy.
    - Confirm the increased motif count still does not overpower the UI on phone or desktop.
  - Follow-up diagnosis for speed/angle:
    - Files inspected:
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The first motion pass increased MX field density and travel distance, but the combined effect still reads too fast.
      - CSS background layers do not support independent arbitrary rotation transforms per layer, so the current whole-layer transform is too blunt for the desired look.
  - Narrow implementation plan:
      - Slow the MX animation down significantly.
      - Reduce whole-layer rotation amplitude.
      - Add more visual angle variety with mirrored background instances and varied proportions rather than aggressive shared rotation.
  - Exact follow-up fix made:
    - Slowed the MX motif animation from 38s to 68s.
    - Reduced whole-layer rotation/translation amplitude so the field feels calmer.
    - Added more angle variety by mirroring alternating skull background instances instead of pushing more shared rotation.
  - Exact files changed:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is still cosmetic and scoped to MX background motion only.
  - QA still needed:
    - Confirm the skull field now feels slower and less busy.
    - Confirm mirrored/varied instances feel more natural than the previous uniform angles.
    - Confirm the field still reads as background atmosphere rather than static decoration.
  - Follow-up diagnosis for size/crowding:
    - Files inspected:
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The expanded MX field is still using too many large skull instances for the current screen real estate, so the motifs overlap and read as a crowded wallpaper rather than subtle atmosphere.
      - Independent per-skull CSS rotation is not practical in the current single pseudo-element background stack, so pushing harder on shared rotation would make the whole field feel glitchier rather than better.
    - Narrow implementation plan:
      - Reduce the active skull count.
      - Shrink each instance.
      - Increase spacing and slow the drift further so the field stays barely noticeable.
    - Exact follow-up fix made:
      - Reduced the MX skull field from 6 skull layers to 4.
      - Shrunk the skull instances and spread them farther apart.
      - Lowered opacity and slowed the drift from `68s` to `88s`, while reducing shared transform amplitude again.
    - Exact files changed:
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Regression risk:
      - Low. This remains cosmetic and scoped to the MX background motif only.
    - QA still needed:
      - Confirm the skulls no longer feel oversized or crowded.
      - Confirm the drift is now barely noticeable.
    - Confirm the MX motif still reads as themed background atmosphere without pulling focus from the UI.
  - Follow-up diagnosis for subtle motif texture (2026-04-06 Codex):
    - Files inspected:
      - `styles.css`
      - `docs/polyplay_release_tasks_2026-04-05.md`
    - Exact likely cause:
      - The MX skulls have been reduced too far, leaving just a tiny motif that the UX owner says looks worse than before.
      - The Rasta field should stay minimal but still show a single highlight leaf so the theme identity remains legible.
    - Narrow implementation plan:
      - Bring the MX motif back up to two or three larger skulls with mild drift and maintain the gentle animation so they sit as visible background pieces without overwhelming the UI.
      - Keep the Rasta layer as a single highlighted leaf with a slow 90s drift so it remains a quiet accent instead of a busy field.
  - Exact fix made for subtle motif texture:
    - `styles.css` now renders three larger MX skull instances (two mirrored, one center) with moderate opacity and a modest drifting pattern so they read as intentional background art.
    - The Rasta layer was reduced to a single prominent leaf with slow `rasta-leaf-float` background shifts, keeping opacity moderate so it stays subtle yet identifiable.
    - Both pseudo-elements avoid translate/rotate transforms so only the background-position drifts, keeping the motifs calm.
  - Exact files changed for subtle motif texture:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. These changes re-tune the existing background layers without touching playback or layout code.
  - QA still needed:
    - Switch to MX and confirm the skull field now shows a couple of larger logos in the background without overwhelming the UI.
    - Switch to Rasta and confirm the single leaf feels like a slow drifting accent.
    - Verify both motifs still behave as background textures on phones and desktop.

---

### 22. Rasta drifting leaf field
**Status:** fix implemented, awaiting QA

**Observed request:**
- keep Rasta’s leaf field subtle but still legible, without turning it into a dense wallpaper

**Desired behavior:**
- Rasta theme shows a single elegant leaf accent with very slow motion so the theme identity remains but the UI stays clean
- motion remains subtle and background-level
- keep the smoke layer separate

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - Previous passes kept reintroducing more and more leaves, but the overall UI still needed only a single subtle accent to evoke the Rasta energy.
  - Narrow implementation plan:
    - Reduce the Rasta layer to a single larger leaf plus tiny glow so the motif remains visible but never feels busy.
    - Keep the `rasta-leaf-float` animation ultra-slow (90s) and rely on background-position shifts rather than big transforms.
  - Exact fix made:
    - `styles.css` now renders a single much larger `rastaweed.png` leaf, centered behind the hero bar, using 0.16 opacity and 260x280 sizing so it stays visible while still subtle.
    - The smoke layer remains untouched so the leaf stands out as a calm accent.
  - Exact files changed:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The change just trims the motif to a single accent.
  - QA still needed:
    - Switch to Rasta and confirm a single leaf drifts very slowly without causing layout noise.
    - Confirm the motion feels background-level on both phone and desktop.
    - Regression risk:
      - Low. This remains cosmetic and limited to the Rasta motif field.
    - QA still needed:
      - Switch to Rasta and confirm the leaves now drift more slowly.
      - Confirm the leaf field feels calmer and less synchronized.
      - Confirm the varied leaf instances read like different angles instead of identical copies.

---

### 23. Hero bar theme-switch white flash
**Status:** fix implemented, awaiting QA

**Observed issue:**
- during theme cycling, the hero/topbar can briefly show a white offset rectangle flash

**Desired behavior:**
- theme switch should feel clean
- no pale rectangular repaint/glitch around the hero bar

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `styles.css`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - The `.topbar::after` halo layer extends outside the rounded card with `inset: -16px` and includes pale white side glows.
    - The topbar container itself allows overflow, so during rapid theme repaint the halo can briefly show as a misaligned light rectangle.
  - Narrow implementation plan:
    - Clip the hero bar to its rounded bounds.
    - Pull the `::after` glow layer back inside the card.
    - Reduce the pale white edge contribution while preserving the soft hero glow.
  - Exact fix made:
    - Changed the topbar container to clip overflow to the rounded card.
    - Pulled the `::after` hero glow layer back inside the card bounds by using `inset: 0` and `border-radius: inherit`.
    - Reduced the pale white side-glow intensity to remove the rectangular flash feel during theme repaint.
  - Exact files changed:
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. This is scoped to the topbar visual halo only.
  - QA still needed:
    - Cycle themes repeatedly and confirm the hero bar no longer shows a white offset rectangle flash.
    - Confirm the hero still keeps its soft glow and doesn’t look too flat after clipping.

---

### 24. Import-brick regression
**Status:** diagnosis in progress

**Observed issue:**
- importing a long MP3 can hang on the importing toast before finally closing, then the main playlist quickly flashes and the app feels frozen/bricked thereafter
- after a post-nuke import the overlay flashes and the import button stays unresponsive until the entire app is refreshed manually

**Desired behavior:**
- a long-file import completes without extra toast hang or parent reflows, and the app stays ready for another import immediately afterward
- repeated import success flows do not double-refresh the playlist or trigger duplicate overlay closes

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/admin/AdminApp.tsx`
  - Likely root cause:
    - `notifyUserImported()` currently posts both `polyplay:user-imported` and `polyplay:library-updated` to the parent before the closing `polyplay:import-complete` message arrives.
    - The parent therefore runs `refreshTracks()` multiple times in quick succession while also flipping `overlayPage` state, which chokes the mobile renderer during heavy waveform/artwork generation and looks like a flash/brick.
    - This duplicated messaging especially hurts long imports (rare but heavy), and repeating the refresh stream after the closing `import-complete` makes the UI feel locked up.
  - Narrow implementation plan:
    - Keep the import-close path the same but stop spamming both `library-updated` and `user-imported` for the same event cycle.
    - Adjust `notifyUserImported()` so it only emits `polyplay:user-imported` when invoked.
    - Preserve other callers that still need `polyplay:library-updated` where appropriate.
    - Re-test a long MP3 import to see if the toast/responsive path is smooth after removing the duplicate refresh.
  - Exact fix made:
    - `notifyUserImported()` now only posts `polyplay:user-imported`, so the parent sees one refresh/overlay-close event instead of a duplicate `library-updated` ping.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. We merely stopped sending an extra `postMessage`; other workflows already emit `polyplay:library-updated` when needed.
  - QA still needed:
    - Import a very long MP3 on mobile Safari and confirm the import notice clears cleanly, the overlay closes once, and the main playlist stays responsive.
    - After nuking a playlist, import again and confirm the overlay no longer flashes multiple times, and `Import` is immediately usable.

### 25. Waveform + Aura responsiveness
**Status:** fix implemented, awaiting QA

**Observed issue:**
- long MP3 imports delay the waveform render by ~15 seconds (the bars draw slowly while the import toast is still visible).
- the Aura+ tile flashes/animation also feels delayed after import, likely because the CPU is pegged while waveform peaks decode.

**Desired behavior:**
- waveform bars rely on cached peak data and appear quickly after import or when switching tracks, even if the audio decode is currently happening in parallel.
- Aura+ (and other waveform-driven decor) consistently shows without lag once the wearer opens the player.

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/lib/artwork/waveformArtwork.ts`
    - `src/components/WaveformLoop.tsx`
    - `src/components/FullscreenPlayer.tsx`
  - Likely root cause:
    - Both the waveform loop and fullscreen renderers decode the same audio blob from scratch via `buildPeaksFromAudioBlob(...)` before they can show peaks, so long files block the renderer while that heavy work runs.
    - The decoded peaks are not persisted, so every render resets to the fallback and re-decodes instead of reusing previous results. That keeps the CPU pegged and delays Aura+ flashes tied to the waveform readiness.
    - Import-time auto-art generation already decodes the audio to build peaks, so we can reuse those peak arrays if we persist them somewhere shared before the main UI renders.
  - Narrow implementation plan:
    - Add a lightweight persistent peak cache that stores numeric arrays keyed by track id in `localStorage`.
    - Have `generateWaveformArtwork(...)` store its decoded peaks whenever it runs for a particular track id, and expose helpers to load them for the renderers.
    - Update both `WaveformLoop.tsx` and `FullscreenPlayer.tsx` to prefer the persisted peaks before kicking off `buildPeaksFromAudioBlob(...)`, and store new peaks once they resolve.
    - The goal is to avoid redecoding long audio blobs on the main player and to allow the waveform to render using cached data almost immediately after import, which should also smooth the Aura+ experience.
  - Exact fix made:
    - Added a persisted waveform peak cache plus helpers in `src/lib/artwork/waveformArtwork.ts` so peaks can survive across reloads and be shared between import-time auto-art generation and the main UI.
    - `generateWaveformArtwork(...)` now stores its decoded peaks for the current track, while `WaveformLoop.tsx` and `FullscreenPlayer.tsx` first load the cached peaks, then persist new ones after `buildPeaksFromAudioBlob(...)` runs, minimizing redundant decodes.
    - As a result, both renderers prefer the cached values immediately after import and the Aura+ timing tied to waveform readiness no longer waits on repeated decoding.
  - Exact files changed:
    - `src/lib/artwork/waveformArtwork.ts`
    - `src/components/WaveformLoop.tsx`
    - `src/components/FullscreenPlayer.tsx`
    - `src/lib/db.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Regression risk:
    - Low. The change only adds caching around existing waveform peak data; existing art generation and fetch logic stays intact.
  - QA still needed:
    - Import a long MP3 on mobile Safari/iPhone and confirm the waveform bars appear promptly and the Aura+ tile no longer stutters when the track debut plays.
    - Switch between tracks and confirm previously decoded peaks render instantly instead of waiting for a new decode.




### 21. Post-reset auto-art theme drift + post-nuke import stability
**Status:** fix implemented, awaiting QA

**Observed issue:**
- after factory reset, importing in default dark can still generate the old pink/light auto art until the user cycles themes
- user also reported a post-nuke import path that felt bricked / unstable

**Desired behavior:**
- auto-generated artwork should always match the actual saved active theme immediately after reset/import
- nukeing a playlist should not leave import flows in a stale or broken state

**Codex notes:**
- Diagnosis start — 2026-04-05 Codex:
  - Files inspected:
    - `src/lib/db.ts`
    - `src/lib/artwork/waveformArtwork.ts`
    - `src/lib/themeConfig.ts`
    - `src/admin/AdminApp.tsx`
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Likely root cause:
    - DB-side auto-art generation still calls `generateWaveformArtwork(...)` without an explicit `themeSelection`, which falls back to live DOM/theme state.
    - After factory reset, Admin updates localStorage to dark but can still have stale live theme DOM/state in the current page, so imports can inherit the old visual palette until the user cycles themes.
    - The post-nuke import report is likely the same family of stale-state instability around empty playlist/import transitions, so the first safe fix is to remove theme-state ambiguity from import-time artwork generation.
  - Narrow implementation plan:
    - Resolve theme selection for DB-side auto artwork from saved theme storage, not current DOM.
    - Use that stored theme selection for import-time and fallback waveform art generation in the DB layer.
    - Keep the change surgical and re-test nuke -> import and factory reset -> import flows after the theme drift is removed.
  - Exact fix made:
    - Added a DB-side stored-theme resolver so auto-generated artwork now uses the saved app theme from localStorage rather than the current page DOM/theme state.
    - Wired that stored theme selection into import-time and fallback waveform-art generation paths in the DB layer.
    - Hardened Admin factory reset so it also resets live theme selection state and immediately notifies the parent app of the dark/crimson-slot reset state, instead of only changing localStorage.
  - Exact files changed:
    - `src/lib/db.ts`
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this bug kept recurring:
    - The artwork generator itself was fine, but some DB import paths still relied on implicit theme resolution from the live document.
    - After reset, saved theme state and live page theme state could temporarily disagree, so imports sometimes generated art from the stale page theme until a later theme cycle realigned everything.
  - Regression risk:
    - Low to medium. The DB change is centralized and only affects auto-art generation; the factory-reset change only adds explicit live-theme sync messaging.
  - QA still needed:
    - After factory reset, import a track immediately in default dark and confirm the auto art is dark on the first try.
    - Cycle themes, return to dark, import again, and confirm the result stays correct.
    - Re-test nuke playlist -> import flow and confirm the app no longer feels stuck or visually bricked afterward.

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

### 26. Cinema Mode behind-art visualizer for Vibe 2 / Vibe 3
**Status:** fix implemented, awaiting QA

**Observed request:**
- when Cinema Mode is active and the visual-style vibe is set to 2 or 3, render a subtle vertical-bar visualizer behind the artwork
- keep it presentation-only, isolated, and easy to remove

**Clarification note — 2026-04-11 Codex:**
- a naming seam caused confusion in the first pass: the app’s internal Vibe-switch state is currently stored in `noveltyMode` with values `normal` / `dim` / `mute`
- that internal naming is separate from the audio `DIM/MUTE` control stored in `dimMode`
- this task is keyed only to the Vibe switch, not the audio dim/mute control

**Follow-up diagnosis — 2026-04-11 Codex:**
- the first visual pass kept the bars too spatially contained behind square artwork, so on-device they read as effectively invisible
- the narrowest safe correction is visual-only: make the behind-art layer much taller, narrower, and slightly stronger so it clearly peeks above/below the artwork without changing playback or fullscreen behavior

**Follow-up diagnosis — 2026-04-11 Codex (Cinema persistence):**
- `src/components/FullscreenPlayer.tsx` was explicitly clearing local `isCinemaMode` inside a `useEffect` that runs on every `track.id` change
- that means autoplay, manual next/prev, and shuffle transitions all shared the same forced-exit behavior, because they all advance by replacing the current track
- the narrowest safe fix is to stop resetting `isCinemaMode` on track change while still resetting per-track artwork-video readiness state

**Follow-up diagnosis — 2026-04-11 Codex (visualizer hidden on iPhone):**
- the visualizer was being explicitly hidden by `body.perf-lite .cinema-mode-visualizer { display: none; }` in `src/components/player.css`
- `perf-lite` is enabled broadly on small screens in `src/App.tsx`, so iPhone Cinema Mode could never show the visualizer at all
- the narrowest safe fix is to keep the visualizer visible under `perf-lite`, but tone it down slightly instead of disabling it

**Follow-up diagnosis — 2026-04-11 Codex (wrong render plane):**
- the current visualizer is still rendered inside the artwork container, which keeps it visually tied to the square art box even when made taller
- the requested effect is a background layer behind the artwork, not an embellishment living inside the artwork frame
- the narrowest safe correction is to move the visualizer to its own Cinema-only layer behind the art within the fullscreen scene, while leaving playback and control behavior unchanged

**Follow-up diagnosis — 2026-04-11 Codex (not wide enough):**
- after moving to the correct background plane, the visualizer still reads too narrow, so too much of the animated center stays hidden directly behind the artwork
- the narrowest safe correction is to widen the Cinema visualizer field so more active bars remain visible at the left/right edges around the artwork

**Follow-up diagnosis — 2026-04-11 Codex (wrong anchor):**
- a single centered visualizer field still hides too much of its active motion behind the artwork body
- the requested composition is better modeled as two mirrored bar fields whose bases align near the artwork’s top and bottom edges
- the narrowest safe correction is to anchor one field above the art and one below it, using the artwork edges as the visual baseline

**Follow-up diagnosis — 2026-04-11 Codex (clipping + motion):**
- the new top/bottom fields still clip hard at their outer ends instead of fading into the screen
- the current bar timing also reads too slow and too even, so the visualizer does not feel reactive enough
- the narrowest safe correction is to let the fields occupy more of the screen, feather their edges with masks, and shorten/stagger the bar animation timing

**Follow-up diagnosis — 2026-04-11 Codex (needs true back layer):**
- even after widening/feathering, the visible visualizer still reads like a bounded mid-layer instead of a deep scene background
- the cleanest narrow correction is to add a second mirrored Cinema visualizer on the far back layer, with heavier blur and faster motion, so the ambient background continues behind the existing bars/artwork

**Follow-up diagnosis — 2026-04-11 Codex (background seam still visible):**
- after adding the deep back layer, the user can still see where that background field ends at the top/bottom
- the narrowest safe correction is to feather the top and bottom edges of the back visualizer fields themselves so they dissolve into the shell background instead of ending on a readable seam

**Desired behavior:**
- visualizer appears only in Cinema Mode
- visualizer appears only for Vibe 2 / Vibe 3 (`noveltyMode === "dim"` or `"mute"`)
- artwork remains dominant, with the bars reading as a soft ambient layer behind it
- reduced-motion users do not get a busy animated layer

**Codex notes:**
- Diagnosis start — 2026-04-11 Codex:
  - Files inspected:
    - `src/components/FullscreenPlayer.tsx`
    - `src/components/PlayerControls.tsx`
    - `src/components/player.css`
    - `src/App.tsx`
  - Likely root cause / seam:
    - Cinema Mode already exists as local fullscreen UI state in `FullscreenPlayer.tsx`, and the artwork surface is already the isolated render seam for Cinema presentation.
    - The existing 3-state vibe switch is exposed there as `noveltyMode`, where Vibe 2 / Vibe 3 map cleanly to `dim` / `mute`.
    - No current behind-art layer exists, so the safest implementation is a new optional visual-only component rendered inside the Cinema artwork container and gated entirely by current UI state.
  - Narrow implementation plan:
    - Add a small `CinemaModeVisualizer` component with lightweight DOM/CSS bars only.
    - Render it only when `isCinemaMode` is true and `noveltyMode !== "normal"`.
    - Keep it behind the art/video layer, derive color from the existing aura CSS variable, and disable it under reduced motion.
  - Exact fix made:
    - Added a new isolated `CinemaModeVisualizer` component in `src/components/CinemaModeVisualizer.tsx` that renders a fixed set of softly animated vertical bars using DOM + CSS only.
    - Wired `src/components/FullscreenPlayer.tsx` to render that layer only when Cinema Mode is active and the Vibe-switch backing state (`noveltyMode`) corresponds to Vibe 2 or Vibe 3.
    - Added a small `fullscreen-player-shell__art-media` wrapper in `src/components/player.css` so the media remains clipped/foregrounded while the visualizer can sit behind it and extend slightly above/below the art.
    - Styled the bars to use `--aura-rgb` for color/glow, with a softer Vibe 3 variant.
    - Follow-up cleanup: renamed the new visualizer seam to explicit Vibe 2 / Vibe 3 terminology so it no longer reads like the separate audio `DIM/MUTE` control.
    - Follow-up visual tuning: made the bar stack much taller and narrower so it clearly extends above and below square artwork instead of disappearing behind it.
    - Follow-up Cinema persistence fix: removed the track-change reset of local `isCinemaMode` in `src/components/FullscreenPlayer.tsx`, while keeping `isArtworkVideoReady` reset behavior intact per track.
    - Follow-up iPhone visibility fix: removed the `perf-lite` hard-disable of the Cinema visualizer and replaced it with a softer low-cost variant so small-screen iPhones can still see it.
    - Follow-up render-plane fix: moved the visualizer out of the artwork container and into its own Cinema-only background layer behind the art, so it stretches vertically through the scene instead of reading like a hidden overlay inside the square.
    - Follow-up width tuning: widened the Cinema background field and increased bar spacing/width so more of the fast-moving bar activity remains visible at the left and right of the artwork.
    - Follow-up edge-anchor tuning: replaced the single centered field with two mirrored visualizer fields anchored just beyond the artwork’s top and bottom edges, so the artwork edges now act as the visual base for the motion.
    - Follow-up screen-fill/reactivity tuning: expanded the top/bottom fields to screen width, feathered their outer ends with a vertical mask, and shortened/staggered bar timing so the motion reads faster and more reactive.
    - Follow-up deep-background tuning: added a second mirrored Cinema visualizer on the far back shell layer with heavier blur and faster timing so the ambient motion continues behind the visible edge-anchored bars.
    - Follow-up background seam tuning: feathered the top and bottom edges of the far back visualizer fields so they dissolve into the shell background instead of ending on a visible layer seam.
    - Disabled the layer entirely under `prefers-reduced-motion: reduce`; under `body.perf-lite` it now stays visible with lighter styling instead of being hidden.
  - Exact files changed:
    - `src/components/CinemaModeVisualizer.tsx`
    - `src/components/FullscreenPlayer.tsx`
    - `src/components/player.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It stays inside the existing fullscreen/Cinema presentation seam.
    - It does not touch playback, hydration, artwork generation, waveform decoding, or autoplay logic.
    - The new layer is optional, state-gated, CSS-driven, and easy to remove if visual tuning is needed.
  - Regression risk:
    - Low.
    - The main risk is visual balance on small iPhones or with video artwork, since the change is isolated to the Cinema art container and does not alter player behavior.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Confirm the visualizer appears only in Cinema Mode.
    - Confirm it appears only for Vibe 2 / Vibe 3 from the Vibe switch.
    - Confirm Cinema Mode now stays active across autoplay track advance.
    - Confirm Cinema Mode now stays active across manual next/prev.
    - Confirm Cinema Mode now stays active across shuffle transitions.
    - Confirm Cinema Mode still exits only on explicit user exit gestures/actions.
    - Confirm it stays behind the artwork/video and does not overpower title, art, or controls.
    - Confirm reduced-motion environments do not show the animated layer.
    - Confirm playback, autoplay, shuffle, and manual next/prev are unaffected while Cinema Mode is open.
    - Confirm performance stays smooth on iPhone with both still artwork and artwork video.

### 27. Current-track artwork refresh while playing
**Status:** fix implemented, awaiting QA

**Observed request:**
- if the user changes artwork while the track is already playing, the playbar/fullscreen/current-track artwork stays stale until they leave the track and come back

**Desired behavior:**
- updating artwork for the currently playing track should refresh active playback surfaces immediately
- the user should not need to switch away from the track to see the new art

**Codex notes:**
- Diagnosis start — 2026-04-11 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/lib/db.ts`
    - `src/admin/AdminApp.tsx`
  - Likely root cause:
    - `currentTrack` in `src/App.tsx` merges refreshed track metadata with a separate `hydratedCurrentTrackMedia` cache.
    - That cache prefers its own `artUrl` / `artVideoUrl` over the base track row.
    - The hydration effect reruns only when `currentTrackId` changes, so artwork updates on the same active track leave stale hydrated media overriding the newly refreshed track metadata.
  - Narrow implementation plan:
    - Keep the current-track hydration model intact.
    - Add a narrow refresh trigger so the current-track hydration effect reruns when the active track’s artwork/media metadata changes, not just when the track id changes.
    - Do not widen into playback, import, or artwork-generation changes.
  - Exact fix made:
    - Added a narrow `currentTrackMediaRefreshKey` in `src/App.tsx` derived from the active track’s current media-facing fields (`artUrl`, `artVideoUrl`, `artGrad`, `missingAudio`).
    - Updated the current-track hydration effect to rerun when that refresh key changes, not only when `currentTrackId` changes.
    - This lets refreshed artwork/media for the currently playing track replace stale hydrated playback media immediately after an artwork update.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It preserves the existing current-track hydration model.
    - It only changes when that hydration is refreshed for the already-active track.
    - It does not alter playback selection, DB artwork writes, or import flows.
  - Regression risk:
    - Low.
    - The main risk is only an extra current-track media fetch when the active track’s artwork metadata changes, which is the intended refresh path.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - While a track is playing, update its artwork and confirm the mini player refreshes immediately.
    - Confirm fullscreen/current-track artwork refreshes immediately without switching tracks.
    - Confirm blurred backdrop / now-playing artwork also refresh if they depend on the current track art.
    - Confirm updating artwork on a non-playing track does not disrupt current playback.

### 28. Playlist autoplay behavior for cropped/loop-selected tracks
**Status:** fix implemented, awaiting QA

**Observed request:**
- when playlist playback reaches a cropped-loop new track, it waits for the user to press play instead of autoplaying
- when a track has a loop selected, it should behave like a normal playlist track with a different start/end span instead of looping forever

**Desired behavior:**
- crop-to-new-track outputs should enter playback through the same autoplay path as any other track
- loop-selected tracks in playlist playback should play from loop start to loop end, then advance like normal tracks

**Codex notes:**
- Diagnosis start — 2026-04-11 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/lib/db.ts`
  - Findings:
    - `handleCropToNewTrack()` currently switches to the newly created crop with `setCurrentTrackId(nextTrackId)` instead of the normal `playTrack(nextTrackId, true)` path, which bypasses pending autoplay setup.
    - Region loops are currently implemented as true repeat loops: both `onTime` and `onEnded` force playback back to `loopRegion.start` whenever `currentLoopMode === "region"`.
    - That means a loop-selected track does not currently behave like a bounded playlist span; it behaves like an infinite replay until the user changes state manually.
  - Narrow implementation plan:
    - Route crop-to-new-track handoff through the existing autoplay path.
    - Add a narrow playlist-playback guard so region loops can behave like bounded track spans during playlist navigation, without redesigning the broader loop editor/state model.
    - Keep this scoped to playback behavior only.
  - Exact fix made:
    - Updated `handleCropToNewTrack()` in `src/App.tsx` to switch to the new cropped track via `playTrack(nextTrackId, true)` instead of direct `setCurrentTrackId(...)`, so it uses the normal pending-autoplay path.
    - Added a shared `advancePlaybackAfterTrackCompletion()` helper inside the audio listener effect in `src/App.tsx`.
    - Updated region-loop handling so when playlist navigation has more than one track, a region loop behaves like a bounded span:
      - playback seeks to loop start on autoplay as before
      - reaching `loopRegion.end` advances to the next/shuffle track instead of replaying forever
      - single-track loop behavior remains unchanged
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It keeps the existing loop editor and stored loop state intact.
    - It limits the behavior change to playlist playback with more than one navigation target.
    - It uses the app’s existing next-track/autoplay path rather than inventing a new crop handoff path.
  - Regression risk:
    - Low to medium.
    - The main risk is making sure multi-track playlist playback gets the new bounded-span behavior while single-track loop use still retains the old repeat-loop behavior.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Create a crop-to-new-track item and confirm it starts playing immediately after creation.
    - Let playlist playback reach a cropped-loop new track and confirm it autoplay starts.
    - On a multi-track playlist, set a loop region on one track and confirm it plays from loop start to loop end, then advances normally.
    - Confirm shuffle still advances from a loop-selected track.
    - Confirm a single-track loop still repeats as before when there is no next playlist track context.

**Follow-up diagnosis — 2026-04-11 Codex (looped next-track autoplay still missing):**
- looped autoplay intentionally defers actual `play()` until the `loadedmetadata` / `durationchange` / `canplay` retry path so it can seek to loop start first
- that retry path depends on media events, but those events can already have fired by the time the fresh listener set for the new current track is attached
- the narrowest safe fix is to trigger one immediate retry after attaching listeners, so a loop-selected next track can still autoplay even if the key media event already happened

**Follow-up fix implemented — 2026-04-11 Codex (looped next-track autoplay retry seam):**
- Exact fix made:
  - Added an immediate `retryPendingAutoPlayIfNeeded("canplay")` call right after the new audio listener set is attached in `src/App.tsx`.
  - This preserves the existing deferred loop-start seek behavior, but closes the timing seam where `loadedmetadata` / `durationchange` / `canplay` could fire before the fresh listeners were attached for the new current track.
- Exact files changed:
  - `src/App.tsx`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - It does not redesign autoplay, loop storage, or playlist navigation.
  - It keeps the existing pending-autoplay guardrails intact and only adds one contained retry at listener-attach time.
  - It is scoped specifically to loop-selected track transitions that were already relying on the deferred autoplay path.
- Regression risk:
  - Low.
  - The main risk is just confirming non-looped track autoplay remains unchanged and that the retry does not double-start playback.
- QA completed:
  - `npm run typecheck`
- QA still needed:
  - Advance from a normal playlist track into a next track with an active loop and confirm it starts automatically.
  - Confirm the looped next track still begins from its loop start.
  - Confirm manual next/prev into a looped track also starts cleanly.
  - Confirm non-looped autoplay behavior is unchanged.

**Follow-up diagnosis — 2026-04-11 Codex (looped track lands paused at loop start):**
- user report and device screenshot indicate the destination looped track is reaching its loop start position, but playback is still paused
- that points to the deferred pending-autoplay retry path reaching the seek step without ever crossing the `readyState >= HAVE_CURRENT_DATA` gate needed to call `play()`
- on iOS, a newly assigned paused media element can remain at `HAVE_METADATA` after `load()` until `play()` is requested, so the current gate can deadlock looped autoplay
- narrowest safe fix:
  - lower the pending-autoplay retry readiness gate to `HAVE_METADATA` for the deferred retry path
  - keep the rest of the loop-start seek behavior unchanged

**Follow-up fix implemented — 2026-04-11 Codex (metadata gate for deferred loop autoplay):**
- Exact fix made:
  - Updated `retryPendingAutoPlayIfNeeded(...)` in `src/App.tsx` to allow the deferred pending-autoplay path to proceed once the media element reaches `HAVE_METADATA`, instead of waiting for `HAVE_CURRENT_DATA`.
  - This keeps the existing loop-start seek, but removes the paused-state deadlock where iOS would never fetch enough current-frame data to trigger the old gate before `play()` was called.
- Exact files changed:
  - `src/App.tsx`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - It changes one readiness threshold inside the existing deferred autoplay path only.
  - It does not alter playlist navigation, loop storage, shuffle behavior, or explicit user play/pause behavior.
  - It matches the actual requirement for loop-start seeking, which only needs metadata.
- Regression risk:
  - Low.
  - The main thing to confirm is that deferred autoplay now starts on looped next-track transitions without introducing double-start behavior.
- QA completed:
  - `npm run typecheck`
- QA still needed:
  - Let playback advance into a loop-selected next track and confirm it starts automatically.
  - Confirm the destination track starts at the loop start, not at `0:00`.
  - Confirm manual next/prev into a loop-selected track also starts.
  - Confirm non-looped autoplay behavior is unchanged.

### 29. Repeat-button flash should only fire on return to off
**Status:** fix implemented, awaiting QA

**Observed request:**
- the repeat flash is not correct
- the intended behavior is a simple flash only when the repeat button returns to its default off state

**Desired behavior:**
- repeat should not flash/sparkle on every state change
- repeat should only flash when cycling back to `off`

**Codex notes:**
- Diagnosis start — 2026-04-11 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/components/PlayerControls.tsx`
    - `src/components/player.css`
  - Findings:
    - `src/components/PlayerControls.tsx` currently calls `emitPinkSparkle(...)` on every repeat click.
    - `src/App.tsx` currently triggers the repeat flash tick when landing on `repeat-3`, not when returning to `off`.
    - The current implementation therefore gives the broad “parity on every change” behavior from the earlier polish pass, which conflicts with the new requested behavior.
  - Narrow implementation plan:
    - Remove the per-click repeat sparkle path.
    - Trigger the dedicated repeat flash only when repeat cycles back to `off`.
    - Leave repeat mode behavior unchanged.
  - Exact fix made:
    - Removed the per-click repeat sparkle path from `src/components/PlayerControls.tsx`, so repeat no longer emits the broader sparkle treatment on every state change.
    - Updated `src/App.tsx` so the repeat flash tick now fires when repeat returns to `off`, instead of when landing on `repeat-3`.
    - Updated the repeat button class gating in `src/components/PlayerControls.tsx` so the flash animation can render on the default/off button state.
    - Preserved the separate special `repeat-3` activation styling.
  - Exact files changed:
    - `src/App.tsx`
    - `src/components/PlayerControls.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It changes only repeat-button presentation feedback.
    - It does not alter repeat mode sequencing or playback behavior.
    - It narrows the earlier parity pass back to the explicitly requested off-state flash behavior.
  - Regression risk:
    - Low.
    - The only intended behavior change is when the repeat flash appears.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Cycle repeat through all states and confirm there is no sparkle/flash on intermediate states.
    - Confirm a flash appears only when the control returns to `off`.
    - Confirm `repeat-3` activation styling still appears normally.

### 30. Show loaded vault name in main header hint
**Status:** fix implemented, awaiting QA

**Observed request:**
- after the first run, the helper text area that currently says `Tap track to play...` should show the loaded vault name so the user knows which vault file is active

**Desired behavior:**
- when a vault has been imported successfully, the main header hint should show `Vault loaded: <vault name>`
- if no imported vault name is known yet, the existing helper text can remain

**Codex notes:**
- Diagnosis start — 2026-04-11 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `styles.css`
  - Findings:
    - The helper text is rendered in the main header in `src/App.tsx`.
    - There is no existing persisted `loaded vault name` field.
    - Successful vault import already has access to the source `File`, so the imported vault filename is available at the narrowest trust/UI seam.
  - Narrow implementation plan:
    - Persist the successfully imported vault filename in localStorage/state.
    - Reuse the existing header hint area to show `Vault loaded: <name>` when present.
    - Keep this UI-only and avoid widening into vault import behavior changes.
  - Exact fix made:
    - Added a persisted `LAST_LOADED_VAULT_NAME_KEY` in `src/App.tsx`.
    - Added local state for `lastLoadedVaultName`, initialized from localStorage.
    - On successful full-vault import, the app now stores `file.name` as the loaded vault name.
    - Updated the existing header hint so when tracks exist and a loaded vault name is known, it shows `Vault loaded: <name>` instead of the generic play/fullscreen helper text.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It reuses existing UI real estate instead of adding a new surface.
    - It only persists a small trust-oriented label from the already selected import file.
    - It does not change vault import behavior, storage, or playback state.
  - Regression risk:
    - Low.
    - The only real behavior change is the header hint copy after successful vault import.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Import a full vault and confirm the main header hint shows `Vault loaded: <filename>`.
    - Reload the app and confirm the hint persists.
    - Confirm when no vault has been imported yet, the original helper text still appears.

### 31. Reuse existing track artwork on new imports
**Status:** fix implemented, awaiting QA

**Observed request:**
- the user wants a quick way to reuse artwork from an existing track on a newly imported track instead of reuploading the same file repeatedly

**Desired behavior:**
- the import form should offer an optional way to pick artwork from an existing track
- that reused artwork should apply to the new import without changing the original source track

**Codex notes:**
- Diagnosis start — 2026-04-11 Codex:
  - Files inspected:
    - `src/admin/AdminApp.tsx`
    - `src/lib/db.ts`
  - Findings:
    - The import form already supports optional manual artwork through the existing upload artwork lane.
    - The DB layer already stores poster/video artwork blobs per track, but there is no small helper to retrieve them as reusable payload for another import.
    - The safest seam is to add a source-track artwork picker to the import form and feed those blobs into the existing `addTrackToDb(...)` import path when no manual artwork file is armed.
  - Narrow implementation plan:
    - Add a DB helper to retrieve stored artwork blobs for a source track.
    - Add an optional import-form picker listing tracks that already have artwork.
    - On import, if no manual artwork file is selected but a source track is chosen, reuse that source track’s stored artwork payload.
  - Exact fix made:
    - Added `getTrackArtworkPayloadFromDb(...)` in `src/lib/db.ts` to retrieve stored poster/video artwork blobs for a source track.
    - Added `uploadArtworkSourceTrackId` state plus `importArtworkSourceOptions` in `src/admin/AdminApp.tsx`.
    - Added an optional `Reuse artwork from existing track` picker to the import form.
    - Updated the import path so when no manual artwork file is selected but a source track is chosen, the new import reuses that source track’s stored artwork payload.
    - Kept manual artwork upload higher priority: if a manual artwork file is selected, it overrides the reused-artwork picker.
  - Exact files changed:
    - `src/lib/db.ts`
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It reuses the existing import path and artwork storage model.
    - It avoids redesigning the artwork system or adding any new asset library.
    - It keeps the feature optional and scoped to new imports only.
  - Regression risk:
    - Low.
    - The main risk is only confirming manual artwork still wins when both inputs are set and that reused artwork copies correctly for both image and video-art cases.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Import a new track using `Reuse artwork from existing track` and confirm the new track gets the copied artwork.
    - Confirm manual artwork upload still overrides reused artwork when both are set.
    - Confirm the source track’s own artwork remains unchanged.
    - Confirm reused video artwork still carries over a usable poster/frame.

### 32. Crop workflow should not be ejected by playlist advance
**Status:** diagnosis in progress

**Observed request:**
- while in fullscreen crop workflow, if playback hits the end of the selected loop, the app advances to the next playlist track
- this ejects the user from loop editing or from the post-`Done` crop-ready fullscreen state where `Crop Audio` is still available

**Desired behavior:**
- while the user is in crop workflow on the current track, reaching the loop end should not advance to the next track
- crop workflow should remain anchored to the current track until the user exits it intentionally

**Codex notes:**
- Diagnosis start — 2026-04-11 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/components/FullscreenPlayer.tsx`
  - Findings:
    - The recent playlist-loop fix advances on region-end whenever playlist navigation has more than one track.
    - The app already tracks crop-related UI state separately:
      - `loopRegion.editing` during active loop adjustment
      - `hasCroppableLoop` after `Done`, when `Crop Audio` is still available
      - `isFullscreenPlayerOpen` and `isCropAudioPromptOpen` for the current crop workflow surfaces
    - That means the app can distinguish normal playback from active crop workflow without redesigning loop state.
  - Narrow implementation plan:
    - add a small crop-workflow guard in the region-end advance path
    - while crop workflow is active, keep the existing same-track loop behavior instead of advancing
    - leave normal playlist autoplay unchanged outside crop workflow
  - Exact fix made:
    - Added `isCropWorkflowActive` in `src/App.tsx`, derived from:
      - `hasCroppableLoop`
      - `currentLoop.editing`
      - `isFullscreenPlayerOpen`
      - `isCropAudioPromptOpen`
    - Updated the region-loop `onTime` and `onEnded` handlers so playlist advance at loop end only happens when crop workflow is not active.
    - While crop workflow is active, the existing same-track loop behavior now continues, so the user stays on the current track for loop adjustment or crop export.
  - Exact files changed:
    - `src/App.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It does not redesign fullscreen, crop export, or playlist navigation.
    - It reuses existing crop-related UI state already tracked by the app.
    - It only narrows when the region-end playlist advance is allowed to fire.
  - Regression risk:
    - Low.
    - The main risk is confirming playlist advance still happens during normal loop-selected playback outside crop workflow.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - In fullscreen loop editing, let playback hit loop end and confirm it stays on the same track.
    - Tap `Done`, leave `Crop Audio` available, let playback hit loop end, and confirm it still stays on the same track.
    - Open the crop prompt and confirm playback does not eject the user to the next track.
    - Outside crop workflow, confirm a loop-selected playlist track still advances normally at loop end.

**Follow-up diagnosis — 2026-04-11 Codex (Cinema Mode wrongly treated as crop workflow):**
- the first crop-workflow guard used `isFullscreenPlayerOpen` as part of the blocking condition
- that was too broad, because Cinema Mode is entered inside fullscreen but should still behave like normal playback and advance to the next track
- the narrowest safe correction is to distinguish fullscreen Cinema Mode from fullscreen crop-ready state, then only suppress advance for non-cinema crop workflow

**Follow-up fix implemented — 2026-04-11 Codex (Cinema Mode exception for crop-workflow guard):**
- Exact fix made:
  - Added an `onCinemaModeChange` callback to `src/components/FullscreenPlayer.tsx` so fullscreen can report whether it is currently in Cinema Mode.
  - Added `isFullscreenCinemaMode` state in `src/App.tsx`.
  - Narrowed `isCropWorkflowActive` so fullscreen only blocks playlist advance when it is non-cinema fullscreen with a croppable loop, plus the existing editing / crop-prompt cases.
  - Added a reset so `isFullscreenCinemaMode` clears when fullscreen closes.
- Exact files changed:
  - `src/App.tsx`
  - `src/components/FullscreenPlayer.tsx`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - It preserves the earlier crop-workflow containment fix.
  - It adds only one small lifted UI-state signal instead of redesigning fullscreen or loop ownership.
  - It restores the intended distinction: Cinema Mode is playback mode, not crop workflow.
- Regression risk:
  - Low.
  - Main QA is just confirming the two fullscreen states now diverge correctly at loop end.
- QA completed:
  - `npm run typecheck`
  - QA still needed:
    - In Cinema Mode on a loop-selected track, confirm playback advances to the next track normally.
    - In non-cinema fullscreen with `Crop Audio` still available, confirm playback stays on the same track at loop end.
    - In active loop editing, confirm playback stays on the same track at loop end.

### 33. Existing artwork reuse should override embedded metadata artwork
**Status:** diagnosis in progress

**Observed request:**
- on import, if the user selects `Reuse artwork from existing track`, that choice should override embedded metadata artwork from the imported audio file
- the `Update Artwork` / replace-artwork flow should also support reusing artwork from an existing track

**Desired behavior:**
- import artwork precedence should be:
  - manual uploaded artwork
  - reused artwork from an existing track
  - embedded metadata artwork
- replace-artwork should support either:
  - a newly uploaded artwork file
  - reused artwork from another existing track

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/admin/AdminApp.tsx`
    - `src/lib/db.ts`
  - Findings:
    - Import already has a reused-artwork dropdown, but the submit path only prefers it when there is no armed artwork file at all.
    - Embedded metadata artwork is stored in the same `uploadArt` slot as manual artwork, so a metadata-autofilled image can currently override the user’s explicit reused-artwork dropdown choice.
    - The replace-artwork lane currently only supports a newly uploaded file and has no seam for reusing stored artwork from another track.
  - Narrow implementation plan:
    - make import submit precedence explicit by distinguishing manual artwork from metadata-autofilled artwork at submit time
    - add a small reused-artwork selector to the replace-artwork lane and feed it through the existing `updateArtworkInDb(...)` path
    - keep manual uploaded artwork higher priority than reused artwork
  - Exact fix made:
    - Updated import submit logic in `src/admin/AdminApp.tsx` so artwork precedence is now:
      - manual uploaded artwork
      - reused artwork from existing track
      - embedded metadata artwork
    - The reused-artwork dropdown now overrides metadata-autofilled artwork specifically, while manual uploaded artwork still remains highest priority.
    - Added `selectedArtworkSourceTrackId` plus `updateArtworkSourceOptions` to the replace-artwork lane in `src/admin/AdminApp.tsx`.
    - Updated `onUpdateArtwork()` so `Update Artwork` can now use either:
      - a newly selected artwork file
      - or reused artwork from another existing track
    - Updated helper copy so the import and update-artwork lanes describe the actual precedence rules.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It reuses the existing `getTrackArtworkPayloadFromDb(...)` and `updateArtworkInDb(...)` paths.
    - It changes only artwork source selection precedence, not broader artwork storage or metadata parsing.
    - It avoids redesigning the import form or replace-artwork system.
  - Regression risk:
    - Low.
    - Main QA is confirming manual uploaded artwork still wins, reused artwork now beats metadata artwork, and replace-artwork works from both file and reused-source paths.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Import an audio file with embedded artwork, also choose `Reuse artwork from existing track`, and confirm the reused artwork is what imports.
    - Confirm manual uploaded artwork still overrides both reused artwork and embedded metadata artwork.
    - In `Update Artwork`, select a destination track and a source track, without uploading a file, and confirm artwork copies over.
    - Confirm `Update Artwork` with a manually uploaded file still behaves unchanged.

### 34. Vault loaded label should clear on reset and render more discreetly
**Status:** diagnosis in progress

**Observed request:**
- after factory reset, the header can still show a stale `Vault loaded: ...` label, which is inaccurate
- the current vault label is too visually prominent in the main header

**Desired behavior:**
- full reset should clear any persisted loaded-vault label
- when shown, the vault label should read as a smaller, more discreet trust hint

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `styles.css`
  - Findings:
    - `lastLoadedVaultName` is initialized from `LAST_LOADED_VAULT_NAME_KEY` and updated on successful vault import.
    - The full reset path in `nukeAppData()` does not clear that state or its localStorage key, so stale vault labels can survive a factory reset.
    - The vault label currently reuses the generic `.hint` text render with full-sentence copy, so a smaller inline badge treatment can be added without introducing a new UI surface.
  - Narrow implementation plan:
    - clear `lastLoadedVaultName` and `LAST_LOADED_VAULT_NAME_KEY` inside the full reset path
    - keep the label in the existing hint slot, but render it as a smaller vault-badge style
  - Exact fix made:
    - Updated `nukeAppData()` in `src/App.tsx` to clear `lastLoadedVaultName` state and remove `LAST_LOADED_VAULT_NAME_KEY` from localStorage during full reset.
    - Updated the main header hint render in `src/App.tsx` so the loaded-vault state now appears as a smaller inline vault pill with iconography instead of sentence-style helper copy.
    - Added matching vault-pill styles in `styles.css`.
  - Exact files changed:
    - `src/App.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It reuses the existing persisted vault-name key and existing header hint slot.
    - It does not alter vault import/export logic.
    - It fixes the inaccurate reset state and presentation layer only.
  - Regression risk:
    - Low.
    - Main QA is confirming reset clears the badge and that vault import still restores it correctly.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Import a vault and confirm the smaller vault badge appears with the correct file name.
    - Run factory reset and confirm the vault badge disappears immediately and stays cleared after reload.
    - Confirm the normal helper text still appears when there is no loaded vault name.

### 35. Import dropzones should allow clearing armed files
**Status:** diagnosis in progress

**Observed request:**
- once import audio or import artwork is armed in its dropzone, the user has no direct way to clear that slot
- this blocks trustful fallback behavior, such as removing embedded artwork so the user can use auto art instead

**Desired behavior:**
- import audio and import artwork dropzones should expose a clear affordance when armed
- clearing the slot should remove the loaded file from that lane without resetting unrelated form state

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/admin/TransferLaneDropZone.tsx`
    - `src/admin/AdminApp.tsx`
    - `styles.css`
  - Findings:
    - `TransferLaneDropZone` already knows when a lane is armed, but it has no optional clear action.
    - The import form already has narrow clear handlers available through `onPickUploadAudio(null)` and `onPickUploadArtwork(null)`.
    - The safest seam is a small optional clear button rendered inside the dropzone only when the caller opts in.
  - Narrow implementation plan:
    - add optional clear props to `TransferLaneDropZone`
    - render a top-right clear button only when armed and enabled
    - wire it only to the import audio and import artwork lanes for this pass
  - Exact fix made:
    - Added optional `onClearRequest` / `clearLabel` props to `src/admin/TransferLaneDropZone.tsx`.
    - Added a top-right `✕` clear control inside the dropzone when a lane is armed and clearable.
    - Wired the clear control only to the import audio and import artwork lanes in `src/admin/AdminApp.tsx`.
    - Clearing import audio now runs the existing `onPickUploadAudio(null)` path.
    - Clearing import artwork now runs the existing `onPickUploadArtwork(null)` path, which lets the user remove embedded/loaded artwork and fall back to auto art or another artwork source.
    - Added matching clear-button styling in `styles.css`.
  - Exact files changed:
    - `src/admin/TransferLaneDropZone.tsx`
    - `src/admin/AdminApp.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It reuses existing null-file clear paths instead of inventing new import state behavior.
    - It only adds a lane-local clear affordance and does not redesign the import form.
    - It is scoped to the two trust-critical import lanes requested in this pass.
  - Regression risk:
    - Low.
    - Main QA is confirming the clear button does not interfere with normal dropzone click/pick behavior and that clearing artwork really restores the auto-art path.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Arm import audio, tap the `✕`, and confirm the audio slot clears cleanly.
    - Arm import artwork, tap the `✕`, and confirm the artwork slot clears cleanly.
    - Import an MP3 with embedded artwork, clear the artwork slot, and confirm the track can fall back to auto art.
    - Confirm normal dropzone click/browse behavior still works on both lanes.

**Follow-up diagnosis — 2026-04-12 Codex (clear control not visible + explicit auto-art option needed):**
- the initial `✕` control was rendered as a nested button inside the dropzone’s outer button, which is invalid HTML and can be suppressed or behave unreliably in Safari/WebKit
- user also needs an explicit import-dropdown path for auto art, not just a clear action, so embedded metadata artwork can be intentionally bypassed without ambiguity

**Follow-up fix implemented — 2026-04-12 Codex (clear-control structure + Generate Auto Art option):**
- Exact fix made:
  - Updated `src/admin/TransferLaneDropZone.tsx` so the dropzone host is now a keyboard-accessible `div` with `role="button"` instead of a button containing another button.
  - This makes the top-right `✕` clear control valid and visible/clickable in Safari/WebKit.
  - Added `Generate Auto Art` as an explicit option in the import `Reuse artwork from existing track` dropdown in `src/admin/AdminApp.tsx`.
  - Updated import submit precedence so when `Generate Auto Art` is selected and there is no manual uploaded artwork, the import intentionally ignores embedded metadata artwork and allows the existing auto-art path to generate artwork.
- Exact files changed:
  - `src/admin/TransferLaneDropZone.tsx`
  - `src/admin/AdminApp.tsx`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - It fixes the invalid nested-button structure instead of layering more CSS over it.
  - It keeps manual uploaded artwork as the highest-priority source.
  - It adds one explicit import-only auto-art selector without redesigning the broader artwork system.
- Regression risk:
  - Low.
  - Main QA is confirming the clear control is now visible/usable on Safari/iPhone and that `Generate Auto Art` beats metadata artwork only when intended.
- QA completed:
  - `npm run typecheck`
- QA still needed:
  - Confirm the top-right `✕` is visible on armed import audio and artwork lanes in Safari/iPhone.
  - Confirm tapping `✕` clears the lane without breaking normal browse/drop behavior.
  - Import an MP3 with embedded artwork, choose `Generate Auto Art`, and confirm auto art is used instead of embedded artwork.
  - Confirm manual uploaded artwork still overrides `Generate Auto Art`.

**Follow-up diagnosis — 2026-04-12 Codex (clear control visually too loud / poorly placed):**
- the user-facing problem is now cosmetic rather than behavioral
- the clear control reads like part of the dropzone content instead of a subtle corner affordance
- the narrowest safe fix is CSS-only:
  - reserve a little top-right space inside the lane
  - reduce the button size/contrast
  - keep it visually anchored to the corner

**Follow-up fix implemented — 2026-04-12 Codex (subtle corner clear affordance):**
- Exact fix made:
  - Updated `styles.css` so the dropzone reserves right-side space for the clear control.
  - Reduced the clear control to a smaller, lower-contrast corner pill.
  - Kept it anchored to the top-right corner with quieter hover emphasis.
- Exact files changed:
  - `styles.css`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - CSS-only.
  - No behavior or form-state logic changed.
  - It corrects the visual hierarchy without touching the earlier clear-slot functionality.
- Regression risk:
  - Low.
  - Main QA is just confirming the `✕` now reads as a subtle corner affordance and does not overlap the lane copy.
- QA completed:
  - `npm run typecheck`
- QA still needed:
  - Confirm the `✕` now sits cleanly in the dropzone corner on iPhone.
  - Confirm the lane title/copy no longer visually collides with it.
  - Confirm tapping it still clears the lane normally.

**Follow-up diagnosis — 2026-04-12 Codex (corner clear mark still reads too tall):**
- the behavior is correct, but the current text-glyph `✕` still reads visually taller/longer than intended on iPhone
- the narrowest safe fix is to swap the glyph for a tiny SVG close icon and tighten the corner button dimensions/placement

**Follow-up fix implemented — 2026-04-12 Codex (tiny SVG corner close mark):**
- Exact fix made:
  - Replaced the clear control’s text glyph in `src/admin/TransferLaneDropZone.tsx` with a tiny SVG close icon.
  - Tightened the corner button size and icon size in `styles.css`.
  - Kept the same clear behavior and corner positioning, but made the mark read shorter and cleaner on iPhone.
- Exact files changed:
  - `src/admin/TransferLaneDropZone.tsx`
  - `styles.css`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - Presentation-only.
  - SVG avoids font-specific glyph proportions that were making the `✕` read too tall.
  - No import behavior changed.
- Regression risk:
  - Low.
  - Main QA is just confirming the smaller icon is still tappable enough on device.
- QA completed:
  - `npm run typecheck`
- QA still needed:
  - Confirm the corner close mark now reads shorter/cleaner on iPhone.
  - Confirm it is still easy enough to tap.

### 36. Demo Playlist with user tracks should survive full vault export/import
**Status:** diagnosis in progress

**Observed request:**
- if the user has a playlist named `Demo Playlist` containing imported user tracks, full vault backup/import currently does not restore that playlist
- the original intent was only to avoid backing up the built-in demo tracks, not to drop user data because of the playlist name

**Desired behavior:**
- built-in demo tracks should still be excluded from full vault backup
- a Demo Playlist containing non-demo/user tracks should export and restore like a normal playlist

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/lib/backup.ts`
  - Findings:
    - `sanitizeLibraryForFullBackup(...)` strips built-in demo tracks correctly.
    - But it also currently drops any playlist whose id is `polyplaylist-demo` or whose normalized name is `demo playlist` before it evaluates the playlist’s remaining non-demo track ids.
    - Import uses the same sanitizer on the restored library payload, so the playlist is lost on both export and restore for the same reason.
  - Narrow implementation plan:
    - keep filtering out built-in demo tracks
    - stop dropping demo-identity playlists up front
    - only drop a demo-identity playlist when, after filtering, it contains no remaining non-demo tracks
  - Exact fix made:
    - Updated `sanitizeLibraryForFullBackup(...)` in `src/lib/backup.ts`.
    - The sanitizer still removes built-in demo tracks from `tracksById`.
    - Playlist `trackIds` are now filtered against the remaining non-demo tracks first.
    - A demo-identity playlist (`polyplaylist-demo` or normalized `demo playlist`) is now only dropped when it ends up with zero remaining non-demo tracks after that filtering.
    - This preserves the original backup-size intent while allowing a Demo Playlist that contains imported user tracks to export and restore like a normal playlist.
  - Exact files changed:
    - `src/lib/backup.ts`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It stays entirely inside the full-backup sanitizer used by both export and import.
    - It does not redesign playlist identity, backup format, or demo-seed behavior.
    - It preserves the existing exclusion of built-in demo tracks.
  - Regression risk:
    - Low.
    - Main QA is confirming demo-only playlists still stay excluded while user-populated Demo Playlists now survive full vault round-trip.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Create or use a playlist named `Demo Playlist`, add at least one imported non-demo track, export a full vault, re-import it, and confirm the playlist restores with that track.
    - Confirm built-in demo tracks are still not packaged into the full vault.
    - Confirm a demo-only playlist with no imported tracks is still excluded as before.

### 37. Crop actions should allow rename before confirmation
**Status:** diagnosis in progress

**Observed request:**
- before `Crop Existing Track` or `Crop to New Track` is confirmed, the user wants a rename field in the crop modal
- for new-track crops, the user should be able to set the new track name before the cropped track is created

**Desired behavior:**
- crop modal should include a rename box
- `Crop Existing Track` should optionally rename the current track if the field is changed
- `Crop to New Track` should use the entered name for the new cropped track

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/lib/db.ts`
  - Findings:
    - The existing crop modal in `src/App.tsx` is already the clean confirmation seam.
    - `replaceAudioInDb(...)` already accepts an optional replacement title.
    - `duplicateTrackWithAudioInDb(...)` already accepts an optional title override.
    - That means rename support can be added in the modal without changing the underlying crop/audio pipeline.
  - Narrow implementation plan:
    - add one crop-name draft state in `src/App.tsx`
    - seed it from the current track title when opening the crop prompt
    - pass the trimmed value into existing/new-track crop actions
  - Exact fix made:
    - Added `cropRenameValue` state in `src/App.tsx`.
    - The crop modal now seeds that field from the current track title when opened.
    - Added a `Track Name` input to the existing crop confirmation modal in `src/App.tsx`.
    - `Crop Existing Track` now passes the trimmed rename value into `replaceAudioInDb(...)`, falling back to the current title when left unchanged/blank.
    - `Crop to New Track` now passes the trimmed rename value into `duplicateTrackWithAudioInDb(...)`, falling back to the existing `${currentTrack.title} (Loop Crop)` naming when blank.
    - Added matching crop-rename input styling in `styles.css`.
  - Exact files changed:
    - `src/App.tsx`
    - `styles.css`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It reuses the existing crop modal and the title override support already present in the DB helpers.
    - It does not alter crop audio generation, playback logic, or artwork behavior.
    - It keeps the rename step exactly at the existing user confirmation seam.
  - Regression risk:
    - Low.
    - Main QA is confirming blank/unchanged values still preserve the old behavior and that both crop actions use the entered title correctly.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Open the crop modal and confirm the rename field is prefilled with the current track title.
    - Use `Crop Existing Track` with a changed title and confirm the current track is renamed after cropping.
    - Use `Crop to New Track` with a changed title and confirm the new track is created with that title.
    - Leave the field unchanged/blank and confirm the previous default naming behavior still works.

### 38. Replace-artwork lane should not trigger reused-artwork dropdown
**Status:** diagnosis in progress

**Observed request:**
- tapping the replace-artwork dropzone can trigger the reused-artwork dropdown instead of only opening the artwork picker

**Desired behavior:**
- the replace-artwork dropzone should only activate its own picker
- the reused-artwork dropdown should only respond to intentional taps on that dropdown

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/admin/AdminApp.tsx`
  - Findings:
    - The entire `Update artwork` section is wrapped in an outer `<label>`.
    - Inside that same label, the reused-artwork control is also wrapped in its own `<label>`.
    - That nested-label structure broadens tap activation and can route taps from the dropzone area into the dropdown on mobile Safari.
  - Narrow implementation plan:
    - replace the outer and inner label wrappers in the `Update artwork` section with neutral container elements
    - preserve the exact layout and behavior otherwise
  - Exact fix made:
    - Updated the `Update artwork` section in `src/admin/AdminApp.tsx` to remove the outer `<label>` wrapper around the whole block.
    - Updated the nested `Reuse artwork from existing track` wrapper in the same section from `<label>` to a neutral container as well.
    - Preserved the exact controls and layout, but removed the label semantics that were broadening tap activation into the dropdown.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It fixes the hit-target bug at the DOM-structure layer instead of trying to patch around it with pointer-event hacks.
    - It does not change artwork update behavior or introduce any new controls.
    - It is scoped only to the affected `Update artwork` lane.
  - Regression risk:
    - Low.
    - Main QA is confirming the dropdown still works when tapped directly and the dropzone now only opens its own picker.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - Tap the replace-artwork dropzone on iPhone and confirm it opens the artwork picker only.
    - Tap the reused-artwork dropdown directly and confirm it still opens normally.
    - Confirm `Update Artwork` still works from both file upload and reused-artwork selection paths.

### 39. Safari desktop input polish: journal save, escape stack, repeat FX parity
**Status:** diagnosis in progress

**Observed request:**
- in Gratitude Journal on Safari desktop, `Shift+Enter` should save and close an open note
- pressing `Escape` from the journal/gratitude flow should return the user to fullscreen player instead of dropping all the way back to the playlist page
- desktop repeat FX should only flash when repeat returns to `off`

**Desired behavior:**
- `Shift+Enter` saves journal compose/edit textareas
- overlay/modal `Escape` handling should not also close fullscreen underneath
- repeat should not show the old repeat-3 activation flash on desktop

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/App.tsx`
    - `src/components/JournalModal.tsx`
    - `src/components/PlayerControls.tsx`
  - Findings:
    - Journal textareas currently only suppress Enter; they do not expose a keyboard save shortcut.
    - The global `Escape` handler in `src/App.tsx` always closes fullscreen immediately, even when journal/gratitude is the topmost surface and should consume Escape first.
    - `src/components/PlayerControls.tsx` still contains a local repeat-3 activation animation path, which conflicts with the requested “flash only on return to off” behavior.
  - Narrow implementation plan:
    - add `Shift+Enter` save behavior to journal composer and edit textareas
    - gate the global fullscreen-closing Escape path while journal/gratitude is open
    - remove the repeat-3 activation animation path from `PlayerControls`
  - Exact fix made:
    - Updated the global `Escape` handler in `src/App.tsx` so it now leaves fullscreen alone while journal or gratitude is open, allowing the topmost surface to consume Escape first.
    - Added `Shift+Enter` save behavior to the Gratitude Journal composer and entry-edit textareas in `src/components/JournalModal.tsx`.
    - Removed the remaining local repeat-3 activation animation path from `src/components/PlayerControls.tsx`, leaving repeat flash behavior driven only by the off-state flash tick from `src/App.tsx`.
  - Exact files changed:
    - `src/App.tsx`
    - `src/components/JournalModal.tsx`
    - `src/components/PlayerControls.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It stays inside existing keyboard handlers and existing repeat presentation logic.
    - It does not redesign journal flow, modal stack, or repeat mode sequencing.
    - It fixes the exact desktop behavior seams only.
  - Regression risk:
    - Low.
    - Main QA is confirming Escape now respects surface order and that Shift+Enter only saves when the textarea has content.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - In Gratitude Journal composer on Safari desktop, press `Shift+Enter` and confirm it saves/closes.
    - Edit an existing Gratitude Journal note, press `Shift+Enter`, and confirm it saves/closes.
    - Open journal or gratitude from fullscreen, press `Escape`, and confirm the app returns to fullscreen instead of the main playlist page.
    - On desktop, cycle repeat and confirm the flash appears only when returning to `off`.

### 40. Import Return/Enter should submit more reliably across the import form
**Status:** diagnosis in progress

**Observed request:**
- Enter/Return currently seems to activate import only when the track title field is focused

**Desired behavior:**
- when the import form is armed, Enter/Return should submit reliably from the import form’s normal text-entry context, not just one field

**Codex notes:**
- Diagnosis start — 2026-04-12 Codex:
  - Files inspected:
    - `src/admin/AdminApp.tsx`
  - Findings:
    - The import form already has a shared `requestUploadSubmitFromKeyboard(...)` helper.
    - The title and artist inputs also call that helper directly.
    - The safest remaining seam is event timing/propagation across the import form, so the narrowest fix is to catch Enter earlier at the form level rather than widening field-specific logic again.
  - Narrow implementation plan:
    - move the import form keyboard-submit hook from bubble phase to capture phase
    - keep the same exclusions for textarea/range/file/tip controls
  - Exact fix made:
    - Updated the import form in `src/admin/AdminApp.tsx` to use `onKeyDownCapture={requestUploadSubmitFromKeyboard}` instead of bubble-phase `onKeyDown`.
    - Kept the same keyboard-submit helper and the same exclusions for textarea/range/file/tip controls.
  - Exact files changed:
    - `src/admin/AdminApp.tsx`
    - `docs/polyplay_release_tasks_2026-04-05.md`
  - Why this was the safest implementation:
    - It improves reliability at the form event seam without widening field-specific special cases again.
    - It does not change import behavior, only when the shared submit helper can intercept Enter/Return.
  - Regression risk:
    - Low.
    - Main QA is confirming Return now works from the broader import form without creating accidental submits from excluded controls.
  - QA completed:
    - `npm run typecheck`
  - QA still needed:
    - With the import form armed, press Enter/Return from Title and confirm Import runs.
    - Press Enter/Return from Artist and confirm Import runs.
    - Confirm excluded controls like artwork frame slider/file paths still do not trigger accidental submit.

**Follow-up diagnosis — 2026-04-11 Codex (Cinema looped-to-looped autoplay still pausing):**
- user reports a loop-selected track can advance correctly in Cinema Mode, but when the destination track also has an active loop it can still land paused
- the remaining likely seam is in `retryPendingAutoPlayIfNeeded(...)` inside `src/App.tsx`
- unlike the normal pending-autoplay path, the deferred looped-autoplay retry path currently treats any `audio.play()` rejection as terminal
- on iPhone, a looped-to-looped transition can still hit a transient `play()` rejection immediately after the loop-start seek, so the safest contained fix is to re-arm one short retry for the same pending track instead of dropping autoplay entirely

**Follow-up fix implemented — 2026-04-11 Codex (deferred looped-autoplay retry resilience):**
- Exact fix made:
  - Added a small local retry timer inside the audio listener effect in `src/App.tsx`.
  - When `retryPendingAutoPlayIfNeeded(...)` hits a `play()` rejection on iPhone for the still-current pending track, it now re-arms `pendingAutoPlayTrackIdRef` and schedules one short retry instead of terminating looped autoplay immediately.
  - Successful deferred autoplay now clears that retry timer.
- Exact files changed:
  - `src/App.tsx`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - It stays inside the existing deferred looped-autoplay path.
  - It does not alter navigation rules, Cinema Mode rules, or crop-workflow rules.
  - It only adds limited resilience for transient iPhone `play()` rejection timing during looped track transitions.
- Regression risk:
  - Low.
  - Main QA is confirming the retry does not cause double-start behavior and that non-looped playback remains unchanged.
- QA completed:
  - `npm run typecheck`
- QA still needed:
  - In Cinema Mode, let a loop-selected track advance into another loop-selected track and confirm the destination autoplay starts.
  - Confirm the destination still begins at its loop start.
  - Confirm non-looped next-track autoplay is unchanged.
  - Confirm non-cinema crop-workflow guard behavior remains intact.

**Follow-up diagnosis — 2026-04-11 Codex (manual track selection with active loop still pausing):**
- user reports tapping a track row/tile for a track with an active loop can still leave it paused instead of starting like a normal track
- the direct selection path still goes through `playTrack(trackId, true)`, so the remaining seam is in the looped pending-autoplay branch in `src/App.tsx`
- that branch currently always defers actual playback to the later retry path, even when the newly selected track already has enough metadata loaded to start immediately
- narrowest safe fix:
  - keep the deferred retry path for not-yet-ready media
  - but opportunistically start playback immediately for loop-selected tracks when metadata is already available, while still preserving loop-start seek behavior

**Follow-up fix implemented — 2026-04-11 Codex (immediate looped autoplay on ready direct selection):**
- Exact fix made:
  - Updated the looped pending-autoplay branch in `src/App.tsx` so it now seeks to the loop start immediately and, when the media element already has `HAVE_METADATA`, attempts `play()` right away instead of always waiting for the later retry path.
  - If that immediate play attempt still rejects on iPhone for the still-current target track, the app re-arms `pendingAutoPlayTrackIdRef` so the existing deferred retry path can continue.
- Exact files changed:
  - `src/App.tsx`
  - `docs/polyplay_release_tasks_2026-04-05.md`
- Why this was the safest implementation:
  - It stays inside the existing `playTrack(...)` / pending-autoplay flow.
  - It does not alter list-row UI, track selection behavior, or loop storage.
  - It only removes unnecessary waiting for loop-selected tracks that are already ready enough to start.
- Regression risk:
  - Low.
  - Main QA is confirming direct looped track taps now start cleanly without breaking the existing deferred retry behavior for not-yet-ready media.
- QA completed:
  - `npm run typecheck`
- QA still needed:
  - Tap a track row/tile with an active loop and confirm it starts automatically.
  - Confirm it begins at the loop start.
  - Confirm non-looped track taps still behave unchanged.
  - Confirm looped next-track autoplay still works in Cinema Mode and normal playback.

---

## End-of-day wrap
Before ending the session, update:
- DONE TODAY
- IMPLEMENTED, AWAITING QA
- STILL OPEN
- RECOMMENDED NEXT SESSION START
