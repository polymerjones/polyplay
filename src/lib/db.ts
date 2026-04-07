import type { Track } from "../types";
import { DEMO_WAVEFORM_PEAKS_BY_ID } from "../assets/demo/demoPeaks";
import { generateWaveformArtwork } from "./artwork/waveformArtwork";
import { generateVideoPoster } from "./artwork/videoPoster";
import { getMediaUrl, revokeAllMediaUrls, revokeMediaUrl } from "./player/media";
import { isConstrainedMobileDevice, isIosSafari } from "./platform";
import { deleteBlob, getBlob, initDB, listBlobStats, putBlob } from "./storage/db";
import { clearCompetingLibraryCandidates, loadLibrary, saveLibrary, type LibraryState, type TrackRecord } from "./storage/library";
import { getThemeSelectionFromState, parseCustomThemeSlot, type ThemeSelection } from "./themeConfig";
import { titleFromFilename } from "./title";

export type DbTrackRecord = {
  id: string;
  demoId?: string | null;
  isDemo?: boolean;
  title?: string;
  artist?: string | null;
  sub?: string;
  aura?: number;
  artUrl?: string | null;
  audioKey?: string | null;
  artKey?: string | null;
  artVideoKey?: string | null;
  bundledAudioUrl?: string | null;
  bundledArtUrl?: string | null;
  bundledArtVideoUrl?: string | null;
  audioBytes?: number;
  artworkBytes?: number;
  posterBytes?: number;
  createdAt?: number;
  updatedAt?: number;
  missingAudio?: boolean;
  missingArt?: boolean;
  artworkSource?: "auto" | "user";
};

export const IMPORT_REQUIRES_PLAYLIST_MESSAGE = "Create a playlist before importing tracks.";

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
const STORAGE_CAP_BYTES_MOBILE = 750 * 1024 * 1024;
const STORAGE_CAP_BYTES_DESKTOP = 4 * 1024 * 1024 * 1024;
const STORAGE_CAP_HEADROOM_BYTES = 128 * 1024 * 1024;
const THEME_MODE_KEY = "polyplay_themeMode";
const CUSTOM_THEME_SLOT_KEY = "polyplay_customThemeSlot_v1";
const IOS_LONG_AUDIO_AUTO_ARTWORK_SKIP_BYTES = 25 * 1024 * 1024;
const IOS_LONG_AUDIO_AUTO_ARTWORK_SKIP_DURATION_SEC = 20 * 60;
const AUDIO_METADATA_LOAD_TIMEOUT_MS = 5000;

function clampAura(aura: number): number {
  return Math.max(0, Math.min(10, Math.round(aura)));
}

function now(): number {
  return Date.now();
}

async function getAudioDurationFromBlob(blob: Blob): Promise<number | null> {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Audio === "undefined") return null;
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<number | null>((resolve) => {
      const audio = new Audio();
      let settled = false;
      const cleanup = () => {
        audio.removeAttribute("src");
        audio.load();
        URL.revokeObjectURL(objectUrl);
      };
      const finish = (duration: number | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        cleanup();
        resolve(duration);
      };
      const timeoutId = window.setTimeout(() => finish(null), AUDIO_METADATA_LOAD_TIMEOUT_MS);
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
        finish(duration);
      };
      audio.onerror = () => finish(null);
      audio.src = objectUrl;
    });
  } catch {
    URL.revokeObjectURL(objectUrl);
    return null;
  }
}

function getStoredArtworkThemeSelection(): ThemeSelection {
  if (typeof localStorage === "undefined") return "dark";
  try {
    const mode = localStorage.getItem(THEME_MODE_KEY);
    const slot = parseCustomThemeSlot(localStorage.getItem(CUSTOM_THEME_SLOT_KEY));
    return getThemeSelectionFromState(mode, slot);
  } catch {
    return "dark";
  }
}

