export type AmbientFxMode = "gravity" | "pop" | "splatter";
export type AmbientFxQuality = "auto" | "lite" | "high";

type ResolvedQuality = "lite" | "high";

type ThemeTokens = {
  accentRgb: [number, number, number];
  auraRgb: [number, number, number];
  fxPaletteRgb: [[number, number, number], [number, number, number], [number, number, number]];
  glowIntensity: number;
  themeSlot: string | null;
};

type PaletteTriplet = ThemeTokens["fxPaletteRgb"];

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
  rx: number;
  ry: number;
  rot: number;
  alpha: number;
  ttl: number;
  age: number;
  hue: number;
  rgb: [number, number, number] | null;
  flash: boolean;
  segmented: boolean;
  themeSlot: string | null;
  paletteRgb: PaletteTriplet | null;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  age: number;
  alpha: number;
  hue: number;
  rgb: [number, number, number] | null;
  size: number;
  crackle: boolean;
  themeSlot: string | null;
};

const TAP_WINDOW_MS = 1200;
const ATTRACTOR_MS = 900;
const MERICA_ACCENT_BURST_DELAY_MS = 300;

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

function themedHue(tokens: ThemeTokens): number {
  const roll = Math.random();
  const [primary, secondary, tertiary] = tokens.fxPaletteRgb;
  const primaryHue = rgbToHue(primary, rgbToHue(tokens.auraRgb, 282));
  const secondaryHue = rgbToHue(secondary, rgbToHue(tokens.accentRgb, 216));
  const tertiaryHue = rgbToHue(tertiary, rgbToHue(tokens.accentRgb, 216));
  if (tokens.themeSlot === "mx") {
    if (roll < 0.44) return rand(primaryHue - 7, primaryHue + 7);
    if (roll < 0.74) return rand(secondaryHue - 4, secondaryHue + 4);
    return rand(tertiaryHue - 7, tertiaryHue + 7);
  }
  if (roll < 0.46) return rand(primaryHue - 8, primaryHue + 8);
  if (roll < 0.8) return rand(secondaryHue - 8, secondaryHue + 8);
  if (roll < 0.94) return rand(tertiaryHue - 10, tertiaryHue + 10);
  return weightedHue();
}

function auraHue(tokens: ThemeTokens): number {
  if (tokens.themeSlot === "mx") {
    const source = Math.random() < 0.5 ? tokens.fxPaletteRgb[0] : tokens.fxPaletteRgb[2];
    const hue = rgbToHue(source, 150);
    return rand(hue - 6, hue + 6);
  }
  const hue = rgbToHue(tokens.auraRgb, 282);
  return rand(hue - 5, hue + 5);
}

function pickPaletteRgb(tokens: ThemeTokens): [number, number, number] {
  const roll = Math.random();
  const [primary, secondary, tertiary] = tokens.fxPaletteRgb;
  if (tokens.themeSlot === "mx") {
    if (roll < 0.38) return primary;
    if (roll < 0.68) return secondary;
    return tertiary;
  }
  if (tokens.themeSlot === "merica") {
    if (roll < 0.34) return primary;
    if (roll < 0.67) return secondary;
    return tertiary;
  }
  if (tokens.themeSlot === "rasta") {
    if (roll < 0.34) return primary;
    if (roll < 0.67) return secondary;
    return tertiary;
  }
  if (roll < 0.42) return primary;
  if (roll < 0.74) return secondary;
  return tertiary;
}

function brightenRgb(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    clamp(Math.round(rgb[0] + (255 - rgb[0]) * amount), 0, 255),
    clamp(Math.round(rgb[1] + (255 - rgb[1]) * amount), 0, 255),
    clamp(Math.round(rgb[2] + (255 - rgb[2]) * amount), 0, 255)
  ];
}

function clonePaletteRgb(palette: PaletteTriplet): PaletteTriplet {
  return [
    [...palette[0]] as [number, number, number],
    [...palette[1]] as [number, number, number],
    [...palette[2]] as [number, number, number]
  ];
}

