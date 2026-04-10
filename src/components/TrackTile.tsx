import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import type { DimMode, Track } from "../types";
import { BorderTrail } from "./BorderTrail";

function appendRetryParam(src: string, key: string, value: string): string {
  if (!src || src.startsWith("data:")) return src;
  const hashIndex = src.indexOf("#");
  const hash = hashIndex >= 0 ? src.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? src.slice(0, hashIndex) : src;
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
}

type Props = {
  track: Track;
  trackId: string;
  active: boolean;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  dimMode: DimMode;
};

export function TrackTile({
  track,
  trackId,
  active,
  onSelectTrack,
  onAuraUp,
  isCurrentTrack,
  isPlaying,
  dimMode
}: Props) {
  const showTrail = isCurrentTrack;
  const [artFailed, setArtFailed] = useState(false);
  const [resolvedDemoArtSrc, setResolvedDemoArtSrc] = useState<string | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const artSrc = track.isDemo
    ? resolvedDemoArtSrc || DEFAULT_ARTWORK_URL
    : (!artFailed && track.artUrl ? track.artUrl : DEFAULT_ARTWORK_URL);
  const isFallback = artSrc === DEFAULT_ARTWORK_URL;
  const auraLevel = Math.max(0, Math.min(1, (track.aura || 0) / 10));

  useEffect(() => {
    setArtFailed(false);
    if (!track.isDemo) {
      setResolvedDemoArtSrc(null);
      return;
    }
    if (!track.artUrl) {
      setResolvedDemoArtSrc(null);
      return;
    }
    let cancelled = false;
    const preload = (src: string, allowRetry: boolean) => {
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        setResolvedDemoArtSrc(src);
      };
      image.onerror = () => {
        if (cancelled) return;
        if (allowRetry) {
          preload(appendRetryParam(track.artUrl || src, "polyplayDemoRetry", String(Date.now())), false);
          return;
        }
        setResolvedDemoArtSrc(null);
      };
      image.src = src;
    };
    setResolvedDemoArtSrc(null);
    preload(track.artUrl, true);
    return () => {
      cancelled = true;
    };
  }, [track.artUrl, track.id, track.isDemo]);

  useEffect(() => {
    const onAuraArtHit = (event: Event) => {
      const custom = event as CustomEvent<{ trackId?: string }>;
      if (custom.detail?.trackId !== trackId) return;
      const cover = coverRef.current;
      if (!cover) return;
      cover.classList.remove("is-aura-flash");
      void cover.offsetWidth;
      cover.classList.add("is-aura-flash");
    };

    window.addEventListener("polyplay:aura-art-hit", onAuraArtHit as EventListener);
    return () => window.removeEventListener("polyplay:aura-art-hit", onAuraArtHit as EventListener);
  }, [trackId]);

  return (
    <article
      className={`ytm-tile ${active ? "is-active" : ""} ${track.aura > 0 ? "has-aura" : ""}`.trim()}
      data-track-id={trackId}
      data-aura={String(track.aura || 0)}
      style={{ "--tile-aura-level": auraLevel.toFixed(2) } as CSSProperties}
    >
      <button
        type="button"
        className="ytm-tile-hit"
        onClick={() => onSelectTrack(trackId)}
        aria-label={`Play ${track.title}`}
      >
        <div ref={coverRef} className={`ytm-cover ${isFallback ? "is-fallback" : ""}`.trim()} aria-hidden="true">
          <BorderTrail variant="tile" isVisible={showTrail} isPlaying={isPlaying} dimMode={dimMode} />
          <img
            className="ytm-cover-media"
            src={artSrc}
            alt={track.title}
            onError={() => {
              if (track.isDemo) {
                setResolvedDemoArtSrc(null);
                return;
              }
              setArtFailed(true);
            }}
            draggable={false}
          />
        </div>
        <div className="track-badges" aria-hidden="true">
          {track.isDemo && <div className="track-art-badge track-art-badge--tile track-art-badge--demo">DEMO</div>}
          {track.artworkSource === "auto" && (
            <div className="track-art-badge track-art-badge--tile track-art-badge--auto">AUTO</div>
          )}
        </div>
        <div className="ytm-overlay" aria-hidden="true">
          <div className="ytm-title">{track.title}</div>
        </div>
      </button>

      <button
        type="button"
        className="ytm-aura"
        aria-label={`Give aura to ${track.title}`}
        onClick={(event) => {
          event.stopPropagation();
          const tile = event.currentTarget.closest(".ytm-tile") as HTMLElement | null;
          if (tile) {
            tile.classList.remove("is-aura-hit");
            void tile.offsetWidth;
            tile.classList.add("is-aura-hit");
          }
          onAuraUp(trackId);
        }}
      >
        +
      </button>
    </article>
  );
}
