# PolyPlay Codex Handoff — 2026-04-06

## Session mode
This was a stabilization / recovery session.

Operating constraints followed:
- no new features
- no broad redesign
- one task at a time
- diagnosis first unless the fix was tiny and low risk
- surgical containment over elegance
- no auto-commit

Primary control sheet for the session:
- `/Users/paulfisher/Polyplay/docs/polyplay_release_tasks_2026-04-05.md`

Use this handoff together with:
- `/Users/paulfisher/Polyplay/docs/polyplay_codex_handoff_2026-04-03.md`
- `/Users/paulfisher/Polyplay/docs/polyplay_release_tasks_2026-04-05.md`

## Current repo state
- branch: `main`
- working tree is dirty
- current uncommitted files from the latest pass:
  - `docs/polyplay_release_tasks_2026-04-05.md`
  - `src/App.tsx`
  - `src/lib/db.ts`

## What changed this session

### 1. Long media import containment
Two related containment passes landed in the shared import/runtime path.

#### iOS long-audio import containment
- `src/lib/db.ts`
- Long iOS imports now skip expensive waveform-based auto-art generation when:
  - file size is over `25 MB`
  - or duration is over `20 minutes`
- Failed imports now clean up newly written blob keys if the write fails before library save completes.

#### Long video / long media refresh containment
- `src/lib/db.ts`
- `src/App.tsx`
- General refresh no longer hydrates playback audio URLs for visible tracks.
- Playback audio URL hydration now happens only for the current track.
- Eager current-track audio-blob hydration was removed; crop loads the blob only on demand.
- Long guarded imports now get a cheap stored fallback poster:
  - theme-gradient background
  - music-note poster
  - stored as real artwork so it appears in playbar, fullscreen, and now playing

Why this mattered:
- The earlier hydration fix removed full-library blob loading, but long imported video tracks could still trigger iPhone memory pressure because visible tracks were still getting playback object URLs during refresh.

### 2. Deleted playlists not freeing storage
- `src/lib/backup.ts`
- Full vault backup export now includes only tracks reachable from surviving non-demo playlists.
- This was intentionally an export-time scoping fix, not a delete-time storage redesign.

Why this mattered:
- Playlist deletion logic already looked mostly correct.
- The user-trust issue was that full backup could still package unreachable non-demo track records.

### 3. iOS vault import flashing / bricked reopen containment
- `src/lib/db.ts`
- `src/App.tsx`
- General catalog refresh now stays much lighter than before.
- Blob-heavy hydration was pushed away from broad refresh paths.

Important follow-up:
- The later long-video containment pass above is effectively a continuation of this same stabilization line and is the more current state.

### 4. Toast clarity pass
- `src/lib/backup.ts`
- `src/lib/toastUtils.ts`
- `src/App.tsx`
- `src/admin/AdminApp.tsx`
- Vault import/export now exposes clearer phase labels:
  - opening vault backup
  - restoring vault media
  - finalizing vault restore
  - collecting vault media
  - building vault zip
- Active process toasts were aligned with shimmer matching.

### 5. Import page ergonomics
- `src/admin/AdminApp.tsx`
- `src/App.tsx`
- `src/components/EmptyLibraryWelcome.tsx`
- Import page now leads with audio selection.
- A second Import button was surfaced higher in the upload form.
- Onboarding/import guidance copy is now more procedural and less vague.

### 6. Theme / presentation fixes
These were all narrow and local:
- `src/components/FullscreenPlayer.tsx`
  - disabled animated auto-art presentation loop so Rasta auto art stays visually stable
- `src/components/WaveformLoop.tsx`
  - added local redraw triggers so waveform no longer stays blank before playback after an early zero-size layout pass
- `src/components/SplashOverlay.tsx`
  - Safari splash fallback now stays visible until actual playback/frame progress, not just `canplay`/`loadeddata`
- `src/App.tsx`
- `src/admin/AdminApp.tsx`
  - explicit theme switching now always updates the intended aura color
- `styles.css`
  - tile backing-layer seam fixed so black/square rectangle no longer shows behind rounded corners
- `src/fx/ambientFxEngine.ts`
  - Merica fireworks now accent every 6th tap with a stronger multi-burst cadence

## Most important current state

### Active unfinished item
The latest active containment is:
- long video import refresh containment

Code is already changed, but device QA is still needed.

Highest-priority QA for tomorrow:
1. Re-import a long video track on iPhone and confirm the app no longer enters a refresh/reopen loop.
2. Confirm the fallback note poster appears in:
   - playbar
   - fullscreen player
   - now playing
