import type { Track } from "../types";
import { generateWaveformArtwork } from "./artwork/waveformArtwork";
import { generateVideoPoster } from "./artwork/videoPoster";
import { getMediaUrl, revokeAllMediaUrls, revokeMediaUrl } from "./player/media";
import { isConstrainedMobileDevice } from "./platform";
import { deleteBlob, getBlob, initDB, listBlobStats, putBlob } from "./storage/db";
import { loadLibrary, saveLibrary, type LibraryState, type TrackRecord } from "./storage/library";
import { titleFromFilename } from "./title";

export type DbTrackRecord = {
  id: string;
  demoId?: string | null;
  isDemo?: boolean;
  title?: string;
  sub?: string;
  aura?: number;
  audioKey?: string | null;
  artKey?: string | null;
  artVideoKey?: string | null;
  audioBytes?: number;
  artworkBytes?: number;
  posterBytes?: number;
  createdAt?: number;
  updatedAt?: number;
  missingAudio?: boolean;
  missingArt?: boolean;
  artworkSource?: "auto" | "user";
};

type LegacyDbTrackRecord = {
  id: number;
  title?: string;
  sub?: string;
  aura?: number;
  audio?: Blob;
  art?: Blob | null;
  artVideo?: Blob | null;
  createdAt?: number;
};

const LEGACY_DB_NAME = "carplay_app";
const LEGACY_DB_VERSION = 1;
const LEGACY_STORE_NAME = "tracks";
const LEGACY_MIGRATION_FLAG = "showoff_legacy_migrated_v1";
const STORAGE_CAP_BYTES_MOBILE = 250 * 1024 * 1024;
const STORAGE_CAP_BYTES_DESKTOP = 750 * 1024 * 1024;

function clampAura(aura: number): number {
  return Math.max(0, Math.min(5, Math.round(aura)));
}

function now(): number {
  return Date.now();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class StorageCapError extends Error {
  capBytes: number;
  usedBytes: number;
  projectedBytes: number;
  constructor(capBytes: number, usedBytes: number, projectedBytes: number) {
    super("Storage cap exceeded");
    this.name = "StorageCapError";
    this.capBytes = capBytes;
    this.usedBytes = usedBytes;
    this.projectedBytes = projectedBytes;
  }
}

export function isStorageCapError(error: unknown): error is StorageCapError {
  return error instanceof StorageCapError;
}

function getStorageCapBytes(): number {
  return isConstrainedMobileDevice() ? STORAGE_CAP_BYTES_MOBILE : STORAGE_CAP_BYTES_DESKTOP;
}

async function ensureStorageCapacity(additionalBytes: number): Promise<void> {
  if (additionalBytes <= 0) return;
  const stats = await listBlobStats();
  const usedBytes = stats.reduce((sum, stat) => sum + stat.bytes, 0);
  const projectedBytes = usedBytes + additionalBytes;
  const capBytes = getStorageCapBytes();
  if (projectedBytes > capBytes) {
    throw new StorageCapError(capBytes, usedBytes, projectedBytes);
  }
}

function getTrackOrder(library: LibraryState): string[] {
  const playlist = library.activePlaylistId ? library.playlistsById[library.activePlaylistId] : undefined;
  const fromPlaylist = playlist?.trackIds || [];
  if (fromPlaylist.length) return fromPlaylist;

  return Object.values(library.tracksById)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((track) => track.id);
}

async function maybeMigrateLegacyTracks(): Promise<void> {
  if (localStorage.getItem(LEGACY_MIGRATION_FLAG) === "1") return;

  const library = loadLibrary();
  if (Object.keys(library.tracksById).length > 0) {
    localStorage.setItem(LEGACY_MIGRATION_FLAG, "1");
    return;
  }

  const legacyRows = await readLegacyTracks().catch(() => [] as LegacyDbTrackRecord[]);
  if (!legacyRows.length) {
    localStorage.setItem(LEGACY_MIGRATION_FLAG, "1");
    return;
  }

  await initDB();
  const nextLibrary = loadLibrary();
  const ordered = legacyRows.slice().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const activePlaylist = nextLibrary.activePlaylistId
    ? nextLibrary.playlistsById[nextLibrary.activePlaylistId]
    : undefined;

  for (const row of ordered) {
    const trackId = makeId();
    const createdAt = row.createdAt ?? now();
    let audioKey: string | null = null;
    let artKey: string | null = null;
    let artVideoKey: string | null = null;

    if (row.audio) {
      audioKey = makeId();
      await putBlob(audioKey, row.audio, { type: "audio", createdAt });
    }

    const hasDedicatedArtVideo = Boolean(row.artVideo);
    const legacyVideoInArt = !hasDedicatedArtVideo && Boolean(row.art?.type?.startsWith("video/"));
    if (legacyVideoInArt && row.art) {
      artVideoKey = makeId();
      await putBlob(artVideoKey, row.art, { type: "video", createdAt });
    } else if (row.art) {
      artKey = makeId();
      await putBlob(artKey, row.art, { type: "image", createdAt });
    }

    if (row.artVideo) {
      artVideoKey = makeId();
      await putBlob(artVideoKey, row.artVideo, { type: "video", createdAt });
    }

    nextLibrary.tracksById[trackId] = {
      id: trackId,
      demoId: null,
      isDemo: false,
      title: row.title?.trim() || `Track ${row.id}`,
      sub: row.sub || "Uploaded",
      artist: null,
      duration: null,
      aura: clampAura(row.aura ?? 0),
      audioKey,
      artKey,
      artVideoKey,
      audioBytes: row.audio?.size ?? 0,
      posterBytes: row.art?.size ?? 0,
      artworkBytes: (row.art?.size ?? 0) + (row.artVideo?.size ?? 0),
      artworkSource: "user",
      createdAt,
      updatedAt: createdAt
    };

    if (activePlaylist && !activePlaylist.trackIds.includes(trackId)) {
      activePlaylist.trackIds.push(trackId);
      activePlaylist.updatedAt = now();
    }
  }

  saveLibrary(nextLibrary);
  localStorage.setItem(LEGACY_MIGRATION_FLAG, "1");
}

function readLegacyTracks(): Promise<LegacyDbTrackRecord[]> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);
    openReq.onsuccess = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction(LEGACY_STORE_NAME, "readonly");
      const store = tx.objectStore(LEGACY_STORE_NAME);
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        db.close();
        resolve((getAllReq.result ?? []) as LegacyDbTrackRecord[]);
      };
      getAllReq.onerror = () => {
        db.close();
        reject(getAllReq.error);
      };
    };
    openReq.onerror = () => reject(openReq.error);
    openReq.onupgradeneeded = () => {
      openReq.result.close();
      resolve([]);
    };
  });
}

