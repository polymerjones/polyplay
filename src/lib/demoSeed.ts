import { generateVideoPoster } from "./artwork/videoPoster";
import { addTrackToDb } from "./db";
import { getLibrary, setLibrary } from "./library";
import { getBlob, putBlob } from "./storage/db";

const DEMO_SEED_DONE_KEY = "polyplay_demo_seed_done_v1";
const MAX_DEMO_ASSET_BYTES = 30 * 1024 * 1024;
const DEMO_PLAYLIST_ID = "polyplaylist-demo";
const DEMO_PLAYLIST_NAME = "Demo Playlist";

const DEMO_TRACKS = [
  {
    demoId: "first-run-demo-1",
    title: "Demo Track 1",
    mediaUrl: "/demo/demo1.mp4"
  },
  {
    demoId: "first-run-demo-2",
    title: "Demo Track 2",
    mediaUrl: "/demo/demo2.mp4"
  }
] as const;

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureDemoPlaylist(library: Awaited<ReturnType<typeof getLibrary>>, makeActive: boolean) {
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

async function ensureDemoPostersIfMissing(library: Awaited<ReturnType<typeof getLibrary>>): Promise<number> {
  let repaired = 0;
  let touched = false;
  for (const track of Object.values(library.tracksById || {})) {
    if (!track?.isDemo) continue;
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

async function fetchBlobBounded(url: string, maxBytes: number): Promise<Blob> {
  const candidates = new Set<string>();
  candidates.add(url);
  if (url.startsWith("/")) candidates.add(url.slice(1));
  if (typeof window !== "undefined") {
    try {
      candidates.add(new URL(url, window.location.origin).toString());
    } catch {
      // Ignore URL construction failures.
    }
  }

  let lastError = "unknown";
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) {
        lastError = `${candidate} -> HTTP ${response.status}`;
        continue;
      }
      const contentLength = Number(response.headers.get("content-length") || "0");
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error(`Asset too large: ${candidate}`);
      }
      const blob = await response.blob();
      if (blob.size > maxBytes) throw new Error(`Asset too large: ${candidate}`);
      return blob;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`Failed to fetch ${url} (${lastError})`);
}

export async function seedDemoTracksIfNeeded(): Promise<{ seeded: boolean; reason: string }> {
  let library = await getLibrary();
  const trackValues = Object.values(library.tracksById || {});
  const hasAnyDemo = trackValues.some((track) => Boolean(track.isDemo));
  const activePlaylist =
    library.activePlaylistId && library.playlistsById[library.activePlaylistId]
      ? library.playlistsById[library.activePlaylistId]
      : null;
  const activeTrackCount = activePlaylist?.trackIds?.length ?? 0;

  if (hasAnyDemo) {
    const repaired = await ensureDemoPostersIfMissing(library);
    if (repaired > 0) {
      markSeedDone();
      return { seeded: false, reason: "repaired-demo-posters" };
    }
  }

  if (wasSeedDone() && hasAnyDemo) {
    return { seeded: false, reason: "already-seeded" };
  }

  if (hasAnyDemo) {
    markSeedDone();
    return { seeded: false, reason: "demo-already-present" };
  }

  // Seed demos whenever the active playlist is empty and no demo tracks exist yet.
  // This keeps first-run experience consistent on iOS even if other playlists contain tracks.
  if (activeTrackCount > 0) {
    markSeedDone();
    return { seeded: false, reason: "existing-user-library" };
  }

  library = ensureDemoPlaylist(library, true);
  setLibrary(library);

  let installed = 0;
  for (const demo of DEMO_TRACKS) {
    try {
      const mediaBlob = await fetchBlobBounded(demo.mediaUrl, MAX_DEMO_ASSET_BYTES);
      const posterBlob = (await generateVideoPoster(mediaBlob).catch(() => null)) ?? makeFallbackPoster(demo.title);
      await addTrackToDb({
        demoId: demo.demoId,
        isDemo: true,
        title: demo.title,
        sub: "Demo",
        audio: mediaBlob,
        artPoster: posterBlob,
        artVideo: mediaBlob
      });
      installed += 1;
    } catch {
      // Continue seeding remaining demo tracks if one fails.
    }
  }

  markSeedDone();
  return installed > 0 ? { seeded: true, reason: "seeded-first-run" } : { seeded: false, reason: "no-demo-installed" };
}

export async function restoreDemoTracks(): Promise<{ restored: number; skipped: number; repaired: number; failed: number }> {
  let library = await getLibrary();
  library = ensureDemoPlaylist(library, true);
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
      const mediaBlob = await fetchBlobBounded(demo.mediaUrl, MAX_DEMO_ASSET_BYTES);
      const posterBlob = (await generateVideoPoster(mediaBlob).catch(() => null)) ?? makeFallbackPoster(demo.title);
      await addTrackToDb({
        demoId: demo.demoId,
        isDemo: true,
        title: demo.title,
        sub: "Demo",
        audio: mediaBlob,
        artPoster: posterBlob,
        artVideo: mediaBlob
      });
      restored += 1;
    } catch {
      failed += 1;
    }
  }

  const postLibrary = await getLibrary();
  const repaired = await ensureDemoPostersIfMissing(postLibrary).catch(() => 0);
  markSeedDone();
  return { restored, skipped, repaired, failed };
}
