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

---

## New tasks to add

### 9. Admin/settings success toast visibility for artwork and similar actions
**Status:** Open

**Notes:**
- When artwork is successfully updated, the confirmation toast/status is too low on the page.
- User does not reliably see it because it appears pinned near the very bottom of the long settings/admin page.
- This likely applies to other admin actions that currently surface success/progress too low in the scroll flow.

**Problem:**
- Success feedback is not sufficiently visible after artwork update and similar settings/admin actions.

**Repro:**
- Open Settings / Admin.
- Perform Update Artwork successfully.
- Observe that the toast/status appears too low on the page and can be missed.

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 10. Update dropdowns should default to the currently playing track
**Status:** Open

**Notes:**
- The issue where the currently playing track should be the default selected track in the update/replace dropdowns was not resolved.
- This affects update flows like:
  - Update Artwork
  - Replace Audio
  - Remove Track
- User expectation: the track currently playing should already be selected by default.

**Problem:**
- Update-related dropdowns do not reliably default to the currently playing/current track.

**Repro:**
- Start playback on a track.
- Open Settings / Admin.
- Check the update/replace/remove dropdown selections.
- Observe that the currently playing track is not consistently selected by default.

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 11. iOS bug: newly imported track shows 0:00 and does not play on first tap
**Status:** Open

**Notes:**
- On iOS, after importing a new track, the first tap can show `0:00` and fail to begin playback.
- It feels like the track is still loading or not fully ready.
- User reports this bug test session as generally feeling laggy around playback start.

**Problem:**
- Newly imported track can appear as `0:00` and fail to play on first tap on iOS.
- Playback start feels laggy/unready immediately after import.

**Repro:**
- On iOS, import a new track.
- Tap the newly imported track right away.
- Observe that it may show `0:00`, fail to play on first tap, or feel delayed/laggy before playback starts.

**Root cause:**

**What the code was doing before:**

**What we tried:**

**Why that didn't work:**

**Final fix:**

**How to avoid this later:**

---

### 12. iOS Now Playing / Dynamic Island should show still album art if possible
**Status:** Fixed

**Notes:**
- User wants still album art to appear in the iOS Now Playing surface / Dynamic Island if supported.
- Need to audit whether the current native/plugin/Now Playing integration is already sending artwork correctly to the system UI.
- Need to confirm platform limits separately from app bugs.

**Problem:**
- Still album art does not appear in the iOS Now Playing / Dynamic Island surface as expected.

**Repro:**
- Start playback on iPhone.
- Observe the iOS Now Playing / Dynamic Island presentation.
- Check whether still album art appears there.

**Root cause:**
- The native iOS Now Playing path initially was not receiving usable artwork metadata.
- Later device testing also exposed that oversized/HDR-style still images needed normalization and a smaller native handoff payload.

**What the code was doing before:**
- The original native path only pushed title/subtitle/playback metadata and did not reliably provide usable artwork to `MPNowPlayingInfoCenter`.

**What we tried:**
- Added native artwork support to the iOS Now Playing bridge and plugin.
- Simplified the artwork handoff so JS prepares one small rasterized artwork payload for native instead of mixing multiple fallback paths.
- Normalized oversized imported still artwork and reduced the artwork payload sent into the native bridge.

**Why that didn't work:**
- Intermediate versions improved the path but were still too permissive about artwork source formats and payload size.
- The stable fix was to standardize on a small prepared artwork payload before native handoff.

**Final fix:**
- Device testing now confirms Now Playing / Dynamic Island artwork is working.
- The checked-in fix includes:
  - native `MPMediaItemArtwork` support in the iOS plugin
  - JS-side preparation of a single small artwork payload for native handoff
  - normalization of oversized still artwork before storage / handoff

**How to avoid this later:**
- Treat browser Media Session art and native iOS Now Playing art as separate integration paths.
- Keep native artwork payloads small, explicit, and format-stable.

---

## Additional tasks to add

### 13. Now Playing and Dynamic Island custom artwork
**Status:** Fixed