3. Confirm regular imported tracks still play normally after refresh/reopen.
4. Confirm crop still works on imported tracks after the on-demand audio-blob change.

### Why tomorrow should start there
This is still the most trust-critical open item because it can make the app feel bricked after import on iPhone.

If the loop is still happening after the current containment:
- inspect whether current-track hydration is still too heavy on iOS for long video sources
- inspect whether any art-video or now-playing path is still forcing large blob/data materialization on import/reopen
- stay narrow; do not reopen backup architecture or general import redesign

## Recommended next task order
If the long-video containment QA passes, the most sensible next stabilization order is:
1. verify remaining import/vault QA from today’s passes
2. resume highest-trust unfinished audits from the release board:
   - AirPods / now-playing unpause / competing audio stale-state audit
   - playlist persistence / “playlist disappeared after reopening” audit
   - Gratitude Journal export naming
   - iPhone keyboard overlay accommodation for Gratitude Journal + Import page
   - Theme FX hangover guardrails

## QA still pending from today’s implemented passes

### Long media import containment
- re-test hour-plus MP3 import on iPhone
- test both new playlist and existing playlist
- confirm fallback note poster appears for long guarded imports
- confirm no refresh/reload loop for long imported video

### Vault/export clarity
- confirm active shimmer labels read correctly in both app and admin
- confirm backup-size messages read as export-limit errors, not vague storage failures

### Import page ergonomics
- confirm top Import button behaves exactly like the lower one
- confirm header Import onboarding tooltip behaves cleanly on small screens
- confirm import flow feels less buried on mobile

### Merica cadence
- confirm stronger burst on taps 6, 12, 18
- confirm reduced-motion cadence still feels controlled

### Waveform visibility
- confirm waveform is visible before playback in both compact and fullscreen loop contexts

### Safari splash fallback
- confirm factory reset shows visible splash immediately in Safari browser mode
- test PWA mode separately if possible

## Things intentionally deferred
These were explicitly not widened during this session:
- broader backup/export redesign
- broader delete-time storage garbage collection redesign
- general player architecture redesign
- general import UX redesign
- vault restore redesign
- broader theme/art polish outside the exact issue being fixed

## Important implementation notes

### Long guarded auto-art fallback
The new fallback poster is intentionally cheap.

It is:
- theme-gradient based
- inline SVG
- stored as real artwork

It is not:
- waveform-derived
- video-frame derived
- audio-analysis based

This is intentional for iPhone memory safety.

### Playback hydration strategy
The current intended direction is:
- general refresh: metadata + artwork-safe hydration
- current track: playback URL on demand
- blob loads only for specific actions that truly need them

If tomorrow’s QA still finds iPhone instability, check for any codepath that still turns a long stored media blob into:
- an eager object URL
- an eager data URL
- an eager decoded media buffer

## Investigation update — 2026-04-07

### New trust-critical playback diagnosis
A separate playback regression was inspected after the lazy media-hydration containment:
- imported tracks show `Missing audio`
- tapping a tile/row selects but does not start playback
- next-track advance updates selection but does not autoplay
- manual Play still works
- waveform still renders

Current narrow diagnosis:
- This does not look like DB import loss.
- The likely seam is state classification plus autoplay gating after lazy playback hydration.
- `src/lib/db.ts` now allows metadata/artwork-only hydration, but `toTrack(...)` still marks `missingAudio` true whenever `audioUrl` and `audioBlob` are absent. In the new lazy path, that often just means “not hydrated yet,” not “missing from storage.”
- `src/App.tsx` refresh builds `allTracksRef` with `includeMediaUrls: false`, then `playTrack(...)` requires `selectedTrack.audioUrl` to already exist before it arms pending autoplay. That blocks tap-to-play and autoplay-to-next-track before current-track hydration runs.
- Manual Play still works because once a track is selected, the current-track effect hydrates playback media through `getTrackPlaybackMediaFromDb(...)`, and `togglePlayPause()` only checks for `currentTrack.audioUrl`.
- The same false `missingAudio` state likely suppresses now-playing / lock-screen metadata because those effects bail when `currentTrack.missingAudio` is true.

Safest next step:
- Keep lazy playback hydration.
- Fix the readiness model so “not hydrated yet” is not treated as missing audio.
- Then make tap/autoplay gate on persisted audio availability rather than pre-hydrated `audioUrl`.
- Re-test now-playing metadata as part of the same bug family.

### 2026-04-07 containment implementation
That follow-up containment is now implemented.

