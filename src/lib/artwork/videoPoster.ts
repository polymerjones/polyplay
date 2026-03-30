import { isDesktopSafari, isIosSafari } from "../platform";

type PosterOptions = {
  timeSec?: number;
  maxEdge?: number;
  metadataTimeoutMs?: number;
  seekTimeoutMs?: number;
};

type VideoMeta = {
  durationSec: number;
  width: number;
  height: number;
};

const DEFAULT_METADATA_TIMEOUT_MS = 2800;
const DEFAULT_SEEK_TIMEOUT_MS = 2000;
let activePosterVideo: HTMLVideoElement | null = null;
const MOBILE_POSTER_MAX_EDGE = 768;
const DESKTOP_POSTER_MAX_EDGE = 1024;

function prefersJpegPosterExport(): boolean {
  return isDesktopSafari() || isIosSafari();
}

function isConstrainedDevice(): boolean {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    if (window.matchMedia("(max-width: 820px)").matches) return true;
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /iPhone|iPad|iPod|Android/i.test(ua);
}

function disposeVideo(video: HTMLVideoElement | null): void {
  if (!video) return;
  try {
    video.pause();
  } catch {}
  try {
    video.removeAttribute("src");
    video.load();
  } catch {}
  if (activePosterVideo === video) activePosterVideo = null;
}

function waitForEvent(
  target: EventTarget,
  eventName: string,
  timeoutMs: number,
  onAttach?: () => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      target.removeEventListener(eventName, onDone as EventListener);
      target.removeEventListener("error", onError as EventListener);
      window.clearTimeout(timer);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    const fail = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName}`));
    };
    const onDone = () => finish();
    const onError = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`Media error while waiting for ${eventName}`));
    };
    const timer = window.setTimeout(fail, timeoutMs);
    target.addEventListener(eventName, onDone as EventListener, { once: true });
    target.addEventListener("error", onError as EventListener, { once: true });
    if (onAttach) onAttach();
  });
}

function clampPosterTime(duration: number, requested?: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0.25;
  const safeMax = Math.max(0.05, duration - 0.05);
  const preferred = Number.isFinite(requested) && requested && requested > 0 ? requested : 0.45;
  return Math.max(0.05, Math.min(safeMax, preferred));
}

function isLikelyBlankPoster(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const sampleSize = 8;
    const stepX = Math.max(1, Math.floor(width / sampleSize));
    const stepY = Math.max(1, Math.floor(height / sampleSize));
    let minLuma = 255;
    let maxLuma = 0;
    let totalAlpha = 0;
    let samples = 0;

    for (let y = Math.floor(stepY / 2); y < height; y += stepY) {
      for (let x = Math.floor(stepX / 2); x < width; x += stepX) {
        const data = ctx.getImageData(x, y, 1, 1).data;
        const alpha = data[3];
        const luma = 0.2126 * data[0] + 0.7152 * data[1] + 0.0722 * data[2];
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
        totalAlpha += alpha;
        samples += 1;
      }
    }

    if (samples === 0) return true;
    const averageAlpha = totalAlpha / samples;
    const lumaSpread = maxLuma - minLuma;
    return averageAlpha < 6 || lumaSpread < 10;
  } catch {
    return false;
  }
}

async function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  if (Math.abs(video.currentTime - timeSec) < 0.04) return;
  await waitForEvent(video, "seeked", DEFAULT_SEEK_TIMEOUT_MS, () => {
    video.currentTime = timeSec;
  });
}

export async function readVideoMetadata(file: Blob, options: PosterOptions = {}): Promise<VideoMeta> {
  const objectUrl = URL.createObjectURL(file);
  try {
    disposeVideo(activePosterVideo);
    const video = document.createElement("video");
    activePosterVideo = video;
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await waitForEvent(video, "loadedmetadata", options.metadataTimeoutMs ?? DEFAULT_METADATA_TIMEOUT_MS);
    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
    const width = Math.max(1, video.videoWidth || 1);
    const height = Math.max(1, video.videoHeight || 1);
    return { durationSec: duration, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
    disposeVideo(activePosterVideo);
  }
}

export async function generateVideoPoster(file: Blob, options: PosterOptions = {}): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    disposeVideo(activePosterVideo);
    const video = document.createElement("video");
    activePosterVideo = video;
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await waitForEvent(video, "loadedmetadata", options.metadataTimeoutMs ?? DEFAULT_METADATA_TIMEOUT_MS);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForEvent(video, "loadeddata", 1400).catch(() => undefined);
    }

    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
    const baseTime = clampPosterTime(duration, options.timeSec);
    const fallbackTimes = [baseTime, clampPosterTime(duration, 0.8), clampPosterTime(duration, 0.25)];

    let drewFrame = false;
    for (const candidate of fallbackTimes) {
      try {
        await seekVideo(video, candidate);
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          await waitForEvent(video, "loadeddata", options.seekTimeoutMs ?? DEFAULT_SEEK_TIMEOUT_MS).catch(
            () => undefined
          );
        }
        drewFrame = true;
        break;
      } catch {
        // Try next timestamp candidate.
      }
    }
    if (!drewFrame) throw new Error("Unable to seek a valid video frame");

    const sourceWidth = Math.max(1, video.videoWidth || 1);
    const sourceHeight = Math.max(1, video.videoHeight || 1);
    const maxEdge = Math.max(
      320,
      options.maxEdge ?? (isConstrainedDevice() ? MOBILE_POSTER_MAX_EDGE : DESKTOP_POSTER_MAX_EDGE)
    );
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");

    let captured = false;
    for (const candidate of fallbackTimes) {
      try {
        await seekVideo(video, candidate);
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          await waitForEvent(video, "loadeddata", options.seekTimeoutMs ?? DEFAULT_SEEK_TIMEOUT_MS).catch(
            () => undefined
          );
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);
        if (!isLikelyBlankPoster(ctx, width, height)) {
          captured = true;
          break;
        }
      } catch {
        // Try next timestamp candidate.
      }
    }

    if (!captured) throw new Error("Could not capture a usable poster frame");

    if (!prefersJpegPosterExport()) {
      const webpBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
      if (webpBlob && webpBlob.size > 0) return webpBlob;
    }

    const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (jpegBlob && jpegBlob.size > 0) return jpegBlob;

    if (prefersJpegPosterExport()) {
      const webpBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
      if (webpBlob && webpBlob.size > 0) return webpBlob;
    }

    throw new Error("Could not export poster image");
  } finally {
    URL.revokeObjectURL(objectUrl);
    disposeVideo(activePosterVideo);
  }
}
