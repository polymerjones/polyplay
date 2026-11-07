# PolyPlay 2.0 — Phase 1 Audit (2026-11-07)

Static code read of `main` @ `cbf0bd4` (v1.0.8). **No code changed.** Everything here comes from reading the source. None of it has been profiled on a device yet, so items marked *needs measurement* are suspected costs, not confirmed ones.

---

## 1. Architecture map

| Layer | Where | Notes |
|---|---|---|
| Shell | Vite + React 18 + Tailwind, wrapped by Capacitor 8 (iOS + Android) | `capacitor.config.ts` is minimal (no plugins configured beyond defaults) |
| Main app | `src/App.tsx` — **6,299 lines, 87 `useState`, 64 `useEffect`, 75 `useRef`, 37 `addEventListener`** | Playback, loop regions, FX, onboarding, import, vault, layout, splash, and tips all in one component |
| Admin / library management | `src/admin/AdminApp.tsx` — 4,269 lines | Separate entry (`admin-main.tsx`) |
| Library metadata | `localStorage["showoff_library_v1"]` via `src/lib/storage/library.ts` | On load, scans **every** localStorage key looking for library-shaped JSON (`library.ts:173-215`) |
| Media blobs | IndexedDB `showoff_db` (`src/lib/storage/db.ts`), plus legacy `carplay_app` migration (`src/lib/db.ts:54, 330`) | Audio, poster, gif, and video stored as blobs |
| Waveform peaks | `localStorage` JSON cache (`waveformArtwork.ts:23-59`) + in-memory `runtimeWaveformPeakCache` | The whole cache is re-parsed from JSON on each read |
| Backup / vault | `src/lib/backup.ts` (1,826 lines) | Zip export/import. **2.0 must stay compatible with existing vault files.** |
| Native | `ios/App/App/NowPlayingPlugin.swift`, `PolyplayBridgeViewController.swift`; `UIBackgroundModes: audio` | Lock-screen controls go through `src/lib/mediaSession.ts` and the native plugin |
| Other settings | ~89 distinct `localStorage` keys | Settings are scattered across these keys with no single settings store |

### Audio path
- Playback runs through **one `<audio preload="metadata">` element** (`App.tsx:6260`). This is good: native decoding, background-safe.
- There used to be a Web Audio gain graph (`playbackAudioContextRef`, `App.tsx:745`). It's effectively retired: `ensurePlaybackGainRouting` (`App.tsx:3043`) no longer creates a context, and dim/mute uses `audio.volume`/`muted`. So **no AudioContext runs while music plays.** Remove the dead teardown code once that's confirmed.
- `timeupdate` → `commitUiCurrentTime` (`App.tsx:2640`) is throttled, but each commit still sets state on the root component, which **re-renders the entire 6.3k-line App tree** several times per second during playback.

---

## 2. Continuous work inventory, by operating state

States: **A** = playing, screen on · **B** = playing, screen locked/backgrounded · **C** = paused, visible · **D** = idle, nothing happening

