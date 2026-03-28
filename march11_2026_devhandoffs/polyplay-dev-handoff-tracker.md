# Polyplay Dev Handoff Tracker

## Current branch
`march11fixes`

## Current priority
Fix iPhone/mobile behavior issues before more onboarding polish.

## Active issue list

### 1) Onboarding does not appear on iPhone
**Observed:** Real iPhone test did not trigger onboarding.

**Current understanding:**
- Onboarding visibility is gated by `!hasOnboarded && !isEmptyWelcomeDismissed && (!hasTracks || isInitialDemoFirstRunState)` in `src/App.tsx`
- `hasOnboarded` comes from `localStorage.getItem("polyplay_hasOnboarded_v1") === "true"`
- `isInitialDemoFirstRunState` depends on:
  - Demo Playlist active
  - `HAS_IMPORTED_KEY !== true`
  - `hasOnboarded === false`
  - demo tracks present
  - zero non-demo tracks

**Likely cause:** Persisted state on iPhone/PWA is suppressing first-run onboarding.

**Files involved:**
- `src/App.tsx`

**Status:** In progress

---

### 2) Vault Export not working on iPhone
**Observed:** Vault Export failed on real iPhone.

**Current understanding:**
- Export path is `exportFullBackup()` -> `saveBlobWithBestEffort()`
- Current fallback chain:
  1. `navigator.share({ files })`
  2. `window.showSaveFilePicker`
  3. anchor/blob download fallback

**Likely cause:** Current save/export path is desktop-biased and unreliable on iPhone Safari / PWA.

**Files involved:**
- `src/App.tsx`
- `src/lib/backup.ts`

**Status:** In progress

---

### 3) Count-based file/export limit may be missing
**Observed:** With 1 song present, expected file-limit/export behavior did not seem enforced.

**Current understanding:**
- Only confirmed guard found so far is byte-size cap in `src/lib/backup.ts`
- `BACKUP_CAP_BYTES` exists
- No confirmed count-based export guard currently found in export path

**Likely cause:** Missing feature rather than subtle iOS-only bug.

**Files involved:**
- `src/lib/backup.ts`
- `src/App.tsx`

**Status:** Needs explicit rule / implementation

**Rule decision needed:**
- What is the intended count-based rule?
- Examples:
  - minimum required song count before export
  - free-tier/import cap rule
  - demo-only export restriction

---

### 4) Vault status/toast is misaligned on iPhone
**Observed:** Vault message looks visually off on mobile.

**Current understanding:**
- `vaultStatus` currently renders inline in `src/App.tsx`
- Styled via `.vault-status`
- Not currently a true toast system for this flow

**Likely cause:** Inline layout/padding is being used instead of a mobile-safe toast container.

**Files involved:**
- `src/App.tsx`
- `styles.css`
- possibly `src/index.css`

**Status:** In progress

---

### 5) Error toasts need stronger visual distinction
**Observed:** Error feedback should stand out more.

**Desired direction:**
- premium purple / pink / magenta visual family
- distinct from success/info
- readable, not cheap-looking
- centered and safe-area aware on iPhone

**Files involved:**
- `styles.css`
- any shared toast utility/component if introduced or found

**Status:** Planned

---

## Confirmed inspection findings
- Inspection on `main` and `march11fixes` was materially the same
- Current branch for implementation is `march11fixes`
- `march11fixes` was ahead of `origin/march11fixes` by 1 commit before this implementation pass

## Guardrails for Codex
- Do not touch unrelated demo seed logic
- Do not broaden scope into general onboarding polish unless required for mobile fixes
- Do not break desktop behavior
- Keep changes targeted and production-safe
- Inspect first, then implement

## Suggested workflow log

### Latest sequence
1. Verified current branch was accidentally `main`
2. Switched back to `march11fixes`
3. Re-ran inspection on correct branch
4. Confirmed findings were materially the same
5. Started implementation pass for mobile/onboarding/export/toast fixes

## Implementation summary placeholder
Paste Codex summaries here after each pass.

### Pass 1 summary
- _Pending_

## QA checklist

### iPhone QA
- [ ] Fresh launch / test with known storage state
- [ ] Onboarding appears when expected
- [ ] Returning-user onboarding does not repeat unnecessarily
- [ ] Add exactly 1 song and test export behavior
- [ ] Vault Export works on iPhone Safari
- [ ] Vault Export works in installed PWA, if applicable
- [ ] Toast appears centered and readable
- [ ] Error toast uses purple/pink/magenta style
- [ ] No desktop regression observed

### Desktop QA
- [ ] Onboarding still works on desktop
- [ ] Vault Export still works on desktop
- [ ] Existing onboarding polish not broken
- [ ] Typecheck passes
- [ ] Build/dev preview works

## Useful commands
```bash
npm run dev
npm run typecheck
git status
git branch --show-current
git add src/App.tsx src/lib/backup.ts styles.css src/index.css
git commit -m "Fix iPhone vault export and toast UX"
git push
```

## Open decisions
1. What exact count-based export/file-limit rule should Polyplay enforce?
2. Should iPhone export prefer Share Sheet first whenever available?
3. Should vault feedback become part of one shared toast system app-wide later?
