# PolyPlay Codex Handoff — 2026-04-01 Bug Dump

## Session intent
Use this file as the active bug tracker and handoff for the next Codex session.

## Current status
- Purpose: organize the April 1 bug dump cleanly before more changes
- Goal: reduce drift, avoid getting lost in the weeds, and separate diagnosis from fixes
- Codex budget is low, so each task should be narrow and documented before code changes

## Rules for Codex
1. Read this file first before touching code.
2. Add a short note under the relevant section before making changes.
3. For each issue, document:
   - observed behavior
   - expected behavior
   - suspected root cause
   - files to inspect
   - status
4. Do not mark anything done unless it has live QA.
5. Keep commits narrow and avoid unrelated files/folders.

## Status legend
- open
- diagnosis in progress
- fix implemented, awaiting QA
- verified
- blocked

## Top priorities
1. Stabilize loop/fullscreen behavior and remove user-trap/confusing exit behavior
2. Fix import flow regressions, especially metadata/artwork and import-page brick state
3. Clean up now-playing visuals and active-track indicators that are currently glitchy

---

## Bug dump inbox
Raw notes captured from April 1 testing and organized below.

---

## Organized issues

### 1. Loops / fullscreen / cinema / navigation guards
**Status:** diagnosis in progress

**Observed behavior:**
- Pressing the magnifying glass can scramble the layout.
- User made a loop, dragged the end marker to refine it, and the waveform zoomed way out unexpectedly even in magnifying-glass mode.
- When magnifying-glass mode is enabled, zoom should stay static; on release it should not zoom out.
- On release, loop editing should only try to center the highlighted region in the user’s viewport.
- User cannot use zoom in on the default marker starting places.
- User needs a clearer explanation for why fullscreen exit is blocked during loop editing.
- Current intended behavior has evolved: user should actually be allowed to exit fullscreen even when loop edit mode is enabled, and using X or swipe-down should effectively act like the Done action.
- “Swipe Down to Exit” text in its current fullscreen location does not make sense.
- Exiting fullscreen in different ways causes the video artwork frame to flash black for a moment, which looks like a glitch.
- After different loop workflow passes, there is still general confusion around loop editing continuity and viewport behavior.

**Expected behavior:**
- Magnify mode should preserve zoom level and only center the selected region within the current viewport.
- Releasing a loop marker should never zoom the waveform way out.
- Default marker positions should still allow zoom-in controls to work.
- If user exits fullscreen while editing a loop, that should cleanly finalize/commit the edit instead of trapping the user.
- Exit copy and exit behavior should feel obvious and consistent.
- Exiting fullscreen should not flash the video/artwork black.

**Suspected root cause:**
- Loop edit state and fullscreen exit state are still competing with each other.
- Magnify-mode viewport lock/centering logic may still be recalculating too aggressively on drag release.
- Default marker positions may be interacting badly with zoom floor or zoom-window math.
- Fullscreen exit path may unmount/repaint artwork in a way that causes the black flash.

**Files to inspect:**
- `src/components/WaveformLoop.tsx`
- `src/components/FullscreenPlayer.tsx`
- `src/components/PlayerControls.tsx`
- `src/App.tsx`

**Codex notes:**
- Audit all loop viewport behavior after marker release.
- Audit fullscreen exit so X and swipe-down can finalize loop edit instead of trapping the user.
- Revisit exit hint copy placement and wording.

**Diagnosis note — 2026-04-01 Codex:**
- `src/components/WaveformLoop.tsx` is still recalculating `viewRange` from loop bounds too aggressively. While loop editing is active, the effect derives a fresh `dragRange` from `buildWindowedViewRange(...)` whenever `dragViewSpanRef` is null, which lets the waveform jump to a newly computed zoom/window instead of preserving the current magnify viewport.
- The magnify toggle currently resets `manualZoomLevel` back to `0` whenever it is turned off, and loop-edit transitions also clear the zoom state. That makes the magnify glass feel like it scrambles layout rather than preserving the user’s current zoom choice.
- Default loop markers are created with a wide 15% margin in `src/App.tsx`, and the loop viewport logic treats those bounds the same as any other full window. That leaves little apparent effect for zoom-in controls until the user first adjusts the region.
- `src/components/FullscreenPlayer.tsx` still hard-suppresses fullscreen exit whenever `loopRegion.editing` is true (`isExitSuppressed`). That directly causes the trap behavior the bug report described.
- The fullscreen black flash is likely caused by the artwork-video cleanup effect in `src/components/FullscreenPlayer.tsx`, which removes the video `src` and calls `load()` during teardown. Exiting fullscreen unmounts the player and forces the artwork video to blank before the rest of the UI settles.

**Implementation log — 2026-04-01 Codex:**
- `src/components/WaveformLoop.tsx`: preserve the current view span while loop editing stays active, so marker release re-centers the loop inside the existing viewport instead of re-deriving a new zoom window.
- `src/components/WaveformLoop.tsx`: stop resetting manual zoom level when the magnify controls are hidden, and allow manual zoom to shrink the viewport below the full loop span so default marker positions still respond to zoom-in.
- `src/components/FullscreenPlayer.tsx`: exiting fullscreen while editing now finalizes loop editing via `onFinishLoopAdjustment()` and then closes, instead of trapping the user.
- `src/components/FullscreenPlayer.tsx`: artwork video teardown now pauses the video without clearing the `src`, avoiding the forced blank frame during fullscreen exit.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The magnify toolbar in `src/components/WaveformLoop.tsx` is currently rendered whenever `loopRegion.active && hasLoopRange && loopRegion.editing` is true. That makes the magnifying glass appear immediately on `Set Loop`, before the user has done any real refinement.
- The cleanest reveal trigger is the existing deadzone-crossing event in the handle-drag flow: the moment a pending handle press becomes an actual drag (`pendingHandle` transitions into `draggingHandle` inside `onPointerMove`), the session has clearly entered refinement mode.

