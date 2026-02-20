export type TrackRecord = {
  id: string;
  demoId?: string | null;
  isDemo?: boolean;
  title: string;
  sub?: string | null;
  artist: string | null;
  duration: number | null;
  aura: number;
  audioKey: string | null;
  artKey: string | null;
  artVideoKey?: string | null;
  audioBytes?: number;
  artworkBytes?: number;
  posterBytes?: number;
  artworkSource?: "auto" | "user";
  autoArtwork?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PlaylistRecord = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type LibraryState = {
  version: number;
  tracksById: Record<string, TrackRecord>;
  playlistsById: Record<string, PlaylistRecord>;
  activePlaylistId: string | null;
};

export const LIBRARY_KEY = "showoff_library_v1";
export const LIBRARY_STORAGE_KEY = LIBRARY_KEY;
const LIBRARY_VERSION = 1;
const DEFAULT_PLAYLIST_ID = "default";

function now(): number {
  return Date.now();
}

export function createEmptyLibrary(): LibraryState {
  const ts = now();
  return {
    version: LIBRARY_VERSION,
    tracksById: {},
    playlistsById: {
      [DEFAULT_PLAYLIST_ID]: {
        id: DEFAULT_PLAYLIST_ID,
        name: "My Playlist",
        trackIds: [],
        createdAt: ts,
        updatedAt: ts
      }
    },
    activePlaylistId: DEFAULT_PLAYLIST_ID
  };
}

export function migrateLibraryIfNeeded(input: unknown): LibraryState {
  if (!input || typeof input !== "object") return createEmptyLibrary();
  const data = input as Partial<LibraryState>;
  const base = createEmptyLibrary();

  const tracksById: Record<string, TrackRecord> = {};
  for (const [id, track] of Object.entries(data.tracksById || {})) {
    if (!track || typeof track !== "object") continue;
    const t = track as Partial<TrackRecord>;
    const createdAt = Number.isFinite(t.createdAt) ? Number(t.createdAt) : now();
    const updatedAt = Number.isFinite(t.updatedAt) ? Number(t.updatedAt) : createdAt;
    tracksById[id] = {
      id,
      demoId: typeof t.demoId === "string" ? t.demoId : null,
      isDemo: Boolean(t.isDemo),
      title: (t.title || "").trim() || "Untitled",
      sub: t.sub ?? "Uploaded",
      artist: t.artist ?? null,
      duration: Number.isFinite(t.duration) ? Number(t.duration) : null,
      aura: Math.max(0, Math.min(5, Math.round(Number(t.aura ?? 0)))),
      audioKey: t.audioKey || null,
      artKey: t.artKey || null,
      artVideoKey: t.artVideoKey || null,
      audioBytes: Number.isFinite(t.audioBytes) ? Number(t.audioBytes) : undefined,
      artworkBytes: Number.isFinite(t.artworkBytes) ? Number(t.artworkBytes) : undefined,
      posterBytes: Number.isFinite(t.posterBytes) ? Number(t.posterBytes) : undefined,
      artworkSource:
        t.artworkSource === "auto" || t.artworkSource === "user" ? t.artworkSource : Boolean(t.autoArtwork) ? "auto" : "user",
      autoArtwork: Boolean(t.autoArtwork),
      createdAt,
      updatedAt
    };
  }

  const playlistsById: Record<string, PlaylistRecord> = {};
  for (const [id, playlist] of Object.entries(data.playlistsById || {})) {
    if (!playlist || typeof playlist !== "object") continue;
    const p = playlist as Partial<PlaylistRecord>;
    const createdAt = Number.isFinite(p.createdAt) ? Number(p.createdAt) : now();
    const updatedAt = Number.isFinite(p.updatedAt) ? Number(p.updatedAt) : createdAt;
    playlistsById[id] = {
      id,
      name: (p.name || "").trim() || "Playlist",
      trackIds: (p.trackIds || []).filter((trackId): trackId is string => typeof trackId === "string"),
      createdAt,
      updatedAt
    };
  }

  if (!Object.keys(playlistsById).length) {
    playlistsById[DEFAULT_PLAYLIST_ID] = base.playlistsById[DEFAULT_PLAYLIST_ID];
  }

  const activePlaylistId =
    typeof data.activePlaylistId === "string" && playlistsById[data.activePlaylistId]
      ? data.activePlaylistId
      : Object.keys(playlistsById)[0] || null;

  return {
    version: LIBRARY_VERSION,
    tracksById,
    playlistsById,
    activePlaylistId
  };
}

function parseLibraryJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getLibraryLastUpdatedAt(library: LibraryState): number {
  let latest = 0;
  for (const track of Object.values(library.tracksById || {})) {
    const value = Number(track.updatedAt ?? track.createdAt ?? 0);
    if (Number.isFinite(value) && value > latest) latest = value;
  }
  for (const playlist of Object.values(library.playlistsById || {})) {
    const value = Number(playlist.updatedAt ?? playlist.createdAt ?? 0);
    if (Number.isFinite(value) && value > latest) latest = value;
  }
  return latest;
}

export type LibraryCandidateSummary = {
  key: string;
  tracksByIdCount: number;
  playlistsByIdCount: number;
  lastUpdatedAt: number;
};

export function getLibraryCandidates(): LibraryCandidateSummary[] {
  const summaries: LibraryCandidateSummary[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const parsed = parseLibraryJson(localStorage.getItem(key));
      if (!parsed || typeof parsed !== "object") continue;
      const maybeLibrary = parsed as { tracksById?: unknown; playlistsById?: unknown };
      if (!maybeLibrary.tracksById || !maybeLibrary.playlistsById) continue;
      const normalized = migrateLibraryIfNeeded(parsed);
      summaries.push({
        key,
        tracksByIdCount: Object.keys(normalized.tracksById || {}).length,
        playlistsByIdCount: Object.keys(normalized.playlistsById || {}).length,
        lastUpdatedAt: getLibraryLastUpdatedAt(normalized)
      });
    }
  } catch {
    return [];
  }
  return summaries.sort((a, b) => {
    if (b.tracksByIdCount !== a.tracksByIdCount) return b.tracksByIdCount - a.tracksByIdCount;
    return b.lastUpdatedAt - a.lastUpdatedAt;
  });
}

