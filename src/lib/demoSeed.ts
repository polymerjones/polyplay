import demoAudioAssetUrl from "../assets/demo/demo-audio.mp3";
import demoArtAssetUrl from "../assets/demo/demo-art.mp4";
import demoStillAssetUrl from "../assets/demo/demo-still.png";
import { generateVideoPoster } from "./artwork/videoPoster";
import { getLibrary, setLibrary } from "./library";
import { deleteBlob, getBlob, putBlob } from "./storage/db";
import type { LibraryState, PlaylistRecord, TrackRecord } from "./storage/library";

const DEMO_SEED_DONE_KEY = "polyplay_demo_seed_done_v1";
const DEMO_PLAYLIST_ID = "polyplaylist-demo";
const DEMO_PLAYLIST_NAME = "Demo Playlist";
const LEGACY_DEMO_IDS = new Set(["first-run-demo-1", "first-run-demo-2"]);

const DEMO_TRACKS = [
  {
    demoId: "first-run-demo",
    title: "Welcome to PolyPlay v1",
    audioUrl: demoAudioAssetUrl,
    artworkUrl: demoStillAssetUrl,
    artworkVideoUrl: demoArtAssetUrl
  }
] as const;
const DEMO_IDS: Set<string> = new Set(DEMO_TRACKS.map((track) => track.demoId));

function logDemoSeed(event: string, details?: Record<string, unknown>) {
  console.debug("[demo-seed]", { event, ...details });
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureDemoPlaylist(library: LibraryState, makeActive: boolean) {
  const now = Date.now();
  const existingById = library.playlistsById[DEMO_PLAYLIST_ID];
  if (existingById) {
    if (existingById.name !== DEMO_PLAYLIST_NAME) existingById.name = DEMO_PLAYLIST_NAME;
    existingById.updatedAt = now;
    if (makeActive) library.activePlaylistId = DEMO_PLAYLIST_ID;
    return library;
  }

  const existingByName = Object.values(library.playlistsById).find(
    (playlist) => playlist.name.trim().toLowerCase() === DEMO_PLAYLIST_NAME.toLowerCase()
  );
  if (existingByName) {
    existingByName.updatedAt = now;
    if (makeActive) library.activePlaylistId = existingByName.id;
    return library;
  }

  library.playlistsById[DEMO_PLAYLIST_ID] = {
    id: DEMO_PLAYLIST_ID,
    name: DEMO_PLAYLIST_NAME,
    trackIds: [],
    createdAt: now,
    updatedAt: now
  };
  if (makeActive) library.activePlaylistId = DEMO_PLAYLIST_ID;
  return library;
}

function makeFallbackPoster(title: string): Blob | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 1200, 1200);
  grad.addColorStop(0, "#2a1647");
  grad.addColorStop(1, "#0a1020");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(360, 360, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(189,132,255,0.95)";
  ctx.font = "bold 76px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("POLYPLAY", 600, 560);
  ctx.fillStyle = "rgba(233,242,255,0.85)";
  ctx.font = "600 44px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(title || "Demo Track", 600, 640);
  const dataUrl = canvas.toDataURL("image/png");
  const bytes = atob(dataUrl.split(",")[1] || "");
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: "image/png" });
}

async function ensureDemoPostersIfMissing(library: LibraryState): Promise<number> {
  let repaired = 0;
  let touched = false;
  for (const track of Object.values(library.tracksById || {})) {
    if (!(track?.isDemo || (track?.demoId ? DEMO_IDS.has(track.demoId) : false))) continue;
    if (track.artKey) continue;
    if (!track.artVideoKey) continue;
    const artVideoBlob = await getBlob(track.artVideoKey);
    if (!artVideoBlob) continue;
    const posterBlob = (await generateVideoPoster(artVideoBlob).catch(() => null)) ?? makeFallbackPoster(track.title);
    if (!posterBlob) continue;
    const posterKey = makeId("poster");
    await putBlob(posterKey, posterBlob, { type: "image" });
    track.artKey = posterKey;
    track.posterBytes = posterBlob.size;
    track.artworkBytes = Math.max(track.artworkBytes ?? 0, posterBlob.size);
    track.updatedAt = Date.now();
    repaired += 1;
    touched = true;
  }
  if (touched) setLibrary(library);
  return repaired;
}

