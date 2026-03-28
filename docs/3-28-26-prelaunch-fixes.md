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
**Status:** Audited

**Notes:**
- Need to confirm whether the app is preventing auto-lock / sleep while open.
- Need to determine whether this is intentional, accidental, or platform-default behavior.
- Needs audit and documentation.

**Problem:**
- Needed to determine whether PolyPlay was explicitly preventing iPhone auto-lock / sleep while open.
- This matters because "supports background audio" and "keeps the screen awake" are not the same behavior.

**Repro:**
- Audited the iOS app shell and the JS/native bridge for any sleep-prevention API usage.
- Searched for `isIdleTimerDisabled`, keep-awake plugins, Wake Lock APIs, and related lifecycle hooks across `ios/` and `src/`.

**Root cause:**
- No code path was found that disables auto-lock or explicitly keeps the display awake.
- The likely source of confusion is that the app does intentionally configure background audio, which can make the app feel more "persistent" without actually preventing screen sleep.

**What the code was doing before:**
- [`ios/App/App/AppDelegate.swift`](/Users/paulfisher/Polyplay/ios/App/App/AppDelegate.swift) sets `AVAudioSession` to `.playback` and activates it so audio can continue appropriately in native iOS contexts.
- [`ios/App/App/Info.plist`](/Users/paulfisher/Polyplay/ios/App/App/Info.plist) enables `UIBackgroundModes` with `audio`.
- [`ios/App/App/NowPlayingPlugin.swift`](/Users/paulfisher/Polyplay/ios/App/App/NowPlayingPlugin.swift) and [`src/lib/iosNowPlaying.ts`](/Users/paulfisher/Polyplay/src/lib/iosNowPlaying.ts) only wire iOS Now Playing metadata/state. They do not touch idle timer or screen sleep behavior.

**What we tried:**
- Full repo search for native iOS idle-timer APIs and common web/native keep-awake implementations.
- Manual inspection of the iOS app delegate, Info.plist, native Now Playing plugin, and JS bridge.

**Why that didn't work:**
- No failed fix attempt here; this was an audit/documentation task.
- Repo evidence does not support the claim that PolyPlay intentionally keeps the phone awake.

**Final fix:**
- No code change made.
- Documented the current behavior precisely: PolyPlay enables background audio and Now Playing integration, but does not explicitly disable iPhone auto-lock in the checked-in code.
- If device testing still shows the screen staying awake unusually long, treat that as a separate runtime/device-state investigation rather than an already-confirmed app feature.

**How to avoid this later:**
- When discussing platform behavior, distinguish clearly between:
  - background audio entitlement/session setup
  - lock screen / Now Playing metadata
  - explicit keep-awake behavior via `UIApplication.shared.isIdleTimerDisabled` or equivalent
- If a future release intentionally wants "stay awake while open" behavior, implement it as an explicit, searchable native setting rather than assuming it comes from audio playback setup.

---

### 2. Amber theme needs to feel more amber / candlelight / anti-blue-light
**Status:** Fixed

**Notes:**
- Amber theme should feel more like warm incandescent night mode.
- Desired direction:
  - candlelight hue
  - warmer background
  - less neutral / less blue contamination
  - still readable and elegant

**Problem:**
- Amber theme was not reading as true warm night mode.
- It still picked up too much purple / cool contamination from shared gradients and default player styling.
- The result felt closer to a renamed violet theme than a candlelight / anti-blue-light mode.

**Repro:**
- Switch to Amber theme from Settings/Admin.
- Compare the shell, player controls, and track rows against the intended direction.
- The topbar hinted amber, but other areas still carried purple-biased shadows, highlights, or default player gradients.

**Root cause:**
- Amber had only partial theme-specific overrides.
- Several important surfaces still inherited shared dark-theme or purple-first styling, especially in player chrome and row-card atmospherics.

**What the code was doing before:**
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css) defined amber accent values, but the base background system and decorative haze still leaned cool in places.
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css) largely relied on default player variables unless the theme was light, so amber mode kept too much of the default purple transport/button language.
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) row cards still used a purple-biased glow recipe by default.

