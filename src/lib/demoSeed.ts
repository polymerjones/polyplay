import { addTrackToDb } from "./db";
import { getLibrary, setLibrary } from "./library";

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
  const hasAnyTracks = trackValues.length > 0;
  const hasAnyDemo = trackValues.some((track) => Boolean(track.isDemo));
  const activePlaylist =
    library.activePlaylistId && library.playlistsById[library.activePlaylistId]
      ? library.playlistsById[library.activePlaylistId]
      : null;
  const activeTrackCount = activePlaylist?.trackIds?.length ?? 0;

  if (wasSeedDone() && hasAnyDemo) {
    return { seeded: false, reason: "already-seeded" };
  }

  if (hasAnyDemo) {
    markSeedDone();
    return { seeded: false, reason: "demo-already-present" };
  }

  if (hasAnyTracks || activeTrackCount > 0) {
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
    const mediaBlob = await fetchBlobBounded(demo.mediaUrl, MAX_DEMO_ASSET_BYTES);
    await addTrackToDb({
      demoId: demo.demoId,
      isDemo: true,
      title: demo.title,
      sub: "Demo",
      audio: mediaBlob,
      artPoster: null,
      artVideo: mediaBlob
    });
    installed += 1;
  }

  markSeedDone();
  return installed > 0 ? { seeded: true, reason: "seeded-first-run" } : { seeded: false, reason: "no-demo-installed" };
}
