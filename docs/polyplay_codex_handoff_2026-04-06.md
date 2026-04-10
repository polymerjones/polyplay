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

## Investigation update — 2026-04-09

### Shuffle diagnosis
A new release-blocking playback bug was diagnosed:
- enabling Shuffle on iOS has no meaningful effect on next-track behavior
- the issue reproduces after vault import, factory reset, and on fresh playlists

Current narrow diagnosis:
- `src/App.tsx` stores shuffle as a boolean (`polyplay_shuffleEnabled`) and both manual `Next` and autoplay-to-next do branch on that flag.

### Repeat-button FX parity
A narrow presentation-only polish pass landed:
- `src/components/PlayerControls.tsx`
- repeat-toggle now reuses the existing sparkle/flash confirmation path on every repeat state change
- reduced-motion behavior remains intact
- the existing special `repeat-3` activation styling remains intact

Why this mattered:
- shuffle already gave clear visual confirmation
- repeat only did so on one landing state, which made the control feel inconsistent

### Import-page storage indicator
A narrow trust/readability polish pass landed:
- `src/admin/AdminApp.tsx`
- the import form now shows a compact storage indicator near the top
- it reuses the existing `storageUsage` summary already maintained by admin refresh logic

Displayed values:
- used / limit
- remaining
- subtle progress bar

Why this mattered:
- import trust is better when the user can see current file-space pressure before importing
- this stayed UI-only and did not change import or storage behavior
- However, both paths use `pickAuraWeightedTrack(...)` from `src/lib/aura.ts` rather than a persisted shuffled queue.
- `pickAuraWeightedTrack(...)` currently filters tracks with `Boolean(track.audioUrl) && !track.missingAudio`.
- After the earlier lazy hydration containment, the app intentionally does not keep hydrated `audioUrl` on normal visible playlist tracks:
  - broad refresh omits media URLs entirely
  - visible-track hydration explicitly uses `includeAudioUrl: false`
- So valid imported tracks usually have persisted backing (`hasAudioSource`) but no hydrated `audioUrl` until they become the current track.

Why shuffle fails:
- the shuffle picker is using the wrong readiness signal
- it often sees no playable candidates in ordinary playlist state
- autoplay then falls back to linear adjacent-track selection
- manual `Next` depends on the same broken picker path

Safest next step:
- do not redesign queueing
- keep the existing shuffle picker approach
- update its candidate/readiness logic to use persisted audio availability semantics rather than pre-hydrated `audioUrl`
- verify manual `Next` and autoplay remain on the same corrected path
- leave `Previous` and non-shuffle linear order unchanged

No code changed in this diagnosis pass.

### Shuffle containment implementation — 2026-04-09
That shuffle follow-up is now implemented.

Files changed:
- `src/lib/aura.ts`
- `docs/polyplay_control_center.md`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `pickAuraWeightedTrack(...)` no longer filters candidates by pre-hydrated `audioUrl`.
- It now treats a track as shuffle-eligible when it has persisted backing (`hasAudioSource`) and is not truly missing audio.
- The aura-weighted shuffle model itself was preserved.

What did not change:
- `Previous` behavior
- non-shuffle linear order
- queue architecture
- hydration strategy

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify `Next` changes order on iPhone when Shuffle is enabled
- verify autoplay-to-next also follows shuffle
- verify imported tracks without pre-hydrated `audioUrl` now participate
- verify non-shuffle order remains unchanged

### Playlist navigation / playback context diagnosis — 2026-04-09
Another release-critical playback seam was diagnosed:
- hardware/media `nextTrack` stops working when the user is viewing a different playlist than the one containing the currently playing track
- returning to the owning playlist makes next-track work again
- blank new playlists can also hide player controls even while another track is still active