**What we tried:**
- Isolated the most visible amber surfaces instead of trying to recolor the entire app blindly.
- Targeted:
  - global amber background/text variables
  - ambient page haze for amber mode
  - amber topbar warmth
  - player control palette and active transport gradients
  - row-card background tint in amber mode

**Why that didn't work:**
- No failed intermediate patch was kept.
- The main lesson from the audit was that changing only the accent token would not be enough because the cool cast lived in multiple hardcoded/shared gradients.

**Final fix:**
- Warmed amber theme root variables in [`styles.css`](/Users/paulfisher/Polyplay/styles.css) so the overall shell reads deeper bronze/lamplight instead of muted violet-brown.
- Added an amber-specific `body::before` atmospheric overlay and warmed the amber topbar gradient in [`styles.css`](/Users/paulfisher/Polyplay/styles.css).
- Added explicit amber player variables and amber-only active button/transport styling in [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css), replacing the most obvious purple carryover.
- Added an amber-specific row-card background override in [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) so rows no longer feel cool against the warmer shell.
- Follow-up pass: applied the same theme-specific treatment to Crimson and Teal so all custom themes now have dedicated shell/player/row styling instead of inheriting too much of the shared purple-default look.

**How to avoid this later:**
- For each theme pack, audit the full visual stack:
  - root tokens
  - shell/background haze
  - player controls
  - list/tile cards
  - active/selected states
- Avoid relying on a single accent token when major gradients and shadows are still hardcoded elsewhere.
- If a theme has a strong mood target like "candlelight," define a small set of dedicated warm surface/active tokens early rather than layering overrides ad hoc.

---

### 3. Auto Art badge is too big / too dominant
**Status:** Fixed

**Notes:**
- Auto Art badge is too visually dominant in both row and tile mode.
- Especially ugly in rows mode.
- Possible direction:
  - reduce size
  - reduce dominance
  - potentially tie color to user's aura
- Need final decision during fix pass.

**Problem:**
- The Auto Art badge was too visually dominant in both tile and row layouts.
- In rows especially, the pill felt oversized and pulled too much attention away from title/artwork.

**Repro:**
- Import a track without custom artwork so PolyPlay generates artwork automatically.
- View the track in row mode and tile mode.
- The `AUTO ART` badge reads louder than intended, especially over small row art.

**Root cause:**
- The badge combined three things at once:
  - long copy (`AUTO ART`)
  - relatively large pill sizing
  - a warm high-contrast badge treatment that stood out more than the surrounding chrome
- In row mode, that treatment was simply too heavy for the available art area.

**What the code was doing before:**
- [`src/components/TrackRow.tsx`](/Users/paulfisher/Polyplay/src/components/TrackRow.tsx) and [`src/components/TrackTile.tsx`](/Users/paulfisher/Polyplay/src/components/TrackTile.tsx) rendered the badge as `AUTO ART`.
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) styled the badge as a fairly strong pill, and the auto variant used a prominent amber-toned gradient.

**What we tried:**
- Kept the concept of the badge but reduced its information density and visual weight instead of removing it.
- Shifted the auto badge away from a loud amber block toward a subtler aura-tinted treatment.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The main lesson was that simply shrinking the font would not be enough if the badge still had long copy and high-contrast chrome.

**Final fix:**
- Shortened the copy from `AUTO ART` to `AUTO` in [`src/components/TrackRow.tsx`](/Users/paulfisher/Polyplay/src/components/TrackRow.tsx) and [`src/components/TrackTile.tsx`](/Users/paulfisher/Polyplay/src/components/TrackTile.tsx).
- Reduced the base badge size, padding, blur, and shadow in [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css).
- Made the Auto badge more subtle by tying it to the track aura color and adding a small aura dot, instead of using the previous louder amber pill treatment.
- Reduced row-mode weight further with a smaller row-specific badge treatment.

**How to avoid this later:**
- Badges on artwork should compete with the art as little as possible.
- For small surfaces like row thumbnails, prefer:
  - shorter labels
  - lower-contrast chrome
  - compact indicators