async function toTrack(record: TrackRecord): Promise<Track> {
  // Self-heal older demo rows that may have lost audioKey but still have a playable demo video blob.
  const effectiveAudioKey = record.audioKey || (record.isDemo ? record.artVideoKey || null : null);
  const [audioBlob, artBlob, artVideoBlob] = await Promise.all([
    effectiveAudioKey ? getBlob(effectiveAudioKey) : Promise.resolve(null),
    record.artKey ? getBlob(record.artKey) : Promise.resolve(null),
    record.artVideoKey ? getBlob(record.artVideoKey) : Promise.resolve(null)
  ]);

  const audioUrl = await getMediaUrl(effectiveAudioKey);
  const artUrl = await getMediaUrl(record.artKey);
  const artVideoUrl = await getMediaUrl(record.artVideoKey);

  return {
    id: record.id,
    demoId: record.demoId ?? undefined,
    isDemo: Boolean(record.isDemo),
    title: record.title,
    sub: record.sub || "Uploaded",
    aura: clampAura(record.aura),
    audioUrl,
    artUrl,
    artVideoUrl,
    audioBlob: audioBlob ?? undefined,
    artBlob: artBlob ?? undefined,
    persistedId: record.id,
    missingAudio: Boolean(effectiveAudioKey) && !audioBlob,
    missingArt: (Boolean(record.artKey) && !artBlob) || (Boolean(record.artVideoKey) && !artVideoBlob),
    artworkSource: record.artworkSource === "auto" ? "auto" : "user"
  } satisfies Track;
}

export async function getTracksFromDb(): Promise<Track[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const allTracks = await getAllTracksFromDb();
  const byId = new Map(allTracks.map((track) => [track.id, track] as const));
  const trackIds = getTrackOrder(library);
  return trackIds.map((id) => byId.get(id)).filter(Boolean) as Track[];
}

