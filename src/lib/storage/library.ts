export type TrackRecord = {
  id: string;
  title: string;
  sub?: string | null;
  artist: string | null;
  duration: number | null;
  aura: number;
  audioKey: string | null;
  artKey: string | null;
  artVideoKey?: string | null;
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

export const LIBRARY_STORAGE_KEY = "showoff_library_v1";
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
      title: (t.title || "").trim() || "Untitled",
      sub: t.sub ?? "Uploaded",
      artist: t.artist ?? null,
      duration: Number.isFinite(t.duration) ? Number(t.duration) : null,
      aura: Math.max(0, Math.min(5, Math.round(Number(t.aura ?? 0)))),
      audioKey: t.audioKey || null,
      artKey: t.artKey || null,
      artVideoKey: t.artVideoKey || null,
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

export function loadLibrary(): LibraryState {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return createEmptyLibrary();
    const parsed = JSON.parse(raw) as unknown;
    return migrateLibraryIfNeeded(parsed);
  } catch {
    return createEmptyLibrary();
  }
}

export function saveLibrary(libraryState: LibraryState): void {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(migrateLibraryIfNeeded(libraryState)));
}

