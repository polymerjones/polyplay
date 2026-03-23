# 3-23-26 Safari Journal Edit Visibility

## Overview

This note documents a confirmed desktop Safari issue in the Gratitude Journal edit flow and the narrow fix applied during release hardening.

The reported symptom was:

> when there are a lot of notes, the note edit window is small and no save button

That report was rechecked against the actual journal implementation before changing behavior.

## Short conclusion

- The issue was real.
- It was not a missing save button.
- The real problem was that the active journal entry scroll logic only aligned the top of the edited note into view.
- In desktop Safari, with a long journal list, the bottom of the expanded edit state could remain below the visible scroll area.
- That could make the editor feel cramped and make the `Save Changes` / `Discard Changes` row appear missing.

The fix was narrow:

- update the edit-mode scroll behavior so the full active edited entry stays within the visible journal list area

## Files inspected

- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

Reference docs read before the verification pass:

- [`docs/polyplay-blueprint.md`](/Users/paulfisher/Polyplay/docs/polyplay-blueprint.md)
- [`docs/polyplay-product-summary.md`](/Users/paulfisher/Polyplay/docs/polyplay-product-summary.md)
- [`docs/3-21-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-21-26-codex-handoff.md)
- [`docs/3-22-26-release-discoveries.md`](/Users/paulfisher/Polyplay/docs/3-22-26-release-discoveries.md)

## What was verified

### Confirmed issue

The journal edit scroll behavior in [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx) only protected the top edge of the active edited entry.

When an entry expanded into edit mode:

- the list scrolled so the entry top was visible
- but it did not ensure the entry bottom was also visible
- on desktop Safari, with many existing notes, the action row at the bottom could end up below the visible portion of the list

This matched the reproduced tester report.

### Not the actual problem

The issue was not:

- a missing save button in the component
- a broken journal edit render path
- a data loss issue

The `Save Changes` and `Discard Changes` controls were present in the DOM. They were simply not guaranteed to be visible after entering edit mode in a long scrollable list.

## Root cause

The edit-mode effect used `scrollActiveEntryIntoComfortableView()` to reveal the active entry.

Before the fix, that logic:

- measured the list and active entry
- computed a target scroll position from the entry top only
- scrolled to that top-aligned position

That was sufficient for shorter entries, but not for the expanded editor state where the textarea and action row increase the entry height.

## Fix applied

The fix was made in [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx).

The updated logic now:

- checks both the top and bottom edges of the active edited entry
- scrolls upward if the top is too high
- scrolls downward if the bottom action area falls below the visible list region
- leaves the existing journal layout and editing model intact

No CSS redesign or modal restructuring was required.

## Platform impact

- `both`

The issue was reproduced on desktop Safari, but the journal modal is shared UI, so the safer scroll behavior applies to desktop and iOS.

## Regression risk

Low.

This change only affects the journal edit visibility logic when an entry enters edit mode. It does not change:

- journal data storage
- save behavior
- delete behavior
- modal layout structure
- onboarding or gratitude prompt behavior

## Verification

- `npm run typecheck` passed after the fix
