# PolyPlay Cinema Mode Audit — 2026-04-05

Use this file as a planning-first Codex brief for expanding Cinema Mode into a stronger "Show Off mode" experience.

This is not an implementation prompt for all ideas at once. The concept touches fullscreen playback, gestures, idle UI, FX rendering, and device orientation. It should be audited and phased before any broad code change.

---

## Goal

Create a more immersive song-viewing mode where the user experiences:
- artwork
- motion / FX
- minimal chrome

The intended feel is "show off the song" rather than "edit or control the song."

---

## Current app reality

PolyPlay already has a fullscreen player and a Cinema Mode-like state inside:
- `/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx`
- `/Users/paulfisher/Polyplay/src/components/PlayerControls.tsx`
- `/Users/paulfisher/Polyplay/src/components/player.css`
- `/Users/paulfisher/Polyplay/src/App.tsx`

From code inspection, current fullscreen/cinema behavior already includes:
- a fullscreen player shell
- a cinema-mode toggle state
- hidden/non-hidden UI differences between fullscreen and cinema
- some gesture handling
- swipe/dismiss logic
- generated waveform canvas support for some artwork cases

This means the correct product direction is likely:
- evolve current fullscreen/cinema behavior
- do not create a second separate fullscreen architecture

---

## Normalized feature concept

### Show Off mode
Show Off mode is a specialized fullscreen playback state with:
- no persistent seek bar
- minimal visible controls
- large artwork-first presentation
- animated waveform / visualizer behind or around the artwork
- full-screen FX canvas feeling

### Control behavior
- controls appear when the mode first opens
- controls fade away after 4 seconds of idle time
- a tap wakes controls back up
- exit affordance appears only when controls are awake

### Navigation behavior
- swipe left/right changes tracks
- optionally show subtle previous/next affordances when controls wake

### Rotation concept
- ideally, screen rotation behavior is enhanced only in Show Off mode
- user may manually rotate between portrait and landscape
- lock icon prevents rotation changes
- rotate button should have a 1.5 second cooldown to prevent spam

### Top/bottom chip bar
When controls are awake, show a compact chip bar containing only the essentials:
- FX button
- rotation lock button
- manual rotate button
- exit button

---

## Recommended product framing

Do not frame this as "replace fullscreen player."

Frame it as:
- `Fullscreen player`
- `Show Off mode` as a sub-mode inside fullscreen

That keeps the architecture aligned with the current code and reduces the chance of breaking standard playback behavior.

---

## Narrowest viable v1

### Show Off mode v1 should include
- a dedicated entry point from fullscreen player
- artwork-first fullscreen presentation
- hide seek bar and most standard controls
- optional animated background waveform behind artwork
- compact awake/hidden chip controls
- idle fade after 4 seconds
- tap to wake controls
- explicit exit button
- swipe left/right track switching only if it does not conflict with existing dismissal gestures

### Show Off mode v1 should not include
- mode-specific OS rotation locking
- shake-to-exit
- custom orientation APIs beyond what the browser/platform already safely supports
- too many chip controls
- deep gesture stacking

This is the safe cut.

---

## Why rotation is the highest-risk part

Allowing rotation only inside one specific mode is the trickiest concept in the note dump.

### Risks
- browser support for orientation lock is inconsistent
- iOS web and hybrid-webview behavior may not honor orientation APIs consistently
- orientation lock may require fullscreen/platform conditions that are not guaranteed
- rotating only one mode can create broken transitions when exiting back to normal UI
- manual rotate requests may race with platform orientation updates
- lock/unlock state can become desynced from actual device orientation

### Practical conclusion
- treat mode-specific rotation as audit-only until platform support is proven in the current app shell
- do not make rotation a core requirement for Show Off mode v1

### Safer fallback
If true orientation locking is unreliable, v1 can still support:
- responsive portrait layout
- responsive landscape layout
- a UI hint that Show Off mode works in either orientation

In other words:
- support rotation gracefully
- do not promise force-rotation control until proven

---

## Gesture conflict audit

Show Off mode wants multiple gesture ideas:
- tap to wake controls
- swipe left/right for track change
- maybe swipe to dismiss
- maybe double tap outside artwork
- maybe shake to exit

That is too much overlap for a first pass.

### Known conflict zones
- left/right swipe to change track can conflict with existing fullscreen swipe areas
- tap-to-wake can conflict with artwork interactions or accidental double-tap exit logic
- shake-to-exit is high-risk because it can fire accidentally during walking, driving, dancing, or normal phone movement
- any hidden controls model increases discoverability risk

### Safer gesture rule for v1
- one tap wakes/hides controls
- explicit X button exits
- left/right swipe changes tracks only if tested against current fullscreen dismiss behavior
- no shake gesture in v1
- no gesture-only exit path

