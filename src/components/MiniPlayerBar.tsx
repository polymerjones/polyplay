import { useRef } from "react";
import type { CSSProperties } from "react";
import { formatTime } from "../lib/time";
import type { LoopRegion, Track } from "../types";
import { WaveformLoop } from "./WaveformLoop";
import { PlayerControls } from "./PlayerControls";

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
  onSetLoop: () => void;
  onToggleLoopActive: () => void;
  onClearLoop: () => void;
  onOpenFullscreen: () => void;
};

const DEFAULT_ART =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23263140'/%3E%3Cstop offset='100%25' stop-color='%23101822'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' rx='36' fill='url(%23g)'/%3E%3C/svg%3E";

export function MiniPlayerBar({
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
  onSetLoop,
  onToggleLoopActive,
  onClearLoop,
  onOpenFullscreen
}: Props) {
  const artRef = useRef<HTMLButtonElement | null>(null);
  const artStyle = track?.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track?.artGrad || `url('${DEFAULT_ART}')` } as CSSProperties);
  const classes = ["mini-player-bar"];
  if (loopRegion.active) classes.push("is-loop-active");
  if (loopRegion.editing) classes.push("is-loop-editing");

  const triggerArtworkFlash = () => {
    const art = artRef.current;
    if (!art) return;
    art.classList.remove("is-aura-flash");
    void art.offsetWidth;
    art.classList.add("is-aura-flash");
  };

  return (
    <section
      className={classes.join(" ")}
      style={
        {
          "--player-artwork": track?.artUrl
            ? `url('${track.artUrl}')`
            : track?.artGrad || `url('${DEFAULT_ART}')`
        } as CSSProperties
      }
      aria-label="Mini player"
    >
      <div className="mini-player-bar__header">
        <button
          type="button"
          className="mini-player-bar__art"
          ref={artRef}
          style={artStyle}
          aria-label="Open fullscreen player"
          onClick={onOpenFullscreen}
        />
        <div className="mini-player-bar__meta">
          <div className="mini-player-bar__title">{track?.title ?? "Select a track"}</div>
          <div className="mini-player-bar__sub">
            {formatTime(currentTime)} / {formatTime(duration)} • Aura {track?.aura ?? 0}/5
          </div>
          {track?.missingAudio && <div className="mini-player-bar__sub">Missing audio</div>}
          {track?.missingArt && <div className="mini-player-bar__sub">Missing artwork</div>}
        </div>
      </div>

      <PlayerControls
        variant="mini"
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
        onAuraUp={
          track
            ? () => {
                triggerArtworkFlash();
                onAuraUp();
              }
            : undefined
        }
        onSkip={onSkip}
      />

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