Current narrow diagnosis:
- `src/lib/playlistState.ts` derives visible `tracks` strictly from `library.activePlaylistId`
- `src/App.tsx` `playNext()` and `playPrev()` both operate on that visible `tracks` array
- Media Session and iOS remote-command handlers both call those same functions, so hardware and in-app next/prev share the same bug
- `currentTrack` is more global and can resolve from `allTracksCatalog` when the playing track is not in the currently viewed playlist
- That leaves the app with mismatched contexts:
  - playback context: `currentTrackId/currentTrack`
  - navigation context: `activePlaylistId -> tracks`

Why the bug appears:
- if the user views another playlist, next/prev navigation still uses the wrong playlist-local `tracks` array
- if the viewed playlist is empty, `hasTracks` becomes false and the mini player is hidden even though `currentTrack` still exists

Safest next step:
- keep the playlist model
- derive next/prev from the playback-owning playlist context, not the currently viewed playlist
- let control visibility follow active playback context when a current track exists
- keep hardware/media next/prev and in-app next/prev on the same corrected path

No code changed in this diagnosis pass.

### Playlist navigation / playback context containment — 2026-04-09
That playback-context follow-up is now implemented.

Files changed:
- `src/App.tsx`
- `docs/polyplay_control_center.md`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `src/App.tsx` now keeps a narrow `playbackPlaylistId` context for the playlist owning the active playback sequence.
- That context is set when playback starts from the current view and is re-derived if the current track is restored while the user is viewing a different playlist.
- `playNext()`, `playPrev()`, and autoplay-on-ended now navigate from `playbackNavigationTracks` derived from that playback-owned playlist instead of the currently viewed `tracks`.
- The mini player now remains visible when `currentTrack` exists, even if the currently viewed playlist is empty.

What did not change:
- the visible playlist browsing model
- hardware/media command wiring
- queue architecture
- non-playing empty playlist rendering

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify hardware/media `nextTrack` works while viewing a different playlist
- verify in-app `Next` and `Previous` follow the playback-owned playlist context
- verify blank viewed playlists no longer hide controls during active playback
- verify autoplay-to-next still works when viewed and playback-owning playlists differ

### Active-track artwork/video diagnosis — 2026-04-09
Another playback-context follow-up was diagnosed:
- after the control/navigation fix, the user can keep playing and skipping tracks while browsing another playlist
- but artwork and fullscreen media can stay blank or stale in that off-playlist state

Current narrow diagnosis:
- `src/App.tsx` resolves `currentTrack` from `allTracksCatalog` when the active track is not in the visible playlist
- `allTracksCatalog` is intentionally loaded with `includeMediaUrls: false`, so those fallback tracks usually lack `artUrl` and `artVideoUrl`
- the current-track hydration path only fetches `audioUrl`, `artBlob`, and `missingAudio` from `getTrackPlaybackMediaFromDb(...)`
- `currentTrack` then merges only those fields, not `artUrl` or `artVideoUrl`
- visual surfaces such as `MiniPlayerBar`, `FullscreenPlayer`, and the blurred backdrop depend on `track.artUrl` / `track.artVideoUrl`

Why the bug appears:
- playback metadata/audio follows the active track
- visual media does not, because the active-track hydration path is only partially hydrating current-track media for off-playlist playback

Safest next step:
- keep the same playback context model
- extend current-track media hydration to return and merge `artUrl` / `artVideoUrl`
- do not redesign playlists, auto-art, or general media architecture

No code changed in this diagnosis pass.

### Active-track artwork/video containment — 2026-04-09
That current-track media follow-up is now implemented.

