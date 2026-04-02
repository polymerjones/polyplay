# PolyPlay QA Checklist — 2026-04-02

Use this as the active manual QA checklist for today’s surgical fixes.

## 1. Loop refinement auto-zoom regression
- Create a loop and enter loop editing.
- Drag the end marker closer to the start marker without using zoom controls.
- Confirm the waveform does not zoom way out.
- Use `+/-` zoom controls, then drag either marker.
- Confirm the current zoom context is preserved while refining.
- Test very small loops near the beginning of a track.
- Test very small loops near the end of a track.
- Confirm leaving loop editing restores normal non-editing viewport behavior.

## 2. Fullscreen accidental exit during loop editing
- Open fullscreen player.
- Enter loop editing.
- Drag the start marker.
- Drag the end marker.
- Confirm fullscreen never exits accidentally during marker interaction.
- While still editing, verify the explicit close buttons still work.
- Exit loop editing.
- Confirm normal swipe/outside fullscreen dismiss behavior still works when not editing.
- Confirm cinema-mode outside exit behavior still works when not editing.

## 3. Row now-playing highlight bug
- Use a track with aura already added.
- Activate playback on that row.
- Confirm the row highlight stays edge-bound and visually stable.
- Look specifically for any stray shape, seam, detached line, or artifact after aura has been added.
- Confirm the active row still keeps its aura glow, but no longer shows a competing second border edge.
- Compare row behavior against tile behavior.

## Border trail blend tuning
- Check an active tile and an active row.
- Confirm the strobing line reads as one continuous blended stream rather than a hard bright segment.
- Confirm the brighter section has a longer tail and less visible edge.
- Confirm the faster cycle still feels smooth and not jittery on desktop and iOS.

## 3b. Aura row follow-up
- Use a track with aura already added.
- Start playback on that row.
- Confirm the now-playing perimeter stays attached to the true outside edge.
- Confirm no detached lower segment or partial border appears after aura is present.

## 4. Artist text on rows and playbars
- Import or select a track with a non-empty artist value.
- Confirm artist appears under the title on track rows.
- Confirm artist appears under the title on the mini player bar.
- Confirm artist appears under the title on the fullscreen player meta area.
- Confirm tiles still do not show artist.
- Confirm long artist names truncate cleanly and do not scramble layout.
- Confirm tracks without artist do not leave awkward blank gaps.

## 5. Metadata import reliability
- Test an MP3 with embedded artwork only.
- Confirm artwork arms before submit and imports correctly.
- Test an MP3 with title + artist + embedded artwork.
- Confirm title, artist, and artwork all populate on file select.
- Confirm import preserves the same artwork after submit.
- If debugging is needed, inspect `[artwork:metadata-import]` logs in Safari console.

## 6. Aura seek color
- Open fullscreen player on a track with aura color set.
- Confirm the elapsed seek portion reads in the aura color instead of amber/gold.
- Check the mini player loop-active progress styling as well.
- Confirm the progress thumb and loop markers still remain legible against dark and light themes.

## 7. Manage Storage title + artist editing
- Open Manage Storage for a track with an artist value.
- Click `Rename`.
- Confirm separate title and artist inputs appear.
- Save a changed title only and confirm it persists.
- Save a changed artist only and confirm it persists.
- Clear the artist field and confirm artist removes cleanly after save.
- Confirm updated title/artist values appear immediately in the storage row and on playback surfaces after refresh.

## General regression sweep
- Confirm playback still starts/stops normally.
- Confirm fullscreen open/close still works intentionally.
- Confirm mini player compact toggle still works.
- Confirm no new console errors appear during the tested flows.
