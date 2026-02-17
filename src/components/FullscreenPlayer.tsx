import type { CSSProperties } from "react";
import { formatTime } from "../lib/time";
import type { Track } from "../types";

type Props = {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onClose: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
};

const DEFAULT_ART =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23263140'/%3E%3Cstop offset='100%25' stop-color='%23101822'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' rx='36' fill='url(%23g)'/%3E%3C/svg%3E";

export function FullscreenPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  onClose,
  onPrev,
  onPlayPause,
  onNext,
  onSeek
}: Props) {
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || `url('${DEFAULT_ART}')` } as CSSProperties);

  return (
    <section className="fullscreen-player" role="dialog" aria-modal="true" aria-label="Fullscreen player">
      <div className="fullscreen-player-bg" style={artStyle} aria-hidden="true" />

      <button className="fullscreen-close" aria-label="Close fullscreen player" onClick={onClose}>
        ✕
      </button>

      <div className="fullscreen-content">
        <div className="fullscreen-art" style={artStyle} />

        <div className="fullscreen-meta">
          <h2>{track.title}</h2>
          <p>
            {formatTime(currentTime)} / {formatTime(duration)} • Aura {track.aura}/5
          </p>
        </div>

        <div className="fullscreen-time-row">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <input
          className="fullscreen-seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(duration || 0, Math.max(0, currentTime))}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          aria-label="Seek"
        />

        <div className="fullscreen-controls">
          <button className="fs-ctrl" aria-label="Previous" onClick={onPrev}>
            ⏮
          </button>
          <button className="fs-ctrl fs-play" aria-label="Play or pause" onClick={onPlayPause}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button className="fs-ctrl" aria-label="Next" onClick={onNext}>
            ⏭
          </button>
        </div>
      </div>
    </section>
  );
}
