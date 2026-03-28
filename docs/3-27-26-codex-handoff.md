# Polyplay Codex Handoff - March 27, 2026

## Note

- A newer handoff now exists at [`docs/3-28-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-28-26-codex-handoff.md).
- Use that March 28 handoff as the current source of truth for the latest admin/layout fixes, release state, and outstanding local repo notes.

## Current branch
`main`

## Remote / merge status

- `origin/main` is pushed at commit `4d370b5`
- commit message:
  - `Release polish and vault fixes`

## Current local repo state

- One additional local code change exists and is **not committed yet**:
  - [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx)
- That local change resets stale gratitude prompt text so a new prompt session starts blank
- Several unrelated untracked items are still present and should continue to be ignored unless explicitly requested

## What was completed in this phase

### Vault integrity

- Fresh Vault export was verified for the previously failing restored track
- The track exported as `audio.m4a` instead of `audio.bin`
- Clean reinstall + Vault import was proven to restore audio correctly
- Saved loop markers were proven to restore correctly

### Returning-user relaunch

- Fixed the startup demo-restore override so returning users keep their saved active playlist on relaunch
- Preserved true first-run/demo onboarding behavior

### Vault / journal separation

- Full Vault no longer exports journal data
- Full Vault no longer restores/replaces journal data
- Standalone journal backup/import remains separate
- In-app Vault copy and key docs were updated accordingly

### Playlist destruction bug

- `Nuke Playlist` was fixed
- It now clears only the active playlist contents
- It keeps the playlist itself
- It preserves other playlists
- It preserves tracks that are still referenced by other playlists

### Release polish

- Splash skip copy was made platform-specific:
  - iOS: `Double Tap to Skip`
  - desktop: `Double Click to Skip`
- Splash sound control was converted to an icon toggle
- Light-mode playlist selector was polished
- Theme/settings icon cleanup was performed
- Rows/Tiles layout toggle now uses the existing first-tap guided glow system

## Additional findings from later audits

### Demo Playlist in Vault

- Full Vault currently does **not** include Demo Playlist in the saved snapshot
- Root cause is export-time sanitization in [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
- `sanitizeLibraryForFullBackup()` strips demo tracks and Demo Playlist before `library.json` is written
- Import also re-applies that sanitizer
- Any later Demo Playlist appearance comes from demo-seed logic, not true Vault restore
- No fix was applied for this

### Gratitude prompt stale text

- The stale-text issue was real
- Root cause:
  - [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx) remained mounted
  - its local `text` state was never reset across close/reopen
- A narrow local fix was applied but is currently **uncommitted**

### Settings / Admin iframe sizing

- The post-Vault Settings/Admin blow-up was confirmed to be a live iframe/layout bug, not a bad imported Vault payload
- Root cause:
  - an earlier iframe/root sizing problem did exist:
    - the iframe document lacked a proper `html/body/#admin-root` height chain
    - [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) used `min-h-screen`
  - but iPhone runtime measurements later proved that was only a partial cause
  - the actual failing contract was:
    - `body` became the scroll owner inside the iframe
    - `#admin-root` and `.admin-v1` expanded to full hydrated content height
    - `.admin-content` also expanded to full content height instead of owning scroll
  - the whole admin page therefore behaved like one giant long document inside the iframe after hydration
- A narrow fix was applied:
  - [`admin.html`](/Users/paulfisher/Polyplay/admin.html) now marks the iframe document explicitly
  - [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) now gives the admin iframe document a real height chain and constrains the admin shell to iframe height
  - [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now wraps the hydrated admin sections in an inner `.admin-content` scroller
  - the Privacy Policy / Terms & Conditions links were also returned to normal footer flow instead of staying sticky inside the new scroll area
- This fix affects `both`, with the visible bug most pronounced on `iOS`

## Files most relevant to the current release state

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
- [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts)
- [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx)
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- [`src/components/SplashOverlay.tsx`](/Users/paulfisher/Polyplay/src/components/SplashOverlay.tsx)
- [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- [`admin.html`](/Users/paulfisher/Polyplay/admin.html)
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css)

## Guardrails for the next Codex session

- Inspect first before editing
- Keep fixes narrow and release-safe
- Avoid unrelated changes
- Do not redesign Vault architecture or onboarding/demo architecture during release polish
- Explicitly state whether each finding/change affects desktop, iOS, or both
- Run `npm run typecheck` before finishing

## Known repo state to ignore

These are currently untracked and should not be swept into a commit unless explicitly requested:

- `docs/3-12-26 notes`
- `docs/3-12-26 notes.md`
- `docs/polyplayfixes/`
- `ios/App/App.xcodeproj/xcshareddata/`
- `logomock.png`
- `march11_2026_devhandoffs/`
- `polyplay-gratitude-2026-03-27.json`
- `priv mockups/`
- `public/demo/demo-audio.mp3`
- `public/demo/demo-still.jpg`

## Suggested next-session starting prompt

```md
We are working on Polyplay.

Read first:
- docs/polyplay-blueprint.md
- docs/polyplay-product-summary.md
- docs/3-21-26-codex-handoff.md
- docs/3-22-26-release-discoveries.md
- docs/3-24-26-vault-restore-findings.md
- docs/3-27-26-release-findings.md
- docs/3-27-26-codex-handoff.md

Branch:
- main

Constraints:
- inspect first before editing
- keep fixes narrow and release-safe
- avoid unrelated changes
- explicitly state whether the final change affects desktop, iOS, or both
```

## Practical next steps

1. Decide whether to commit the local gratitude prompt reset in [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx).
2. Do a final device sanity pass on the latest Xcode build:
   - Settings/Admin should stay constrained to the iframe height after Vault import
   - the legal links should sit at the footer instead of floating mid-content
3. Use the App Store submission checklist in [`docs/3-27-26-ios-app-store-submission-checklist.md`](/Users/paulfisher/Polyplay/docs/3-27-26-ios-app-store-submission-checklist.md).
