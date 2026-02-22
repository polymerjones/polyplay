export type AmbientFxMode = "gravity" | "pop" | "splatter";
export type AmbientFxQuality = "auto" | "lite" | "high";

type ResolvedQuality = "lite" | "high";

type ThemeTokens = {
  accentRgb: [number, number, number];
  auraRgb: [number, number, number];
  glowIntensity: number;
};

type EngineOptions = {
  mode: AmbientFxMode;
  quality: AmbientFxQuality;
  reducedMotion: boolean;
  isMobile: boolean;
};

type Bubble = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  alpha: number;
  ttl: number;
  age: number;
  popping: boolean;
};

type Splat = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  ttl: number;
  age: number;
  hue: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  age: number;
  alpha: number;
};

const TAP_WINDOW_MS = 1200;
const ATTRACTOR_MS = 900;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function weightedHue(): number {
  const roll = Math.random();
  if (roll < 0.46) return rand(266, 290);
  if (roll < 0.73) return rand(300, 334);
  if (roll < 0.88) return rand(198, 226);
  return rand(34, 48);
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

class AmbientFxEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: AmbientFxMode;
  private reducedMotion: boolean;
  private isMobile: boolean;
  private resolvedQuality: ResolvedQuality;
  private running = false;
  private rafId: number | null = null;
  private lastTs = 0;
  private width = 0;
  private height = 0;
  private frameThrottleMs = 16;

  private gravityBubbles: Bubble[] = [];
  private popBubbles: Bubble[] = [];
  private splatters: Splat[] = [];
  private sparks: Spark[] = [];

  private bubblePool: Bubble[] = [];
  private splatPool: Splat[] = [];
  private sparkPool: Spark[] = [];

  private tapStamps: number[] = [];
  private attractor = { x: 0, y: 0, strength: 0, until: 0 };
  private popAudio: HTMLAudioElement | null = null;
  private popStamps: number[] = [];

  private themeTokens: ThemeTokens = {
    accentRgb: [125, 86, 226],
    auraRgb: [170, 112, 255],
    glowIntensity: 1
  };

  constructor(canvas: HTMLCanvasElement, options: EngineOptions) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Ambient FX canvas context unavailable");
    this.canvas = canvas;
    this.ctx = ctx;
    this.mode = options.mode;
    this.reducedMotion = options.reducedMotion;
    this.isMobile = options.isMobile;
    this.resolvedQuality = this.resolveQuality(options.quality);
    this.frameThrottleMs = this.isMobile ? 33 : 16;
    this.resize();

    this.popAudio = new Audio("/hyper-notif.wav");
    this.popAudio.preload = "auto";
  }

  init(): void {
    this.resize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy(): void {
    this.stop();
    this.gravityBubbles.length = 0;
    this.popBubbles.length = 0;
    this.splatters.length = 0;
    this.sparks.length = 0;
  }

  setMode(mode: AmbientFxMode): void {
    this.mode = mode;
  }

  setQuality(quality: AmbientFxQuality): void {
    this.resolvedQuality = this.resolveQuality(quality);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  setThemeTokens(tokens: Partial<ThemeTokens>): void {
    this.themeTokens = {
      ...this.themeTokens,
      ...tokens,
      accentRgb: tokens.accentRgb ?? this.themeTokens.accentRgb,
      auraRgb: tokens.auraRgb ?? this.themeTokens.auraRgb,
      glowIntensity: Number.isFinite(tokens.glowIntensity)
        ? clamp(tokens.glowIntensity as number, 0.5, 2)
        : this.themeTokens.glowIntensity
    };
  }

  onTap(x: number, y: number, now = performance.now()): void {
    this.tapStamps = this.tapStamps.filter((stamp) => now - stamp <= TAP_WINDOW_MS);
    this.tapStamps.push(now);
    const intensity = clamp(this.tapStamps.length / 8, 0, 1);

    if (this.mode === "gravity") {
      this.attractor = { x, y, strength: 1, until: now + ATTRACTOR_MS };
      const count = this.reducedMotion ? 1 : intensity > 0.66 ? 3 : intensity > 0.28 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        this.spawnGravityBubble(x + rand(-18, 18), y + rand(-14, 14), intensity);
      }
      this.trimCaps();
      return;
    }

    if (this.mode === "pop") {
      const hit = this.findPopBubble(x, y);
      if (hit) {
        hit.popping = true;
        hit.age = Math.max(0, hit.ttl - 120);
        this.spawnSparks(x, y, 8);
        this.playPopSound(now);
      } else {
        this.spawnPopBubble(x, y, intensity);
      }
      this.trimCaps();
      return;
    }

    const splatCount = this.reducedMotion ? 8 : intensity > 0.66 ? 24 : intensity > 0.28 ? 16 : 12;
    for (let i = 0; i < splatCount; i += 1) {
      this.spawnSplat(x, y, intensity);
    }
    this.trimCaps();
  }

  onPointerMove(x: number, y: number, now = performance.now()): void {
    if (this.mode !== "gravity") return;
    this.attractor.x = x;
    this.attractor.y = y;
    this.attractor.strength = Math.max(this.attractor.strength, 0.45);
    this.attractor.until = Math.max(this.attractor.until, now + 260);
  }

  clear(): void {
    this.gravityBubbles.length = 0;
    this.popBubbles.length = 0;
    this.splatters.length = 0;
    this.sparks.length = 0;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update(dtMs: number, now: number): void {
    const dt = clamp(dtMs / 16.6667, 0.5, 3);

    if (this.mode === "gravity") {
      const attractorActive = this.attractor.until > now;
      const attractStrength = attractorActive
        ? this.attractor.strength * (1 - clamp((this.attractor.until - now) / ATTRACTOR_MS, 0, 1))
        : 0;
      for (let i = this.gravityBubbles.length - 1; i >= 0; i -= 1) {
        const bubble = this.gravityBubbles[i];
        bubble.age += dtMs;
        if (bubble.age >= bubble.ttl) {
          this.releaseBubble(this.gravityBubbles, i);
          continue;
        }
        if (!this.reducedMotion && attractorActive) {
          const dx = this.attractor.x - bubble.x;
          const dy = this.attractor.y - bubble.y;
          const dist = Math.max(24, Math.hypot(dx, dy));
          const force = Math.min(0.09, 42 / dist) * attractStrength;
          bubble.vx += (dx / dist) * force * dt;
          bubble.vy += (dy / dist) * force * dt;
        }
        bubble.vx *= 0.988;
        bubble.vy *= 0.988;
        bubble.x += bubble.vx * dt;
        bubble.y += bubble.vy * dt;
        bubble.y += this.reducedMotion ? 0 : -0.05 * dt;
      }
    }

    if (this.mode === "pop") {
      for (let i = this.popBubbles.length - 1; i >= 0; i -= 1) {
        const bubble = this.popBubbles[i];
        bubble.age += dtMs;
        if (bubble.age >= bubble.ttl) {
          this.releaseBubble(this.popBubbles, i);
          continue;
        }
        if (!this.reducedMotion) {
          bubble.vx += Math.sin((now + i * 30) * 0.0017) * 0.005;
          bubble.vy += 0.006;
          bubble.vx *= 0.992;
          bubble.vy *= 0.992;
          bubble.x += bubble.vx * dt;
          bubble.y += bubble.vy * dt;
        }
      }
    }

    if (this.mode === "splatter") {
      for (let i = this.splatters.length - 1; i >= 0; i -= 1) {
        const splat = this.splatters[i];
        splat.age += dtMs;
        if (splat.age >= splat.ttl) {
          this.releaseSplat(i);
          continue;
        }
        if (!this.reducedMotion) {
          splat.x += splat.vx * dt;
          splat.y += splat.vy * dt;
        }
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const spark = this.sparks[i];
      spark.age += dtMs;
      if (spark.age >= spark.ttl) {
        this.releaseSpark(i);
        continue;
      }
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.97;
      spark.vy *= 0.97;
    }
  }

  render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.mode === "gravity") {
      for (let i = 0; i < this.gravityBubbles.length; i += 1) {
        const bubble = this.gravityBubbles[i];
        const life = 1 - bubble.age / bubble.ttl;
        const alpha = bubble.alpha * life;
        const gradient = this.ctx.createRadialGradient(
          bubble.x,
          bubble.y,
          Math.max(2, bubble.r * 0.2),
          bubble.x,
          bubble.y,
          bubble.r
        );
        gradient.addColorStop(0, `hsla(${bubble.hue} 100% 92% / ${alpha * 0.75})`);
        gradient.addColorStop(0.55, `hsla(${bubble.hue} 90% 72% / ${alpha * 0.55})`);
        gradient.addColorStop(1, `hsla(${bubble.hue} 88% 46% / 0)`);
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    if (this.mode === "pop") {
      for (let i = 0; i < this.popBubbles.length; i += 1) {
        const bubble = this.popBubbles[i];
        const life = 1 - bubble.age / bubble.ttl;
        const baseAlpha = bubble.alpha * life;
        const scale = bubble.popping ? 1 + (1 - life) * 0.22 : 1;
        const radius = bubble.r * scale;

        this.ctx.beginPath();
        this.ctx.arc(bubble.x, bubble.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255,255,255,${baseAlpha * 0.08})`;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(bubble.x, bubble.y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(255,255,255,${baseAlpha * 0.52})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();
      }
    }

    if (this.mode === "splatter") {
      for (let i = 0; i < this.splatters.length; i += 1) {
        const splat = this.splatters[i];
        const life = 1 - splat.age / splat.ttl;
        this.ctx.beginPath();
        this.ctx.arc(splat.x, splat.y, splat.r, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${splat.hue} 86% 64% / ${splat.alpha * life})`;
        this.ctx.fill();
      }
    }

    for (let i = 0; i < this.sparks.length; i += 1) {
      const spark = this.sparks[i];
      const life = 1 - spark.age / spark.ttl;
      this.ctx.beginPath();
      this.ctx.arc(spark.x, spark.y, 1.8, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255,255,255,${spark.alpha * life})`;
      this.ctx.fill();
    }
  }

  private tick = (ts: number) => {
    if (!this.running) return;
    if (!this.lastTs) this.lastTs = ts;
    const dtMs = ts - this.lastTs;
    if (dtMs >= this.frameThrottleMs) {
      this.lastTs = ts;
      this.update(dtMs, performance.now());
      this.render();
    }
    this.rafId = window.requestAnimationFrame(this.tick);
  };

  private resolveQuality(quality: AmbientFxQuality): ResolvedQuality {
    if (quality === "auto") return this.isMobile ? "lite" : "high";
    return quality;
  }

  private getCaps() {
    const lite = this.resolvedQuality === "lite";
    return {
      gravity: lite ? 18 : 28,
      pop: lite ? 16 : 24,
      splat: lite ? 220 : 420
    };
  }

  private trimCaps(): void {
    const caps = this.getCaps();
    if (this.gravityBubbles.length > caps.gravity) this.gravityBubbles.splice(0, this.gravityBubbles.length - caps.gravity);
    if (this.popBubbles.length > caps.pop) this.popBubbles.splice(0, this.popBubbles.length - caps.pop);
    if (this.splatters.length > caps.splat) this.splatters.splice(0, this.splatters.length - caps.splat);
  }

  private acquireBubble(): Bubble {
    return this.bubblePool.pop() || {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 0,
      hue: 0,
      alpha: 0,
      ttl: 0,
      age: 0,
      popping: false
    };
  }

  private releaseBubble(list: Bubble[], index: number): void {
    const [bubble] = list.splice(index, 1);
    if (bubble) this.bubblePool.push(bubble);
  }

  private acquireSplat(): Splat {
    return this.splatPool.pop() || {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 0,
      alpha: 0,
      ttl: 0,
      age: 0,
      hue: 0
    };
  }

  private releaseSplat(index: number): void {
    const [splat] = this.splatters.splice(index, 1);
    if (splat) this.splatPool.push(splat);
  }

  private acquireSpark(): Spark {
    return this.sparkPool.pop() || {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ttl: 0,
      age: 0,
      alpha: 0
    };
  }

  private releaseSpark(index: number): void {
    const [spark] = this.sparks.splice(index, 1);
    if (spark) this.sparkPool.push(spark);
  }

  private spawnGravityBubble(x: number, y: number, intensity: number): void {
    const bubble = this.acquireBubble();
    bubble.x = x;
    bubble.y = y;
    bubble.vx = rand(-0.35, 0.35);
    bubble.vy = rand(-0.28, 0.1);
    bubble.r = rand(14, 34) * (1 + intensity * 0.28);
    bubble.hue = weightedHue();
    bubble.alpha = rand(0.18, 0.34) * this.themeTokens.glowIntensity;
    bubble.ttl = rand(8000, 26000);
    bubble.age = 0;
    bubble.popping = false;
    this.gravityBubbles.push(bubble);
  }

  private spawnPopBubble(x: number, y: number, intensity: number): void {
    const bubble = this.acquireBubble();
    bubble.x = x;
    bubble.y = y;
    bubble.vx = rand(-0.26, 0.26);
    bubble.vy = rand(-0.04, 0.12);
    bubble.r = rand(16, 36) * (1 + intensity * 0.2);
    bubble.hue = 220;
    bubble.alpha = rand(0.24, 0.42);
    bubble.ttl = rand(18000, 46000);
    bubble.age = 0;
    bubble.popping = false;
    this.popBubbles.push(bubble);
  }

  private spawnSplat(x: number, y: number, intensity: number): void {
    const splat = this.acquireSplat();
    const spread = 20 + intensity * 22;
    splat.x = x + rand(-spread, spread);
    splat.y = y + rand(-spread, spread);
    splat.vx = this.reducedMotion ? 0 : rand(-0.02, 0.02);
    splat.vy = this.reducedMotion ? 0 : rand(-0.02, 0.02);
    splat.r = rand(2.4, 10.2);
    splat.alpha = rand(0.14, 0.32);
    splat.ttl = this.resolvedQuality === "lite" ? rand(10000, 18000) : rand(12000, 30000);
    splat.age = 0;
    splat.hue = weightedHue();
    this.splatters.push(splat);
  }

  private spawnSparks(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const speed = rand(0.5, 1.8);
      const spark = this.acquireSpark();
      spark.x = x;
      spark.y = y;
      spark.vx = Math.cos(angle) * speed;
      spark.vy = Math.sin(angle) * speed;
      spark.ttl = rand(220, 480);
      spark.age = 0;
      spark.alpha = rand(0.48, 0.9);
      this.sparks.push(spark);
    }
  }

  private findPopBubble(x: number, y: number): Bubble | null {
    const ordered = [...this.popBubbles].sort((a, b) => b.r - a.r);
    for (let i = 0; i < ordered.length; i += 1) {
      const bubble = ordered[i];
      const dx = x - bubble.x;
      const dy = y - bubble.y;
      if (Math.hypot(dx, dy) <= bubble.r) return bubble;
    }
    return null;
  }

  private playPopSound(now: number): void {
    if (!this.popAudio) return;
    this.popStamps = this.popStamps.filter((stamp) => now - stamp <= 1200);
    this.popStamps.push(now);
    const volume = clamp(0.5 + (this.popStamps.length - 1) * 0.12, 0.5, 1);
    this.popAudio.pause();
    this.popAudio.currentTime = 0;
    this.popAudio.volume = volume;
    void this.popAudio.play().catch(() => undefined);
  }
}

export function init(canvas: HTMLCanvasElement, options: EngineOptions): AmbientFxEngine {
  const engine = new AmbientFxEngine(canvas, options);
  engine.init();
  return engine;
}

export function readThemeTokensFromCss(): ThemeTokens {
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue("--color-accent").trim();
  const aura = style.getPropertyValue("--aura-rgb").trim();
  const glow = Number(style.getPropertyValue("--glow-intensity").trim());

  const accentRgbFallback: [number, number, number] = [125, 86, 226];
  let accentRgb = accentRgbFallback;
  if (accent.startsWith("#")) {
    const hex = accent.slice(1);
    const sized = hex.length === 3
      ? hex.split("").map((c) => `${c}${c}`).join("")
      : hex;
    if (sized.length === 6) {
      const n = Number.parseInt(sized, 16);
      if (Number.isFinite(n)) {
        accentRgb = [
          (n >> 16) & 0xff,
          (n >> 8) & 0xff,
          n & 0xff
        ];
      }
    }
  }

  return {
    accentRgb,
    auraRgb: parseRgb(aura, [170, 112, 255]),
    glowIntensity: Number.isFinite(glow) ? clamp(glow, 0.5, 2) : 1
  };
}

export type { EngineOptions };
