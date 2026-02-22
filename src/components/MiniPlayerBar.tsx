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
  dimMode: "normal" | "dim" | "mute";
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onAuraUp: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (delta: number) => void;
  shuffleEnabled: boolean;
  repeatTrackEnabled: boolean;
  onToggleShuffle: () => void;
  onToggleRepeatTrack: () => void;
  onCycleDimMode: () => void;
  onVinylScratch: () => void;
  onSetLoopRange: (start: number, end: number, active: boolean) => void;
  onSetLoop: () => void;
  onToggleLoopMode: () => void;
  onClearLoop: () => void;
  onOpenFullscreen: () => void;
  isCompact: boolean;
  onToggleCompact: () => void;
};

export function MiniPlayerBar({
  track,
  isPlaying,
  currentTime,
  duration,
  loopRegion,
  loopMode,
  dimMode,
  onPrev,
  onPlayPause,
  onNext,
  onAuraUp,
  onSeek,
  onSkip,
  shuffleEnabled,
  repeatTrackEnabled,
  onToggleShuffle,
  onToggleRepeatTrack,
  onCycleDimMode,
  onVinylScratch,
  onSetLoopRange,
  onSetLoop,
  onToggleLoopMode,
  onClearLoop,
  onOpenFullscreen,
  isCompact,
  onToggleCompact
}: Props) {
  const artRef = useRef<HTMLButtonElement | null>(null);
  const artStyle = track?.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track?.artGrad || `url('${DEFAULT_ARTWORK_URL}')` } as CSSProperties);
  const classes = ["mini-player-bar"];
  if (loopRegion.active) classes.push("is-loop-active");
  if (loopRegion.editing) classes.push("is-loop-editing");
  if (isCompact) classes.push("is-compact");

  const triggerArtworkFlash = () => {
    const art = artRef.current;
    if (!art) return;
    art.classList.remove("is-aura-flash");
    void art.offsetWidth;
    art.classList.add("is-aura-flash");
  };

  return (
    <section
      id="polyPlayer"
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
        <button
          type="button"
          className="mini-player-bar__compact-toggle"
          aria-label={isCompact ? "Expand player" : "Collapse player"}
          onClick={onToggleCompact}
        >
          <span aria-hidden="true">{isCompact ? "▴" : "▾"}</span>
        </button>
      </div>

      <PlayerControls
        variant="mini"
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        loopMode={loopMode}
        dimMode={dimMode}
        onPrev={onPrev}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onSeek={onSeek}
        shuffleEnabled={shuffleEnabled}
        repeatTrackEnabled={repeatTrackEnabled}
        onToggleShuffle={onToggleShuffle}
        onToggleRepeatTrack={onToggleRepeatTrack}
        onCycleDimMode={onCycleDimMode}
        onVinylScratch={onVinylScratch}
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

      <div className="playerExpanded">
        <WaveformLoop
          track={track}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          loopRegion={loopRegion}
          onSeek={onSeek}
          onSetLoopRange={onSetLoopRange}
        />
      </div>
    </section>
  );
}
