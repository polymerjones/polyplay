import { isConstrainedMobileDevice } from "../platform";
import { readVideoMetadata } from "./videoPoster";

export const MAX_VIDEO_BYTES_MOBILE = 60 * 1024 * 1024;
export const MAX_VIDEO_BYTES_DESKTOP = 100 * 1024 * 1024;
export const MAX_VIDEO_DIMENSION = 8192;
export const MAX_VIDEO_DURATION_SECONDS_STANDARD = 60;
export const MAX_VIDEO_DURATION_SECONDS_HIGH_RES = 20;
export const STANDARD_VIDEO_MAX_SHORT_EDGE = 720;
export const STANDARD_VIDEO_MAX_LONG_EDGE = 1280;
export const POSTER_MAX_EDGE_MOBILE = 768;
export const POSTER_MAX_EDGE_DESKTOP = 1024;
export const MAX_VIDEO_DURATION_SECONDS = MAX_VIDEO_DURATION_SECONDS_STANDARD;

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

export async function validateVideoArtworkFile(file: File): Promise<VideoValidationResult> {
  const mobileCap = isConstrainedMobileDevice();
  const capBytes = mobileCap ? MAX_VIDEO_BYTES_MOBILE : MAX_VIDEO_BYTES_DESKTOP;
  const capMb = Math.round(capBytes / (1024 * 1024));
  const posterMaxEdge = mobileCap ? POSTER_MAX_EDGE_MOBILE : POSTER_MAX_EDGE_DESKTOP;

  if (file.size > capBytes) {
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      reason: `Video is ${fileMb} MB - maximum is ${capMb} MB on this device. Try compressing or trimming the clip.`,
      capBytes
    };
  }

  let metadata;
  try {
    metadata = await readVideoMetadata(file, { metadataTimeoutMs: 2900 });
  } catch {
    return {
      ok: false,
      reason: "Couldn't read this video's metadata. Try re-exporting as H.264 MP4.",
      capBytes
    };
  }

  if (Math.max(metadata.width, metadata.height) > MAX_VIDEO_DIMENSION) {
    return {
      ok: false,
      reason: `Video dimensions (${metadata.width}x${metadata.height}) are too large. Maximum is ${MAX_VIDEO_DIMENSION}px on either side.`,
      capBytes
    };
  }

  const shortEdge = Math.min(metadata.width, metadata.height);
  const longEdge = Math.max(metadata.width, metadata.height);
  const isStandardResolution =
    shortEdge <= STANDARD_VIDEO_MAX_SHORT_EDGE && longEdge <= STANDARD_VIDEO_MAX_LONG_EDGE;
  const durationCap = isStandardResolution
    ? MAX_VIDEO_DURATION_SECONDS_STANDARD
    : MAX_VIDEO_DURATION_SECONDS_HIGH_RES;

  if (metadata.durationSec > durationCap) {
    const secs = Math.round(metadata.durationSec);
    const reason = isStandardResolution
      ? `Video is ${secs}s - clips at ${metadata.width}x${metadata.height} support up to ${durationCap}s. Try trimming the clip.`
      : `Video is ${secs}s at ${metadata.width}x${metadata.height} - clips larger than 1280x720 support up to ${durationCap}s. Try trimming, or re-export at 720p to allow up to ${MAX_VIDEO_DURATION_SECONDS_STANDARD}s.`;
    return { ok: false, reason, capBytes };
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