**Implementation log — 2026-04-01 Codex:**
- Follow-up block start: keep magnify hidden on initial `Set Loop`, then reveal it only after the first real loop-handle drag within the current loop-edit session.
- `src/components/WaveformLoop.tsx`: magnify availability is now unlocked only when a pending loop-handle press crosses the drag deadzone and becomes a real drag. The magnifying glass stays hidden on initial `Set Loop`, then becomes available for the rest of that edit session after first refinement.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The recent magnify reveal change introduced an ordering regression in `src/components/WaveformLoop.tsx`: after first real handle drag, `hasUnlockedManualZoom` becomes true, but `showManualZoomControls` stays false. That means the user only sees the magnifying-glass toggle and the actual `+/-` zoom controls remain collapsed until a second separate tap. In practice, this makes loop zoom feel broken in the create-loop workflow even though `manualZoomLevel` itself still works.
- The confusing fullscreen exit wording is centralized in `src/components/FullscreenPlayer.tsx` via `exitHintText`, which currently switches between `Done & Exit`, `Swipe Down to Exit`, and `Exit Fullscreen Player`. That copy blends loop completion and fullscreen dismissal into one message and is rendered on both the top close button and the bottom exit button.

**Implementation log — 2026-04-01 Codex:**
- Follow-up block start: auto-open zoom controls at the moment magnify becomes available after first real handle drag, and remove the misleading fullscreen exit copy for now.
- `src/components/WaveformLoop.tsx`: when a pending loop-handle press crosses the drag deadzone and becomes a real drag, the session now unlocks magnify and opens the `+/-` zoom controls immediately. This restores working loop zoom in the create-loop refinement flow without changing the underlying zoom math.
- `src/components/FullscreenPlayer.tsx`: removed the blended `Done & Exit` / `Swipe Down to Exit` wording and replaced it with plain `Exit Fullscreen` copy so loop completion and fullscreen dismissal are no longer conflated.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- Desktop fullscreen/cinema exits can still be triggered too easily by the existing outside double-click path in `src/components/FullscreenPlayer.tsx`. The handler currently treats a second outside pointer-up as an exit regardless of vertical screen region, so accidental lower-screen mouse double-clicks can dismiss cinema/fullscreen unexpectedly.

**Implementation log — 2026-04-01 Codex:**
- `src/components/FullscreenPlayer.tsx`: narrowed the outside double-click exit path for desktop pointers. Mouse-based outside double-click exit is now ignored in the lower half of the screen, while the existing upper-half desktop behavior and touch behavior remain unchanged.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- Desktop loop zoom controls in `src/components/WaveformLoop.tsx` are currently updating `manualZoomLevel`, but the editing-state viewport effect can ignore that value and simply re-center the existing `viewRange` span. In practice that makes desktop `+/-` look dead even though the state changes.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The top-left fullscreen `X` can miss on first desktop click because `src/components/FullscreenPlayer.tsx` also has a shell-level `onPointerDown` backdrop-dismiss path, and the `X` button sits outside `.fullscreen-player-shell__content`. That means the shell can consume the pointerdown as an outside click instead of cleanly leaving the button to handle its own single-click exit.

**Implementation log — 2026-04-01 Codex:**
- `src/components/FullscreenPlayer.tsx`: excluded both fullscreen close buttons from the shell-level outside-pointer dismiss path and stopped pointerdown propagation on the buttons themselves. The `X` button should now respond on a single desktop click instead of requiring a second click.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- Default region-loop creation in `src/App.tsx` still seeds the start marker from a fixed 15% track margin. On long tracks that can place the start marker far away from the live playback position and make the initial loop feel disconnected from what the user was actively hearing when they hit loop.

**Implementation log — 2026-04-01 Codex:**
- `src/App.tsx`: default region-loop creation now anchors the start marker to the live playback position when the user taps loop, while keeping the existing end-marker behavior. This makes the initial loop start from what the user is actually hearing instead of an arbitrary 15% track offset.

---

### 2. Import / metadata / artwork / import-page stability
**Status:** diagnosis in progress

**Observed behavior:**
- User made a new playlist, tapped Import, saw a toast, then the app refreshed / bricked itself.
- Strong suspicion that recent metadata-import work may be involved.
- Metadata import did not work for a user MP3 that had embedded artwork.
- Artist-name autofill is not the intended behavior right now:
  - intended behavior was suggestion/autocomplete as user starts typing characters
  - current behavior appears to just persist the prior artist name in the field
- Checkbox layout for import page may not be the best UX.
- The “Do not import metadata” and “Keep me on Import page” checkbox area may need layout/clarity review.

**Expected behavior:**
- Importing after creating a playlist should not refresh or brick the app.
- Metadata import should work for supported MP3s, especially embedded artwork.
- Artist-name autofill should behave like suggestion/autocomplete while typing, not a sticky always-there value.
- Import page options should feel clear and intentional.

**Suspected root cause:**
- Metadata parse / import state may be colliding with playlist creation or import-page state transitions.
- Embedded artwork extraction may be failing on some MP3s or not wiring into the existing art slot correctly.
- Artist-name persistence may have been implemented as remembered field value instead of real autocomplete/suggestion behavior.
- Import page option layout may be causing ambiguity.

**Files to inspect:**
- `src/admin/AdminApp.tsx`
- `src/lib/db.ts`
- `src/lib/mediaSession.ts`
- `src/App.tsx`
- any metadata parsing helpers / import state utilities

**Codex notes:**
- Treat the import-page brick as a top import regression.
- Verify metadata with real MP3s that contain cover art.
- Revisit artist autofill behavior and checkbox layout separately from metadata parsing correctness.

**Diagnosis note — 2026-04-01 Codex:**
- Import success currently emits overlapping parent-sync flows from `src/admin/AdminApp.tsx`: `polyplay:user-imported`, `polyplay:library-updated`, and later `polyplay:upload-success`, while `src/App.tsx` handles those as separate refresh/close paths. This is the strongest code-level candidate for the reported “toast, then refresh/brick” behavior because the import path currently mixes library refresh, onboarding state changes, and overlay dismissal in multiple steps instead of one authoritative completion path.
- Metadata parsing for embedded MP3 artwork is brittle in `buildEmbeddedArtworkFile(...)`: it only accepts picture formats that already start with `image/`. Tagged files that report cover format as `jpg`, `jpeg`, `png`, or omit the prefix will be dropped even when the embedded picture data is present.
- Artist behavior is not true autocomplete today. `uploadArtist` is initialized from `ARTIST_MEMORY_KEY`, and metadata import is allowed to overwrite only when the current value is blank or equal to that stored value. That produces a sticky remembered value instead of typed suggestion behavior.
- The native iOS audio picker path (`onPickUploadAudioNative`) does not reset the same touched/autofill refs that the standard picker path resets. That can preserve stale title/artist/artwork state across imports and can suppress later metadata application.

