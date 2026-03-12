# Polyplay Notes — March 12, 2026

Good morning. Polyplay is getting very close to feeling like a polished, professional, fluid product, and I’m excited about where it is right now.

Today, I want help using Codex to tackle bug fixes, feature additions, cosmetic improvements, and most importantly, CPU efficiency. I want Polyplay to remain lightweight, responsive, and smooth at all times. I do not want it to become CPU-heavy, laggy, or delayed.

## Product Overview

Polyplay is not a traditional streaming app. It is designed to function completely offline and independently.

The original goal of Polyplay was to create a fast, intuitive software experience that allows users to quickly import and listen to audio files from their own device in a modern, visually engaging environment. That could include anything from a rapper’s new mixtape, to a comedian’s stand-up set, to meditation audio from a yoga instructor.

The app is meant to make personal media playback simple, enjoyable, and beautiful. It is designed to be fast, foolproof, visually stimulating, and highly customizable.

## Current Core Experience

At this stage, Polyplay is already working extremely well and feels like a dream come true in many ways.

Users can currently import audio from both audio files and video files stored on their device. They can also import and replace custom artwork for tracks. If a user uploads a video file as artwork, that video will loop during audio playback in fullscreen mode. The app also includes a frame picker, allowing the user to choose a still image from the video to use as the artwork in the smaller player views.

The player supports user-created playlists and offers two track display modes: tile view and row view, depending on user preference.

The playbar includes three display modes:
- Minimal
- Waveform
- Fullscreen

Fullscreen mode is accessed by tapping the album art on the playbar. Minimal and waveform modes are accessed using the minimize/maximize button in the right corner of the playbar.

## Playback Features

Polyplay is built to provide a smooth, low-friction playback experience. The playbar includes large, easy-to-press controls designed for speed and simplicity.

Users can:
- Shuffle a playlist
- Repeat a track
- Skip backward or forward by 10 or 30 seconds
- Dim audio volume with the DIM button
- Press DIM again to enter full MUTE mode

There is also a Vibe button on the playbar that cycles through three creative background variations.

One of Polyplay’s more unique features is its loop system. In fullscreen player mode, users can set in and out markers to create savable audio loops using the Set Loop button. These loops are “saved” in the sense that the app remembers and recalls them later, but they are not currently exportable as new audio files.

## Aura System

Tracks also include an Aura system, which functions as a visual favorite/rating system.

Aura ranges from 1 to 10. When a user is really enjoying a track, they can press Aura+, and that track flashes while its Aura increases by one point. As the Aura value increases, the visible glow around the track becomes progressively larger and more intense.

This system serves two purposes:
1. It gives the user a strong visual reference for preferred tracks
2. It increases the likelihood that high-Aura tracks will appear in shuffle mode

Aura color can also be customized in Settings.

## Visual / Interactive Experience

Polyplay is meant to be more than just an audio player. It is intended to feel immersive and creatively satisfying.

The app currently includes three FX modes that act almost like a fidget-toy layer for the user:
- Magnetic dots
- Pop bubbles
- Paint splatter

These interactive visual modes add personality and help make the app feel alive.

Overall, Polyplay offers a fast and visually stimulating offline environment where users can play audio files alongside customized artwork and creative motion.

## Media Management and Backup

Users can:
- Replace artwork and audio files in the Settings menu
- Rename tracks
- Rename playlists
- Delete playlists
- Add new playlists
- Choose the active playlist from the main page dropdown or from within Settings

At the moment, individual playlists are not yet saved independently outside the full backup system, but the app does support a Vault backup system.

Vault creates a ZIP backup that includes:
- Playlists
- Media files
- Aura settings
- Light mode settings
- Saved loops
- Journal data
- Other app data needed to restore the user’s environment

This ZIP can be imported into a factory-reset install of the app.

A helpful way to describe Polyplay is this: it allows a user to build a personalized offline audio streaming frontend using their own files. In that sense, it gives users a way to organize and experience their private audio library like a custom offline streaming service.

## Gratitude Journal

In addition to being a custom offline media player, Polyplay also includes a unique Gratitude Journal feature.

Each day when the app opens, the user is prompted with:
**“What are you grateful for?”**

This prompt is skippable and can also be disabled.

Responses are stored in the Gratitude Journal, which is accessed through the notepad icon in the menu bar.

The journal is designed to feel peaceful and reflective. It features:
- Amber-glowing visuals
- A rotating Bible verse system stored directly in the app
- A calm, solitary atmosphere

Within the Gratitude Journal, users can:
- Create entries
- View entries
- Edit entries
- Delete entries

Journal entries are also included in Vault backup, and the journal has its own dedicated export/import support as well.

It is also worth noting that audio playback continues uninterrupted if the user navigates into the Gratitude Journal while listening.

This feature could potentially function as an audio notes or reflective notes system if the user chooses.

## Current Product Position

As of today, Polyplay already includes:
- A fast, no-BS offline audio playback system
- Media customization, playlist management, and Vault backup tools
- An immersive and highly customizable visual experience
- Note-taking and journaling functionality
- Interactive visual/fidget activities

That covers most of the current product.

## Current Focus

Right now, the app mainly needs refinement.

There are still minor tweaks and polish items needed across both:
- Desktop browser
- iOS app

My goal is to make sure everything works properly, feels smooth, and performs efficiently.

I have many ideas for future features and expansion, but the current priority is getting the existing feature set polished and reliable. Once the current functionality is working perfectly, that will give me the green light to prepare Polyplay for its first public release on the Apple App Store and Google Play Store.
