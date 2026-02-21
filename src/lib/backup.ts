import { APP_VERSION } from "../config/version";
import {
  DEFAULT_GRATITUDE_SETTINGS,
  GRATITUDE_ENTRIES_KEY,
  type GratitudeEntry,
  type GratitudeSettings,
  loadGratitudeSettings,
  saveGratitudeSettings
} from "./gratitude";
import { getLibrary, setLibrary } from "./library";
import { deleteBlob, getBlob, listBlobStats, putBlob } from "./storage/db";
import {
  createEmptyLibrary,
  loadLibrary,
  migrateLibraryIfNeeded,
  saveLibrary,
  type LibraryState,
  type TrackRecord
} from "./storage/library";

const LAYOUT_MODE_KEY = "polyplay_layoutMode";
const THEME_MODE_KEY = "polyplay_themeMode";
const SHUFFLE_ENABLED_KEY = "polyplay_shuffleEnabled";
const REPEAT_TRACK_KEY = "polyplay_repeatTrackEnabled";
const HAS_IMPORTED_KEY = "polyplay_hasImported";
const LOOP_REGION_KEY = "polyplay_loopByTrack";
const LOOP_MODE_KEY = "polyplay_loopModeByTrack";

const BACKUP_ROOT = "polyplay-backup";
const BACKUP_CAP_BYTES = 250 * 1024 * 1024;
const FULL_BACKUP_VERSION = 1;
const POLYPLAYLIST_ROOT = "polyplaylist";
const POLYPLAYLIST_VERSION = 1;

export type LoopRegion = {
  start: number;
  end: number;
  active: boolean;
  editing: boolean;
};

export type LoopMode = "off" | "track" | "region";

export type TrackConfigEntry = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  aura: number;
  loopMode?: LoopMode;
  loopRegion?: LoopRegion;
};

export type PolyplayConfig = {
  kind: "polyplay-config";
  version: 1;
  appVersion: string;
  createdAt: string;
  settings: {
    themeMode: "light" | "dark";
    layoutMode: "grid" | "list";
    shuffleEnabled: boolean;
    repeatTrackEnabled: boolean;
  };
  flags: {
    hasImported: boolean;
  };
  gratitude: GratitudeSettings;
  tracks: TrackConfigEntry[];
};

export type FullBackupManifest = {
  kind: "polyplay-full-backup";
  version: number;
  appVersion: string;
  createdAt: string;
  config: PolyplayConfig;
  library: LibraryState;
  gratitude: GratitudeEntry[];
};

export type ImportConfigSummary = {
  appliedTrackCount: number;
  skippedTrackCount: number;
  skippedTrackIds: string[];
};

export type BackupProgress = {
  done: number;
  total: number;
  label: string;
};

export type ExportFullBackupResult = {
  blob: Blob;
  estimatedBytes: number;
  trackCount: number;
};

export type ExportPolyplaylistResult = {
  blob: Blob;
  estimatedBytes: number;
  trackCount: number;
  playlistName: string;
};

export type PolyplaylistTrackConfig = {
  title: string;
  aura: number;
  loop: {
    mode: LoopMode;
    in: number | null;
    out: number | null;
  };
  artworkMode: "auto" | "user";
};

export type PolyplaylistConfigV1 = {
  format: "polyplaylist";
  level: 1;
  version: "1.0";
  playlistName: string;
  exportedAt: string;
  appVersion: string;
  trackOrder: string[];
  tracks: Record<string, PolyplaylistTrackConfig>;
  global: {
    layoutMode: "grid" | "list";
    theme: "light" | "dark";
  };
};

export type ApplyPolyplaylistConfigResult = {
  playlistName: string;
  updatedTrackCount: number;
  missingTrackIds: string[];
  totalTrackOrderCount: number;
  foundLocallyCount: number;
  reorderedCount: number;
  targetPlaylistId: string;
  debug: {
    importedTrackOrderCount: number;
    localTracksByIdCount: number;
    localPlaylistsByIdCount: number;
    matchedCount: number;
    missingCount: number;
    importedIdSample: string[];
    localIdSample: string[];
    resultingOrderSample: string[];
    activePlaylistId: string | null;
  };
  sourceMismatch: boolean;
};

export type ImportFullBackupResult = {
  restoredTracks: number;
  restoredMediaFiles: number;
  skippedTrackCount: number;
};

export type ImportPolyplaylistResult = {
  playlistId: string;
  playlistName: string;
  importedTracks: number;
  importedMediaFiles: number;
};

export type PolyplaylistManifest = {
  kind: "polyplaylist";
  version: number;
  appVersion: string;
  createdAt: string;
  playlist: {
    id: string;
    name: string;
    trackIds: string[];
  };
  tracksById: Record<string, TrackRecord>;
};

export class BackupSizeError extends Error {
  readonly estimatedBytes: number;
  readonly capBytes: number;

  constructor(estimatedBytes: number, capBytes: number) {
    super("Backup too large");
    this.name = "BackupSizeError";
    this.estimatedBytes = estimatedBytes;
    this.capBytes = capBytes;
  }
}