Files changed:
- `src/types.ts`
- `src/lib/db.ts`
- `src/App.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

Exact containment:
- Added `hasAudioSource` to runtime `Track` state so persisted audio backing is modeled separately from hydrated playback URL state.
- `src/lib/db.ts` `toTrack(...)` now treats `missingAudio` as true absence of any known persisted/bundled audio source during broad lazy-hydrated catalog loads.
- `src/App.tsx` `playTrack(...)` now arms tap/autoplay from persisted audio backing instead of requiring a pre-hydrated `audioUrl`.
- `src/lib/db.ts` `getTrackPlaybackMediaFromDb(...)` now reports whether a selected/current track with expected backing still failed to resolve to a playback URL, so a truly broken selected track can still surface as missing.
- `src/App.tsx` current-track merged state now accepts that hydrated `missingAudio` truth for the selected track.

Why this is narrow:
- It keeps lazy playback hydration intact.
- It does not reintroduce eager audio URL or blob hydration for the library.
- It only corrects the readiness semantics and the autoplay gate that depended on the old semantics.

Typecheck:
- `npm run typecheck` passed

Device QA still needed:
- imported track no longer shows false `Missing audio`
- tap-to-play works from cold selection
- next-track autoplay resumes
- manual Play still works
- lock-screen / now-playing metadata and artwork return for imported tracks

Still deferred:
- broader player redesign
- broader audio-state / AirPods audit
- unrelated visual polish and import/crop follow-up

## Presentation cleanup update — 2026-04-07

### Remove visible `Imported` label
A narrow presentation-only cleanup was implemented.

Files changed:
- `src/components/TrackRow.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- The visible `Imported` text was coming from the list-row renderer only.
- `TrackRow` no longer renders the default `Imported` fallback.
- Non-default custom `sub` labels are still allowed to render if present.

What did not change:
- import logic
- stored `sub` metadata
- grid tiles
- mini player / fullscreen metadata
- admin import/storage behavior

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify list rows no longer show `Imported`
- verify row spacing still looks clean in artist/no-artist cases

## Long-track auto-art cleanup — 2026-04-07

### Remove theme badge/text from fallback poster
A narrow cleanup was implemented for the long-track fallback auto art.

Files changed:
- `src/lib/db.ts`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- The long-track fallback poster generated by `buildThemeNotePoster(...)` no longer bakes in the theme badge rectangle or theme-name/`PolyPlay` text.
- The gradient background, glow, and music-note composition were left intact.
- The fallback is still stored as real artwork in the same long-track import path.

What did not change:
- fallback trigger conditions
- waveform auto-art generation
- UI `AUTO` badges on rows/tiles
- broader theme/art systems

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify long guarded imports show the cleaner poster in playbar/fullscreen/now playing
- verify the poster still looks balanced after badge removal

## Mute toast update — 2026-04-07

### Add immediate mute awareness feedback
A narrow mute-feedback pass was implemented.

Files changed:
- `src/App.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- Entering `mute` in `cycleDimMode()` now shows a transient `Audio Muted` toast via the existing `fxToast` mechanism.

Why it stayed transient:
- The app already has a lightweight quick-confirmation toast path for short toggle feedback.
- The persistent/shimmer path is currently scoped to longer-running vault/process states.
- Adding a persistent mute-state toast would have widened the toast architecture for limited release value.

What did not change:
- playback logic
- unmute behavior
- vault/process shimmer toast behavior
- broader audio UX

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify mute shows `Audio Muted` immediately
- verify unmute leaves no stale toast
- verify other quick toasts still behave normally

## Dim toast follow-up — 2026-04-07

### Add matching dim awareness feedback
A tiny follow-up was implemented for desktop dim mode.

Files changed:
- `src/App.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- Entering `dim` in `cycleDimMode()` now shows a transient `Audio Dimmed` toast via the same `fxToast` path used for `Audio Muted`.
- Returning to `normal` remains silent.
- The existing mute toast remains unchanged.

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify `normal -> dim` shows `Audio Dimmed`
- verify `dim -> mute` still shows `Audio Muted`
- verify `normal` remains silent

## Rasta iOS blur tweak — 2026-04-07

### Blur the Rasta leaf on iOS only
A narrow iOS-only visual polish pass was implemented.

Files changed:
- `src/App.tsx`
- `styles.css`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `App.tsx` now toggles a body-level `is-ios` class.
- `styles.css` adds an override for `body.is-ios.theme-custom.theme-custom-rasta::after`.
- The Rasta leaf pseudo-element now gets a stronger `blur(18px)` on iOS so it reads more abstractly.

