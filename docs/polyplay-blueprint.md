# Polyplay Blueprint

## Purpose

This document is a working blueprint for Polyplay as it exists in the current codebase. It is meant to be useful for product planning, refactoring, debugging, release preparation, and future Codex sessions.

This blueprint distinguishes between three categories:

- Confirmed implementation: behavior that is directly visible in the current code.
- Intended product behavior: behavior described in [`docs/polyplay-product-summary.md`](/Users/paulfisher/Polyplay/docs/polyplay-product-summary.md) that appears to represent product intent.
- Known gaps / verification needs: places where the current implementation is incomplete, inconsistent, fragile, or not fully verifiable from the inspected code.

Primary code inspected for this blueprint:

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
- [`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts)
- [`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts)
- [`src/lib/gratitude.ts`](/Users/paulfisher/Polyplay/src/lib/gratitude.ts)
- [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts)
- [`src/lib/aura.ts`](/Users/paulfisher/Polyplay/src/lib/aura.ts)
- [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)
- [`src/components/WaveformLoop.tsx`](/Users/paulfisher/Polyplay/src/components/WaveformLoop.tsx)
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx)
- [`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx)
- [`src/fx/ambientFxEngine.ts`](/Users/paulfisher/Polyplay/src/fx/ambientFxEngine.ts)
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)

## Design Principles

These principles should guide future implementation decisions, especially when the codebase allows multiple technically valid approaches.

- Fast: actions should feel immediate, especially import, playback, track switching, and player controls.
- Offline-first: the app should remain useful and complete without network dependency after installation and local media import.
- Tactile: controls should feel direct, touch-friendly, and satisfying rather than dense or fiddly.
- Visually alive: motion, artwork, aura, and FX should make the app feel expressive without becoming noisy or distracting.
- Low-friction: core tasks should require as little setup and explanation as possible.
- Personal-media ownership: the library belongs to the user and is built from the user’s own files, not a remote catalog.
- Performance-conscious: visual ambition should not come at the cost of sluggishness, battery drain, or unreliable mobile behavior.

## 1. Product Overview

### Confirmed implementation

Polyplay is currently a React + Vite single-page app with a Capacitor iOS wrapper. The primary runtime is the web app. The app uses browser storage heavily: library metadata and most UI preferences live in `localStorage`, while imported media blobs live in IndexedDB. The package metadata still uses legacy naming (`carplay-music-app`), but the runtime branding and product surface are Polyplay.

The app is not built around remote streaming, accounts, or network libraries. Playback is driven by an in-page HTML audio element. Imported media is resolved from local IndexedDB blobs into object URLs and then played locally.

Relevant files:

- [`package.json`](/Users/paulfisher/Polyplay/package.json)
- [`capacitor.config.ts`](/Users/paulfisher/Polyplay/capacitor.config.ts)
- [`src/main.tsx`](/Users/paulfisher/Polyplay/src/main.tsx)
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)

### Intended product behavior

The product summary positions Polyplay more specifically as a personal offline audio streaming frontend built from the user’s own files. The goal is not just local playback. The goal is to let a user turn their private media library into something that feels fast, immersive, visually expressive, and emotionally personal.

Its core differentiator is the combination of:

- user-owned offline media
- playlist-based listening
- creative visual identity
- a reflective journal layer that lives alongside playback instead of feeling bolted on

### Known gaps / verification needs

Android packaging is mentioned as a release goal in the product summary, but the inspected code in this pass shows a web app plus Capacitor iOS packaging more clearly than a complete Android release path. There is also a `flutter_app/` directory, but it does not appear to be the primary runtime for the current product and needs separate verification before treating it as active product architecture.

## 2. Core Experience

### Confirmed implementation

The current app centers around a single orchestrating component in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx). The user lands in a library view scoped to the active playlist, sees a top bar with theme/FX/journal/vault/layout controls, browses tracks in either tile or row view, and interacts with a persistent bottom player.

The player has two active UI modes:

- Mini player / bottom bar via [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- Fullscreen player via [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)

Track browsing is handled by [`src/components/TrackGrid.tsx`](/Users/paulfisher/Polyplay/src/components/TrackGrid.tsx), which renders either tile cards or row entries depending on `layoutMode`.

When overlays are open, the app suppresses parts of the main experience. The main overlay system currently covers:

- Settings/admin iframe
- Vault backup overlay
- Fullscreen player
- Splash overlay
- Gratitude prompt
- Journal modal
- Create-playlist modal
- Quick tips modal

### Why this exists

The current implementation is optimized around keeping playback available while the rest of the app swaps between overlays and supporting tools. The bottom player remains the stable control surface; fullscreen and overlays extend that experience rather than replacing the entire app shell.

At a product level, the experience is trying to feel like a personal offline streaming environment rather than a file browser. The user is meant to move quickly from library to playback, then into a more expressive fullscreen or ambient state when they want a deeper experience. The journal sits as a secondary reflective layer, not as the main event, but still as part of the identity of the app.

### Intended product behavior

The product summary describes Polyplay as a low-friction offline audio experience with visually rich playback, playlist management, creative controls, and a reflective side-channel through the Gratitude Journal. The intended experience is practical first, but not emotionally flat: it should feel owned, expressive, offline, and alive.

### Known gaps / verification needs

The top-level app is carrying a large amount of state and orchestration logic directly inside `App`. That makes the experience easy to ship incrementally, but it also means changes in one part of the app can affect unrelated behavior through rerenders or shared state coupling. This is a structural risk rather than a confirmed bug by itself.

## 3. Key Features

### Confirmed implementation

The following features are directly visible in code:

- Local track import with audio stored as IndexedDB blobs via [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
- Support for importing audio from audio files and from MP4-like files accepted as track media in admin upload validation
- Artwork replacement, including video artwork support and poster-frame extraction via [`src/lib/artwork/videoPoster.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoPoster.ts)
- Auto-generated fallback waveform artwork when needed via [`src/lib/artwork/waveformArtwork.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/waveformArtwork.ts)
- Playlist creation, activation, rename, and delete
- Aura rating stored per track, with aura-weighted shuffle
- Loop modes per track: `off`, `track`, and `region`
- Mini player and fullscreen player control surfaces
- Vault full-backup export/import
- Polyplaylist export/import support in the backup layer and admin UI
- Gratitude prompt and Gratitude Journal
- Splash, demo seeding, and quick-tour onboarding states
- Ambient FX modes: `gravity`, `pop`, `splatter`
- Theme modes: dark, light, and custom theme slots

### Intended product behavior

The product summary also calls out:

- Minimal / waveform / fullscreen playbar terminology
- Vibe button cycling background variations
- Journal atmosphere as a peaceful reflective environment
- FX as fidget-like interaction layers

Most of those intentions are represented in current code, though not always with exactly the same naming as the summary.

### Known gaps / verification needs

The product summary mentions some functionality in user-facing terms that the code implements in slightly different technical terms. For example:

- The “Vibe” concept appears in code as `noveltyMode`, cycling `normal`, `dim`, and `mute`.
- “Minimal” versus “waveform” player modes are approximated by compact versus expanded mini-player behavior rather than a clearly isolated mode model.

These are not necessarily wrong, but they should be documented carefully in future product docs so the language matches what the app actually does.

## 4. Core User Flows

### Confirmed implementation

#### First launch and first-run demo flow

On startup, `App` calls `refreshTracks()` and then `ensureDemoTracksForFirstRun()`. Demo tracks are seeded and normalized via [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts). If the library looks like a pristine demo-only state, the app can prefer the demo playlist as the active playlist.

The seeding flow:

- Ensures a demo playlist exists
- Downloads demo media from `/demo/demo1.mp4` and `/demo/demo2.mp4`
- Stores demo media as normal track blobs
- Repairs missing demo posters if needed
- Normalizes duplicate demo tracks and duplicate demo playlists

#### Empty library to first playlist

`refreshTracks()` ensures there is an active playlist. If no playlists exist, the app opens the create-playlist modal and marks playlist creation as required. The empty-state welcome card can also steer the user into a quick tour that first asks them to create a playlist and then upload a track.

#### Track selection and playback start

`playTrack(trackId, autoPlay)` handles selection. It:

- Dismisses the open-state welcome
- Checks if the selected track is playable
- Tears down the current audio source when switching tracks
- Sets `pendingAutoPlayRef`
- Updates `currentTrackId`

A separate effect watches `currentAudioUrl` and wires the actual `<audio>` element to the new URL, then executes autoplay if `pendingAutoPlayRef` is set.

#### Playback continuation and track advance

The audio event listener effect handles:

- `timeupdate`
- `loadedmetadata`
- `durationchange`
- `play`
- `pause`
- `error`
- `ended`

On `ended`, behavior is:

- Region loop restarts from region start
- Track repeat restarts at time `0` when repeat is enabled and region loop is not active
- Shuffle selects a new track using aura weighting
- Otherwise playback stops

#### Vault export/import

The vault overlay can export a full backup or import one. The import flow checks whether the current playlist is marked dirty and may warn the user before continuing. Import restores metadata, media blobs, and gratitude data, then refreshes library state in the runtime app.

#### Gratitude prompt and journal flow

After splash dismissal, the app evaluates whether it should show the gratitude prompt based on stored settings and last prompt time. The prompt can save an entry, skip saving text, or disable future prompting. Journal access is separate and does not stop playback.

### Why these flows exist

These flows define the current product shape: local media import, lightweight playback, optional reflection/journaling, and recoverability through local backup.

### Known gaps / verification needs

The settings/upload path runs through an iframe-based admin tool rather than a fully integrated in-app React surface. That means some core flows are split across `App` and `admin.html`/`AdminApp`, with cross-window message passing. This is a real architectural boundary and should be treated as a maintenance risk.

## 5. Technical Architecture

### Confirmed implementation

The current architecture is a browser-local app with four main layers:

#### UI orchestration layer

`App` owns the majority of runtime UI state:

- Current visible tracks
- Current selected track
- Audio playback flags
- Loop state maps
- Theme/layout/FX state
- Overlay visibility
- Onboarding state
- Vault status and import summary

#### Persistence layer

There are two primary persistence mechanisms:

- `localStorage` for library JSON, loop state, gratitude settings/entries, theme/layout flags, onboarding flags, and various UI preferences
- IndexedDB for blobs via [`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts)

