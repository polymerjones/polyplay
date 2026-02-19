import { useEffect, useMemo, useRef, useState } from "react";
import { buildPeaksFromAudioBlob, fallbackPeaks } from "../lib/artwork/waveformArtwork";
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

const MIN_LOOP_SECONDS = 0.1;

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
  const waveClasses = ["pc-wave"];
  if (loopRegion.active && hasLoopRange) waveClasses.push("is-loop-active");
  if (loopRegion.editing) waveClasses.push("is-loop-editing");

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

    buildPeaksFromAudioBlob(track.audioBlob)
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
      const minBarWidth = 1.2;
      const gap = 1.2;
      const maxBarsByWidth = Math.max(24, Math.floor((width + gap) / (minBarWidth + gap)));
      const bars = Math.max(1, Math.min(peaks.length, maxBarsByWidth));
      const barWidth = Math.max(0.8, (width - gap * (bars - 1)) / bars);
      const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
      const loopStartRatio = duration > 0 ? safeStart / duration : 0;
      const loopEndRatio = duration > 0 ? safeEnd / duration : 0;
      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, `rgba(125, 224, 255, ${0.95 * alpha})`);
      grad.addColorStop(1, `rgba(255, 128, 200, ${0.9 * alpha})`);

      for (let i = 0; i < bars; i += 1) {
        const peakIndex = bars > 1 ? Math.round((i / (bars - 1)) * (peaks.length - 1)) : 0;
        const magnitude = peaks[peakIndex] ?? 0.3;
        const h = Math.max(4, magnitude * height * 0.98);
        const x = i * (barWidth + gap);
        const centerRatio = Math.max(0, Math.min(1, (x + barWidth * 0.5) / Math.max(1, width)));
        const y = (height - h) / 2;

        const inLoop = loopRegion.active && hasLoopRange && centerRatio >= loopStartRatio && centerRatio <= loopEndRatio;

        if (inLoop) ctx.fillStyle = `rgba(255, 214, 92, ${0.95 * alpha})`;
        else ctx.fillStyle = centerRatio <= progress ? grad : `rgba(120, 70, 180, ${0.55 * alpha})`;

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

  useEffect(() => {
    const onAuraTrigger = () => {
      const wave = waveRef.current;
      if (!wave) return;
      wave.classList.remove("is-aura-pulse");
      void wave.offsetWidth;
      wave.classList.add("is-aura-pulse");
    };
    window.addEventListener("polyplay:aura-trigger", onAuraTrigger);
    return () => window.removeEventListener("polyplay:aura-trigger", onAuraTrigger);
  }, []);

  return (
    <>
      <div
        ref={waveRef}
        className={waveClasses.join(" ")}
        onPointerDown={(event) => {
          if (!hasDuration || event.button !== 0) return;
          event.preventDefault();
        }}
        onPointerUp={(event) => {
          if (!hasDuration) return;
          onSeek(secondsFromClientX(event.clientX));
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas ref={canvasRef} className={`pc-wave__canvas ${track ? "is-ready" : "is-loading"}`} />
        <div className="pc-wave__loop-overlay" aria-hidden="true">
          <div className="pc-wave__loop-range" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }} />
          <button
            className="pc-wave__loop-handle is-start"
            style={{ left: `${startPct}%` }}
            aria-label="Loop start"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDraggingHandle("start");
            }}
          />
          <button
            className="pc-wave__loop-handle is-end"
            style={{ left: `${endPct}%` }}
            aria-label="Loop end"
            onPointerDown={(event) => {
              event.preventDefault();
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
