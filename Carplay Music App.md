# Carplay Music App

## One‑Line Summary
A CarPlay‑friendly music review web app that lets creators safely audition new mixes while driving, with big visual tiles, quick controls, and lightweight feedback.

## Problem
As a producer, I frequently AirDrop 32‑bit WAV mixdowns to my iPhone. Browsing them in the Files app while driving is unsafe and slow. A paid app I tried (~$10/month) partially solved this, but the subscription cost is not worth it.

## Goals
- Make it safe and fast to audition new mixes while driving.
- Provide a clean, artistic, highly readable interface with big buttons and clear feedback.
- Allow fast replacement of source audio files when new versions are exported.
- Keep it affordable (no subscription).

## Core Concept
- A playlist is centered on **one project or song set**.
- Each song is represented by a **large artwork tile** (uploadable and replaceable).
- Tapping a tile opens a **simple player overlay** with big controls.
- Quick skip buttons: `-30s`, `-10s`, `+5s`, `+10s`, `+30s` (configurable).

## CarPlay‑First UI Principles
- Big, colorful, high‑contrast buttons.
- Minimal text, obvious visual affordances.
- Immediate visual feedback on tap.
- Optional haptic feedback (future).
- Fluid/water ripple tap animation.

## Feature Ideas
### Listening & Navigation
- Fast tile grid for selecting songs.
- Large play/pause and skip controls.
- “Now Playing” pop‑up/overlay with minimal controls.

### Replacement Workflow
- Replace audio source files quickly (drag‑drop / upload to overwrite).
- Optional backup versions per song (previous mix preserved).

### Feedback & Sharing
- Tap‑to‑build “aura” rating system (no stars).
- Each tap adds energy; hundreds of taps can intensify aura.
- Visual glow/heat on tiles scales with aura level.
- Shareable links so friends can stream and vote.

### Notes While Driving
- Voice dictation to attach quick notes to a song.
- Option for text‑to‑speech readback of notes.
- Notes stored per song/version.

### Siri / Hands‑Free
- Siri integration to play next/previous, play a named song, or record a note.
- Voice‑only mode to minimize screen interaction.

## Two Product Variants (Future)
1. **Creator/Producer Reviewer**
   - Focused on private listening, versioning, and notes.
2. **Artist Distribution / Listener**
   - Public sharing and light community feedback.

## Non‑Goals (For V1)
- Full social network features.
- Heavy analytics or complex subscriptions.

## V1 Scope (Proposed)
- Web app optimized for mobile/CarPlay style layouts.
- Tile‑based library with artwork upload.
- Simple player overlay with skip controls.
- Upload/replace audio files quickly.
- Basic note capture (text or voice‑to‑text).

## Feasibility Decision
We will **avoid App Store and CarPlay restrictions** and build a **mobile‑first web app (PWA optional)** that feels CarPlay‑like but runs in the browser.

## Visual Style Spec (Draft)
### Design Tone
- Bold, friendly, clean, and minimal—like early Apple simplicity.
- Large touch targets and calm motion; avoid busy UI.

### Color & Glow System
- Primary background: deep charcoal or midnight blue.
- Tile background: artwork‑driven; add a subtle dark vignette.
- Glow intensity reflects rating:
  - Low: faint rim glow (static).
  - Medium: soft pulse (slow).
  - High: warm bright pulse with a gentle bloom.
- Glow color: derived from artwork (dominant color) or user‑selected accent.
 - Aura system: tap anywhere on artwork to “charge” the glow; longer‑term accumulation, not 1‑click stars.

### Typography
- One primary font, large sizes for readability.
- Track title: 20–26px.
- Controls: 18–22px with high contrast.

### Motion
- Tap ripple: 200–350ms “ink” burst from touch point.
- Tile focus: slight scale up (1.02x) on touch.
- Glow pulse: 2.5–4s loop for top‑rated tracks.

### Layout
- Grid of 2–3 tiles across (phone), 3–4 (tablet).
- Always keep the Now‑Playing bar visible at bottom.

## Prototype Plan (Lightweight)
### Screen 1: Library Grid
- Large artwork tiles.
- Rating glow indicator.
- Quick search/filter hidden by default.
- Tap tile to play.

### Screen 2: Now Playing Overlay
- Full screen or bottom sheet.
- Giant play/pause.
- Skip buttons: `-30`, `-10`, `+5`, `+10`, `+30`.
- “Add note” button (voice or text).

### Screen 3: Upload / Replace
- Drag‑drop zone.
- Replace existing version or add new version.
- Optional “Keep previous” toggle.

### MVP Interaction Flow
1. Open Library Grid.
2. Tap a tile (ink ripple).
3. Now Playing overlay appears.
4. Skip around and rate.
5. Add quick note.

## Wireframe (ASCII)
```\n+------------------------------------------------------+\n| Carplay Music App                                    |\n| Tap tiles • Tap artwork to build aura                |\n+------------------------------------------------------+\n| [ ART ]  [ ART ]  [ ART ]                            |\n| Neon     Midnight  Glass                             |\n|                                                     |\n| [ ART ]  [ ART ]  [ ART ]                            |\n| City     Nightglass Ruby                             |\n+------------------------------------------------------+\n| Now Playing: Neon Drive (Mix v12)                    |\n| [-30] [-10]   [ PLAY ]   [+10] [+30]                 |\n| [ Add Note ]            [ Aura + ]                   |\n+------------------------------------------------------+\n```\n+
## Workflow (How It Should Feel)
1. Export new mix on laptop/desktop.
2. Drag into web app (auto replaces or adds new version).
3. Tap large tile in car.
4. Quick skip buttons to review sections.
5. Record a quick note (voice or tap).

## Idea Inbox (Drop New Notes Anytime)
- [ ] 

## Open Questions
- Should the initial version be a PWA (installable web app) or native iOS app?
- How should versioning work (auto overwrite vs. keep a timeline)?
- Best low‑cost hosting/storage approach for large WAV files?
- Minimum viable Siri shortcut set for V1?
