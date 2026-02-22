import type { LoopMode } from "../types";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/time";
import { TransportIconButton } from "./TransportIconButton";
import type { MouseEvent } from "react";

type Props = {
  variant: "mini" | "fullscreen";
  dimMode: "normal" | "dim" | "mute";
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopMode: LoopMode;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  shuffleEnabled: boolean;
  repeatTrackEnabled: boolean;
  onToggleShuffle: () => void;
  onToggleRepeatTrack: () => void;
  onCycleDimMode: () => void;
  onSetLoop: () => void;
  onToggleLoopMode: () => void;
  onClearLoop: () => void;
  onVinylScratch?: () => void;
  onAuraUp?: () => void;
  onSkip?: (delta: number) => void;
};

function clampTime(value: number, duration: number): number {
  return Math.max(0, Math.min(duration || 0, value));
}

export function PlayerControls({
  variant,
  dimMode,
  isPlaying,
  currentTime,
  duration,
  loopMode,
  onPrev,
  onPlayPause,
  onNext,
  onSeek,
  shuffleEnabled,
  repeatTrackEnabled,
  onToggleShuffle,
  onToggleRepeatTrack,
  onCycleDimMode,
  onSetLoop,
  onToggleLoopMode,
  onClearLoop,
  onVinylScratch,
  onAuraUp,
  onSkip
}: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const shuffleFxCooldownRef = useRef(0);
  const shuffleAnimTimeoutRef = useRef<number | null>(null);
  const [shuffleAnimState, setShuffleAnimState] = useState<"on" | "off" | null>(null);
  const safeDuration = Math.max(0, duration || 0);
  const safeCurrent = clampTime(currentTime, safeDuration);
  void onVinylScratch;
  void onToggleLoopMode;

  useEffect(() => {
    const onAuraTrigger = () => {
      const root = rootRef.current;
      if (!root) return;
      root.classList.remove("is-aura-pulse");
      void root.offsetWidth;
      root.classList.add("is-aura-pulse");
    };
    window.addEventListener("polyplay:aura-trigger", onAuraTrigger);
    return () => window.removeEventListener("polyplay:aura-trigger", onAuraTrigger);
  }, []);

  useEffect(() => {
    return () => {
      if (shuffleAnimTimeoutRef.current !== null) {
        window.clearTimeout(shuffleAnimTimeoutRef.current);
        shuffleAnimTimeoutRef.current = null;
      }
    };
  }, []);

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

  return (
    <section ref={rootRef} className={`player-controls player-controls--${variant}`} aria-label="Player controls">
      <div className="pc-progress">
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
            <svg className="pc-repeat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 11V9a4 4 0 0 1 4-4h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 22l-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 13v2a4 4 0 0 1-4 4H4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          active={repeatTrackEnabled}
          onClick={() => onToggleRepeatTrack()}
          ariaLabel={repeatTrackEnabled ? "Disable repeat track" : "Enable repeat track"}
          size="sm"
        />
        <button
          type="button"
          className={`pc-btn pc-btn--sm pc-dim-btn ${dimMode === "normal" ? "" : "is-active"} ${
            dimMode === "mute" ? "is-mute" : ""
          }`.trim()}
          onClick={onCycleDimMode}
          aria-label={
            dimMode === "normal"
              ? "Dim controls: normal"
              : dimMode === "dim"
                ? "Dim controls: dimmed"
                : "Dim controls: muted"
          }
        >
          {dimMode === "mute" ? "MUTE" : "DIM"}
        </button>
        {onAuraUp && (
          <button
            type="button"
            className="pc-btn pc-btn--primary pc-btn--aura pc-btn--aura-inline"
            onClick={(event) => {
              const button = event.currentTarget;
              emitPinkSparkle(button, { sparks: 7, distance: 24, includeFlash: true });
              if (navigator.vibrate) navigator.vibrate(12);
              onAuraUp();
            }}
          >
            Aura +
          </button>
        )}
      </div>

      <div className="pc-extras" role="group" aria-label="Playback options">
        {onSkip && (
          <>
            <button type="button" className="pc-btn pc-btn--sm pc-extra-skip" onClick={() => onSkip(-10)}>
              -10s
            </button>
            <button type="button" className="pc-btn pc-btn--sm pc-extra-skip" onClick={() => onSkip(10)}>
              +10s
            </button>
          </>
        )}
        <button
          type="button"
          className={`pc-btn pc-btn--sm pc-btn--toggle ${loopMode !== "off" ? "is-active" : ""}`.trim()}
          onClick={onSetLoop}
        >
          {loopMode !== "off" ? "Loop Active" : "Set Loop"}
        </button>
        <button type="button" className="pc-btn pc-btn--sm" onClick={onClearLoop}>
          Clear Loop
        </button>
      </div>
    </section>
  );
}
