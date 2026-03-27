# 3-23-26 Storage Integrity Audit

## Overview

This audit was performed to verify whether Polyplay truly internalizes imported media and Vault backups, or whether any imported library state can still depend on the original source file after import.

The tester concern being investigated was:

> "Vault is referencing zip file; if zip file is removed, playlist is gone."

The audit inspected the actual storage, import, playback, and backup code paths rather than inferring behavior from UI symptoms.

## Short conclusion

- On desktop web, Polyplay stores library metadata in `localStorage`.
- Imported audio, artwork, and artwork video are stored as `Blob`s in IndexedDB.
- Runtime playback uses browser `blob:` URLs created from those IndexedDB blobs.
- Full Vault import reads the ZIP into memory, writes new blobs into IndexedDB, and stores only blob keys in the restored library.
- There is no confirmed code path where imported Vault media continues to depend on the original ZIP file after import.
- The tester report is **not true as a ZIP dependency claim**.

However, the audit did uncover a separate real integrity issue:

- Full backup import previously deleted all existing stored blobs before the new restore had fully completed.
- If restore failed mid-import, the app could be left with broken media.
- That issue was fixed in this pass.

## Files inspected

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
- [`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts)
- [`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts)
- [`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts)
- [`src/lib/library.ts`](/Users/paulfisher/Polyplay/src/lib/library.ts)
- [`src/lib/saveBlob.ts`](/Users/paulfisher/Polyplay/src/lib/saveBlob.ts)
- [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts)
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/admin/AdminApp.tsx`](/Users/paulfisher/Polyplay/src/admin/AdminApp.tsx)

Reference docs read before the audit:

- [`docs/polyplay-blueprint.md`](/Users/paulfisher/Polyplay/docs/polyplay-blueprint.md)
- [`docs/polyplay-product-summary.md`](/Users/paulfisher/Polyplay/docs/polyplay-product-summary.md)
- [`docs/3-21-26-codex-handoff.md`](/Users/paulfisher/Polyplay/docs/3-21-26-codex-handoff.md)
- [`docs/3-22-26-release-discoveries.md`](/Users/paulfisher/Polyplay/docs/3-22-26-release-discoveries.md)

## Storage architecture on desktop web

### 1. Library metadata

Polyplay stores its primary library state in `localStorage` under the key:

- `showoff_library_v1`

This includes:

- tracks metadata
- playlist metadata
- active playlist pointer
- blob keys for media stored elsewhere
- some bundled demo asset URLs

Relevant code:

- [`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts)

### 2. Imported media

Imported user media does **not** stay as an external filesystem reference.

Instead:

- audio is written into IndexedDB as a `Blob`
- artwork is written into IndexedDB as a `Blob`
- artwork video is written into IndexedDB as a `Blob`
- the library record stores generated blob keys like `audioKey`, `artKey`, and `artVideoKey`

Relevant code:

- [`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts)
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)

### 3. Runtime playback / display URLs

When the app needs to play or render imported media, it does not read from the original file path.

Instead:

- it reads the stored `Blob` back out of IndexedDB
- it creates a browser `blob:` URL with `URL.createObjectURL(blob)`
- it uses that temporary runtime URL for playback/display

Relevant code:

- [`src/lib/player/media.ts`](/Users/paulfisher/Polyplay/src/lib/player/media.ts)
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)

## IndexedDB vs localStorage

### localStorage is used for

- library metadata and playlist structure
- theme/layout/aura/settings flags
- onboarding flags
- gratitude entries/settings
- loop settings

Primary references:

- [`src/lib/storage/library.ts`](/Users/paulfisher/Polyplay/src/lib/storage/library.ts)
- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)
- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)

### IndexedDB is used for

- imported audio blobs
- imported artwork blobs
- imported artwork video blobs

Primary references:

- [`src/lib/storage/db.ts`](/Users/paulfisher/Polyplay/src/lib/storage/db.ts)
- [`src/lib/db.ts`](/Users/paulfisher/Polyplay/src/lib/db.ts)
- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)

