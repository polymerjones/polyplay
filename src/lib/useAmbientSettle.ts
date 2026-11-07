import { useEffect, useRef } from "react";

export const AMBIENT_SETTLED_CLASS = "ambient-settled";

const WAKE_EVENTS = ["pointerdown", "touchstart", "keydown", "wheel", "scroll"] as const;

/**
 * Battery: decorative ambient animations (theme backgrounds, header glows, the
 * oracle orb, the current-track glow) keep the display refreshing at up to 120 Hz
 * for as long as they move, even on a screen nobody is touching. After `delayMs`
 * without interaction this adds `ambient-settled` to <body>; styles.css pauses those
 * animations in place. Any touch, key or scroll, or a change to `wakeKey` (e.g. the
 * current track or play state), resumes them.
 */
export function useAmbientSettle(wakeKey: unknown, delayMs = 10_000): void {
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const body = document.body;
    let timer: number | undefined;

    const wake = () => {
      body.classList.remove(AMBIENT_SETTLED_CLASS);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => body.classList.add(AMBIENT_SETTLED_CLASS), delayMs);
    };
    wakeRef.current = wake;

    WAKE_EVENTS.forEach((type) => window.addEventListener(type, wake, { passive: true, capture: true }));
    wake();

    return () => {
      WAKE_EVENTS.forEach((type) => window.removeEventListener(type, wake, { capture: true }));
      window.clearTimeout(timer);
      body.classList.remove(AMBIENT_SETTLED_CLASS);
      wakeRef.current = () => {};
    };
  }, [delayMs]);

  useEffect(() => {
    wakeRef.current();
  }, [wakeKey]);
}
