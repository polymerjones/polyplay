type NormalizeStillImageOptions = {
  maxEdge?: number;
  quality?: number;
};

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.86;

function getSafeMaxEdge(maxEdge?: number): number {
  if (!Number.isFinite(maxEdge) || (maxEdge ?? 0) <= 0) return DEFAULT_MAX_EDGE;
  return Math.max(320, Math.min(2048, Math.round(Number(maxEdge))));
}

function getSafeQuality(quality?: number): number {
  if (!Number.isFinite(quality)) return DEFAULT_QUALITY;
  return Math.max(0.55, Math.min(0.95, Number(quality)));
}

function isStillImageBlob(blob: Blob): boolean {
  return blob.type.startsWith("image/") && !blob.type.startsWith("image/svg");
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not decode still image"));
    });
    image.src = objectUrl;
    await loaded;
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function normalizeStillImage(
  blob: Blob,
  options: NormalizeStillImageOptions = {}
): Promise<Blob> {
  if (!isStillImageBlob(blob)) return blob;

  const image = await loadImageFromBlob(blob);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const maxEdge = getSafeMaxEdge(options.maxEdge);
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return blob;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const jpegBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", getSafeQuality(options.quality))
  );
  return jpegBlob && jpegBlob.size > 0 ? jpegBlob : blob;
}