**Implementation log — 2026-04-01 Codex:**
- Block 1 start: consolidate import completion into one authoritative success signal between `src/admin/AdminApp.tsx` and `src/App.tsx`, removing overlapping refresh/close messages from the upload path.
- Block 1 complete: upload success now uses a single `polyplay:import-complete` message for the iframe-parent path, while the upload handler no longer emits the extra `polyplay:user-imported` / `polyplay:library-updated` pair during track import.
- Block 2 start: normalize native and standard audio-pick setup so both paths reset the same title/artist/artwork autofill state before metadata import runs.
- Block 2 complete: both audio pickers now share the same upload-draft reset path, which clears stale title/artist/artwork autofill state before a new file is parsed.
- Block 3 start: relax embedded artwork format handling so MP3 cover art is accepted for common shorthand formats and missing-prefix variants when picture bytes are present.
- Block 3 complete: embedded artwork import now accepts shorthand image formats such as `jpg`, `jpeg`, and `png`, and falls back to byte-signature sniffing when the tag format string is incomplete.
- Block 4 start: replace sticky remembered-artist field population with typed suggestion/autocomplete behavior while preserving metadata autofill when available.
- Block 4 complete: the artist field now starts blank and exposes remembered/library artist names as typed suggestions instead of seeding the prior artist directly into the input.
- Follow-up block start: inspect remaining embedded-art failure and add a legal/support return path back to Admin.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- Embedded artwork can still fail even when `metadata.common.picture` exists because the import path still calls `selectCover(...)` before `buildEmbeddedArtworkFile(...)`. The bundled `music-metadata` `selectCover(...)` helper does not reliably return the parsed cover in this environment, so valid picture data can still be dropped before artwork-file creation.
- The legal/support pages currently have no close/back affordance at all. Because same-origin navigation now loads those pages directly in the admin/settings context, users can read them but have no explicit in-page action that returns them to Admin.

**Follow-up implementation log — 2026-04-01 Codex:**
- Embedded artwork import now uses an app-local picture selector that prefers front-cover tags but falls back to the first parsed picture instead of relying on `selectCover(...)`.
- Admin legal/support links now carry a `returnTo` route back to `admin.html`, and Support / Privacy / Terms each render a close button that returns to Admin via browser history or the explicit `returnTo` fallback.

**Diagnosis note — 2026-04-01 Codex:**
- Starting diagnosis-only pass for the persistent bright-pink artwork issue, scoped to: metadata picture selection, embedded-art file creation, import-time artwork normalization/storage, auto-art fallback precedence, and artwork consumers across tiles/rows/mini-player/fullscreen/iOS now playing.
- Initial working question: determine whether the pink result originates in parser output itself or in the downstream still-image normalization / storage pipeline after valid embedded bytes are already selected.

**Diagnosis findings — 2026-04-01 Codex:**
- Most likely root cause is downstream, not parser-level: embedded APIC bytes are selected in `src/admin/AdminApp.tsx` via `selectEmbeddedArtworkPicture(...)` and wrapped into a `File` by `buildEmbeddedArtworkFile(...)`, but import then pushes that file through `buildArtworkPayload(...)`, which always runs still images through `normalizeStillImage(...)`.
- `src/lib/artwork/normalizeStillImage.ts` always decodes the image into a browser canvas and re-encodes it as JPEG with `alpha: false`. That is the highest-probability corruption point for color-shifted embedded artwork, especially for JPEGs with unusual profiles/encodings that browsers can display but canvas re-rasterization can reinterpret.
- Auto art does not appear to be outranking valid imported art in the normal import path. When `addTrackToDb(...)` receives a non-null `artPoster`, it stores that poster under `artKey` and leaves `artworkSource` as `"user"`. Auto art is only generated when no poster is available.
- Surface inconsistency is also unlikely to be the primary cause. Rows, tiles, mini-player, fullscreen, and track backdrop all read the same stored `track.artUrl`, while iOS now-playing prefers the same stored `track.artBlob` and otherwise falls back to `track.artUrl`. If the stored poster is pink once, every consumer will faithfully reuse that same bad asset.
- Current parser output appears sufficient for diagnosis and likely sufficient for a fix path: the metadata library already exposes picture bytes, declared format, and picture type/name, which is enough to choose the correct cover and preserve the original bytes. No code evidence currently justifies replacing the parser library.

**Narrow fix path proposal — 2026-04-01 Codex:**
- Safest first fix is to preserve embedded still-image bytes exactly as imported when they came from metadata artwork, instead of always passing them through `normalizeStillImage(...)`.
- If normalization is still desirable for manual artwork uploads, split the path: keep user-picked external artwork normalization, but bypass it for metadata-derived embedded artwork unless validation proves the original blob is unusable.
- Add temporary diagnosis logging around embedded-art imports: selected picture `type`/`format`, resolved MIME, byte length, whether normalization ran, normalized blob MIME/size, and final stored `artworkSource`.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- Embedded artwork is still being surfaced inside the same broad file-select metadata effect as title/artist autofill. Even though current code applies art before submit-time, the structure still treats MP3 metadata as one combined success block after `parseBlob(...)` rather than a clearly independent first-class artwork path.

