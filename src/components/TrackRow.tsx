import type { CSSProperties } from "react";
import type { Track } from "../types";

type Props = {
  track: Track;
  active: boolean;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
};

export function TrackRow({ track, active, isPlaying, onSelectTrack, onAuraUp }: Props) {
  const rowFallbackArtwork =
    "radial-gradient(140px 120px at 22% 18%, rgba(150,108,244,.52), rgba(150,108,244,0) 62%), radial-gradient(160px 130px at 84% 82%, rgba(88,176,255,.34), rgba(88,176,255,0) 64%), linear-gradient(145deg, #1a2133, #0f1522)";
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || rowFallbackArtwork } as CSSProperties);
  const auraLevel = Math.max(0, Math.min(1, track.aura / 10));
  const hasAura = track.aura > 0;

  return (
    <article
      className={`trackRow ${active && isPlaying ? "is-playing" : ""} ${hasAura ? "rowAuraGlow" : ""}`.trim()}
      data-track-id={track.id}
      data-aura={String(track.aura)}
      style={{ "--row-aura-level": auraLevel.toFixed(2) } as CSSProperties}
    >
      <div className="rowAuraAccent" aria-hidden="true" />
      <button
        type="button"
        className="trackRow__art"
        onClick={() => onSelectTrack(track.id)}
        aria-label={`Play ${track.title}`}
      >
        <div className="trackRow__thumb" style={artStyle} />
        <div className="trackRow__artBadges" aria-hidden="true">
          {track.isDemo && <div className="track-art-badge track-art-badge--row track-art-badge--demo">DEMO</div>}
          {track.artworkSource === "auto" && <div className="track-art-badge track-art-badge--row">AUTO ART</div>}
        </div>
      </button>
      <button
        type="button"
        className="trackRow__metaHit"
        onClick={() => onSelectTrack(track.id)}
        aria-label={`Play ${track.title}`}
      >
        <div className="trackRow__meta">
          <div className="trackRow__title">{track.title}</div>
          <div className="trackRow__sub">{track.sub || "Uploaded"}</div>
          <div className="trackRow__aura">Aura {track.aura}/10</div>
        </div>
      </button>
      <div className="trackRow__controls">
        <button
          type="button"
          className="trackRow__playButton"
          onClick={() => onSelectTrack(track.id)}
          aria-label={`Play ${track.title}`}
        >
          {active && isPlaying ? "Playing" : "Play"}
        </button>
        <button
          className="trackRow__auraButton"
          type="button"
          aria-label="Give aura"
          onClick={(event) => {
            event.stopPropagation();
            const button = event.currentTarget;
            button.classList.remove("trackRow__auraButton--burst");
            void button.offsetWidth;
            button.classList.add("trackRow__auraButton--burst");
            if (navigator.vibrate) navigator.vibrate(12);
            onAuraUp(track.id);
          }}
        >
          Aura +
        </button>
      </div>
    </article>
  );
}