function getThemeNotePosterPalette(themeSelection: ThemeSelection): {
  start: string;
  end: string;
  glow: string;
  note: string;
} {
  switch (themeSelection) {
    case "light":
      return { start: "#f6f1ff", end: "#d8dff5", glow: "#ffffff", note: "#5b48b8" };
    case "amber":
      return { start: "#5c3308", end: "#f0b35b", glow: "#ffd38a", note: "#fff3dc" };
    case "teal":
      return { start: "#07383d", end: "#42c7c4", glow: "#8ffff7", note: "#e7fffe" };
    case "crimson":
      return { start: "#451321", end: "#cf6f82", glow: "#ffc0cc", note: "#fff3f6" };
    case "merica":
      return { start: "#10244b", end: "#b31942", glow: "#fff0d2", note: "#fff8ee" };
    case "mx":
      return { start: "#0f4a33", end: "#d54d41", glow: "#fff0c8", note: "#fffaf0" };
    case "rasta":
      return { start: "#5d130f", end: "#1f6c2c", glow: "#ffe36f", note: "#fff8d7" };
    case "dark":
    default:
      return { start: "#1a2133", end: "#4b2d9a", glow: "#cbb8ff", note: "#f4efff" };
  }
}

function buildThemeNotePoster(themeSelection: ThemeSelection): Blob {
  const palette = getThemeNotePosterPalette(themeSelection);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="PolyPlay auto artwork">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.start}"/>
      <stop offset="100%" stop-color="${palette.end}"/>
    </linearGradient>
    <radialGradient id="glow" cx="32%" cy="24%" r="62%">
      <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" rx="190" fill="url(#bg)"/>
  <rect width="1200" height="1200" rx="190" fill="url(#glow)"/>
  <circle cx="282" cy="212" r="190" fill="${palette.glow}" opacity="0.12"/>
  <circle cx="996" cy="1008" r="240" fill="${palette.glow}" opacity="0.08"/>
  <path d="M482 316v418.7c-23.3-13.6-53.7-21.3-86.7-21.3-80 0-145.3 45.3-145.3 101.3s65.3 101.3 145.3 101.3 145.3-45.3 145.3-101.3V442.7l309.3-61.4v277.4c-23.3-13.6-53.7-21.3-86.7-21.3-80 0-145.3 45.3-145.3 101.3s65.3 101.3 145.3 101.3S909.3 794.7 909.3 738.7V252L482 316z" fill="${palette.note}"/>
</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
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

async function getStorageCapBytes(): Promise<number> {
  const fallback = isConstrainedMobileDevice() ? STORAGE_CAP_BYTES_MOBILE : STORAGE_CAP_BYTES_DESKTOP;
  try {
    if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.estimate !== "function") {
      return fallback;
    }
    const estimate = await navigator.storage.estimate();
    const quota = Number(estimate.quota ?? 0);
    if (!Number.isFinite(quota) || quota <= 0) return fallback;
    const softCap = Math.max(64 * 1024 * 1024, Math.floor(quota - STORAGE_CAP_HEADROOM_BYTES));
    return Math.max(fallback, softCap);
  } catch {
    return fallback;
  }
}