**Implementation log — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx`: split file-select metadata handling into independent branches after `parseBlob(...)`. Embedded artwork is now extracted and applied first on its own path, using the same armed/loaded artwork-dropzone state, and title/artist autofill is attempted separately afterward.
- Desktop and iOS audio picker paths still share the same draft-reset and metadata effect path, so they continue to behave the same here; the reliability change is in the shared post-select metadata application logic rather than in only one picker path.

**Audit note — 2026-04-01 Codex:**
- Starting a full metadata import pipeline audit. Scope: desktop picker path, iOS/native picker path, draft reset/touched guards, `parseBlob(...)` trigger timing, parser result handling, title/artist/artwork application rules, dropzone/preview state, and any reset conflicts that could wipe metadata back out after parse.

**Audit note — 2026-04-01 Codex:**
- Expanding the audit to cover artwork source precedence and fallback rendering, not just metadata field application. Scope now also includes: embedded/user/manual artwork vs auto/generated fallback precedence, the exact pink fallback-art code path, and cross-surface artwork consistency between import preview, grid/list, mini player, fullscreen, and now playing surfaces.

**Audit findings — 2026-04-01 Codex:**
- Desktop and iOS picker paths already converge correctly before metadata parsing. Both `onPickUploadAudio(...)` and `onPickUploadAudioNative(...)` call the same `resetUploadDraftForNewAudio(file)` helper and then set `uploadAudio`, which means both paths enter the same shared `useEffect(..., [ignoreUploadMetadata, uploadAudio])` metadata parse flow in `src/admin/AdminApp.tsx`.
- The most likely failure point is not the picker entry path. It is the shared metadata effect in `src/admin/AdminApp.tsx`, specifically how parse failures and partial-success results are handled. `parseBlob(uploadAudio)` is wrapped in a broad `try/catch`, and the catch only sets `uploadMetadataState("ready")` / `uploadMetadataHasTitle(false)` with no user-facing signal and almost no diagnostics. If parsing fails or partially fails, the UI simply looks like nothing was found.
- Embedded artwork is now logically independent inside that effect, but the overall feature still lacks a real “partial metadata success” model. The state machine only tracks `idle/loading/ready/skipped` plus `uploadMetadataHasTitle`, which means artwork-only success, artist-only success, and total failure all collapse into nearly the same visible state.
- The current “do not overwrite manual edits” guards are defensible but still brittle. Title/artist application only happens when the relevant field is blank or previously autofilled. If non-empty state survives from any future refactor, hidden autofill reset miss, or browser-native field restoration, valid metadata will be silently blocked. The reset path looks correct now, but the application rules are still fragile rather than explicit.
- There is no evidence in code that artwork extraction is too late. It already happens on file select, before submit, through the shared metadata effect. The real issue is that success/failure is opaque and lumped together, not that artwork waits until upload submit.
- There is no current code evidence that the parser library should be replaced. The stronger evidence still points to application-rule/state-model weakness and swallowed failures, not a proven parser defect.

**Narrow refactor plan — 2026-04-01 Codex:**
- Keep the existing picker entry points, but refactor the shared metadata effect in `src/admin/AdminApp.tsx` into explicit phases/functions:
  1. prepare/reset draft for new audio
  2. parse metadata once
  3. apply embedded artwork result independently
  4. apply title result independently
  5. apply artist result independently
  6. publish a richer result object/state for UI feedback and diagnostics
- Replace the current coarse `uploadMetadataState` / `uploadMetadataHasTitle` model with a small structured result state such as `{ parsed: boolean, artworkApplied: boolean, titleApplied: boolean, artistApplied: boolean, error?: string }`. That makes artwork-only success a first-class outcome instead of “ready but blank.”
- Keep the current manual-edit protection, but move it into explicit helper functions like `applyMetadataTitleIfAllowed`, `applyMetadataArtistIfAllowed`, and `applyMetadataArtworkIfAllowed` so the overwrite rules are auditable and testable.
- Add durable diagnostics around `parseBlob(...)` itself, not just artwork selection, so parser failure vs application blocking is obvious during QA.

**Files to change for the refactor — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx`
- Possibly `docs/polyplay_codex_handoff_2026-04-01.md` for follow-up tracking only

**Testing focus after refactor — 2026-04-01 Codex:**
- Desktop picker and iOS native picker must both hit the same parse/apply behavior.
- MP3 with artwork only should arm the artwork dropzone immediately.
- MP3 with title/artist only should fill text fields without stale previous values.
- MP3 with artwork + text should populate all available fields.
- Broken metadata should not brick the flow, should not leave stale prior values, and should surface diagnostics that distinguish parse failure from “no metadata found.”

**Expanded audit findings — 2026-04-01 Codex:**
- Artwork source precedence in storage is clear and not currently the problem by design:
  1. manual/imported still or video artwork passed into `addTrackToDb(...)`
  2. generated poster from imported artwork video
  3. generated waveform artwork fallback when no poster exists
  `src/lib/db.ts` already persists the first non-null poster and only marks `artworkSource = "auto"` when fallback generation wins.
- The pink artwork in the failing grid/tile mode is coming from the real auto-art fallback path, not from `DEFAULT_ARTWORK_URL`. Exact path:
  `src/admin/AdminApp.tsx` import flow fails to carry valid artwork into `addTrackToDb(...)`
  -> `src/lib/db.ts` sees no `artPoster` / no surviving artwork
  -> `generateWaveformArtwork({ audioBlob })` runs
  -> generated PNG is stored under `artKey` with `artworkSource = "auto"`
  -> `toTrack(...)` exposes that stored blob as `track.artUrl`
  -> `src/components/TrackTile.tsx` renders `track.artUrl`
  This means the pink grid art is most likely “metadata art never made it into storage, so auto art legitimately took over,” not a surface reading the wrong source.
- The auto-art image itself is generated in `src/lib/artwork/waveformArtwork.ts`, whose default/dark palette explicitly uses pink/purple/cyan waveform colors. That is the source of the bright pink visual language when fallback wins.
- Surface consistency is largely coherent once a source is stored:
  - import dropzone uses `uploadArt` armed state in `src/admin/AdminApp.tsx`
  - grid/tile uses `track.artUrl` in `src/components/TrackTile.tsx`
  - row/list uses `track.artUrl` in `src/components/TrackRow.tsx`
  - mini player uses `track.artUrl` in `src/components/MiniPlayerBar.tsx`
  - fullscreen uses `track.artUrl` / `track.artVideoUrl` in `src/components/FullscreenPlayer.tsx`
  - iOS now playing prefers `track.artBlob` then `track.artUrl` in `src/App.tsx` + `src/lib/iosNowPlaying.ts`
  In other words, once storage has the wrong winner, most surfaces consistently propagate that same winner.
- The most likely structural failure remains in shared metadata application/state handling rather than the parser library itself. The current effect still swallows parse failure, models success too coarsely, and makes it hard to distinguish:
  - parser failed
  - artwork-only success
  - text-only success
  - nothing found
  - valid metadata blocked by overwrite guards