function collectDemoTrackIds(library: LibraryState): string[] {
  return Object.values(library.tracksById || {})
    .filter((track) => (track.demoId ? DEMO_IDS.has(track.demoId) : false))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .map((track) => track.id);
}

function ensureDemoPlaylistAttachment(library: LibraryState): boolean {
  const demoTrackIds = collectDemoTrackIds(library);
  const demoPlaylist =
    library.playlistsById[DEMO_PLAYLIST_ID] ||
    Object.values(library.playlistsById || {}).find(
      (playlist) => playlist.name.trim().toLowerCase() === DEMO_PLAYLIST_NAME.toLowerCase()
    );
  const beforeTrackIds = Array.isArray(demoPlaylist?.trackIds) ? [...demoPlaylist.trackIds] : [];
  if (!demoPlaylist || demoTrackIds.length === 0) return false;
  const existing = Array.isArray(demoPlaylist.trackIds) ? demoPlaylist.trackIds : [];
  const missing = demoTrackIds.filter((id) => !existing.includes(id));
  if (missing.length === 0) return false;
  demoPlaylist.trackIds = [...existing, ...missing];
  demoPlaylist.updatedAt = Date.now();
  console.debug("[demoSeed] ensureDemoPlaylistAttachment", {
    demoPlaylistId: demoPlaylist.id,
    beforeTrackIds,
    afterTrackIds: [...demoPlaylist.trackIds],
    attachedDemoTrackIds: demoTrackIds
  });
  return true;
}

function getDemoCandidatesForSeed(library: LibraryState, demoId: string): TrackRecord[] {
  return Object.values(library.tracksById || {}).filter(
    (track) =>
      track.demoId === demoId ||
      track.id === demoId ||
      (track.demoId ? LEGACY_DEMO_IDS.has(track.demoId) : false) ||
      LEGACY_DEMO_IDS.has(track.id)
  );
}

