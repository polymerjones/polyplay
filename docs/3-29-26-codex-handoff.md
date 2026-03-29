# PolyPlay Codex Handoff - March 29, 2026 (Updated)

## Current branch / merge target

Work has been happening on:

- `march29fixes`

Release target:

- `main`

## Repo state right now

Pushed on `origin/march29fixes`:

- `1f47c46` - `Polish iOS artwork import and player gestures`

That pushed commit includes:

- native iOS artwork picker support via `PHPickerViewController`
- native artwork-file bridge plumbing in:
  - [`ios/App/App/PolyplayBridgeViewController.swift`](/Users/paulfisher/Polyplay/ios/App/App/PolyplayBridgeViewController.swift)
  - [`src/lib/iosMediaImport.ts`](/Users/paulfisher/Polyplay/src/lib/iosMediaImport.ts)
- admin wiring for native artwork selection in:
  - [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
- fullscreen swipe-dismiss tightening in:
  - [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)
- journal verse swipe gestures in:
  - [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- mini-player swipe up/down compact-toggle gestures in:
  - [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- verse-button visual adjustments in:
  - [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

Local worktree is still not fully clean.

Currently modified and not yet committed:

- [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

Those local-only changes are the latest follow-up after device testing:

- the mini-player header swipe gesture now actively prevents background page scroll while a valid vertical gesture is in progress
- the mini-player header gesture hotspot now also has `touch-action: none`
- the Bible verse buttons were moved slightly farther apart by increasing only their `gap`

Unrelated local items still present and intentionally not part of the app change set:

- [`docs/polyplayfixes/.obsidian/workspace.json`](/Users/paulfisher/Polyplay/docs/polyplayfixes/.obsidian/workspace.json)
- [`docs/polyplayfixes/POLYPLAY%20SUMMARY.md`](/Users/paulfisher/Polyplay/docs/polyplayfixes/POLYPLAY%20SUMMARY.md)
- [`priv mockups/verse buttons mock.jpg`](/Users/paulfisher/Polyplay/priv%20mockups/verse%20buttons%20mock.jpg)

## Latest verified state

Verified during this phase:

- `npm run typecheck` passed after:
  - native artwork picker integration
  - mini-player swipe up/down gestures
  - journal verse swipe gestures
  - playbar scroll-prevention follow-up
- `npm run "push xcode"` completed successfully after the latest CSS/player changes

## Most important current conclusions

### iOS artwork picker UX

- The extra artwork preview/check screen on iPhone is Apple/system UI, not PolyPlay UI
- With the current `PHPickerViewController` path, PolyPlay only receives the selected file after the picker flow completes
- That system preview is not realistically removable with a small tweak
- The safe path is:
  - keep the native picker
  - improve PolyPlay UI after the picker returns when needed

### Mini player gestures

- The original doc/history overstated the gesture state
- Fullscreen swipe-dismiss existed earlier, but the expanded mini/waveform player gesture had to be added separately
- The current local state now supports:
  - swipe down on the mini-player header area to collapse from waveform/expanded to compact
  - swipe up on the same header area to expand from compact back to waveform/expanded
- The latest local-only follow-up also tries to stop the page/background from scrolling during those gestures

### Bible verse controls

- Verse buttons remain half-circle previous/next controls
- User did not want circles and did not want broader visual redesign at this point
- The latest local-only ask was simple:
  - move the two verse buttons away from each other a little more
- Current local CSS change does exactly that by changing only the button-row `gap`

## Files most relevant right now

- [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css)
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
- [`src/lib/iosMediaImport.ts`](/Users/paulfisher/Polyplay/src/lib/iosMediaImport.ts)
- [`ios/App/App/PolyplayBridgeViewController.swift`](/Users/paulfisher/Polyplay/ios/App/App/PolyplayBridgeViewController.swift)

## Best next task

Most likely immediate next task:

1. verify on iPhone whether the latest `touch-action: none` plus `preventDefault()` follow-up actually eliminates background scroll during mini-player swipe gestures in row mode

If it still fails on device:

2. investigate a stronger non-passive native touch listener on the mini-player header only

Secondary likely next task:

3. merge the local `march29fixes` work into `main` if the current gesture follow-up is approved on device

## Guardrails for the next Codex session

- Inspect first before editing
- Do not sweep unrelated local docs/mockups into commits
- Preserve the current iOS artwork picker architecture unless there is a clearly proven bug
- Keep any further playbar gesture fix narrow to:
  - [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
  - [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css)
- Keep any further verse-button tweak narrow to:
  - [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- Run `npm run typecheck`
- If touching iOS-facing UI, run `npm run "push xcode"` after the change

## Suggested next-session starting prompt

```md
We are working on PolyPlay.

Read first:
- docs/3-29-26-codex-handoff.md
- docs/3-29-26-prelaunch-fixes-new-batch.md
- docs/3-28-26-prelaunch-fixes-airpods-vault-toast-bible.md

Branch:
- main

Current repo context:
- latest pushed feature branch work is on origin/march29fixes
- local follow-up changes exist in:
  - src/components/MiniPlayerBar.tsx
  - src/components/player.css
  - styles.css
- those local changes are specifically:
  - playbar gesture scroll prevention
  - `touch-action: none` on the mini-player header
  - a slightly larger gap between the Bible verse buttons

Task:
- verify or continue the narrow playbar-gesture scroll fix only

Constraints:
- inspect first before editing
- keep changes narrow
- do not redesign the player
- run npm run typecheck
- if updated for iPhone verification, run npm run "push xcode"
```
