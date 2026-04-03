import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { DimMode } from "../types";

type Variant = "tile" | "row";

type Props = {
  variant: Variant;
  isVisible: boolean;
  isPlaying: boolean;
  dimMode: DimMode;
};

export function BorderTrail({ variant, isVisible, isPlaying, dimMode }: Props) {
  const trailRef = useRef<HTMLSpanElement | null>(null);
  const isMuted = dimMode === "mute";
  const isDimmed = dimMode === "dim";
  const isPausedOrMuted = !isPlaying || isMuted;
  const borderColor = isPausedOrMuted
    ? "rgba(255, 255, 255, 1)"
    : isDimmed
      ? "rgba(var(--aura-rgb, 188, 132, 255), 0.3)"
      : "rgba(var(--aura-rgb, 188, 132, 255), 1)";
  const animationState = isPausedOrMuted ? "paused" : "running";
  const strokeWidth = variant === "row" ? 1.6 : 1.8;
  const fallbackRadius = variant === "row" ? 14 : 16;
  const [geometry, setGeometry] = useState(() => ({
    width: variant === "row" ? 320 : 100,
    height: variant === "row" ? 86 : 100,
    radius: fallbackRadius
  }));

  useLayoutEffect(() => {
    const node = trailRef.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const style = getComputedStyle(node);
      const nextWidth = Number(rect.width.toFixed(2));
      const nextHeight = Number(rect.height.toFixed(2));
      const computedRadius = parseFloat(style.borderTopLeftRadius);
      const nextRadius = Number((Number.isFinite(computedRadius) ? computedRadius : fallbackRadius).toFixed(2));
      setGeometry((current) =>
        current.width === nextWidth && current.height === nextHeight && current.radius === nextRadius
          ? current
          : { width: nextWidth, height: nextHeight, radius: nextRadius }
      );
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [fallbackRadius]);

  const inset = strokeWidth / 2;
  const width = Math.max(0, geometry.width - strokeWidth);
  const height = Math.max(0, geometry.height - strokeWidth);
  const radius = Math.max(0, Math.min(geometry.radius - inset, width / 2, height / 2));
  const viewBox = `0 0 ${geometry.width} ${geometry.height}`;

  return (
    <span
      ref={trailRef}
      className={`track-border-trail track-border-trail--${variant} ${isVisible ? "is-active" : ""}`.trim()}
      aria-hidden="true"
      style={
        {
          "--border-trail-color": borderColor,
          "--border-trail-animation-state": animationState,
          "--border-trail-duration": variant === "row" ? "1550ms" : "1450ms",
          "--border-trail-stroke-width": `${strokeWidth}px`
        } as CSSProperties
      }
    >
      <svg className="track-border-trail__svg" viewBox={viewBox} aria-hidden="true">
        <rect
          className="track-border-trail__path track-border-trail__path--base"
          x={inset}
          y={inset}
          width={width}
          height={height}
          rx={radius}
          ry={radius}
          pathLength="1"
        />
        <rect
          className="track-border-trail__path track-border-trail__path--tail"
          x={inset}
          y={inset}
          width={width}
          height={height}
          rx={radius}
          ry={radius}
          pathLength="1"
        />
        <rect
          className="track-border-trail__path track-border-trail__path--head"
          x={inset}
          y={inset}
          width={width}
          height={height}
          rx={radius}
          ry={radius}
          pathLength="1"
        />
      </svg>
    </span>
  );
}