async function ensureStorageCapacity(additionalBytes: number): Promise<void> {
  if (additionalBytes <= 0) return;
  const stats = await listBlobStats();
  const usedBytes = stats.reduce((sum, stat) => sum + stat.bytes, 0);
  const projectedBytes = usedBytes + additionalBytes;
  const capBytes = await getStorageCapBytes();
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
      sub: row.sub || "Imported",
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

type TrackHydrationOptions = {
  includeMediaUrls?: boolean;
  includeAudioUrl?: boolean;
  includeArtworkUrls?: boolean;
  includeBlobs?: boolean;
};

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

async function toTrack(record: TrackRecord, options?: TrackHydrationOptions): Promise<Track> {
  const includeMediaUrls = options?.includeMediaUrls !== false;
  const includeAudioUrl = includeMediaUrls && options?.includeAudioUrl !== false;
  const includeArtworkUrls = includeMediaUrls && options?.includeArtworkUrls !== false;
  const includeBlobs = options?.includeBlobs === true;
  // Self-heal older demo rows that may have lost audioKey but still have a playable demo video blob.
  const effectiveAudioKey = record.audioKey || (record.isDemo ? record.artVideoKey || null : null);
  const hasAudioSource = Boolean(record.bundledAudioUrl || effectiveAudioKey);
  const [audioBlob, artBlob] = includeBlobs
    ? await Promise.all([
        effectiveAudioKey ? getBlob(effectiveAudioKey) : Promise.resolve(null),
        record.artKey ? getBlob(record.artKey) : Promise.resolve(null)
      ])
    : [null, null];

  const audioUrl = includeAudioUrl ? record.bundledAudioUrl || (await getMediaUrl(effectiveAudioKey)) : record.bundledAudioUrl || undefined;
  const artUrl = includeArtworkUrls ? record.bundledArtUrl || (await getMediaUrl(record.artKey)) : record.bundledArtUrl || undefined;
  const artVideoUrl = includeArtworkUrls
    ? record.bundledArtVideoUrl || (await getMediaUrl(record.artVideoKey))
    : record.bundledArtVideoUrl || undefined;
  const missingAudio = !hasAudioSource;
  const missingArt =
    !record.bundledArtUrl &&
    !record.bundledArtVideoUrl &&
    ((Boolean(record.artKey) && !artUrl && !artBlob) || (Boolean(record.artVideoKey) && !artVideoUrl));

  return {
    id: record.id,
    demoId: record.demoId ?? undefined,
    isDemo: Boolean(record.isDemo),
    title: record.title,
    artist: record.artist ?? null,
    sub: record.sub === "Uploaded" ? "Imported" : (record.sub || "Imported"),
    aura: clampAura(record.aura),
    waveformPeaks:
      DEMO_WAVEFORM_PEAKS_BY_ID[record.demoId ?? ""] || DEMO_WAVEFORM_PEAKS_BY_ID[record.id] || undefined,
    audioUrl,
    artUrl,
    artVideoUrl,
    audioBlob: audioBlob ?? undefined,
    artBlob: artBlob ?? undefined,
    persistedId: record.id,
    hasAudioSource,
    missingAudio,
    missingArt,
    artworkSource: record.artworkSource === "auto" ? "auto" : "user"
  } satisfies Track;
}

export async function getTracksFromDb(options?: TrackHydrationOptions): Promise<Track[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const allTracks = await getAllTracksFromDb(options);
  const byId = new Map(allTracks.map((track) => [track.id, track] as const));
  const trackIds = getTrackOrder(library);
  return trackIds.map((id) => byId.get(id)).filter(Boolean) as Track[];
}

export async function getAllTracksFromDb(options?: TrackHydrationOptions): Promise<Track[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const records = Object.values(library.tracksById).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return Promise.all(records.map((record) => toTrack(record, options)));
}

export async function getTracksByIdsFromDb(trackIds: string[], options?: TrackHydrationOptions): Promise<Track[]> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const recordsById = new Map(Object.values(library.tracksById).map((record) => [record.id, record] as const));
  const hydrated = await Promise.all(
    trackIds.map(async (trackId) => {
      const record = recordsById.get(trackId);
      if (!record) return null;
      return toTrack(record, options);
    })
  );
  return hydrated.filter(Boolean) as Track[];
}

export async function getTrackPlaybackMediaFromDb(trackId: string): Promise<{ audioUrl?: string; artBlob?: Blob; missingAudio?: boolean }> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const record = library.tracksById[trackId];
  if (!record) return {};
  const effectiveAudioKey = record.audioKey || (record.isDemo ? record.artVideoKey || null : null);
  const hasAudioSource = Boolean(record.bundledAudioUrl || effectiveAudioKey);
  const artBlob = record.artKey ? await getBlob(record.artKey) : null;
  const audioUrl = record.bundledAudioUrl || (await getMediaUrl(effectiveAudioKey));
  return {
    audioUrl: audioUrl ?? undefined,
    artBlob: artBlob ?? undefined,
    missingAudio: hasAudioSource ? !audioUrl : true
  };
}

