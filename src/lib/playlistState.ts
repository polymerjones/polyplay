import type { LibraryState } from "./storage/library";

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  trackIds: string[];
};

export type Track = {
  id: string;
  title?: string;
  addedAt: number;
  sourceType?: "local" | "vault";
  localRef?: unknown;
  vaultRef?: unknown;
  artwork?: unknown;
  aura?: unknown;
  fxState?: unknown;
  loopState?: unknown;
};

export type AppState = {
  version: string;
  playlists: Playlist[];
  tracksById: Record<string, Track>;
  activePlaylistId: string | null;
  lastActivePlaylistId: string | null;
};

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ensureActivePlaylistState(state: AppState): AppState {
  if (!state.playlists.length) {
    if (state.activePlaylistId === null && state.lastActivePlaylistId === null) return state;
    return { ...state, activePlaylistId: null, lastActivePlaylistId: null };
  }

  const preferredId = state.lastActivePlaylistId ?? state.activePlaylistId;
  const exists = Boolean(preferredId && state.playlists.some((playlist) => playlist.id === preferredId));
  const id = exists ? (preferredId as string) : state.playlists[0].id;
  if (state.activePlaylistId === id && state.lastActivePlaylistId === id) return state;
  return { ...state, activePlaylistId: id, lastActivePlaylistId: id };
}

export function getActivePlaylist(state: AppState): Playlist | null {
  if (!state.playlists.length) return null;
  const found = state.playlists.find((playlist) => playlist.id === state.activePlaylistId);
  return found ?? state.playlists[0];
}

export function createPlaylist(state: AppState, name: string): AppState {
  const id = makeId("playlist");
  const now = Date.now();
  const next: Playlist = {
    id,
    name: name?.trim() || "New Playlist",
    createdAt: now,
    updatedAt: now,
    trackIds: []
  };
  return ensureActivePlaylistState({
    ...state,
    playlists: [next, ...state.playlists],
    activePlaylistId: id,
    lastActivePlaylistId: id
  });
}

export function setActivePlaylist(state: AppState, id: string): AppState {
  const exists = state.playlists.some((playlist) => playlist.id === id);
  if (!exists) return ensureActivePlaylistState(state);
  return ensureActivePlaylistState({
    ...state,
    activePlaylistId: id,
    lastActivePlaylistId: id
  });
}

export function addTrackToActivePlaylist(state: AppState, trackPartial: Partial<Track>): AppState {
  const nextState = ensureActivePlaylistState(state);
  const active = getActivePlaylist(nextState);
  if (!active) return nextState;
  const now = Date.now();
  const id = trackPartial.id ?? makeId("track");
  const track: Track = {
    id,
    addedAt: now,
    ...trackPartial
  };
  return {
    ...nextState,
    tracksById: { ...nextState.tracksById, [id]: track },
    playlists: nextState.playlists.map((playlist) =>
      playlist.id !== active.id
        ? playlist
        : {
            ...playlist,
            trackIds: [id, ...playlist.trackIds],
            updatedAt: now
          }
    )
  };
}

export function deletePlaylist(state: AppState, id: string): AppState {
  return ensureActivePlaylistState({
    ...state,
    playlists: state.playlists.filter((playlist) => playlist.id !== id)
  });
}

function dedupeTrackIds(trackIds: string[], tracksById: LibraryState["tracksById"]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const trackId of trackIds) {
    if (!tracksById[trackId]) continue;
    if (seen.has(trackId)) continue;
    seen.add(trackId);
    result.push(trackId);
  }
  return result;
}

export function ensureActivePlaylist(
  library: LibraryState,
  preferredPlaylistId?: string | null
): { library: LibraryState; changed: boolean } {
  const next: LibraryState = {
    ...library,
    playlistsById: { ...library.playlistsById }
  };
  let changed = false;

  for (const [playlistId, playlist] of Object.entries(next.playlistsById)) {
    const nextTrackIds = dedupeTrackIds(playlist.trackIds || [], next.tracksById);
    if (nextTrackIds.length !== (playlist.trackIds || []).length) {
      next.playlistsById[playlistId] = {
        ...playlist,
        trackIds: nextTrackIds,
        updatedAt: Date.now()
      };
      changed = true;
    }
  }

  const playlistIds = Object.keys(next.playlistsById);
  if (!playlistIds.length) {
    const orphanTrackIds = Object.values(next.tracksById)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .map((track) => track.id);
    if (orphanTrackIds.length > 0) {
      const now = Date.now();
      const recoveredId = "default";
      next.playlistsById[recoveredId] = {
        id: recoveredId,
        name: "Recovered Playlist",
        trackIds: orphanTrackIds,
        createdAt: now,
        updatedAt: now
      };
      next.activePlaylistId = recoveredId;
      changed = true;
      return { library: next, changed };
    }
    if (next.activePlaylistId !== null) changed = true;
    next.activePlaylistId = null;
    return { library: next, changed };
  }

  // Only honor preferred id when there's no valid active playlist already.
  if ((!next.activePlaylistId || !next.playlistsById[next.activePlaylistId]) && preferredPlaylistId && next.playlistsById[preferredPlaylistId]) {
    if (next.activePlaylistId !== preferredPlaylistId) changed = true;
    next.activePlaylistId = preferredPlaylistId;
    return { library: next, changed };
  }

  if (next.activePlaylistId && next.playlistsById[next.activePlaylistId]) {
    return { library: next, changed };
  }

  const fallbackId = playlistIds[0] ?? null;
  if (next.activePlaylistId !== fallbackId) changed = true;
  next.activePlaylistId = fallbackId;
  return { library: next, changed };
}

export function setActivePlaylistInLibrary(library: LibraryState, id: string): { library: LibraryState; changed: boolean } {
  if (!library.playlistsById[id]) return ensureActivePlaylist(library);
  const current = library.playlistsById[id];
  return {
    library: {
      ...library,
      activePlaylistId: id,
      playlistsById: {
        ...library.playlistsById,
        [id]: { ...current, updatedAt: Date.now() }
      }
    },
    changed: true
  };
}

export function createPlaylistInLibrary(
  library: LibraryState,
  name: string
): { library: LibraryState; createdPlaylistId: string } {
  const now = Date.now();
  const id = makeId("playlist");
  const next = {
    ...library,
    playlistsById: {
      ...library.playlistsById,
      [id]: {
        id,
        name: name.trim() || "New Playlist",
        trackIds: [],
        createdAt: now,
        updatedAt: now
      }
    },
    activePlaylistId: id
  };
  return { library: next, createdPlaylistId: id };
}
