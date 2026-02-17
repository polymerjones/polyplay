import { useEffect, useMemo, useRef, useState } from "react";
import type { LoopRegion, Track } from "../types";

type Props = {
  track: Track | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  loopRegion: LoopRegion;
  onSeek: (seconds: number) => void;
  onSetLoopRange: (start: number, end: number, active: boolean) => void;
};

type Handle = "start" | "end";

const LONG_PRESS_MS = 450;
const MIN_LOOP_SECONDS = 0.1;

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

async function buildPeaksFromBlob(blob: Blob, bars = 220): Promise<number[]> {
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

function fallbackPeaks(length = 220): number[] {
  return new Array(length).fill(0).map((_, i) => 0.2 + 0.5 * Math.abs(Math.sin(i / 11)));
}

export function WaveformLoop({
  track,
  currentTime,
  duration,
  isPlaying,
  loopRegion,
  onSeek,
  onSetLoopRange
}: Props) {
  const waveRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const [peaks, setPeaks] = useState<number[]>(() => fallbackPeaks());
  const [draggingHandle, setDraggingHandle] = useState<Handle | null>(null);

  const hasDuration = duration > 0;
  const safeStart = useMemo(
    () => Math.max(0, Math.min(duration || 0, loopRegion.start)),
    [duration, loopRegion.start]
  );
  const safeEnd = useMemo(() => {
    if (!hasDuration) return 0;
    const candidate = loopRegion.end > 0 ? loopRegion.end : duration;
    return Math.max(safeStart + MIN_LOOP_SECONDS, Math.min(duration, candidate));
  }, [duration, hasDuration, loopRegion.end, safeStart]);

  const hasLoopRange = hasDuration && safeEnd > safeStart;
  const startPct = hasDuration ? (safeStart / duration) * 100 : 0;
  const endPct = hasDuration ? (safeEnd / duration) * 100 : 0;

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const secondsFromClientX = (clientX: number): number => {
    if (!hasDuration || !waveRef.current) return 0;
    const rect = waveRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  useEffect(() => {
    let canceled = false;

    if (!track?.audioBlob) {
      setPeaks(fallbackPeaks());
      return;
    }

    buildPeaksFromBlob(track.audioBlob)
      .then((nextPeaks) => {
        if (!canceled) setPeaks(nextPeaks);
      })
      .catch(() => {
        if (!canceled) setPeaks(fallbackPeaks());
      });

    return () => {
      canceled = true;
    };
  }, [track?.id, track?.audioBlob]);

  useEffect(() => {
    const drawTo = (canvas: HTMLCanvasElement | null, alpha = 1) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      const bars = peaks.length;
      const gap = 2;
      const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars);
      const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, `rgba(125, 224, 255, ${0.95 * alpha})`);
      grad.addColorStop(1, `rgba(255, 128, 200, ${0.9 * alpha})`);

      for (let i = 0; i < bars; i += 1) {
        const ratio = bars > 1 ? i / (bars - 1) : 0;
        const magnitude = peaks[i] ?? 0.3;
        const h = Math.max(4, magnitude * height * 0.98);
        const x = i * (barWidth + gap);
        const y = (height - h) / 2;

        const inLoop =
          loopRegion.active && hasLoopRange && ratio >= safeStart / duration && ratio <= safeEnd / duration;

        if (inLoop) ctx.fillStyle = `rgba(255, 214, 92, ${0.95 * alpha})`;
        else ctx.fillStyle = ratio <= progress ? grad : `rgba(120, 70, 180, ${0.55 * alpha})`;

        ctx.fillRect(x, y, barWidth, h);
      }

      const playheadX = progress * width;
      const glow = isPlaying ? 7 : 5;
      ctx.fillStyle = `rgba(255, 65, 186, ${0.42 * alpha})`;
      ctx.fillRect(playheadX - glow / 2, 0, glow, height);
      ctx.fillStyle = `rgba(255, 180, 235, ${0.95 * alpha})`;
      ctx.fillRect(playheadX - 1, 0, 2, height);
    };

    drawTo(canvasRef.current, 1);
    drawTo(decorCanvasRef.current, 0.42);
  }, [currentTime, duration, hasLoopRange, isPlaying, loopRegion.active, peaks, safeEnd, safeStart]);

  useEffect(() => {
    if (!draggingHandle) return;

    const onPointerMove = (event: PointerEvent) => {
      if (!hasDuration) return;
      event.preventDefault();
      const seconds = secondsFromClientX(event.clientX);
      if (draggingHandle === "start") onSetLoopRange(Math.min(seconds, safeEnd - MIN_LOOP_SECONDS), safeEnd, true);
      else onSetLoopRange(safeStart, Math.max(seconds, safeStart + MIN_LOOP_SECONDS), true);
    };

    const onPointerUp = () => setDraggingHandle(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingHandle, hasDuration, onSetLoopRange, safeEnd, safeStart]);

  return (
    <>
      <div
        ref={waveRef}
        className="pc-wave"
        onPointerDown={(event) => {
          if (!hasDuration || event.button !== 0) return;
          clearLongPressTimer();
          longPressTriggeredRef.current = false;
          longPressTimerRef.current = window.setTimeout(() => {
            const start = secondsFromClientX(event.clientX);
            const end = Math.min(duration, start + 5);
            onSetLoopRange(start, Math.max(start + MIN_LOOP_SECONDS, end), true);
            longPressTriggeredRef.current = true;
          }, LONG_PRESS_MS);
        }}
        onPointerUp={(event) => {
          clearLongPressTimer();
          if (!hasDuration) return;
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          onSeek(secondsFromClientX(event.clientX));
        }}
        onPointerCancel={clearLongPressTimer}
        onPointerLeave={clearLongPressTimer}
      >
        <canvas ref={canvasRef} className={`pc-wave__canvas ${track ? "is-ready" : "is-loading"}`} />
        <div className="pc-wave__loop-overlay" aria-hidden="true">
          <div className="pc-wave__loop-range" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }} />
          <button
            className="pc-wave__loop-handle is-start"
            style={{ left: `${startPct}%` }}
            aria-label="Loop start"
            onPointerDown={(event) => {
              event.stopPropagation();
              setDraggingHandle("start");
            }}
          />
          <button
            className="pc-wave__loop-handle is-end"
            style={{ left: `${endPct}%` }}
            aria-label="Loop end"
            onPointerDown={(event) => {
              event.stopPropagation();
              setDraggingHandle("end");
            }}
          />
        </div>
      </div>
      <div className="pc-wave__decor" aria-hidden="true">
        <canvas ref={decorCanvasRef} className={`pc-wave__canvas ${track ? "is-ready" : "is-loading"}`} />
      </div>
    </>
  );
}
