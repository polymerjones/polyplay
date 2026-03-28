# 3-28-26 Prelaunch Fixes

## Mission
PolyPlay Audio is in pre-launch hardening.

These are **release-required fixes**, not v1.1 shelf items.

Goals for this pass:
- work fast, efficient, and smart
- do not lose sight of any item in the notes
- document every issue in this file as we go
- do not give up on any bug
- prefer brief, factual problem solving over long summaries

For each item below, document:
1. **Problem**
2. **Repro**
3. **Root cause**
4. **What the code was doing before**
5. **What we tried**
6. **Why a failed attempt failed**
7. **Final fix**
8. **How to avoid this pitfall later**

---

## Working order
We are starting with the quicker cosmetic/UI issues first, then moving into the heavier logic/platform bugs.

Suggested order:
1. Amber theme tone
2. Auto Art badge cleanup
3. Mute enabled visual clarity
4. Vault export success-toast timing confusion
5. Safari desktop still-art bug from video artwork
6. Safari desktop welcome boxes too tall
7. Now Playing / lock screen previous-next controls
8. Phone sleep behavior

---

## Open questions / items to fix

### 1. Major question: does the phone stay awake while the app is open?
**Status:** Open

**Notes:**
- Need to confirm whether the app is preventing auto-lock / sleep while open.
- Need to determine whether this is intentional, accidental, or platform-default behavior.
- Needs audit and documentation.

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 2. Amber theme needs to feel more amber / candlelight / anti-blue-light
**Status:** Open

**Notes:**
- Amber theme should feel more like warm incandescent night mode.
- Desired direction:
  - candlelight hue
  - warmer background
  - less neutral / less blue contamination
  - still readable and elegant

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 3. Auto Art badge is too big / too dominant
**Status:** Open

**Notes:**
- Auto Art badge is too visually dominant in both row and tile mode.
- Especially ugly in rows mode.
- Possible direction:
  - reduce size
  - reduce dominance
  - potentially tie color to user's aura
- Need final decision during fix pass.

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 4. Major UI confusion: first-time Vault export success feedback is misleading
**Status:** Open

**Notes:**
- User gets a congratulatory/success toast before the save box appears.
- This reads like a logic failure to the user.
- User reproduced this twice.
- User had to tap twice on Export Vault to get the Save dialog to appear.
- Need to audit the exact timing/flow and document it clearly.

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 5. Major UI confusion: Mute state is still not visually obvious
**Status:** Open

**Notes:**
- Mute logic may be fixed, but the visual clarity is still insufficient.
- In light mode especially, user cannot easily tell whether Mute is enabled.
- Desired behavior:
  - Mute enabled should be visually distinct in all themes
  - should likely use the selected aura color
  - may also use a strobe / pulse if elegant
  - applies to iOS and desktop
- This is release-important, not optional polish.

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 6. Now Playing / lock screen should support previous and next track buttons
**Status:** Open

**Notes:**
- Current lock screen / now playing controls are working well, but only expose:
  - back 15 seconds
  - play / pause
  - forward 15 seconds
- Requirement:
  - add previous track button
  - add next track button
  - user wants them effectively sandwiching the center transport controls if supported
- Need to audit what iOS Now Playing / native controls currently support and how PolyPlay is wired.

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 7. Safari Desktop major: grey square instead of still art from imported video artwork
**Status:** Open

**Notes:**
- Significant Safari desktop bug.
- User uploads video for artwork.
- In fullscreen mode, video artwork plays correctly.
- Outside fullscreen, still-art/poster does not generate or display.
- Result is a grey square where artwork should be.
- Need to know exactly why this happens specifically in Safari on desktop.

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 8. Safari Desktop major: welcome/onboarding boxes still too tall
**Status:** Open

**Notes:**
- This has persisted through development.
- Safari desktop still shows onboarding/welcome boxes with too much vertical space.
- All other platforms reportedly fixed.
- Needs audit, debug, fix, and documentation.

**Problem:**

**Repro:**

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

## Notes / triage log

### General rules for this pass
- These are not being shelved for v1.1.
- If one issue turns into a rabbit hole, do not lose the others.
- Keep this document updated as the source of truth.
- Every meaningful fix attempt should be recorded here.

### Progress log
- _Start of 3-28-26 pass: document created and issue list established._

---

## Release signoff reminder
Before public release, confirm:
- all issues above are either fixed or explicitly deferred with informed reasoning
- fixes are tested on the relevant platforms
- iOS-facing changes are reflected in current build
- Safari desktop fixes are explicitly verified on Safari desktop
