import { useRef } from "react";
import type { CSSProperties } from "react";
import { formatTime } from "../lib/time";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import type { LoopMode, LoopRegion, Track } from "../types";
import { WaveformLoop } from "./WaveformLoop";
import { PlayerControls } from "./PlayerControls";

type Props = {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopRegion: LoopRegion;
  loopMode: LoopMode;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onAuraUp: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (delta: number) => void;
  onSetLoopRange: (start: number, end: number, active: boolean) => void;
  onSetLoop: () => void;
  onToggleLoopMode: () => void;
  onClearLoop: () => void;
  onOpenFullscreen: () => void;
};

export function MiniPlayerBar({
  track,
  isPlaying,
  currentTime,
  duration,
  loopRegion,
  loopMode,
  onPrev,
  onPlayPause,
  onNext,
  onAuraUp,
  onSeek,
  onSkip,
  onSetLoopRange,
  onSetLoop,
  onToggleLoopMode,
  onClearLoop,
  onOpenFullscreen
}: Props) {
  const artRef = useRef<HTMLButtonElement | null>(null);
  const artStyle = track?.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track?.artGrad || `url('${DEFAULT_ARTWORK_URL}')` } as CSSProperties);
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
            : track?.artGrad || `url('${DEFAULT_ARTWORK_URL}')`
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
        loopMode={loopMode}
        onPrev={onPrev}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onSeek={onSeek}
        onSetLoop={onSetLoop}
        onToggleLoopMode={onToggleLoopMode}
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