export async function getAllTracksFromDb(): Promise<Track[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const records = Object.values(library.tracksById).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return Promise.all(records.map((record) => toTrack(record)));
}

export async function loadLibraryFromAppSourceOfTruth(): Promise<LibraryState> {
  await maybeMigrateLegacyTracks();
  return loadLibrary();
}

export async function getTrackRowsFromDb(): Promise<DbTrackRecord[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const records = Object.values(library.tracksById).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const rows = await Promise.all(
    records.map(async (record) => {
      const [audioBlob, artBlob, artVideoBlob] = await Promise.all([
        record.audioKey ? getBlob(record.audioKey) : Promise.resolve(null),
        record.artKey ? getBlob(record.artKey) : Promise.resolve(null),
        record.artVideoKey ? getBlob(record.artVideoKey) : Promise.resolve(null)
      ]);
      return {
        id: record.id,
        demoId: record.demoId ?? null,
        isDemo: Boolean(record.isDemo),
        title: record.title,
        sub: record.sub || "Uploaded",
        aura: clampAura(record.aura),
        audioKey: record.audioKey,
        artKey: record.artKey,
        artVideoKey: record.artVideoKey || null,
        audioBytes: record.audioBytes,
        artworkBytes: record.artworkBytes,
        posterBytes: record.posterBytes,
        artworkSource: record.artworkSource === "auto" ? "auto" : "user",
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        missingAudio: Boolean(record.audioKey) && !audioBlob,
        missingArt: (Boolean(record.artKey) && !artBlob) || (Boolean(record.artVideoKey) && !artVideoBlob)
      } satisfies DbTrackRecord;
    })
  );

  return rows;
}

export async function addTrackToDb(params: {
  demoId?: string | null;
  isDemo?: boolean;
  title: string;
  sub?: string;
  audio: Blob;
  artPoster?: Blob | null;
  artVideo?: Blob | null;
}): Promise<void> {
  await maybeMigrateLegacyTracks();
  await initDB();

  const ts = now();
  const trackId = makeId();
  const audioKey = makeId();
  let artKey: string | null = null;
  let artVideoKey: string | null = null;
  let artworkSource: "auto" | "user" = "user";
  let artPoster = params.artPoster ?? null;
  let posterBytes = 0;

  if (!artPoster && params.artVideo) {
    artPoster = await generateVideoPoster(params.artVideo).catch(() => null);
  }
  if (!artPoster && params.artVideo) {
    artPoster = await generateWaveformArtwork({ audioBlob: params.audio }).catch(() => null);
    if (artPoster) artworkSource = "auto";
  }
  const audioBytes = params.audio.size || 0;
  const artVideoBytes = params.artVideo?.size || 0;
  posterBytes = artPoster?.size || 0;
  await ensureStorageCapacity(audioBytes + artVideoBytes + posterBytes);
  await putBlob(audioKey, params.audio, { type: "audio", createdAt: ts });
  if (artPoster) {
    artKey = makeId();
    await putBlob(artKey, artPoster, { type: "image", createdAt: ts });
  }
  if (params.artVideo) {
    artVideoKey = makeId();
    await putBlob(artVideoKey, params.artVideo, { type: "video", createdAt: ts });
  }
  if (!artKey && !artVideoKey) {
    const generatedPoster = await generateWaveformArtwork({ audioBlob: params.audio }).catch(() => null);
    if (generatedPoster) {
      artKey = makeId();
      await putBlob(artKey, generatedPoster, { type: "image", createdAt: ts });
      artworkSource = "auto";
    }
  }

  const library = loadLibrary();
  ensureAtLeastOnePlaylist(library);
  library.tracksById[trackId] = {
    id: trackId,
    demoId: params.demoId || null,
    isDemo: Boolean(params.isDemo),
    title: params.title.trim() || "Untitled",
    sub: params.sub || "Uploaded",
    artist: null,
    duration: null,
    aura: 0,
    audioKey,
    artKey,
    artVideoKey,
    audioBytes,
    posterBytes,
    artworkBytes: posterBytes + artVideoBytes,
    artworkSource,
    createdAt: ts,
    updatedAt: ts
  };

  const playlist = library.activePlaylistId ? library.playlistsById[library.activePlaylistId] : undefined;
  if (playlist) {
    playlist.trackIds.unshift(trackId);
    playlist.updatedAt = ts;
  }

  saveLibrary(library);
}