Library metadata is normalized through [`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts). Media blobs are stored separately and referenced by keys in track records.

#### Playback/media layer

Playback uses:

- A single `<audio>` element in `App`
- Object URLs derived from IndexedDB blobs via [`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts)
- Video elements for fullscreen artwork and journal backgrounds

#### Backup/import layer

The backup subsystem in [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts) builds ZIP archives in the browser without external ZIP libraries. It exports and imports:

- Full backups
- Polyplaylist packages
- Config snapshots
- Gratitude JSON

### Why this architecture exists

This design supports offline use and avoids a remote backend. Everything important to the user’s library can be stored locally and bundled back out into portable backups.

### Known gaps / verification needs

The app has a mixed “canonical state” model:

- Runtime state in React
- Library metadata in `localStorage`
- Media blobs in IndexedDB
- Some duplicate state snapshots persisted for debugging or recovery

This is workable but increases synchronization complexity. The current code includes explicit reconciliation helpers and inspector tools, which suggests state divergence has been a real operational concern.

## 6. Important Components and Files

### App shell and orchestration

[`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) is the center of the current app. It owns playback, overlay control, onboarding state, layout/theme/FX state, loop state, vault UI, gratitude prompt timing, and communication with the admin iframe.

### Playback UI

[`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
Bottom player with compact/expanded behavior, artwork button, meta display, aura button, player controls, and waveform loop panel.

[`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)
Fullscreen playback view with artwork/video, waveform animation for generated art, loop editing, richer controls, and aura actions.

[`src/components/PlayerControls.tsx`](/Users/paulfisher/Polyplay/src/components/PlayerControls.tsx)
Shared transport/seek/shuffle/repeat/dim/loop control surface used by both player modes.

[`src/components/WaveformLoop.tsx`](/Users/paulfisher/Polyplay/src/components/WaveformLoop.tsx)
Canvas-based waveform display and draggable loop-range UI. Generates peaks from audio blobs when available.

### Library views

[`src/components/TrackGrid.tsx`](/Users/paulfisher/Polyplay/src/components/TrackGrid.tsx)
Switches between tile and row layouts.

[`src/components/TrackTile.tsx`](/Users/paulfisher/Polyplay/src/components/TrackTile.tsx)
Track tile presentation.

[`src/components/TrackRow.tsx`](/Users/paulfisher/Polyplay/src/components/TrackRow.tsx)
Track row presentation.

### Journal and prompt

[`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
Full gratitude journal interface, including entry management, background video handling, verse rotation, and dedicated backup import/export.

[`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx)
Prompt shown on app open according to stored gratitude settings.

### FX and visuals

[`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx)
Canvas host for the ambient FX engine.

[`src/fx/ambientFxEngine.ts`](/Users/paulfisher/Polyplay/src/fx/ambientFxEngine.ts)
Custom particle/physics-like engine for gravity, pop, and splatter modes.

### Storage and media

[`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
Track CRUD, playlist CRUD, storage-cap handling, artwork replacement, audio replacement, migration, and reset operations.

[`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts)
Canonical library JSON schema and normalization logic.

[`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts)
Raw IndexedDB blob store wrapper.

[`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts)
Object URL cache and cleanup helpers.

### Backup and import/export

[`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
Builds backup manifests, ZIP archives, import parsers, and restore logic.

### Admin/settings integration

[`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)
The current settings/admin surface for uploads, replacements, storage management, playlist management, config import/export, and backup actions.

### Risks

The most important file risk is that `App.tsx` has become a high-complexity integration point. The second major risk is that “settings” are not just passive preferences; they contain core content-management flows through the admin iframe.

## Code Map

### Major app entry points

- [`src/main.tsx`](/Users/paulfisher/Polyplay/src/main.tsx) boots the main React app and mounts `App`.
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) is the main runtime shell for playback, overlays, onboarding, vault, theme, and FX orchestration.
- [`src/admin-main.tsx`](/Users/paulfisher/Polyplay/src/admin-main.tsx) boots the separate admin/settings surface.
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) provides uploads, replacements, playlist management, storage tools, and import/export utilities.
- [`src/help-main.tsx`](/Users/paulfisher/Polyplay/src/help-main.tsx) boots the help surface if used.
- [`src/help/HelpApp.tsx`](/Users/paulfisher/Polyplay/src/help/HelpApp.tsx) renders the help UI.

