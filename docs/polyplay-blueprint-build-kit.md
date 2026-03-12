# Polyplay Blueprint Build Kit

Use this file to build a durable hybrid document that combines:
- product summary
- feature explanations
- technical architecture
- code-aware implementation notes
- performance / CPU priorities
- release-readiness priorities

---

## Recommended workflow

### Step 1 — Save your current product summary
Create a file in your repo such as:

`docs/polyplay-product-summary.md`

Paste your cleaned product summary into that file.

### Step 2 — Create the blueprint output file
Create another file such as:

`docs/polyplay-blueprint.md`

This will become the hybrid product + technical blueprint.

### Step 3 — Use Codex in two passes
Do **not** ask Codex to do everything at once.

#### Pass 1: Outline only
Use Prompt A below.

#### Pass 2: Fill the document using code inspection
Use Prompt B below.

#### Pass 3: Refine one section at a time
Use Prompt C below.

---

## Suggested file structure

```text
docs/
  polyplay-product-summary.md
  polyplay-blueprint.md
  polyplay-codex-prompts.md
```

You can also keep:
- `docs/polyplay-known-issues.md`
- `docs/polyplay-release-checklist.md`

---

## Prompt A — Outline only

```text
Project: Polyplay

I want to create a long-term blueprint document for this app.

Source file:
- docs/polyplay-product-summary.md

Target output file:
- docs/polyplay-blueprint.md

Task:
Read the product summary first, then inspect the codebase at a high level and create an outline only for a hybrid document that combines:
1. product summary
2. feature-by-feature explanation
3. technical/code architecture
4. important state flows and UI logic
5. performance / CPU considerations
6. current limitations / unfinished areas
7. release-readiness priorities

Important:
- do not fill the full document yet
- do not write vague marketing copy
- make the outline practical for future development and handoff
- be explicit about what should be grounded in actual code inspection

Desired sections:
1. Product Overview
2. Core Experience
3. Key Features
4. Core User Flows
5. Technical Architecture
6. Important Components and Files
7. State and Logic Systems
8. Playback System
9. Playlist / Media Management
10. Vault / Backup System
11. Gratitude Journal System
12. Onboarding System
13. Visual / FX Systems
14. Performance / CPU Efficiency Considerations
15. Known Constraints / Current Gaps
16. Release Readiness Priorities

Output:
- write the outline into docs/polyplay-blueprint.md
- keep it clean and structured
- stop after the outline
```

---

## Prompt B — Fill the blueprint using real code inspection

```text
Project: Polyplay

Continue building the blueprint.

Source files:
- docs/polyplay-product-summary.md
- docs/polyplay-blueprint.md

Task:
Use the existing outline in docs/polyplay-blueprint.md and fill it in by inspecting the actual codebase.

Requirements:
- ground technical statements in the real codebase
- distinguish clearly between:
  - confirmed implementation
  - intended product behavior
  - known gaps / limitations
- avoid vague language
- explain systems in a way that is useful to both me and future Codex/dev sessions

For each major section, include when relevant:
- what the feature does
- why it exists
- major UI behavior
- important state/logic
- important files/components
- risks, limitations, or follow-up needs
- CPU/performance considerations if relevant

Important:
Do not invent implementation details that are not visible in code.
If something is unclear, mark it as needing verification.

Output:
- update docs/polyplay-blueprint.md in place
- preserve the structure
- write in a clear professional style
```

---

## Prompt C — Refine one section at a time

```text
Refine only one section of docs/polyplay-blueprint.md.

Section to refine:
- [PASTE SECTION NAME HERE]

Task:
1. inspect the code related to this section
2. improve technical accuracy
3. make the explanation clearer and more concrete
4. add file/component references where helpful
5. add any relevant performance notes
6. do not rewrite unrelated sections

Output:
- update only that section in docs/polyplay-blueprint.md
- then give me a concise summary of what changed
```

---

## Prompt D — Generate a code map for the blueprint

```text
Create a code map for Polyplay to support the blueprint.

Task:
Inspect the repo and create a concise architecture map that identifies:
- major app entry points
- major feature components
- state-heavy files
- backup/vault files
- onboarding files
- gratitude journal files
- settings/media-management files
- styling files that control major UI systems
- iOS-specific shell/build integration points if present

Output:
- add a section called "Code Map" to docs/polyplay-blueprint.md
- include file paths and one-line descriptions
- do not include irrelevant files
```

---

## Prompt E — Add a performance / CPU audit section

```text
Add or refine the "Performance / CPU Efficiency Considerations" section in docs/polyplay-blueprint.md.

Task:
Inspect the codebase for likely CPU-heavy or performance-sensitive areas, including:
- animations
- fullscreen video/art playback
- waveform rendering
- re-renders/state churn
- visual FX modes
- large file/media handling
- backup/export/import behavior
- iOS-specific rendering concerns if visible

Requirements:
- identify likely hotspots
- suggest practical optimization targets
- distinguish between confirmed issues vs likely risks
- keep recommendations grounded in the current codebase

Output:
- update only the performance section
- then give me a concise summary of findings
```

---

## Prompt F — Add a known-issues appendix

```text
Create a known-issues appendix based on current implementation and recent bugfix history.

Task:
Add an appendix section to docs/polyplay-blueprint.md called "Known Issues / Fragile Areas".

Include:
- onboarding phase logic sensitivity
- mobile vs desktop layout differences
- tooltip/state/render coupling if still relevant
- vault/export mobile behavior if still relevant
- any code paths that appear brittle or easy to regress

Requirements:
- keep it factual
- distinguish between fixed issues, fragile areas, and unresolved issues
- do not exaggerate
```

---

## Best practice notes

### Good workflow
- Keep `docs/polyplay-product-summary.md` as the product voice / intent source
- Keep `docs/polyplay-blueprint.md` as the grounded hybrid doc
- Update the blueprint after major fixes or feature additions
- Ask Codex to refine one section at a time when context is low

### Avoid
- asking Codex to "explain the whole app" in one pass
- mixing product ideas, bug triage, and architecture in one giant prompt
- letting Codex rewrite the whole blueprint every session

---

## Suggested next move

1. Save your cleaned summary into `docs/polyplay-product-summary.md`
2. Start a fresh Codex session
3. Use Prompt A
4. Review the outline
5. Use Prompt B
6. Then refine sections one by one
