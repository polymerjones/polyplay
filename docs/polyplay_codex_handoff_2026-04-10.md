# PolyPlay Codex Handoff — 2026-04-10

## Session mode
Stabilization / release polish remained the operating mode.

Constraints followed:
- no new features unless explicitly redirected
- no broad redesign
- one task at a time
- diagnosis first for risky issues
- containment over cleverness
- no auto-commit

Primary control sheets:
- `/Users/paulfisher/Polyplay/docs/polyplay_control_center.md`
- `/Users/paulfisher/Polyplay/docs/polyplay_release_tasks_2026-04-05.md`

## Repo state
- branch: `main`
- working tree is dirty
- latest work is uncommitted

## What changed in the latest passes

### 1. Import-page storage indicator
- `src/admin/AdminApp.tsx`
- Import page now shows:
  - used / limit
  - remaining
  - subtle progress bar
- Reuses existing `storageUsage` summary only

### 2. Repeat-button FX parity
- `src/components/PlayerControls.tsx`
- Repeat toggle now triggers the same sparkle/flash confirmation path on every repeat state change
- Existing `repeat-3` activation styling remains intact

### 3. Full vault backup iPhone containment
- `src/lib/backup.ts`
- `src/admin/AdminApp.tsx`
- `src/App.tsx`
- Full vault backup now uses a stricter constrained-mobile safe cap before `buildZip(...)`
- Current constrained-mobile safe cap:
  - `192 MB`
- Oversized full backups now fail safely via `BackupSizeError` instead of crashing WebView during zip assembly
- User-facing copy now says `safe export limit`

### 4. Playlist backup theme + loop recall
- `src/lib/storage/library.ts`
- `src/lib/db.ts`
- `src/lib/backup.ts`
- `src/lib/playlistState.ts`
- `src/App.tsx`
- `src/admin/AdminApp.tsx`

What landed:
- playlists now support optional `themeSelection`
- new playlists default to the current theme
- active-playlist theme changes persist onto that playlist
- switching playlists in the main app applies the playlist-owned theme
- `.polyplaylist` archive now carries embedded playlist config
- playlist backup import/export now preserves:
  - playlist theme selection
  - loop state for imported tracks
- backup UI labels now say `Playlist Backup`
- default playlist-backup filenames now use:
  - `playlistname-date-polyplaylist.polyplaylist`

### 5. Playlist-backup controls moved to Vault
- `src/App.tsx`
- `src/admin/AdminApp.tsx`

What changed:
- `Export Playlist Backup` and `Import Playlist Backup` now live on the main Vault overlay
- the same functionality was removed from admin/settings backups

Why this mattered:
- users expect backup actions to live on the Vault surface
- this keeps one clear home for playlist backup import/export

### 6. Playlist-backup save-name + import-picker polish
- `src/App.tsx`

What changed:
- Vault-page playlist backup export now uses the same inline deferred save-name flow as full vault backup on iPhone-like devices
- playlist backup now presents a real editable default filename before saving:
  - `playlistname-date-polyplaylist.polyplaylist`
- playlist-backup save/import accept compatibility was broadened to include `application/octet-stream` alongside `.polyplaylist` / zip types

Why this mattered:
- the direct prompt path on iPhone skipped the user-facing naming step
- saved `.polyplaylist` files needed a more permissive picker accept path for reliable re-import

### 7. Playlist-import success countdown parity
- `src/App.tsx`

What changed:
- playlist-backup import now starts the same 2-second auto-close countdown used by full vault import
- the shared countdown card now uses a tiny success-title state so it can say:
  - `Vault imported successfully`
  - `Playlist imported successfully`

Why this mattered:
- playlist import was succeeding but leaving the Vault overlay open without the same closing confirmation flow
- the countdown UI previously had vault-only wording baked into it

### 8. Imported-playlist theme switch unlock
- `src/App.tsx`

What changed:
- active-playlist theme changes now update the playlist’s in-memory `themeSelection` immediately
- admin iframe theme-change messages now also sync that in-memory playlist theme state

Why this mattered:
- imported playlists could feel theme-locked because the active-playlist recall effect was reading stale `runtimeLibrary` theme state and snapping the UI back after a manual change
- this keeps playlist theme recall while allowing the user to change the theme on the active playlist normally

