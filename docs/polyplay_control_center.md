# PolyPlay Control Center

## 🎯 Current Mode
Stabilization / Release Polish

Rules:
- no new features
- no broad redesign
- one task at a time
- diagnosis first for risky issues
- prefer containment over cleverness
- do NOT auto-commit

---

## 🚨 MAJOR BUGS (Release Blocking)

### 1. Shuffle not functioning (iOS)

Observed behavior:
- Shuffle toggle does not affect Next track behavior
- issue reproduces after vault import and after factory reset on fresh playlists

Diagnosis:
- shuffle candidate selection still depends on pre-hydrated audioUrl
- lazy hydration moved playable readiness to persisted availability (hasAudioSource)
- shuffle path disqualifies valid tracks and falls back to linear order

Status:
- diagnosed
- ready for implementation

### 2. Playlist navigation / playback context mismatch
Observed behavior:
- Hardware/media next-track does not work when user is viewing a different playlist than the one containing the currently playing track
- Returning to the owning playlist makes next-track work again
- Blank new playlists may also hide/disable play controls

Interpretation:
- playback navigation may be incorrectly tied to current viewed playlist instead of active playback context

Status:
- containment implemented
- awaiting QA

---

## ✅ Completed (Do NOT revisit unless broken)

- Playback + autoplay restored
- Missing audio regression fixed
- Now Playing / lock screen fixed
- Waveform rendering stabilized
- Vault + storage trust fixed
- Import UX improved
- "Imported" label removed
- Auto-art theme badge removed
- Mute + Dim toasts added
- Rasta iOS blur applied
- Merica FX sequencing implemented
- Long audio crash contained (iOS guardrail)

---

## 🔴 Known Constraints (IMPORTANT)

### Long Audio Crop (iOS)
- Full decode + WAV export causes memory crash
- Currently blocked on iOS for safety

Decision:
- DO NOT attempt to fix in current architecture
- Requires future system (native / chunked / server)

---

## 🟡 Active Tasks

### 1. Rasta Smoke Offset / Rotation
Goal:
- second smoke spawn:
  - random rotation
  - 10–20px offset from tap

Status:
- ready for implementation

---

## 🟢 Pending Polish (Low Risk)

- Minor FX tuning
- Visual balance tweaks
- UX clarity improvements (if obvious)

---

## ❌ Explicitly Deferred (Do NOT touch)

- Long audio crop system redesign
- Streaming audio processing
- Waveform architecture overhaul
- Advanced auto-art system changes

---

## 🧪 QA Checklist (Release Gate)

### Core Flow
- import → play → next track autoplay
- tap tile starts playback
- no "Missing audio" false states

### Long Audio
- import works
- playback works
- loop works
- crop is safely blocked on iOS

### UI / UX
- no "Imported" label
- auto-art clean
- toasts behave correctly
- tiles render correctly

### Platform
- lock screen metadata + artwork works
- iOS build stable (no refresh/crash loops)

---

## 🧠 Known System Boundaries

- JS/WebView cannot safely handle full-buffer processing of long audio
- Lazy hydration is REQUIRED (do not revert)
- Media availability != hydrated state (critical concept)

---

## 📌 Codex Instructions Template

When starting a new task:

- read this file first
- pick ONLY ONE task
- do not expand scope

Required output:
1. Findings
2. Root cause
3. Files involved
4. Fix or recommendation
5. Risk
6. QA

---

## 🧘‍♂️ Reality Check

The app is:
- stable
- usable
- trustworthy

Remaining work is:
- polish
- not architecture

Do not overbuild.