export function migrateBestLibraryCandidateToPrimary(): {
  migrated: boolean;
  fromKey: string | null;
  library: LibraryState;
  candidateKeys: string[];
} {
  const primaryParsed = parseLibraryJson(localStorage.getItem(LIBRARY_STORAGE_KEY));
  const primaryLibrary = migrateLibraryIfNeeded(primaryParsed);
  const primaryTrackCount = Object.keys(primaryLibrary.tracksById || {}).length;
  const candidates = getLibraryCandidates();
  const candidateKeys = candidates.map((candidate) => candidate.key);
  const best = candidates.find((candidate) => candidate.key !== LIBRARY_STORAGE_KEY);
  if (!best) {
    return { migrated: false, fromKey: null, library: primaryLibrary, candidateKeys };
  }
  if (best.tracksByIdCount <= primaryTrackCount) {
    return { migrated: false, fromKey: null, library: primaryLibrary, candidateKeys };
  }
  const bestParsed = parseLibraryJson(localStorage.getItem(best.key));
  const bestLibrary = migrateLibraryIfNeeded(bestParsed);
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(bestLibrary));
  return { migrated: true, fromKey: best.key, library: bestLibrary, candidateKeys };
}

export function loadLibrary(): LibraryState {
  try {
    const primaryRaw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    const primaryLibrary = migrateLibraryIfNeeded(parseLibraryJson(primaryRaw));
    const primaryTrackCount = Object.keys(primaryLibrary.tracksById || {}).length;
    if (!primaryRaw || primaryTrackCount === 0) {
      const migrated = migrateBestLibraryCandidateToPrimary();
      if (migrated.migrated) return migrated.library;
    }
    return primaryLibrary;
  } catch {
    return createEmptyLibrary();
  }
}

export function saveLibrary(libraryState: LibraryState): void {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(migrateLibraryIfNeeded(libraryState)));
}