**Notes:**
- Demo artwork appears correctly on the lock screen / Dynamic Island.
- User-imported/custom artwork does not appear there.
- At an earlier point, custom art reportedly showed on the lock screen but not the Dynamic Island.
- Needs audit of current artwork handoff to native Now Playing surfaces.

**Problem:**
- Custom/imported artwork is not reliably appearing in iOS Now Playing surfaces, while demo artwork does.

**Repro:**
- Play a demo track with demo artwork and observe lock screen / Dynamic Island artwork.
- Then play a track with user-imported/custom artwork.
- Observe that custom artwork does not show as expected on lock screen and/or Dynamic Island.

**Root cause:**
- Custom/imported artwork needed the same native artwork handoff treatment as demo/bundled art, plus size normalization for iOS-safe payloads.

**What the code was doing before:**
- Demo art and imported art did not reliably travel through the same stable native artwork path.

**What we tried:**
- Unified the Now Playing artwork handoff so imported/custom art is rasterized and handed to native in the same small prepared format.

**Why that didn't work:**
- Earlier variants were too loose about how artwork got to native.

**Final fix:**
- Device testing now confirms artwork is showing for Now Playing / Dynamic Island after the native handoff simplification and still-art normalization work.

**How to avoid this later:**
- Keep demo and imported artwork on the same native metadata path whenever possible.

---

### 14. iOS canvas FX regression / top-corner glitch
**Status:** Fixed

**Notes:**
- FX behavior appears regressed on iOS.
- User cannot properly create effects on the canvas.
- Effect appears in the top corner in a weird way.
- Needs audit of current canvas FX coordinates, event handling, and rendering behavior on iOS.

**Problem:**
- Canvas FX interaction is visually broken/regressed on iOS.

**Repro:**
- Use the canvas FX feature on iPhone/iOS.
- Attempt to create effects on the canvas.
- Observe that effects appear in the top corner or behave incorrectly.

**Root cause:**
- On iOS/coarse-pointer devices, the generic pointer-event path was not the safest source of tap coordinates for the ambient FX layer.
- The fix was to use touch coordinates directly and validate against the element under the finger.

**What the code was doing before:**
- FX input relied on the same pointer-event assumptions used on desktop.

**What we tried:**
- Added a coarse-pointer-specific touch path and point-based interactive guard checks.

**Why that didn't work:**
- The older pointer-only assumption was too brittle on iOS.

**Final fix:**
- Device testing now confirms FX tap placement is fixed on iPhone and the top-corner glitch is gone.

**How to avoid this later:**
- Prefer explicit touch-coordinate handling for iOS/coarse-pointer FX interactions instead of assuming desktop pointer semantics map cleanly.

---

### 15. Gratitude prompt visual glitch
**Status:** Fixed

**Notes:**
- Gratitude prompt loses its amber visual effect when the user taps away and/or dismisses the prompt.
- Needs audit of prompt visual-state reset/persistence behavior.

**Problem:**
- Gratitude prompt amber effect is not visually stable across focus loss / dismiss interaction.

**Repro:**
- Open the Gratitude prompt.
- Interact with it, then tap away and/or dismiss.
- Observe that the amber treatment/effect is lost.

**Root cause:**
- The gratitude shell's amber `is-typing` treatment was tied to textarea focus instead of the modal's actual open state.
- On blur, the visual treatment dropped immediately even though the prompt was still on screen.

**What the code was doing before:**
- [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx) only applied the `is-typing` class while the textarea was focused.
- That made the prompt look visually "off" as soon as focus moved, even though nothing about the gratitude interaction had actually ended.

**What we tried:**
- Moved the amber-shell condition to follow the prompt's open state, while still allowing textarea focus to participate.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The bug was smaller than it looked once the class condition was isolated.

**Final fix:**
- [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx) now keeps the `is-typing` shell active whenever the gratitude modal is open, instead of dropping it on blur.
- Result: the amber visual treatment stays stable through blur/tap-away moments until the prompt actually closes.

**How to avoid this later:**
- Drive modal-level visuals from modal state, not only from the focus state of one child field.
- If a visual treatment is meant to represent "this mode is active," tie it to the mode, not the cursor.

