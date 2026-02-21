import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  applyMagnet,
  capBubbles,
  pruneExpired,
  spawnBubblesAt,
  stepBubbles,
  type Bubble
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
      onSpark(detail.x, detail.y);
      setBubbles((prev) => {
        const withMagnet = reducedMotion ? prev : applyMagnet(prev, xPercent, yPercent, now);
        const withSpawn = spawnBubblesAt(withMagnet, xPercent, yPercent, intensity, now + seqRef.current);
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
