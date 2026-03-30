# 3-30-26 PolyPlay Refinement Dump

## Session goal
Use this file as the source of truth for the current 3-30-26 PolyPlay refinement and bug-fix pass.

Instructions for Codex:
- Inspect first before editing.
- Diagnosis first.
- Keep fixes narrow and release-safe.
- Do not lose any item from this handoff.
- Clearly separate:
  - release-blocking / major
  - medium
  - cosmetic
- For each completed item, report:
  - files inspected
  - root cause
  - exact fix made
  - platform impact
  - regression risk
- Run typecheck before finishing.

---

## Current note dump

## Current session progress snapshot

### Implemented in current uncommitted worktree

#### 11. Manual waveform zoom controls for loop mode
**Status:** In progress / implemented in worktree / needs manual validation before commit  
**Files touched:**  
- `src/components/WaveformLoop.tsx`
- `src/components/player.css`
**What is currently done:**  
- added manual zoom state in `WaveformLoop`
- added a sibling toolbar below the waveform with:
  - `Zoom` toggle
  - `-` button
  - `+` button
- manual zoom narrows the existing loop-focused visible range without adding a new wrapper around the waveform hit area
**Current confidence:**  
- safer than the earlier reverted attempt
- still needs live loop creation and handle-drag validation before commit
**If it regresses again:**  
- keep desktop polish work
- revert only manual zoom logic/styles from `WaveformLoop.tsx` and `.pc-wave-toolbar*` styles in `player.css`

#### 16. Desktop playbar text selection
**Status:** Implemented in current uncommitted worktree  
**Files touched:**  
- `src/components/player.css`
**What is currently done:**  
- under `@media (pointer: fine)`, track title text is selectable
- subline text and control areas remain non-selectable
**Current confidence:**  
- low risk

#### 17. Desktop double-click top playback area
**Status:** Implemented in current uncommitted worktree  
**Files touched:**  
- `src/components/MiniPlayerBar.tsx`
**What is currently done:**  
- desktop `onDoubleClick` on the top player header toggles compact ↔ waveform player
- ignores artwork, aura button, loop-clear button, and compact-toggle button targets
**Current confidence:**  
- low risk

### Validation recorded so far

- `npm run typecheck` passed on the current uncommitted state
- manual loop-setting behavior is still the main remaining validation gap for this pass

### Release-blocking / major

#### 1. Product support page
**Status:** Open  
**Platform:** App Store support / web  
**Need:**  
- create a practical static HTML or React product support page for App Store use
- should be useful and professional
- do not get lost making it too elaborate before ship

**Why this matters:**  
- important for App Store support requirement
- should exist before public release

---

#### 2. Safari desktop major bug — video art still / poster generation failure
**Status:** Open  
**Platform:** Safari desktop  
**What happened:**  
- user uploaded video art
- default still art was generated or expected to generate
- video art worked in fullscreen and cinema
- but no usable still/poster was successfully generated/displayed on Safari desktop

**Why this matters:**  
- Safari desktop counts as a serious compatibility surface
- makes video artwork flow feel broken

---

#### 3. Cinema viewer aspect-ratio / zoom bug
**Status:** Open  
**Platform:** iOS / desktop / both  
**What happened:**  
- artwork is too zoomed in in Cinema View
- images or videos that are not square, especially more vertical pieces, get cropped too aggressively
- not necessary; it can use more vertical space

**What is expected:**  
- Cinema Viewer should dynamically size for non-square artwork
- 9x16 / vertically dominant pieces should display more naturally instead of being over-cropped

---

#### 4. Loop crop playback bug
**Status:** Open  
**Platform:** both  
**What happened:**  
- when user came back to a track that had an active loop / loop-related crop history
- for a brief second the beginning of the song played
- then it realized a loop was active and jumped playback to the loop start

**Why this matters:**  
- looks like bad/buggy coding to the user
- playback should not briefly start in the wrong place

---

### Medium-priority issues

#### 5. Backup file naming before save
**Status:** Open  
**Platform:** especially iPhone  
**Need:**  
- user wants a way to name backup files before saving them into iPhone storage
- current save path feels like files disappear into the abyss with unclear names

---

#### 6. Video logo splash behavior
**Status:** Open  
**Platform:** both  
**Need:**  
- video logo splash should occur only on first launching
- after that, the background-generated pre-splash state looks great and should be the normal experience

---

