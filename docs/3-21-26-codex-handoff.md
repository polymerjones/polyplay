# Polyplay Codex Handoff - March 21, 2026

## Current branch
`main`

## Merge status
- The iPhone playback stabilization work from `ios-playback-simplify` has already been merged into `main`
- `origin/main` was pushed successfully at commit `7b0b36f`
- `march21fixes` was created after that merge as the next working branch
- The release-polish work from `march21fixes` has now also been merged into `main`
- `origin/main` was later pushed successfully at commit `48406d9`

## What was just completed

### iPhone playback stabilization
- Replaced the fragile always-on iPhone `AudioContext -> MediaElementSource -> GainNode` dependency with direct HTML audio element playback as the primary iPhone path
- Kept desktop behavior intact
- Added centralized playback resync logic in `src/App.tsx`
- Deduped/scheduled app-return resync so `visibilitychange` and `focus` do not double-trigger recovery on iPhone

### iPhone DIM behavior
- True soft DIM was removed on iPhone because `audio.volume` attenuation is not dependable there once the fragile gain-node path is removed
- iPhone DIM now degrades cleanly to:
  - `normal -> mute -> normal`
- Desktop still uses:
  - `normal -> dim -> mute -> normal`
- Shared UI was updated so iPhone no longer misleadingly implies a working soft-dim state

### In-app confirm cleanup already merged
- Gratitude Journal overwrite confirm now uses an in-app modal instead of native `window.confirm`
- Admin destructive confirms replaced so these no longer use native blocking dialogs:
  - Delete Playlist
  - Remove selected track
  - Remove track from Manage Storage
  - Remove all demo tracks

### Other already-merged fixes
- Journal background now uses the silent replacement asset:
  - `/demo/clouds2replaced.mp4`
- Light-mode player icon contrast was improved

### Additional March 21 release-polish work now merged
- Settings/admin `Contact Polymer Jones` CTA now reuses the app's amber highlighted/onboarding CTA treatment
- Settings/admin contact CTA was made reliably reachable/tappable in the iframe/modal flow
- Fullscreen light-theme text contrast was tightened for:
  - title
  - metadata line
  - seek-bar time labels
- See:
  - [`docs/3-21-26-ui-polish-discoveries.md`](/Users/paulfisher/Polyplay/docs/3-21-26-ui-polish-discoveries.md)

## Files most relevant to the current playback architecture
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/components/PlayerControls.tsx`](/Users/paulfisher/Polyplay/src/components/PlayerControls.tsx)
- [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- [`ios/App/App/AppDelegate.swift`](/Users/paulfisher/Polyplay/ios/App/App/AppDelegate.swift)

## Current product/technical conclusion
- Standard iOS background audio entitlement/session is not the blocker
- The fragile part was the iPhone Web Audio routing dependency, not the existence of the shared HTML audio element
- Reliability-first direction for iPhone is:
  - keep direct element playback
  - keep centralized resync
  - avoid reintroducing full-time gain-node routing

## Guardrails for the next Codex session
- Inspect first before editing
- Keep fixes narrow
- Avoid unrelated changes
- Prioritize iPhone playback reliability
- Do not reintroduce the old fragile full gain-node dependency on iPhone
- Preserve desktop behavior unless a change is clearly necessary
- State whether each change affects desktop, iOS, or both
- Run `npm run typecheck` before finishing

## Known repo state to ignore
These were present as unrelated untracked items during the handoff creation:
- `docs/3-12-26 notes`
- `docs/3-12-26 notes.md`
- `docs/polyplayfixes/`
- `ios/App/App.xcodeproj/xcshareddata/`
- `logomock.png`
- `march11_2026_devhandoffs/`
- `public/demo/demo-audio.mp3`
- `public/demo/demo-still.jpg`

Do not sweep these into a commit unless explicitly asked.

## Suggested next-session starting prompt
```md
We are working on Polyplay.

Read first:
- docs/polyplay-blueprint.md
- docs/polyplay-product-summary.md
- docs/3-18-26-release-discoveries.md
- docs/3-21-26-codex-handoff.md
- docs/3-21-26-ui-polish-discoveries.md

Branch:
- main

Constraints:
- inspect first before editing
- keep fixes narrow
- avoid unrelated changes
- prioritize iPhone playback reliability
- do not reintroduce the old fragile gain-node dependency
- explicitly state whether the final change affects desktop, iOS, or both
```

## Quick QA reminder
- iPhone app switch / return while audio is playing
- iPhone play -> pause after app return
- iPhone MUTE toggle behavior
- iPhone Gratitude import overwrite flow
- Admin destructive confirms
- Desktop sanity pass for playback, DIM, and light-mode controls
- Settings/admin contact CTA reachability on iPhone
- Fullscreen light-theme readability for title, metadata, and slider time labels
