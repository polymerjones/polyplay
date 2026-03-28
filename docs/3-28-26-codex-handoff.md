# Polyplay Codex Handoff - March 28, 2026

## Current branch
`main`

## Remote / merge status

- `origin/main` includes the recent admin/layout work:
  - `6897b43` - `Polish admin file dropzone feedback`
  - `a531fcf` - `Fix admin iframe layout on iPhone`
  - `0a37307` - `Add handoff docs and gratitude prompt reset`

## Current local repo state

- Two tracked local diffs currently exist and are **not committed**:
  - [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
  - [`docs/3-27-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-27-26-codex-handoff.md)
- The remaining local code diff in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) appears to do two things:
  - adjusts repeat/loop behavior so `audio.loop` only mirrors true track-loop mode, while repeat restart applies `dimMode` explicitly on replay
  - changes Vault export status copy:
    - adds `Zipping backup now.`
    - changes `Backup opened...` to `Backup ready...`
- The tracked doc diff in [`docs/3-27-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-27-26-codex-handoff.md) only adds a note pointing future sessions to this March 28 handoff as the current source of truth.
- Several unrelated untracked items are present and should continue to be ignored unless explicitly requested:
  - `docs/3-12-26 notes`
  - `docs/3-12-26 notes.md`
  - `docs/3-27-26-desktop-safari-bugs.md`
  - `docs/3-27-26-settings-admin-bug-handoff.md`
  - `docs/polyplayfixes/`
  - `ios/App/App.xcodeproj/xcshareddata/`
  - `logomock.png`
  - `march11_2026_devhandoffs/`
  - `polyplay-gratitude-2026-03-27.json`
  - `priv mockups/`
  - `public/demo/demo-audio.mp3`
  - `public/demo/demo-still.jpg`
- This March 28 handoff file is also currently untracked and would need to be added explicitly if it should ship with the repo state.

## What was completed in the latest phase

### Settings / Admin iframe layout

- The earlier iframe/root sizing explanation was proven incomplete.
- Live iPhone runtime measurements showed the real issue:
  - the iframe viewport stayed fixed
  - `body` became the scroll owner
  - `#admin-root`, `.admin-v1`, and `.admin-content` expanded to full hydrated content height
- The narrow fix that shipped:
  - [`admin.html`](/Users/paulfisher/Polyplay/admin.html) marks the iframe document explicitly
  - [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) constrains the iframe document/root chain and makes `.admin-v1` fill the iframe height
  - [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) wraps the hydrated manage view in a dedicated `.admin-content` scroller
- Follow-up footer issue was fixed too:
  - Privacy Policy / Terms & Conditions no longer float mid-content
  - they now sit in normal footer flow inside Settings/Admin
- This work affects `both`, with the visible failure and QA priority on `iOS`

### Admin drop zone armed-state polish

- Added a loaded / armed state for the relevant media drop zones:
  - Import Track audio
  - Import Track artwork
  - Update Artwork
  - Replace Audio
- Added matching amber action-button hinting when the corresponding file is loaded
- The state clears automatically when:
  - the file is cleared
  - the file is replaced with none
  - the action completes successfully
- Implementation is local to:
  - [`src/admin/TransferLaneDropZone.tsx`](/Users/paulfisher/Polyplay/src/admin/TransferLaneDropZone.tsx)
  - [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
  - [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- This work affects `both`

### Docs updated

- Findings/handoff docs were updated to reflect the measured admin shell/content root cause instead of the earlier partial theory:
  - [`docs/3-27-26-release-findings.md`](/Users/paulfisher/Polyplay/docs/3-27-26-release-findings.md)
  - [`docs/3-27-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-27-26-codex-handoff.md)

## Files most relevant right now

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
- [`src/admin/TransferLaneDropZone.tsx`](/Users/paulfisher/Polyplay/src/admin/TransferLaneDropZone.tsx)
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- [`admin.html`](/Users/paulfisher/Polyplay/admin.html)
- [`docs/3-27-26-release-findings.md`](/Users/paulfisher/Polyplay/docs/3-27-26-release-findings.md)
- [`docs/3-27-26-ios-app-store-submission-checklist.md`](/Users/paulfisher/Polyplay/docs/3-27-26-ios-app-store-submission-checklist.md)

## Guardrails for the next Codex session

- Inspect first before editing
- Keep fixes narrow and release-safe
- Avoid unrelated changes
- Do not redesign Vault architecture or admin architecture broadly during release prep
- Explicitly state whether each finding/change affects desktop, iOS, or both
- Run `npm run typecheck` before finishing

## Practical next steps

1. Decide whether the remaining local [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) diff is intended for release or should stay out.
2. Do a final iPhone sanity pass on the latest Xcode build:
   - Settings/Admin stays constrained after Vault import
   - legal footer sits correctly
   - armed-state drop zones and buttons feel good on device
3. Walk the checklist in [`docs/3-27-26-ios-app-store-submission-checklist.md`](/Users/paulfisher/Polyplay/docs/3-27-26-ios-app-store-submission-checklist.md).

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
- docs/3-28-26-codex-handoff.md

Branch:
- main

Constraints:
- inspect first before editing
- keep fixes narrow and release-safe
- avoid unrelated changes
- explicitly state whether the final change affects desktop, iOS, or both

Current repo note:
- there is still one uncommitted tracked diff in src/App.tsx
- do not sweep unrelated untracked files into a commit
```
