import type { CSSProperties } from "react";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import type { Track } from "../types";

type Props = {
  track: Track;
  active: boolean;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
};

export function TrackRow({ track, active, isPlaying, onSelectTrack, onAuraUp }: Props) {
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || `url('${DEFAULT_ARTWORK_URL}')` } as CSSProperties);
  const auraLevel = Math.max(0, Math.min(1, track.aura / 5));
  const hasAura = track.aura > 0;

  return (
    <div
      className={`track-row ${active && isPlaying ? "is-playing" : ""} ${hasAura ? "rowAuraGlow" : ""}`.trim()}
      data-track-id={track.id}
      data-aura={String(track.aura)}
      style={{ "--row-aura-level": auraLevel.toFixed(2) } as CSSProperties}
    >
      <div className="rowAuraAccent" aria-hidden="true" />
      <button
        type="button"
        className="track-row__thumb-btn"
        onClick={() => onSelectTrack(track.id)}
        aria-label={`Play ${track.title}`}
      >
        <div className="track-row__thumb" style={artStyle} />
        <div className="track-row__thumb-badges" aria-hidden="true">
          {track.isDemo && <div className="track-art-badge track-art-badge--row track-art-badge--demo">DEMO</div>}
          {track.artworkSource === "auto" && <div className="track-art-badge track-art-badge--row">AUTO ART</div>}
        </div>
      </button>
      <button
        type="button"
        className="track-row__meta-hit"
        onClick={() => onSelectTrack(track.id)}
        aria-label={`Play ${track.title}`}
      >
        <div className="track-row__meta">
          <div className="track-row__title">{track.title}</div>
          <div className="track-row__sub">{track.sub || "Uploaded"}</div>
          <div className="track-row__aura">Aura {track.aura}/5</div>
        </div>
      </button>
      <div className="track-row__actions">
        <button
          type="button"
          className="track-row__play-indicator"
          onClick={() => onSelectTrack(track.id)}
          aria-label={`Play ${track.title}`}
        >
          {active && isPlaying ? "Playing" : "Play"}
        </button>
        <button
          className="track-row__aura-btn"
          type="button"
          aria-label="Give aura"
          onClick={(event) => {
            event.stopPropagation();
            const button = event.currentTarget;
            button.classList.remove("track-row__aura-btn--burst");
            void button.offsetWidth;
            button.classList.add("track-row__aura-btn--burst");
            if (navigator.vibrate) navigator.vibrate(12);
            onAuraUp(track.id);
          }}
        >
          Aura +
        </button>
      </div>
    </div>
  );
}
