import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  applyMagnet,
  capBubbles,
  popBubble,
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

  const onLayerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (event.target !== event.currentTarget) return;
    const now = Date.now();
    const intensity = computeIntensity(now);
    const xPercent = (event.clientX / Math.max(window.innerWidth, 1)) * 100;
    const yPercent = (event.clientY / Math.max(window.innerHeight, 1)) * 100;
    onSpark(event.clientX, event.clientY);
    setBubbles((prev) => {
      const withMagnet = reducedMotion ? prev : applyMagnet(prev, xPercent, yPercent, now);
      const withSpawn = spawnBubblesAt(withMagnet, xPercent, yPercent, intensity, now + seqRef.current);
      seqRef.current += 3;
      return capBubbles(withSpawn);
    });
  };

  const onBubblePop = (id: number, x: number, y: number) => {
    if (!enabled) return;
    onSpark((x / 100) * window.innerWidth, (y / 100) * window.innerHeight);
    setBubbles((prev) => popBubble(prev, id));
  };

  return (
    <div
      className={`bubble-layer ${enabled ? "is-enabled" : "is-disabled"} ${paused ? "bubblesPaused" : ""}`.trim()}
      onPointerDown={onLayerPointerDown}
      aria-hidden="true"
    >
      {bubbles.map((bubble) => (
        <button
          key={bubble.id}
          type="button"
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
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!enabled) return;
            const button = event.currentTarget;
            button.classList.remove("is-popping");
            void button.offsetWidth;
            button.classList.add("is-popping");
            window.setTimeout(() => onBubblePop(bubble.id, bubble.x, bubble.y), 160);
          }}
        />
      ))}
    </div>
  );
}