export async function saveAuraToDb(trackId: string, aura: number): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const track = library.tracksById[trackId];
  if (!track) return;
  track.aura = clampAura(aura);
  track.updatedAt = now();
  saveLibrary(library);
}

export async function updateArtworkInDb(
  trackId: string,
  artwork: {
    artPoster: Blob | null;
    artVideo?: Blob | null;
  }
): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const track = library.tracksById[trackId];
  if (!track) throw new Error("Track not found");

  const oldArtKey = track.artKey;
  const oldArtVideoKey = track.artVideoKey || null;
  const oldArtworkBytes = track.artworkBytes ?? 0;
  const ts = now();

  let nextArtKey: string | null = null;
  let nextArtVideoKey: string | null = null;
  let nextArtPoster = artwork.artPoster;
  if (!nextArtPoster && artwork.artVideo) {
    nextArtPoster = await generateVideoPoster(artwork.artVideo).catch(() => null);
  }
  if (!nextArtPoster && artwork.artVideo) {
    const sourceAudio = track.audioKey ? await getBlob(track.audioKey) : null;
    if (sourceAudio) nextArtPoster = await generateWaveformArtwork({ audioBlob: sourceAudio }).catch(() => null);
  }
  const nextPosterBytes = nextArtPoster?.size ?? 0;
  const nextVideoBytes = artwork.artVideo?.size ?? 0;
  const deltaBytes = nextPosterBytes + nextVideoBytes - oldArtworkBytes;
  await ensureStorageCapacity(deltaBytes);
  if (nextArtPoster) {
    nextArtKey = makeId();
    await putBlob(nextArtKey, nextArtPoster, { type: "image", createdAt: ts });
  }
  if (artwork.artVideo) {
    nextArtVideoKey = makeId();
    await putBlob(nextArtVideoKey, artwork.artVideo, { type: "video", createdAt: ts });
  }

  track.artKey = nextArtKey;
  track.artVideoKey = nextArtVideoKey;
  track.posterBytes = nextPosterBytes;
  track.artworkBytes = nextPosterBytes + nextVideoBytes;
  track.artworkSource = "user";
  track.updatedAt = ts;
  saveLibrary(library);

  if (oldArtKey) {
    await deleteBlob(oldArtKey);
    revokeMediaUrl(oldArtKey);
  }
  if (oldArtVideoKey) {
    await deleteBlob(oldArtVideoKey);
    revokeMediaUrl(oldArtVideoKey);
  }
}

export async function replaceAudioInDb(trackId: string, audio: Blob, userProvidedTitle?: string | null): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const track = library.tracksById[trackId];
  if (!track) throw new Error("Track not found");

  const oldAudioKey = track.audioKey;
  const oldAudioBytes = track.audioBytes ?? 0;
  const nextAudioKey = makeId();
  await ensureStorageCapacity((audio.size || 0) - oldAudioBytes);
  await putBlob(nextAudioKey, audio, { type: "audio", createdAt: now() });
  track.audioKey = nextAudioKey;
  track.audioBytes = audio.size || 0;
  const explicitTitle = userProvidedTitle?.trim() || "";
  if (explicitTitle) {
    track.title = explicitTitle;
  } else {
    const replacementFilename =
      typeof (audio as File).name === "string" ? ((audio as File).name as string) : "";
    track.title = titleFromFilename(replacementFilename);
  }
  track.updatedAt = now();
  saveLibrary(library);

  if (oldAudioKey) {
    await deleteBlob(oldAudioKey);
    revokeMediaUrl(oldAudioKey);
  }
}

export async function removeTrackFromDb(trackId: string): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const track = library.tracksById[trackId];
  if (!track) return;

  const keys = [track.audioKey, track.artKey, track.artVideoKey].filter(Boolean) as string[];
  for (const key of keys) {
    await deleteBlob(key);
    revokeMediaUrl(key);
  }

  delete library.tracksById[trackId];
  for (const playlist of Object.values(library.playlistsById)) {
    playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
    playlist.updatedAt = now();
  }

  saveLibrary(library);
}

export async function resetAuraInDb(): Promise<number> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  let updated = 0;
  for (const track of Object.values(library.tracksById)) {
    if ((track.aura ?? 0) !== 0) {
      track.aura = 0;
      track.updatedAt = now();
      updated += 1;
    }
  }
  saveLibrary(library);
  return updated;
}

