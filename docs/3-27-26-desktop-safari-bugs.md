# 3-27-26 Desktop Safari Bugs

## Scope
Desktop Safari only.

These issues were observed on the Safari desktop build / deployed app surface and are separate from the current iOS App Store release path.

---

## 1. Onboarding / welcome card height bug
### Status
Still present on Desktop Safari.

### Behavior
The onboarding / welcome card can render as an abnormally tall vertical box instead of resolving to its intended compact card height.

### Notes
- Seen on Safari desktop.
- Observed on Vercel deploy.
- Needs separate follow-up from iOS release work.

---

## 2. Artwork video uploads do not generate a still image
### Status
Open.

### Behavior
When the user uploads a **video file for artwork** on Desktop Safari:
- the fullscreen video player can play the uploaded video correctly
- but a still artwork graphic/poster is not generated
- artwork appears blank in non-fullscreen surfaces

### Visible symptom
Artwork is blank everywhere except the fullscreen video player, where the video itself plays.

### Expected
A usable still/poster image should appear in normal artwork surfaces when video artwork is uploaded.

---

## 3. Complete Safari desktop freeze / crash
### Status
Open / severe.

### Behavior
Desktop Safari reached a state where the app became completely frozen.

### Notes
- Full UI freeze observed.
- Needs follow-up because this is more severe than a normal layout bug.
- Exact reproduction path still needs to be documented when time allows.

---

## Priority
These are Desktop Safari bugs and should be tracked separately from the immediate iOS App Store submission path.

Suggested priority order for later:
1. Complete freeze / crash
2. Video artwork still-generation failure
3. Onboarding / welcome card height bug