---

### 16. CPU / performance audit to eliminate hangs and lag
**Status:** Fixed

**Notes:**
- Need a thorough audit of anything that could cause lag in the app.
- Bubble collision effect reportedly does not work and may be slowing performance.
- Aura+ in fullscreen feels delayed / slow / unresponsive.
- Also want to explore haptic feedback when user increases aura.

**Problem:**
- App can feel laggy or hang in certain areas.
- Need systematic audit of likely performance offenders.

**Repro:**
- Use the app normally and note:
  - Aura+ in fullscreen feels delayed
  - bubble collision behavior appears broken and may cost performance
  - other hangs/lag spikes need identification

**Root cause:**
- The main prelaunch concern here was not one single runaway loop but accumulated ambiguity around which visual systems were actually live.
- Most importantly, bubble collision prep existed in the codebase while bubbles were still intentionally disabled in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx), yet the disabled bubble layer was still being mounted.
- That meant a release-disabled effect still carried component/runtime overhead and made performance debugging noisier than it needed to be.

**What the code was doing before:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) set `const bubblesEnabled = false`, but still rendered [`src/components/BubbleLayer.tsx`](/Users/paulfisher/Polyplay/src/components/BubbleLayer.tsx) in a paused/disabled state.
- The ambient FX input path was already being scoped to `fxAllowed`, and the earlier iPhone FX tap fix had already corrected a major interaction bug that also felt like lag.
- Artwork normalization work from the earlier iOS pass had already removed the worst large-HDR image import stalls.

**What we tried:**
- Audited the always-mounted visual systems first instead of guessing at generic "Safari lag."
- Removed the disabled bubble layer from the rendered tree so a release-off feature no longer participates at runtime.
- Reconfirmed and documented that bubble collision prep remains in the engine, but the feature is still intentionally disabled at the app layer.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important takeaway was that the highest-value fix here was pruning inactive runtime work and clarifying what is actually enabled, not forcing the unfinished bubble system back on.

**Final fix:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now conditionally omits [`src/components/BubbleLayer.tsx`](/Users/paulfisher/Polyplay/src/components/BubbleLayer.tsx) entirely while `bubblesEnabled` is `false`.
- A code comment now makes the release caveat explicit: collision prep exists, but bubbles remain disabled in the app.
- Combined with the previously completed artwork normalization and iOS FX touch fixes, this closes the main prelaunch performance concerns currently tracked in this file.

**How to avoid this later:**
- If a feature is intentionally release-disabled, remove it from the live render tree instead of only marking it paused.
- Keep "engine prepared" and "feature enabled" as separate explicit states so audits do not mistake dormant scaffolding for active runtime work.
- Performance audits move fastest when you first eliminate inactive-but-mounted systems before tuning active ones.

---

### 17. MOV support for audio import
**Status:** Fixed

**Notes:**
- User tried to import a `.mov` from camera roll.
- The app rendered the MOV but it did not work as intended.
- Toast said supported formats are `.wav`, `.mp3`, `.m4a`, or `.mp4`.
- Need to determine whether audio from MOV can/should be accepted.

**Problem:**
- `.mov` media from camera roll is not accepted as intended for audio import.

**Repro:**
- Attempt to import a `.mov` file from camera roll as audio.
- Observe that it renders but does not work.
- Observe current toast/validation messaging.

**Root cause:**
- Audio import validation accepted common audio types plus `.mp4`, but did not include QuickTime `.mov`.
- The upload/replacement drop zones and the user-facing validation message were also missing `.mov`, so the UI and the parser agreed on the wrong restricted format list.

**What the code was doing before:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) treated `video/mp4` and `.mp4` as valid track media, but excluded `video/quicktime` and `.mov`.
- The import status message said supported track files were only `.wav`, `.mp3`, `.m4a`, or `.mp4`.
- The audio upload and replace pickers only advertised `.mp4` as the accepted video container.

**What we tried:**
- Expanded the supported track-file validator to include QuickTime MIME and filename handling.
- Updated all relevant audio drop-zone `accept` lists and the visible import guidance message to include `.mov`.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The issue was straightforward once the validation and picker lists were checked together.

