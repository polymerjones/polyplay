# 3-29-26 Loop Mode Findings

## Summary

Loop mode went through several narrow stabilization passes.

The major outcome:

- loop rendering is now materially more stable
- loop editing is much more usable
- fullscreen gesture conflicts during loop editing were suppressed
- default loop entry is safer and clearer
- tiny-loop editing now has basic guardrails

This doc captures the concrete issues found and the fixes that were applied.

## Main Problems Found

### 1. Loop region color was being painted over

Problem:

- base waveform drew loop bars in yellow
- progress/decor layer repainted progressed bars in the normal purple/pink playback gradient
- result: loop region did not stay visually yellow as playback moved through it

Fix:

- made the progress/decor rendering loop-aware in `src/components/WaveformLoop.tsx`
- progressed bars inside the loop now stay gold/yellow
- progressed bars outside the loop keep the normal playback gradient

### 2. Waveform/view-window coordinate mismatch

Problem:

- waveform/progress/playhead were originally being drawn in full-track coordinates
- overlay markers/range were being positioned in visible-window coordinates
- result: offsets, scrambled-looking rendering, and unstable visual alignment

Fix:

- changed `WaveformLoop` rendering to draw waveform and progress directly in the current visible view window
- playhead rendering now also uses visible-window math
- loop overlay now shares the same coordinate system

### 3. Overlay regression caused left-edge marker collapse

Problem:

- the new overlay window container was absolute-positioned without a real width
- marker percentages were being laid out in a broken container
- result: left-edge loops collapsed into a jammed/glitched cluster

Fix:

- set the overlay container to a real full-width frame in `src/components/player.css`
- clamped marker/range percentages in `src/components/WaveformLoop.tsx`

### 4. Fullscreen exit gesture conflict during loop editing

Problem:

- fullscreen swipe-dismiss could still arm during loop marker editing
- zoom-out after release could accidentally trigger fullscreen dismiss/minimize behavior

Fix:

- added fullscreen-only gesture suppression during loop drag
- added a short post-drag cooldown in `src/components/FullscreenPlayer.tsx`

### 5. Default loop entry state was too cramped

Problem:

- `Set Loop` originally created a small region starting at current playback time
- end marker could begin near the left edge in a tiny initial loop
- first interaction felt cramped and hard to grab

Fix:

- changed default loop initialization in `src/App.tsx`
- `Set Loop` now creates:
  - start = `0:00`
  - end = full track duration
- zoom still does not auto-trigger until the user actually edits a marker

### 6. Drag felt unstable on small loops

Problem:

- touching a handle immediately entered drag state
- drag-time viewport widening could start before real drag intent was clear
- on very small loops, the handle could appear to slide away under the finger

Fix:

- added a small drag deadzone in `src/components/WaveformLoop.tsx`
- touch-down now records pending drag intent
- actual drag does not start until movement passes the deadzone

### 7. Tiny-loop collapse was too easy

Problem:

- minimum loop size was only `0.1s`
- that was too small for stable editing and made extreme tiny loops easy to create

Fix:

- increased minimum loop duration to `0.5s`

### 8. Drag refinement zoom-out was too aggressive

Problem:

- after a small loop was established, dragging a marker again reset the viewport too close to full-track view
- refinement felt jarring and made it harder to keep context

Fix:

- after a real loop has been established:
  - drag state now uses a widened edit viewport
  - settled state returns to a tighter focused loop zoom
- this keeps the loop region visually central during refinement

## Current Loop Behavior

### Entry

- `Set Loop` selects the full track by default
- no immediate auto-zoom from that default state

### Zoom behavior

- no zoom until the user actually edits a loop marker
- after user adjustment settles, waveform zooms into the loop region
- during refinement drags, the view widens for context but does not reset all the way out

### Editing behavior

- loop handles stay visible at full-track entry
- fullscreen dismiss gestures are suppressed during loop editing
- handle drag requires real movement before editing starts
- minimum loop duration is enforced at `0.5s`

### Visual behavior

- loop region remains gold/yellow
- unlooped waveform remains in the normal waveform color family
- progress through the loop stays visually coherent

## Files Touched During Loop Stabilization

- `src/App.tsx`
- `src/components/WaveformLoop.tsx`
- `src/components/FullscreenPlayer.tsx`
- `src/components/player.css`
- `styles.css`
- `docs/3-29-26-loop-mode-release-safe-pass.md`

## Deferred / Not Implemented

Still intentionally not implemented:

- actual audio crop processing
- crop-to-existing audio rewrite
- crop-to-new-track audio generation

The current `Crop Audio` prompt is still shell-only.

## Remaining Risk

Current loop mode risk is much lower than before, but some tuning risk remains:

- very small loop refinement on touch devices may still need feel-polish
- loop zoom behavior may still need minor tuning after real-device use
- ambient FX / background presentation is a separate visual issue and not part of the loop fixes

## Verification

All loop stabilization changes were kept narrow and release-focused.

Verification performed repeatedly during these passes:

- `npm run typecheck`
