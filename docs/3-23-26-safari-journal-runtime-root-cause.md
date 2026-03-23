# 3-23-26 Safari Journal Runtime Root Cause

## Overview

This note records the confirmed runtime cause of the remaining desktop Safari Gratitude Journal edit failure after the earlier visibility pass.

The user-facing symptom was:

> when there are a lot of notes, the note edit window is small and Save / Discard fall out of view

This pass was diagnosis-first. The goal was to verify the exact failing container before changing behavior again.

## Short conclusion

- The remaining desktop Safari issue was real.
- The final failure was not just that Safari failed to scroll enough.
- The failing element was the journal list container.
- Safari was not reflowing the active edited journal row as a taller grid item inside the scrollable list.
- Because of that, the list did not gain enough effective scrollable height, so the action row could sit outside the visible region even though the textarea was rendered.

## Files inspected

- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- [`docs/polyplay-blueprint.md`](/Users/paulfisher/Polyplay/docs/polyplay-blueprint.md)
- [`docs/polyplay-product-summary.md`](/Users/paulfisher/Polyplay/docs/polyplay-product-summary.md)
- [`docs/3-21-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-21-26-codex-handoff.md)
- [`docs/3-22-26-release-discoveries.md`](/Users/paulfisher/Polyplay/docs/3-22-26-release-discoveries.md)
- [`docs/3-23-26-safari-journal-edit-visibility.md`](/Users/paulfisher/Polyplay/docs/3-23-26-safari-journal-edit-visibility.md)

## Runtime measurements

A temporary gated probe was added to the journal during investigation and used in desktop Safari while the bug was actively reproduced.

The key measurements were:

- list:
  - `clientHeight: 565`
  - `scrollHeight: 704`
  - `scrollTop: 0`
- list bounding box:
  - `top: 230`
  - `bottom: 795`
  - `height: 565`
- active edited entry:
  - `height: 92`
- textarea:
  - `height: 180`

What that proved:

- the textarea was rendered
- the active edited entry container was not expanding to include it
- the list scroll container was therefore not internalizing the full edited height as additional scrollable space

The ancestor check also showed:

- `.journal-modal__content` was not clipping
- `.journal-modal__card` did have `overflow: hidden`, but that was not the primary failure point

The primary failure point was the scrollable list itself.

## Exact root cause

The list in [`styles.css`](/Users/paulfisher/Polyplay/styles.css) used:

- `.journal-modal__list { display: grid; }`

In desktop Safari, the active edited journal row was not being remeasured correctly as a taller grid item during edit mode.

That caused this failure pattern:

- the article stayed visually sized like a collapsed `92px` row
- the textarea rendered below that effective row box
- the list `scrollHeight` did not increase enough to make the action row reliably reachable
- additional scroll targeting could not fully solve it because the list itself was not exposing the needed scrollable region

## Fix applied

The narrow fix was:

- change `.journal-modal__list` from a grid stack to a vertical flex stack in [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

That preserves the same visual stacked-list layout while avoiding the Safari grid reflow failure for edited entries.

The temporary debug probe in [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) was removed after the cause was confirmed.

## Related side fix

During the same pass, journal backdrop dismissal was tightened in [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx):

- backdrop clicks no longer dismiss the journal from arbitrary outer-space clicks
- dismissal now only occurs on backdrop clicks near the screen edge

This was not the Safari layout root cause, but it was included as a narrow UX hardening change requested during the pass.

## Platform impact

- `both`

The confirmed runtime bug was reproduced on desktop Safari, but the journal list and dismiss behavior are shared UI code, so the final change affects desktop and iOS.

## Regression risk

Low to moderate.

Reasons:

- the list layout change is structural but narrow
- the visual result remains a simple vertical stack
- flex is a more direct fit for this list than grid
- no journal data flow, save logic, or modal architecture was changed

## Verification

- `npm run typecheck` passed after the final fix
