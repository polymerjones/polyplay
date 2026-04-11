import type { CSSProperties } from "react";

type Props = {
  vibeLevel: 2 | 3;
  mirrored?: boolean;
  fast?: boolean;
  background?: boolean;
};

const BAR_LAYOUT = [
  { height: "42%", minScale: 0.42, midScale: 0.94, maxScale: 1.18, duration: "2.2s", delay: "-1.1s", opacity: 0.28 },
  { height: "54%", minScale: 0.34, midScale: 0.98, maxScale: 1.26, duration: "1.9s", delay: "-0.7s", opacity: 0.34 },
  { height: "68%", minScale: 0.28, midScale: 1.02, maxScale: 1.36, duration: "2.4s", delay: "-1.4s", opacity: 0.42 },
  { height: "82%", minScale: 0.24, midScale: 1.06, maxScale: 1.46, duration: "1.8s", delay: "-0.9s", opacity: 0.54 },
  { height: "98%", minScale: 0.2, midScale: 1.1, maxScale: 1.56, duration: "2.1s", delay: "-1.6s", opacity: 0.66 },
  { height: "114%", minScale: 0.18, midScale: 1.14, maxScale: 1.68, duration: "1.7s", delay: "-0.4s", opacity: 0.82 },
  { height: "132%", minScale: 0.16, midScale: 1.18, maxScale: 1.82, duration: "2s", delay: "-1.2s", opacity: 0.96 },
  { height: "148%", minScale: 0.14, midScale: 1.22, maxScale: 1.94, duration: "1.6s", delay: "-0.8s", opacity: 1 },
  { height: "132%", minScale: 0.16, midScale: 1.16, maxScale: 1.8, duration: "2.05s", delay: "-1.7s", opacity: 0.94 },
  { height: "114%", minScale: 0.18, midScale: 1.12, maxScale: 1.64, duration: "1.85s", delay: "-0.5s", opacity: 0.8 },
  { height: "98%", minScale: 0.22, midScale: 1.08, maxScale: 1.5, duration: "2.3s", delay: "-1.5s", opacity: 0.64 },
  { height: "82%", minScale: 0.26, midScale: 1.02, maxScale: 1.38, duration: "1.95s", delay: "-0.6s", opacity: 0.5 },
  { height: "68%", minScale: 0.3, midScale: 0.98, maxScale: 1.28, duration: "2.15s", delay: "-1.3s", opacity: 0.4 },
  { height: "54%", minScale: 0.36, midScale: 0.92, maxScale: 1.18, duration: "1.75s", delay: "-0.3s", opacity: 0.32 },
  { height: "42%", minScale: 0.44, midScale: 0.88, maxScale: 1.08, duration: "2.25s", delay: "-1s", opacity: 0.26 }
] as const;

export function CinemaModeVisualizer({ vibeLevel, mirrored = false, fast = false, background = false }: Props) {
  return (
    <div
      className={`cinema-mode-visualizer ${vibeLevel === 3 ? "is-vibe-3" : "is-vibe-2"} ${
        mirrored ? "is-mirrored" : ""
      } ${
        fast ? "is-fast" : ""
      } ${
        background ? "is-background" : ""
      }`.trim()}
      aria-hidden="true"
    >
      {BAR_LAYOUT.map((bar, index) => (
        <span
          // Static layout values keep the animation cheap and deterministic.
          key={index}
          className="cinema-mode-visualizer__bar"
          style={
            {
              "--cmv-bar-height": bar.height,
              "--cmv-min-scale": String(bar.minScale),
              "--cmv-mid-scale": String(bar.midScale),
              "--cmv-max-scale": String(bar.maxScale),
              "--cmv-duration": bar.duration,
              "--cmv-delay": bar.delay,
              "--cmv-opacity": String(bar.opacity)
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
