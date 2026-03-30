import { useRef } from "react";
import type { CSSProperties } from "react";
import { formatTime } from "../lib/time";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import type { LoopMode, LoopRegion, RepeatTrackMode, Track } from "../types";
import { fireLightHaptic } from "../lib/haptics";
import { WaveformLoop } from "./WaveformLoop";
import { PlayerControls } from "./PlayerControls";

const MINI_PLAYER_SWIPE_TOGGLE_DISTANCE_PX = 96;
const MINI_PLAYER_SWIPE_TOGGLE_MAX_SIDEWAYS_PX = 72;
const MINI_PLAYER_SWIPE_TOGGLE_MIN_VELOCITY = 0.42;

type Props = {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopRegion: LoopRegion;
  loopMode: LoopMode;
  dimMode: "normal" | "dim" | "mute";
  dimControlSkipsSoftDim?: boolean;
  noveltyMode: "normal" | "dim" | "mute";
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onAuraUp: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (delta: number) => void;
  shuffleEnabled: boolean;
  repeatTrackMode: RepeatTrackMode;
  threepeatDisplayCount: number;
  repeatFlashTick: number;
  onToggleShuffle: () => void;
  onToggleRepeatTrack: () => void;
  onCycleDimMode: () => void;
  onCycleNoveltyMode: () => void;
  onVinylScratch: () => void;
  onSetLoopRange: (
    start: number,
    end: number,
    active: boolean,
    options?: { persist?: boolean; editing?: boolean }
  ) => void;
  onSetLoop: () => void;
  onToggleLoopMode: () => void;
  onClearLoop: () => void;
  canCropAudio?: boolean;
  onOpenCropAudioPrompt?: () => void;
  onOpenFullscreen: () => void;
  showFullscreenHintCue: boolean;
  showCompactHintCue: boolean;
  showVibeHintCue: boolean;
  showDimHintCue: boolean;
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
  dimControlSkipsSoftDim = false,
  noveltyMode,
  onPrev,
  onPlayPause,
  onNext,
  onAuraUp,
  onSeek,
  onSkip,
  shuffleEnabled,
  repeatTrackMode,
  threepeatDisplayCount,
  repeatFlashTick,
  onToggleShuffle,
  onToggleRepeatTrack,
  onCycleDimMode,
  onCycleNoveltyMode,
  onVinylScratch,
  onSetLoopRange,
  onSetLoop,
  onToggleLoopMode,
  onClearLoop,
  canCropAudio = false,
  onOpenCropAudioPrompt,
  onOpenFullscreen,
  showFullscreenHintCue,
  showCompactHintCue,
  showVibeHintCue,
  showDimHintCue,
  isCompact,
  onToggleCompact
}: Props) {
  const artRef = useRef<HTMLButtonElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
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

  const beginSwipeToggle = (touch: { clientX: number; clientY: number }) => {
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now()
    };
  };

  const endSwipeToggle = (touch: { clientX: number; clientY: number }) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > MINI_PLAYER_SWIPE_TOGGLE_MAX_SIDEWAYS_PX) return;
    const elapsedMs = Math.max(1, performance.now() - start.at);
    const velocity = dy / elapsedMs;
    const qualifiesForCollapse = dy >= MINI_PLAYER_SWIPE_TOGGLE_DISTANCE_PX || velocity >= MINI_PLAYER_SWIPE_TOGGLE_MIN_VELOCITY;
    const qualifiesForExpand = dy <= -MINI_PLAYER_SWIPE_TOGGLE_DISTANCE_PX || velocity <= -MINI_PLAYER_SWIPE_TOGGLE_MIN_VELOCITY;
    if ((!isCompact && qualifiesForCollapse) || (isCompact && qualifiesForExpand)) {
      fireLightHaptic();
      onToggleCompact();
    }
  };

  const shouldPreventSwipeScroll = (touch: { clientX: number; clientY: number }) => {
    const start = swipeStartRef.current;
    if (!start) return false;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    return Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx);
  };

  const canStartSwipeToggle = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.closest(".mini-player-bar__art, .mini-player-bar__aura-toggle, .mini-player-bar__loop-clear")) return false;
    return Boolean(element.closest(".mini-player-bar__meta, .mini-player-bar__compact-toggle, .mini-player-bar__header"));
  };

  const canToggleCompactFromDesktopHeader = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.closest(".mini-player-bar__art, .mini-player-bar__aura-toggle, .mini-player-bar__loop-clear, .mini-player-bar__compact-toggle")) {
      return false;
    }
    return Boolean(element.closest(".mini-player-bar__meta, .mini-player-bar__header"));
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
      <div
        className="mini-player-bar__header"
        onTouchStart={(event) => {
          if (event.touches.length !== 1) {
            swipeStartRef.current = null;
            return;
          }
          if (!canStartSwipeToggle(event.target)) {
            swipeStartRef.current = null;
            return;
          }
          beginSwipeToggle(event.touches[0]);
        }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0];
          if (!touch) return;
          endSwipeToggle(touch);
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          if (shouldPreventSwipeScroll(touch)) {
            event.preventDefault();
          }
        }}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
        onDoubleClick={(event) => {
          if (!canToggleCompactFromDesktopHeader(event.target)) return;
          onToggleCompact();
        }}
      >
        <button
          type="button"
          className={`mini-player-bar__art ${showFullscreenHintCue ? "has-fullscreen-hint" : ""}`.trim()}
          ref={artRef}
          style={artStyle}
          aria-label="Open fullscreen player"
          onClick={onOpenFullscreen}
        />
        <div className="mini-player-bar__meta">
          <div className="mini-player-bar__title">{track?.title ?? "Select a track"}</div>
          <div className="mini-player-bar__sub">
            {formatTime(currentTime)} / {formatTime(duration)} • Aura {track?.aura ?? 0}/10
          </div>
          {track?.missingAudio && <div className="mini-player-bar__sub">Missing audio</div>}
          {track?.missingArt && <div className="mini-player-bar__sub">Missing artwork</div>}
        </div>
        <div className="mini-player-bar__header-actions">
          {loopMode !== "off" && (
            <button
              type="button"
              className="mini-player-bar__loop-clear"
              aria-label="Clear active loop"
              onClick={onClearLoop}
            >
              ⟲
            </button>
          )}
          {track && (
            <button
              type="button"
              className="mini-player-bar__aura-toggle"
              aria-label="Increase aura"
              onClick={() => {
                triggerArtworkFlash();
                onAuraUp();
              }}
            >
              Aura +
            </button>
          )}
          <button
            type="button"
            className={`mini-player-bar__compact-toggle ${showCompactHintCue ? "has-onboarding-hint" : ""}`.trim()}
            aria-label={isCompact ? "Expand player" : "Collapse player"}
            onClick={onToggleCompact}
          >
            <span aria-hidden="true">{isCompact ? "▴" : "▾"}</span>
          </button>
        </div>
      </div>

      <PlayerControls
        variant="mini"
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        loopMode={loopMode}
        loopRegion={loopRegion}
        dimMode={dimMode}
        dimControlSkipsSoftDim={dimControlSkipsSoftDim}
        noveltyMode={noveltyMode}
        onPrev={onPrev}
        onPlayPause={onPlayPause}
        onNext={onNext}
        onSeek={onSeek}
        shuffleEnabled={shuffleEnabled}
        repeatTrackMode={repeatTrackMode}
        threepeatDisplayCount={threepeatDisplayCount}
        repeatFlashTick={repeatFlashTick}
        onToggleShuffle={onToggleShuffle}
        onToggleRepeatTrack={onToggleRepeatTrack}
        onCycleDimMode={onCycleDimMode}
        onCycleNoveltyMode={onCycleNoveltyMode}
        showDimHintCue={showDimHintCue}
        showNoveltyHintCue={showVibeHintCue}
        onVinylScratch={onVinylScratch}
        onSetLoop={onSetLoop}
        onToggleLoopMode={onToggleLoopMode}
        onClearLoop={onClearLoop}
        canCropAudio={canCropAudio}
        onOpenCropAudioPrompt={onOpenCropAudioPrompt}
        onAuraUp={
          track
            ? () => {
                triggerArtworkFlash();
                onAuraUp();
              }
            : undefined
        }
        showAuraInline={false}
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
