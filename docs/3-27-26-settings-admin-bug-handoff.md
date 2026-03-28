# 3-27-26 Settings / Admin Bug Handoff

We are working on Polyplay.

## Read first
- docs/polyplay-blueprint.md
- docs/polyplay-product-summary.md
- docs/3-21-26-codex-handoff.md
- docs/3-22-26-release-discoveries.md
- docs/3-24-26-vault-restore-findings.md
- docs/3-27-26-release-findings.md
- docs/3-27-26-codex-handoff.md

## Branch
- `main`

## Constraints
- inspect first before editing
- diagnosis-first
- do not guess
- keep any eventual fix narrow and release-safe
- do not redesign Vault or admin architecture broadly
- explicitly state whether findings affect desktop, iOS, or both

## Current high-priority unresolved issue
Settings / PolyPlay Admin still blows up visually on iPhone after Vault import.

## Confirmed repro
1. Fresh/current build on iPhone
2. Import a Vault
3. Open Settings / PolyPlay Admin
4. As Settings opens, the admin surface visibly jumps/blows up larger on screen

## Important
- this is still unresolved
- prior fixes were real but not sufficient
- do not assume the iframe/root fix solved it
- use the current repro as truth

## What has already been proven
1. The bug is not a bad imported Vault payload.
2. The bug is not explained only by the earlier hardcoded iframe height math.
3. A real iframe/root sizing issue did exist:
   - admin iframe document lacked a proper `html/body/#admin-root` height chain
   - `AdminApp` used `min-h-screen` inside the iframe
   - that was partially fixed
4. A second issue also exists:
   - after Vault import, `AdminApp` hydrates a much larger dataset on mount
   - tracks, playlists, storage rows, selects, and other large sections populate after first paint
   - this creates a visible live reflow in Safari/WebKit
5. A loading-shell / initial hydration gate was attempted, but the issue still persists in device testing.

## Recent attempted fixes already in the codebase
- `admin.html`
  - added explicit iframe-document classes
- `src/index.css`
  - added `html/body/#admin-root` height chain for admin iframe document
- `src/admin/AdminApp.tsx`
  - changed admin root from `min-h-screen` to `min-h-full`
  - added initial hydration loading gate before rendering full admin sections

## Current conclusion
- the remaining trigger is still happening after those fixes
- we need the exact difference between normal Settings open and post-Vault-import Settings open
- focus on global post-import state, live mount behavior, and any WebKit-specific layout trigger that still survives

## Please inspect next
1. full Vault import completion path in `src/App.tsx` and `src/lib/backup.ts`
2. all restored config/settings values applied after import
3. `html`/`body`/root classes, data attributes, inline styles, CSS vars, scroll locks, safe-area/viewport effects
4. settings overlay open path
5. iframe mount path
6. admin root sizing and first-paint behavior
7. exact difference between:
   - opening Settings normally
   - opening Settings after Vault import

## Specific suspicion to verify or disprove
- import restores UI state that changes the parent page or iframe presentation before/during admin open
- something global left behind after import still interacts with the admin iframe on iPhone
- the remaining issue may involve restored theme/layout/player-height state, not just admin content hydration

## Do not do
- do not propose another speculative CSS tweak without proving the exact trigger
- do not stop at “iframe hydration” unless you can explain why the loading gate did not eliminate the visible issue

## Desired output
- exact difference between normal Settings open and post-import Settings open
- exact failing stage
- exact root cause
- exact fix only if clearly proven
- desktop / iOS / both
- regression risk

## Before finishing
- run `npm run typecheck`
