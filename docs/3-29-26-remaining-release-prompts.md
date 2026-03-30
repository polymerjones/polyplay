# Remaining Release-Candidate Prompts — 3-29-26

## Completed from this set

### 1. Repeat / 3PEAT persistence through backup/import
**Status:** Fixed

**Notes:**
- Runtime already used `polyplay_repeatTrackMode` with:
  - `off`
  - `loop-one`
  - `threepeat`
- Backup/config persistence was still using the obsolete boolean-style `polyplay_repeatTrackEnabled` path.
- This meant repeat state could export incorrectly, and `threepeat` would not round-trip faithfully.

**Problem:**
- Current exports/imports could lose repeat state entirely or degrade `threepeat` incorrectly.

**Repro:**
- Set repeat mode to `3PEAT` or `loop-one`.
- Export config/full backup.
- Re-import or restore.
- Observe restored repeat state could come back wrong because export/import only handled the legacy boolean field.

**Root cause:**
- `src/lib/backup.ts` exported/imported only `repeatTrackEnabled` from the obsolete storage key.
- Runtime state had already moved to `repeatTrackMode`, so persistence and runtime were out of sync.

**What the code was doing before:**
- Backup/config export read `polyplay_repeatTrackEnabled`.
- Import restored only a boolean-like repeat state.
- `threepeat` could not persist correctly.

**What we tried:**
- Audited runtime state, config export/import, and full backup import/export.
- Confirmed runtime already had the correct enum model, so only persistence needed patching.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important finding was that the bug was purely in persistence, not runtime repeat behavior.

**Final fix:**
- In `src/lib/backup.ts`:
  - switched persistence to read `polyplay_repeatTrackMode` first
  - added enum parsing helper for `off | loop-one | threepeat`
  - export now includes `settings.repeatTrackMode`
  - export still includes legacy `settings.repeatTrackEnabled` for compatibility
  - import prefers `repeatTrackMode` and falls back to legacy boolean
  - apply/import writes the enum key back to localStorage
  - legacy boolean key is still written for older compatibility paths

**How to avoid this later:**
- When runtime state evolves from boolean to enum, update persistence at the same time.
- Audit:
  - localStorage keys
  - config export/import
  - full backup export/import
  - compatibility fallbacks
- Avoid letting runtime and persistence drift into different models.

---

## Remaining prompts / tasks from the release-candidate audit

### 2. Add missing Media Session `toggleplaypause`
**Status:** Open

**Notes:**
- Browser Media Session appears to bind:
  - `play`
  - `pause`
  - `previoustrack`
  - `nexttrack`
- But `toggleplaypause` may still be missing.
- This can make remote/browser hardware controls feel flaky on some surfaces.

**Problem:**
- Surfaces that emit `toggleplaypause` may not work reliably.

**Repro:**
- Use browser/hardware transport surface that emits `toggleplaypause`.
- Observe whether PolyPlay responds correctly.

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 3. Clean up duplicate journal import/export feedback
**Status:** Open

**Notes:**
- Journal import/export may still use two feedback surfaces:
  - `miniToast`
  - `journalStatus`
- This can feel noisy, confusing, or too brief during sensitive import/export flows.

**Problem:**
- Journal feedback may be duplicated or too noisy.

**Repro:**
- Import a journal backup.
- Export a journal backup.
- Observe whether multiple success/failure surfaces appear or disappear too quickly.

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 4. Align admin export wording with safer main-app wording
**Status:** Open

**Notes:**
- Main-app Vault export wording was improved to reduce misleading “opened/success” language.
- Admin export copy may still lag behind and feel slightly misleading, especially on iPhone-like preview/save flows.

**Problem:**
- Admin export messaging may still imply success/opening too early.

**Repro:**
- Export full backup from admin.
- Observe wording on iPhone/Safari-like preview fallback flow.
- Compare against main-app wording.

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 5. Final iPhone sanity pass
**Status:** Open

**Notes:**
- This is the release-candidate sanity pass after the above cleanup items.
- Focus is on:
  - iPhone artwork import/update
  - Vault export/import
  - AirPods / remote play-pause
  - repeat / loop / threepeat
  - journal import/export clarity
  - any “looks frozen / repeated taps / silent failure” moments

**Problem:**
- Need final pass/fail confidence before shipping.

**Repro:**
- Run the exact release-candidate test flows on iPhone.

**Root cause:**
- Not applicable until failures are found.

**What the code was doing before:**
- Not applicable until failures are found.

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

## Suggested order
1. Add missing Media Session `toggleplaypause`
2. Clean up duplicate journal import/export feedback
3. Align admin export wording
4. Final iPhone sanity pass
