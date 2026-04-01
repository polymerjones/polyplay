import type { LoopMode, LoopRegion, RepeatTrackMode } from "../types";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/time";
import { TransportIconButton } from "./TransportIconButton";
import type { CSSProperties, MouseEvent } from "react";

type Props = {
  variant: "mini" | "fullscreen";
  dimMode: "normal" | "dim" | "mute";
  dimControlSkipsSoftDim?: boolean;
  noveltyMode: "normal" | "dim" | "mute";
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopMode: LoopMode;
  loopRegion?: LoopRegion;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  shuffleEnabled: boolean;
  repeatTrackMode: RepeatTrackMode;
  threepeatDisplayCount: number;
  repeatFlashTick: number;
  cinemaMode?: boolean;
  onToggleShuffle: () => void;
  onToggleRepeatTrack: () => void;
  onCycleDimMode: () => void;
  onCycleNoveltyMode: () => void;
  showDimHintCue?: boolean;
  showNoveltyHintCue?: boolean;
  onSetLoop: () => void;
  onToggleLoopMode: () => void;
  onClearLoop: () => void;
  onBeginLoopAdjustment: () => void;
  onFinishLoopAdjustment: () => void;
  canCropAudio?: boolean;
  onOpenCropAudioPrompt?: () => void;
  onVinylScratch?: () => void;
  onAuraUp?: () => void;
  showAuraInline?: boolean;
  onSkip?: (delta: number) => void;
  enableAuraPulse?: boolean;
};

function clampTime(value: number, duration: number): number {
  return Math.max(0, Math.min(duration || 0, value));
}

