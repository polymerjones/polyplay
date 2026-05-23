import { isDesktopSafari, isIosSafari } from "../platform";

function prefersJpegPosterExport(): boolean {
  return isDesktopSafari() || isIosSafari();
}

async function loadGifImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not decode GIF artwork"));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function generateGifPoster(file: File, maxEdge: number): Promise<Blob> {
  const image = await loadGifImage(file);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const safeMaxEdge = Math.max(320, Math.min(2048, Math.round(maxEdge || 1024)));
  const scale = Math.min(1, safeMaxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not create GIF poster canvas");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

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

  throw new Error("Could not export GIF poster image");
}
