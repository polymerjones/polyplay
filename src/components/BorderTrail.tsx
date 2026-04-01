import type { CSSProperties } from "react";
import type { DimMode } from "../types";

type Variant = "tile" | "row";

type Props = {
  variant: Variant;
  isVisible: boolean;
  isPlaying: boolean;
  dimMode: DimMode;
};

export function BorderTrail({ variant, isVisible, isPlaying, dimMode }: Props) {
  const isMuted = dimMode === "mute";
  const isDimmed = dimMode === "dim";
  const isPausedOrMuted = !isPlaying || isMuted;
  const borderColor = isPausedOrMuted
    ? "rgba(255, 255, 255, 1)"
    : isDimmed
      ? "rgba(var(--aura-rgb, 188, 132, 255), 0.3)"
      : "rgba(var(--aura-rgb, 188, 132, 255), 1)";
  const animationState = isPausedOrMuted ? "paused" : "running";

  return (
    <span
      className={`track-border-trail track-border-trail--${variant} ${isVisible ? "is-active" : ""}`.trim()}
      aria-hidden="true"
      style={
        {
          "--border-trail-color": borderColor,
          "--border-trail-animation-state": animationState
        } as CSSProperties
      }
    >
      <svg className="track-border-trail__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect
          className="track-border-trail__path"
          x="2.5"
          y="2.5"
          width="95"
          height="95"
          rx={variant === "tile" ? 17 : 14}
          ry={variant === "tile" ? 17 : 14}
          pathLength="100"
        />
      </svg>
    </span>
  );
}