- If a badge describes a derived state like generated artwork, it should read as metadata, not as a primary callout.

---

### 4. Major UI confusion: first-time Vault export success feedback is misleading
**Status:** Fixed

**Notes:**
- User gets a congratulatory/success toast before the save box appears.
- This reads like a logic failure to the user.
- User reproduced this twice.
- User had to tap twice on Export Vault to get the Save dialog to appear.
- Need to audit the exact timing/flow and document it clearly.

**Problem:**
- On first export, the Vault flow could show a positive/success message before the user actually saw a save/share surface.
- On iPhone this reads like the app is claiming success before anything tangible happened.
- The user also observed cases where Export Full Backup seemed to need a second tap.

**Repro:**
- Open Vault.
- Tap Export Full Backup on iPhone / iOS-like save-preview path.
- The app zips the archive asynchronously, then tries to open the preview/share route only after that async work completes.

**Root cause:**
- The export flow did meaningful async work before trying to open the preview target for the iOS fallback path.
- That can break the browser's direct user-activation chain for opening a new tab/window, especially on iPhone-like contexts.
- Result: the success/status copy could update while the actual preview/save UI was still delayed, blocked, or felt like it required another tap.

**What the code was doing before:**
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) waited for `exportFullBackup()` to finish, then called `saveBlobWithBestEffort(...)`.
- On iOS / standalone-PWA fallback, `saveBlobWithBestEffort(...)` opened the blob preview only at the end of that async chain.
- The flow already changed copy from `Backup opened...` to `Backup ready...`, which helped wording, but did not solve the activation-timing issue.

**What we tried:**
- Audited the export flow in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) and the generic helper in [`src/lib/saveBlob.ts`](/Users/paulfisher/Polyplay/src/lib/saveBlob.ts).
- Traced the exact order:
  - button tap
  - zip build
  - save helper
  - iOS preview fallback
  - status toast update

**Why that didn't work:**
- Copy-only changes were insufficient because the confusing part was not just the wording.
- The real issue was that the preview/save surface was being opened too late in the interaction chain.

**Final fix:**
- On Export Full Backup tap, iOS / standalone-PWA contexts now open a lightweight placeholder window immediately while user activation is still live.
- After the zip finishes, the backup blob is routed into that already-open preview window instead of trying to open a fresh one late.
- This keeps the save/share path tied to the original user gesture and reduces the chance of "nothing happened" or "tap twice" behavior.
- The status copy remains explicit:
  - `Zipping backup now.`
  - then `Backup ready for ... Use Share and Save to Files on iPhone.`
- Follow-up Safari desktop fix:
  - desktop Safari was incorrectly eligible for the Web Share branch, which could surface the macOS share sheet instead of a straightforward local save/download path
  - the save helper now skips `navigator.share()` on desktop Safari and prefers the normal save/download route there

**How to avoid this later:**
- Any browser flow that depends on opening a new tab/window, share sheet, or picker should preserve user activation if heavy async work happens first.
- Treat "copy confusion" and "gesture-chain / popup timing" as separate categories during debugging.
- For iPhone-specific save flows, prefer opening the destination surface synchronously and filling it after async generation completes.

---

### 5. Major UI confusion: Mute state is still not visually obvious
**Status:** Fixed

**Notes:**
- Mute logic may be fixed, but the visual clarity is still insufficient.
- In light mode especially, user cannot easily tell whether Mute is enabled.
- Desired behavior:
  - Mute enabled should be visually distinct
  - should likely use the selected aura color
  - may also use a strobe / pulse if elegant
  - applies to iOS and desktop
- This is release-important, not optional polish.

**Problem:**
- Mute state was still too easy to miss in light mode.
- The button was technically active, but it visually blended into the broader family of "selected" controls instead of reading as a distinct warning/stateful mute mode.

**Repro:**
- Switch to Light theme.
- Cycle the DIM/MUTE control until `MUTE` is active.
- Compare its visibility to surrounding active controls in the same player cluster.

