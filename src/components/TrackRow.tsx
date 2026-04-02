import { useEffect, useRef, type CSSProperties } from "react";
import type { DimMode, Track } from "../types";
import { BorderTrail } from "./BorderTrail";

type Props = {
  track: Track;
  active: boolean;
  isPlaying: boolean;
  dimMode: DimMode;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
};

export function TrackRow({ track, active, isPlaying, dimMode, onSelectTrack, onAuraUp }: Props) {
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const rowFallbackArtwork =
    "radial-gradient(140px 120px at 22% 18%, rgba(150,108,244,.52), rgba(150,108,244,0) 62%), radial-gradient(160px 130px at 84% 82%, rgba(88,176,255,.34), rgba(88,176,255,0) 64%), linear-gradient(145deg, #1a2133, #0f1522)";
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || rowFallbackArtwork } as CSSProperties);
  const auraLevel = Math.max(0, Math.min(1, track.aura / 10));
  const hasAura = track.aura > 0;
  const artist = track.artist?.trim();

  useEffect(() => {
    const onAuraArtHit = (event: Event) => {
      const custom = event as CustomEvent<{ trackId?: string }>;
      if (custom.detail?.trackId !== track.id) return;
      const thumb = thumbRef.current;
      if (!thumb) return;
      thumb.classList.remove("is-aura-flash");
      void thumb.offsetWidth;
      thumb.classList.add("is-aura-flash");
    };

    window.addEventListener("polyplay:aura-art-hit", onAuraArtHit as EventListener);
    return () => window.removeEventListener("polyplay:aura-art-hit", onAuraArtHit as EventListener);
  }, [track.id]);

  return (
    <article
      className={`trackRow ${active && isPlaying ? "is-playing" : ""} ${hasAura ? "rowAuraGlow" : ""}`.trim()}
      data-track-id={track.id}
      data-aura={String(track.aura)}
      style={{ "--row-aura-level": auraLevel.toFixed(2) } as CSSProperties}
    >
      <BorderTrail variant="row" isVisible={active} isPlaying={isPlaying} dimMode={dimMode} />
      <div className="rowAuraAccent" aria-hidden="true" />
      <button
        type="button"
        className="trackRow__art"
        onClick={() => onSelectTrack(track.id)}
        aria-label={`Play ${track.title}`}
      >
        <div ref={thumbRef} className="trackRow__thumb" style={artStyle} />
        <div className="trackRow__artBadges" aria-hidden="true">
          {track.isDemo && <div className="track-art-badge track-art-badge--row track-art-badge--demo">DEMO</div>}
          {track.artworkSource === "auto" && <div className="track-art-badge track-art-badge--row track-art-badge--auto">AUTO</div>}
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
          {artist && <div className="trackRow__sub">{artist}</div>}
          <div className="trackRow__sub">{track.sub || "Imported"}</div>
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
            onAuraUp(track.id);
          }}
        >
          Aura +
        </button>
      </div>
    </article>
  );
}