function pickMericaBurstColor(): [number, number, number] {
  const roll = Math.random();
  if (roll < 0.22) return [255, 252, 244];
  if (roll < 0.46) return [10, 49, 97];
  if (roll < 0.68) return [61, 114, 196];
  if (roll < 0.86) return [179, 25, 66];
  return [224, 76, 104];
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
  private mericaTapCount = 0;
  private mericaAccentTimeouts: number[] = [];

  private themeTokens: ThemeTokens = {
    accentRgb: [125, 86, 226],
    auraRgb: [170, 112, 255],
    fxPaletteRgb: [
      [188, 132, 255],
      [255, 255, 255],
      [170, 112, 255]
    ],
    glowIntensity: 1,
    themeSlot: null
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
    this.updateFrameThrottle();
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
    this.clearMericaAccentTimeouts();
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
    this.updateFrameThrottle();
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.updateFrameThrottle();
  }

  setThemeTokens(tokens: Partial<ThemeTokens>): void {
    const nextThemeSlot = Object.prototype.hasOwnProperty.call(tokens, "themeSlot")
      ? (tokens.themeSlot ?? null)
      : this.themeTokens.themeSlot;
    const prevThemeSlot = this.themeTokens.themeSlot;
    this.themeTokens = {
      ...this.themeTokens,
      ...tokens,
      accentRgb: tokens.accentRgb ?? this.themeTokens.accentRgb,
      auraRgb: tokens.auraRgb ?? this.themeTokens.auraRgb,
      fxPaletteRgb: tokens.fxPaletteRgb ?? this.themeTokens.fxPaletteRgb,
      themeSlot: nextThemeSlot,
      glowIntensity: Number.isFinite(tokens.glowIntensity)
        ? clamp(tokens.glowIntensity as number, 0.5, 2)
        : this.themeTokens.glowIntensity
    };
    if (prevThemeSlot !== nextThemeSlot) {
      this.mericaTapCount = 0;
      this.clearMericaAccentTimeouts();
    }
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
        this.spawnSparks(x, y, 8, auraHue(this.themeTokens));
        this.playPopSound(now);
      } else {
        this.spawnPopBubble(x, y, intensity);
      }
      this.trimCaps();
      return;
    }

    if (this.themeTokens.themeSlot === "merica") {
      this.mericaTapCount += 1;
      const isAccentTap = this.mericaTapCount % 6 === 0;
      if (isAccentTap && !this.reducedMotion) {
        this.spawnMericaFireworks(x, y, Math.min(1, intensity + 0.24));
        this.scheduleMericaAccentBurst(1, Math.min(1, intensity + 0.12));
        this.scheduleMericaAccentBurst(2, Math.min(1, intensity + 0.16));
      } else if (isAccentTap) {
        this.spawnMericaFireworks(x, y, Math.min(1, intensity + 0.18));
        this.spawnMericaFireworks(x + 28, y - 10, Math.min(1, intensity + 0.08));
      } else {
        this.spawnMericaFireworks(x, y, intensity);
      }
      this.trimCaps();
      return;
    }

    if (this.themeTokens.themeSlot === "rasta") {
      this.spawnRastaSmoke(x, y, intensity);
      this.trimCaps();
      return;
    }

    const splatCount = this.reducedMotion ? 8 : intensity > 0.66 ? 24 : intensity > 0.28 ? 16 : 12;
    for (let i = 0; i < splatCount; i += 1) {
      this.spawnSplat(x, y, intensity);
    }
    this.trimCaps();
  }

  private clearMericaAccentTimeouts(): void {
    this.mericaAccentTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.mericaAccentTimeouts.length = 0;
  }

  private scheduleMericaAccentBurst(sequenceIndex: number, intensity: number): void {
    const delayMs = sequenceIndex * MERICA_ACCENT_BURST_DELAY_MS;
    const timeoutId = window.setTimeout(() => {
      this.mericaAccentTimeouts = this.mericaAccentTimeouts.filter((id) => id !== timeoutId);
      if (!this.running || this.themeTokens.themeSlot !== "merica") return;
      const { x, y } = this.pickMericaAccentBurstPosition();
      this.spawnMericaFireworks(x, y, intensity);
      this.trimCaps();
    }, delayMs);
    this.mericaAccentTimeouts.push(timeoutId);
  }

  private pickMericaAccentBurstPosition(): { x: number; y: number } {
    const horizontalPadding = Math.min(140, Math.max(48, this.width * 0.14));
    const topPadding = Math.min(120, Math.max(44, this.height * 0.12));
    const bottomPadding = Math.min(180, Math.max(68, this.height * 0.2));
    const minX = horizontalPadding;
    const maxX = Math.max(minX, this.width - horizontalPadding);
    const minY = topPadding;
    const maxY = Math.max(minY, this.height - bottomPadding);
    return {
      x: rand(minX, maxX),
      y: rand(minY, maxY)
    };
  }

  onPointerMove(x: number, y: number, now = performance.now()): void {
    if (this.mode !== "gravity") return;
    this.attractor.x = x;
    this.attractor.y = y;
    this.attractor.strength = Math.max(this.attractor.strength, 0.45);
    this.attractor.until = Math.max(this.attractor.until, now + 260);
  }

  clear(): void {
    this.mericaTapCount = 0;
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
        const [fx1, fx2, fx3] = this.themeTokens.fxPaletteRgb;
        gradient.addColorStop(0, `rgba(${fx2[0]}, ${fx2[1]}, ${fx2[2]}, ${alpha * 0.98})`);
        gradient.addColorStop(0.34, `hsla(${bubble.hue} 100% 88% / ${alpha * 0.82})`);
        gradient.addColorStop(0.72, `rgba(${fx3[0]}, ${fx3[1]}, ${fx3[2]}, ${alpha * 0.34})`);
        gradient.addColorStop(1, `rgba(${fx1[0]}, ${fx1[1]}, ${fx1[2]}, 0)`);
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
        const [fx1, fx2, fx3] = this.themeTokens.fxPaletteRgb;
        const fillGradient = this.ctx.createRadialGradient(bubble.x, bubble.y, radius * 0.18, bubble.x, bubble.y, radius);
        fillGradient.addColorStop(0, `rgba(${fx2[0]}, ${fx2[1]}, ${fx2[2]}, ${baseAlpha * 0.2})`);
        fillGradient.addColorStop(0.56, `hsla(${bubble.hue} 100% 92% / ${baseAlpha * 0.16})`);
        fillGradient.addColorStop(1, `rgba(${fx1[0]}, ${fx1[1]}, ${fx1[2]}, 0)`);
        this.ctx.fillStyle = fillGradient;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(bubble.x, bubble.y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${fx3[0]}, ${fx3[1]}, ${fx3[2]}, ${baseAlpha * 0.9})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();
      }
    }

    if (this.mode === "splatter") {
      for (let i = 0; i < this.splatters.length; i += 1) {
        const splat = this.splatters[i];
        const life = 1 - splat.age / splat.ttl;
        const depth = 1 - life;
        const depthEase = 1 - Math.pow(1 - depth, 2);
        const splatThemeSlot = splat.themeSlot;
        const spawnBurstEase =
          splatThemeSlot === "merica" && !splat.flash
            ? Math.max(0, Math.min(1, splat.age / Math.max(220, splat.ttl * 0.18)))
            : 0;
        const spawnBurstScale =
          splatThemeSlot === "merica" && !splat.flash
            ? 1 + spawnBurstEase * (this.resolvedQuality === "lite" ? 1.05 : 1.32)
            : 1;
        const depthScale = (this.resolvedQuality === "lite" ? 1 + depthEase * 0.22 : 1 + depthEase * 0.48) * spawnBurstScale;
        const depthAlpha = this.resolvedQuality === "lite" ? 1 - depthEase * 0.06 : 1 - depthEase * 0.1;
        this.ctx.save();
        this.ctx.translate(splat.x, splat.y);
        this.ctx.rotate(splat.rot);
        if (splatThemeSlot === "merica" && splat.segmented) {
          const rgb = splat.rgb ?? [255, 255, 255];
          const renderRgb = brightenRgb(rgb, rgb[2] > rgb[0] && rgb[2] > rgb[1] ? 0.26 : 0.14);
          const streakLength = Math.max(10, splat.rx * depthScale * 1.08);
          const streakThickness = Math.max(0.28, splat.ry * depthScale * 0.42);
          const segmentCount = this.resolvedQuality === "lite" ? 3 : 5;
          const gap = streakLength * 0.11;
          const usableLength = streakLength - gap * (segmentCount - 1);
          const segmentLength = usableLength / segmentCount;
          const mericaFlicker = 0.9 + Math.max(0, Math.sin((1 - life) * 26)) * 0.34;
          const segmentAlpha = Math.min(1, splat.alpha * life * depthAlpha * mericaFlicker * 1.06);

          for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
            const startX = -streakLength / 2 + segmentIndex * (segmentLength + gap);
            const midX = startX + segmentLength / 2;
            const segmentFade = 1 - segmentIndex / (segmentCount + 1);
            this.ctx.beginPath();
            this.ctx.ellipse(
              midX,
              0,
              Math.max(1.6, segmentLength / 2),
              streakThickness,
              0,
              0,
              Math.PI * 2
            );
            const segmentGradient = this.ctx.createRadialGradient(
              midX,
              0,
              Math.max(0.18, streakThickness * 0.12),
              midX,
              0,
              Math.max(segmentLength / 2, streakThickness * 1.4)
            );
            segmentGradient.addColorStop(0, `rgba(${renderRgb[0]}, ${renderRgb[1]}, ${renderRgb[2]}, ${segmentAlpha * segmentFade})`);
            segmentGradient.addColorStop(0.72, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${segmentAlpha * segmentFade * 0.74})`);
            segmentGradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
            this.ctx.fillStyle = segmentGradient;
            this.ctx.fill();
          }

          this.ctx.beginPath();
          this.ctx.ellipse(streakLength * 0.48, 0, Math.max(0.42, streakThickness * 0.9), Math.max(0.16, streakThickness * 0.34), 0, 0, Math.PI * 2);
          this.ctx.fillStyle = `rgba(255, 248, 232, ${Math.min(1, segmentAlpha * 0.92)})`;
          this.ctx.fill();

          if (this.resolvedQuality !== "lite") {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, segmentAlpha)})`;
            for (let emberIndex = 0; emberIndex < 2; emberIndex += 1) {
              const emberX = -streakLength * 0.18 + emberIndex * streakLength * 0.34 + rand(-1.4, 1.4);
              const emberY = rand(-streakThickness * 0.5, streakThickness * 0.5);
              const emberSize = emberIndex === 0 ? 1.15 : 0.9;
              this.ctx.fillRect(emberX, emberY, emberSize, emberSize);
            }
          }

          this.ctx.restore();
          continue;
        }
        this.ctx.beginPath();
        this.ctx.ellipse(
          0,
          0,
          Math.max(1.2, splat.rx * depthScale),
          Math.max(1.2, splat.ry * depthScale),
          0,
          0,
          Math.PI * 2
        );
        const [fx1, , fx3] = splat.paletteRgb ?? this.themeTokens.fxPaletteRgb;
        const rgb = splat.rgb;
        const edgeRgb = rgb ?? fx3;
        const renderRgb =
          splatThemeSlot === "merica" && rgb && !splat.flash
            ? brightenRgb(rgb, rgb[2] > rgb[0] && rgb[2] > rgb[1] ? 0.26 : 0.14)
            : rgb;
        const mericaFlicker =
          splatThemeSlot === "merica" && !splat.flash
            ? 0.9 + Math.max(0, Math.sin((1 - life) * 26)) * 0.34
            : 1;
        const coreAlpha = splat.flash
          ? splat.alpha * life * depthAlpha * 1.16
          : splat.alpha * life * depthAlpha * mericaFlicker;
        const outerAlpha = splat.flash
          ? splat.alpha * life * depthAlpha * 0.62
          : splat.alpha * life * depthAlpha * 0.44 * mericaFlicker;
        const splatGradient = this.ctx.createRadialGradient(
          0,
          0,
          Math.max(0.8, splat.rx * 0.18),
          0,
          0,
          Math.max(splat.rx, splat.ry) * depthScale
        );
        splatGradient.addColorStop(
          0,
          renderRgb
            ? `rgba(${renderRgb[0]}, ${renderRgb[1]}, ${renderRgb[2]}, ${coreAlpha})`
            : `hsla(${splat.hue} 100% 82% / ${coreAlpha})`
        );
        splatGradient.addColorStop(0.62, `rgba(${edgeRgb[0]}, ${edgeRgb[1]}, ${edgeRgb[2]}, ${outerAlpha})`);
        splatGradient.addColorStop(1, `rgba(${fx1[0]}, ${fx1[1]}, ${fx1[2]}, 0)`);
        this.ctx.fillStyle = splatGradient;
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    if (this.mode === "splatter") {
      const activeMericaFlash = this.splatters
        .filter((splat) => splat.flash && splat.themeSlot === "merica")
        .reduce((maxFlash, splat) => Math.max(maxFlash, (1 - splat.age / splat.ttl) * splat.alpha), 0);
      if (activeMericaFlash > 0.02) {
        const flashAlpha = Math.min(0.24, activeMericaFlash * 0.34);
        const screenFlash = this.ctx.createRadialGradient(
          this.width * 0.5,
          this.height * 0.48,
          0,
          this.width * 0.5,
          this.height * 0.48,
          Math.max(this.width, this.height) * 0.64
        );
        screenFlash.addColorStop(0, `rgba(255, 252, 242, ${flashAlpha})`);
        screenFlash.addColorStop(0.28, `rgba(255, 236, 198, ${flashAlpha * 0.74})`);
        screenFlash.addColorStop(0.72, `rgba(255, 214, 156, ${flashAlpha * 0.18})`);
        screenFlash.addColorStop(1, "rgba(255, 214, 156, 0)");
        this.ctx.fillStyle = screenFlash;
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
    }

    for (let i = 0; i < this.sparks.length; i += 1) {
      const spark = this.sparks[i];
      const life = 1 - spark.age / spark.ttl;
      const isMericaHotSpark = spark.themeSlot === "merica" && Boolean(spark.rgb);
      if (isMericaHotSpark && spark.crackle) {
        const crackleAlpha = Math.min(1, spark.alpha * life * 1.45);
        this.ctx.fillStyle = `rgba(${spark.rgb![0]}, ${spark.rgb![1]}, ${spark.rgb![2]}, ${crackleAlpha})`;
        this.ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, crackleAlpha * 0.95)})`;
        this.ctx.fillRect(spark.x + 0.15, spark.y + 0.15, Math.max(0.5, spark.size * 0.42), Math.max(0.5, spark.size * 0.42));
        continue;
      }
      if (isMericaHotSpark) {
        this.ctx.save();
        this.ctx.translate(spark.x, spark.y);
        this.ctx.rotate(Math.atan2(spark.vy, spark.vx));
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, spark.size * 2.4, Math.max(0.7, spark.size * 0.42), 0, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${spark.rgb![0]}, ${spark.rgb![1]}, ${spark.rgb![2]}, ${Math.min(1, spark.alpha * life * 1.18)})`;
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, spark.size * 0.72, Math.max(0.45, spark.size * 0.24), 0, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 244, 220, ${Math.min(1, spark.alpha * life * 0.95)})`;
        this.ctx.fill();
        this.ctx.restore();
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      this.ctx.fillStyle = spark.rgb
        ? `rgba(${spark.rgb[0]}, ${spark.rgb[1]}, ${spark.rgb[2]}, ${spark.alpha * life})`
        : `hsla(${spark.hue} 100% 88% / ${spark.alpha * life})`;
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

  private updateFrameThrottle(): void {
    if (this.reducedMotion) {
      this.frameThrottleMs = this.isMobile ? 50 : 40;
      return;
    }
    this.frameThrottleMs = this.isMobile ? 33 : 16;
  }

  private getCaps() {
    const lite = this.resolvedQuality === "lite";
    if (this.reducedMotion) {
      return {
        gravity: this.isMobile ? 10 : 14,
        pop: this.isMobile ? 10 : 14,
        splat: this.isMobile ? 110 : 180
      };
    }
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
      rx: 0,
      ry: 0,
      rot: 0,
      alpha: 0,
      ttl: 0,
      age: 0,
      hue: 0,
      rgb: null,
      flash: false,
      segmented: false,
      themeSlot: null,
      paletteRgb: null
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
      alpha: 0,
      hue: 0,
      rgb: null,
      size: 1.8,
      crackle: false,
      themeSlot: null
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
    bubble.r = rand(14, 34) * (1 + intensity * 0.28 + (this.themeTokens.glowIntensity - 1) * 0.16);
    bubble.hue = Math.random() < 0.84 ? auraHue(this.themeTokens) : themedHue(this.themeTokens);
    bubble.alpha = rand(0.32, 0.52) * this.themeTokens.glowIntensity;
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
    bubble.r = rand(16, 36) * (1 + intensity * 0.2 + (this.themeTokens.glowIntensity - 1) * 0.12);
    bubble.hue = auraHue(this.themeTokens);
    bubble.alpha = rand(0.34, 0.56) * Math.min(1.3, this.themeTokens.glowIntensity);
    bubble.ttl = rand(18000, 46000);
    bubble.age = 0;
    bubble.popping = false;
    this.popBubbles.push(bubble);
  }

  private spawnSplat(x: number, y: number, intensity: number): void {
    const splat = this.acquireSplat();
    const spread = 22 + intensity * 34;
    const angle = rand(0, Math.PI * 2);
    const radial = Math.sqrt(Math.random());
    const burstBias = Math.random() < 0.18 ? rand(1.08, 1.45) : 1;
    const distance = spread * radial * burstBias;
    const jitter = 2 + intensity * 3;
    splat.x = x + Math.cos(angle) * distance + rand(-jitter, jitter);
    splat.y = y + Math.sin(angle) * distance + rand(-jitter, jitter);
    splat.vx = this.reducedMotion ? 0 : Math.cos(angle) * rand(0.016, 0.082) + rand(-0.018, 0.018);
    splat.vy = this.reducedMotion ? 0 : Math.sin(angle) * rand(0.016, 0.082) + rand(-0.018, 0.018);
    const baseRadius = rand(2.8, 10.2) * (Math.random() < 0.12 ? rand(1.18, 1.56) : 1);
    const eccentricity = rand(0.82, 1.3);
    splat.r = baseRadius;
    splat.rx = baseRadius * eccentricity;
    splat.ry = baseRadius / eccentricity;
    splat.rot = angle + rand(-0.55, 0.55);
    splat.alpha = rand(0.24, 0.46) * Math.min(1.2, this.themeTokens.glowIntensity);
    splat.ttl = this.resolvedQuality === "lite" ? rand(10000, 18000) : rand(12000, 30000);
    splat.age = 0;
    splat.hue = Math.random() < 0.9 ? auraHue(this.themeTokens) : themedHue(this.themeTokens);
    splat.rgb = this.themeTokens.themeSlot === "mx" ? pickPaletteRgb(this.themeTokens) : null;
    splat.flash = false;
    splat.segmented = false;
    splat.themeSlot = this.themeTokens.themeSlot;
    splat.paletteRgb = clonePaletteRgb(this.themeTokens.fxPaletteRgb);
    this.splatters.push(splat);
  }

  private spawnSparks(
    x: number,
    y: number,
    count: number,
    hue: number,
    options?: {
      rgb?: [number, number, number] | null;
      minSize?: number;
      maxSize?: number;
      minSpeed?: number;
      maxSpeed?: number;
      crackle?: boolean;
    }
  ): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const speed = rand(options?.minSpeed ?? 0.5, options?.maxSpeed ?? 1.8);
      const spark = this.acquireSpark();
      spark.x = x;
      spark.y = y;
      spark.vx = Math.cos(angle) * speed;
      spark.vy = Math.sin(angle) * speed;
      spark.ttl = rand(220, 480);
      spark.age = 0;
      spark.alpha = rand(0.48, 0.9);
      spark.hue = rand(hue - 6, hue + 6);
      spark.rgb = options?.rgb ?? null;
      spark.size = rand(options?.minSize ?? 1.4, options?.maxSize ?? 2.2);
      spark.crackle = options?.crackle === true;
      spark.themeSlot = this.themeTokens.themeSlot;
      this.sparks.push(spark);
    }
  }

  private spawnMericaFireworks(x: number, y: number, intensity: number): void {
    const burstCount = this.reducedMotion ? 6 : intensity > 0.66 ? 12 : intensity > 0.28 ? 10 : 9;
    const burstColor = pickMericaBurstColor();
    const burstHue = rgbToHue(burstColor, 0);
    const sparkColor: [number, number, number] = [255, 168, 54];
    const burstRotation = rand(0, Math.PI * 2);
    const spacingJitter = rand(0.86, 1.16);

    const flashCore = this.acquireSplat();
    flashCore.x = x;
    flashCore.y = y;
    flashCore.vx = 0;
    flashCore.vy = 0;
    flashCore.r = 30 + intensity * 16;
    flashCore.rx = flashCore.r * 1.28;
    flashCore.ry = flashCore.r * 1.28;
    flashCore.rot = 0;
    flashCore.alpha = 0.96;
    flashCore.ttl = this.resolvedQuality === "lite" ? 120 : 150;
    flashCore.age = 0;
    flashCore.hue = 0;
    flashCore.rgb = [255, 255, 255];
    flashCore.flash = true;
    flashCore.segmented = false;
    flashCore.themeSlot = this.themeTokens.themeSlot;
    flashCore.paletteRgb = clonePaletteRgb(this.themeTokens.fxPaletteRgb);
    this.splatters.push(flashCore);

    const hotFlash = this.acquireSplat();
    hotFlash.x = x;
    hotFlash.y = y;
    hotFlash.vx = 0;
    hotFlash.vy = 0;
    hotFlash.r = 18 + intensity * 12;
    hotFlash.rx = hotFlash.r * 1.22;
    hotFlash.ry = hotFlash.r * 1.22;
    hotFlash.rot = 0;
    hotFlash.alpha = 0.88 * Math.min(1.38, this.themeTokens.glowIntensity);
    hotFlash.ttl = this.resolvedQuality === "lite" ? 180 : 220;
    hotFlash.age = 0;
    hotFlash.hue = 0;
    hotFlash.rgb = [255, 244, 220];
    hotFlash.flash = true;
    hotFlash.segmented = false;
    hotFlash.themeSlot = this.themeTokens.themeSlot;
    hotFlash.paletteRgb = clonePaletteRgb(this.themeTokens.fxPaletteRgb);
    this.splatters.push(hotFlash);

    const flash = this.acquireSplat();
    flash.x = x;
    flash.y = y;
    flash.vx = 0;
    flash.vy = 0;
    flash.r = 28 + intensity * 16;
    flash.rx = flash.r * 1.18;
    flash.ry = flash.r * 1.18;
    flash.rot = 0;
    flash.alpha = 0.5 * Math.min(1.28, this.themeTokens.glowIntensity);
    flash.ttl = this.resolvedQuality === "lite" ? 420 : 560;
    flash.age = 0;
    flash.hue = burstHue;
    flash.rgb = burstColor;
    flash.flash = true;
    flash.segmented = false;
    flash.themeSlot = this.themeTokens.themeSlot;
    flash.paletteRgb = clonePaletteRgb(this.themeTokens.fxPaletteRgb);
    this.splatters.push(flash);

    for (let i = 0; i < burstCount; i += 1) {
      const splat = this.acquireSplat();
      const angle = burstRotation + (i / burstCount) * Math.PI * 2 * spacingJitter + rand(-0.24, 0.24);
      const distance = rand(34, 68) + intensity * rand(26, 52);
      splat.x = x + Math.cos(angle) * distance * 0.08;
      splat.y = y + Math.sin(angle) * distance * 0.08;
      splat.vx = this.reducedMotion ? 0 : Math.cos(angle) * rand(0.42, 0.94);
      splat.vy = this.reducedMotion ? 0 : Math.sin(angle) * rand(0.42, 0.94);
      splat.r = rand(7.2, 14.4) * (1 + intensity * 0.2);
      splat.rx = splat.r * rand(4.4, 6.6);
      splat.ry = splat.r * rand(0.08, 0.16);
      splat.rot = angle;
      splat.alpha = rand(0.48, 0.8) * Math.min(1.4, this.themeTokens.glowIntensity);
      splat.ttl = this.resolvedQuality === "lite" ? rand(760, 1140) : rand(920, 1480);
      splat.age = 0;
      splat.hue = burstHue;
      splat.rgb = burstColor;
      splat.flash = false;
      splat.segmented = true;
      splat.themeSlot = this.themeTokens.themeSlot;
      splat.paletteRgb = clonePaletteRgb(this.themeTokens.fxPaletteRgb);
      this.splatters.push(splat);
      this.spawnSparks(
        splat.x,
        splat.y,
        this.reducedMotion ? 2 : 4,
        burstHue,
        { rgb: sparkColor, minSize: 1.1, maxSize: 2.2, minSpeed: 1.8, maxSpeed: 4.8 }
      );
    }

    this.spawnSparks(x, y, this.reducedMotion ? 3 : 5, burstHue, {
      rgb: sparkColor,
      minSize: 1.4,
      maxSize: 2.6,
      minSpeed: 2.2,
      maxSpeed: 5.4
    });

    this.spawnSparks(x, y, this.reducedMotion ? 1 : 2, burstHue, {
      rgb: Math.random() < 0.55 ? [255, 255, 255] : [255, 188, 84],
      minSize: 0.9,
      maxSize: 1.5,
      minSpeed: 2.8,
      maxSpeed: 6.2,
      crackle: true
    });
  }

  private spawnRastaSmoke(x: number, y: number, intensity: number): void {
    const plumeColors: Array<[number, number, number]> = [
      [7, 137, 48],
      [252, 221, 9],
      [218, 18, 26]
    ];
    const plumeCount = 3;
    const clusterRotation = rand(-Math.PI, Math.PI);
    const clusterCos = Math.cos(clusterRotation);
    const clusterSin = Math.sin(clusterRotation);

    for (let i = 0; i < plumeCount; i += 1) {
      const splat = this.acquireSplat();
      const color = plumeColors[i]!;
      const localOffsetX = (i - 1) * (12 + intensity * 7) + rand(-4, 4);
      const localOffsetY = rand(-6, 8) + i * rand(2, 6);
      const clusterOffsetX = localOffsetX * clusterCos - localOffsetY * clusterSin;
      const clusterOffsetY = localOffsetX * clusterSin + localOffsetY * clusterCos;
      const isSecondPlume = i === 1;
      const secondPlumeAngle = isSecondPlume ? rand(0, Math.PI * 2) : 0;
      const secondPlumeDistance = isSecondPlume ? rand(10, 20) : 0;
      const offsetX = clusterOffsetX + Math.cos(secondPlumeAngle) * secondPlumeDistance;
      const offsetY = clusterOffsetY + Math.sin(secondPlumeAngle) * secondPlumeDistance;
      const baseRadius = (this.reducedMotion ? 24 : 30) + intensity * rand(10, 18);
      splat.x = x + offsetX;
      splat.y = y + offsetY;
      splat.vx = this.reducedMotion ? 0 : rand(-0.03, 0.03);
      splat.vy = this.reducedMotion ? -0.01 : rand(-0.08, -0.03);
      splat.r = baseRadius;
      splat.rx = baseRadius * rand(1.35, 1.9);
      splat.ry = baseRadius * rand(0.96, 1.28);
      splat.rot = isSecondPlume ? rand(-Math.PI, Math.PI) : clusterRotation + rand(-0.28, 0.28);
      splat.alpha = rand(0.14, 0.22) * Math.min(1.16, this.themeTokens.glowIntensity);
      splat.ttl = this.resolvedQuality === "lite" ? rand(1500, 2100) : rand(1800, 2600);
      splat.age = 0;
      splat.hue = rgbToHue(color, 60);
      splat.rgb = color;
      splat.flash = false;
      splat.segmented = false;
      splat.themeSlot = this.themeTokens.themeSlot;
      splat.paletteRgb = clonePaletteRgb(this.themeTokens.fxPaletteRgb);
      this.splatters.push(splat);
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
  const root = document.documentElement;
  const accent = style.getPropertyValue("--color-accent").trim();
  const aura = style.getPropertyValue("--aura-rgb").trim();
  const fx1 = style.getPropertyValue("--fx-color-1-rgb").trim();
  const fx2 = style.getPropertyValue("--fx-color-2-rgb").trim();
  const fx3 = style.getPropertyValue("--fx-color-3-rgb").trim();
  const glow = Number(style.getPropertyValue("--glow-intensity").trim());
  const themeSlot =
    root.dataset.theme === "custom" && typeof root.dataset.themeSlot === "string" && root.dataset.themeSlot.trim()
      ? root.dataset.themeSlot.trim()
      : null;

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
    fxPaletteRgb: [
      parseRgb(fx1, accentRgb),
      parseRgb(fx2, [255, 255, 255]),
      parseRgb(fx3, parseRgb(aura, [170, 112, 255]))
    ],
    glowIntensity: Number.isFinite(glow) ? clamp(glow, 0.5, 2) : 1,
    themeSlot
  };
}

export type { EngineOptions };
