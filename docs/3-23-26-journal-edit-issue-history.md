# 3-23-26 Journal Edit Issue History

## Overview

This note documents the full investigation and fix history for the Gratitude Journal edit-mode visibility failure found during release hardening.

The original user-facing symptom was:

> when there are a lot of notes, the note edit window is small and no save button

The issue was first reported as a desktop Safari problem, but later reproductions suggested it was not strictly Safari-only.

This document keeps the full trail:

- what was first believed
- what turned out to be incomplete
- what runtime measurements actually proved
- what final narrow fix resolved the issue

## Files inspected during the investigation

- [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx)
- [`styles.css`](/Users/paulfisher/Polyplay/styles.css)
- [`docs/polyplay-blueprint.md`](/Users/paulfisher/Polyplay/docs/polyplay-blueprint.md)
- [`docs/polyplay-product-summary.md`](/Users/paulfisher/Polyplay/docs/polyplay-product-summary.md)
- [`docs/3-21-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-21-26-codex-handoff.md)
- [`docs/3-22-26-release-discoveries.md`](/Users/paulfisher/Polyplay/docs/3-22-26-release-discoveries.md)
- [`docs/3-23-26-safari-journal-edit-visibility.md`](/Users/paulfisher/Polyplay/docs/3-23-26-safari-journal-edit-visibility.md)
- [`docs/3-23-26-safari-journal-runtime-root-cause.md`](/Users/paulfisher/Polyplay/docs/3-23-26-safari-journal-runtime-root-cause.md)

## Phase 1: Initial interpretation

The first working theory was:

- the active edited journal entry was being scrolled into view incorrectly
- the list reveal logic only protected the top of the edited note
- the bottom action row could therefore remain off-screen

That led to a narrow edit in [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx):

- the edit-mode scroll logic was updated to consider both top and bottom edges
- the action row was later used as the reveal target instead of only the full entry box

This was a reasonable first diagnosis, but it turned out to be incomplete.

## Phase 2: Why the first diagnosis was incomplete

Subsequent screenshots showed:

- the textarea itself was visible
- the action row was still not reachable
- the edited row looked visually collapsed

That meant the issue was no longer just “scroll didn’t go far enough.”

The bug had to be inside the edited row’s layout flow, or in the container that defined its usable height.

## Phase 3: First runtime probe

A temporary gated debug probe was added to the journal to inspect:

- list `clientHeight`
- list `scrollHeight`
- list `scrollTop`
- bounding rects for the active entry, textarea, and action row
- ancestor overflow / transform / backdrop-filter values

The important measurements from that phase were:

- list:
  - `clientHeight: 565`
  - `scrollHeight: 704`
  - `scrollTop: 0`
- active edited entry:
  - `height: 92`
- textarea:
  - `height: 180`

That proved:

- the textarea existed
- the active edited entry container was not expanding to include it
- the list was not internalizing the full edited height as scrollable space

This led to the next theory:

- the list container itself was mishandling edited row sizing

## Phase 4: List container root cause

At that point, the list in [`styles.css`](/Users/paulfisher/Polyplay/styles.css) still used:

- `.journal-modal__list { display: grid; }`

The working conclusion became:

- the journal list grid stack was not reliably remeasuring the edited row as a taller item

That produced a narrow fix:

- change `.journal-modal__list` from `display: grid` to a vertical flex stack

This was necessary, but not sufficient by itself.

## Phase 5: Responsive / non-Safari clue

Later reproductions showed the issue in a browser responsive/emulation context as well, which was useful:

- it suggested this was not purely a Safari-only quirk
- it pointed more strongly to a broader layout/shrink behavior in the shared journal UI

That shifted the investigation from “Safari scrolling weirdness” to “the edited article is still not getting its full in-flow height.”

## Phase 6: Final direct layout-flow probe

A second temporary probe was added to inspect the edited row directly:

- edited article `offsetHeight`
- edited article `scrollHeight`
- edited article `clientHeight`
- textarea `offsetHeight`
- textarea `offsetTop`
- actions row `offsetHeight`
- actions row `offsetTop`
- whether the actions row was still inside the article’s layout flow

The decisive measurements were:

- textarea:
  - `offsetHeight: 180`
  - `offsetTop: 42`
- actions row:
  - `offsetHeight: 25`
  - `offsetTop: 230`
- actions row in flow:
  - `actionsInsideArticleFlow: true`

What that proved:

- the actions row was **not** escaping normal flow
- the actions row was **not** absolutely positioned or detached from the article
- the problem was that the article itself was being shrunk smaller than its in-flow children

That was the final correction to the diagnosis.

## Exact confirmed failure point

After `.journal-modal__list` was changed to a vertical flex stack, each journal row became a flex item.

The base journal row rule in [`styles.css`](/Users/paulfisher/Polyplay/styles.css) still allowed default flex shrinking:

- `.journal-entry` did not explicitly opt out of `flex-shrink`

In a vertical flex container, that meant:

- the edited article could still shrink below the height required by its textarea and action row
- the action row remained in flow
- the article clipped its own children because it still had `overflow: hidden`

So the exact remaining failure point was:

- the edited article was a shrinking flex item inside `.journal-modal__list`

## Final fix

The narrow confirmed fix was:

- add `flex-shrink: 0;` to `.journal-entry` in [`styles.css`](/Users/paulfisher/Polyplay/styles.css)

That change prevents journal rows from shrinking below their content height inside the scrollable flex-column list.

Once that was added:

- the edited row could grow to include the textarea
- the action row remained in normal flow
- the visible card height finally matched the true edited content height

## Related hardening changes made during the same pass

These were not the final root cause, but they were kept because they improve the shared journal interaction:

### 1. Better reveal logic

In [`src/components/JournalModal.tsx`](/Users/paulfisher/Polyplay/src/components/JournalModal.tsx):

- edit-mode scroll logic now checks both top and bottom visibility
- the action row is used as the meaningful lower reveal target

### 2. Simpler entry interaction

The old timed double-tap entry behavior was removed.

The new interaction is:

- first tap expands
- second tap on the expanded entry enters edit
- the edit button still works

Helper text was updated from:

- `Double tap to edit`

to:

- `Tap to edit`

### 3. Safer journal dismissal

Backdrop dismissal was tightened so the journal no longer closes from arbitrary outer clicks.

It now only dismisses on backdrop clicks near the screen edge.

## Temporary probes

Two temporary measurement probes were used during this investigation.

Both were removed after the final cause was confirmed.

No debug instrumentation remains in the shipped journal flow.

## Platform impact

- `both`

The issue was first reproduced on desktop Safari, but the journal edit layout and interaction model are shared across desktop and iOS.

The final fixes therefore affect both platforms.

## Regression risk

Low to moderate.

Why:

- the final layout fix is narrow and targeted
- `flex-shrink: 0` is an appropriate rule for stacked journal rows in a scrollable vertical list
- the scroll reveal logic is more defensive than before
- the tap interaction is simpler and more reliable than the old timed double-tap path
- no journal data, save logic, delete logic, or backup behavior was changed

## Final verification

- the issue was confirmed fixed after the final `flex-shrink: 0` change
- `npm run typecheck` passed