| # | Source | Mechanism | Gated by | A | B | C | D | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | `BubbleLayer.tsx:84-104`, mounted `App.tsx:5298` with **`paused={false}` hardcoded** | rAF + **React `setBubbles` every 33ms** | only `bubblesEnabled` and reduced-motion | runs | runs if the WebView isn't suspended | **runs** | **runs** | 🔴 Top suspect. About 30 React renders/sec forever, even with zero bubbles on screen |
| 2 | `ambientFxEngine.ts:756-767` via `AmbientFxCanvas` | rAF every frame, throttled update/render | `fxAllowed = isMainPlayerView && !isNuking && fxEnabled && isPageVisible` (`App.tsx:5120`) | runs | stops ✅ | **runs** | **runs** | 🟠 Correctly stops when hidden, but never idles while visible and nothing is moving |
| 3 | `FullscreenPlayer.tsx:280-349` | rAF with frame budget | `shouldAnimateGenerated` | runs when fullscreen | ? | check | n/a | 🟡 Check whether it gates on `isPlaying` |
| 4 | Root re-render from `currentTime` | `timeupdate` → `setCurrentTime` | playing | runs | runs (JS stays alive with background audio) | – | – | 🟠 Structural. Only the progress UI should re-render |
| 5 | `WaveformLoop.tsx:709-781` | canvas redraw on every `currentTime` change | playing | runs | runs (offscreen) | – | – | 🟡 Probably cheap per frame but frequent. Skip when hidden |
| 6 | CSS `infinite` animations (`player.css` ×10: mute pulse, fullscreen hint, loop handle/thumb pulse, cinema visualizer) | compositor | class presence | – | – | depends | depends | 🟡 Some may sit on idle screens. `pc-art-fullscreen-hint` is the likeliest |
| 7 | 16× `backdrop-filter` in `index.css` | GPU blur re-composited on any change below it | always | ✓ | – | ✓ | ✓ | 🟡 Expensive when stacked over animated canvases (items 1+2) |
| 8 | `ControlsVisualizer.tsx` | rAF every frame, resizes the canvas every frame | **nothing imports it** | – | – | – | – | ⚪ Dead code. Delete |
| 9 | One-shot rAFs (`App.tsx:1863, 1949, 2398, 3630, 4855, 5232`) | layout measurement | events | – | – | – | – | ✅ Fine |
| 10 | `setInterval` | only the vault-import close poll (`App.tsx:1651`) and admin nuke timers | modal open | – | – | – | – | ✅ Fine if cleared (verify) |

**Battery likely comes down to #1 + #2 + #7 together on an idle visible screen,** with #4 adding cost during playback. That still needs confirming on a device.

---

## 3. Import pipeline

- Entry points: `<input type="file">` in `App.tsx:5991, 6014` and `AdminApp.tsx:3796, 3807`. **No drag-and-drop handlers and no `webkitdirectory`.**
- `addTrackToDb` (`db.ts:543`) requires an active playlist (`IMPORT_REQUIRES_PLAYLIST_MESSAGE`), generates poster art, and writes blobs to IndexedDB.
- **Memory risk:** `buildPeaksFromAudioBlob` / `generateWaveformArtwork` (`waveformArtwork.ts:80`) run `decodeAudioData` on the **entire file**. A 5-minute stereo 44.1 kHz track decodes to about 100 MB of Float32 PCM. Importing several large files in a row on iOS risks WebView memory kills. That's a plausible link to past "import then first tap" playback bugs (see `docs/polyplay_v1_0_1_new_import_first_tap_playback_investigation_2026-05-13.md`). `cropAudio.ts:60` does the same.
- Metadata: `music-metadata-browser`.
- No duplicate detection was found.

---

## 4. Ranked recommendations

### Quick wins (low risk, candidate for a v1.0.9)
1. **BubbleLayer:** pass a real `paused` (`!isPageVisible || !isPlaying || !isMainPlayerView`), stop the loop when `bubbles.length === 0`, and restart it on spawn. *Biggest expected win.*
2. **AmbientFxEngine:** sleep when there are no active particles and it isn't playing. Wake on play, tap, or theme change. Add `isPlaying` to the engine's gating.
3. **Delete `ControlsVisualizer.tsx`** and the dead Web Audio gain teardown.
4. **Pause infinite CSS animations** when the page is hidden (e.g. a `body.is-hidden *{animation-play-state:paused}` class toggled from the existing visibility state).
5. **WaveformLoop:** skip redraws while `document.hidden`.

### Structural (2.0 work, after quick wins)
6. **Split `App.tsx`.** Extract a `PlaybackProvider`/store that owns the `<audio>` element, time, loop, and media session. Move `currentTime` into a subscription only the progress bar and waveform read, so the root stops re-rendering during playback.
7. **FX controller.** One module owns the four operating states and exposes `fxLevel: Auto | Full | Minimal | Off`. Bubbles, ambient FX, and CSS animations all read from it.
8. **Settings store.** Consolidate the ~89 localStorage keys into one versioned settings object. Move library metadata and the peak cache into IndexedDB, and drop the "scan all keys" recovery once it's migrated.
9. **Import pipeline.** Queue imports one at a time with progress. Compute peaks with a streaming or downsampled decode, or defer them until first view. Add duplicate detection (size + duration + title hash). Add drag-and-drop for web/desktop. On iOS, add the Files picker plus an "Open in PolyPlay" document type (needs `Info.plist` `CFBundleDocumentTypes`).
10. **Library-first home + persistent mini-player.** Only after #6, since `MiniPlayerBar.tsx` already exists and should become the default surface.