**Expanded refactor plan — 2026-04-01 Codex:**
- Refactor the shared metadata pipeline in `src/admin/AdminApp.tsx` into explicit result phases with a structured metadata outcome object that separately records:
  - `parseSucceeded`
  - `embeddedArtworkFound`
  - `artworkApplied`
  - `titleFound`
  - `titleApplied`
  - `artistFound`
  - `artistApplied`
  - `error`
- Keep artwork extraction first-class and independent, but also make the final import submission path assert source precedence explicitly: if metadata artwork is armed in the dropzone, that source must outrank auto art and be visible in diagnostics before `addTrackToDb(...)` runs.
- Add a narrow QA/debug signal near the import UI so testers can tell whether the current file produced:
  - metadata parse failure
  - artwork-only success
  - text-only success
  - full success
  - fallback auto art at submit-time
- Do not replace the parser library unless structured diagnostics show `parseBlob(...)` consistently returning empty `common.picture/title/artist` for known-good files.

**Files implicated by the refactor — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx`
- `src/lib/db.ts`
- Possibly `src/lib/artwork/waveformArtwork.ts` later, but only if product wants the auto-art look changed after metadata reliability is fixed

**Refactor implementation log — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx`: replaced the old coarse metadata flags with a structured metadata result object containing:
  - `phase`
  - `parseSucceeded`
  - `embeddedArtworkFound`
  - `artworkApplied`
  - `titleFound`
  - `titleApplied`
  - `artistFound`
  - `artistApplied`
  - `error`
- `src/admin/AdminApp.tsx`: split the shared file-select metadata effect into explicit phases: reset, parse once, apply artwork independently, apply title independently, apply artist independently, then publish one structured result.
- `src/admin/AdminApp.tsx`: moved title/artist/artwork application rules into explicit helper functions so manual-edit protection still exists, but application success/failure is now recorded instead of disappearing into one broad effect.
- `src/admin/AdminApp.tsx`: enforced submit-time artwork precedence by failing closed if artwork is armed in the import draft but no `artPoster`/`artVideo` survives payload preparation. That prevents silent fallback to auto art when user/metadata artwork was supposed to win.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- Metadata artwork application is still vulnerable to a stale draft-art ref race. `applyMetadataArtworkIfAllowed(...)` gates on `uploadArtRef.current`, but that ref was only synchronized in a later `useEffect`. If `parseBlob(...)` resolves before the ref catches up to the reset state, valid embedded artwork can be incorrectly blocked and auto art will still win at submit-time.

**Implementation log — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx`: removed the delayed `uploadArtRef` sync effect and made `setUploadArtworkFile(...)` update `uploadArtRef.current` synchronously. Metadata artwork application now sees the real current draft-art state immediately after reset/select instead of a stale previous file.

**Implementation note — 2026-04-01 Codex:**
- Narrow fix starting now: carry a metadata-art source flag through the import draft, bypass `normalizeStillImage(...)` only for metadata-derived embedded still artwork, keep manual still uploads on the existing normalization path, and add temporary diagnostics at metadata selection plus final import/storage.

**Implementation log — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx`: introduced a narrow upload-art source split for the import form. Metadata-derived embedded still artwork is now tagged as `"metadata"` when autofilled from MP3 metadata, while manually chosen artwork remains `"manual"`.
- `src/admin/AdminApp.tsx`: `buildArtworkPayload(...)` now bypasses `normalizeStillImage(...)` for metadata-derived still artwork and preserves the original embedded `File` bytes/MIME as-is. Manual still uploads still use the existing normalization path.
- `src/admin/AdminApp.tsx` + `src/lib/db.ts`: added temporary `console.debug` diagnostics for metadata-art selection, payload build, and final DB store so imports log selected picture type/name, declared format, resolved MIME, original byte size, whether normalization ran, and final stored artwork MIME/size/source.

---

### 3. Playback / media controls / now playing
**Status:** diagnosis in progress

**Observed behavior:**
- Active-track border/strobe effect does not work correctly.
- Rows show a weird rotating line on a strange axis instead of a clean perimeter effect.
- Intended now-playing strobe/border behavior is not being met.
- Imported metadata artwork / auto art behavior is inconsistent with now playing / island surfaces.
- Side note from testing: same auto art did not appear on the now-playing island bar for user.

**Expected behavior:**
- Active-track border trail should work cleanly and predictably.
- Rows should highlight around the full row perimeter, not with a weird off-axis line.
- Now playing / island visuals should stay consistent with imported artwork / auto art state.

**Suspected root cause:**
- Border-trail implementation is attached to the wrong element or transform context.
- Surface-specific artwork/state rendering may not be synchronized.

**Files to inspect:**
- components rendering track rows and tiles
- now playing / mini player / island-bar components
- any border-trail effect implementation

**Codex notes:**
- Keep this visual-only at first.
- First fix correctness before adding any additional flourish.

**Diagnosis note — 2026-04-01 Codex:**
- `src/components/BorderTrail.tsx` currently renders a standalone absolutely positioned span that uses a rotating `conic-gradient` `border-image`. That rotates the gradient as a whole rather than tracing the actual rectangle path, which explains the “weird rotating line on a strange axis” report, especially on rows.
- The row trail is attached to the outer `.trackRow`, which is correct for scope, but the tile trail is currently attached to the outer `.ytm-tile` article instead of the artwork container itself. That misses the requested perimeter target for tile mode.
- The state logic in `BorderTrail` is already close to the requested behavior: paused or mute resolves to white + paused animation, while dim keeps aura color at reduced opacity. The main failure is the rendering primitive and where it is mounted.

