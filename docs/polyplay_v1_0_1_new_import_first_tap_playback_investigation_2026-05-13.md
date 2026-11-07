# PolyPlay v1.0.1 Investigation - New Import First Tap Playback

Date: 2026-05-13

## Bug

On a fresh app install / factory reset flow, after importing a new track, tapping the newly imported track tile once does not reliably start playback.

Observed user behavior:

- User taps the new track tile once.
- UI briefly looks like playback started.
- Play button changes to pause briefly.
- Waveform populates.
- Timecode may update.
- Playback then stops / settles paused.
- A second tap or manual play button may be required.

Expected:

- Newly imported tracks should behave like existing tracks.
- First tap on tile/row should select, load, and play immediately.

## Confirmed Flow

- Track tile and row both call the same parent handler:
  - `TrackGrid -> onSelectTrack -> playTrack(trackId, true)`
- Import completion path:
  - Admin import writes the track via `addTrackToDb(...)`.
  - Admin posts `polyplay:import-complete` or `polyplay:user-imported`.
  - Parent handles the message and calls `refreshTracks()`.
- `refreshTracks()`:
  - Reloads the library source of truth.
  - Hydrates visible playlist tracks.
  - Updates `allTracksRef`, `tracks`, and `runtimeLibrary`.
  - May auto-select the first visible track if there is no current track.
- The audio element is a single `<audio ref={audioRef} preload="metadata" playsInline />`.
- Actual playback is controlled through `playTrack()`, pending autoplay refs, and audio element event listeners.

## Related Local Fix Attempts

These changes are in the working tree at the time of this note and are not yet committed/pushed unless explicitly committed later.

### Attempt 1 - Same Current Track Missing Media

Problem suspected:

- A newly imported track can become `currentTrackId` before playback media hydration finishes.
- First tap then enters the "same current track" path.
- `resumeCurrentTrackPlayback()` returns early if `currentTrack.audioUrl` is missing.

Attempted fix:

- In same-track tap path, if playable but `currentTrack.audioUrl` is not ready:
  - mark pending autoplay
  - refresh current track media
  - later changed to directly assign/play the refreshed audio URL

Result:

- Did not resolve the user-reported fresh install case.

### Attempt 2 - Prehydrate Visible Audio URLs

Problem suspected:

- Visible tracks were hydrated with artwork URLs but not audio URLs:
  - `includeAudioUrl: false`
- On iOS, loading an audio object URL after the tap might miss the user activation window.

Attempted fix:

- Changed visible playlist hydration to include audio URLs:
  - `includeAudioUrl: true`

Result:

- Did not resolve the user-reported fresh install case.

### Attempt 3 - Avoid Broad Media URL Revocation

Problem suspected:

- Playback repair used broad `forceUrlRefresh`, which revoked audio and artwork object URLs.
- This also explained a separate intermittent artwork disappearance bug.

Attempted fix:

- Added narrower media refresh options:
  - `forceAudioUrlRefresh`
  - `forceArtworkUrlRefresh`
- Playback repair now refreshes audio URLs without revoking artwork URLs.

Result:

- Likely still useful for artwork stability.
- Did not resolve first-tap playback.

### Attempt 4 - Remove Pre-Play `audio.load()` From User Resume Path

Problem suspected:

- `resumeCurrentTrackPlayback()` called `audio.load()` immediately before `audio.play()`.
- On iOS this may reset the media element right around the play attempt.

Attempted fix:

- Removed immediate pre-play `audio.load()` calls from the user-initiated resume path.

Result:

- Did not resolve the user-reported fresh install case.

## Current Working Hypotheses

### Hypothesis 1 - Another Pause Path Fires After Successful Play

The UI briefly changes to pause, waveform/timecode populates, then playback stops. That means `audio.play()` may resolve or at least emit `play`, then a later event sets `isPlaying(false)`.

Possible stop paths:

- `pause` event listener:
  - `onPause = () => setIsPlaying(false)`
- `error` event listener:
  - `onError = () => setIsPlaying(false)`
- `ended` event listener:
  - could trigger if duration/currentTime state is wrong or extremely short
- `effect:no-src` path:
  - if `currentAudioUrl` temporarily becomes null
- `switch-src` path:
  - if current track media changes immediately after play starts
- teardown path:
  - `teardownCurrentAudio()` clears source and sets paused state

Next diagnostic:

- Enable `polyplay_debugAudio` and capture the event order on device:
  - `play() called`
  - `play() resolved/rejected`
  - `pause`
  - `error`
  - `ended`
  - `effect:no-src`
  - `switch-src`
  - `teardown:start`

Need to add richer event logging for `pause`, `error`, and `ended` if existing logs are insufficient.

### Hypothesis 2 - Notification Sound Steals / Interrupts First Playback

On import completion, parent plays `/hyper-notif.wav`:

```ts
const audio = new Audio("/hyper-notif.wav");
audio.volume = 0.85;
void audio.play();
```

This happens right after import completion. On iOS WebView, that separate audio element may interact badly with the main playback element, especially on a fresh install/import flow.