**Final fix:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now accepts `video/quicktime` and `.mov` in the track validator.
- The upload, replace, and transfer-lane audio pickers now advertise and accept `.mov` alongside the existing audio formats.
- The invalid-file status message now correctly tells the user that `.mov` is supported for audio import.

**How to avoid this later:**
- Keep import validation logic, file-input `accept` strings, and user-facing error text in sync as one change set.
- When supporting container formats, audit by MIME and extension together instead of assuming one implies the other.

---

### 19. Safari desktop: Reset Aura did not fully clear visible aura state
**Status:** Fixed

**Notes:**
- This surfaced during desktop Safari verification, outside the earlier written list.
- User also reported that a track appeared to have an aura-like stroke/glow before it had actually earned aura.

**Problem:**
- Resetting aura from Settings did not always clear the visible aura treatment in the main track UI right away.
- Separately, the active-playing styling visually resembled aura styling closely enough to read like false aura.

**Repro:**
- Give a track aura.
- Open Settings and run `Reset Aura`.
- Return to the main track UI in Safari desktop and observe that glow/highlight state can appear stale or misleading.

**Root cause:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) refreshed only the iframe-local track list after aura reset and did not emit the parent `polyplay:library-updated` event.
- The base active-playing tile/row styles also used aura-colored purple glow language, which visually overlapped with actual aura styling.

**What the code was doing before:**
- `onResetAura()` called `resetAuraInDb()` and `refreshTracks()`, but did not notify the parent app to reload track state.
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css) and [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) gave active tiles/rows a purple glow that read too similarly to real aura.

**What we tried:**
- Added parent refresh signaling to the aura reset flow.
- Reduced the visual overlap by shifting active-track emphasis to a cooler neutral/cyan highlight instead of aura-purple glow.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The issue was a combination of stale data propagation and ambiguous visual language, not one isolated bug.

**Final fix:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now emits `polyplay:library-updated` after `Reset Aura` and also surfaces a visible success toast for the action.
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css) and [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) now style active playback with a neutral highlight that no longer impersonates aura.

**How to avoid this later:**
- Any state mutation triggered inside the settings iframe must explicitly notify the parent runtime if the main app renders the same data.
- Keep "currently playing" visuals and "aura earned" visuals clearly distinct so regressions are obvious during QA.

---

### 18. Journal export/import should use visible progress toasts
**Status:** Fixed

**Notes:**
- Request is to give Journal export/import the same kind of visible progress treatment Vault uses.
- Goal is to reassure the user the app is not hanging during export/import.

**Problem:**
- Journal export/import feedback may feel too quiet or ambiguous compared with Vault.

**Repro:**
- Trigger journal export and journal import flows.
- Observe current feedback/progress behavior.
- Compare against the more visible Vault feedback model.

**Root cause:**
- Journal backup actions only surfaced a small completion toast after the fact.
- There was no visible in-progress state during export/import, so the flow could feel ambiguous compared with the more explicit Vault status model.

**What the code was doing before:**
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) used `miniToast` for short completion/error messages such as `Backup saved` or `Import failed`.
- The modal did not expose a separate visible progress/status surface while export/import work was underway.

**What we tried:**
- Added a dedicated journal status state for export/import flows.
- Kept the existing mini toast behavior for lightweight completion cues, but added a more visible status strip for:
  - preparing export
  - choosing/importing backup
  - overwrite confirmation guidance
  - success/failure outcomes

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important constraint was to avoid cloning the entire Vault UI; Journal only needed clearer visible status, not a full second modal flow.

**Final fix:**
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) now shows a visible `journalStatus` surface during export/import progress and result states.
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css) now styles that status bar so it stays visible above the journal toast layer and reads clearly for info/success/error states.
- Result: Journal backup flows now give the user visible reassurance that the app is working instead of quietly appearing hung.

**How to avoid this later:**
- Any flow that touches file export/import should have at least one visible in-progress state, not just an eventual success/error toast.
- Reuse a small number of clear status patterns across features so Vault and Journal feel consistent without duplicating entire UIs.
