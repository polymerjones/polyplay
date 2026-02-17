import { useEffect, useRef } from "react";
import { formatTime } from "../lib/time";

type Props = {
  variant: "mini" | "fullscreen";
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopActive: boolean;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onToggleLoop: () => void;
  onClearLoop: () => void;
  onAuraUp?: () => void;
  onSkip?: (delta: number) => void;
};

function clampTime(value: number, duration: number): number {
  return Math.max(0, Math.min(duration || 0, value));
}

export function PlayerControls({
  variant,
  isPlaying,
  currentTime,
  duration,
  loopActive,
  onPrev,
  onPlayPause,
  onNext,
  onSeek,
  onToggleLoop,
  onClearLoop,
  onAuraUp,
  onSkip
}: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const safeDuration = Math.max(0, duration || 0);
  const safeCurrent = clampTime(currentTime, safeDuration);

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
        {onAuraUp && (
          <button
            type="button"
            className="pc-btn pc-btn--primary pc-btn--aura"
            onClick={(event) => {
              const button = event.currentTarget;
              button.classList.remove("pc-btn--aura-burst");
              void button.offsetWidth;
              button.classList.add("pc-btn--aura-burst");
              const burst = document.createElement("span");
              burst.className = "pc-aura-burst";
              for (let i = 0; i < 7; i += 1) {
                const sparkle = document.createElement("span");
                sparkle.className = "pc-aura-burst__spark";
                const angle = (i / 7) * Math.PI * 2;
                sparkle.style.setProperty("--tx", `${Math.cos(angle) * 24}px`);
                sparkle.style.setProperty("--ty", `${Math.sin(angle) * 24}px`);
                sparkle.style.setProperty("--delay", `${i * 34}ms`);
                burst.appendChild(sparkle);
              }
              button.appendChild(burst);
              burst.addEventListener("animationend", () => burst.remove(), { once: true });
              if (navigator.vibrate) navigator.vibrate(12);
              window.dispatchEvent(new CustomEvent("polyplay:aura-trigger"));
              onAuraUp();
            }}
          >
            Aura +
          </button>
        )}
        <button
          type="button"
          className={`pc-btn pc-btn--sm pc-btn--toggle ${loopActive ? "is-active" : ""}`}
          onClick={onToggleLoop}
        >
          Loop
        </button>
        <button type="button" className="pc-btn pc-btn--sm" onClick={onClearLoop}>
          Clear Loop
        </button>
      </div>
    </section>
  );
}