**Root cause:**
- Light theme had a general active-state treatment, but no dedicated light-theme mute override.
- That meant mute inherited styling that was too close to ordinary active buttons, especially in bright UI contexts.

**What the code was doing before:**
- [`src/components/PlayerControls.tsx`](/Users/paulfisher/Polyplay/src/components/PlayerControls.tsx) correctly added `is-mute` when mute was active.
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css) had generic `.pc-dim-btn.is-mute` and `.pc-novelty-btn.is-mute` styling, but no stronger light-theme-specific mute treatment.

**What we tried:**
- Narrowed the problem statement to light mode only.
- Added a dedicated light-theme mute override in [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css) with:
  - a warmer/high-contrast alert tint
  - a clearer border/ring
  - stronger shadow separation
  - a subtle pulse on the `MUTE` control

**Why that didn't work:**
- No failed intermediate patch was kept.
- The main point from the audit was that broad cross-theme restyling was unnecessary because the remaining clarity issue was isolated to light mode.

**Final fix:**
- Added explicit `html[data-theme="light"]` mute-state styling in [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css) for the mute-related controls.
- Gave light-mode `MUTE` a distinct warm warning treatment and pulse so it reads immediately as an engaged special state instead of a standard active button.
- This fix affects light theme on `both` desktop and iOS.

**How to avoid this later:**
- When a control has a stronger semantic state than "selected," give it a dedicated style path instead of relying on the shared active treatment.
- Always evaluate control-state contrast separately in dark and light themes; a state that reads clearly in dark UI can disappear in light UI.

---

### 6. Now Playing / lock screen should support previous and next track buttons
**Status:** Fixed

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
- iOS lock screen / Now Playing controls did not expose real previous-track and next-track actions.
- The app showed transport controls, but they were effectively limited to play/pause plus generic seek behavior rather than playlist navigation.

**Repro:**
- Start playback on iPhone in the native app.
- Open lock screen / Now Playing controls.
- Observe that previous/next track controls are missing while skip-style transport remains available.

**Root cause:**
- PolyPlay synced Now Playing metadata and playback state, but it did not register remote transport command handlers.
- Without native remote-command wiring, iOS had no route to call the app's existing `playPrev` / `playNext` logic.
- The browser Media Session layer also had metadata/position state but no action handlers for previous/next track.

**What the code was doing before:**
- [`ios/App/App/NowPlayingPlugin.swift`](/Users/paulfisher/Polyplay/ios/App/App/NowPlayingPlugin.swift) only populated `MPNowPlayingInfoCenter`.
- [`src/lib/iosNowPlaying.ts`](/Users/paulfisher/Polyplay/src/lib/iosNowPlaying.ts) only exposed metadata/playback-state methods.
- [`src/lib/mediaSession.ts`](/Users/paulfisher/Polyplay/src/lib/mediaSession.ts) synced metadata and position state, but did not bind track-navigation actions.

**What we tried:**
- Audited the native plugin, JS bridge, and app-level playback functions.
- Reused the existing app navigation path instead of inventing separate remote-playback logic.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The important design choice was to avoid duplicating playback logic across native and web layers.

**Final fix:**
- Added native iOS remote command registration in [`ios/App/App/NowPlayingPlugin.swift`](/Users/paulfisher/Polyplay/ios/App/App/NowPlayingPlugin.swift) for:
  - play
  - pause
  - toggle play/pause
  - previous track
  - next track
- Disabled native skip-forward / skip-backward commands there so the transport surface can favor real track navigation.
- Added JS listener support in [`src/lib/iosNowPlaying.ts`](/Users/paulfisher/Polyplay/src/lib/iosNowPlaying.ts) for native remote command events.
- Added Media Session action binding in [`src/lib/mediaSession.ts`](/Users/paulfisher/Polyplay/src/lib/mediaSession.ts) for previous/next/play/pause on supported browser surfaces.
- Wired both native and Media Session command events into existing [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) functions:
  - `playPrev`
  - `playNext`
  - pause current playback
  - resume current playback