export async function getTrackAudioBlobFromDb(trackId: string): Promise<Blob | undefined> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const record = library.tracksById[trackId];
  if (!record) return undefined;
  const effectiveAudioKey = record.audioKey || (record.isDemo ? record.artVideoKey || null : null);
  const audioBlob = effectiveAudioKey ? await getBlob(effectiveAudioKey) : null;
  return audioBlob ?? undefined;
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
      const artUrl = record.bundledArtUrl || (await getMediaUrl(record.artKey));
      return {
        id: record.id,
        demoId: record.demoId ?? null,
        isDemo: Boolean(record.isDemo),
        title: record.title,
        artist: record.artist ?? null,
        sub: record.sub === "Uploaded" ? "Imported" : (record.sub || "Imported"),
        aura: clampAura(record.aura),
        artUrl,
        audioKey: record.audioKey,
        artKey: record.artKey,
        artVideoKey: record.artVideoKey || null,
        bundledAudioUrl: record.bundledAudioUrl || null,
        bundledArtUrl: record.bundledArtUrl || null,
        bundledArtVideoUrl: record.bundledArtVideoUrl || null,
        audioBytes: record.audioBytes,
        artworkBytes: record.artworkBytes,
        posterBytes: record.posterBytes,
        artworkSource: record.artworkSource === "auto" ? "auto" : "user",
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        missingAudio: !record.bundledAudioUrl && Boolean(record.audioKey) && !audioBlob,
        missingArt:
          !record.bundledArtUrl &&
          !record.bundledArtVideoUrl &&
          ((Boolean(record.artKey) && !artBlob) || (Boolean(record.artVideoKey) && !artVideoBlob))
      } satisfies DbTrackRecord;
    })
  );

  return rows;
}

