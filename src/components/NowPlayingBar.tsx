import type { CSSProperties } from "react";
import { formatTime } from "../lib/time";
import type { LoopRegion, Track } from "../types";
import { ControlsVisualizer } from "./ControlsVisualizer";
import { WaveformLoop } from "./WaveformLoop";

type Props = {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopRegion: LoopRegion;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onAuraUp: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (delta: number) => void;
  onSetLoopRange: (start: number, end: number, active: boolean) => void;
  onToggleLoopActive: () => void;
  onClearLoop: () => void;
  onOpenFullscreen: () => void;
};

const DEFAULT_ART =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23263140'/%3E%3Cstop offset='100%25' stop-color='%23101822'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' rx='36' fill='url(%23g)'/%3E%3C/svg%3E";

export function NowPlayingBar({
  track,
  isPlaying,
  currentTime,
  duration,
  loopRegion,
  onPrev,
  onPlayPause,
  onNext,
  onAuraUp,
  onSeek,
  onSkip,
  onSetLoopRange,
  onToggleLoopActive,
  onClearLoop,
  onOpenFullscreen
}: Props) {
  const artStyle = track?.artUrl
    ? { backgroundImage: `url('${track.artUrl}')` }
    : { backgroundImage: track?.artGrad || `url('${DEFAULT_ART}')` };

  const classes = ["now-playing"];
  if (!track) classes.push("empty");
  if (loopRegion.active) classes.push("loop-active");
  if (loopRegion.editing) classes.push("loop-editing");

  return (
    <section
      className={classes.join(" ")}
      style={
        {
          "--np-artwork": track?.artUrl
            ? `url('${track.artUrl}')`
            : track?.artGrad || `url('${DEFAULT_ART}')`
        } as CSSProperties
      }
    >
      <div className="np-track">
        <button
          type="button"
          className="np-art"
          id="npArt"
          style={artStyle}
          aria-label="Open fullscreen player"
          onClick={onOpenFullscreen}
        />
        <div className="np-meta">
          <div className="np-title">{track?.title ?? "Select a track"}</div>
          <div className="np-sub">
            {formatTime(currentTime)} / {formatTime(duration)} • Aura {track?.aura ?? 0}/5
          </div>
        </div>
      </div>

      <div className="control-stack">
        <ControlsVisualizer isPlaying={isPlaying} />
        <div className="controls">
          <button className="ctrl track prev" onClick={onPrev} aria-label="Previous track">
            <span className="track-icon prev-icon" aria-hidden="true">
              ⏮
            </span>
          </button>
          <button className="ctrl skip" onClick={() => onSkip(-5)}>
            -5
          </button>
          <button className="ctrl skip" onClick={() => onSkip(-10)}>
            -10
          </button>
          <button className={`ctrl play ${isPlaying ? "playing" : "paused"}`} onClick={onPlayPause} aria-label="Play or pause">
            <span className="icon-play" />
            <span className="icon-pause" />
          </button>
          <button className="ctrl skip" onClick={() => onSkip(5)}>
            +5
          </button>
          <button className="ctrl skip" onClick={() => onSkip(10)}>
            +10
          </button>
          <button className="ctrl track next" onClick={onNext} aria-label="Next track">
            <span className="track-icon next-icon" aria-hidden="true">
              ⏭
            </span>
          </button>
        </div>

        <div className="aux">
          <button className="ghost aux-track prev" onClick={onPrev} aria-label="Previous track">
            <span className="track-icon prev-icon" aria-hidden="true">
              ⏮
            </span>
          </button>
          <button
            className="ghost aura-btn"
            disabled={!track}
            onContextMenu={(event) => event.preventDefault()}
            onClick={(event) => {
              if (!track) return;
              const button = event.currentTarget;
              button.classList.remove("aura-btn-flash");
              void button.offsetWidth;
              button.classList.add("aura-btn-flash");
              const sparkle = document.createElement("span");
              sparkle.className = "aura-btn-sparkle";
              button.appendChild(sparkle);
              sparkle.addEventListener("animationend", () => sparkle.remove(), { once: true });
              if (navigator.vibrate) navigator.vibrate(12);
              onAuraUp();
            }}
          >
            Aura +
          </button>
          <button className="ghost aux-track next" onClick={onNext} aria-label="Next track">
            <span className="track-icon next-icon" aria-hidden="true">
              ⏭
            </span>
          </button>
          <button className="ghost">Add Note</button>
          <button className={`ghost loop-btn ${loopRegion.active ? "active" : ""}`} onClick={onToggleLoopActive}>
            ⟲ Loop
          </button>
          <button className="ghost clear-loop" onClick={onClearLoop}>
            Clear Loop
          </button>
        </div>
      </div>

      <WaveformLoop
        track={track}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        loopRegion={loopRegion}
        onSeek={onSeek}
        onSetLoopRange={onSetLoopRange}
      />
    </section>
  );
}