**How to avoid this later:**
- Treat "Now Playing metadata" and "remote transport control" as separate integration tasks.
- When platform transport controls are required, always verify both halves:
  - metadata/state sync
  - explicit action/command handlers
- Route remote commands into the same app playback functions used by on-screen controls so behavior stays consistent.

---

### 7. Safari Desktop major: grey square instead of still art from imported video artwork
**Status:** Fixed

**Notes:**
- Significant Safari desktop bug.
- User uploads video for artwork.
- In fullscreen mode, video artwork plays correctly.
- Outside fullscreen, still-art/poster does not generate or display.
- Result is a grey square where artwork should be.
- Need to know exactly why this happens specifically in Safari on desktop.

**Problem:**
- On Safari desktop, imported video artwork could play correctly in fullscreen while the non-fullscreen still-art/poster showed up as a grey square.

**Repro:**
- Import a track with video artwork on Safari desktop.
- Fullscreen artwork video plays.
- In tile/row/non-fullscreen surfaces, the saved poster can appear as a grey/blank square instead of a useful still frame.

**Root cause:**
- The poster-generation path could succeed technically while capturing an unusable frame.
- That means Safari desktop was not always failing poster generation outright; it could produce a blank/near-uniform frame that then got stored and rendered as if it were valid artwork.

**What the code was doing before:**
- [`src/lib/artwork/videoPoster.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoPoster.ts) waited for metadata/seek readiness and then accepted the captured canvas frame if export succeeded.
- If poster generation threw, the DB/admin flow already had fallback behavior, but it did not reject "successful but blank" poster captures.

**What we tried:**
- Audited the capture path and the DB/admin fallback behavior together.
- Added a usable-frame sanity check instead of treating any successful `drawImage` + `toBlob` result as valid.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The key lesson was that "no exception" was not a strong enough success signal for Safari poster capture.

**Final fix:**
- Added blank-frame detection in [`src/lib/artwork/videoPoster.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoPoster.ts).
- Poster capture now retries candidate frame times and rejects near-uniform/blank captures instead of storing them as valid artwork.
- That allows existing fallback paths to take over when Safari produces a bad frame rather than a usable poster.
- This fix primarily affects `desktop`, with the known failure reported on `Safari desktop`.

**How to avoid this later:**
- For media-derived artwork, validate the actual captured pixels, not just the fact that canvas export succeeded.
- Treat Safari media capture as "can return bad-but-not-error frames" rather than only "success/failure."

---

### 8. Safari Desktop major: welcome/onboarding boxes still too tall
**Status:** Fixed

**Notes:**
- This has persisted through development.
- Safari desktop still shows onboarding/welcome boxes with too much vertical space.
- All other platforms reportedly fixed.
- Needs audit, debug, fix, and documentation.

**Problem:**
- Safari desktop was still rendering the welcome/onboarding cards with too much vertical space.
- The cards felt overly tall compared with other platforms and took up more of the top-of-screen experience than intended.

**Repro:**
- Open the app on Safari desktop in an onboarding/welcome state.
- Compare the empty-library welcome and open-state cards against the intended compact onboarding layout.

**Root cause:**
- The card styling was already close, but the combination of title width, line height, clamp sizing, copy width, and vertical spacing was still a little too loose for Safari desktop rendering.
- This appears to have been a layout-tuning issue rather than a deeper structural bug.

**What the code was doing before:**
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) used slightly roomier title/body spacing and narrower text widths, which increased line wraps and card height.

**What we tried:**
- Tightened only the relevant onboarding card metrics instead of redesigning the components.
- Reduced padding/gaps, slightly reduced title sizing, widened safe text measure, and tightened line height.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The fix did not require component restructuring once the problem was treated as a Safari-sensitive spacing issue.

**Final fix:**
- Compacted the open-state and empty-library welcome card styles in [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css).
- Adjusted:
  - card padding
  - internal gap
  - title clamp sizing
  - title/body line height
  - text measure / max-width
- This fix primarily affects `desktop`, with the reported problem on `Safari desktop`.

