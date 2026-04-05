import type { ThemeSelection } from "../themeConfig";
import { getWaveformThemePalette } from "../waveformTheme";

type GenerateArtworkInput = {
  audioBlob?: Blob;
  peaks?: number[];
  width?: number;
  height?: number;
  themeSelection?: ThemeSelection;
};

let audioCtx: AudioContext | null = null;
const runtimeWaveformPeakCache = new Map<string, number[]>();

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

export function getRuntimeWaveformPeaks(trackId: string | null | undefined): number[] | null {
  if (!trackId) return null;
  const cached = runtimeWaveformPeakCache.get(trackId);
  return cached?.length ? cached : null;
}

export function setRuntimeWaveformPeaks(trackId: string | null | undefined, peaks: number[]): void {
  if (!trackId || !peaks.length) return;
  runtimeWaveformPeakCache.set(trackId, peaks);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to export artwork blob"));
    }, "image/png");
  });
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
  const themePalette = getWaveformThemePalette(input.themeSelection);
  const palette = themePalette.artwork;

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

  const waveformLift = ctx.createRadialGradient(
    width * 0.5,
    height * 0.56,
    height * 0.06,
    width * 0.5,
    height * 0.56,
    width * 0.62
  );
  waveformLift.addColorStop(0, "rgba(255, 255, 255, 0.18)");
  waveformLift.addColorStop(0.42, "rgba(255, 255, 255, 0.08)");
  waveformLift.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = waveformLift;
  ctx.fillRect(0, 0, width, height);

  const bars = 140;
  const gap = 4;
  const barWidth = (width - (bars - 1) * gap) / bars;
  const baseline = height * 0.55;
  const waveformGrad = ctx.createLinearGradient(0, 0, width, 0);
  waveformGrad.addColorStop(0, themePalette.progressStops[0]);
  waveformGrad.addColorStop(0.5, themePalette.progressStops[1]);
  waveformGrad.addColorStop(1, themePalette.progressStops[2]);
  ctx.fillStyle = waveformGrad;

  const waveformShadow = ctx.createLinearGradient(0, 0, width, 0);
  waveformShadow.addColorStop(0, "rgba(8, 10, 18, 0.22)");
  waveformShadow.addColorStop(0.5, "rgba(8, 10, 18, 0.12)");
  waveformShadow.addColorStop(1, "rgba(8, 10, 18, 0.22)");

  for (let i = 0; i < bars; i += 1) {
    const peakIndex = bars > 1 ? Math.round((i / (bars - 1)) * (safePeaks.length - 1)) : 0;
    const amplitude = Math.max(0.04, safePeaks[peakIndex] ?? 0.2);
    const heightScale = 0.08 + amplitude * 0.42;
    const barHeight = Math.max(height * 0.08, height * heightScale);
    const x = i * (barWidth + gap);
    const y = baseline - barHeight * 0.5;
    ctx.fillStyle = waveformShadow;
    ctx.fillRect(x, y + 1, barWidth, barHeight);
    ctx.fillStyle = waveformGrad;
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
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return canvasToPngBlob(canvas);
}