## Vault import / export behavior

### Export

Full Vault export:

- loads the current sanitized library
- reads stored media blobs from IndexedDB
- writes those bytes into the ZIP under `polyplay-backup/media/...`
- includes config and library metadata JSON

Relevant code:

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)

### Import

Full Vault import:

- reads the selected ZIP with `file.arrayBuffer()`
- parses entries from that ZIP
- loads `config.json` and `library.json`
- creates fresh `Blob`s from ZIP media entries
- writes those fresh blobs into IndexedDB with fresh keys
- rebuilds the restored library using those new keys
- saves the restored library back into `localStorage`

Relevant code:

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)

## Does imported Vault/media become fully internalized?

Yes.

For user-imported media and Vault-restored media, the app internalizes them into app-managed browser storage:

- metadata goes into `localStorage`
- binary media goes into IndexedDB

After Vault import, the restored library points to newly written blob keys in IndexedDB, not to the original ZIP file.

## Is the report "delete zip and playlist breaks" true?

### As stated: no

The code does **not** store:

- a persistent handle to the ZIP file
- an absolute path to the ZIP file
- a file-system reference that must remain present after import

Once import succeeds, the original ZIP is no longer required by the restored library.

### What the tester may have observed instead

The most likely explanations are:

- browser storage was cleared or evicted
- the import failed or was interrupted
- they were looking at built-in demo media, which intentionally uses bundled app asset URLs
- they saw a restore-safety issue that looked like “the ZIP was required” when the real problem was failed import cleanup

## Demo asset exception

Built-in demo tracks are different from user-imported tracks.

They intentionally use bundled asset URLs such as:

- `bundledAudioUrl`
- `bundledArtUrl`
- `bundledArtVideoUrl`

Those are app-shipped asset references, not user-file references.

Relevant code:

- [`src/lib/demoSeed.ts`](/Users/paulfisher/Polyplay/src/lib/demoSeed.ts)

This is normal deployed asset-root behavior, not an integrity bug.

## Absolute-path concern

For imported user media, absolute-path concerns are not real in the current implementation.

The app does not preserve the original local file path for playback after import. It copies the file into IndexedDB and later serves it through browser-created `blob:` URLs.

The only URL-based behavior found in the audit was for:

- built-in bundled demo assets
- temporary export/download/share flows

Neither of those means imported user media depends on the original filesystem location.

## Real bug found

### Problem

Full backup import previously cleared all existing stored blobs **before** the new restore had fully succeeded.

That meant:

- if restore failed midway
- or the ZIP was malformed/incomplete
- or a write failed partway through

the current library could be left with missing media.

This was a real integrity risk and a legitimate user-trust issue.

### Fix applied

The import flow was narrowed and hardened so that:

1. existing blob keys are recorded first
2. restored media blobs are staged into IndexedDB first
3. if staging fails, staged blobs are cleaned up and the old library/media remain intact
4. only after the new restored library is successfully written are obsolete old blobs removed

Relevant code:

- [`src/lib/backup.ts`](/Users/paulfisher/Polyplay/src/lib/backup.ts)

## User-facing wording cleanup

The Vault overlay text previously said:

- “media links”

That wording was misleading because Vault actually stores imported media bytes, not just links.

This was updated to clearer release-facing copy:

- “imported media”
- “media currently stored in this browser”

Relevant code:

- [`src/App.tsx`](/Users/paulfisher/Polyplay/src/App.tsx)

## Platform impact

- Storage architecture findings: `both`
- Vault internalization conclusion: `both`
- Real import-safety bug and fix: `both`
- Vault wording clarification: `both`

The backup/import/storage code is shared across desktop web and the iOS wrapper, so the integrity conclusion and the restore-safety fix apply to both.

## Regression risk

Overall risk: low to moderate.

- The wording change is low risk.
- The import fix is narrow but touches a high-trust path.
- The new behavior is safer because failed restore attempts no longer wipe existing media first.

## Verification

- `npm run typecheck` passed after the fix.