### Major feature components

- [`src/components/TrackGrid.tsx`](/Users/paulfisher/Polyplay/src/components/TrackGrid.tsx) switches between grid and list track presentation.
- [`src/components/TrackTile.tsx`](/Users/paulfisher/Polyplay/src/components/TrackTile.tsx) renders the tile-style library item.
- [`src/components/TrackRow.tsx`](/Users/paulfisher/Polyplay/src/components/TrackRow.tsx) renders the row-style library item.
- [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx) renders the persistent bottom player and expanded waveform panel.
- [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx) renders fullscreen playback, artwork/video, and richer controls.
- [`src/components/PlayerControls.tsx`](/Users/paulfisher/Polyplay/src/components/PlayerControls.tsx) contains shared transport, seek, shuffle, repeat, dim, and loop controls.
- [`src/components/WaveformLoop.tsx`](/Users/paulfisher/Polyplay/src/components/WaveformLoop.tsx) draws the waveform and handles loop-region selection/editing.
- [`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx) hosts the ambient FX engine.
- [`src/components/BubbleLayer.tsx`](/Users/paulfisher/Polyplay/src/components/BubbleLayer.tsx) provides a supplemental decorative FX layer.

### State-heavy files

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) is the most state-heavy file in the repo and owns most runtime state transitions.
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) is the second major state-heavy surface for media management and maintenance operations.
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts) is a logic-heavy persistence module for track, playlist, and storage state.
- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts) is a logic-heavy import/export module with multiple data formats and restore paths.
- [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts) is a stateful onboarding/demo normalization module with repair logic.

### Backup / vault files

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts) implements full backup, polyplaylist export/import, config snapshots, gratitude export, ZIP building, and restore logic.
- [`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts) defines the library schema that backup and restore operate on.
- [`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts) stores and restores the underlying media blobs used by backups.
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) contains the main runtime vault overlay and inspector/debug actions.
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) exposes backup/import/export operations in the admin/settings surface.

### Onboarding files

- [`src/components/EmptyLibraryWelcome.tsx`](/Users/paulfisher/Polyplay/src/components/EmptyLibraryWelcome.tsx) renders the first-run empty-state and quick-tour guidance card.
- [`src/components/SplashOverlay.tsx`](/Users/paulfisher/Polyplay/src/components/SplashOverlay.tsx) renders the startup splash video and skip behavior.
- [`src/components/QuickTipsModal.tsx`](/Users/paulfisher/Polyplay/src/components/QuickTipsModal.tsx) renders the quick tips/help modal.
- [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts) seeds, repairs, and normalizes demo content used in onboarding.
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) coordinates splash timing, demo-first-run detection, and quick-tour phase state.

### Gratitude journal files

- [`src/lib/gratitude.ts`](/Users/paulfisher/Polyplay/src/lib/gratitude.ts) stores gratitude settings, entries, prompt timing, and export formatting.
- [`src/components/GratitudePrompt.tsx`](/Users/paulfisher/Polyplay/src/components/GratitudePrompt.tsx) renders the startup gratitude prompt.
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) renders the journal UI, entry editing, verse display, and journal import/export.
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) decides when to show the gratitude prompt and opens the journal from the main app shell.

### Settings / media-management files

- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx) is the main settings/media-management UI.
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts) handles track uploads, artwork replacement, audio replacement, playlist CRUD, and destructive resets.
- [`src/lib/playlistState.ts`](/Users/paulfisher/Polyplay/src/lib/playlistState.ts) handles active-playlist and visible-track logic for the main runtime.
- [`src/lib/library.ts`](/Users/paulfisher/Polyplay/src/lib/library.ts) wraps access to the canonical library storage layer.
- [`src/lib/artwork/videoPoster.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoPoster.ts) extracts poster frames from video artwork.
- [`src/lib/artwork/videoValidation.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoValidation.ts) enforces artwork video limits before acceptance.
- [`src/lib/artwork/waveformArtwork.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/waveformArtwork.ts) generates fallback artwork from audio when needed.
- [`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts) resolves stored blob keys into playable object URLs.

### Styling files for major UI systems

- [`src/index.css`](/Users/paulfisher/Polyplay/src/index.css) is the primary global stylesheet for the main app shell, themes, overlays, library views, and major visual systems.
- [`src/components/player.css`](/Users/paulfisher/Polyplay/src/components/player.css) contains dedicated styling for player controls, waveform UI, and playback presentation.

### iOS-specific shell / build integration points

- [`capacitor.config.ts`](/Users/paulfisher/Polyplay/capacitor.config.ts) defines the Capacitor app shell configuration for native packaging.
- [`ios/App/AppDelegate.swift`](/Users/paulfisher/Polyplay/ios/App/AppDelegate.swift) is the iOS application delegate entry point.
- [`ios/App/App/Info.plist`](/Users/paulfisher/Polyplay/ios/App/App/Info.plist) contains iOS app metadata and runtime configuration.
- [`ios/App/App.xcodeproj/project.pbxproj`](/Users/paulfisher/Polyplay/ios/App/App.xcodeproj/project.pbxproj) is the Xcode project definition used for the native shell build.
- [`ios/App/App/Base.lproj/LaunchScreen.storyboard`](/Users/paulfisher/Polyplay/ios/App/App/Base.lproj/LaunchScreen.storyboard) defines the native iOS launch screen.
- [`ios/App/App/Base.lproj/Main.storyboard`](/Users/paulfisher/Polyplay/ios/App/App/Base.lproj/Main.storyboard) defines the main iOS storyboard for the Capacitor shell.

## 7. State and Logic Systems

### Confirmed implementation

#### Runtime React state

`App` keeps runtime state for:

- `tracks`
- `currentTrackId`
- `isPlaying`
- `currentTime`
- `duration`
- `loopByTrack`
- `loopModeByTrack`
- `runtimeLibrary`
- overlay and modal visibility
- onboarding flags
- theme, layout, FX, dim, novelty
- vault toasts and import summaries

#### Persisted library state

`LibraryState` contains:

- `tracksById`
- `playlistsById`
- `activePlaylistId`

Each `TrackRecord` stores:

- identity and title metadata
- aura
- blob keys for audio, poster art, and artwork video
- size metrics
- timestamps
- artwork source marker

#### Persisted UI/settings state

The app stores many UI flags directly in `localStorage`, including:

- layout mode
- theme mode
- custom theme slot
- aura color
- shuffle/repeat
- dim mode
- novelty mode
- loop maps
- imported/onboarded flags
- splash flags
- gratitude settings
- gratitude entries

#### Sync patterns

The app uses a combination of:

- direct write-through to `localStorage`
- explicit `refreshTracks()` reloads from storage
- `window.dispatchEvent(new CustomEvent("polyplay:library-updated"))`
- `window.postMessage(...)` between the main app and admin iframe

### Why this exists

This design allows the app to recover from reloads and supports a local-only model without a backend. The event-based refresh pattern also lets the admin iframe modify storage and notify the main app.

### Known gaps / limitations

There is meaningful duplication between:

- `runtimeLibrary`
- `tracks`
- persisted library JSON
- `APP_STATE_KEY` snapshots used for additional persistence/debugging

The presence of vault inspector tools, migration helpers, and “persist now” actions indicates that storage synchronization has been a recurring issue. That does not mean the system is broken by default, but it does mean future refactors should prioritize clearer state ownership.

## 8. Playback System

### What it does

The playback system provides local media playback with playlist-aware track selection, transport controls, looping, shuffle/repeat, aura interactions, and fullscreen playback visuals.

### Confirmed implementation

Playback is driven by a single `<audio ref={audioRef} preload="metadata" playsInline />` element inside `App`.

Track playback works as follows:

- `currentTrackId` identifies the selected runtime track.
- `currentTrack?.audioUrl` points to an object URL produced from IndexedDB blob data.
- When the current audio URL changes, `App` resets the audio element, assigns the new `src`, loads metadata, and optionally autoplays.

Playback controls implemented in code:

- play/pause
- previous/next
- seek
- skip by caller-provided delta
- shuffle
- repeat-track
- dim/mute cycling
- novelty/vibe cycling
- loop creation and clearing
- aura increment

Loop logic:

- `track` loop mode uses the audio element’s native `loop` flag
- `region` loop mode is enforced in `timeupdate` and `ended` handlers
- loop regions are stored per track in `loopByTrack`

Shuffle logic:

- Implemented in [`src/lib/aura.ts`](/Users/paulfisher/Polyplay/src/lib/aura.ts)
- Higher aura increases weight
- Recently played tracks are suppressed with cooldown factors
- Current track is excluded from the candidate pool when possible

### Major UI behavior

Mini player:

- always-on bottom bar when tracks are available and no blocking overlay is active
- compact toggle
- artwork button opens fullscreen player
- expanded state shows waveform loop editor

Fullscreen player:

- closes on outside tap or close button
- shows video artwork when available
- otherwise shows still art or generated art
- animates auto-generated waveform visuals over artwork when artwork source is `auto`

### Important files/components

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)
- [`src/components/PlayerControls.tsx`](/Users/paulfisher/Polyplay/src/components/PlayerControls.tsx)
- [`src/components/WaveformLoop.tsx`](/Users/paulfisher/Polyplay/src/components/WaveformLoop.tsx)
- [`src/lib/aura.ts`](/Users/paulfisher/Polyplay/src/lib/aura.ts)
- [`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts)