**Implementation log — 2026-04-01 Codex:**
- Replaced the old rotating `border-image` trail with an SVG rectangle stroke in `src/components/BorderTrail.tsx`, animated through `stroke-dashoffset` so the trail follows the real perimeter instead of rotating on a detached axis.
- Tile mode now mounts the trail on `.ytm-cover` in `src/components/TrackTile.tsx`, so the active border runs around the artwork container rather than the whole card.
- Row mode still mounts on `.trackRow`, but now uses the same perimeter-following SVG stroke so the trail wraps the full row container correctly.
- Paused or mute still overrides to a white paused stroke, while dim mode keeps the aura-colored animation at reduced opacity.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The border trail still shares space with older active/aura visual layers: `.ytm-tile.is-active::after`, `.ytm-tile.has-aura .ytm-tile-hit`, `.rowAuraGlow::after`, and `.rowAuraAccent` are all still drawing additional geometry. That creates duplicate outlines and “phantom shape” artifacts when Aura+ is active.
- The row trail path is also being distorted because the SVG currently uses a square `viewBox` with `preserveAspectRatio="none"` for a very wide row container. That stretches the rounded-rect geometry and makes the corners feel loose/curved instead of edge-bound.

**Cleanup diagnosis note — 2026-04-01 Codex:**
- The remaining perimeter mismatch is now isolated to `src/components/BorderTrail.tsx` itself: both row and tile still rely on hard-coded rect geometry (`1000x100` for rows, `100x100` for tiles) instead of the rendered DOM box, so the stroke can only approximate the real outer edge.
- The lingering laggy/buggy feel is also concentrated there: the animated stroke is currently running through a filtered SVG that is being rescaled every frame for non-square rows. On iOS that produces visible softness/stutter even after the extra aura layers were removed.
- Narrow cleanup plan: measure the live trail box and inherited radius, render the stroke in that exact coordinate space, and slightly retune the dash length/speed while keeping the effect otherwise unchanged.
- Performance constraint for this pass: prioritize CPU efficiency and playback safety over extra flourish. The active-track perimeter must remain lightweight enough that it never degrades playback smoothness on iOS.

**Cleanup implementation log — 2026-04-01 Codex:**
- `src/components/BorderTrail.tsx`: replaced the remaining hard-coded row/tile rect geometry with a live measured SVG box driven by `ResizeObserver` and the element’s computed border radius. The stroke now renders in the real DOM coordinate space instead of a stretched approximation.
- `src/components/BorderTrail.tsx`: moved the stroke onto the true outside edge by using half-stroke inset math (`strokeWidth / 2`) against the measured width/height/radius, so the path center sits exactly where the border line belongs.
- `styles.css`: removed the animated SVG drop-shadow filter, shortened the opacity transition, and retuned the dash animation to a smaller segment with a faster cycle (`1450ms` tile, `1550ms` row) so motion reads cleaner and costs less CPU on iOS.
- `styles.css` + `src/index.css`: removed the remaining competing active outline rings on `.ytm-tile.is-active` and `.trackRow.is-playing`, leaving one authoritative active perimeter instead of a stacked static ring plus animated trail.
- Expected remaining QA focus: verify that the measured-radius path still matches correctly across rows, tiles, theme variants, and iOS Safari scaling states, and confirm there is no playback hitching while the active trail animates.

**Refinement diagnosis note — 2026-04-01 Codex:**
- Requested visual refinement is to make the active perimeter read as one flowing neon stream with a subtle hotter section, without changing geometry correctness or adding noticeable CPU cost.
- Lightest-weight approach is a second synchronized SVG stroke on the exact same measured rect path. That preserves the edge-bound geometry, avoids extra filters/glow layers, and only adds one more stroke animation over the existing path.

**Refinement implementation log — 2026-04-01 Codex:**
- `src/components/BorderTrail.tsx`: the measured perimeter SVG now renders two rect strokes on the same exact edge-bound path instead of one.
- `styles.css`: tuned the two synchronized strokes as one visual stream: a longer softer base segment plus a shorter brighter hot segment with a slight offset on the same motion cycle, without adding blur/filter cost.
- Geometry, measurement, and edge alignment are unchanged from the cleanup pass; this is only a motion/readability refinement on top of the same exact path.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The previous refinement still read too much like two moving segments because the base stroke itself was also dashed/moving. To get the requested “entire edge is lit” effect, the base perimeter needs to stay fully visible while only the brighter section travels.

**Implementation log — 2026-04-01 Codex:**
- `styles.css`: converted the active perimeter into a full always-lit base stroke plus one moving hot stroke on the same exact measured path. This keeps the whole edge highlighted while preserving a visible traveling brightness section.
- `src/components/WaveformLoop.tsx`: fixed the desktop loop zoom regression by removing the editing-state branch that kept re-centering the existing `viewRange` span. Manual zoom changes now recompute the zoomed loop window instead of appearing inert.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The current full-line + hot-segment perimeter is directionally correct, but the hot segment is still compact enough that the eye can read a harder brightness edge than intended. The next tuning pass should widen the brighter region and reduce the contrast step so the perimeter shows a longer, smoother brightness gradient.

**Implementation log — 2026-04-01 Codex:**
- `styles.css`: widened the moving hot segment and reduced the contrast jump between base and hot strokes, so the active perimeter now carries a longer, softer brightness ramp instead of a tighter bright section with a harder edge.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The perimeter still wants more luxury in the brightness rolloff: the hot section should stay clearly bright, but the glow tail needs to extend farther so the user reads a long luminous gradient instead of a shorter bright patch.

**Implementation log — 2026-04-01 Codex:**
- `styles.css`: lengthened the moving bright section again and slightly lifted the full-line base level, keeping the peak visibly bright while giving it a longer luminous tail and a softer contrast transition.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- There is no current beat/downbeat event or BPM-derived timing signal in the playback path that the active-track perimeter can subscribe to. A true “count 1 downbeat” pulse would need a real rhythm source; faking it with a generic CSS pulse would not actually land on musical downbeats.

**Implementation log — 2026-04-01 Codex:**
- `styles.css`: extended the active perimeter gradient again by lengthening the moving bright section and slightly lifting the full-line base. This keeps the line bright while reducing the remaining visible edge between the peak and its tail.
- Downbeat pulse intentionally not added in this pass: there is no reliable musical downbeat source yet, and a fake free-running pulse would be visually misleading.

---

### 4. UI polish / hero / sparkles / animation consistency
**Status:** diagnosis in progress

**Observed behavior:**
- Fun fix requested: tapping the horizontal PolyPlay logo should flash and emit aura-colored sparkles for a few seconds.
- Repeated taps should be allowed within reason, with guardrails to avoid CPU abuse.
- Matching animation consistency request:
  - current shuffle activation has a great set of effects
  - user wants a matching/similar effect when Repeat 3 is activated

