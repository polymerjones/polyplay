# 3-24-26 Vault Restore Findings

## Overview

Today's investigation focused on a confirmed Vault restore bug:

- after full Vault import, a track that had saved loop state at export could come back showing `0:00 / 0:00`
- the concern was whether this indicated broken loop restore, broken audio restore, broken media-key binding, stale runtime state after import, or a backup-format integrity gap

The inspection traced the full backup/export path, the full backup/import path, the app's post-import runtime refresh behavior, and the exact media filename/type handling used when rebuilding restored blobs.

## Files inspected

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
- [`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts)
- [`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts)
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)

Reference docs read before the pass:

- [`docs/polyplay-blueprint.md`](/Users/paulfisher/Polyplay/docs/polyplay-blueprint.md)
- [`docs/polyplay-product-summary.md`](/Users/paulfisher/Polyplay/docs/polyplay-product-summary.md)
- [`docs/3-22-26-release-discoveries.md`](/Users/paulfisher/Polyplay/docs/3-22-26-release-discoveries.md)
- [`docs/3-23-26-storage-integrity-audit.md`](/Users/paulfisher/Polyplay/docs/3-23-26-storage-integrity-audit.md)
- [`docs/3-21-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-21-26-codex-handoff.md)

## What full Vault export serializes for looped tracks

Looped tracks are exported in two separate layers:

### 1. Media / library layer

From the sanitized library:

- track metadata
- playlist membership
- `audioKey`-backed media blob
- artwork blob
- artwork-video blob

Audio export is driven by the track's media key, not by loop state.

Relevant path:

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
  - `buildTrackMediaEntries()`
  - `exportFullBackup()`

### 2. Config layer

Per-track config includes:

- `aura`
- `loopMode`
- `loopRegion`

Relevant path:

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
  - `readLoopState()`
  - `buildConfigSnapshot()`

## Key finding

Loop state does **not** change the exported audio/media payload.

There is no code path in full Vault export where a track having a loop causes:

- different audio bytes
- different audio key selection
- skipped audio export
- loop-dependent media omission

So the `0:00 / 0:00` symptom was **not** caused by loop state corrupting the exported backup media.

## What full Vault import does

On import, the app:

- reads `config.json`
- reads `library.json`
- restores each track's audio/art/art-video blob into IndexedDB with fresh blob keys
- builds a restored library pointing at those fresh keys
- saves the restored library
- applies the imported config, including loop state

Relevant path:

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
  - `importFullBackup()`
  - `applyImportedConfig()`

## Confirmed failing stage

The exact failing stage is in the **full Vault media serialization and restore path** when an audio blob does not carry a usable MIME type.

Before the fix:

- `buildTrackMediaEntries()` derived the exported media filename extension only from `blob.type`
- when an audio blob had no usable MIME, backup export fell back to `audio.bin`
- on import, `importFullBackup()` rebuilt the blob type from the filename extension using `getMimeFromPath(...)`
- `audio.bin` therefore came back as `application/octet-stream`

That means the restored track could end up with:

- a valid restored `audioKey`
- a real restored blob in IndexedDB
- preserved loop state
- but a mislabeled audio blob that no longer restored as clean playable media

So the restored library data itself could already be broken before runtime/player/UI logic touched it.

## Fix made

The narrow fix was applied in [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts).

Full Vault export now performs a small media-signature inference step when a stored blob has no usable MIME type:

- common audio/image/video byte signatures are checked
- the backup filename extension is chosen from that inferred media type instead of falling back to `.bin`

This keeps the backup archive from degrading audio into `audio.bin`, so import restores a real media type instead of `application/octet-stream`.

The earlier runtime-reset hardening in [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx) still remains useful, but it was not the complete root cause for the clean factory-reset restore failure.

## Classification

This issue was:

- not loop-state corruption
- not missing audio blob restore
- not invalid restored `audioKey` linkage
- not just stale runtime state after import
- **yes** backup media-type degradation during export/import for blobs missing usable MIME metadata

## Platform impact

- `both`

The restore/import/runtime binding path is shared across desktop and iOS.

## Risk

- low

The fix is limited to full-backup media filename generation and does not redesign backup architecture, loop logic, or playback architecture.

## Important note

This fix protects **new Vault exports** created after the patch.

Older backup ZIPs that already contain `audio.bin` entries were created without enough media-type information to be repaired automatically during import.