### Must not break
- Vault zip format (`backup.ts`) and legacy `carplay_app` migration
- Background audio and lock-screen controls (`NowPlayingPlugin.swift`)
- Loop regions, threepeat, crop workflow, journal and gratitude data

---

## 5. Measurement protocol (before and after any change)
- **iOS:** Xcode → attach Safari Web Inspector → Timelines (JavaScript + Rendering + CPU). Plus Xcode Debug Navigator → Energy Impact.
- **Android:** Android Studio Profiler → CPU + Energy. `chrome://inspect` → Performance.
- Capture 60 seconds in each of the states **A, B, C, D**, with FX on and off. Record average CPU %, frames/sec of rAF, and React commits/sec (React DevTools profiler in a web build).
- Pass criteria: in D, **zero rAF callbacks and zero React commits**. In C, the same unless the user is touching the screen. In B, no canvas or FX work.

---

## 6. Methodology notes from Apple's performance and power session (2026-10-29)

Source: `~/poly_oracle/apple dev conference notes 10-29-26/`. PolyPlay runs as a web page inside the native app, so Apple's web-page guidance (the "Señor Crabb" mapping in the notes) fits better than the SwiftUI and Metal advice.

**Rules we adopt**
- **Reproduce first.** Record a baseline, reproduce the problem, fix one thing, re-record, and compare. A fix isn't done until the re-recording proves it.
- **Measure on a real device with a Release build.** The Simulator is only good for "better or worse" comparisons.
- **Work that repeats every frame raises the power floor.** Throttling inside a rAF loop still wakes the CPU on every display frame. The real fix is to *not schedule* the frame when nothing is changing (applies to §2 items 1 and 2).
- **The "cat's tail" lesson.** A small animation on an otherwise still screen keeps the display redrawing at full rate. In PolyPlay that means the `infinite` CSS pulses (§2 item 6). Pause them when the page is hidden or idle, and limit the fullscreen hint to a few cycles.
- **Never spin-wait.** Polling `setInterval`s should become event-driven where possible (`App.tsx:1651`).
- **Memory spikes.** Full-file `decodeAudioData` (§3) is the prime candidate. Waveform peaks and auto-posters can be rebuilt, so treat them as cache, not backup-critical data.
- **Brightness costs power.** Keep full-screen bright flashes (Aura flash) short, and let the FX Minimal/Off settings turn them off.

**Tool mapping for PolyPlay**

| Question | Tool |
|---|---|
| Which JS is running? (Instruments can't show JS call stacks) | Safari Web Inspector → Timelines, attached to the iOS app's web view |
| What is redrawing? | Web Inspector **Paint Flashing** (the web version of Xcode's Flash Updated Regions) |
| How much power does each subsystem use (CPU/GPU/Display)? | Instruments **Power Profiler** |
| Long sessions with the screen locked (state B) | On-device trace: Settings → Developer → Performance Trace → add PolyPlay → Power Profiler; start/stop it from Control Center |
| Data from real users | Xcode Organizer → Energy reports (Apple's suggested first stop); Play Console Android vitals |
| Labels on the timeline | `performance.mark`/`measure` around import, waveform decode, library load, plus marks for operating states A/B/C/D (the web version of Apple's State Reporting) |

**Later, optional:** a MetricKit Capacitor plugin (following the `ios/App/App/NowPlayingPlugin.swift` pattern) for daily hang, energy and memory reports from real users.

**Not applicable:** SwiftUI and Equatable fixes, the Metal/GPU debugger, location, `CAFrameRateRange` (no web equivalent; the web lever is not scheduling frames), and XCTest performance tests.
