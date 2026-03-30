# 3-29-26 Loop Mode Release-Safe Pass

## Scope

This pass implemented only the release-safe loop-mode enhancements:

1. Smart loop zoom
2. Aura-colored loop start/end marker lines
3. `Crop Audio` button UI
4. `Crop Audio` prompt shell only

This pass does **not** implement actual audio cropping, trimming, decoding, or re-encoding.

## Files Touched

- `src/components/WaveformLoop.tsx`
- `src/components/player.css`
- `src/components/PlayerControls.tsx`
- `src/components/FullscreenPlayer.tsx`
- `src/components/MiniPlayerBar.tsx`
- `src/App.tsx`
- `styles.css`

## Smart Loop Zoom

### Implementation

Smart zoom is implemented as a visual viewport inside `WaveformLoop`, not as destructive timeline math.

Added in `src/components/WaveformLoop.tsx`:

- delayed zoom timing after loop edits settle
- buffered viewport around the active loop region
- immediate return to full-track view when loop-handle dragging begins
- seek math remapped through the current viewport so pointer interactions still line up with what the user sees

### Behavior

- When a valid loop region exists and the user stops adjusting it briefly, the waveform smoothly zooms in to the loop with a small visual buffer before and after the selection.
- When the user starts dragging a loop handle again, the waveform smoothly zooms back out to the full-track view.
- Playback is not interrupted by zoom transitions.
- Reduced-motion users do not get the zoom animation.

### UX Intent

The zoom is meant to feel like a calm assist for loop editing, not a jumpy camera move:

- short settle delay before zooming in
- immediate zoom-out when editing resumes
- no playback interruption
- no mode change required

## Loop Boundary Visuals

Added aura-colored marker lines for:

- loop start
- loop end

Implementation is in:

- `src/components/WaveformLoop.tsx`
- `src/components/player.css`

These sit on top of the existing loop range highlight and handles, so the selected loop boundaries read more clearly during editing without changing loop behavior.

## Crop Audio Button

Added a new `Crop Audio` button next to `Clear Loop` in the non-mini player controls.

Implementation is in:

- `src/components/PlayerControls.tsx`
- `src/components/FullscreenPlayer.tsx`
- `src/components/MiniPlayerBar.tsx`
- `src/App.tsx`

### Current behavior

- button is disabled unless there is a valid active region loop
- button opens a prompt shell only
- no audio data is modified in this pass

## Crop Audio Prompt Shell

Added an app-level prompt shell in `src/App.tsx` with:

- `Crop Existing Track`
- `Crop to New Track`
- `Cancel`

### Current state

- both crop actions are intentionally disabled
- prompt clearly states that actual crop processing is not wired in this pass
- prompt closes if loop state becomes invalid while it is open
- no destructive behavior exists yet

## What Remains For Later

Actual crop processing still needs a separate pass:

1. decode source audio
2. trim selected sample range
3. encode a new audio blob
4. either:
   - replace current track audio
   - or create a new track from the cropped region

That work was intentionally excluded here for release safety.

## Platform

Applies to:

- desktop
- iOS

## Risk

Overall regression risk: low to moderate

- low:
  - marker lines
  - Crop Audio button
  - Crop Audio prompt shell
- low to moderate:
  - smart zoom viewport behavior inside the loop editor

Reason:

- playback logic was not redesigned
- no destructive audio processing was introduced
- zoom changes are contained to waveform UI behavior

## Verification

- `npm run typecheck` passed
