# 3-27-26 Release Findings

## Overview

Today's work focused on late-stage release safety and polish for four areas:

- Vault export/import integrity
- active playlist restore on relaunch
- Vault/journal separation
- destructive playlist behavior and final UI polish

The main outcomes were:

- fresh Vault export was proven internally correct for the previously failing restored track
- clean reinstall + Vault import was proven to restore audio and saved loop markers correctly
- returning-user relaunch no longer needs to be forced back onto the demo playlist
- full Vault no longer includes journal data; standalone journal backup/import remains separate
- `Nuke Playlist` no longer wipes the entire library and now clears only the active playlist contents

## Major findings

- The old broken Vault archive issue was an export-stage media typing problem, not loop-state corruption.
- A fresh post-fix Vault ZIP stored the formerly failing track as `audio.m4a` with matching `ftypM4A` bytes, proving the archive was correct before import.
- The remaining restore uncertainty after that point was not export anymore. A clean device reinstall and import retest confirmed restored loop markers and playback were working.
- The earlier active-playlist relaunch bug was real. The saved `activePlaylistId` could be correct, but startup demo restore logic still forced the demo playlist active during normal returning-user relaunch.
- Full Vault and journal backup were overlapping in a risky way. Full Vault import replaced journal entries wholesale, while the standalone journal flow already had clearer overwrite semantics.
- The `Nuke Playlist` control was mislabeled and miswired. It called a full-library reset path that deleted all playlists and all tracks instead of only affecting the current playlist.

## Fixes completed

### Vault export / restore integrity

- Verified fresh Vault export produced a correct `.m4a` media entry for the previously failing track.
- Confirmed clean factory-reset-style import restored audio correctly.
- Confirmed saved loop markers were recalled correctly after import.

### Returning-user relaunch

- Narrowed the demo restore path so normal returning-user startup preserves a valid saved active playlist.
- Preserved true first-run/demo onboarding behavior by keeping demo-active forcing only where explicitly intended.

### Vault / journal separation

- Removed journal entries from full Vault export.
- Removed journal restore from full Vault import.
- Left standalone journal backup/import unchanged.
- Updated in-app Vault copy and key docs so Vault now describes playlists, media, and app settings only.

### Nuke Playlist behavior

- Replaced the full-library reset wiring behind `Nuke Playlist`.
- `Nuke Playlist` now clears only the active playlist contents.
- The playlist itself remains.
- Other playlists remain intact.
- Tracks shared by other playlists are preserved.
- Unshared tracks from the cleared playlist are removed from storage.

### Release polish

- Added first-tap guided glow behavior to the Rows/Tiles layout toggle using the existing persisted hint system.
- Continued final settings icon refinement so the gear reads more clearly at iPhone size without changing button behavior.

## Cross-platform notes

- Vault export/import integrity work affects `both`.
- Active playlist relaunch fix affects `both`.
- Vault/journal separation affects `both`.
- `Nuke Playlist` fix affects `both`.
- Rows/Tiles guided glow and settings icon polish affect `both`.

## Remaining practical QA targets

- One more quick device sanity pass on the latest pushed Xcode build:
  - Rows/Tiles first-tap glow dismisses after first use
  - `Nuke Playlist` clears only the active playlist
  - returning-user relaunch stays on the last active playlist
  - Vault export/import still restores media and loops correctly

## Risk

- Overall risk is `low to moderate` and concentrated in destructive-flow QA rather than broad architecture.
- The completed fixes were kept narrow and release-safe, but the `Nuke Playlist` path should still be sanity-checked on device because it now performs selective track deletion based on cross-playlist references.