### CPU / performance considerations

Confirmed mitigations:

- Generated fullscreen waveform animation is throttled to 30 FPS
- Artwork videos are paused and torn down on visibility changes and unmount
- Media object URLs are cached and explicitly revoked
- The audio element is reused instead of recreated per track

Performance risks:

- `WaveformLoop` rebuilds peaks from full audio blobs
- Fullscreen generated-art animation still runs continuously while open
- Audio event listeners depend on several changing values and are reattached when dependencies change

### Known gaps / verification needs

The product summary mentions skip backward/forward by 10 or 30 seconds. The current player control implementation supports a generic `onSkip(delta)` API, but the exact visible button set and whether both 10s and 30s are exposed in all views should be verified in the rendered UI/CSS.

## 9. Playlist / Media Management

### What it does

This system manages playlist membership, active playlist selection, track ordering, audio/art replacements, and track deletion.

### Confirmed implementation

#### Playlist model

Each playlist record stores:

- `id`
- `name`
- `trackIds`
- timestamps

Active playlist selection is stored in `LibraryState.activePlaylistId`.

The main app only displays tracks from the active playlist via `getVisibleTracksFromLibrary`.

#### Playlist operations

Available operations in code:

- create playlist
- set active playlist
- rename playlist
- delete playlist

Deleting a playlist may also delete tracks if they are no longer referenced by any remaining playlist. This behavior is implemented in [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts) by counting references across remaining playlists and removing unreferenced tracks plus their blobs.

#### Media import and replacement

Adding a track:

- stores audio blob
- optionally stores poster art
- optionally stores artwork video
- generates poster art from video if needed
- generates waveform artwork if neither poster nor video poster is available
- inserts the new track at the front of the active playlist

Replacing artwork:

- deletes old art blobs after saving new ones
- updates `artKey`, `artVideoKey`, and size metadata

Replacing audio:

- stores a new audio blob
- updates title from explicit title or filename
- deletes old audio blob

#### Admin/settings role

The admin iframe is currently the main UI for:

- uploads
- artwork replacement
- audio replacement
- track rename
- track delete
- playlist management
- storage inspection

### Why this exists

This is the core “offline personal media library” system. It is what turns Polyplay from a demo player into a user-owned media environment.

### Risks / limitations

- Playlist deletion has destructive media implications when tracks are only referenced by that playlist.
- The current product summary suggests personal playlist management, but the app’s actual management UI lives in an admin/settings panel rather than the main library surface.
- The current code intentionally avoids auto-injecting all tracks into empty playlists because that breaks playlist isolation.

### Verification needs

The product summary says users can choose the active playlist from both the main page dropdown and Settings. The main-page dropdown is confirmed in `App`; the full settings-side playlist UX exists in `AdminApp` but should be verified visually if documenting exact user steps.

## 10. Vault / Backup System

### What it does

The vault system exports and imports a full local backup of the user environment. There is also a smaller polyplaylist package system and a gratitude-only export/import path.

### Confirmed implementation

#### Full backup contents

The full backup ZIP includes:

- `config.json`
- `gratitude.json`
- `library.json`
- `manifest.json`
- per-track media files under `polyplay-backup/media/...`

The manifest explicitly contains:

- app version
- config snapshot
- gratitude entries
- normalized library state

`buildConfigSnapshot()` includes:

- theme settings
- aura color
- layout mode
- shuffle/repeat
- `hasImported` flag
- gratitude settings
- per-track aura and loop info

#### Full backup restore

`importFullBackup()`:

- parses the ZIP
- reads config and library
- clears all stored blobs first
- rebuilds restored track blobs into fresh blob keys
- rebuilds library metadata
- filters playlist track IDs to only restored tracks
- repairs invalid active playlist pointers
- applies imported config settings
- restores gratitude settings and entries if present

#### Backup size cap

Full backup and polyplaylist export both enforce a 250 MB estimated cap using `BackupSizeError`.

#### Vault UI

The vault overlay in `App` includes:

- export full backup
- import full backup
- unsaved-change warning before import
- library inspector
- debug copy actions
- persistence/migration/refresh helpers

The presence of these tools confirms this subsystem is also being used as an operational recovery/debug surface, not just an end-user feature.

#### Polyplaylist support

There are two distinct polyplaylist-related systems:

- Config-style polyplaylist import/export that reorders and updates an existing local playlist by matching track IDs
- Packaged polyplaylist ZIP import/export that actually bundles track metadata and media

The admin app exposes `exportPolyplaylist()` and `importPolyplaylist()`; the main runtime vault overlay currently exposes full-backup operations more directly.

### Intended product behavior

The product summary describes Vault as the main backup mechanism for restoring a user’s environment after reinstall or reset. The current code supports that description.

### Risks / limitations

- Full backup import is destructive to the current blob store because it clears all stored blobs before rebuilding restored data.
- Restore safety depends on trusting the imported ZIP contents.
- There is no evidence in the inspected code of cryptographic verification, signatures, or schema version migration beyond the current app-defined manifest/version checks.

### Verification needs

The product summary mentions that individual playlists are not yet saved independently outside the full backup system. The code now includes standalone polyplaylist export/import paths, so the summary and implementation are no longer fully aligned and should be updated carefully.

## 11. Gratitude Journal System

### What it does

This subsystem handles both:

- a startup gratitude prompt
- a longer-form journal modal with entry management and dedicated import/export support

### Confirmed implementation

#### Prompt system

`src/lib/gratitude.ts` stores:

- settings
- last prompt timestamp
- entries

Supported prompt frequencies:

- `daily`
- `weekly`
- `launch`
- `off`

The prompt can mark:

- `doNotSaveText`
- `doNotPromptAgain`

`App` evaluates prompt visibility after splash dismissal using `shouldShowGratitudePrompt(...)`.

#### Journal system

`JournalModal` supports:

- listing entries
- creating entries
- editing entries
- deleting entries
- search/query state
- verse rotation
- dedicated export/import
- alternate background videos

Entries are stored in `localStorage` and currently normalized into a capped list of 50 entries in `appendGratitudeEntry`.

The journal’s backup export uses `serializeGratitudeJson()` and save/share fallbacks similar to the vault flow.

### Why it exists

This is a differentiating layer in the product. It adds an intentionally non-playback feature that still coexists with playback instead of interrupting it.

### Major UI behavior

- Prompt is modal and can autofocus the textarea when appropriate
- Journal is a separate modal with atmospheric visuals
- Playback is not explicitly shut down when the journal opens

### CPU / performance considerations

Confirmed mitigations:

- Journal uses a lighter FX mode on coarse pointers, reduced-motion contexts, or save-data contexts
- Background videos are managed via refs and readiness state

Potential costs:

- Background video playback
- Verse FX and sparkle effects
- Modal-level state complexity

### Risks / limitations

- Entries live in `localStorage`, which is fine at current scale but not a durable large-entry store
- The product summary frames this as calm and peaceful; the implementation contains a lot of decorative behavior that should be checked on lower-end devices

### Verification needs

The product summary mentions rotating Bible verses stored directly in the app. `JournalModal` includes default verses in code and also loads verse content state, but the exact external source-loading behavior should be verified if documenting it as final.

## 12. Onboarding System

### What it does

The onboarding system combines splash, demo content, empty-state guidance, and quick-tour progression.

### Confirmed implementation

#### Splash

`SplashOverlay` plays a bundled video, can request user interaction for autoplay, optionally enables sound, and supports “skip every time” persistence.

Splash persistence uses:

- `polyplay_hasSeenSplash`
- `polyplay_hasSeenSplashSession`

#### Empty-state and quick tour

`EmptyLibraryWelcome` supports phases:

- `pre-tour`
- `create-playlist`
- `upload-track`

The quick-tour progression is implemented in `App` with `quickTourPhase` and visual highlighting classes.

#### Demo seeding

Demo seeding is first-run onboarding content, not just test data. The code actively repairs and normalizes demo content and may make the demo playlist active for first-run experience.

### Why it exists

The app needs to avoid dropping new users into an empty, inert local player. Demo seeding and guided playlist/upload onboarding provide an immediate usable environment.

### Risks / limitations

- Demo-state logic is more complex than a one-time seed and includes normalization, repair, stale-flag cleanup, and playlist cleanup
- First-run behavior is currently tightly coupled to local flags and demo playlist heuristics

### Verification needs

Because onboarding behavior depends on a combination of runtime library contents and stored flags, it should be validated in a real fresh-install scenario before documenting every exact first-run step as guaranteed behavior.

## 13. Visual / FX Systems

### What it does

Polyplay layers several visual systems over the player:

- theme switching
- aura-related glow/flash
- ambient FX canvas
- safe-tap burst effects
- video artwork
- generated waveform artwork and animation

### Confirmed implementation

#### Themes

Theme state includes:

- `dark`
- `light`
- `custom`

Custom theme slots:

- `crimson`
- `teal`
- `amber`

Theme state changes update document/body classes and CSS custom properties. Aura color can be overridden directly and is derived from custom theme slots when custom mode is selected.

#### Ambient FX

The ambient FX engine supports:

- `gravity`
- `pop`
- `splatter`

It runs on a canvas and responds to pointer events routed through `AmbientFxCanvas`. It has explicit start/stop behavior based on:

- overlay visibility
- app visibility
- reduced motion
- coarse pointer detection

The engine includes:

- quality modes
- internal frame throttling
- object pooling
- optional pop sound

#### Aura visuals

Aura interactions trigger DOM class-based flash/pulse effects in the mini player, fullscreen player, and waveform UI using `polyplay:aura-trigger` events.

### Why it exists

This is one of the product’s differentiators. The app is trying to feel expressive and tactile rather than purely utilitarian.

### CPU / performance considerations