---

## Visualizer / waveform guidance

The "gyrating waveform behind the artwork" concept makes sense, but should be tightly scoped.

### Safer v1 decision
- use a lightweight animated waveform layer behind or around the artwork
- reuse existing waveform theme palette and canvas infrastructure where possible
- do not add heavy real-time spectral rendering if existing playback performance is already sensitive

### Risks
- over-busy visuals reduce premium feel
- animation can compete with artwork
- mobile battery/performance cost
- art video plus waveform plus FX may stack too heavily

### Guardrails
- keep the waveform secondary to artwork
- provide reduced-motion / perf-lite fallback behavior
- avoid adding multiple simultaneous hero animations unless profiling says it is safe

---

## Idle controls behavior

### Desired behavior
- controls visible when Show Off mode opens
- after 4 seconds of no interaction, fade chip bar and exit affordance
- any tap wakes controls
- while controls are awake, the chip bar should remain readable against busy art

### Risks
- accidental invisible-state confusion
- controls disappearing during active gesture or track switch
- controls fading while the user is deciding which button to press

### Guardrails
- reset idle timer on any pointer interaction
- do not hide controls during transition animations
- use opacity fade, not full unmount, if that reduces layout jitter

---

## Exit behavior recommendation

Recommended v1 exit behavior:
- visible X button when controls are awake
- tap wakes controls if hidden
- second tap can press X

Do not rely on:
- shake to exit
- double-tap outside to exit
- swipe-down-to-dismiss inside Show Off mode

Reason:
- exit should always be explicit and low-risk

---

## Proposed phased implementation

## Phase 1: Audit and skeleton
- inspect existing fullscreen/cinema state ownership
- document current gestures and conflicts
- confirm whether Show Off mode should live entirely inside `FullscreenPlayer`
- add no product behavior yet unless a tiny refactor is needed for clarity

### Files to inspect first
- `/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx`
- `/Users/paulfisher/Polyplay/src/components/PlayerControls.tsx`
- `/Users/paulfisher/Polyplay/src/components/player.css`
- `/Users/paulfisher/Polyplay/src/App.tsx`

## Phase 2: Show Off mode v1
- add a distinct Show Off sub-mode inside fullscreen player
- hide seek bar and nonessential controls
- add awake/idle control visibility model
- add explicit exit button
- add restrained waveform/visualizer enhancement

## Phase 3: Gesture expansion
- evaluate left/right track swipe
- test against existing close/dismiss gestures
- keep only gestures that are stable on phone and tablet

## Phase 4: Orientation feasibility
- audit webview/platform support
- test iPhone and iPad behavior
- only implement lock/manual-rotate controls if platform behavior is dependable

---

## Acceptance checks for Show Off mode v1

- entering Show Off mode does not interrupt playback
- seek bar is hidden in Show Off mode
- artwork remains the primary visual element
- controls fade only after true idle time
- a tap reliably wakes controls
- exit is always obvious once controls are awake
- exiting Show Off mode returns to normal fullscreen state cleanly
- no gesture in Show Off mode accidentally closes fullscreen or changes track unexpectedly
- performance remains acceptable on mobile

---

## Explicit defers

Defer these until after v1 proves stable:
- OS-level rotation lock only for one mode
- manual rotate button with forced portrait/landscape switching
- shake-to-exit
- transparent edge-arrow overlays unless swipe discoverability is actually a problem
- stacked gestures with multiple different meanings on the same surface

---

## Open questions to answer before build

1. Should Show Off mode open from a dedicated button in fullscreen, or by tapping artwork while already in fullscreen?
2. Is left/right swipe more important than preserving current dismissal behavior?
3. Is landscape support a nice enhancement, or a hard requirement?
4. Should FX changes still be user-controlled in Show Off mode, or mostly automatic?
5. Does Show Off mode need metadata text visible at all, or only artwork plus controls?

---

## Codex-ready audit prompt

> Read `/Users/paulfisher/Polyplay/docs/polyplay_cinema_mode_audit_2026-04-05.md` first. Audit the current fullscreen and cinema implementation without shipping the full feature yet. Inspect `src/components/FullscreenPlayer.tsx`, `src/components/PlayerControls.tsx`, `src/components/player.css`, and `src/App.tsx`. Document where Show Off mode should live, which existing gestures will conflict with idle controls and track-swipe ideas, and whether orientation control is technically safe in the current app shell. Do planning first. Do not implement forced rotation or shake gestures unless platform support is clearly proven.

---

## Recommendation

The desirable experience makes sense. The ambitious part is not the visual concept; it is the interaction model.

The right path is:
- ship Show Off mode v1 as a cleaner fullscreen sub-mode
- defer rotation control and shake gestures
- keep exit explicit
- keep the visualizer secondary to the artwork