**How to avoid this later:**
- For onboarding cards, validate vertical rhythm on Safari desktop explicitly, not just Chromium-based browsers.
- Keep critical welcome-card text blocks on slightly wider measures to reduce avoidable wrapping.

---

### 9. Desktop Admin import flow should allow Enter/Return to trigger Import
**Status:** Fixed

**Notes:**
- On desktop, after choosing the audio file and optional artwork, pressing Enter/Return should behave like clicking `Import`.
- This should help the manual import flow feel faster and more keyboard-friendly.

**Problem:**
- The desktop import form did not reliably treat Enter/Return as an import action unless focus happened to be in the right native submit context.

**Repro:**
- Open Settings/Admin in desktop mode on the Import Track page.
- Choose an audio file and optionally artwork.
- Press Enter/Return.
- Expected behavior: same result as clicking `Import`.

**Root cause:**
- The form had a submit handler, but Enter behavior depended on which control currently owned focus.
- That made the keyboard path inconsistent for the desktop import workflow.

**What the code was doing before:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) used a normal form submit for Import, but did not add any explicit keyboard handling for the wider desktop flow.

**What we tried:**
- Added a form-level Enter/Return handler for the Import Track form.
- Limited it to cases where the required audio file is already selected.
- Excluded controls where Enter should not trigger import, such as buttons, selects, textareas, and the poster-frame range/file inputs.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The main requirement was just to make the existing form submit path easier to reach from the keyboard.

**Final fix:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now calls `requestSubmit()` on Enter/Return from the Import Track form when an audio file is loaded and the focused control is appropriate.
- On desktop, pressing Enter/Return now behaves like clicking `Import` for the common import flow.

**How to avoid this later:**
- For form-driven admin workflows, verify both pointer and keyboard submission paths.
- If a form’s primary action matters to speed, make Enter/Return behavior explicit instead of relying only on browser-default focus behavior.

---

### 10. Settings/Admin iframe should match the active theme mode on desktop
**Status:** Fixed

**Notes:**
- Settings and Upload should visually match the currently selected theme mode instead of falling back to a mismatched iframe background.
- Safari desktop also exposed the shell/layout mismatch more obviously.

**Problem:**
- The Settings/Admin iframe could render with a bright/default-looking background that did not match the active app theme.
- On Safari desktop this read like a layout bug because the iframe shell looked disconnected from the themed parent UI.

**Repro:**
- Open Settings/Admin from the player while using a custom theme such as Teal or Amber.
- Compare the parent shell and the iframe background on desktop, especially Safari desktop.

**Root cause:**
- The admin iframe was not applying the same theme state plumbing as the main app.
- It only toggled `theme-dark` vs non-dark and never applied:
  - `data-theme`
  - `data-theme-slot`
  - custom-theme body classes
- That left the iframe using fallback/default theme tokens rather than the active theme pack.

**What the code was doing before:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) partially synced theme state, but only for dark vs light behavior.
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) had admin dark-theme styling, but no equivalent custom/light shell treatment for the iframe root.

**What we tried:**
- Synced the admin iframe to the same theme attributes and body classes the main app uses.
- Added admin-shell background styling that respects the active theme tokens instead of assuming a single dark shell.

**Why that didn't work:**
- No failed intermediate patch was kept.
- The main issue was incomplete theme propagation, not a complicated Safari-only rendering defect.

**Final fix:**
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) now applies:
  - `data-theme`
  - `data-theme-slot`
  - `theme-dark`
  - `theme-custom`
  - `theme-custom-crimson`
  - `theme-custom-teal`
  - `theme-custom-amber`
- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) now gives the admin iframe shell themed backgrounds for light/custom contexts instead of only dark mode.
- Result: Settings/Admin and Upload now visually track the active theme mode on desktop, including Safari desktop.

**How to avoid this later:**
- Any iframe-hosted app surface should receive the full theme contract, not a reduced approximation.
- When a page depends on global theme classes/attributes, keep iframe and parent theme plumbing aligned.

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
