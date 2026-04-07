# PolyPlay Feature Ideas Cleanup — 2026-04-05

Use this file as a planning-first Codex brief for the voice-note ideas captured on 2026-04-05.

The raw note dump contained speech-to-text errors and overlapping concepts. This rewrite normalizes terminology, separates features by scope, and turns them into implementation-safe phases.

---

## Normalized feature list

### 1. Desktop drag-and-drop track replacement
On desktop, the user can drag an MP3 or other supported audio file onto the canvas. When hovering over a track tile, that tile lights up as a valid drop target. Dropping the file onto a tile replaces that track's audio source and associated track metadata.

### 2. Vibe Change auto-FX mode
When the user presses the Vibe Change button, PolyPlay can enter an optional auto-FX mode. In this mode, visual effects react automatically to waveform intensity or audio volume rather than relying only on manual switching.

### 3. Rearrange mode
The user can press a button to enter an edit-order mode. Tracks become free-moving bubbles/cards on the canvas. The user drags them into a new intended order, they avoid collisions while dragging, and when the user presses Done the system snaps the playlist back into the normal ordered layout.

### 4. Quick note and track-note system
There is a small note button in the UI. Pressing it opens a themed quick-note prompt similar in feel to the gratitude prompt, but for general notes. Notes can optionally be attached to:
- the current track
- the current playback timestamp
- both track and timestamp

After saving a note, playback can optionally jump backward by a user-configurable amount so the user can re-listen around the moment they annotated.

### 5. Custom theme builder
PolyPlay should offer a custom theme editor where the user:
- names a theme
- selects three hex colors
- selects an aura/accent color
- optionally chooses a mood/style preset
- optionally chooses a background image

Saved custom themes should occupy dedicated user theme slots and be included in vault export/import.

---

## Product decisions to lock before implementation

### A. Track replacement semantics
Default v1 decision:
- replace audio source only
- preserve stable app-managed track ID
- refresh derived metadata from the new file
- keep playlist position unchanged

Do not silently replace every field unless that behavior is explicitly desired. Replacing "everything including metadata" is risky because:
- user notes tied to the original track could become orphaned
- favorites/history references could break
- artwork/title metadata may become inconsistent if parsing fails

Safer rule:
- preserve internal identity and playlist slot
- replace media asset and user-visible metadata fields that are derived from the new file

### B. Auto-FX signal source
Default v1 decision:
- drive auto-FX from smoothed volume/amplitude buckets, not full waveform feature analysis

This is much safer than trying to infer beat structure or spectral events in v1.

### C. Rearrange interaction model
Default v1 decision:
- use drag reorder with collision-free animated cards
- infer final order from horizontal/vertical card centers at drop/Done time
- do not build true physics simulation in v1

### D. Quick note attachment model
Default v1 decision:
- every note stores `trackId`, `playlistId`, `capturedAtSec`, `createdAt`, `body`
- note capture timestamp is taken when the note button is pressed, not when the modal is submitted

This preserves the musical moment even if the user takes time to type.

### E. Playback skip-back behavior after note save
Default v1 decision:
- user setting: `0`, `5`, `10`, or `15` seconds
- on successful save, seek to `max(0, capturedAtSec - configuredSkipBackSec)`
- resume previous play/pause state unless product explicitly wants forced playback

### F. Custom theme slot behavior
Default v1 decision:
- support `User 1`, `User 2`, `User 3` slots first
- export/import these slots with vault data
- if a slot is empty, show create flow
- if occupied, allow overwrite with confirmation

---

## Recommended implementation phases

## Phase 1: Quick-note system
This is the clearest, smallest, highest-value feature from the note dump.

### Scope
- add quick-note entry point
- themed modal/prompt UI
- capture current track and playback timestamp when prompt opens
- save note
- optionally seek backward after save
- add settings for skip-back amount

### Why first
- low UI ambiguity
- minimal impact on playback engine
- creates a reusable note data model for future track-note UX

### Acceptance checks
- opening quick note does not pause playback unless explicitly designed that way
- saved note records the timestamp from button press, not modal submit
- skip-back never seeks below `0`
- skip-back respects configured user setting
- canceling the note does not alter playback position

### Risks
- modal focus/keyboard behavior on mobile
- race conditions if track changes while note modal is open

### Guardrails
- capture `trackId` and `capturedAtSec` once at modal open
- save against that captured snapshot, not live playback state at submit time

---

## Phase 2: Desktop drag-and-drop replacement

### Scope
- desktop-only drag target behavior
- file hover state on canvas
- tile highlight on valid drop target
- replace selected track source with dropped file
- metadata refresh flow

