type PosterOptions = {
  timeSec?: number;
  maxEdge?: number;
};

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

async function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  if (Math.abs(video.currentTime - timeSec) < 0.04) return;
  await waitForEvent(video, "seeked", 850, () => {
    video.currentTime = timeSec;
  });
}

export async function generateVideoPoster(file: Blob, options: PosterOptions = {}): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await waitForEvent(video, "loadedmetadata", 2400);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForEvent(video, "loadeddata", 1800).catch(() => undefined);
    }

    const duration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
    const baseTime = clampPosterTime(duration, options.timeSec);
    const fallbackTimes = [baseTime, clampPosterTime(duration, 0.8), clampPosterTime(duration, 0.25)];

    let drewFrame = false;
    for (const candidate of fallbackTimes) {
      try {
        await seekVideo(video, candidate);
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          await waitForEvent(video, "loadeddata", 800).catch(() => undefined);
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
    const maxEdge = Math.max(320, options.maxEdge ?? 1280);
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Could not export poster image");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