export function PlayerControls({
  variant,
  dimMode,
  dimControlSkipsSoftDim = false,
  noveltyMode,
  isPlaying,
  currentTime,
  duration,
  loopMode,
  loopRegion,
  onPrev,
  onPlayPause,
  onNext,
  onSeek,
  shuffleEnabled,
  repeatTrackMode,
  threepeatDisplayCount,
  repeatFlashTick,
  cinemaMode = false,
  onToggleShuffle,
  onToggleRepeatTrack,
  onCycleDimMode,
  onCycleNoveltyMode,
  showDimHintCue = false,
  showNoveltyHintCue = false,
  onSetLoop,
  onToggleLoopMode,
  onClearLoop,
  onBeginLoopAdjustment,
  onFinishLoopAdjustment,
  canCropAudio = false,
  onOpenCropAudioPrompt,
  onVinylScratch,
  onAuraUp,
  showAuraInline = true,
  onSkip,
  enableAuraPulse = true
}: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const shuffleFxCooldownRef = useRef(0);
  const shuffleAnimTimeoutRef = useRef<number | null>(null);
  const [shuffleAnimState, setShuffleAnimState] = useState<"on" | "off" | null>(null);
  const repeatActivationTimeoutRef = useRef<number | null>(null);
  const repeatFlashTimeoutRef = useRef<number | null>(null);
  const [repeatFlashActive, setRepeatFlashActive] = useState(false);
  const [repeatActivationActive, setRepeatActivationActive] = useState(false);
  const safeDuration = Math.max(0, duration || 0);
  const safeCurrent = clampTime(currentTime, safeDuration);
  const safeLoopStart = Math.max(0, Math.min(safeDuration, loopRegion?.start ?? 0));
  const safeLoopEndCandidate = loopRegion?.end && loopRegion.end > 0 ? loopRegion.end : safeDuration;
  const safeLoopEnd = Math.max(safeLoopStart, Math.min(safeDuration, safeLoopEndCandidate));
  const hasLoopWindow = loopMode !== "off" && safeDuration > 0 && safeLoopEnd > safeLoopStart;
  const hasLoopBounds = loopRegion?.active && safeDuration > 0 && safeLoopEnd > safeLoopStart;
  const isLoopEditing = Boolean(loopRegion?.editing);
  const primaryLoopLabel = !hasLoopBounds ? "Set Loop" : isLoopEditing ? "Done" : "Edit Loop";
  const handleLoopButton = () => {
    if (isLoopEditing) {
      onFinishLoopAdjustment();
      return;
    }
    if (hasLoopBounds) {
      onBeginLoopAdjustment();
      return;
    }
    onSetLoop();
  };
  const loopStartPct = safeDuration > 0 ? (safeLoopStart / safeDuration) * 100 : 0;
  const loopEndPct = safeDuration > 0 ? (safeLoopEnd / safeDuration) * 100 : 0;
  const loopProgressPct =
    hasLoopWindow && safeLoopEnd > safeLoopStart
      ? (Math.max(safeLoopStart, Math.min(safeCurrent, safeLoopEnd)) - safeLoopStart) / (safeLoopEnd - safeLoopStart)
      : 0;
  const isMuteOnlyDimControl = dimControlSkipsSoftDim;
  const isRepeatActive = repeatTrackMode !== "off";
  const isCountRepeat =
    repeatTrackMode === "repeat-1" || repeatTrackMode === "repeat-2" || repeatTrackMode === "repeat-3";
  const repeatAriaLabel =
    repeatTrackMode === "off"
      ? "Enable repeat"
      : repeatTrackMode === "repeat"
        ? "Switch to repeat once"
        : repeatTrackMode === "repeat-1"
          ? "Switch to repeat 2"
          : repeatTrackMode === "repeat-2"
            ? "Switch to repeat 3"
            : "Disable repeat";
  void onVinylScratch;
  void onToggleLoopMode;

  useEffect(() => {
    if (!enableAuraPulse) return;
    const onAuraTrigger = () => {
      const root = rootRef.current;
      if (!root) return;
      root.classList.remove("is-aura-pulse");
      void root.offsetWidth;
      root.classList.add("is-aura-pulse");
    };
    window.addEventListener("polyplay:aura-trigger", onAuraTrigger);
    return () => window.removeEventListener("polyplay:aura-trigger", onAuraTrigger);
  }, [enableAuraPulse]);

  useEffect(() => {
    return () => {
      if (shuffleAnimTimeoutRef.current !== null) {
        window.clearTimeout(shuffleAnimTimeoutRef.current);
        shuffleAnimTimeoutRef.current = null;
      }
      if (repeatActivationTimeoutRef.current !== null) {
        window.clearTimeout(repeatActivationTimeoutRef.current);
        repeatActivationTimeoutRef.current = null;
      }
      if (repeatFlashTimeoutRef.current !== null) {
        window.clearTimeout(repeatFlashTimeoutRef.current);
        repeatFlashTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (repeatFlashTick <= 0) return;
    setRepeatFlashActive(false);
    const rafId = window.requestAnimationFrame(() => {
      setRepeatFlashActive(true);
      if (repeatFlashTimeoutRef.current !== null) {
        window.clearTimeout(repeatFlashTimeoutRef.current);
      }
      repeatFlashTimeoutRef.current = window.setTimeout(() => {
        setRepeatFlashActive(false);
        repeatFlashTimeoutRef.current = null;
      }, 260);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [repeatFlashTick]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const emitPinkSparkle = (
    button: HTMLButtonElement,
    options?: { sparks?: number; distance?: number; includeFlash?: boolean }
  ) => {
    const sparks = options?.sparks ?? 7;
    const distance = options?.distance ?? 24;
    if (options?.includeFlash !== false) {
      button.classList.remove("pc-btn--aura-burst");
      void button.offsetWidth;
      button.classList.add("pc-btn--aura-burst");
    }
    const burst = document.createElement("span");
    burst.className = "pc-aura-burst";
    for (let i = 0; i < sparks; i += 1) {
      const sparkle = document.createElement("span");
      sparkle.className = "pc-aura-burst__spark";
      const angle = (i / sparks) * Math.PI * 2;
      sparkle.style.setProperty("--tx", `${Math.cos(angle) * distance}px`);
      sparkle.style.setProperty("--ty", `${Math.sin(angle) * distance}px`);
      sparkle.style.setProperty("--delay", `${i * 34}ms`);
      burst.appendChild(sparkle);
    }
    button.appendChild(burst);
    burst.addEventListener("animationend", () => burst.remove(), { once: true });
  };

  const onShuffleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const nextEnabled = !shuffleEnabled;
    onToggleShuffle();
    if (prefersReducedMotion()) return;

    setShuffleAnimState(nextEnabled ? "on" : "off");
    if (shuffleAnimTimeoutRef.current !== null) {
      window.clearTimeout(shuffleAnimTimeoutRef.current);
    }
    shuffleAnimTimeoutRef.current = window.setTimeout(() => {
      setShuffleAnimState(null);
      shuffleAnimTimeoutRef.current = null;
    }, 240);

    const now = Date.now();
    if (nextEnabled && now - shuffleFxCooldownRef.current >= 420) {
      shuffleFxCooldownRef.current = now;
      emitPinkSparkle(button, { sparks: 5, distance: 18, includeFlash: true });
    }
  };

  const onRepeatClick = (event: MouseEvent<HTMLButtonElement>) => {
    const nextMode: RepeatTrackMode =
      repeatTrackMode === "off"
        ? "repeat"
        : repeatTrackMode === "repeat"
          ? "repeat-1"
          : repeatTrackMode === "repeat-1"
            ? "repeat-2"
            : repeatTrackMode === "repeat-2"
              ? "repeat-3"
              : "off";
    onToggleRepeatTrack();
    if (prefersReducedMotion() || nextMode !== "repeat-3") return;
    const button = event.currentTarget;
    setRepeatActivationActive(false);
    const rafId = window.requestAnimationFrame(() => {
      setRepeatActivationActive(true);
      emitPinkSparkle(button, { sparks: 7, distance: 22, includeFlash: true });
      if (repeatActivationTimeoutRef.current !== null) {
        window.clearTimeout(repeatActivationTimeoutRef.current);
      }
      repeatActivationTimeoutRef.current = window.setTimeout(() => {
        setRepeatActivationActive(false);
        repeatActivationTimeoutRef.current = null;
      }, 380);
    });
    window.setTimeout(() => window.cancelAnimationFrame(rafId), 0);
  };

  return (
    <section
      ref={rootRef}
      className={`player-controls player-controls--${variant} ${loopMode !== "off" ? "is-loop-active" : ""} ${
        cinemaMode ? "is-cinema-mode" : ""
      }`.trim()}
      aria-label="Player controls"
    >
      <div className={`pc-progress ${hasLoopWindow ? "has-loop-window" : ""}`.trim()}>
        {hasLoopWindow && (
          <div
            className="pc-progress__loop-window"
            aria-hidden="true"
            style={
              {
                "--pc-loop-start-pct": `${loopStartPct}%`,
                "--pc-loop-end-pct": `${loopEndPct}%`,
                "--pc-loop-progress-pct": `${loopProgressPct * 100}%`
              } as CSSProperties
            }
          >
            <div className="pc-progress__loop-fill" />
            <div className="pc-progress__loop-marker is-start" />
            <div className="pc-progress__loop-marker is-end" />
          </div>
        )}
        <input
          className="pc-range"
          type="range"
          min={0}
          max={safeDuration}
          step={0.1}
          value={safeCurrent}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          aria-label="Seek"
        />
        <div className="pc-time">
          <time dateTime={`PT${Math.floor(safeCurrent)}S`}>{formatTime(safeCurrent)}</time>
          <time dateTime={`PT${Math.floor(safeDuration)}S`}>{formatTime(safeDuration)}</time>
        </div>
      </div>

      {cinemaMode ? null : (
        <>

      <div className="pc-row" role="group" aria-label="Transport controls">
        <TransportIconButton
          icon={
            <svg className="pc-shuffle-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h3.2c1 0 1.9.5 2.4 1.2l1.3 1.8m2.1 2.9 1.3 1.8c.5.7 1.4 1.2 2.4 1.2H20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 7h-3.2c-1 0-1.9.5-2.4 1.2L11 12.8M4 17h3.2c1 0 1.9-.5 2.4-1.2L11 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M17 5l3 2-3 2M17 15l3 2-3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          active={shuffleEnabled}
          onClick={onShuffleClick}
          ariaLabel={shuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
          size="sm"
          className={`pc-transport-btn--shuffle ${
            shuffleAnimState === "on" ? "is-anim-on" : shuffleAnimState === "off" ? "is-anim-off" : ""
          }`.trim()}
        />
        <button type="button" className="pc-btn pc-btn--icon" aria-label="Previous track" onClick={onPrev}>
          <span className="pc-icon pc-icon--prev" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pc-btn pc-btn--primary pc-btn--icon"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={onPlayPause}
        >
          <span className={`pc-icon ${isPlaying ? "pc-icon--pause" : "pc-icon--play"}`} aria-hidden="true" />
        </button>
        <button type="button" className="pc-btn pc-btn--icon" aria-label="Next track" onClick={onNext}>
          <span className="pc-icon pc-icon--next" aria-hidden="true" />
        </button>
        <TransportIconButton
          icon={
            <span className="pc-repeat-wrap" aria-hidden="true">
              <svg className="pc-repeat-icon" viewBox="0 0 24 24">
                <path d="M17 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 11V9a4 4 0 0 1 4-4h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 22l-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 13v2a4 4 0 0 1-4 4H4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {isCountRepeat && <span className="pc-repeat-badge">{Math.max(0, threepeatDisplayCount)}</span>}
            </span>
          }
          active={isRepeatActive}
          onClick={onRepeatClick}
          ariaLabel={repeatAriaLabel}
          size="sm"
          className={`${isCountRepeat ? "pc-transport-btn--repeat-threepeat" : ""} ${
            repeatFlashActive && isCountRepeat ? "pc-transport-btn--repeat-flash" : ""
          } ${
            repeatActivationActive && repeatTrackMode === "repeat-3" ? "pc-transport-btn--repeat-activation" : ""
          }`.trim()}
        />
        <button
          type="button"
          className={`pc-btn pc-btn--sm pc-dim-btn ${dimMode === "normal" ? "" : "is-active"} ${
            showDimHintCue ? "has-onboarding-hint" : ""
          } ${
            dimMode === "mute" ? "is-mute" : ""
          }`.trim()}
          onClick={onCycleDimMode}
          aria-label={
            isMuteOnlyDimControl
              ? dimMode === "mute"
                ? "Sound: mute active"
                : "Sound: mute control (currently normal)"
              : dimMode === "normal"
                ? "Brightness: dim control (currently normal)"
                : dimMode === "dim"
                  ? "Brightness: dim active"
                  : "Brightness: mute active"
          }
        >
          {dimMode === "mute" || isMuteOnlyDimControl ? "MUTE" : "DIM"}
        </button>
        <button
          type="button"
          className={`pc-btn pc-btn--sm pc-novelty-btn ${noveltyMode === "normal" ? "" : "is-active"} ${
            showNoveltyHintCue ? "has-onboarding-hint" : ""
          } ${
            noveltyMode === "mute" ? "is-mute" : ""
          }`.trim()}
          onClick={onCycleNoveltyMode}
          aria-label={
            noveltyMode === "normal"
              ? "Visual style: normal"
              : noveltyMode === "dim"
                ? "Visual style: dim vibe"
                : "Visual style: mute freeze"
          }
          title="Visual style mode"
        >
          <svg className="pc-novelty-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M4.7 12c.8-.9 1.5-.9 2.3 0s1.5.9 2.3 0 1.5-.9 2.3 0 1.5.9 2.3 0 1.5-.9 2.3 0 1.5.9 2.3 0" />
            <circle cx="11.4" cy="8.15" r="1.05" />
            <path d="M12.1 9.5c-.55 1.8-.35 2.95 1.35 3.7l1.95.85M11.7 10.6l-1.4 2.6M10.3 13.2l1.3 2.75" />
          </svg>
        </button>
        {onAuraUp && showAuraInline && (
          <button
            type="button"
            className="pc-btn pc-btn--primary pc-btn--aura pc-btn--aura-inline"
            onClick={(event) => {
              const button = event.currentTarget;
              emitPinkSparkle(button, { sparks: 7, distance: 24, includeFlash: true });
              onAuraUp();
            }}
          >
            Aura +
          </button>
        )}
      </div>

      <div className="pc-extras" role="group" aria-label="Playback options">
        {onSkip && (
          <div className="pc-skip-row" role="group" aria-label="Skip controls">
            <button type="button" className="pc-btn pc-btn--sm pc-extra-skip" onClick={() => onSkip(-30)}>
              -30s
            </button>
            <button type="button" className="pc-btn pc-btn--sm pc-extra-skip" onClick={() => onSkip(-10)}>
              -10s
            </button>
            <button type="button" className="pc-btn pc-btn--sm pc-extra-skip" onClick={() => onSkip(10)}>
              +10s
            </button>
            <button type="button" className="pc-btn pc-btn--sm pc-extra-skip" onClick={() => onSkip(30)}>
              +30s
            </button>
          </div>
        )}
        {variant !== "mini" && (
          <div className="pc-loop-row" role="group" aria-label="Loop controls">
            <button
              type="button"
              className={`pc-btn pc-btn--sm pc-btn--toggle ${isLoopEditing ? "is-active" : ""}`.trim()}
              onClick={handleLoopButton}
            >
              {primaryLoopLabel}
            </button>
            <button type="button" className="pc-btn pc-btn--sm" onClick={onClearLoop}>
              Clear Loop
            </button>
            <button
              type="button"
              className="pc-btn pc-btn--sm"
              onClick={onOpenCropAudioPrompt}
              disabled={!canCropAudio || !onOpenCropAudioPrompt}
              aria-disabled={!canCropAudio || !onOpenCropAudioPrompt}
            >
              Crop Audio
            </button>
          </div>
        )}
      </div>
        </>
      )}
    </section>
  );
}
