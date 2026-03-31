# 3-30-26 PolyPlay Live Codex Tracker

## Purpose
This file is intentionally meant to be **edited by Codex during the session** so progress does not get lost when sessions reset, branch context changes, or model tier changes.

## Rules for Codex
- Update this file after each meaningful task.
- Mark items as:
  - `[done]`
  - `[open]`
  - `[verify]`
  - `[deferred]`
- If an item was partially completed, note exactly what is done and what is still missing.
- Do not delete old notes; convert them into a clearer status.
- Keep changes factual and brief.
- Run typecheck before closing any item as done.

---

## Current session state
- Codex tier: mini
- Notes:
  - We lost continuity in a new session.
  - This tracker is the new source of truth.
  - Loop work seems mostly improved, but it threw the session off and caused other tasks to lose tracking.

---

## Priority order for this pass

### 1. Artwork update status toast / hang clarity
**Status:** [verify]  
**Platform:** both  
**Problem:**  
Updating artwork needs a prominent status toast/progress state while user waits for it to take effect. Right now the app can feel hung and the user gets confused.

**Need:**  
- clear visible progress/status during artwork update
- strong completion/failure messaging
- user should never think the app froze

- `/public/support.html` contains the support page; added a header/footer link (`/support`) from the app so the page is reachable without redesigning routing; still needs live QA before marking done
- Guard logic now exits as soon as the down target lives inside any interactive node so the edge drag is only triggered from the raw background drop zone, and the sensitive zone was widened to 80px to give users more room along each edge.
- Added CSS for `.playlist-edge-swipe-indicator` so the amber hold cue actually draws against the left or right edge once the 600ms timer completes; the indicator still needs live confirmation that it no longer feels invisible.
- The failure stemmed from the commit path never firing—even though the hold indicator appeared, the swipe delta was measured but the switch logic never ran when the pointer released. I refactored that logic into a `commitEdgeSwipe` helper that both pointermove and pointerup call (with the latest recorded clientX), so once the hold arms the gesture we now always evaluate the final delta and switch playlists exactly once per arm. The helper also checks runtime library state and wraps the `setActivePlaylist` call so the drop-down updates reliably.
**Codex notes:**  
- Guard logic now exits as soon as the down target lives inside any interactive node so the edge drag is only triggered from the raw background drop zone, and the sensitive zone was widened to 80px to give users more room along each edge.
- Added CSS for `.playlist-edge-swipe-indicator` so the amber hold cue actually draws against the left or right edge once the 600ms timer completes; the indicator still needs live confirmation that it no longer feels invisible.
- Accidental taps were happening because the swipe commit only required delta ≥32px and ignored vertical drift. I tightened the guard by raising the threshold to 48px, tracking the latest clientY, and only committing when horizontal travel exceeds both the threshold and 1.25× the vertical travel; the pointerup fallback runs the same guard, so a tap or slight shuffle no longer switches playlists but an intentional horizontal swipe still does a single committed `setActivePlaylist`.
- `/public/support.html` contains the support page; added a rewrite in `vercel.json` so `/support` resolves to it and kept the footer link; still needs live QA before marking done
- Drag zone now shows a toast running “Applying artwork…” when either artwork lane or manual update is busy and reports the success/failure messages once the update finishes; still need live confirmation the text is noticeable/no freeze

---

### 2. Import artwork before audio file
**Status:** [open]  
**Platform:** Safari desktop, iOS, likely desktop in general  
**Problem:**  
User should be able to import/select artwork before selecting an audio file if they want, especially for desktop drag-and-drop flows.

**Need:**  
- allow artwork-first flow if safe
- especially improve desktop drag/drop behavior
- do not force audio-first workflow if unnecessary

**Codex notes:**  
- Artwork drop zone now accepts files before audio is selected; tracks still require an audio file to be created, so the view supports picking art first while remaining safe

---

### 3. Splash/logo first-launch behavior
**Status:** [done]  
**Platform:** both  
**Problem:**  
Need to ensure the video logo splash only occurs on first launch. After that, the generated pre-splash/background state should be the normal experience. 

**Need:**  
- first-launch-only video splash
- later launches use the polished generated pre-splash state

**Codex notes:**
 - Splash visibility now relies solely on `SPLASH_SEEN_KEY`; once the user dismisses or skips the video the flag stays true and subsequent visits load the standard background without replaying the clip.

---

### 4. Playlist swipe gesture
**Status:** [open]  
**Platform:** mobile / both  
**Problem / idea:**  
If user taps and holds for ~0.6s on left or right edge of the screen, a glowing amber line appears on that edge. That unlocks swipe left/right to switch playlist mode.

