# 3-18-26 Release Discoveries

## Overview

Today's goal was to prepare Polyplay for iOS App Store submission.

The main outcomes were:
- first-run demo startup was stabilized
- the built-in demo experience was made reliable on iPhone
- lingering onboarding state after Vault import was addressed in `main`
- artwork poster vs video behavior was clarified and patched where needed
- several release-polish UI and interaction issues were tightened without broad refactors

## Major discoveries

- Demo assets were present in the iOS build, but `fetch()` against bundled `/assets/...` URLs inside the Capacitor iOS WebView failed with HTTP `0`.
- Old default `My Playlist` assumptions were still present in storage/startup paths and were interfering with pristine demo-first startup.
- The built-in demo track worked better once treated as a true built-in experience with direct bundled URLs, instead of relying on legacy fetch/blob startup assumptions.
- Non-fullscreen artwork surfaces depend on the saved poster/still image, while fullscreen uses artwork video when present.
- The artwork scrubber bug root cause was narrow: selected frame time was tracked in the UI, but that value was not actually used when saving poster capture.
- Vault import onboarding cleanup logic is already present in `main`; the main app now has a dedicated post-import exit path for fresh-user onboarding state.
- Fullscreen Aura+ lag came from very short fullscreen flash timing plus aggressive retriggering/reflow when tapped rapidly.
## Loop Marker latency discovery
- Main bottleneck is not primarily waveform drawing
- Biggest issue: loop marker drag currently updates app state and writes loop data to localStorage on every drag tick
- This likely causes major latency, especially on iOS WebView
- Secondary contributors:
  - broad player rerenders
  - waveform redraws
  - fullscreen artwork video still rendering during marker editing
  - repeated getBoundingClientRect during drag
- Best first optimization:
  - keep drag updates in memory
  - persist loop state only on drag end
- Best second optimization:
  - pause fullscreen artwork video during active marker editing
## Fixes completed

- Demo track now works in Demo Playlist on fresh launch.
- Demo still artwork was added so non-fullscreen artwork surfaces render correctly.
- Demo track title was updated to `Welcome to Polyplay v1`.
- App header text was updated to `Polyplay v1.0.0`.
- One-time onboarding glow hints were added for playbar artwork, minimize, Vibe, and DIM.
- Desktop toasts were styled to better match iOS.
- Create Polyplaylist Enter/Return handling was fixed.
- Next-track-on-ended behavior was fixed when repeat is off.
- Journal UX fixes were completed, including the iPhone edit-height fix.
- Debug/Vault clutter was reduced for release.
- Aura+ fullscreen flash timing was smoothed.

## Cross-platform notes

- Most of the startup, onboarding, playlist, poster, and hint-state fixes are shared across desktop and iOS because they live in shared React/storage logic.
- The demo asset loading failure was especially iPhone/iOS-sensitive because the Capacitor WebView could not reliably `fetch()` bundled asset URLs even though the assets were present in the build.
- The built-in direct-URL demo-track strategy is shared across desktop and iOS and avoids that iOS-specific failure mode.
- Poster-vs-video artwork behavior is shared across platforms: still artwork drives normal UI, video artwork drives fullscreen.
- Fullscreen Aura+ tuning affects both platforms, but the feel issue was especially noticeable on iPhone.

## Remaining follow-up

- Keep an eye on any future bundled-media assumptions in the iOS WebView.
- If more submission polish time appears, do a final sanity pass on fresh install, Vault import, and imported video-artwork behavior on physical iPhone hardware.

## Guardrails / don't break this again

- Do not reintroduce a default `My Playlist` on pristine startup.
- Do not route built-in demo UX back through fragile legacy startup assumptions.
- Preserve the poster-vs-video artwork separation.
- Be cautious with iOS WebView asset-access assumptions, especially around bundled media URLs.
- Keep onboarding hints lightweight, one-time, and persistence-backed.
