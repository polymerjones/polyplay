import { generateVideoPoster } from "./artwork/videoPoster";
import { addTrackToDb } from "./db";
import { getLibrary, setLibrary } from "./library";
import { getBlob, putBlob } from "./storage/db";

const DEMO_SEED_DONE_KEY = "polyplay_demo_seed_done_v1";
const MAX_DEMO_ASSET_BYTES = 30 * 1024 * 1024;

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
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Asset too large: ${url}`);
  }
  const blob = await response.blob();
  if (blob.size > maxBytes) throw new Error(`Asset too large: ${url}`);
  return blob;
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

  if (!library.activePlaylistId || !library.playlistsById[library.activePlaylistId]) {
    const now = Date.now();
    const playlistId = makeId("playlist");
    library = {
      ...library,
      playlistsById: {
        ...library.playlistsById,
        [playlistId]: {
          id: playlistId,
          name: "polyplaylist1",
          trackIds: [],
          createdAt: now,
          updatedAt: now
        }
      },
      activePlaylistId: playlistId
    };
    setLibrary(library);
  }

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

export async function restoreDemoTracks(): Promise<{ restored: number; skipped: number; repaired: number }> {
  let library = await getLibrary();
  if (!library.activePlaylistId || !library.playlistsById[library.activePlaylistId]) {
    const now = Date.now();
    const playlistId = makeId("playlist");
    library = {
      ...library,
      playlistsById: {
        ...library.playlistsById,
        [playlistId]: {
          id: playlistId,
          name: "polyplaylist1",
          trackIds: [],
          createdAt: now,
          updatedAt: now
        }
      },
      activePlaylistId: playlistId
    };
    setLibrary(library);
  }

  let restored = 0;
  let skipped = 0;
  for (const demo of DEMO_TRACKS) {
    const latest = await getLibrary();
    const exists = Object.values(latest.tracksById || {}).some((track) => track.demoId === demo.demoId);
    if (exists) {
      skipped += 1;
      continue;
    }
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
  }

  const postLibrary = await getLibrary();
  const repaired = await ensureDemoPostersIfMissing(postLibrary);
  markSeedDone();
  return { restored, skipped, repaired };
}
