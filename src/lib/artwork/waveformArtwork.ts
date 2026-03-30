type GenerateArtworkInput = {
  audioBlob?: Blob;
  peaks?: number[];
  width?: number;
  height?: number;
};

type WaveformArtworkPalette = {
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  glow: string;
  barTop: string;
  barMid: string;
  barBottom: string;
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("AudioContext not available");
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function fallbackPeaks(length = 220): number[] {
  return new Array(length).fill(0).map((_, i) => 0.2 + 0.5 * Math.abs(Math.sin(i / 11)));
}

export async function buildPeaksFromAudioBlob(blob: Blob, bars = 220): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
  const channel = audioBuffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / bars));

  return new Array(bars).fill(0).map((_, i) => {
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    let peak = 0;
    for (let j = start; j < end; j += 1) peak = Math.max(peak, Math.abs(channel[j] ?? 0));
    return peak;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to export artwork blob"));
    }, "image/png");
  });
}

function getWaveformArtworkPalette(): WaveformArtworkPalette {
  if (typeof document === "undefined") {
    return {
      bgStart: "#1f1336",
      bgMid: "#23174a",
      bgEnd: "#09101d",
      glow: "rgba(193, 126, 255, 0.42)",
      barTop: "rgba(124, 229, 255, 0.96)",
      barMid: "rgba(175, 108, 255, 0.92)",
      barBottom: "rgba(255, 114, 212, 0.85)"
    };
  }

  const root = document.documentElement;
  const theme = root.getAttribute("data-theme");
  const slot = root.getAttribute("data-theme-slot");

  if (theme === "custom" && slot === "teal") {
    return {
      bgStart: "#0d2130",
      bgMid: "#123443",
      bgEnd: "#07131b",
      glow: "rgba(92, 233, 226, 0.4)",
      barTop: "rgba(196, 255, 250, 0.96)",
      barMid: "rgba(110, 241, 233, 0.92)",
      barBottom: "rgba(64, 187, 214, 0.84)"
    };
  }

  if (theme === "custom" && slot === "amber") {
    return {
      bgStart: "#2b1808",
      bgMid: "#3a2410",
      bgEnd: "#0f1118",
      glow: "rgba(255, 202, 118, 0.38)",
      barTop: "rgba(255, 244, 214, 0.96)",
      barMid: "rgba(255, 210, 120, 0.92)",
      barBottom: "rgba(232, 145, 62, 0.84)"
    };
  }

  if (theme === "custom" && slot === "crimson") {
    return {
      bgStart: "#2a121c",
      bgMid: "#3a1826",
      bgEnd: "#0f1019",
      glow: "rgba(232, 126, 160, 0.36)",
      barTop: "rgba(255, 232, 239, 0.96)",
      barMid: "rgba(240, 144, 176, 0.9)",
      barBottom: "rgba(166, 72, 102, 0.84)"
    };
  }

  if (theme === "light") {
    return {
      bgStart: "#f6dbe8",
      bgMid: "#eec8df",
      bgEnd: "#d9e2f2",
      glow: "rgba(222, 126, 170, 0.26)",
      barTop: "rgba(255, 255, 255, 0.96)",
      barMid: "rgba(220, 134, 182, 0.88)",
      barBottom: "rgba(120, 110, 215, 0.8)"
    };
  }

  return {
    bgStart: "#1f1336",
    bgMid: "#23174a",
    bgEnd: "#09101d",
    glow: "rgba(193, 126, 255, 0.42)",
    barTop: "rgba(124, 229, 255, 0.96)",
    barMid: "rgba(175, 108, 255, 0.92)",
    barBottom: "rgba(255, 114, 212, 0.85)"
  };
}

export async function generateWaveformArtwork(input: GenerateArtworkInput): Promise<Blob> {
  const width = Math.max(320, Math.floor(input.width ?? 1200));
  const height = Math.max(320, Math.floor(input.height ?? 1200));
  let peaks = input.peaks;
  if (!peaks?.length && input.audioBlob) {
    peaks = await buildPeaksFromAudioBlob(input.audioBlob, 220).catch(() => fallbackPeaks(220));
  }
  const safePeaks = peaks?.length ? peaks : fallbackPeaks(220);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create artwork canvas");
  const palette = getWaveformArtworkPalette();

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, palette.bgStart);
  bg.addColorStop(0.45, palette.bgMid);
  bg.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.24, height * 0.22, 40, width * 0.24, height * 0.22, width * 0.76);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, "rgba(193, 126, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const bars = 140;
  const gap = 4;
  const barWidth = (width - (bars - 1) * gap) / bars;
  const baseline = height * 0.55;
  const waveformGrad = ctx.createLinearGradient(0, baseline - height * 0.28, 0, baseline + height * 0.28);
  waveformGrad.addColorStop(0, palette.barTop);
  waveformGrad.addColorStop(0.55, palette.barMid);
  waveformGrad.addColorStop(1, palette.barBottom);
  ctx.fillStyle = waveformGrad;

  for (let i = 0; i < bars; i += 1) {
    const peakIndex = bars > 1 ? Math.round((i / (bars - 1)) * (safePeaks.length - 1)) : 0;
    const amplitude = Math.max(0.04, safePeaks[peakIndex] ?? 0.2);
    const heightScale = 0.08 + amplitude * 0.42;
    const barHeight = Math.max(height * 0.08, height * heightScale);
    const x = i * (barWidth + gap);
    const y = baseline - barHeight * 0.5;
    ctx.fillRect(x, y, barWidth, barHeight);
  }

  const sheen = ctx.createLinearGradient(0, 0, width, 0);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.11)");
  sheen.addColorStop(0.5, "rgba(255, 255, 255, 0.02)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0.14)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, height * 0.2, width * 0.5, height * 0.5, height * 0.8);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.46)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return canvasToPngBlob(canvas);
}