function clampAura(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(5, Math.round(num)));
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readLoopState(): { loopByTrack: Record<string, LoopRegion>; loopModeByTrack: Record<string, LoopMode> } {
  const rawRegions = safeJsonParse<Record<string, unknown>>(localStorage.getItem(LOOP_REGION_KEY), {});
  const rawModes = safeJsonParse<Record<string, unknown>>(localStorage.getItem(LOOP_MODE_KEY), {});

  const loopByTrack: Record<string, LoopRegion> = {};
  for (const [trackId, value] of Object.entries(rawRegions)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Partial<LoopRegion>;
    const start = Number(row.start);
    const end = Number(row.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    loopByTrack[trackId] = {
      start: Math.max(0, start),
      end: Math.max(start + 0.1, end),
      active: Boolean(row.active),
      editing: Boolean(row.editing)
    };
  }

  const loopModeByTrack: Record<string, LoopMode> = {};
  for (const [trackId, value] of Object.entries(rawModes)) {
    if (value === "off" || value === "track" || value === "region") loopModeByTrack[trackId] = value;
  }

  return { loopByTrack, loopModeByTrack };
}

function writeLoopState(loopByTrack: Record<string, LoopRegion>, loopModeByTrack: Record<string, LoopMode>): void {
  localStorage.setItem(LOOP_REGION_KEY, JSON.stringify(loopByTrack));
  localStorage.setItem(LOOP_MODE_KEY, JSON.stringify(loopModeByTrack));
}

function asTheme(value: unknown): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

function asLayout(value: unknown): "grid" | "list" {
  return value === "list" ? "list" : "grid";
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function nowIso(): string {
  return new Date().toISOString();
}

function getMimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function extFromMime(mime: string, fallback: string): string {
  const normalized = (mime || "").toLowerCase();
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("mp4") && normalized.startsWith("audio/")) return "m4a";
  if (normalized.includes("aac")) return "aac";
  if (normalized.includes("flac")) return "flac";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("quicktime")) return "mov";
  if (normalized.includes("mp4") && normalized.startsWith("video/")) return "mp4";
  return fallback;
}

function makeBlobKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function formatStampWithTime(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hh}${mm}`;
}

function nextPolyplaylistIndexFromNames(names: string[]): number {
  const used = names
    .map((name) => {
      const match = name.trim().match(/^polyplaylist(\d+)$/i);
      return match ? Number(match[1]) : NaN;
    })
    .filter((value) => Number.isFinite(value));
  if (!used.length) return 1;
  return Math.max(...used) + 1;
}

export function buildConfigSnapshot(): PolyplayConfig {
  const library = loadLibrary();
  const { loopByTrack, loopModeByTrack } = readLoopState();

  const tracks: TrackConfigEntry[] = Object.values(library.tracksById)
    .map((track) => ({
      id: track.id,
      title: track.title,
      createdAt: track.createdAt,
      updatedAt: track.updatedAt,
      aura: clampAura(track.aura),
      loopMode: loopModeByTrack[track.id],
      loopRegion: loopByTrack[track.id]
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    kind: "polyplay-config",
    version: 1,
    appVersion: APP_VERSION,
    createdAt: nowIso(),
    settings: {
      themeMode: asTheme(localStorage.getItem(THEME_MODE_KEY)),
      layoutMode: asLayout(localStorage.getItem(LAYOUT_MODE_KEY)),
      shuffleEnabled: asBoolean(localStorage.getItem(SHUFFLE_ENABLED_KEY)),
      repeatTrackEnabled: asBoolean(localStorage.getItem(REPEAT_TRACK_KEY))
    },
    flags: {
      hasImported: asBoolean(localStorage.getItem(HAS_IMPORTED_KEY))
    },
    gratitude: loadGratitudeSettings(),
    tracks
  };
}

export function getConfigExportFilename(): string {
  return `polyplay-config-${formatStamp()}.json`;
}

export function getGratitudeBackupFilename(): string {
  return `polyplay-gratitude-${formatStamp()}.json`;
}

export function getFullBackupFilename(): string {
  return `polyplay-backup-${formatStamp()}.zip`;
}

export function getNextDefaultPolyplaylistName(): string {
  const library = loadLibrary();
  const names = Object.values(library.playlistsById).map((playlist) => playlist.name || "");
  return `polyplaylist${nextPolyplaylistIndexFromNames(names)}`;
}

export function getPolyplaylistConfigFilename(): string {
  return `polyplaylist-${formatStampWithTime()}.polyplaylist.json`;
}

function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

export function getPolyplaylistFilename(playlistName = "playlist"): string {
  const slug = slugifyName(playlistName) || "playlist";
  return `polyplaylist-${slug}-${formatStamp()}.polyplaylist`;
}

export function serializeConfig(config = buildConfigSnapshot()): string {
  return JSON.stringify(config, null, 2);
}

export function serializeGratitudeJson(): string {
  const payload = {
    kind: "polyplay-gratitude",
    version: 1,
    appVersion: APP_VERSION,
    createdAt: nowIso(),
    settings: loadGratitudeSettings(),
    entries: safeJsonParse<GratitudeEntry[]>(localStorage.getItem(GRATITUDE_ENTRIES_KEY), [])
  };
  return JSON.stringify(payload, null, 2);
}

function normalizeImportedConfig(input: unknown): PolyplayConfig {
  if (!input || typeof input !== "object") throw new Error("Invalid config file.");
  const value = input as Partial<PolyplayConfig>;
  if (value.kind !== "polyplay-config") throw new Error("Unsupported config type.");

  const settings = value.settings ?? {
    themeMode: "light",
    layoutMode: "grid",
    shuffleEnabled: false,
    repeatTrackEnabled: false
  };

  const gratitude = value.gratitude ?? DEFAULT_GRATITUDE_SETTINGS;

  const tracks: TrackConfigEntry[] = [];
  if (Array.isArray(value.tracks)) {
    for (const row of value.tracks) {
      if (!row || typeof row !== "object") continue;
      const item = row as Partial<TrackConfigEntry>;
      if (typeof item.id !== "string" || !item.id) continue;
      const loopMode = item.loopMode === "off" || item.loopMode === "track" || item.loopMode === "region" ? item.loopMode : undefined;
      const loopRegion =
        item.loopRegion &&
        Number.isFinite(item.loopRegion.start) &&
        Number.isFinite(item.loopRegion.end) &&
        item.loopRegion.end > item.loopRegion.start
          ? {
              start: Number(item.loopRegion.start),
              end: Number(item.loopRegion.end),
              active: Boolean(item.loopRegion.active),
              editing: Boolean(item.loopRegion.editing)
            }
          : undefined;
      tracks.push({
        id: item.id,
        title: typeof item.title === "string" ? item.title : "Untitled",
        createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now(),
        updatedAt: Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : Date.now(),
        aura: clampAura(Number(item.aura ?? 0)),
        loopMode,
        loopRegion
      });
    }
  }

  return {
    kind: "polyplay-config",
    version: 1,
    appVersion: typeof value.appVersion === "string" ? value.appVersion : APP_VERSION,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : nowIso(),
    settings: {
      themeMode: asTheme(settings.themeMode),
      layoutMode: asLayout(settings.layoutMode),
      shuffleEnabled: asBoolean(settings.shuffleEnabled),
      repeatTrackEnabled: asBoolean(settings.repeatTrackEnabled)
    },
    flags: {
      hasImported: asBoolean(value.flags?.hasImported)
    },
    gratitude: {
      enabled: gratitude.enabled !== false,
      frequency:
        gratitude.frequency === "daily" ||
        gratitude.frequency === "weekly" ||
        gratitude.frequency === "launch" ||
        gratitude.frequency === "off"
          ? gratitude.frequency
          : "daily",
      doNotSaveText: Boolean(gratitude.doNotSaveText),
      doNotPromptAgain: Boolean(gratitude.doNotPromptAgain)
    },
    tracks
  };
}

export function parseConfigImportText(content: string): PolyplayConfig {
  const parsed = JSON.parse(content) as unknown;
  return normalizeImportedConfig(parsed);
}

export function applyImportedConfig(config: PolyplayConfig): ImportConfigSummary {
  localStorage.setItem(THEME_MODE_KEY, config.settings.themeMode);
  localStorage.setItem(LAYOUT_MODE_KEY, config.settings.layoutMode);
  localStorage.setItem(SHUFFLE_ENABLED_KEY, config.settings.shuffleEnabled ? "true" : "false");
  localStorage.setItem(REPEAT_TRACK_KEY, config.settings.repeatTrackEnabled ? "true" : "false");
  localStorage.setItem(HAS_IMPORTED_KEY, config.flags.hasImported ? "true" : "false");
  saveGratitudeSettings(config.gratitude);

  const library = loadLibrary();
  const loopByTrack: Record<string, LoopRegion> = {};
  const loopModeByTrack: Record<string, LoopMode> = {};

  let appliedTrackCount = 0;
  const skippedTrackIds: string[] = [];

  for (const row of config.tracks) {
    const track = library.tracksById[row.id];
    if (!track) {
      skippedTrackIds.push(row.id);
      continue;
    }
    track.aura = clampAura(row.aura);
    track.updatedAt = Date.now();
    if (row.loopMode) loopModeByTrack[row.id] = row.loopMode;
    if (row.loopRegion) loopByTrack[row.id] = row.loopRegion;
    appliedTrackCount += 1;
  }

  saveLibrary(library);
  writeLoopState(loopByTrack, loopModeByTrack);

  return {
    appliedTrackCount,
    skippedTrackCount: skippedTrackIds.length,
    skippedTrackIds
  };
}

function normalizePolyplaylistTrackConfig(input: unknown): PolyplaylistTrackConfig | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Partial<PolyplaylistTrackConfig>;
  const loop: Partial<PolyplaylistTrackConfig["loop"]> =
    row.loop && typeof row.loop === "object" ? row.loop : {};
  const loopMode: LoopMode =
    loop.mode === "off" || loop.mode === "track" || loop.mode === "region" ? loop.mode : "off";
  const loopIn = Number(loop.in);
  const loopOut = Number(loop.out);
  return {
    title: typeof row.title === "string" ? row.title : "Untitled",
    aura: clampAura(Number(row.aura ?? 0)),
    loop: {
      mode: loopMode,
      in: Number.isFinite(loopIn) ? loopIn : null,
      out: Number.isFinite(loopOut) ? loopOut : null
    },
    artworkMode: row.artworkMode === "auto" ? "auto" : "user"
  };
}

function normalizePolyplaylistConfig(input: unknown): PolyplaylistConfigV1 {
  if (!input || typeof input !== "object") throw new Error("Invalid PolyPlaylist file.");
  const value = input as Partial<PolyplaylistConfigV1>;
  if (value.format !== "polyplaylist") throw new Error("Unsupported PolyPlaylist format.");
  if (value.level !== 1) throw new Error("Unsupported PolyPlaylist level.");
  if (value.version !== "1.0") throw new Error("Unsupported PolyPlaylist version.");

  const trackOrder = Array.isArray(value.trackOrder)
    ? value.trackOrder.filter((trackId): trackId is string => typeof trackId === "string")
    : [];
  const tracks: Record<string, PolyplaylistTrackConfig> = {};
  if (value.tracks && typeof value.tracks === "object") {
    for (const [trackId, raw] of Object.entries(value.tracks)) {
      const parsed = normalizePolyplaylistTrackConfig(raw);
      if (!parsed) continue;
      tracks[trackId] = parsed;
    }
  }

  return {
    format: "polyplaylist",
    level: 1,
    version: "1.0",
    playlistName: (value.playlistName || "").trim() || "My PolyPlaylist",
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : nowIso(),
    appVersion: typeof value.appVersion === "string" ? value.appVersion : APP_VERSION,
    trackOrder,
    tracks,
    global: {
      layoutMode: asLayout(value.global?.layoutMode),
      theme: asTheme(value.global?.theme)
    }
  };
}

function resolveImportPlaylistName(library: LibraryState, incomingName: string, activePlaylistId: string): string {
  const normalizedIncoming = (incomingName || "").trim() || getNextDefaultPolyplaylistName();
  const lowerIncoming = normalizedIncoming.toLowerCase();
  const conflict = Object.values(library.playlistsById).some(
    (playlist) => playlist.id !== activePlaylistId && playlist.name.trim().toLowerCase() === lowerIncoming
  );
  if (!conflict) return normalizedIncoming;
  const names = Object.values(library.playlistsById).map((playlist) => playlist.name || "");
  return `polyplaylist${nextPolyplaylistIndexFromNames(names)}`;
}

function resolveTrackKey(library: LibraryState, requestedId: string): string | null {
  if (library.tracksById[requestedId]) return requestedId;
  for (const [key, track] of Object.entries(library.tracksById)) {
    if (track.id === requestedId) return key;
  }
  return null;
}

export async function buildPolyplaylistConfig(
  playlistName: string,
  options?: { playlistId?: string | null; sourceLibrary?: LibraryState | null }
): Promise<PolyplaylistConfigV1> {
  const library = options?.sourceLibrary ? migrateLibraryIfNeeded(options.sourceLibrary) : await getLibrary();
  const targetPlaylistId =
    options?.playlistId && library.playlistsById[options.playlistId] ? options.playlistId : library.activePlaylistId;
  const targetPlaylist = targetPlaylistId ? library.playlistsById[targetPlaylistId] : undefined;
  if (!targetPlaylist) throw new Error("No active playlist available.");
  const { loopByTrack, loopModeByTrack } = readLoopState();
  const safeName = playlistName.trim() || getNextDefaultPolyplaylistName();
  const trackOrder = targetPlaylist.trackIds
    .map((trackId) => resolveTrackKey(library, trackId))
    .filter((trackId): trackId is string => Boolean(trackId));
  const tracks: Record<string, PolyplaylistTrackConfig> = {};

  for (const trackId of trackOrder) {
    const row = library.tracksById[trackId];
    if (!row) continue;
    const loopMode = loopModeByTrack[trackId] ?? "off";
    const loopRegion = loopByTrack[trackId];
    tracks[trackId] = {
      title: row.title || "Untitled",
      aura: clampAura(row.aura),
      loop: {
        mode: loopMode,
        in: loopRegion ? loopRegion.start : null,
        out: loopRegion ? loopRegion.end : null
      },
      artworkMode: row.artworkSource === "auto" ? "auto" : "user"
    };
  }

  return {
    format: "polyplaylist",
    level: 1,
    version: "1.0",
    playlistName: safeName,
    exportedAt: nowIso(),
    appVersion: APP_VERSION,
    trackOrder,
    tracks,
    global: {
      layoutMode: asLayout(localStorage.getItem(LAYOUT_MODE_KEY)),
      theme: asTheme(localStorage.getItem(THEME_MODE_KEY))
    }
  };
}

export async function serializePolyplaylistConfig(
  playlistName: string,
  options?: { playlistId?: string | null; sourceLibrary?: LibraryState | null }
): Promise<string> {
  return JSON.stringify(await buildPolyplaylistConfig(playlistName, options), null, 2);
}

export async function applyImportedPolyplaylistConfig(
  content: string,
  options?: { targetPlaylistId?: string | null; sourceLibrary?: LibraryState | null }
): Promise<ApplyPolyplaylistConfigResult> {
  const payload = normalizePolyplaylistConfig(JSON.parse(content) as unknown);
  const library = options?.sourceLibrary ? migrateLibraryIfNeeded(options.sourceLibrary) : await getLibrary();
  const targetPlaylistId =
    options?.targetPlaylistId && library.playlistsById[options.targetPlaylistId]
      ? options.targetPlaylistId
      : library.activePlaylistId;
  if (!targetPlaylistId) throw new Error("No target playlist to apply import.");
  const targetPlaylist = library.playlistsById[targetPlaylistId];
  if (!targetPlaylist) throw new Error("Target playlist not found.");

  const resolvedPlaylistName = resolveImportPlaylistName(library, payload.playlistName, targetPlaylistId);
  targetPlaylist.name = resolvedPlaylistName;
  localStorage.setItem(LAYOUT_MODE_KEY, payload.global.layoutMode);
  localStorage.setItem(THEME_MODE_KEY, payload.global.theme);

  const { loopByTrack, loopModeByTrack } = readLoopState();
  const missingTrackIds: string[] = [];
  let updatedTrackCount = 0;
  let foundLocallyCount = 0;
  const previousOrder = targetPlaylist.trackIds.filter((trackId) => Boolean(library.tracksById[trackId]));
  const localTrackIds = Object.keys(library.tracksById);
  const importedIdSample = payload.trackOrder.slice(0, 5);
  const localIdSample = localTrackIds.slice(0, 5);
  if (localTrackIds.length === 0) {
    return {
      playlistName: targetPlaylist.name,
      updatedTrackCount: 0,
      missingTrackIds: payload.trackOrder.slice(),
      totalTrackOrderCount: payload.trackOrder.length,
      foundLocallyCount: 0,
      reorderedCount: 0,
      targetPlaylistId,
      debug: {
        importedTrackOrderCount: payload.trackOrder.length,
        localTracksByIdCount: 0,
        localPlaylistsByIdCount: Object.keys(library.playlistsById || {}).length,
        matchedCount: 0,
        missingCount: payload.trackOrder.length,
        importedIdSample,
        localIdSample,
        resultingOrderSample: [],
        activePlaylistId: library.activePlaylistId
      },
      sourceMismatch: true
    };
  }

  console.log("[polyplaylist-import:start]", {
    targetPlaylistId,
    playlistName: payload.playlistName,
    importedTrackOrderCount: payload.trackOrder.length,
    localTracksByIdCount: localTrackIds.length,
    importedIdSample,
    localIdSample
  });

  for (const trackId of payload.trackOrder) {
    const localTrackKey = resolveTrackKey(library, trackId);
    const localTrack = localTrackKey ? library.tracksById[localTrackKey] : undefined;
    const importedTrack = payload.tracks[trackId] ?? (localTrackKey ? payload.tracks[localTrackKey] : undefined);
    if (!localTrack) {
      missingTrackIds.push(trackId);
      continue;
    }
    foundLocallyCount += 1;
    if (!importedTrack) continue;

    localTrack.title = importedTrack.title.trim() || localTrack.title;
    localTrack.aura = clampAura(importedTrack.aura);
    localTrack.artworkSource = importedTrack.artworkMode === "auto" ? "auto" : "user";
    localTrack.updatedAt = Date.now();

    loopModeByTrack[localTrack.id] = importedTrack.loop.mode;
    if (
      importedTrack.loop.mode === "region" &&
      Number.isFinite(importedTrack.loop.in) &&
      Number.isFinite(importedTrack.loop.out) &&
      Number(importedTrack.loop.out) > Number(importedTrack.loop.in)
    ) {
      loopByTrack[localTrack.id] = {
        start: Math.max(0, Number(importedTrack.loop.in)),
        end: Number(importedTrack.loop.out),
        active: true,
        editing: false
      };
    } else {
      delete loopByTrack[localTrack.id];
    }
    updatedTrackCount += 1;
  }

  const seen = new Set<string>();
  const orderedByImport: string[] = [];
  for (const trackId of payload.trackOrder) {
    const localTrackKey = resolveTrackKey(library, trackId);
    if (!localTrackKey) continue;
    if (seen.has(localTrackKey)) continue;
    orderedByImport.push(localTrackKey);
    seen.add(localTrackKey);
  }
  const previousOrderSet = new Set(orderedByImport);
  const remainingLocalIds = previousOrder.filter((trackId) => !previousOrderSet.has(trackId));
  const nextOrder = orderedByImport.length > 0 ? [...orderedByImport, ...remainingLocalIds] : previousOrder;
  targetPlaylist.trackIds = nextOrder;
  library.activePlaylistId = targetPlaylistId;
  targetPlaylist.updatedAt = Date.now();

  let reorderedCount = 0;
  const maxLen = Math.max(previousOrder.length, nextOrder.length);
  for (let i = 0; i < maxLen; i += 1) {
    if ((previousOrder[i] ?? null) !== (nextOrder[i] ?? null)) reorderedCount += 1;
  }

  setLibrary(library);
  writeLoopState(loopByTrack, loopModeByTrack);

  console.log("[polyplaylist-import:end]", {
    targetPlaylistId,
    playlistName: resolvedPlaylistName,
    importedTrackOrderCount: payload.trackOrder.length,
    matched: foundLocallyCount,
    missing: missingTrackIds.length
  });

  return {
    playlistName: resolvedPlaylistName,
    updatedTrackCount,
    missingTrackIds,
    totalTrackOrderCount: payload.trackOrder.length,
    foundLocallyCount,
    reorderedCount,
    targetPlaylistId,
    debug: {
      importedTrackOrderCount: payload.trackOrder.length,
      localTracksByIdCount: localTrackIds.length,
      localPlaylistsByIdCount: Object.keys(library.playlistsById || {}).length,
      matchedCount: foundLocallyCount,
      missingCount: missingTrackIds.length,
      importedIdSample,
      localIdSample,
      resultingOrderSample: nextOrder.slice(0, 10),
      activePlaylistId: library.activePlaylistId
    },
    sourceMismatch: false
  };
}

type ZipEntryInput = {
  path: string;
  bytes: Uint8Array;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

async function buildZip(entries: ZipEntryInput[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path.replace(/^\/+/, ""));
    const dataBytes = entry.bytes;
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, 0);
    writeU16(localView, 12, 0);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, dataBytes.length);
    writeU32(localView, 22, dataBytes.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, 0);
    writeU16(centralView, 14, 0);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, dataBytes.length);
    writeU32(centralView, 24, dataBytes.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeU32(eocdView, 0, 0x06054b50);
  writeU16(eocdView, 4, 0);
  writeU16(eocdView, 6, 0);
  writeU16(eocdView, 8, entries.length);
  writeU16(eocdView, 10, entries.length);
  writeU32(eocdView, 12, centralSize);
  writeU32(eocdView, 16, offset);
  writeU16(eocdView, 20, 0);

  const parts: ArrayBuffer[] = [
    ...localParts.map((part) => uint8ToArrayBuffer(part)),
    ...centralParts.map((part) => uint8ToArrayBuffer(part)),
    uint8ToArrayBuffer(eocd)
  ];
  return new Blob(parts, { type: "application/zip" });
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function parseZipEntries(buffer: ArrayBuffer): Map<string, Uint8Array> {
  const bytes = new Uint8Array(buffer);
  const minEocdSize = 22;
  let eocdOffset = -1;
  for (let i = bytes.length - minEocdSize; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Invalid ZIP file.");

  const totalEntries = readU16(bytes, eocdOffset + 10);
  const centralOffset = readU32(bytes, eocdOffset + 16);

  const result = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (readU32(bytes, cursor) !== 0x02014b50) throw new Error("Invalid ZIP central directory.");
    const compressionMethod = readU16(bytes, cursor + 10);
    const compressedSize = readU32(bytes, cursor + 20);
    const uncompressedSize = readU32(bytes, cursor + 24);
    const fileNameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localHeaderOffset = readU32(bytes, cursor + 42);

    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameEnd));

    if (readU32(bytes, localHeaderOffset) !== 0x04034b50) {
      throw new Error("Invalid ZIP local header.");
    }
    const localFileNameLength = readU16(bytes, localHeaderOffset + 26);
    const localExtraLength = readU16(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;

    if (compressionMethod !== 0) {
      throw new Error("Unsupported ZIP compression in file. Please import a Polyplay-generated backup.");
    }

    const dataEnd = dataStart + compressedSize;
    const fileBytes = bytes.slice(dataStart, dataEnd);
    if (fileBytes.length !== uncompressedSize) {
      throw new Error("Corrupt ZIP entry.");
    }
    result.set(name, fileBytes);

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return result;
}

function findEntryByPrefix(entries: Map<string, Uint8Array>, prefix: string): { path: string; data: Uint8Array } | null {
  for (const [path, data] of entries.entries()) {
    if (path.startsWith(prefix)) return { path, data };
  }
  return null;
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function buildTrackMediaEntries(
  tracks: TrackRecord[],
  rootPath: string,
  progressLabelPrefix: string,
  onProgress?: (progress: BackupProgress) => void
): Promise<{ entries: ZipEntryInput[]; mediaBytes: number; mediaCount: number }> {
  const entries: ZipEntryInput[] = [];
  let mediaBytes = 0;
  let mediaCount = 0;

  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    onProgress?.({
      done: index,
      total: tracks.length,
      label: `${progressLabelPrefix} (${index}/${tracks.length} tracks)`
    });

    const collect = async (key: string | null | undefined, kind: "audio" | "artwork" | "video", fallbackExt: string) => {
      if (!key) return;
      const blob = await getBlob(key);
      if (!blob) return;
      const bytes = await blobToBytes(blob);
      const ext = extFromMime(blob.type || "", fallbackExt);
      const filename =
        kind === "audio"
          ? `audio.${ext}`
          : kind === "video"
            ? `artwork-video.${ext}`
            : `artwork.${ext}`;
      entries.push({
        path: `${rootPath}/media/${track.id}/${filename}`,
        bytes
      });
      mediaBytes += bytes.length;
      mediaCount += 1;
    };

    await collect(track.audioKey, "audio", "bin");
    await collect(track.artKey, "artwork", "png");
    await collect(track.artVideoKey, "video", "mp4");
  }

  onProgress?.({
    done: tracks.length,
    total: tracks.length,
    label: `${progressLabelPrefix} (${tracks.length}/${tracks.length} tracks)`
  });

  return { entries, mediaBytes, mediaCount };
}

export async function exportFullBackup(
  onProgress?: (progress: BackupProgress) => void
): Promise<ExportFullBackupResult> {
  const library = loadLibrary();
  const config = buildConfigSnapshot();
  const gratitudeEntries = safeJsonParse<GratitudeEntry[]>(localStorage.getItem(GRATITUDE_ENTRIES_KEY), []);
  const allTracks = Object.values(library.tracksById);

  const { entries: mediaEntries, mediaBytes } = await buildTrackMediaEntries(
    allTracks,
    BACKUP_ROOT,
    "Preparing backup…",
    onProgress
  );
  const jsonEntries: ZipEntryInput[] = [
    {
      path: `${BACKUP_ROOT}/config.json`,
      bytes: new TextEncoder().encode(serializeConfig(config))
    },
    {
      path: `${BACKUP_ROOT}/gratitude.json`,
      bytes: new TextEncoder().encode(serializeGratitudeJson())
    },
    {
      path: `${BACKUP_ROOT}/library.json`,
      bytes: new TextEncoder().encode(JSON.stringify(migrateLibraryIfNeeded(library), null, 2))
    },
    {
      path: `${BACKUP_ROOT}/manifest.json`,
      bytes: new TextEncoder().encode(
        JSON.stringify(
          {
            kind: "polyplay-full-backup",
            version: FULL_BACKUP_VERSION,
            appVersion: APP_VERSION,
            createdAt: nowIso(),
            config,
            gratitude: gratitudeEntries,
            library: migrateLibraryIfNeeded(library)
          } satisfies FullBackupManifest,
          null,
          2
        )
      )
    }
  ];

  const estimatedBytes =
    mediaBytes + jsonEntries.reduce((sum, entry) => sum + entry.bytes.length, 0) + 1024 * Math.max(1, mediaEntries.length);
  if (estimatedBytes > BACKUP_CAP_BYTES) {
    throw new BackupSizeError(estimatedBytes, BACKUP_CAP_BYTES);
  }

  onProgress?.({ done: 0, total: 1, label: "Building zip archive…" });
  const blob = await buildZip([...jsonEntries, ...mediaEntries]);
  onProgress?.({ done: 1, total: 1, label: "Backup ready." });

  return {
    blob,
    estimatedBytes,
    trackCount: Object.keys(library.tracksById).length
  };
}

function makeRecordId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toUniquePlaylistName(library: LibraryState, desiredName: string): string {
  const base = desiredName.trim() || "Imported Polyplaylist";
  const taken = new Set(Object.values(library.playlistsById).map((playlist) => playlist.name));
  if (!taken.has(base)) return base;
  let index = 2;
  let candidate = `${base} (${index})`;
  while (taken.has(candidate)) {
    index += 1;
    candidate = `${base} (${index})`;
  }
  return candidate;
}

function normalizeImportedPolyplaylist(input: unknown): PolyplaylistManifest {
  if (!input || typeof input !== "object") throw new Error("Invalid polyplaylist manifest.");
  const value = input as Partial<PolyplaylistManifest>;
  if (value.kind !== "polyplaylist") throw new Error("Unsupported playlist package.");
  const playlistName = (value.playlist?.name || "").trim() || "Imported Polyplaylist";
  const playlistTrackIds = Array.isArray(value.playlist?.trackIds)
    ? value.playlist.trackIds.filter((trackId): trackId is string => typeof trackId === "string")
    : [];

  const normalizedLibrary = migrateLibraryIfNeeded({
    version: 1,
    tracksById: value.tracksById ?? {},
    playlistsById: {
      imported: {
        id: "imported",
        name: playlistName,
        trackIds: playlistTrackIds,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    },
    activePlaylistId: "imported"
  });

  const normalizedTrackIds = normalizedLibrary.playlistsById.imported.trackIds.filter(
    (trackId) => Boolean(normalizedLibrary.tracksById[trackId])
  );

  return {
    kind: "polyplaylist",
    version: Number.isFinite(value.version) ? Number(value.version) : POLYPLAYLIST_VERSION,
    appVersion: typeof value.appVersion === "string" ? value.appVersion : APP_VERSION,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : nowIso(),
    playlist: {
      id: typeof value.playlist?.id === "string" ? value.playlist.id : "imported",
      name: playlistName,
      trackIds: normalizedTrackIds
    },
    tracksById: normalizedLibrary.tracksById
  };
}

export async function exportPolyplaylist(
  onProgress?: (progress: BackupProgress) => void
): Promise<ExportPolyplaylistResult> {
  const library = loadLibrary();
  const activePlaylist = library.activePlaylistId ? library.playlistsById[library.activePlaylistId] : undefined;
  if (!activePlaylist) throw new Error("No active playlist to export.");

  const trackIds = activePlaylist.trackIds.filter((trackId) => Boolean(library.tracksById[trackId]));
  if (!trackIds.length) throw new Error("Active playlist has no tracks.");

  const tracks = trackIds.map((trackId) => library.tracksById[trackId]).filter(Boolean);
  const tracksById = Object.fromEntries(tracks.map((track) => [track.id, track]));

  const { entries: mediaEntries, mediaBytes } = await buildTrackMediaEntries(
    tracks,
    POLYPLAYLIST_ROOT,
    "Preparing polyplaylist…",
    onProgress
  );

  const manifest: PolyplaylistManifest = {
    kind: "polyplaylist",
    version: POLYPLAYLIST_VERSION,
    appVersion: APP_VERSION,
    createdAt: nowIso(),
    playlist: {
      id: activePlaylist.id,
      name: activePlaylist.name || "My Playlist",
      trackIds
    },
    tracksById
  };

  const manifestEntry: ZipEntryInput = {
    path: `${POLYPLAYLIST_ROOT}/manifest.json`,
    bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2))
  };

  const estimatedBytes = mediaBytes + manifestEntry.bytes.length + 1024 * Math.max(1, mediaEntries.length);
  if (estimatedBytes > BACKUP_CAP_BYTES) {
    throw new BackupSizeError(estimatedBytes, BACKUP_CAP_BYTES);
  }

  onProgress?.({ done: 0, total: 1, label: "Building polyplaylist archive…" });
  const blob = await buildZip([manifestEntry, ...mediaEntries]);
  onProgress?.({ done: 1, total: 1, label: "Polyplaylist ready." });

  return {
    blob,
    estimatedBytes,
    trackCount: trackIds.length,
    playlistName: manifest.playlist.name
  };
}

export async function importPolyplaylist(file: File): Promise<ImportPolyplaylistResult> {
  const raw = await file.arrayBuffer();
  const zipEntries = parseZipEntries(raw);
  const manifestEntry = zipEntries.get(`${POLYPLAYLIST_ROOT}/manifest.json`);
  if (!manifestEntry) throw new Error("Polyplaylist package is missing manifest.json.");

  const manifest = normalizeImportedPolyplaylist(JSON.parse(new TextDecoder().decode(manifestEntry)) as unknown);
  if (!manifest.playlist.trackIds.length) throw new Error("Polyplaylist has no tracks.");

  const library = loadLibrary();
  const nowMs = Date.now();
  const playlistId = makeRecordId();
  const playlistName = toUniquePlaylistName(library, manifest.playlist.name);
  const importedTrackIds: string[] = [];
  let importedMediaFiles = 0;

  for (let index = 0; index < manifest.playlist.trackIds.length; index += 1) {
    const sourceTrackId = manifest.playlist.trackIds[index];
    const sourceTrack = manifest.tracksById[sourceTrackId];
    if (!sourceTrack) continue;

    const nextTrackId = makeRecordId();
    const nextTrack = sanitizeTrackForRestore({
      ...sourceTrack,
      id: nextTrackId,
      createdAt: nowMs + index,
      updatedAt: nowMs + index
    });

    const audioEntry = findEntryByPrefix(zipEntries, `${POLYPLAYLIST_ROOT}/media/${sourceTrackId}/audio.`);
    if (audioEntry) {
      const blob = new Blob([uint8ToArrayBuffer(audioEntry.data)], { type: getMimeFromPath(audioEntry.path) });
      const key = makeBlobKey();
      await putBlob(key, blob, { type: "audio" });
      nextTrack.audioKey = key;
      nextTrack.audioBytes = blob.size;
      importedMediaFiles += 1;
    }

    const artEntry = findEntryByPrefix(zipEntries, `${POLYPLAYLIST_ROOT}/media/${sourceTrackId}/artwork.`);
    if (artEntry) {
      const blob = new Blob([uint8ToArrayBuffer(artEntry.data)], { type: getMimeFromPath(artEntry.path) });
      const key = makeBlobKey();
      await putBlob(key, blob, { type: "image" });
      nextTrack.artKey = key;
      nextTrack.posterBytes = blob.size;
      nextTrack.artworkBytes = (nextTrack.artworkBytes ?? 0) + blob.size;
      importedMediaFiles += 1;
    }

    const artVideoEntry = findEntryByPrefix(zipEntries, `${POLYPLAYLIST_ROOT}/media/${sourceTrackId}/artwork-video.`);
    if (artVideoEntry) {
      const blob = new Blob([uint8ToArrayBuffer(artVideoEntry.data)], { type: getMimeFromPath(artVideoEntry.path) });
      const key = makeBlobKey();
      await putBlob(key, blob, { type: "video" });
      nextTrack.artVideoKey = key;
      nextTrack.artworkBytes = (nextTrack.artworkBytes ?? 0) + blob.size;
      importedMediaFiles += 1;
    }

    library.tracksById[nextTrackId] = nextTrack;
    importedTrackIds.push(nextTrackId);
  }

  if (!importedTrackIds.length) {
    throw new Error("Polyplaylist import failed: no tracks could be restored.");
  }

  library.playlistsById[playlistId] = {
    id: playlistId,
    name: playlistName,
    trackIds: importedTrackIds,
    createdAt: nowMs,
    updatedAt: nowMs
  };
  library.activePlaylistId = playlistId;
  saveLibrary(library);

  return {
    playlistId,
    playlistName,
    importedTracks: importedTrackIds.length,
    importedMediaFiles
  };
}

async function clearAllStoredBlobs(): Promise<void> {
  const stats = await listBlobStats();
  for (const stat of stats) {
    await deleteBlob(stat.key);
  }
}

function normalizeImportedLibrary(input: unknown): LibraryState {
  return migrateLibraryIfNeeded(input);
}

function sanitizeTrackForRestore(base: TrackRecord): TrackRecord {
  return {
    ...base,
    aura: clampAura(base.aura),
    audioKey: null,
    artKey: null,
    artVideoKey: null,
    audioBytes: 0,
    artworkBytes: 0,
    posterBytes: 0,
    updatedAt: Number.isFinite(base.updatedAt) ? base.updatedAt : Date.now(),
    createdAt: Number.isFinite(base.createdAt) ? base.createdAt : Date.now()
  };
}

export async function importFullBackup(file: File): Promise<ImportFullBackupResult> {
  const raw = await file.arrayBuffer();
  const zipEntries = parseZipEntries(raw);

  const configEntry = zipEntries.get(`${BACKUP_ROOT}/config.json`);
  const libraryEntry = zipEntries.get(`${BACKUP_ROOT}/library.json`);
  const gratitudeEntry = zipEntries.get(`${BACKUP_ROOT}/gratitude.json`);

  if (!configEntry || !libraryEntry) {
    throw new Error("Backup zip is missing config/library files.");
  }

  const decoder = new TextDecoder();
  const importedConfig = parseConfigImportText(decoder.decode(configEntry));
  const importedLibrary = normalizeImportedLibrary(JSON.parse(decoder.decode(libraryEntry)) as unknown);

  let restoredMediaFiles = 0;
  const restoredTracks: Record<string, TrackRecord> = {};

  await clearAllStoredBlobs();

  for (const [trackId, track] of Object.entries(importedLibrary.tracksById)) {
    const nextTrack = sanitizeTrackForRestore(track);

    const audioEntry = findEntryByPrefix(zipEntries, `${BACKUP_ROOT}/media/${trackId}/audio.`);
    if (audioEntry) {
      const blob = new Blob([uint8ToArrayBuffer(audioEntry.data)], { type: getMimeFromPath(audioEntry.path) });
      const key = makeBlobKey();
      await putBlob(key, blob, { type: "audio" });
      nextTrack.audioKey = key;
      nextTrack.audioBytes = blob.size;
      restoredMediaFiles += 1;
    }

    const artEntry = findEntryByPrefix(zipEntries, `${BACKUP_ROOT}/media/${trackId}/artwork.`);
    if (artEntry) {
      const blob = new Blob([uint8ToArrayBuffer(artEntry.data)], { type: getMimeFromPath(artEntry.path) });
      const key = makeBlobKey();
      await putBlob(key, blob, { type: "image" });
      nextTrack.artKey = key;
      nextTrack.posterBytes = blob.size;
      nextTrack.artworkBytes = (nextTrack.artworkBytes ?? 0) + blob.size;
      restoredMediaFiles += 1;
    }

    const artVideoEntry = findEntryByPrefix(zipEntries, `${BACKUP_ROOT}/media/${trackId}/artwork-video.`);
    if (artVideoEntry) {
      const blob = new Blob([uint8ToArrayBuffer(artVideoEntry.data)], { type: getMimeFromPath(artVideoEntry.path) });
      const key = makeBlobKey();
      await putBlob(key, blob, { type: "video" });
      nextTrack.artVideoKey = key;
      nextTrack.artworkBytes = (nextTrack.artworkBytes ?? 0) + blob.size;
      restoredMediaFiles += 1;
    }

    restoredTracks[trackId] = nextTrack;
  }

  const restoredLibrary = createEmptyLibrary();
  restoredLibrary.tracksById = restoredTracks;
  restoredLibrary.playlistsById = importedLibrary.playlistsById;
  restoredLibrary.activePlaylistId = importedLibrary.activePlaylistId;

  for (const playlist of Object.values(restoredLibrary.playlistsById)) {
    playlist.trackIds = playlist.trackIds.filter((trackId) => Boolean(restoredTracks[trackId]));
  }

  if (!restoredLibrary.activePlaylistId || !restoredLibrary.playlistsById[restoredLibrary.activePlaylistId]) {
    const firstPlaylistId = Object.keys(restoredLibrary.playlistsById)[0] ?? null;
    restoredLibrary.activePlaylistId = firstPlaylistId;
  }

  saveLibrary(restoredLibrary);
  const summary = applyImportedConfig(importedConfig);

  if (gratitudeEntry) {
    try {
      const gratitudePayload = JSON.parse(decoder.decode(gratitudeEntry)) as {
        settings?: GratitudeSettings;
        entries?: GratitudeEntry[];
      };
      if (gratitudePayload.settings) saveGratitudeSettings(gratitudePayload.settings);
      if (Array.isArray(gratitudePayload.entries)) {
        localStorage.setItem(GRATITUDE_ENTRIES_KEY, JSON.stringify(gratitudePayload.entries));
      }
    } catch {
      // Ignore malformed gratitude payload.
    }
  }

  return {
    restoredTracks: Object.keys(restoredTracks).length,
    restoredMediaFiles,
    skippedTrackCount: summary.skippedTrackCount
  };
}