export async function clearTracksInDb(): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const keys = Object.values(library.tracksById)
    .flatMap((track) => [track.audioKey, track.artKey, track.artVideoKey])
    .filter(Boolean) as string[];

  for (const key of keys) {
    await deleteBlob(key);
    revokeMediaUrl(key);
  }

  for (const playlist of Object.values(library.playlistsById)) {
    playlist.trackIds = [];
    playlist.updatedAt = now();
  }
  library.tracksById = {};
  saveLibrary(library);
  revokeAllMediaUrls();
}

export async function hardResetLibraryInDb(): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const keys = Object.values(library.tracksById)
    .flatMap((track) => [track.audioKey, track.artKey, track.artVideoKey])
    .filter(Boolean) as string[];

  for (const key of keys) {
    await deleteBlob(key);
    revokeMediaUrl(key);
  }

  const ts = now();
  const playlistId = "default";
  const reset: LibraryState = {
    version: library.version,
    tracksById: {},
    playlistsById: {
      [playlistId]: {
        id: playlistId,
        name: "polyplaylist1",
        trackIds: [],
        createdAt: ts,
        updatedAt: ts
      }
    },
    activePlaylistId: playlistId
  };
  saveLibrary(reset);
  revokeAllMediaUrls();
}

export async function hasDemoTrackByDemoId(demoId: string): Promise<boolean> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  return Object.values(library.tracksById).some((track) => track.demoId === demoId);
}

export async function removeDemoTracksInDb(): Promise<number> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const demoTrackIds = Object.values(library.tracksById)
    .filter((track) => track.isDemo)
    .map((track) => track.id);
  if (!demoTrackIds.length) return 0;

  const keys = demoTrackIds
    .flatMap((trackId) => {
      const track = library.tracksById[trackId];
      return track ? [track.audioKey, track.artKey, track.artVideoKey] : [];
    })
    .filter(Boolean) as string[];
  for (const key of keys) {
    await deleteBlob(key);
    revokeMediaUrl(key);
  }

  for (const trackId of demoTrackIds) {
    delete library.tracksById[trackId];
  }
  for (const playlist of Object.values(library.playlistsById)) {
    playlist.trackIds = playlist.trackIds.filter((trackId) => !demoTrackIds.includes(trackId));
    playlist.updatedAt = now();
  }
  saveLibrary(library);
  return demoTrackIds.length;
}

export type StorageUsageSummary = {
  capBytes: number;
  totalBytes: number;
  audioBytes: number;
  imageBytes: number;
  videoBytes: number;
};

export type TrackStorageRow = {
  id: string;
  title: string;
  totalBytes: number;
  audioBytes: number;
  artworkBytes: number;
  posterBytes: number;
  updatedAt: number;
};

export type PlaylistRow = {
  id: string;
  name: string;
  trackCount: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

export type DeletePlaylistResult = {
  nextActivePlaylistId: string | null;
  deletedTracks: number;
};

function ensureAtLeastOnePlaylist(library: LibraryState): void {
  const playlistIds = Object.keys(library.playlistsById);
  if (!playlistIds.length) {
    const ts = now();
    library.playlistsById = {
      default: {
        id: "default",
        name: "polyplaylist1",
        trackIds: [],
        createdAt: ts,
        updatedAt: ts
      }
    };
    library.activePlaylistId = "default";
    return;
  }
  if (!library.activePlaylistId || !library.playlistsById[library.activePlaylistId]) {
    library.activePlaylistId = playlistIds[0] ?? null;
  }
}

function countTrackReferences(playlistsById: LibraryState["playlistsById"]): Map<string, number> {
  const refs = new Map<string, number>();
  for (const playlist of Object.values(playlistsById)) {
    for (const trackId of playlist.trackIds) {
      refs.set(trackId, (refs.get(trackId) ?? 0) + 1);
    }
  }
  return refs;
}

export async function getPlaylistsFromDb(): Promise<PlaylistRow[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  return Object.values(library.playlistsById)
    .map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      trackCount: playlist.trackIds.filter((trackId) => Boolean(library.tracksById[trackId])).length,
      isActive: library.activePlaylistId === playlist.id,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt
    }))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.updatedAt - a.updatedAt);
}