Confirmed performance protections:

- `AmbientFxEngine` resolves quality to `lite` or `high`
- frame throttle is adjusted based on quality and reduced-motion state
- FX stop when the page is hidden
- pointer move listener is skipped on coarse-pointer devices
- reduced-motion and save-data contexts downgrade or disable some behavior
- fullscreen generated-art animation is capped at 30 FPS

Known costs:

- multiple animated layers can coexist
- artwork videos and journal videos use media decoding
- canvas redraw work still exists even with throttling

### Risks / limitations

- The product summary describes three named FX modes as “magnetic dots”, “pop bubbles”, and “paint splatter”; the code names are `gravity`, `pop`, and `splatter`
- There is no evidence in the inspected code of a user-facing master FX quality control in the main app beyond stored `fxQuality`; the UI surface for changing it may live elsewhere or be incomplete

## 14. Performance / CPU Efficiency Considerations

### Confirmed implementation: existing safeguards

The codebase already contains several explicit CPU-conscious protections:

- `App` applies a `perf-lite` body class when the device is small, `prefers-reduced-motion` is set, or the browser reports `navigator.connection.saveData`.
- [`src/fx/ambientFxEngine.ts`](/Users/paulfisher/Polyplay/src/fx/ambientFxEngine.ts) resolves FX quality to `lite` or `high`, caps device pixel ratio to `2`, and throttles its RAF loop:
  - reduced motion: about `40-50ms` frame budget
  - normal mode: about `16ms` desktop and `33ms` mobile
- [`src/components/AmbientFxCanvas.tsx`](/Users/paulfisher/Polyplay/src/components/AmbientFxCanvas.tsx) stops and clears FX when not allowed, and also stops them on `document.hidden`.
- [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx) limits generated-art animation to `30 FPS` and pauses artwork video on visibility changes.
- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) downgrades journal FX behavior for coarse-pointer, reduced-motion, and save-data contexts, and pauses its background video on visibility changes.
- [`src/lib/artwork/videoValidation.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoValidation.ts) rejects artwork videos that are too large, too long, or too high-resolution.
- [`src/lib/artwork/videoPoster.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoPoster.ts) scales poster extraction down on constrained devices.
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts) enforces storage-cap headroom before writing blobs, which indirectly limits pathological large-file behavior.
- [`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts) caches object URLs and provides explicit revoke paths.

These are confirmed implementation details, not assumptions.

### Confirmed hotspots in current code

#### 1. `App.tsx` is a rerender and state-churn hotspot

[`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) owns a very large amount of unrelated state:

- playback state
- loop maps
- overlays/modals
- theme and FX state
- vault status and inspector data
- onboarding flags
- safe-tap burst effects

That means many user actions can rerender the main shell even when only one subsystem changed. This is a confirmed structural hotspot. It is not a confirmed bug, but it is a real performance-sensitive design choice.

Specific churn sources visible in code:

- frequent `localStorage.setItem(...)` writes for UI flags and loop state
- `persistAppStateSnapshot(runtimeLibrary)` serializing playlist and track data on runtime-library changes
- `refreshTracks()` rebuilding visible tracks from storage and resetting related UI state
- FX and onboarding burst state (`safeTapBursts`, `fxToast`, theme animation state) living at the app root

#### 2. Waveform generation and redraws are CPU-sensitive

There are two separate waveform-heavy paths:

- [`src/lib/artwork/waveformArtwork.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/waveformArtwork.ts) decodes full audio blobs with `AudioContext.decodeAudioData()` to build fallback artwork peaks.
- [`src/components/WaveformLoop.tsx`](/Users/paulfisher/Polyplay/src/components/WaveformLoop.tsx) also decodes full audio blobs to build waveform peaks for the loop editor.

This means the same audio file can be decoded more than once in different contexts. That is a confirmed implementation characteristic and a likely CPU hotspot on large files or weaker iOS devices.

`WaveformLoop` also redraws two canvases (`canvasRef` and `decorCanvasRef`) and recalculates dimensions using `getBoundingClientRect()` and `devicePixelRatio` during redraws. The effect is tied to `currentTime`, so playback causes repeated redraw work.

#### 3. Fullscreen generated-art mode is a continuous animation cost

When a track uses auto-generated artwork and no artwork video, [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx) runs a continuous RAF loop that:

- reads layout dimensions
- adjusts canvas backing resolution
- clears and redraws animated bars
- redraws a vignette

This is already throttled to 30 FPS, which is good, but it is still a confirmed continuous CPU/GPU workload while fullscreen stays open.

#### 4. Fullscreen and journal video playback are ongoing decode/render costs

Two separate UI areas can play looping video:

- fullscreen artwork video in [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)
- journal background video in [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)

Both have visibility guards, which helps. The underlying decode/render cost remains a likely battery and thermal hotspot on iOS if used for long sessions.

#### 5. Ambient FX is the main continuous visual FX cost

[`src/fx/ambientFxEngine.ts`](/Users/paulfisher/Polyplay/src/fx/ambientFxEngine.ts) is a custom RAF-driven particle engine with:

- full-screen canvas
- object pools
- attractor logic
- bubble/splat/spark simulation
- optional pop audio

This is intentionally optimized, but it is still one of the clearest CPU-sensitive subsystems in the app. `gravity` mode is especially notable because the app may also attach a `pointermove` listener to feed the attractor on non-coarse devices.

#### 6. Backup/import/export is a burst CPU and memory hotspot

[`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts) performs heavy in-browser work during export/import:

- reads blobs into `ArrayBuffer` / `Uint8Array`
- constructs ZIP file structures in JavaScript
- parses ZIP central directory and entries on import
- reconstructs media blobs for restore
- serializes large JSON payloads for manifests and library data

This is not a constant runtime cost, but it is a confirmed burst workload that can be expensive for large libraries and should be treated as a release-risk area on iOS.

#### 7. Poster extraction and video metadata work are expensive media paths

[`src/lib/artwork/videoPoster.ts`](/Users/paulfisher/Polyplay/src/lib/artwork/videoPoster.ts) creates temporary video elements, seeks through candidate times, draws video frames to canvas, and exports those frames with `canvas.toBlob()`.

This is necessary behavior, but it is a confirmed media-processing hotspot during artwork import and replacement.

### Likely risks rather than confirmed problems

The following are likely risks based on the current code, but they are not confirmed user-visible issues from inspection alone:

#### Repeated audio decoding without peak caching

There is no visible shared peak cache between:

- fallback artwork generation
- waveform-loop UI generation
- fullscreen generated animation peaks

Likely risk:

- the same audio may be decoded multiple times across flows, especially after import, track selection, and fullscreen entry

#### Main-thread contention during large backup or restore

The backup code is synchronous in style around large typed-array and JSON operations. Likely risk:

- UI responsiveness may degrade during large export/import on iPhone hardware, even if it remains functionally correct

#### Root-level visual state causing extra top-level rerenders

`safeTapBursts`, theme animation state, journal toast state, FX toast state, and vault toast state all live in `App`. Likely risk:

- cosmetic state changes may cause more main-tree rerender work than necessary

#### iOS rendering sensitivity

The code explicitly contains Safari/iOS defensive handling in several places:

- unknown duration fallback in loop creation
- reduced-motion checks
- constrained-device video limits
- `playsInline`
- PWA/iOS backup preview fallback

That suggests iOS has already been a source of edge cases. Likely risk:

- video artwork, journal video, and canvas-heavy views will be more sensitive to frame drops or thermal throttling on iOS than on desktop

### Practical optimization targets grounded in current code

#### Priority 1: reduce duplicate audio decoding

Best target:

- introduce a shared peak cache keyed by track ID or persisted blob key, and reuse it across:
  - `WaveformLoop`
  - generated fullscreen animation
  - fallback artwork generation where practical

Why this matters:

- multiple expensive `decodeAudioData()` calls are visible today
- this would reduce both CPU cost and repeated memory pressure

#### Priority 2: split state-heavy visual/transient state out of `App`

Best targets:

- move `safeTapBursts` and related burst logic into an isolated effects component
- isolate vault toasts/import-summary state from playback-critical state
- isolate onboarding animation state from the main playback shell

Why this matters:

- these are transient UI concerns currently sharing the same root component as playback and track selection

#### Priority 3: make waveform canvas redraws cheaper

Best targets:

- avoid recalculating canvas backing size on every draw unless size actually changed
- reduce redraw frequency for waveform visuals tied to `currentTime`
- consider drawing only the moving playhead/progress overlay separately from the full bars

Why this matters:

- `WaveformLoop` currently redraws two canvases and redoes layout-sensitive sizing work during playback

#### Priority 4: tighten continuous animation eligibility

Best targets:

- make fullscreen generated-art animation opt out automatically on constrained devices
- consider disabling or downgrading ambient FX when fullscreen video artwork or journal video is active
- make FX quality selection more explicit if not already surfaced to users

Why this matters:

- the app already has multiple concurrent animation/media systems, and the expensive combination cases are the most likely mobile pain points

#### Priority 5: make backup/import/export more interruption-friendly

Best targets:

- add visible progress states for large export/import operations wherever missing
- chunk long-running backup work more explicitly so the UI can breathe between phases
- test restore/export behavior with near-cap libraries on iOS

Why this matters:

- backup/import is a burst workload that can feel like a freeze even when technically successful

#### Priority 6: review high-frequency persistence writes

Best targets:

- review whether all root-level `localStorage.setItem(...)` calls need immediate write-through
- reduce unnecessary repeated serialization of large app-state snapshots

Why this matters:

- localStorage is synchronous and can contribute to main-thread blocking if overused in hot paths

### Recommended verification work before release

- Profile playback with waveform view open on iPhone-class hardware.
- Profile fullscreen generated-art mode versus fullscreen video-art mode separately.
- Measure export/import time and responsiveness on backups near the current size cap.
- Track whether repeated track switching causes growth in object URL count or retained memory.
- Verify whether journal background video plus active playback plus FX creates noticeable frame drops on iOS.

### Bottom line

Confirmed heavy areas:

- root-level state churn in `App`
- repeated audio decoding / waveform work
- continuous ambient FX
- fullscreen generated-art animation
- looping video surfaces
- large backup/import/export processing

Likely highest-value optimizations:

- shared waveform/peak caching
- splitting transient visual state out of `App`
- reducing waveform redraw cost
- stricter animation downgrades on constrained devices
- profiling and hardening backup/import/export on iOS

## 15. Known Constraints / Current Gaps

### Confirmed limitations

- Loop regions are saved as metadata only. There is no code that exports a loop as a new audio file.
- The core content-management UI still relies on an iframe-based admin/settings surface.
- The library model is entirely local to the browser/app install unless exported.
- Full backup import is destructive with respect to the current blob store.
- The codebase still contains historical naming remnants like `carplay` and `showoff`, which increases cognitive load.

### Inferred technical debt based on code inspection

- `App.tsx` is too broad a responsibility center for long-term maintainability.
- Storage synchronization is complex enough that the product includes internal inspector and “repair” tools.
- Demo/onboarding logic has grown into a non-trivial state machine embedded across startup effects and demo utilities.
- The settings/admin iframe boundary increases complexity for debugging and future UI integration work.

### Product-summary mismatches to resolve

- The summary says individual playlists are not yet independently saved outside the full backup system, but the code includes polyplaylist import/export mechanisms.
- The summary’s playbar and vibe terminology does not always match the exact current code names.

### Items needing verification

- Exact browser and iOS parity for all upload/edit flows
- Public Android readiness
- Whether all intended player control variants are visible in the current shipped UI
- Whether `fxQuality` is fully user-configurable in current UX or only persisted internally/admin-side

## 16. Release Readiness Priorities

### 1. Playback reliability

This is the first release-critical area. The app already has the core machinery, but release confidence depends on stable behavior for:

- track switching
- autoplay handoff after selection
- loop region correctness
- repeat/shuffle correctness
- missing-audio handling
- fullscreen/mini-player parity

Files to watch first:

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/components/MiniPlayerBar.tsx`](/Users/paulfisher/Polyplay/src/components/MiniPlayerBar.tsx)
- [`src/components/FullscreenPlayer.tsx`](/Users/paulfisher/Polyplay/src/components/FullscreenPlayer.tsx)

### 2. Storage and backup integrity

This is the second major release risk. The app’s value depends on user trust that local libraries and backups are safe.

Priority checks:

- import/export of full backup on real devices
- active playlist pointer recovery
- missing-blob detection and messaging
- playlist deletion behavior
- backup restore after factory reset

Files to watch:

- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
- [`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts)

### 3. Performance discipline

The product summary explicitly prioritizes CPU efficiency. The code reflects that concern, but release readiness requires testing rather than assuming those safeguards are enough.

Priority checks:

- low-end iPhone / mobile Safari behavior
- sustained session behavior with FX on
- video artwork cost
- waveform generation cost for long files
- memory cleanup after repeated imports/replacements

### 4. Main-flow UX cleanup

The current app is feature-rich but operationally split between the main shell and the admin iframe. For release readiness, the most important UX question is whether key tasks feel intentional and understandable, especially:

- first-run flow
- playlist creation
- first upload
- vault restore warning
- settings/admin discoverability

### 5. Documentation and terminology cleanup

Before public release, product docs and in-app naming should align with the current implementation. The main cleanup targets are:

- legacy package/storage naming
- “polyplaylist” versus “playlist” language
- player mode terminology
- vault/polyplaylist/gratitude backup distinctions

