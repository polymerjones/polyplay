import { isConstrainedMobileDevice } from "../platform";

export const MAX_GIF_BYTES_MOBILE = 10 * 1024 * 1024;
export const MAX_GIF_BYTES_DESKTOP = 20 * 1024 * 1024;
export const MAX_GIF_SHORT_EDGE = 720;
export const MAX_GIF_LONG_EDGE = 1280;
export const POSTER_MAX_EDGE_MOBILE = 768;
export const POSTER_MAX_EDGE_DESKTOP = 1024;

export type GifValidationResult =
  | {
      ok: true;
      capBytes: number;
      width: number;
      height: number;
      posterMaxEdge: number;
    }
  | { ok: false; reason: string; capBytes: number };

function hasGifMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  return signature === "GIF87a" || signature === "GIF89a";
}

async function isGifFile(file: File): Promise<boolean> {
  if ((file.type || "").toLowerCase() === "image/gif") return true;
  const header = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  return hasGifMagic(header);
}

async function readGifDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not decode GIF artwork"));
      image.src = objectUrl;
    });
    return {
      width: Math.max(1, image.naturalWidth || image.width || 1),
      height: Math.max(1, image.naturalHeight || image.height || 1)
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function validateGifArtworkFile(file: File): Promise<GifValidationResult> {
  const mobileCap = isConstrainedMobileDevice();
  const capBytes = mobileCap ? MAX_GIF_BYTES_MOBILE : MAX_GIF_BYTES_DESKTOP;
  const capMb = Math.round(capBytes / (1024 * 1024));
  const posterMaxEdge = mobileCap ? POSTER_MAX_EDGE_MOBILE : POSTER_MAX_EDGE_DESKTOP;

  if (!(await isGifFile(file))) {
    return {
      ok: false,
      reason: "This artwork is not a valid GIF file. Choose an animated GIF exported as .gif.",
      capBytes
    };
  }

  if (file.size > capBytes) {
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      reason: `GIF is ${fileMb} MB - maximum is ${capMb} MB on this device. Try compressing the animation.`,
      capBytes
    };
  }

  let dimensions;
  try {
    dimensions = await readGifDimensions(file);
  } catch {
    return {
      ok: false,
      reason: "Couldn't read this GIF's dimensions. Try re-exporting the artwork as a standard animated GIF.",
      capBytes
    };
  }

  const shortEdge = Math.min(dimensions.width, dimensions.height);
  const longEdge = Math.max(dimensions.width, dimensions.height);
  if (shortEdge > MAX_GIF_SHORT_EDGE || longEdge > MAX_GIF_LONG_EDGE) {
    return {
      ok: false,
      reason: `GIF dimensions (${dimensions.width}x${dimensions.height}) are too large. Maximum is ${MAX_GIF_LONG_EDGE}px on the long side and ${MAX_GIF_SHORT_EDGE}px on the short side.`,
      capBytes
    };
  }

  return {
    ok: true,
    capBytes,
    width: dimensions.width,
    height: dimensions.height,
    posterMaxEdge
  };
}