Files changed:
- `src/lib/db.ts`
- `src/App.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `getTrackPlaybackMediaFromDb(...)` now returns `artUrl` and `artVideoUrl` alongside the existing active-track media fields.
- `src/App.tsx` now stores those fields in `hydratedCurrentTrackMedia`.
- `currentTrack` now merges hydrated `artUrl` / `artVideoUrl` for off-playlist active playback the same way it already merges `audioUrl`.

What did not change:
- playlist model
- fullscreen rendering model
- auto-art generation
- library-wide hydration strategy

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify mini-player art follows the active track while browsing another playlist
- verify fullscreen still-image/video follows the active track off-playlist
- verify the backdrop updates correctly during off-playlist playback
- verify now-playing / lock-screen artwork did not regress

### Safari desktop reset placeholder diagnosis — 2026-04-09
Another trust issue was diagnosed on Safari desktop after factory reset:
- splash can show a broken/question-mark placeholder
- demo tile art can appear incorrect or missing on the first post-reset render

Current narrow diagnosis:
- this does not look like reset corruption
- the splash video is already hidden until ready, so the visible broken state is likely the immediate fallback image render in `SplashOverlay`
- demo tile art is also rendered directly from bundled asset URLs in `TrackTile`
- Safari desktop can hit a cold-start bundled-asset decode/resolution lag window after reset, and the UI is exposing that failed/late image state too directly

Safest next step:
- keep reset and demo seed behavior intact
- preload the splash fallback image before rendering it
- add a narrow demo-art preload/retry containment so bundled demo art does not surface as a broken image on first render

No code changed in this diagnosis pass.

### Safari desktop reset placeholder containment — 2026-04-09
That Safari cold-start asset follow-up is now implemented.

Files changed:
- `src/components/SplashOverlay.tsx`
- `src/components/TrackTile.tsx`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `SplashOverlay` now preloads the bundled fallback logo image before rendering it, so the fallback shell no longer exposes a broken image placeholder while Safari is still resolving/decoding the asset.
- `TrackTile` now gives demo artwork a narrow preload/retry containment:
  - bundled demo art is preloaded before being shown
  - if the first load fails, it retries once with a cache-busted URL
  - otherwise it falls back cleanly to default artwork

What did not change:
- reset flow
- demo seed data/model
- global bundled asset loading strategy
- non-demo tile behavior

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify Safari desktop factory reset no longer shows a broken splash placeholder
- verify demo tile art appears correctly after reset
- verify non-reset startup is unchanged
- verify iOS/PWA behavior is unchanged

### Pre-submission checklist doc
A new final pre-submission QA/packaging checklist was added for the current stabilization build:
- `docs/polyplay_ios_app_store_submission_checklist_2026-04-07.md`

Scope:
- release-candidate sanity
- trust-critical playback
- waveform / loop / crop checks
- theme / FX spot checks
- import/settings overlay verification
- archive / App Store packaging items

No code changed in that pass.

### New narrow Rasta import-overlay diagnosis
One more iOS-only visual seam was identified:
- on normal Rasta screens, the leaf is acceptably blurred
- behind the Import overlay on iOS, the leaf reads too clearly again

Current narrow diagnosis:
- the base iOS Rasta blur is still applied in `styles.css`
- the Import/settings overlay treatment changes how that background reads, making the leaf look too recognizable behind the panel
- the cleanest containment is a body class tied only to the upload overlay state, with a stronger iOS-only blur override for that moment

### Rasta import-overlay containment — 2026-04-07
That iOS-only follow-up is now implemented.

Files changed:
- `src/App.tsx`
- `styles.css`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `src/App.tsx` now adds `is-import-overlay-open` to `body` only while the settings overlay is open in upload/import mode.
- `styles.css` now applies a stronger Rasta leaf blur with slightly lower opacity only for `body.is-ios.is-import-overlay-open.theme-custom.theme-custom-rasta::after`.

What did not change:
- desktop Rasta styling
- normal non-overlay Rasta styling
- smoke behavior or other theme layers

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify the leaf is less recognizable behind Import on iPhone
- verify the leaf still reads correctly on normal Rasta screens
- verify desktop Rasta is unchanged

### Rasta import iframe diagnosis refinement — 2026-04-07
After a real iPhone rebuild, the earlier overlay-level fix proved insufficient.

Refined diagnosis:
- the clearly recognizable leaf is inside the admin/import iframe itself
- the iframe document gets theme classes, but it needs its own iOS-specific Rasta leaf treatment
- the narrowest correction is to mark the iframe body as `is-ios` too, then target `body.admin-frame-body.is-ios.theme-custom.theme-custom-rasta::after`

### Rasta import iframe containment — 2026-04-07
That refined iframe-level correction is now implemented.

Files changed:
- `src/admin/AdminApp.tsx`
- `styles.css`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `src/admin/AdminApp.tsx` now adds `is-ios` to the iframe body on iPhone/iPad.
- `styles.css` now applies a stronger blur and lower opacity to the Rasta leaf specifically for `body.admin-frame-body.is-ios.theme-custom.theme-custom-rasta::after`.

What did not change:
- desktop import appearance
- main app non-iframe Rasta appearance
- smoke behavior or other theme layers

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify the leaf is no longer too recognizable inside Import on iPhone
- verify the iframe still reads as Rasta and not washed out
- verify desktop Import remains unchanged

### New narrow theme FX color diagnosis
Another visual-correctness seam was isolated:
- light mode FX still read purple instead of pink
- amber theme FX still read purple/orange instead of warm amber/gold
- crimson theme FX still read purple instead of crimson

Current narrow diagnosis:
- `src/fx/ambientFxEngine.ts` is not inventing those colors; it reads `--fx-color-1-rgb`, `--fx-color-2-rgb`, `--fx-color-3-rgb`, `--aura-rgb`, and `--color-accent` from CSS.
- `styles.css` already gives explicit FX palette variables to `merica`, `mx`, and `rasta`.
- `light`, `custom/amber`, and `custom/crimson` only define accent/aura tokens, so the engine falls back to the root default purple FX palette for those modes.

Safest next step:
- keep the fix in CSS token definitions only
- add explicit `--fx-color-*` variables for `light`, `amber`, and `crimson`
- do not widen into FX engine behavior or particle-system changes

### Theme FX color correction — 2026-04-07
That palette correction is now implemented.

Files changed:
- `styles.css`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- `light` now defines explicit pink/rose `--fx-color-*` variables.
- `custom/amber` now defines explicit warm amber/gold `--fx-color-*` variables.
- `custom/crimson` now defines explicit crimson/red `--fx-color-*` variables.

Why this was narrow:
- `src/fx/ambientFxEngine.ts` was already using CSS tokens correctly.
- The bug was just that these three themes were inheriting the root default purple FX palette because they never overrode `--fx-color-*`.
- No FX engine behavior, particle density, timing, or theme layout was changed.

Typecheck:
- `npm run typecheck` passed

Device QA still needed:
- confirm light mode FX now reads pink rather than purple
- confirm amber FX now reads warm candle/amber/gold rather than purple-orange
- confirm crimson FX now reads crimson/red rather than purple
- confirm merica, mx, and rasta remain unchanged

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

## Import overlay loading containment — 2026-04-07

### Mask the settings/import iframe while it mounts
A narrow app-side loading containment was implemented for the import/settings overlay.

Files changed:
- `src/App.tsx`
- `src/index.css`
- `docs/polyplay_release_tasks_2026-04-05.md`

What changed:
- Opening the settings/upload overlay now arms a frame-loading state before the iframe paints.
- The iframe clears that state on `load`.
- While loading, the app shows a theme-matched veil over the frame area with a centered shimmer message:
  - `Loading import panel…`
  - or `Loading settings panel…`

What did not change:
- admin/import logic
- iframe source/page structure
- broader overlay architecture

Typecheck:
- `npm run typecheck` passed

QA still needed:
- verify Import no longer reveals weird background layers while opening
- verify the loading veil clears once the frame is ready
- verify Manage mode still opens cleanly

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

### Follow-up visibility correction
The next issue was that the mask was still too shell-level and could fail to visibly retrigger on rapid or wraparound switches.

What changed in the third follow-up:
- track-switch mask retrigger is now imperative on every track-id change
- the visible flash now renders inside `.pc-wave__viewport`
- viewport lift was strengthened so the effect shows on iOS and desktop Safari

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
