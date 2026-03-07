import { useState, type CSSProperties } from "react";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import type { Track } from "../types";

type Props = {
  track: Track;
  trackId: string;
  active: boolean;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
};

export function TrackTile({ track, trackId, active, onSelectTrack, onAuraUp }: Props) {
  const [artFailed, setArtFailed] = useState(false);
  const artSrc = !artFailed && track.artUrl ? track.artUrl : DEFAULT_ARTWORK_URL;
  const isFallback = artSrc === DEFAULT_ARTWORK_URL;
  const auraLevel = Math.max(0, Math.min(1, (track.aura || 0) / 10));

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
        <div className={`ytm-cover ${isFallback ? "is-fallback" : ""}`.trim()} aria-hidden="true">
          <img
            className="ytm-cover-media"
            src={artSrc}
            alt={track.title}
            onError={() => setArtFailed(true)}
            draggable={false}
          />
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