export async function createPlaylistInDb(name: string): Promise<string> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const playlistId = makeId();
  const ts = now();
  const nextName = name.trim() || `Playlist ${Object.keys(library.playlistsById).length + 1}`;
  library.playlistsById[playlistId] = {
    id: playlistId,
    name: nextName,
    trackIds: [],
    createdAt: ts,
    updatedAt: ts
  };
  library.activePlaylistId = playlistId;
  saveLibrary(library);
  return playlistId;
}

export async function setActivePlaylistInDb(playlistId: string): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  if (!library.playlistsById[playlistId]) throw new Error("Playlist not found");
  library.activePlaylistId = playlistId;
  library.playlistsById[playlistId].updatedAt = now();
  saveLibrary(library);
}

export async function renamePlaylistInDb(playlistId: string, name: string): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const playlist = library.playlistsById[playlistId];
  if (!playlist) throw new Error("Playlist not found");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Playlist name can't be empty.");
  playlist.name = trimmed;
  playlist.updatedAt = now();
  saveLibrary(library);
}

export async function renameTrackInDb(trackId: string, newTitle: string): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const track = library.tracksById[trackId];
  if (!track) throw new Error("Track not found");
  const trimmed = newTitle.trim();
  if (!trimmed) throw new Error("Title can't be empty.");
  track.title = trimmed;
  track.updatedAt = now();
  saveLibrary(library);
}

export async function deletePlaylistInDb(playlistId: string): Promise<DeletePlaylistResult> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const playlist = library.playlistsById[playlistId];
  if (!playlist) throw new Error("Playlist not found");

  const uniqueTrackIds = playlist.trackIds.filter((trackId) => Boolean(library.tracksById[trackId]));
  delete library.playlistsById[playlistId];
  ensureAtLeastOnePlaylist(library);

  const refs = countTrackReferences(library.playlistsById);
  let deletedTracks = 0;
  for (const trackId of uniqueTrackIds) {
    if (refs.has(trackId)) continue;
    const track = library.tracksById[trackId];
    if (!track) continue;
    const keys = [track.audioKey, track.artKey, track.artVideoKey].filter(Boolean) as string[];
    for (const key of keys) {
      await deleteBlob(key);
      revokeMediaUrl(key);
    }
    delete library.tracksById[trackId];
    deletedTracks += 1;
  }

  for (const entry of Object.values(library.playlistsById)) {
    entry.trackIds = entry.trackIds.filter((trackId) => Boolean(library.tracksById[trackId]));
    entry.updatedAt = now();
  }

  if (!library.activePlaylistId || !library.playlistsById[library.activePlaylistId]) {
    library.activePlaylistId = Object.keys(library.playlistsById)[0] ?? null;
  }
  saveLibrary(library);
  return {
    nextActivePlaylistId: library.activePlaylistId,
    deletedTracks
  };
}

export async function getStorageUsageSummary(): Promise<StorageUsageSummary> {
  await maybeMigrateLegacyTracks();
  const stats = await listBlobStats();
  const totalBytes = stats.reduce((sum, stat) => sum + stat.bytes, 0);
  const audioBytes = stats.filter((stat) => stat.type === "audio").reduce((sum, stat) => sum + stat.bytes, 0);
  const imageBytes = stats.filter((stat) => stat.type === "image").reduce((sum, stat) => sum + stat.bytes, 0);
  const videoBytes = stats.filter((stat) => stat.type === "video").reduce((sum, stat) => sum + stat.bytes, 0);
  return {
    capBytes: getStorageCapBytes(),
    totalBytes,
    audioBytes,
    imageBytes,
    videoBytes
  };
}

export async function getTrackStorageRows(): Promise<TrackStorageRow[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const tracks = Object.values(library.tracksById);
  return tracks
    .map((track) => {
      const audioBytes = track.audioBytes ?? 0;
      const posterBytes = track.posterBytes ?? 0;
      const artworkBytes = track.artworkBytes ?? posterBytes;
      return {
        id: track.id,
        title: track.title || "Untitled",
        totalBytes: audioBytes + artworkBytes,
        audioBytes,
        artworkBytes,
        posterBytes,
        updatedAt: track.updatedAt ?? track.createdAt ?? 0
      } satisfies TrackStorageRow;
    })
    .sort((a, b) => b.totalBytes - a.totalBytes);
}