What did not change:
- non-iOS Rasta visuals
- Rasta smoke layer
- other themes
- broader theme architecture

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify the leaf is less recognizable on iOS
- verify the rest of the Rasta mood remains intact
- verify non-iOS Rasta is unchanged

## Rasta smoke spawn polish — 2026-04-07

### Offset/rotate the second smoke plume
A narrow FX-engine polish pass was implemented for Rasta tap smoke.

Files changed:
- `src/fx/ambientFxEngine.ts`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `spawnRastaSmoke(...)` still emits the same three-plume cluster.
- The second plume now gets:
  - an extra random 10–20px offset from the tap point
  - an independent random rotation

## Merica sequencing update — 2026-04-07

### Stagger accent fireworks instead of firing them all at once
A narrow FX-engine correction was implemented for the Merica accent burst cadence.

Files changed:
- `src/fx/ambientFxEngine.ts`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- The every-6th-tap Merica accent still starts with one immediate burst at the tap point.
- The second and third bursts now fire in sequence after short delays instead of detonating in the same frame.
- Those follow-up bursts now spawn at independent random positions within the canvas rather than fixed offsets from the tap point.
- Pending delayed Merica bursts are now cleared on engine stop, destroy, and theme change.

What did not change:
- ordinary non-accent Merica taps
- broader FX architecture
- other themes

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify the first burst is immediate at the tap point
- verify the second and third bursts fire in a visible sequence
- verify the follow-up bursts appear in random positions
- verify no delayed Merica bursts fire after leaving the theme

## Long audio crop diagnosis — 2026-04-07

### Crash/refresh when cropping a loop from hour-plus audio
A diagnosis-only pass inspected the long-form crop and default loop initialization behavior.

Files inspected:
- `src/App.tsx`
- `src/lib/audio/cropAudio.ts`
- `src/components/WaveformLoop.tsx`
- `src/lib/artwork/waveformArtwork.ts`

Current diagnosis:
- The crop/export path is the likely crash seam, not normal region-loop playback.
- `src/App.tsx` `cropCurrentLoopToWav()` loads the source audio blob from storage and hands it to `src/lib/audio/cropAudio.ts`.
- `cropAudioBlobToWav(...)` then:
  - reads the entire blob into memory
  - decodes the entire source with `decodeAudioData(...)`
  - allocates a second `AudioBuffer` for the cropped segment
  - encodes a new WAV blob in memory
- On a 60+ minute asset, that means several large in-memory copies exist in sequence or overlap:
  - original compressed blob bytes
  - decoded PCM
  - cropped PCM
  - encoded WAV output
- On iPhone/WKWebView this is the strongest likely cause of app refresh/crash via memory pressure.

Why waveform is probably not the primary seam here:
- `WaveformLoop` can decode a full blob to build peaks, but only when `track.audioBlob` is present.
- After the recent lazy-hydration containment, current-track playback state no longer eagerly hydrates `audioBlob`, so the normal long-track crop flow is less likely to be crashing from waveform generation first.

Default marker-spacing diagnosis:
- `src/App.tsx` `setLoopFromCurrent()` computes the default loop span from `duration * 0.18`, but then caps it at `DEFAULT_SET_LOOP_SPAN_MAX_SECONDS = 12`.
- For long-form audio that cap dominates, so the initial loop markers open only about 12 seconds apart.
- That is why the markers feel too close together on hour-plus tracks.

Safest next step:
- Keep the next pass narrow and split by seam:
  - add a containment/guardrail for long-source crop so the app does not attempt full in-memory decode/export for hour-plus audio on constrained devices
  - widen default loop-marker initialization for long durations without changing manual loop editing behavior
- Do not widen into waveform redesign, import changes, or a broader media-processing rewrite in the same pass.

### 2026-04-07 containment implementation
That follow-up containment is now implemented.