### Suggested near-term execution order

1. Stabilize playback and storage behavior under real-device testing.
2. Validate full-backup and restore flows end to end.
3. Audit CPU/memory behavior with FX and video artwork enabled.
4. Reduce ambiguity between main app and admin/settings workflows.
5. Update product summary and release docs so they match shipped behavior.

## Release Blocking Checklist

- Playback reliability: play, pause, seek, skip, loop, shuffle, repeat, and track switching behave correctly.
- Import reliability: track upload, artwork replacement, and audio replacement work on desktop and iPhone.
- Vault backup/restore on iPhone: full backup export and restore are usable in Safari and installed-PWA contexts.
- Onboarding correctness: first-run, demo-library, and returning-user states show the right guidance at the right time.
- Performance on older iPhones: fullscreen playback, video artwork, waveform views, and FX remain responsive.
- No obvious UI breakpoints on desktop/mobile: player, overlays, vault, onboarding, and settings remain visually stable.
- App Store polish items: branding, splash/icon behavior, permission messaging, and release-facing fit and finish are acceptable.

## Known Issues / Fragile Areas

This appendix is based on the current implementation and the recent handoff notes in [`march11_2026_devhandoffs/polyplay-dev-handoff-tracker.md`](/Users/paulfisher/Polyplay/march11_2026_devhandoffs/polyplay-dev-handoff-tracker.md).

### Fixed or partially hardened areas

#### Vault export fallback behavior on mobile has been explicitly hardened

Current code in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) now uses a broader save chain in `saveBlobWithBestEffort()`:

- `navigator.share({ files })` when available
- `showSaveFilePicker()` when available
- iOS / standalone-PWA blob preview fallback (`opened-preview`)
- anchor download fallback

This is relevant because the handoff tracker called out iPhone vault export as a known issue. The implementation now clearly contains iPhone/PWA-specific fallback handling, so the export path is more robust than a desktop-only download flow.

This should be treated as hardened, not fully closed. Real-device verification is still needed.

#### Vault feedback is now a toast-style system in the main app

The handoff tracker noted that vault feedback was previously misaligned and inline. Current `App` code uses `vaultToast` state and renders a dedicated `.vault-toast` status element. That is a meaningful implementation improvement over an inline-only status line.

This appears improved in code, but final quality still depends on CSS and real mobile rendering.

### Fragile areas

#### Onboarding phase logic is sensitive to persisted flags and demo-state heuristics

This is the most clearly fragile area in the current code.

Onboarding visibility is derived from multiple interacting conditions in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx), including:

- `hasOnboarded`
- `isEmptyWelcomeDismissed`
- `hasTracks`
- `isInitialDemoFirstRunState`
- demo playlist identity
- presence of demo versus non-demo tracks
- `HAS_IMPORTED_KEY`
- splash visibility and prompt timing

There is additional cleanup logic for stale first-run flags via `isPristineDemoLibraryState`, plus demo normalization and demo-playlist repair in [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts).

This is not necessarily broken today, but it is easy to regress because small changes to:

- onboarding flags
- demo seeding
- active playlist behavior
- import/reset behavior

can suppress or re-trigger onboarding unexpectedly.

#### Mobile versus desktop layout behavior is split across several heuristics

The current code uses device/media-query branching in several places:

- player compact default uses `(min-width: 900px)`
- performance-lite mode uses `(max-width: 900px)`
- constrained media handling uses `(max-width: 820px)` and iOS/Safari checks
- FX pointer behavior changes based on coarse pointer detection
- journal behavior changes for coarse pointer and reduced motion

This is a practical approach, but it means layout and behavior are not controlled by one single responsive model. Small CSS or breakpoint changes can affect:

- player compactness
- FX behavior
- poster generation scaling
- artwork video acceptance
- perceived mobile/desktop feature parity

This should be considered fragile rather than unresolved.

#### Tooltip and render-state coupling still exists in onboarding/admin UI

Tooltip-like guidance in the main app is directly coupled to onboarding render conditions:

- quick-tour state drives whether onboarding tooltips render at all
- playlist-creation guidance is shown inline next to the button only when `quickTourPhase === "create-playlist"`

In the admin/settings app, drop zones and controls still use inline tooltip props and contextual hints. That is not inherently wrong, but it means guidance text is tightly coupled to the same render branches that control interaction state.

This matters because onboarding/help UI is not isolated from main UI state. Reworking onboarding or admin layout can unintentionally remove guidance, highlight states, or tooltips without touching a dedicated tutorial system.

#### Main app and admin/settings coordination is brittle by design

The app relies on cross-window communication between the main shell and the settings/admin iframe using:

- `window.postMessage(...)`
- `window.parent.postMessage(...)`
- `window.dispatchEvent(new CustomEvent("polyplay:library-updated"))`

This pattern is used for:

- upload success
- library refresh
- config import
- factory reset
- gratitude settings updates
- theme and aura updates

This is functional, but it is easy to regress because any change to message names, timing, or refresh behavior can desynchronize the main app from the admin UI.

#### Storage refresh and inspector paths indicate ongoing sensitivity

The runtime includes explicit repair and debug actions in the vault overlay:

- Refresh Library
- Persist Now
- Migrate Legacy Keys
- Hard Refresh Library
- Reload Fallback

Those actions are useful, but they also indicate that library/runtime/storage synchronization remains an area where regressions are plausible.

### Unresolved or still open issues

#### Exact onboarding reliability on real iPhone / PWA state is still not proven from code alone

The handoff tracker specifically calls out iPhone onboarding not appearing as expected. The current code contains several mitigations and cleanup paths, but this remains an unresolved QA concern rather than a confirmed fixed issue.

#### Count-based export/file-limit behavior is still unclear

The handoff tracker notes uncertainty around count-based export restrictions. In the current implementation, the confirmed export guard is:

- byte-size cap in [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
- minimum non-demo track count before full-backup export in `saveUniverseBackup()`

There is no clearly implemented broader count-based export rule beyond those checks. If product expects a more explicit song-count limit or tier rule, that remains unresolved.

#### Mobile vault UX still needs real-device confirmation

Even with the stronger export fallback path and toast handling, mobile vault behavior is still an area that should be treated as open for QA:

- Share Sheet support varies by browser/context
- PWA versus Safari behavior can differ
- preview-based saving on iPhone is functional but less direct than a native save flow

This is not an unresolved code defect, but it is still a release-sensitive area.

### Practical regression watchlist

When changing the app, the following paths deserve targeted regression testing:

- first-run onboarding after factory reset
- demo playlist normalization and onboarding reappearance
- switching between mobile and desktop breakpoints
- vault export from iPhone Safari and installed PWA
- admin iframe actions that rely on `postMessage`
- playlist creation guidance and onboarding tooltip visibility
- library refresh after import, reset, or media replacement
