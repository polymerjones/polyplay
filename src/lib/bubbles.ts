export type BubbleKind = "burst" | "floater" | "fixed";

export type Bubble = {
  id: number;
  x: number;
  y: number;
  size: number;
  hue: number;
  alpha: number;
  glow: number;
  kind: BubbleKind;
  createdAt: number;
  ttlMs: number;
  vx: number;
  vy: number;
  magnetUntil: number;
  magnetTx: number;
  magnetTy: number;
  shimmer: number;
};

const DESKTOP_MAX = 28;
const MOBILE_MAX = 18;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function weightedKind(): BubbleKind {
  const roll = Math.random();
  if (roll < 0.65) return "burst";
  if (roll < 0.9) return "floater";
  return "fixed";
}

function weightedHue(): number {
  const roll = Math.random();
  if (roll < 0.45) return rand(268, 286); // purple
  if (roll < 0.7) return rand(306, 334); // pink
  if (roll < 0.85) return rand(200, 222); // blue
  if (roll < 0.95) return rand(34, 48); // amber
  return rand(0, 18); // white-ish / warm
}

function createBubble(id: number, x: number, y: number, now: number, intensity: number): Bubble {
  const kind = weightedKind();
  const bigRare = Math.random() < 0.08 + intensity * 0.08;
  const size = bigRare ? rand(90, 140) : rand(22, 60) * (1 + intensity * 0.35);
  const ttlMs =
    kind === "burst"
      ? rand(4000, 10000)
      : kind === "floater"
        ? rand(30000, 90000)
        : rand(60000, 180000);
  const speedScale = kind === "fixed" ? 0 : kind === "floater" ? 0.06 : 0.08;
  return {
    id,
    x,
    y,
    size,
    hue: weightedHue(),
    alpha: rand(0.14, 0.33),
    glow: rand(0.6, 1.35) * (1 + intensity * 0.35),
    kind,
    createdAt: now,
    ttlMs,
    vx: rand(-0.28, 0.28) * speedScale,
    vy: rand(-0.22, -0.04) * speedScale,
    magnetUntil: 0,
    magnetTx: x,
    magnetTy: y,
    shimmer: rand(0.7, 1.35)
  };
}

export function getMaxBubbles(): number {
  if (typeof window !== "undefined") {
    const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    return coarse ? MOBILE_MAX : DESKTOP_MAX;
  }
  return DESKTOP_MAX;
}

export function spawnBubblesAt(current: Bubble[], x: number, y: number, intensity: number, now: number): Bubble[] {
  const spawnCount = intensity > 0.66 ? 3 : intensity > 0.28 ? 2 : 1;
  const next = current.slice();
  const baseId = now;
  for (let i = 0; i < spawnCount; i += 1) {
    const offset = spawnCount === 1 ? 0 : (i - (spawnCount - 1) / 2) * rand(18, 34);
    next.push(createBubble(baseId + i, x + offset, y + rand(-10, 10), now, intensity));
  }
  return capBubbles(next);
}

export function capBubbles(input: Bubble[]): Bubble[] {
  const max = getMaxBubbles();
  if (input.length <= max) return input;
  const next = input.slice();
  while (next.length > max) {
    let idx = next.findIndex((bubble) => bubble.kind === "burst");
    if (idx < 0) idx = next.findIndex((bubble) => bubble.kind === "floater");
    if (idx < 0) idx = 0;
    next.splice(idx, 1);
  }
  return next;
}

export function popBubble(current: Bubble[], id: number): Bubble[] {
  return current.filter((bubble) => bubble.id !== id);
}

export function pruneExpired(current: Bubble[], now: number): Bubble[] {
  return current.filter((bubble) => now - bubble.createdAt < bubble.ttlMs);
}

export function applyMagnet(current: Bubble[], x: number, y: number, now: number): Bubble[] {
  return current.map((bubble) => {
    if (bubble.kind === "fixed") return bubble;
    const dx = x - bubble.x;
    const dy = y - bubble.y;
    const distance = Math.max(16, Math.hypot(dx, dy));
    const force = Math.min(0.55, 95 / distance);
    return {
      ...bubble,
      // Prime a tiny initial nudge; most pull is ramped in stepBubbles.
      vx: bubble.vx + (dx / distance) * force * 0.018,
      vy: bubble.vy + (dy / distance) * force * 0.018,
      magnetUntil: now + 900,
      magnetTx: x,
      magnetTy: y
    };
  });
}

export function stepBubbles(current: Bubble[], dtMs: number, now: number): Bubble[] {
  const dt = Math.min(48, Math.max(8, dtMs));
  const mult = dt / 16.7;
  return current.map((bubble) => {
    if (bubble.kind === "fixed") return bubble;
    const magnetActive = bubble.magnetUntil > now;
    let vx = bubble.vx;
    let vy = bubble.vy;
    if (magnetActive) {
      const remaining = Math.max(0, bubble.magnetUntil - now);
      const progress = 1 - remaining / 900;
      // Slow-start accelerator: gentle at first, stronger late.
      const ramp = progress * progress;
      const dx = bubble.magnetTx - bubble.x;
      const dy = bubble.magnetTy - bubble.y;
      const distance = Math.max(20, Math.hypot(dx, dy));
      const force = Math.min(0.14, 46 / distance) * mult * ramp;
      vx += (dx / distance) * force;
      vy += (dy / distance) * force;
    }
    vx *= 0.992;
    vy *= 0.992;
    const driftY = bubble.kind === "floater" ? -0.02 * mult : -0.012 * mult;
    const nx = Math.max(-8, Math.min(108, bubble.x + vx * mult));
    const ny = Math.max(-10, Math.min(110, bubble.y + (vy + driftY) * mult));
    return {
      ...bubble,
      x: nx,
      y: ny,
      vx,
      vy
    };
  });
}
