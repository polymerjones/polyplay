import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  applyMagnet,
  capBubbles,
  pruneExpired,
  spawnBubblesAt,
  stepBubbles,
  type Bubble,
  type BubblePalette
} from "../lib/bubbles";

type Props = {
  enabled: boolean;
  paused: boolean;
  onSpark: (x: number, y: number) => void;
};

const SPAWN_WINDOW_MS = 1200;
const BUBBLE_SPAWN_EVENT = "polyplay:bubble-spawn";

type BubbleSpawnEventDetail = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseRgb(input: string, fallback: [number, number, number]): [number, number, number] {
  const clean = input.trim();
  if (!clean) return fallback;
  const parts = clean.split(",").map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return fallback;
  return [
    clamp(Math.round(parts[0] || 0), 0, 255),
    clamp(Math.round(parts[1] || 0), 0, 255),
    clamp(Math.round(parts[2] || 0), 0, 255)
  ];
}

function rgbToHue(rgb: [number, number, number], fallback: number): number {
  const [rRaw, gRaw, bRaw] = rgb;
  const r = rRaw / 255;
  const g = gRaw / 255;
  const b = bRaw / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.001) return fallback;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  const degrees = hue * 60;
  return degrees >= 0 ? degrees : degrees + 360;
}

function readBubblePaletteFromCss(): BubblePalette {
  const style = getComputedStyle(document.documentElement);
  return {
    primaryHue: rgbToHue(parseRgb(style.getPropertyValue("--fx-color-1-rgb"), [188, 132, 255]), 282),
    secondaryHue: rgbToHue(parseRgb(style.getPropertyValue("--fx-color-2-rgb"), [255, 255, 255]), 0),
    tertiaryHue: rgbToHue(parseRgb(style.getPropertyValue("--fx-color-3-rgb"), [170, 112, 255]), 216)
  };
}

export function BubbleLayer({ enabled, paused, onSpark }: Props) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const seqRef = useRef(1);
  const tapTimesRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    setBubbles((prev) => capBubbles(prev));
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const tick = (ts: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = ts;
      const dt = ts - lastFrameRef.current;
      if (dt >= 33) {
        lastFrameRef.current = ts;
        setBubbles((prev) => {
          const pruned = pruneExpired(prev, Date.now());
          return stepBubbles(pruned, dt, Date.now());
        });
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = 0;
    };
  }, [paused, reducedMotion]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const computeIntensity = (now: number): number => {
    tapTimesRef.current = tapTimesRef.current.filter((stamp) => now - stamp <= SPAWN_WINDOW_MS);
    tapTimesRef.current.push(now);
    return Math.min(1, tapTimesRef.current.length / 7);
  };

  useEffect(() => {
    const onSpawn = (event: Event) => {
      if (!enabled) return;
      const custom = event as CustomEvent<BubbleSpawnEventDetail>;
      const detail = custom.detail;
      if (!detail) return;
      const now = Date.now();
      const intensity = computeIntensity(now);
      const xPercent = (detail.x / Math.max(window.innerWidth, 1)) * 100;
      const yPercent = (detail.y / Math.max(window.innerHeight, 1)) * 100;
      const palette = readBubblePaletteFromCss();
      onSpark(detail.x, detail.y);
      setBubbles((prev) => {
        const withMagnet = reducedMotion ? prev : applyMagnet(prev, xPercent, yPercent, now);
        const withSpawn = spawnBubblesAt(withMagnet, xPercent, yPercent, intensity, now + seqRef.current, palette);
        seqRef.current += 3;
        return capBubbles(withSpawn);
      });
    };
    window.addEventListener(BUBBLE_SPAWN_EVENT, onSpawn as EventListener);
    return () => window.removeEventListener(BUBBLE_SPAWN_EVENT, onSpawn as EventListener);
  }, [enabled, reducedMotion, onSpark]);

  return (
    <div className={`bubble-layer ${enabled ? "is-enabled" : "is-disabled"} ${paused ? "bubblesPaused" : ""}`.trim()} aria-hidden="true">
      {bubbles.map((bubble) => (
        <span
          key={bubble.id}
          className={`bubble-v3 bubble-v3--${bubble.kind}`.trim()}
          style={
            {
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              "--bubble-size": `${bubble.size}px`,
              "--bubble-h": `${bubble.hue}`,
              "--bubble-a": String(bubble.alpha),
              "--bubble-glow": String(bubble.glow),
              "--bubble-shimmer": `${bubble.shimmer}s`
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
