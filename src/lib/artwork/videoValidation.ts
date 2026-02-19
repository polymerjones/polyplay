import { isConstrainedMobileDevice } from "../platform";
import { readVideoMetadata } from "./videoPoster";

export const MAX_VIDEO_BYTES_MOBILE = 60 * 1024 * 1024;
export const MAX_VIDEO_BYTES_DESKTOP = 100 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 20;
export const MAX_VIDEO_DIMENSION = 8192;
export const POSTER_MAX_EDGE_MOBILE = 768;
export const POSTER_MAX_EDGE_DESKTOP = 1024;

export type VideoValidationResult =
  | {
      ok: true;
      capBytes: number;
      durationSec: number;
      width: number;
      height: number;
      posterMaxEdge: number;
    }
  | { ok: false; reason: string; capBytes: number };

function friendlyLimitMessage(capBytes: number): string {
  const capMb = Math.round(capBytes / (1024 * 1024));
  return `That video is too large for artwork. Please choose a shorter/smaller clip (≤${MAX_VIDEO_DURATION_SECONDS}s, ≤${capMb}MB on this device).`;
}

export async function validateVideoArtworkFile(file: File): Promise<VideoValidationResult> {
  const mobileCap = isConstrainedMobileDevice();
  const capBytes = mobileCap ? MAX_VIDEO_BYTES_MOBILE : MAX_VIDEO_BYTES_DESKTOP;
  const posterMaxEdge = mobileCap ? POSTER_MAX_EDGE_MOBILE : POSTER_MAX_EDGE_DESKTOP;

  if (file.size > capBytes) {
    return { ok: false, reason: friendlyLimitMessage(capBytes), capBytes };
  }

  let metadata;
  try {
    metadata = await readVideoMetadata(file, { metadataTimeoutMs: 2900 });
  } catch {
    return { ok: false, reason: "Could not read video metadata. Try another clip.", capBytes };
  }

  if (metadata.durationSec > MAX_VIDEO_DURATION_SECONDS) {
    return { ok: false, reason: friendlyLimitMessage(capBytes), capBytes };
  }

  if (Math.max(metadata.width, metadata.height) > MAX_VIDEO_DIMENSION) {
    return {
      ok: false,
      reason: "That video resolution is too high for artwork. Please pick a smaller clip.",
      capBytes
    };
  }

  return {
    ok: true,
    capBytes,
    durationSec: metadata.durationSec,
    width: metadata.width,
    height: metadata.height,
    posterMaxEdge
  };
}