**Expected behavior:**
- PolyPlay logo tap effect should feel premium, aura-colored, lightweight, and safe to spam within guardrails.
- Repeat 3 activation should feel as special/consistent as shuffle activation.

**Suspected root cause:**
- Not implemented yet / polish feature request.

**Files to inspect:**
- hero/header/logo interaction components
- shuffle activation effect logic
- repeat-state activation logic

**Codex notes:**
- Treat logo sparkles as a fun low-priority polish task after bugs.
- Reuse existing animation patterns where possible for repeat-three consistency.

**Diagnosis note — 2026-04-01 Codex:**
- The current horizontal PolyPlay logo in `src/App.tsx` is a plain `img` with no interaction handler, so there is no existing tap target or effect guardrail to build on directly.
- The app already has a lightweight burst system in `src/App.tsx` (`safeTapBursts`) and an existing button sparkle treatment in `src/components/PlayerControls.tsx` (`emitPinkSparkle(...)`). Reusing those is the narrowest path.
- Repeat-three currently only gets a small glow class plus the same short flash used for replay countdown updates. There is no dedicated activation effect when the repeat mode first enters `repeat-3`.

**Implementation log — 2026-04-01 Codex:**
- Block start: reuse the existing burst/effect systems for a guarded logo sparkle effect and a stronger repeat-three activation effect without widening the hero or playback scope.
- `src/App.tsx` + `styles.css`: the horizontal logo is now a dedicated button that triggers a short flash and a staged sequence of aura-colored sparkle bursts using the existing `safeTapBursts` layer.
- Logo sparkle guardrails: reduced-motion respects a single lighter burst, taps are throttled, and pending sparkle timeouts are capped so repeated taps stay responsive without stacking unbounded work.
- `src/components/PlayerControls.tsx` + `src/components/player.css`: repeat-three activation now reuses the existing repeat flash channel plus the same sparkle-burst helper used by shuffle, with a slightly stronger activation pulse only when mode enters `repeat-3`.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The logo tap effect is currently using the generic `safeTapBursts` overlay from `src/App.tsx`. That primitive is intentionally large, soft, and bloom-heavy (`--tap-size` around 120px with broad radial fills in `styles.css`), so even the `"sparkle"` variant still reads like a blob/flare instead of pixie dust when reused for the logo.
- The narrowest fix is to stop using the full-screen burst primitive for the logo and switch to a dedicated tiny-particle sparkle trail localized to the logo button itself.

**Implementation log — 2026-04-01 Codex:**
- Follow-up block start: replace the oversized logo burst with a dedicated lightweight pixie-dust particle treatment, and replace the broken border-image trail with a perimeter-following stroke attached to the correct tile/row surfaces.
- `src/App.tsx` + `styles.css`: the logo tap effect no longer uses the generic full-screen `safeTapBursts` primitive. It now spawns small localized logo sparkles with short drift/twinkle motion inside the logo button itself, which reads as pixie dust instead of a large bloom/blob.
- Logo guardrails remain narrow: taps are still throttled, pending timers are capped, active sparkles are capped, and reduced-motion keeps the sequence lighter.

**Follow-up diagnosis note — 2026-04-01 Codex:**
- The subtle black flash and weird looping hero artifact are not coming from the new sparkles themselves. The remaining problem is the older logo chrome still running underneath: `.topbar-title__logo-button--sparkle` animates a filter on the whole button, `.topbar-title__logo-button::before` adds a broad glow layer with blend behavior, and `.topbar-title__logo-button::after` still runs the old `heroLogoShine` sweep continuously.
- That legacy shine/glow stack conflicts with the new localized sparkle particles and creates the unintended shimmer/shape in the hero bar.

**Implementation log — 2026-04-01 Codex:**
- Follow-up block start: remove the leftover hero shine/glow artifacts and collapse the active-track/aura stack down to one clean perimeter trail plus soft aura glow only.
- `styles.css`: removed the leftover hero logo sweep/shine pseudo-elements and the button-level flash animation so the new sparkle particles no longer compete with a broad glow/filter stack. The logo now keeps the localized pixie-dust effect without the dark flash or looping hero shimmer artifact.
- `src/components/BorderTrail.tsx` + `styles.css`: tightened the perimeter path by giving row mode its own wide SVG viewBox instead of stretching a square one, and reduced the stroke/offset so the animated segment hugs the true edges more closely.
- `styles.css` + `src/index.css`: removed old duplicate active/aura geometry (`.ytm-tile.is-active::after`, extra tile inset aura outline, `.rowAuraGlow::after`, and `.rowAuraAccent`) so Aura+ now contributes soft glow only and no longer stacks phantom outlines underneath the active-track trail.

---

### 5. Settings / links / support
**Status:** diagnosis in progress

**Observed behavior:**
- Terms, Privacy, and Support buttons on iOS still do not work.

**Expected behavior:**
- All three links should open correctly on iOS.

**Suspected root cause:**
- Existing attempted fix may not actually be wired into the iOS interaction path.

**Files to inspect:**
- settings/footer link rendering
- Capacitor/browser/open-url handling
- iOS-specific link/open helpers

**Codex notes:**
- This remains open and unverified despite prior work.

**Diagnosis note — 2026-04-01 Codex:**
- `src/admin/AdminApp.tsx` attempts to open links through a Capacitor `Browser` plugin, but the repo does not currently include `@capacitor/browser`. On iOS, the fallback `window.open(...)` path is likely a no-op inside the webview, which explains why Terms, Privacy, and Support still fail.
- `SUPPORT_URL` is currently `/support` while the actual static asset in `public/` is `support.html`. Even if native opening is repaired, Support still points at the wrong path for this static app build.

**Implementation log — 2026-04-01 Codex:**
- Block 5 start: fix support URL and bypass the broken Browser / `window.open(...)` path for same-origin static pages so iOS settings links can navigate reliably inside the app webview.
- Block 5 complete: support now points at `/support.html`, and same-origin legal/support links navigate directly within the admin webview instead of relying on the unavailable Capacitor Browser path.

---

### 6. Auto art / visual generation bugs
**Status:** open

**Observed behavior:**
- Weird oversaturated bright pink auto art happened again.
- Same auto art did not appear on now-playing island bar for user.
- Visual consistency is off.