export async function addTrackToDb(params: {
  trackId?: string;
  demoId?: string | null;
  isDemo?: boolean;
  targetPlaylistId?: string | null;
  title: string;
  artist?: string | null;
  sub?: string;
  audio: Blob;
  artPoster?: Blob | null;
  artVideo?: Blob | null;
}): Promise<void> {
  console.debug("[demo-seed]", {
    event: "db-write:start",
    trackId: params.trackId?.trim() || null,
    demoId: params.demoId || null,
    targetPlaylistId: params.targetPlaylistId || null
  });
  await maybeMigrateLegacyTracks();
  await initDB();

  const ts = now();
  const trackId = params.trackId?.trim() || makeId();
  const audioKey = makeId();
  const audioBytes = params.audio.size || 0;
  const artVideoBytes = params.artVideo?.size || 0;
  const shouldEvaluateLongIosAudioGuard = isIosSafari() && !params.artPoster && !params.artVideo;
  const longIosAudioBySize = shouldEvaluateLongIosAudioGuard && audioBytes > IOS_LONG_AUDIO_AUTO_ARTWORK_SKIP_BYTES;
  const audioDurationSec =
    shouldEvaluateLongIosAudioGuard && !longIosAudioBySize ? await getAudioDurationFromBlob(params.audio) : null;
  const longIosAudioByDuration =
    shouldEvaluateLongIosAudioGuard &&
    Number.isFinite(audioDurationSec) &&
    (audioDurationSec ?? 0) > IOS_LONG_AUDIO_AUTO_ARTWORK_SKIP_DURATION_SEC;
  const skipWaveformArtworkForLongIosAudio = longIosAudioBySize || longIosAudioByDuration;
  let artKey: string | null = null;
  let artVideoKey: string | null = null;
  let artworkSource: "auto" | "user" = "user";
  let artPoster = params.artPoster ?? null;
  let posterBytes = 0;
  const library = loadLibrary();
  const playlistId =
    params.targetPlaylistId && library.playlistsById[params.targetPlaylistId] ? params.targetPlaylistId : library.activePlaylistId;
  const playlist = playlistId ? library.playlistsById[playlistId] : undefined;
  if (!playlist && !params.isDemo) {
    throw new Error(IMPORT_REQUIRES_PLAYLIST_MESSAGE);
  }

  if (!artPoster && params.artVideo) {
    artPoster = await generateVideoPoster(params.artVideo).catch(() => null);
  }
  if (!artPoster && params.artVideo) {
    artPoster = await generateWaveformArtwork({
      audioBlob: params.audio,
      themeSelection: getStoredArtworkThemeSelection(),
      trackId
    }).catch(() => null);
    if (artPoster) artworkSource = "auto";
  }
  posterBytes = artPoster?.size || 0;
  await ensureStorageCapacity(audioBytes + artVideoBytes + posterBytes);
  const createdBlobKeys = new Set<string>();
  try {
    await putBlob(audioKey, params.audio, { type: "audio", createdAt: ts });
    createdBlobKeys.add(audioKey);
    if (artPoster) {
      artKey = makeId();
      await putBlob(artKey, artPoster, { type: "image", createdAt: ts });
      createdBlobKeys.add(artKey);
    }
    if (params.artVideo) {
      artVideoKey = makeId();
      await putBlob(artVideoKey, params.artVideo, { type: "video", createdAt: ts });
      createdBlobKeys.add(artVideoKey);
    }
    if (!artKey && !artVideoKey && !skipWaveformArtworkForLongIosAudio) {
      const generatedPoster = await generateWaveformArtwork({
        audioBlob: params.audio,
        themeSelection: getStoredArtworkThemeSelection(),
        trackId
      }).catch(() => null);
      if (generatedPoster) {
        artKey = makeId();
        posterBytes = generatedPoster.size || 0;
        await putBlob(artKey, generatedPoster, { type: "image", createdAt: ts });
        createdBlobKeys.add(artKey);
        artworkSource = "auto";
      }
    }
    if (skipWaveformArtworkForLongIosAudio) {
      const fallbackPoster = buildThemeNotePoster(getStoredArtworkThemeSelection());
      artKey = makeId();
      posterBytes = fallbackPoster.size || 0;
      await putBlob(artKey, fallbackPoster, { type: "image", createdAt: ts });
      createdBlobKeys.add(artKey);
      artworkSource = "auto";
      console.debug("[artwork:metadata-import]", {
        phase: "ios-long-audio-auto-art-skipped",
        trackId,
        audioBytes,
        audioDurationSec,
        thresholdBytes: IOS_LONG_AUDIO_AUTO_ARTWORK_SKIP_BYTES,
        thresholdDurationSec: IOS_LONG_AUDIO_AUTO_ARTWORK_SKIP_DURATION_SEC
      });
    }
  } catch (error) {
    await Promise.allSettled(
      Array.from(createdBlobKeys).map(async (key) => {
        await deleteBlob(key).catch(() => undefined);
        revokeMediaUrl(key);
      })
    );
    throw error;
  }

  library.tracksById[trackId] = {
    id: trackId,
    demoId: params.demoId || null,
    isDemo: Boolean(params.isDemo),
    title: params.title.trim() || "Untitled",
    sub: params.sub || "Imported",
    artist: params.artist?.trim() || null,
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

  console.debug("[artwork:metadata-import]", {
    phase: "db-store",
    trackId,
    storedArtworkMime: artPoster?.type || (artKey ? "image/png" : null),
    storedArtworkBytes: posterBytes,
    storedArtworkSource: artworkSource
  });
  if (playlist) {
    playlist.trackIds = [trackId, ...(playlist.trackIds || []).filter((id) => id !== trackId)];
    playlist.updatedAt = ts;
  }

  try {
    saveLibrary(library);
    console.debug("[demo-seed]", {
      event: "db-write:success",
      trackId,
      demoId: params.demoId || null,
      targetPlaylistId: playlistId || null,
      demoTrackExists: Boolean(library.tracksById["first-run-demo"]),
      demoPlaylistTrackIds: Array.isArray(library.playlistsById[params.targetPlaylistId || ""]?.trackIds)
        ? [...library.playlistsById[params.targetPlaylistId || ""]!.trackIds]
        : []
    });
  } catch (error) {
    await Promise.allSettled(
      [audioKey, artKey, artVideoKey]
        .filter((key): key is string => Boolean(key))
        .map(async (key) => {
          await deleteBlob(key).catch(() => undefined);
          revokeMediaUrl(key);
        })
    );
    console.error("[demo-seed]", {
      event: "db-write:failure",
      trackId,
      demoId: params.demoId || null,
      targetPlaylistId: playlistId || null,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
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
    if (sourceAudio) {
      nextArtPoster = await generateWaveformArtwork({
        audioBlob: sourceAudio,
        themeSelection: getStoredArtworkThemeSelection(),
        trackId
      }).catch(() => null);
    }
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

export async function duplicateTrackWithAudioInDb(
  sourceTrackId: string,
  audio: Blob,
  options?: { title?: string | null; sub?: string | null; targetPlaylistId?: string | null }
): Promise<string> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const source = library.tracksById[sourceTrackId];
  if (!source) throw new Error("Source track not found");

  const artPoster = source.artKey ? await getBlob(source.artKey) : null;
  const artVideo = source.artVideoKey ? await getBlob(source.artVideoKey) : null;
  const nextTrackId = makeId();

  await addTrackToDb({
    trackId: nextTrackId,
    targetPlaylistId: options?.targetPlaylistId ?? library.activePlaylistId,
    title: options?.title?.trim() || `${source.title} (Loop Crop)`,
    sub: options?.sub?.trim() || source.sub || "Imported",
    audio,
    artPoster,
    artVideo
  });

  return nextTrackId;
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

export async function regenerateAutoArtworkForThemeChangeInDb(themeSelection: ThemeSelection): Promise<number> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  let updated = 0;

  for (const track of Object.values(library.tracksById)) {
    if (track.artworkSource !== "auto" || !track.audioKey) continue;
    const sourceAudio = await getBlob(track.audioKey).catch(() => null);
    if (!sourceAudio) continue;

    const nextPoster = await generateWaveformArtwork({
      audioBlob: sourceAudio,
      themeSelection,
      trackId: track.id
    }).catch(() => null);
    if (!nextPoster) continue;

    const oldArtKey = track.artKey;
    const oldPosterBytes = track.posterBytes ?? 0;
    const nextPosterBytes = nextPoster.size ?? 0;
    await ensureStorageCapacity(nextPosterBytes - oldPosterBytes);

    const nextArtKey = makeId();
    await putBlob(nextArtKey, nextPoster, { type: "image", createdAt: now() });

    track.artKey = nextArtKey;
    track.posterBytes = nextPosterBytes;
    track.artworkBytes = Math.max(0, (track.artworkBytes ?? oldPosterBytes) - oldPosterBytes + nextPosterBytes);
    track.updatedAt = now();
    updated += 1;

    if (oldArtKey) {
      await deleteBlob(oldArtKey);
      revokeMediaUrl(oldArtKey);
    }
  }

  if (updated > 0) {
    saveLibrary(library);
  }

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

  const reset: LibraryState = {
    version: library.version,
    tracksById: {},
    playlistsById: {},
    activePlaylistId: null
  };
  clearCompetingLibraryCandidates();
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
  artist: string | null;
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

export type ClearPlaylistResult = {
  clearedPlaylistId: string;
  deletedTracks: number;
};

function ensureAtLeastOnePlaylist(library: LibraryState): void {
  const playlistIds = Object.keys(library.playlistsById);
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
  await updateTrackTextMetadataInDb(trackId, { title: newTitle });
}

export async function updateTrackTextMetadataInDb(
  trackId: string,
  next: { title: string; artist?: string | null }
): Promise<void> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const track = library.tracksById[trackId];
  if (!track) throw new Error("Track not found");
  const trimmed = next.title.trim();
  if (!trimmed) throw new Error("Title can't be empty.");
  track.title = trimmed;
  track.artist = next.artist?.trim() || null;
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

export async function clearPlaylistInDb(playlistId: string): Promise<ClearPlaylistResult> {
  await maybeMigrateLegacyTracks();
  const library = loadLibrary();
  const playlist = library.playlistsById[playlistId];
  if (!playlist) throw new Error("Playlist not found");

  const uniqueTrackIds = playlist.trackIds.filter((trackId, index, array) => Boolean(library.tracksById[trackId]) && array.indexOf(trackId) === index);
  playlist.trackIds = [];
  playlist.updatedAt = now();

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

  library.activePlaylistId = playlistId;
  saveLibrary(library);
  return {
    clearedPlaylistId: playlistId,
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
    capBytes: await getStorageCapBytes(),
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
        artist: track.artist?.trim() || null,
        totalBytes: audioBytes + artworkBytes,
        audioBytes,
        artworkBytes,
        posterBytes,
        updatedAt: track.updatedAt ?? track.createdAt ?? 0
      } satisfies TrackStorageRow;
    })
    .sort((a, b) => b.totalBytes - a.totalBytes);
}