Files changed:
- `src/App.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

Exact containment:
- Added a `getDefaultLoopSpanForDuration(...)` helper in `src/App.tsx`.
- Tracks under 20 minutes keep the old 6–12 second default loop span behavior.
- Tracks at or above 20 minutes now open with a larger default loop region using a 45–120 second range.
- Added an iOS-only crop guardrail for tracks at or above 20 minutes.
- When the guardrail triggers, the app now shows:
  - `This track is too long to crop safely on this device. Try desktop.`
- The guardrail blocks before the crop prompt opens and is also rechecked inside the crop path as a safety backstop.

Why this is narrow:
- no crop/export architecture redesign
- no attempt to solve long-audio in-browser processing generally
- no changes to short-track crop flows
- no waveform or import-path redesign

Typecheck:
- `npm run typecheck` passed

Device QA still needed:
- confirm long-track crop no longer refreshes/crashes iPhone
- confirm the guardrail message is clear and the prompt stays closed
- confirm short-track crop still works for replace and duplicate flows
- confirm long tracks now open with a wider initial loop region

## Tile/Rasta cleanup — 2026-04-07

### Remove visible tile backplate seam and restore blurred Rasta leaf on iOS
A narrow CSS-only visual cleanup was implemented.

Files changed:
- `styles.css`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `.ytm-tile-hit` no longer paints its own solid dark background.
- `.ytm-cover` remains the visual tile backing, so the tile no longer reads as having a separate black rounded plate behind it.
- The iOS-only Rasta override was rebalanced from a very strong blur to a softer blur plus slightly higher opacity so the leaf stays visible while still reading abstractly.

What did not change:
- tile layout
- tile badges
- non-iOS Rasta visuals
- broader theme architecture

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify the dark rounded backing seam is no longer visible behind tiles
- verify tile depth still looks intentional
- verify the Rasta leaf is visible again on iOS while still blurred

## Waveform visibility correction — 2026-04-07

### Keep inactive waveform visible and resolve real short-track peaks
A narrow waveform pass was implemented.

Files changed:
- `src/components/WaveformLoop.tsx`
- `src/lib/waveformTheme.ts`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `WaveformLoop` no longer treats missing eager `audioBlob` hydration as a fully resolved waveform state.
- When a selected track has no cached/stored peaks, short tracks can now fetch their audio blob on demand from DB and generate real peaks locally.
- That on-demand path is capped to short tracks only, so the long-track lazy-hydration containment remains in place.
- Inactive waveform bars now draw with a subtle contrast underlay so they stay visible against the viewport background instead of visually collapsing into it.

What did not change:
- long-track containment strategy
- broader import/player architecture
- loop editing behavior

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify unplayed waveform remains visible across themes
- verify short imported tracks resolve to real peaks instead of the synthetic fallback shape
- verify long tracks still avoid eager heavy waveform decoding

## Waveform transition polish — 2026-04-07

### Pulse the waveform briefly on track switch
A narrow perception-layer polish pass was implemented.

Files changed:
- `src/components/WaveformLoop.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `WaveformLoop` now reuses its existing `is-aura-pulse` animation on track-id changes.
- The initial mount is skipped, so the pulse only reads as a transition between tracks.
- This was intentionally kept as a masking/polish layer only; it does not replace the real waveform-resolution fixes.

What did not change:
- playback logic
- loop state
- peak generation logic in this pass

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify track-switch waveform dead time feels masked rather than flat
- verify the pulse is not noisy during rapid track changes
- verify fullscreen loop editing remains calm

### Follow-up correction
The first version of the track-switch pulse was too narrowly gated.

What changed in the follow-up:
- `WaveformLoop` track-switch pulse no longer depends on `enableAuraPulse`.
- Aura-trigger event pulses are still gated the old way.
- Track-switch pulse now uses a mount guard plus previous-track tracking so a transient `null` handoff does not suppress the next real switch pulse.

Typecheck:
- `npm run typecheck` passed

### Follow-up dead-time correction
The pulse alone was not enough because the unresolved waveform path still let the viewport go flat.

What changed in the second follow-up:
- `WaveformLoop` now keeps the previous waveform visible briefly during track handoff instead of immediately dropping to a transparent/loading state.
- A dedicated `is-track-switching` class in `src/components/player.css` adds a short mask/overlay treatment during the switch.
- This was kept narrow and does not change the real peak-resolution strategy.

Typecheck:
- `npm run typecheck` passed
- The rest of the cluster remains on the original shared rotation logic.

Why this stayed narrow:
- the change is fully inside the FX engine
- no CSS/theme architecture changes
- no broader Rasta effect redesign

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify the second plume no longer reads as a duplicate stacked directly on the first
- verify the Rasta smoke still feels coherent across taps and fullscreen transitions

## Suggested opening prompt for tomorrow
Use these docs first:
- `/Users/paulfisher/Polyplay/docs/polyplay_codex_handoff_2026-04-06.md`
- `/Users/paulfisher/Polyplay/docs/polyplay_codex_handoff_2026-04-03.md`
- `docs/polyplay_release_tasks_2026-04-05.md`

We are still in stabilization / recovery mode.

Start with QA + diagnosis for:
- long video import refresh containment on iPhone

Focus:
- verify whether the current containment stopped the refresh/reopen loop
- verify fallback note poster shows in playbar/fullscreen/now playing
- if failure remains, diagnose the narrowest remaining heavy hydration seam

Do not auto-commit.