Why plausible:

- Bug is specific to newly imported track immediately after import.
- User sees main playback try then stop.
- A separate notification audio element may still be active or recently active.

Next test:

- Temporarily disable import success notification sound.
- Retest fresh install -> import -> first tap.

If fixed:

- Replace notification audio with haptic-only or gate it behind non-iOS/browser-only behavior.

### Hypothesis 3 - Settings Iframe / Import Overlay Close Race

After import:

- Parent receives import complete.
- Parent closes Settings overlay.
- Parent refreshes tracks.
- New tile appears.
- User taps shortly after overlay close.

Possible issue:

- The app may still be settling, with pending refresh/effects changing current track/media just after the user taps.
- `refreshTracksRequestSeqRef` guards stale refreshes, but does not prevent a legitimate late refresh from overwriting current media around first play.

Next test:

- Log `refreshTracks()` start/end sequence around import and first tap.
- Log `currentTrackId`, `currentAudioUrl`, and `audioSrcRef.current` before/after first tap.

Potential fix direction:

- Do not auto-select first track during refresh after import if there was no previous current track.
- Let the first user tap be the first call that sets `currentTrackId` and pending autoplay.

This may be cleaner than preselecting the new imported track.

### Hypothesis 4 - Auto-Selecting First Track Causes Same-Track Branch Trouble

Current refresh behavior:

```ts
setCurrentTrackId((prev) => {
  if (prev && allTracksById[prev]) return prev;
  if (prev) teardownCurrentAudio();
  return hydratedLoaded[0]?.id ?? null;
});
```

On fresh install after import:

- `prev` is null.
- `hydratedLoaded[0]` is the newly imported track.
- New track becomes current before user taps.
- First tile tap uses same-track resume behavior instead of the more reliable "switch track" play path.

This may be the core design issue.

Possible fix direction:

- Change `refreshTracks()` so it does not auto-select a track when `prev` is null.
- Only auto-select first track for old paths that truly require a current track, such as demo/initial library restoration if needed.
- On first user tap, `playTrack()` would always go through the switch-track path:
  - teardown
  - pending autoplay
  - set playback playlist
  - set current track

Risk:

- Some UI may expect `currentTrack` to exist when tracks exist.
- Need to inspect onboarding/demo/player bar behavior before changing.

### Hypothesis 5 - First Imported Audio File Type / Metadata State

The issue may occur more often with specific imported formats, especially `.mov`, `.mp4`, or files whose duration metadata is slow to become available.

Why plausible:

- Waveform/timecode changes suggest metadata arrives, but playback stops.
- If duration is initially 0 or malformed, ended/loop logic might misfire.

Next test:

- Reproduce with:
  - small MP3
  - WAV
  - M4A
  - MOV
- Compare event logs and duration values.

### Hypothesis 6 - AudioContext / Gain Routing Interaction

`ensurePlaybackGainRouting(true)` is mostly a no-op on iOS except it tears down any gain routing and applies dim mode. Still, it runs before play attempts.

Next test:

- Temporarily bypass `ensurePlaybackGainRouting(true)` for the first imported track tap.
- If fixed, inspect whether audio context teardown or dim mode application causes a pause/reset in iOS WebView.

## Suggested Next Debug Pass

Do not continue speculative fixes without device logs.

Add temporary debug logging for:

- `playTrack()`:
  - `trackId`, `currentTrackId`, `autoPlay`, `canPlay`, `currentTrack.audioUrl`, `selectedTrack.audioUrl`
- audio element before and after play:
  - `paused`, `ended`, `readyState`, `networkState`, `currentTime`, `duration`, `currentSrc`
- audio events:
  - `play`
  - `playing`
  - `pause`
  - `waiting`
  - `stalled`
  - `suspend`
  - `abort`
  - `emptied`
  - `error`
  - `ended`
- refresh lifecycle:
  - `refreshTracks:start/end`
  - request sequence
  - `currentTrackId` before/after
  - first hydrated track id and whether it has `audioUrl`

## Strong Candidate Fix To Try Later

Stop auto-selecting `hydratedLoaded[0]` in `refreshTracks()` when `prev` is null.

Reason:

- This would make a newly imported tile’s first user tap use the normal new-track path rather than the same-track resume path.
- It reduces hidden state transitions after import.
- It aligns better with the expectation that user selection triggers playback.

Needs careful QA:

- Fresh install with demo tracks.
- Empty library welcome.
- Existing library on app launch.
- Import first user track.
- Restore vault.
- Current track persistence after app reload.

## Current Local Status At Time Of Note

Known local code changes in progress:

- `src/App.tsx`
  - visible track hydration includes audio URLs
  - same-track missing-media direct refresh/play path
  - audio repair uses audio-only refresh
  - removed pre-play `audio.load()` in resume path
- `src/lib/db.ts`
  - split force media refresh options so audio refresh does not revoke artwork URLs

These changes should not be treated as confirmed fixes for first-tap playback until device logs prove the stop path.
