# PolyPlay Release Systems Findings — 2026-04-05

Use this file as a concise systems-level handoff for the current release-safe batch.

This is not the active control sheet. The active task board remains:
- `/Users/paulfisher/Polyplay/docs/polyplay_release_tasks_2026-04-05.md`

This document exists to summarize:
- what systems changed
- what behavior is now intended
- what still needs live QA

---

## Scope

This batch stayed intentionally surgical and focused on release trust, visual consistency, and a small number of contained UX fixes.

Primary systems touched:
- loop editor / loop trust
- theme-aware waveform rendering
- generated auto artwork
- theme/aura origin preservation toggle
- theme FX guardrails
- startup restore logic
- journal keyboard containment
- support page visual polish

---

## 1. Loop editor / loop trust

### What changed
- Fresh `Set Loop` entry now rebuilds a fresh editing focus range instead of inheriting a stale tiny viewport from a previous session.
- Base zoom-out no longer corrupts the loop editor state.
- The selected loop region stays stable yellow regardless of theme/playback color changes.
- Loop zoom controls now appear immediately in edit mode.
- Added explicit `Fit` and `Full` behaviors:
  - `Fit` refocuses around the active loop
  - `Full` stays at the full waveform viewport
- `-` zoom-out now expands progressively toward full range instead of jumping too abruptly.
- `Set Loop` now seeds a tighter initial loop near the playhead instead of stretching nearly to track end.

### Files most involved
- `/Users/paulfisher/Polyplay/src/components/WaveformLoop.tsx`
- `/Users/paulfisher/Polyplay/src/App.tsx`

### Intended behavior now
- Fresh loop-edit sessions should feel stable and understandable.
- The user should always have a trustworthy way to:
  - fit around the loop
  - step outward
  - jump fully out

### QA still needed
- Safari desktop loop-edit behavior
- loop entry near track end
- repeated zoom in/out stress pass

---

## 2. Theme-aware waveform rendering

### What changed
- Waveform rendering is now driven by a shared palette helper instead of multiple hardcoded color paths.
- Merica, MX, Rasta, and default themes now have explicit waveform gradient identities.
- Shared theme palette is used in:
  - main loop waveform
  - fullscreen decorative waveform
  - generated waveform artwork

### Files most involved
- `/Users/paulfisher/Polyplay/src/lib/waveformTheme.ts`
- `/Users/paulfisher/Polyplay/src/components/WaveformLoop.tsx`
- `/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx`
- `/Users/paulfisher/Polyplay/src/lib/artwork/waveformArtwork.ts`

### Intended behavior now
- Theme waveform colors should no longer read as generic purple/cyan.
- Merica, MX, and Rasta should visibly reflect their own palette language.

### QA still needed
- side-by-side visual review of:
  - Merica
  - MX
  - Rasta
  - default/non-custom

---

## 3. Generated auto artwork

### What changed
- Generated waveform art now uses the same per-theme gradient stops as the live waveform.
- Added a lighter central lift and softer vignette so the waveform bars separate more clearly from the background.
- Added a subtle shadow pass behind waveform bars for contrast.

### Files most involved
- `/Users/paulfisher/Polyplay/src/lib/artwork/waveformArtwork.ts`

### Intended behavior now
- Auto-generated artwork should feel visually consistent with the live waveform.
- The waveform should stand out more clearly without washing out the artwork.

### QA still needed
- confirm contrast across:
  - Merica
  - MX
  - Rasta
  - default

---

## 4. Track theme/aura origin preservation

### What changed
- Added a new persisted admin setting:
  - `Tracks maintain theme and aura origins`
  - default: ON
- When ON:
  - stored auto artwork is preserved during theme switching
  - current aura color is preserved
- When OFF:
  - auto artwork for `artworkSource === "auto"` tracks is regenerated for the new theme
  - theme-derived aura color updates with theme switching
- Setting is included in config backup/import.

### Files most involved
- `/Users/paulfisher/Polyplay/src/App.tsx`
- `/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx`
- `/Users/paulfisher/Polyplay/src/lib/db.ts`
- `/Users/paulfisher/Polyplay/src/lib/artwork/waveformArtwork.ts`
- `/Users/paulfisher/Polyplay/src/lib/backup.ts`

### Important implementation reality
- This toggle affects theme-derived visuals that the app already owns:
  - stored auto waveform posters
  - theme-driven aura color behavior
- It does not attempt a broad redesign of every artwork or aura concept in the app.

### QA still needed
- ON path across multiple theme switches
- OFF path across multiple theme switches
- persistence after reload
- config export/import round-trip

---

## 5. Theme FX guardrails

### What changed
- FX particles now store theme identity/palette at spawn time rather than reinterpreting against the live current theme.
- This prevents theme-switch “hangover” where old particles suddenly recolor incorrectly.
- Rasta FX smoke was adjusted toward larger, less uniform plume orientation.

### Files most involved
- `/Users/paulfisher/Polyplay/src/fx/ambientFxEngine.ts`

### QA still needed
- confirm no stale-theme particle reinterpretation after switching themes
- Rasta smoke feel
- Rasta leaf correctness

---

## 6. Startup restore behavior

### What changed
- Startup reconcile no longer lets stale onboarding/import flags override a valid non-demo library on reopen.
- Demo preference now depends on whether there are actually zero non-demo tracks.

### Files most involved
- `/Users/paulfisher/Polyplay/src/App.tsx`

### Intended behavior now
- real non-demo library should reopen correctly
- true first run should still land in the demo experience

### QA still needed
- cold reopen with real user playlist
- true first-run path

---

## 7. Journal keyboard containment

### What changed
- The risky outer visualViewport resize approach was rolled back.
- Journal returned to a fullscreen/contained model.
- Internal focus/scroll behavior was tightened so active editing controls remain more reachable.
- Export naming input now receives better focus behavior.

### Files most involved
- `/Users/paulfisher/Polyplay/src/components/JournalModal.tsx`
- `/Users/paulfisher/Polyplay/styles.css`

### Intended behavior now
- journal should remain visually isolated
- underlying app should not show through
- edit controls should stay reachable more reliably

### QA still needed
- iPhone/mobile keyboard coverage
- active entry positioning
- Save/Cancel reachability

---

## 8. Support page visual polish

### What changed
- Support page no longer uses the glowing/theme-treated hero wordmark.
- It now uses a simpler original-logo presentation without the extra theme highlight treatment.

### Files most involved
- `/Users/paulfisher/Polyplay/public/support.html`

---

## Current repo reality

This release-safe batch now spans multiple linked systems. The main implementation risk is no longer raw code correctness alone. The higher risk is cross-system visual or behavioral drift when:
- switching themes
- reopening the app
- editing loops repeatedly
- viewing generated auto artwork

That means the right next move is:
1. live QA on the currently changed paths
2. at most one more tiny surgical fix if a real issue remains
3. then a clean commit selection

---

## Suggested QA pass order

1. Loop editor:
   - fresh `Set Loop`
   - `Fit`
   - `Full`
   - repeated `+/-`
   - Safari stress pass
2. Theme waveform review:
   - Merica
   - MX
   - Rasta
   - default
3. Auto-art review:
   - compare auto poster to live waveform
   - confirm contrast/readability
4. Preserve-origins toggle:
   - ON path
   - OFF path
   - reload
   - backup/import
5. Startup restore:
   - real playlist reopen
   - true first-run
6. Journal keyboard containment

---

## Recommendation

Do not broaden scope from here unless a user-visible release bug is still real in QA.

The app is now in the right phase for:
- verification
- one more contained correction if needed
- commit selection
