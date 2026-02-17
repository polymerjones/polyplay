import { useRef } from "react";
import type { CSSProperties } from "react";
import { formatTime } from "../lib/time";
import type { LoopRegion, Track } from "../types";
import { PlayerControls } from "./PlayerControls";

type Props = {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopRegion: LoopRegion;
  onClose: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onSetLoop: () => void;
  onToggleLoopActive: () => void;
  onClearLoop: () => void;
  onAuraUp: () => void;
  onSkip: (delta: number) => void;
};

const DEFAULT_ART =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23263140'/%3E%3Cstop offset='100%25' stop-color='%23101822'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' rx='36' fill='url(%23g)'/%3E%3C/svg%3E";

export function FullscreenPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  loopRegion,
  onClose,
  onPrev,
  onPlayPause,
  onNext,
  onSeek,
  onSetLoop,
  onToggleLoopActive,
  onClearLoop,
  onAuraUp,
  onSkip
}: Props) {
  const artRef = useRef<HTMLDivElement | null>(null);
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || `url('${DEFAULT_ART}')` } as CSSProperties);
  const hasArtworkVideo = Boolean(track.artVideoUrl);

  const triggerArtworkFlash = () => {
    const art = artRef.current;
    if (!art) return;
    art.classList.remove("is-aura-flash");
    void art.offsetWidth;
    art.classList.add("is-aura-flash");
  };

  return (
    <section className="fullscreen-player-shell" role="dialog" aria-modal="true" aria-label="Fullscreen player">
      <div className="fullscreen-player-shell__bg" style={artStyle} aria-hidden="true" />

      <button className="fullscreen-player-shell__close" aria-label="Close fullscreen player" onClick={onClose}>
        ✕
      </button>

      <div className="fullscreen-player-shell__content">
        <div
          className={`fullscreen-player-shell__art ${hasArtworkVideo ? "has-video" : ""}`}
          ref={artRef}
          style={hasArtworkVideo ? undefined : artStyle}
        >
          {hasArtworkVideo && (
            <video
              key={track.artVideoUrl}
              className="fullscreen-player-shell__art-video"
              src={track.artVideoUrl}
              muted
              loop
              autoPlay
              playsInline
            />
          )}
        </div>

        <div className="fullscreen-player-shell__meta">
          <h2>{track.title}</h2>
          <p>
            {formatTime(currentTime)} / {formatTime(duration)} • Aura {track.aura}/5
          </p>
          {track.missingAudio && <p>Missing audio</p>}
          {track.missingArt && <p>Missing artwork</p>}
        </div>

        <PlayerControls
          variant="fullscreen"
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          loopActive={loopRegion.active}
          onPrev={onPrev}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onSeek={onSeek}
          onSetLoop={onSetLoop}
          onToggleLoop={onToggleLoopActive}
          onClearLoop={onClearLoop}
          onAuraUp={() => {
            triggerArtworkFlash();
            onAuraUp();
          }}
          onSkip={onSkip}
        />
      </div>
    </section>
  );
}