### Acceptance checks
- unsupported files are rejected cleanly
- dropping outside a tile does not mutate playlist data
- replacing one tile cannot reorder tracks
- replacement preserves slot identity and note associations
- failure to parse metadata does not corrupt the playlist

### Risks
- drag/drop behavior conflicts with existing canvas gestures
- large file import latency
- metadata parsing failures

### Guardrails
- do not commit replacement until file validation succeeds
- use explicit hover target state so only one tile is "armed"
- preserve previous track until replacement transaction completes

---

## Phase 3: Custom theme builder

### Scope
- custom theme editor UI
- three base colors plus aura/accent color
- optional mood preset
- optional background image
- save into dedicated user slots
- include in vault export/import

### Acceptance checks
- invalid hex values cannot be saved
- saved custom theme appears in theme cycling immediately
- exporting and importing vault preserves user theme slots
- missing background image on restore degrades gracefully

### Risks
- theme schema drift
- unreadable text/controls with user-selected colors
- image asset storage and restore complexity

### Guardrails
- centralize custom theme schema before building UI
- compute contrast checks and enforce fallback text colors
- store image references in a recoverable format compatible with vault export

---

## Phase 4: Rearrange mode

### Scope
- explicit "Edit Order" mode
- draggable floating track cards
- clear Done/Cancel affordances
- final order resolution and snap-back animation

### Acceptance checks
- cancel restores the original order exactly
- done applies only the final resolved order
- track cards never become unselectable or lost off-canvas
- reorder result is stable across fast drags

### Risks
- interaction complexity
- collision avoidance behavior
- accessibility and mobile viability

### Guardrails
- build deterministic reorder logic first
- treat floating movement as presentation, not source-of-truth order
- preserve a frozen original order snapshot until Done

---

## Phase 5: Vibe Change auto-FX

### Scope
- optional auto-FX mode behind the existing Vibe Change concept
- effect selection driven by smoothed audio intensity
- tunable thresholds and cooldowns

### Acceptance checks
- auto-FX never thrashes rapidly between effects
- manual FX mode remains available
- enabling auto-FX does not degrade playback performance

### Risks
- visual noise
- battery/performance cost
- unclear user mental model if effect changes feel random

### Guardrails
- use threshold hysteresis and minimum hold durations
- provide an obvious on/off indicator
- start with a small curated effect set

---

## Explicit defers

Do not bundle these into the first implementation pass:
- replacing every hidden/internal field on dropped-track swap
- full beat detection or spectral-analysis-driven FX
- true physics simulation for rearrange mode
- attaching multiple notes to arbitrary regions without a simple note list UI
- unlimited custom theme slots
- background-image editing/cropping tools

---

## Suggested data shapes

### Quick note
```ts
type TrackNote = {
  id: string;
  playlistId: string;
  trackId: string;
  capturedAtSec: number;
  createdAt: string;
  body: string;
};
```

### Custom theme
```ts
type CustomThemeSlot = {
  id: "user-1" | "user-2" | "user-3";
  name: string;
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
    aura: string;
  };
  moodPreset: string | null;
  backgroundImageAssetId: string | null;
  updatedAt: string;
};
```

### Track replacement transaction
```ts
type TrackReplacementInput = {
  targetTrackId: string;
  file: File;
};
```

---

## Open questions for product lock

1. For track replacement, should existing user-authored fields such as custom title, notes, and tags survive the swap?
2. Should quick notes be visible only in a dedicated note list first, or also inline on the seek bar/timeline?
3. Is rearrange mode desktop-only for v1, or should mobile support be included?
4. For custom themes, is the mood preset purely decorative, or does it also influence FX behavior and typography?
5. Should auto-FX react per song globally, or per-track with remembered behavior?

---

## Codex-ready implementation prompt

Use this only for one phase at a time, not all phases at once.

> Read `/Users/paulfisher/Polyplay/docs/polyplay_feature_ideas_voice_cleanup_2026-04-05.md` first. Implement Phase 1 only: Quick-note system. Keep the change surgical. Before editing, inspect the existing gratitude prompt and settings architecture, then add a quick-note modal that captures the current track and playback timestamp when opened, saves a note with `trackId`, `playlistId`, `capturedAtSec`, `createdAt`, and `body`, and optionally seeks backward by a user-configurable `0/5/10/15` seconds after save. Preserve playback stability, avoid unrelated UI changes, and run typecheck before closing.

---

## Recommendation

If only one feature should be built next, do Phase 1 first.

If two features should be prepared in parallel:
- implement Phase 1
- audit Phase 2 without shipping until drag/drop interactions are confirmed clean against the existing canvas