function getDemoTrackScore(track: TrackRecord, canonicalId: string): number {
  return [
    track.id === canonicalId ? 64 : 0,
    track.demoId === canonicalId ? 32 : 0,
    track.artKey ? 16 : 0,
    track.artVideoKey ? 8 : 0,
    track.audioKey ? 4 : 0,
    track.posterBytes && track.posterBytes > 0 ? 2 : 0,
    track.artworkBytes && track.artworkBytes > 0 ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function pickCanonicalDemoTrack(candidates: TrackRecord[], canonicalId: string): TrackRecord {
  return [...candidates].sort((a, b) => {
    const scoreDiff = getDemoTrackScore(b, canonicalId) - getDemoTrackScore(a, canonicalId);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  })[0]!;
}

async function deleteTrackArtifacts(track: TrackRecord): Promise<void> {
  const keys = [track.audioKey, track.artKey, track.artVideoKey].filter(Boolean) as string[];
  for (const key of keys) {
    await deleteBlob(key).catch(() => undefined);
  }
}

function upsertBuiltInDemoTrack(
  library: LibraryState,
  demo: (typeof DEMO_TRACKS)[number],
  options?: { preferDemoActive?: boolean }
): LibraryState {
  const next = ensureDemoPlaylist(library, Boolean(options?.preferDemoActive));
  const current = next.tracksById[demo.demoId];
  const ts = Date.now();
  next.tracksById[demo.demoId] = {
    id: demo.demoId,
    demoId: demo.demoId,
    isDemo: true,
    title: demo.title,
    sub: "Demo",
    artist: current?.artist ?? null,
    duration: current?.duration ?? null,
    aura: current?.aura ?? 0,
    audioKey: null,
    artKey: null,
    artVideoKey: null,
    bundledAudioUrl: demo.audioUrl,
    bundledArtUrl: demo.artworkUrl,
    bundledArtVideoUrl: demo.artworkVideoUrl,
    artworkSource: current?.artworkSource ?? "user",
    createdAt: current?.createdAt ?? ts,
    updatedAt: ts
  };
  const demoPlaylist = next.playlistsById[DEMO_PLAYLIST_ID];
  demoPlaylist.trackIds = [demo.demoId, ...(demoPlaylist.trackIds || []).filter((id) => id !== demo.demoId)];
  demoPlaylist.updatedAt = ts;
  setLibrary(next);
  return next;
}

export async function normalizeDemoLibrary(options?: { preferDemoActive?: boolean }): Promise<{
  normalized: boolean;
  removedTrackIds: string[];
  canonicalTrackIds: string[];
}> {
  let library = await getLibrary();
  const now = Date.now();
  let normalized = false;
  const removedTrackIds: string[] = [];
  const duplicatePlaylistIds = Object.values(library.playlistsById || {})
    .filter((playlist) => playlist.id !== DEMO_PLAYLIST_ID && playlist.name.trim().toLowerCase() === DEMO_PLAYLIST_NAME.toLowerCase())
    .map((playlist) => playlist.id);

  if (duplicatePlaylistIds.length > 0) {
    const nextPlaylistsById = { ...library.playlistsById };
    for (const playlistId of duplicatePlaylistIds) delete nextPlaylistsById[playlistId];
    library = { ...library, playlistsById: nextPlaylistsById };
    normalized = true;
  }

  library = ensureDemoPlaylist(library, Boolean(options?.preferDemoActive));

  const canonicalTrackIds: string[] = [];
  const tracksById = { ...library.tracksById };
  for (const demo of DEMO_TRACKS) {
    const candidates = getDemoCandidatesForSeed({ ...library, tracksById }, demo.demoId);
    if (candidates.length === 0) continue;

    const keeper = pickCanonicalDemoTrack(candidates, demo.demoId);
    const canonicalId = demo.demoId;
    const canonicalTrack: TrackRecord = {
      ...keeper,
      id: canonicalId,
      demoId: canonicalId,
      isDemo: true,
      title: demo.title,
      sub: "Demo",
      updatedAt: now
    };

    if (keeper.id !== canonicalId || keeper.demoId !== canonicalId || keeper.title !== demo.title || keeper.sub !== "Demo" || !keeper.isDemo) {
      delete tracksById[keeper.id];
      tracksById[canonicalId] = canonicalTrack;
      normalized = true;
    } else {
      tracksById[canonicalId] = canonicalTrack;
    }

    const duplicateCandidates = candidates.filter((track) => track.id !== keeper.id && track.id !== canonicalId);
    for (const duplicate of duplicateCandidates) {
      delete tracksById[duplicate.id];
      removedTrackIds.push(duplicate.id);
      normalized = true;
      await deleteTrackArtifacts(duplicate);
    }

    if (keeper.id !== canonicalId) {
      removedTrackIds.push(keeper.id);
    }
    canonicalTrackIds.push(canonicalId);
  }

  const removedTrackIdSet = new Set(removedTrackIds);
  const canonicalTrackIdSet = new Set(canonicalTrackIds);
  const nextPlaylistsById: Record<string, PlaylistRecord> = {};
  for (const [playlistId, playlist] of Object.entries(library.playlistsById || {})) {
    if (playlistId !== DEMO_PLAYLIST_ID && duplicatePlaylistIds.includes(playlistId)) continue;
    const nextTrackIds = (playlist.trackIds || []).filter(
      (trackId, index, array) =>
        !removedTrackIdSet.has(trackId) &&
        (playlistId === DEMO_PLAYLIST_ID || !canonicalTrackIdSet.has(trackId)) &&
        array.indexOf(trackId) === index
    );
    const shouldForceDemoPlaylist = playlistId === DEMO_PLAYLIST_ID;
    const finalTrackIds = shouldForceDemoPlaylist ? canonicalTrackIds : nextTrackIds;
    nextPlaylistsById[playlistId] =
      finalTrackIds.length !== (playlist.trackIds || []).length ||
      finalTrackIds.some((trackId, index) => (playlist.trackIds || [])[index] !== trackId)
        ? { ...playlist, id: playlistId, name: shouldForceDemoPlaylist ? DEMO_PLAYLIST_NAME : playlist.name, trackIds: finalTrackIds, updatedAt: now }
        : shouldForceDemoPlaylist && playlist.name !== DEMO_PLAYLIST_NAME
          ? { ...playlist, id: playlistId, name: DEMO_PLAYLIST_NAME, updatedAt: now }
          : playlist;
  }

  if (!nextPlaylistsById[DEMO_PLAYLIST_ID]) {
    nextPlaylistsById[DEMO_PLAYLIST_ID] = {
      id: DEMO_PLAYLIST_ID,
      name: DEMO_PLAYLIST_NAME,
      trackIds: canonicalTrackIds,
      createdAt: now,
      updatedAt: now
    };
    normalized = true;
  }

  const activePlaylistId = options?.preferDemoActive && canonicalTrackIds.length > 0 ? DEMO_PLAYLIST_ID : library.activePlaylistId;
  if (activePlaylistId !== library.activePlaylistId) normalized = true;

  if (normalized) {
    library = {
      ...library,
      tracksById,
      playlistsById: nextPlaylistsById,
      activePlaylistId
    };
    setLibrary(library);
  }

  return { normalized, removedTrackIds, canonicalTrackIds };
}

function markSeedDone(): void {
  try {
    localStorage.setItem(DEMO_SEED_DONE_KEY, "true");
  } catch {
    // Ignore localStorage failures.
  }
}

function wasSeedDone(): boolean {
  try {
    return localStorage.getItem(DEMO_SEED_DONE_KEY) === "true";
  } catch {
    return false;
  }
}

export async function seedDemoTracksIfNeeded(): Promise<{ seeded: boolean; reason: string }> {
  logDemoSeed("seed:start");
  logDemoSeed("seed:resolved-assets", {
    demoAudioAssetUrl,
    demoArtAssetUrl,
    demoAudioAssetUrlValid: typeof demoAudioAssetUrl === "string" && demoAudioAssetUrl.length > 0,
    demoArtAssetUrlValid: typeof demoArtAssetUrl === "string" && demoArtAssetUrl.length > 0
  });
  let library = await getLibrary();
  const normalizedBefore = await normalizeDemoLibrary();
  if (normalizedBefore.normalized) {
    library = await getLibrary();
  }
  const trackValues = Object.values(library.tracksById || {});
  const hasAnyDemo = trackValues.some((track) => Boolean(track.isDemo) || (track.demoId ? DEMO_IDS.has(track.demoId) : false));
  const hasDemoPlaylist = Boolean(
    library.playlistsById[DEMO_PLAYLIST_ID] ||
      Object.values(library.playlistsById || {}).find(
        (playlist) => playlist.name.trim().toLowerCase() === DEMO_PLAYLIST_NAME.toLowerCase()
      )
  );
  const activePlaylist =
    library.activePlaylistId && library.playlistsById[library.activePlaylistId]
      ? library.playlistsById[library.activePlaylistId]
      : null;
  const activeTrackCount = activePlaylist?.trackIds?.length ?? 0;

  if (hasAnyDemo) {
    const repaired = await ensureDemoPostersIfMissing(library);
    const normalized = await normalizeDemoLibrary();
    const reattached = ensureDemoPlaylistAttachment(await getLibrary());
    if (reattached) setLibrary(await getLibrary());
    if (repaired > 0 || normalized.normalized || reattached) {
      markSeedDone();
      return {
        seeded: false,
        reason: repaired > 0 ? "repaired-demo-posters" : normalized.normalized ? "normalized-demo-library" : "reattached-demo-playlist"
      };
    }
  }

  if (wasSeedDone() && hasAnyDemo) {
    const normalized = await normalizeDemoLibrary();
    library = await getLibrary();
    if (ensureDemoPlaylistAttachment(library)) setLibrary(library);
    if (normalized.normalized) return { seeded: false, reason: "normalized-demo-library" };
    return { seeded: false, reason: "already-seeded" };
  }

  if (hasAnyDemo) {
    const normalized = await normalizeDemoLibrary();
    library = await getLibrary();
    if (ensureDemoPlaylistAttachment(library)) setLibrary(library);
    if (normalized.normalized) return { seeded: false, reason: "normalized-demo-library" };
    markSeedDone();
    return { seeded: false, reason: "demo-already-present" };
  }

  // Seed demos whenever the active playlist is empty and no demo tracks exist yet.
  // This keeps first-run experience consistent on iOS even if other playlists contain tracks.
  if (activeTrackCount > 0 && !hasDemoPlaylist) {
    markSeedDone();
    return { seeded: false, reason: "existing-user-library" };
  }

  library = ensureDemoPlaylist(library, true);
  setLibrary(library);

  let installed = 0;
  for (const demo of DEMO_TRACKS) {
    try {
      logDemoSeed("seed:track:start", { demoId: demo.demoId, title: demo.title, strategy: "built-in-direct-url" });
      const postWriteLibrary = upsertBuiltInDemoTrack(await getLibrary(), demo);
      installed += 1;
      const demoPlaylist = postWriteLibrary.playlistsById[DEMO_PLAYLIST_ID];
      logDemoSeed("seed:post-write-library", {
        demoId: demo.demoId,
        canonicalTrackExists: Boolean(postWriteLibrary.tracksById["first-run-demo"]),
        demoPlaylistTrackIds: Array.isArray(demoPlaylist?.trackIds) ? [...demoPlaylist.trackIds] : [],
        bundledAudioUrl: postWriteLibrary.tracksById["first-run-demo"]?.bundledAudioUrl ?? null,
        bundledArtVideoUrl: postWriteLibrary.tracksById["first-run-demo"]?.bundledArtVideoUrl ?? null
      });
    } catch (error) {
      logDemoSeed("seed:track:error", {
        demoId: demo.demoId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  markSeedDone();
  await normalizeDemoLibrary({ preferDemoActive: true });
  const seededLibrary = await getLibrary();
  if (ensureDemoPlaylistAttachment(seededLibrary)) setLibrary(seededLibrary);
  return installed > 0 ? { seeded: true, reason: "seeded-first-run" } : { seeded: false, reason: "no-demo-installed" };
}

export async function restoreDemoTracks(
  options?: { preferDemoActive?: boolean }
): Promise<{ restored: number; skipped: number; repaired: number; failed: number }> {
  logDemoSeed("restore:start");
  logDemoSeed("restore:resolved-assets", {
    demoAudioAssetUrl,
    demoArtAssetUrl,
    demoAudioAssetUrlValid: typeof demoAudioAssetUrl === "string" && demoAudioAssetUrl.length > 0,
    demoArtAssetUrlValid: typeof demoArtAssetUrl === "string" && demoArtAssetUrl.length > 0
  });
  const preferDemoActive = Boolean(options?.preferDemoActive);
  let library = await getLibrary();
  library = ensureDemoPlaylist(library, preferDemoActive);
  setLibrary(library);

  let restored = 0;
  let skipped = 0;
  let failed = 0;
  for (const demo of DEMO_TRACKS) {
    const latest = await getLibrary();
    const exists = Object.values(latest.tracksById || {}).some((track) => track.demoId === demo.demoId);
    if (exists) {
      skipped += 1;
      continue;
    }
    try {
      logDemoSeed("restore:track:start", { demoId: demo.demoId, title: demo.title, strategy: "built-in-direct-url" });
      const postWriteLibrary = upsertBuiltInDemoTrack(await getLibrary(), demo, { preferDemoActive });
      restored += 1;
      const demoPlaylist = postWriteLibrary.playlistsById[DEMO_PLAYLIST_ID];
      logDemoSeed("restore:post-write-library", {
        demoId: demo.demoId,
        canonicalTrackExists: Boolean(postWriteLibrary.tracksById["first-run-demo"]),
        demoPlaylistTrackIds: Array.isArray(demoPlaylist?.trackIds) ? [...demoPlaylist.trackIds] : [],
        bundledAudioUrl: postWriteLibrary.tracksById["first-run-demo"]?.bundledAudioUrl ?? null,
        bundledArtVideoUrl: postWriteLibrary.tracksById["first-run-demo"]?.bundledArtVideoUrl ?? null
      });
    } catch (error) {
      logDemoSeed("restore:track:error", {
        demoId: demo.demoId,
        error: error instanceof Error ? error.message : String(error)
      });
      failed += 1;
    }
  }

  const postLibrary = await getLibrary();
  const repaired = await ensureDemoPostersIfMissing(postLibrary).catch(() => 0);
  const normalized = await normalizeDemoLibrary({ preferDemoActive });
  const latest = await getLibrary();
  const reattached = ensureDemoPlaylistAttachment(latest);
  if (reattached) setLibrary(latest);
  markSeedDone();
  return { restored, skipped, repaired: repaired + (normalized.normalized ? 1 : 0) + (reattached ? 1 : 0), failed };
}
