import type { Track } from "../types";

type MediaSessionWithPosition = MediaSession & {
  setPositionState?: (state?: MediaPositionState) => void;
};

type PolyplayMediaSessionAction = MediaSessionAction | "toggleplaypause";

function getMediaSession(): MediaSessionWithPosition | null {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return null;
  return navigator.mediaSession as MediaSessionWithPosition;
}

function getMediaMetadataCtor(): typeof MediaMetadata | null {
  if (typeof window === "undefined" || typeof window.MediaMetadata === "undefined") return null;
  return window.MediaMetadata;
}

export async function syncMediaSessionItem(
  track: Pick<Track, "title" | "artUrl" | "missingAudio" | "audioUrl"> | null
): Promise<void> {
  const mediaSession = getMediaSession();
  const MediaMetadataCtor = getMediaMetadataCtor();
  if (!mediaSession || !MediaMetadataCtor) return;

  if (!track?.audioUrl || track.missingAudio) {
    mediaSession.metadata = null;
    return;
  }

  const artwork = track.artUrl
    ? [
        { src: track.artUrl, sizes: "96x96", type: "image/png" },
        { src: track.artUrl, sizes: "128x128", type: "image/png" },
        { src: track.artUrl, sizes: "192x192", type: "image/png" },
        { src: track.artUrl, sizes: "256x256", type: "image/png" },
        { src: track.artUrl, sizes: "512x512", type: "image/png" }
      ]
    : [];

  mediaSession.metadata = new MediaMetadataCtor({
    title: track.title || "Untitled",
    artist: "PolyPlay Audio",
    album: "PolyPlay Audio",
    artwork
  });
}

export function syncMediaSessionPlaybackState(options: {
  elapsedTime: number;
  duration: number;
  isPlaying: boolean;
}): void {
  const mediaSession = getMediaSession();
  if (!mediaSession) return;

  mediaSession.playbackState = options.isPlaying ? "playing" : "paused";

  if (typeof mediaSession.setPositionState !== "function") return;

  const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
  if (duration <= 0) {
    try {
      mediaSession.setPositionState();
    } catch {
      // Ignore unsupported/invalid position state errors.
    }
    return;
  }

  const position = Number.isFinite(options.elapsedTime)
    ? Math.max(0, Math.min(duration, options.elapsedTime))
    : 0;

  try {
    mediaSession.setPositionState({
      duration,
      playbackRate: options.isPlaying ? 1 : 0,
      position
    });
  } catch {
    // Ignore unsupported/invalid position state errors.
  }
}

export function bindMediaSessionTransportActions(actions: {
  onPlay: () => void;
  onPause: () => void;
  onTogglePlayPause: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
}): () => void {
  const mediaSession = getMediaSession();
  if (!mediaSession || typeof mediaSession.setActionHandler !== "function") return () => {};

  const bindings: Array<[PolyplayMediaSessionAction, MediaSessionActionHandler | null]> = [
    ["play", () => actions.onPlay()],
    ["pause", () => actions.onPause()],
    ["toggleplaypause", () => actions.onTogglePlayPause()],
    ["previoustrack", () => actions.onPreviousTrack()],
    ["nexttrack", () => actions.onNextTrack()]
  ];

  for (const [action, handler] of bindings) {
    try {
      mediaSession.setActionHandler(action as MediaSessionAction, handler);
    } catch {
      // Ignore unsupported action handlers on this platform.
    }
  }

  try {
    mediaSession.setActionHandler("stop", () => actions.onPause());
  } catch {
    // Ignore unsupported action handlers on this platform.
  }

  return () => {
    for (const [action] of bindings) {
      try {
        mediaSession.setActionHandler(action as MediaSessionAction, null);
      } catch {
        // Ignore unsupported action handlers on cleanup.
      }
    }
    try {
      mediaSession.setActionHandler("stop", null);
    } catch {
      // Ignore unsupported action handlers on cleanup.
    }
  };
}