### 9. Missing-artwork copy removed from player surfaces
- `src/components/MiniPlayerBar.tsx`
- `src/components/FullscreenPlayer.tsx`

What changed:
- removed visible `Missing artwork` copy from mini player
- removed visible `Missing artwork` copy from fullscreen metadata
- kept `missingArt` state intact for non-player diagnostics/admin use

Why this mattered:
- imported playlist tracks can fall back cleanly to default artwork
- the warning copy was noisy in normal playback even when the UI still had a valid visual fallback

### 10. Playlist-level reverse-order toggle
- `src/lib/storage/library.ts`
- `src/lib/playlistState.ts`
- `src/lib/db.ts`
- `src/App.tsx`
- `src/admin/AdminApp.tsx`
- `styles.css`

What changed:
- playlists now support a persisted `isReversed` flag
- visible playlist tracks and playback navigation both derive order from a shared copied-reverse helper
- source `trackIds` are never mutated in place
- a `Reverse Order` checkbox now lives in the existing playlist manager row in admin/settings

Why this mattered:
- users needed some clean way to flip playlist order without cluttering tiles or adding per-track controls
- the admin playlist manager was the cleanest existing surface for a reversible playlist-view preference

### 11. Playlist-backup filename suffix + Gratitude prompt lag polish
- `src/lib/backup.ts`
- `src/components/GratitudePrompt.tsx`
- `src/App.tsx`

What changed:
- playlist-backup filenames now end with:
  - `-polyplay.polyplaylist`
- Gratitude prompt no longer applies the `is-typing` shimmer overlay
- Gratitude typing no longer triggers the extra reactive body effect on each keystroke
- Gratitude typing now uses a small local border pulse only

Why this mattered:
- the old filename suffix was awkward and redundant
- the Gratitude prompt felt laggy and visually noisy because it was layering two separate typing effects

### 12. Import-page Enter/Return submit reliability
- `src/admin/AdminApp.tsx`

What changed:
- added a shared keyboard-submit helper for the import form
- wired Title and Artist inputs to trigger Import on Enter/Return
- added `enterKeyHint="done"` on those inputs for iOS keyboards

Why this mattered:
- Enter/Return was no longer reliably activating Import from the import form fields
- this restores expected desktop and iOS keyboard behavior without changing import logic

## Important current behavior

### Full vault backup on iPhone
- Smaller full backups should still export
- Oversized full backups should now fail safely before zip build
- This is containment only, not a new export architecture

### Playlist backups
- Import remains additive
- Import should create a new playlist, not overwrite existing playlists
- Playlist activation should apply stored playlist theme
- Imported loops should be restored onto the newly created local track ids

## Highest-value QA next
1. Run iPhone QA for playlist-owned theme switching:
   - create two playlists with different themes
   - confirm switching playlists changes theme automatically
2. Verify playlist theme persistence:
   - change theme while playlist A is active
   - switch away and back
   - confirm playlist A recalls that theme
3. Verify playlist backup import/export:
   - export a playlist backup
   - confirm filename format
   - confirm Vault shows the inline naming step on iPhone before save
   - import into an existing library
   - confirm new playlist is added, not overwritten
   - confirm loops are restored
   - confirm imported playlist theme is recalled
4. Re-test smaller full vault backup on iPhone
5. Re-test oversized full vault backup on iPhone and confirm safe-limit error instead of crash

## Known constraints still in force

### Long audio crop on iPhone
- still intentionally blocked for long sources
- do not reopen architecture in stabilization mode

### Full vault backup on iPhone
- large in-memory zip assembly is still fundamentally constrained by JS/WebView memory
- current release strategy is safe blocking, not solving large backup generation generally

## Recommended next-task order
1. QA playlist theme/loop recall thoroughly
2. QA playlist backup import/export thoroughly
3. Verify full-backup safe-limit containment on device
4. Only then resume smaller polish or submission prep

## Notes for next Codex session
- Read the control center first
- Then read the release board
- Keep scope narrow
- Do not revert lazy hydration
- Do not reopen backup architecture unless explicitly asked