**Expected behavior:**
- Auto art should not suddenly produce bizarre oversaturated pink results.
- Auto art should remain consistent across player surfaces, including island/now-playing displays.

**Suspected root cause:**
- Auto art generation/render pipeline may be unstable.
- Color-treatment or theme blending may be leaking into art rendering.
- Different surfaces may use different image/art sources.

**Files to inspect:**
- auto art generation path
- artwork rendering across tiles/rows/now-playing/island
- theme blending / compositing logic

**Codex notes:**
- Fix correctness first; polish can wait.

---

## Commits / checkpoints
- Metadata-assisted import was implemented but needs real-world QA and may be implicated in import regressions.
- Loop system is improved but still unstable in live use.
- Repeat state machine was recently updated and still needs QA.
- Cinema guard was adjusted to unlock after editing, but broader fullscreen/loop UX still needs work.

## Blockers
- Codex rate limit is low, so work should stay diagnosis-first and narrow.
- Avoid broad multi-feature passes until core regressions are stabilized.

## QA checklist
- [ ] Reproduce issue
- [ ] Root cause documented
- [ ] Fix implemented
- [ ] Typecheck/build passes
- [ ] Live QA completed

## Suggested next Codex session order
1. Import-page brick / metadata-artwork regression
2. Loop viewport + fullscreen exit behavior
3. iOS settings links
4. Active-track border trail correctness
5. Auto art correctness
6. Artist autocomplete behavior
7. Polish items (logo sparkles / repeat-three matching animation)

## Next Codex session starter
Use this MD as the working source of truth.
Start by summarizing the top 3 open bugs, propose the single next task, and update this file with a session-start note before editing code.

---

### Metadata pipeline follow-up — 2026-04-01 Codex
**Session-start note:**
- Live QA reported that embedded-art MP3 import still did not arm artwork/title/artist on file select, even though the fallback auto art was no longer the oversaturated pink variant.
- That result means the prior state cleanup was not enough. The remaining likely weakness is the metadata pipeline still living inside a shared `useEffect`, which leaves file-select behavior dependent on async state timing instead of the selected file itself.

**Implementation log:**
- Replaced the import-form metadata parse trigger with an explicit file-select pipeline in `src/admin/AdminApp.tsx`: `pick file -> reset draft -> set audio -> parse selected file -> apply artwork/title/artist -> publish result`.
- Desktop picker and iOS native picker now both call the same file-select metadata pipeline directly instead of waiting for `uploadAudio` state to drive parsing later.
- The `ignore metadata` toggle still re-runs the same pipeline for the already-selected file, so the checkbox path stays aligned with the direct picker path.
- `npm run typecheck` passed after the refactor.

**Follow-up diagnosis:**
- Live QA still reports that nothing arms on MP3 file select.
- At that point the remaining suspect is not the apply state. It is the parser transport path itself.
- `music-metadata-browser` `parseBlob(...)` depends on the browser `Blob.stream()` / web-stream path. The next narrow hardening step is to parse selected files through `arrayBuffer + parseBuffer(...)` instead, and infer MIME from the filename when the picker leaves `file.type` blank.

**Implementation log:**
- Swapped import-form metadata parsing from `parseBlob(file)` to `parseBuffer(new Uint8Array(await file.arrayBuffer()), { mimeType, path, size })`.
- Added `inferAudioMetadataMimeType(file)` so MP3/M4A/AAC/WAV/MP4/MOV files still get a useful parser MIME hint even when the picker returns an empty or generic `file.type`.
- `npm run typecheck` passed after the parser-path hardening change.

**Instrumentation pass:**
- Added a direct parser-result debug log in `src/admin/AdminApp.tsx` with:
  - file name
  - file type
  - inferred MIME
  - parse success/failure
  - common title
  - common artist
  - picture count
  - first picture format
  - first picture type
  - first picture byte length
- Added a small visible import-form metadata status panel so QA can distinguish:
  - parse failed
  - metadata found nothing
  - artwork found only
  - text found only
  - full metadata found
- `npm run typecheck` passed after the instrumentation pass.

**Direct evidence from live QA:**
- Safari console for a failing MP3 now shows `error: "ReferenceError: Can't find variable: Buffer"`.
- That means metadata import is currently blocked by parser runtime compatibility in the browser, not by artwork precedence or apply rules.
- The next narrow fix is to provide a `Buffer` polyfill for the admin metadata-import runtime before `music-metadata` is used.

**Implementation log:**
- Added a narrow `Buffer` polyfill in `src/admin-main.tsx` so the admin import runtime exposes `globalThis.Buffer` before the metadata parser runs.
- Scope is limited to the admin entry bundle instead of changing the main player runtime.
- `npm run typecheck` passed after the polyfill.

**Follow-up diagnosis from live QA:**
- A second MP3 now proves the parser returns title/artist/artwork, but `titleApplied` and `artistApplied` can still be `false` even when `titleFound` / `artistFound` are `true`.
- That points to a remaining application-rule race, not a parser problem.
- Most likely root cause: `resetUploadDraftForNewAudio()` clears `uploadTitle` / `uploadArtist` with React state, but the metadata pipeline runs immediately afterward and still sees the previous file's non-empty text state before the reset has flushed.

**Implementation log:**
- Added synchronous `uploadTitleValueRef` / `uploadArtistValueRef` tracking in `src/admin/AdminApp.tsx`.
- Metadata title/artist apply now checks those live refs instead of waiting on React state updater timing, so a new file-select reset cannot be mistaken for preserved manual text from the previous file.
- Input change handlers and reset/success paths now keep the refs synchronized with the visible form fields.
- `npm run typecheck` passed after the text-apply race fix.

**Quick follow-up request:**
- User requested a narrow border-trail tuning pass only:
  - blend the strobing highlight gradient more
  - speed the motion up by about 20%

**Implementation log:**
- Adjusted `styles.css` border-trail tuning only:
  - raised the full-line base opacity slightly
  - lengthened the moving hot segment for a softer blend / longer luminous tail
  - reduced hot-segment peak contrast slightly
  - sped the cycle from `1500ms` to `1200ms` (20% faster)
- `npm run typecheck` passed after the quick border-trail tuning pass.