**Need:**  
- edge hold detection
- glowing amber edge line
- fade out if user removes finger
- swipe left/right changes playlist
- dropdown updates to current playlist
- subtle flash + hard haptic on playlist switch

**Codex notes:**  
- Guard logic now exits as soon as the down target lives inside any interactive node so the edge drag is only triggered from the raw background drop zone, and the sensitive zone was widened to 80px to give users more room along each edge.
- Added CSS for `.playlist-edge-swipe-indicator` so the amber hold cue actually draws against the left or right edge once the 600ms timer completes; the indicator still needs live confirmation that it no longer feels invisible.
- The failure stemmed from the commit path never firing—even though the hold indicator appeared, the swipe delta was measured but the switch logic never ran when the pointer released. I refactored that logic into a `commitEdgeSwipe` helper that both pointermove and pointerup call (with the latest recorded clientX), so once the hold arms the gesture we now always evaluate the final delta and switch playlists exactly once per arm. The helper also checks runtime library state and wraps the `setActivePlaylist` call so the drop-down updates reliably.

---

### 5. THREEPEAT expansion
**Status:** [open]  
**Platform:** both  
**Problem / idea:**  
Expand threepeat/repeat options to:
- no repeat
- repeat 2
- repeat 3

User should still see repeats-left countdown on the button.

**Codex notes:**  

---

- const project info
### 6. Product support page
**Status:** [verify]  
**Platform:** web / App Store support  
**Problem:**  
Need a static HTML or React product support page suitable for App Store.

**Need:**  
- practical and shippable
- avoid getting lost in making a giant site

**Question:**  
Did we already start this? If yes, document what exists and what still needs to be done.

**Codex notes:**  
- `/public/support.html` contains the support page; added a header/footer link (`/support`) from the app so the page is reachable without redesigning routing; still needs live QA before marking done

---

### 7. Safari desktop video-art still bug
**Status:** [deferred]  
**Platform:** Safari desktop  
**Problem:**  
User uploaded video art. Video art worked in fullscreen and cinema, but no still/poster was successfully generated/displayed on Safari desktop (using teal theme).

**Question:**  
We think this may have been worked on early in the session. Verify whether it is actually fixed, partially fixed, or still open.

**Codex notes:**  
- user requested this one be skipped for now; revisit later if needed

---

### 8. Desktop playbar text selection
**Status:** [done]  
**Platform:** desktop  
**Problem / design decision:**  
Track title being selectable is useful for copy. Timecodes and aura maybe should not be selectable.

**Need:**  
- allow title selection while keeping non-title metadata unselectable

**Codex notes:**  
- CSS + document-level selection lockout keep secondary metadata from being selected while title stays copyable

---

### 9. Desktop double-click playbar top area
**Status:** [done]  
**Platform:** desktop  
**Problem / idea:**  
To support desktop gestures, double-click in the top area of playback should toggle minimal ↔ waveform player.

**Codex notes:**  
- handler in `MiniPlayerBar` double-clicks header to toggle compact/waveform while ignoring buttons

---

### 10. Import page stay-open checkbox alignment
**Status:** [verify]  
**Platform:** both  
**Problem:**  
We did the “Keep me on Import page” checkbox, but the checkbox is visually on the opposite side of the screen from its label text.

**Need:**  
- verify implementation exists
- fix layout/alignment so checkbox and text feel like one control

**Codex notes:**  

---

### 11. Loop crop playback bug
**Status:** [verify]  
**Platform:** both  
**Problem:**  
When user comes back to a track that had a new loop crop track created from it, for a brief second the beginning of the song plays, then it realizes a loop is active and jumps to the loop start.

**Why this matters:**  
Looks buggy / “bad coding” to the user.

**Need:**  
- correct initial playback position/state
- no brief wrong-start playback before loop logic catches up

**Codex notes:**  
- autoplay/resume now seeks to loop start before playing; still need to verify no brief wrong-start glitch on device

---

## Secondary notes
These are still important, but are not the first attack items for this tracker.

### A. Promo / graphics cleanup
**Status:** [deferred]  
- promotional video
- splash
- demo artwork

### B. Other previously discussed loop enhancements
**Status:** [deferred]  
- keep only if not already tracked elsewhere

---

## Progress log

### Done
- 

### Verify
- Product support page status
- Safari desktop video-art still bug status
- Keep me on Import page checkbox alignment

### Open
- Artwork update status toast
- Artwork-before-audio import flow
- Splash first-launch behavior
- Playlist swipe gesture
- THREEPEAT expansion
- Desktop playbar selection refinement
- Desktop double-click playbar toggle
- Loop crop playback bug

### Deferred
- Promo asset cleanup
- Noncritical loop enhancements not directly tied to current ship issues
