# PolyPlay Codex Handoff - March 28, 2026 (Late)

## Current branch
`main`

## Remote / push state

`origin/main` is up to date through:

- `4353624` - `Refine welcome card and gratitude shell`
- `fef2aa7` - `Compact iPhone admin media tools`
- `9bd02c7` - `Fix settings regression and add playback shortcut`
- `cedb813` - `Tune dim audio and FX mode cues`
- `511feb6` - `Retint light mode aura accents`
- `f18a964` - `Retint light mode playback controls`

## Current local repo state

Worktree is effectively clean except for one untracked doc:

- [`docs/3-28-26-prelaunch-fixes-addendum.md`](/Users/paulfisher/Polyplay/docs/3-28-26-prelaunch-fixes-addendum.md)

That addendum is **not pushed** and currently contains 4 scaffolded open items:

1. admin/settings success toast visibility after actions like `Update Artwork`
2. update/replace/remove dropdowns should default to the currently playing track
3. iOS newly imported track can show `0:00` and fail on first tap
4. iOS Now Playing / Dynamic Island still-art audit

Important note:
- the addendum numbering collides with the main tracker
- [`docs/3-28-26-prelaunch-fixes.md`](/Users/paulfisher/Polyplay/docs/3-28-26-prelaunch-fixes.md) already documents through item 14
- next session should either fold the addendum into the main tracker or renumber it before using it as source of truth

## What was completed in the latest phase

### Desktop / iOS theme and control polish

- Light mode playback controls were retinted to a stronger neon-pink active language
- Light mode aura tokens were also retinted so aura visuals no longer stayed purple in light mode
- `DIM` playback volume was raised from `0.25` to `0.30`
- Header `FX` button now uses per-mode purple-family tinting:
  - `gravity`
  - `pop`
  - `splatter`
- Desktop `Spacebar` now toggles play/pause when focus is not inside editable/interactive controls

Relevant files:

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

### Settings / Admin follow-up fixes

- Desktop Safari Settings/Admin height was improved
- That desktop-only pass later regressed iPhone post-Vault Settings sizing
- The regression was fixed by scoping the newer Settings-height override back to desktop widths only
- A second iPhone issue remained after that:
  - `Manage Library` media tools were still too tall
  - `Update artwork` / `Replace audio` pushed lower controls offscreen
- That was fixed with a compact variant for manage-side replace-media drop zones

Relevant files:

- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css)
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
- [`src/admin/TransferLaneDropZone.tsx`](/Users/paulfisher/Polyplay/src/admin/TransferLaneDropZone.tsx)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

### Welcome / gratitude polish

- Safari desktop welcome card was tightened again so it reads more intentional and less like an oversized empty box
- Gratitude prompt shell now keeps a stable warm amber presence even after textarea blur

Relevant files:

- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

### Bubble engine prep

- Bubble simulation in [`src/lib/bubbles.ts`](/Users/paulfisher/Polyplay/src/lib/bubbles.ts) now supports:
  - real pairwise collisions on desktop
  - cheaper fake near-overlap deflection on phone/coarse-pointer devices
  - collisions off in reduced-motion contexts

Important caveat:
- this is **prep only**
- bubbles are still not actually live in the app right now
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) still has `const bubblesEnabled = false`
- there is also no active spawn event path currently feeding [`src/components/BubbleLayer.tsx`](/Users/paulfisher/Polyplay/src/components/BubbleLayer.tsx)

So if a later session wants actual bouncing bubbles, it needs to:

1. decide whether bubbles should be re-enabled at all
2. wire an actual spawn path
3. test perf on iPhone before shipping

### Remaining text-selection cleanup

- A stray selectable desktop control label (`Current Playlist`) was fixed
- General control non-selection behavior remains intentional

Relevant file:

- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

## Docs status

Primary release tracker:

- [`docs/3-28-26-prelaunch-fixes.md`](/Users/paulfisher/Polyplay/docs/3-28-26-prelaunch-fixes.md)

That file now includes documented items through:

- item 14: iPhone `Manage Library` media-tool compaction

Supplemental handoffs/findings still relevant:

- [`docs/3-28-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-28-26-codex-handoff.md)
- [`docs/3-27-26-settings-admin-bug-handoff.md`](/Users/paulfisher/Polyplay/docs/3-27-26-settings-admin-bug-handoff.md)
- [`docs/3-24-26-vault-restore-findings.md`](/Users/paulfisher/Polyplay/docs/3-24-26-vault-restore-findings.md)
- [`docs/3-27-26-ios-app-store-submission-checklist.md`](/Users/paulfisher/Polyplay/docs/3-27-26-ios-app-store-submission-checklist.md)

## Best next tasks

Most likely next open work, based on the new addendum:

1. Make admin/settings success feedback more visible after artwork update and similar actions
2. Default update/replace/remove dropdowns to the currently playing track
3. Investigate the iOS newly imported track `0:00` / first-tap playback bug
4. Audit whether still artwork can appear in iOS Now Playing / Dynamic Island

## Guardrails for the next Codex session

- Inspect first before editing
- Keep fixes narrow and release-safe
- Avoid unrelated changes
- Explicitly state whether each fix affects desktop, iOS, or both
- Run `npm run typecheck` before finishing
- If touching Settings/Admin again, preserve the current iPhone iframe sizing contract
- If touching bubbles, remember the collision work is present but the bubble layer is still dormant

## Suggested next-session starting prompt

```md
We are working on PolyPlay.

Read first:
- docs/polyplay-blueprint.md
- docs/polyplay-product-summary.md
- docs/3-24-26-vault-restore-findings.md
- docs/3-27-26-settings-admin-bug-handoff.md
- docs/3-28-26-prelaunch-fixes.md
- docs/3-28-26-late-codex-handoff.md

Branch:
- main

Current repo state:
- origin/main is up to date through commit 4353624
- one untracked doc exists: docs/3-28-26-prelaunch-fixes-addendum.md
- bubble collision prep exists in src/lib/bubbles.ts but bubbles are still disabled in src/App.tsx

Constraints:
- inspect first before editing
- keep fixes narrow and release-safe
- avoid unrelated changes
- explicitly state whether the final change affects desktop, iOS, or both
```
