import { generateVideoPoster } from "./artwork/videoPoster";
import { addTrackToDb, hasDemoTrackByDemoId } from "./db";

export const DEMO_PACK_VERSION = "v1";
export const DEMO_PACK_VERSION_KEY = "polyplay_demoPackVersionInstalled";

const MAX_DEMO_ASSET_BYTES = 30 * 1024 * 1024;

export const DEMO_PACK_V1 = [
  {
    demoId: "welcome-demo",
    title: "Welcome to Polyplay",
    audioUrl: "/demos/welcome-audio.mp3",
    artworkVideoUrl: "/demos/welcome-art.mp4",
    isDemo: true
  },
  {
    demoId: "snippet-demo",
    title: "Song Snippet Showcase",
    audioUrl: "/demos/snippet-audio.mp3",
    artworkVideoUrl: "/demos/snippet-art.mp4",
    isDemo: true
  }
] as const;

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

export async function installDemoPackIfNeeded(): Promise<{ installed: number; skipped: number }> {
  const installedVersion = localStorage.getItem(DEMO_PACK_VERSION_KEY);
  if (installedVersion === DEMO_PACK_VERSION) return { installed: 0, skipped: 0 };

  let installed = 0;
  let skipped = 0;
  let shouldRetry = false;
  for (const demo of DEMO_PACK_V1) {
    try {
      const exists = await hasDemoTrackByDemoId(demo.demoId);
      if (exists) {
        skipped += 1;
        continue;
      }
      const [audioBlob, artworkVideoBlob] = await Promise.all([
        fetchBlobBounded(demo.audioUrl, MAX_DEMO_ASSET_BYTES),
        fetchBlobBounded(demo.artworkVideoUrl, MAX_DEMO_ASSET_BYTES)
      ]);
      if (audioBlob.size + artworkVideoBlob.size > MAX_DEMO_ASSET_BYTES) {
        skipped += 1;
        continue;
      }
      const artPoster = await generateVideoPoster(artworkVideoBlob).catch(() => null);
      await addTrackToDb({
        demoId: demo.demoId,
        isDemo: true,
        title: demo.title,
        sub: "Demo",
        audio: audioBlob,
        artPoster,
        artVideo: artworkVideoBlob
      });
      installed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("Asset too large")) shouldRetry = true;
      skipped += 1;
    }
  }
  if (!shouldRetry) {
    localStorage.setItem(DEMO_PACK_VERSION_KEY, DEMO_PACK_VERSION);
  }
  return { installed, skipped };
}