#### 7. Swipe gesture to change playlist
**Status:** Open  
**Platform:** both, especially mobile  
**Idea:**  
- if user taps and holds for ~0.6 seconds on either the left or right side of the screen
- a glowing amber line appears at that edge
- this unlocks swipe-left / swipe-right to switch playlist mode
- if finger lifts, amber line fades off
- should do the same action as switching playlist by dropdown
- dropdown must update to match current playlist
- add cool swipe effect, subtle flash, and hard haptic on playlist switch

**Why this matters:**  
- adds a more intuitive gesture navigation option than dropdown alone

---

#### 8. THREEPEAT expansion
**Status:** Open  
**Platform:** both  
**Need:**  
- add more toggle states around repeat counts
- user should be able to choose:
  - no repeat
  - repeat 2
  - repeat 3
- existing countdown / repeats-left infrastructure should be reused
- the button should still show repeats left

---

#### 9. Import functionality — stay on import page
**Status:** Open  
**Platform:** both  
**Need:**  
- add checkbox under Import button:
  - “Upload multiple” or “Keep me on the Import page”
- default off
- if checked, a successful import should not close the import menu

---

#### 10. File manager thumbnails
**Status:** Open  
**Platform:** both  
**Need:**  
- file manager should show a small album-art thumbnail on each track row

---

#### 11. Manual waveform zoom controls for loop mode
**Status:** Open  
**Platform:** both  
**Need:**  
- add magnifying-glass toggle under waveform
- when pressed, reveal `-` and `+` buttons as if they spawn from the magnifying-glass button
- allow user to manually and smoothly zoom in and out
- loop section should stay centered to the viewer
- goal: ultimate loop-creation experience

---

#### 12. Renaming playlist may reset aura
**Status:** Open / needs verification  
**Platform:** both  
**Concern:**  
- potentially may have unintentionally reset aura during playlist rename
- needs audit / confirmation

---

### Cosmetic / polish issues

#### 13. Theme hero-bar lines still purple
**Status:** Open  
**Platform:** both  
**What happened:**  
- different themes still all have purple lines in their background in the hero bar
- visible in screenshot
- should reflect true theme identity, not shared purple lines

---

#### 14. Auto-art waveform gradients should vary by theme
**Status:** Open  
**Platform:** both  
**Need:**  
- themes need different waveform gradients on auto art

---

#### 15. Horizontal-dominant logo for top bar
**Status:** Open  
**Platform:** both  
**Need:**  
- create/use a more horizontal dominant logo for top bar/header areas

---

#### 16. Desktop playbar text selection
**Status:** Open / design decision  
**Platform:** desktop  
**Thoughts:**  
- track title being selectable/copyable is actually useful
- timecodes and aura text maybe should not be selectable

---

#### 17. Desktop double-click top playback area
**Status:** Open  
**Platform:** desktop  
**Need:**  
- to help desktop playbar gesture access:
- make a double-click in the top playback area toggle minimal ↔ waveform player

---

#### 18. Promo asset cleanup
**Status:** Open  
**Platform:** marketing / release prep  
**Need:**  
- promotional graphics still need cleanup:
  - video
  - splash
  - demo artwork

---

## Screenshot / attachment notes
- Screenshot provided showing Amber theme hero bar still carrying purple-ish lines
- Screenshot context includes playlist rows, mini player, and theme treatment notes
- Additional screenshots may exist for Cinema Viewer vertical art sizing

---

## Desired Codex output
1. Triage all notes into major / medium / cosmetic.
2. Recommend the safest order of attack.
3. Work one issue at a time unless grouping is clearly safer.
4. Do not lose any item from this file.
5. Keep fixes release-safe and practical.
6. Update this handoff or summarize progress after each completed fix.

---

## Recommended order of attack
1. Safari desktop video-art still / poster bug
2. Cinema viewer aspect-ratio fix
3. Loop crop playback bug
4. Product support page
5. Backup file naming
6. Import page stay-open checkbox
7. Playlist swipe gesture
8. THREEPEAT expansion
9. File manager thumbnails
10. Theme / hero-bar / waveform gradient polish

---

## Progress log

### Fixed
- 

### Still open
- Product support page
- Safari desktop video-art still bug
- Cinema viewer aspect-ratio bug
- Loop crop playback bug
- Backup file naming
- Splash first-launch behavior
- Playlist swipe gesture
- THREEPEAT expansion
- Import stay-on-page checkbox
- File manager thumbnails
- Manual waveform zoom controls
- Rename playlist / aura verification
- Theme hero-bar lines
- Auto-art waveform gradients by theme
- Horizontal-dominant top-bar logo
- Desktop text-selection refinement
- Desktop double-click playback-area toggle
- Promo asset cleanup

### Deferred until after launch
- 
