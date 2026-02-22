import type { LibraryState } from "./storage/library";

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
    if (next.activePlaylistId !== null) changed = true;
    next.activePlaylistId = null;
    return { library: next, changed };
  }

  if (preferredPlaylistId && next.playlistsById[preferredPlaylistId]) {
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
