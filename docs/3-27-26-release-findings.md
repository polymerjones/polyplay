# 3-27-26 Release Findings

## Overview

Today's work focused on late-stage release safety and polish for four areas:

- Vault export/import integrity
- active playlist restore on relaunch
- Vault/journal separation
- destructive playlist behavior and final UI polish
- iframe-mounted admin/settings sizing on iPhone

The main outcomes were:

- fresh Vault export was proven internally correct for the previously failing restored track
- clean reinstall + Vault import was proven to restore audio and saved loop markers correctly
- returning-user relaunch no longer needs to be forced back onto the demo playlist
- full Vault no longer includes journal data; standalone journal backup/import remains separate
- `Nuke Playlist` no longer wipes the entire library and now clears only the active playlist contents
- Settings / PolyPlay Admin no longer blows up or scrolls offscreen on iPhone after Vault import

## Major findings

- The old broken Vault archive issue was an export-stage media typing problem, not loop-state corruption.
- A fresh post-fix Vault ZIP stored the formerly failing track as `audio.m4a` with matching `ftypM4A` bytes, proving the archive was correct before import.
- The remaining restore uncertainty after that point was not export anymore. A clean device reinstall and import retest confirmed restored loop markers and playback were working.
- The earlier active-playlist relaunch bug was real. The saved `activePlaylistId` could be correct, but startup demo restore logic still forced the demo playlist active during normal returning-user relaunch.
- Full Vault and journal backup were overlapping in a risky way. Full Vault import replaced journal entries wholesale, while the standalone journal flow already had clearer overwrite semantics.
- The `Nuke Playlist` control was mislabeled and miswired. It called a full-library reset path that deleted all playlists and all tracks instead of only affecting the current playlist.
- The Settings/Admin blow-up after Vault flow was not caused by imported data.
- The earlier iframe/root sizing issue was real, but it was only a partial cause.
- Live runtime measurements on iPhone showed the actual failing contract:
  - iframe viewport stayed fixed
  - `body` became the scroll owner
  - `#admin-root` and `.admin-v1` expanded to full hydrated content height
  - `.admin-content` also expanded to full content height instead of owning scroll
- No single hydrated section was the root bug by itself. The real problem was that the admin shell/content wrapper were not constrained to iframe height, so the whole admin document behaved like one long page inside the iframe.
- A follow-up iPhone-specific UI issue also remained after that shell fix:
  - the Privacy Policy / Terms & Conditions bar was still `sticky` inside the new inner scroller
  - that made the legal links float in the middle of admin content
  - the correct fix was to return that bar to normal footer flow

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

### Settings / Admin iframe sizing

- Added a real iframe-document height chain for the admin surface.
- Added an initial hydration shell so the full manage view does not flash in progressively.
- Instrumented the iframe on device to capture live `clientHeight` / `scrollHeight` values for:
  - `html`
  - `body`
  - `#admin-root`
  - `.admin-v1`
  - `.admin-content`
  - major admin sections
- Confirmed the final root cause was the shell/content height and scroll contract, not Vault payloads and not any single section alone.
- Constrained the admin shell to iframe height and moved vertical scrolling to the inner `.admin-content` wrapper.
- Kept `body` and `#admin-root` non-scrolling so the iframe document no longer grows to the full hydrated content height.
- Fixed the legal-links bar so it sits in normal footer flow instead of sticking inside the middle of the scroll area.
- The final fix remained local to:
  - [`admin.html`](/Users/paulfisher/Polyplay/admin.html)
  - [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
  - [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css)
- This prevents the Settings/Admin blow-up and offscreen oversize on iPhone after Vault import while keeping the footer links positioned correctly.

## Cross-platform notes

- Vault export/import integrity work affects `both`.
- Active playlist relaunch fix affects `both`.
- Vault/journal separation affects `both`.
- `Nuke Playlist` fix affects `both`.
- Rows/Tiles guided glow and settings icon polish affect `both`.
- Admin/settings shell/content scroll fix affects `both`, with the visible failure and primary QA target on `iOS`.

## Remaining practical QA targets

- One more quick device sanity pass on the latest pushed Xcode build:
  - Rows/Tiles first-tap glow dismisses after first use
  - `Nuke Playlist` clears only the active playlist
  - returning-user relaunch stays on the last active playlist
  - Vault export/import still restores media and loops correctly
  - Settings / PolyPlay Admin opens without a live blow-up or offscreen oversize on iPhone
  - Privacy Policy / Terms & Conditions stay in a normal footer position inside Settings/Admin

## Risk

- Overall risk is `low to moderate` and concentrated in destructive-flow QA rather than broad architecture.
- The completed fixes were kept narrow and release-safe, but the `Nuke Playlist` path should still be sanity-checked on device because it now performs selective track deletion based on cross-playlist references.
