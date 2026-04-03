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
  onSetLoopRange: (
    start: number,
    end: number,
    active: boolean,
    options?: { persist?: boolean; editing?: boolean }
  ) => void;
  onLoopDragStart?: () => void;
  onLoopDragCommit?: (start: number) => void;
  enableAuraPulse?: boolean;
};

type Handle = "start" | "end";
type EditViewportMode = "fit" | "manual" | "locked";

const MIN_LOOP_SECONDS = 0.5;
const LOOP_VIEW_ZOOM_DELAY_MS = 420;
const LOOP_VIEW_BUFFER_RATIO = 0.18;
const LOOP_VIEW_MIN_BUFFER_SEC = 0.3;
const MAX_LOOP_VIEW_SCALE = 5.0;
const LOOP_VIEW_TINY_LOOP_THRESHOLD_SEC = 2.5;
const LOOP_VIEW_TINY_MIN_SPAN_SEC = 1.15;
const LOOP_VIEW_TINY_BUFFER_RATIO = 0.12;
const LOOP_VIEW_TINY_MIN_BUFFER_SEC = 0.14;
const DRAG_VIEW_BUFFER_RATIO = 0.42;
const DRAG_VIEW_MIN_BUFFER_SEC = 0.7;
const MAX_DRAG_VIEW_SCALE = 3.3;
const DRAG_VIEW_TINY_MIN_SPAN_SEC = 1.35;
const DRAG_VIEW_TINY_BUFFER_RATIO = 0.22;
const DRAG_VIEW_TINY_MIN_BUFFER_SEC = 0.18;
const DRAG_START_DEADZONE_PX = 10;
const MANUAL_ZOOM_FACTORS = [1, 0.86, 0.72, 0.58, 0.46, 0.34, 0.26, 0.18, 0.12] as const;
const MAX_MANUAL_ZOOM_LEVEL = MANUAL_ZOOM_FACTORS.length - 1;
const MIN_MANUAL_VIEW_SPAN_SEC = 0.9;
const LOOP_FIT_BUFFER_RATIO = 0.05;
export function WaveformLoop({
  track,
  currentTime,
  duration,
  isPlaying,
  loopRegion,
  onSeek,
  onSetLoopRange,
  onLoopDragStart,
  onLoopDragCommit,
  enableAuraPulse = true
}: Props) {
  const applyManualZoomToRange = (
    baseRange: { start: number; end: number },
    trackDuration: number,
    start: number,
    end: number,
    level: number
  ) => {
    if (level <= 0) return baseRange;
    const zoomFactor = MANUAL_ZOOM_FACTORS[Math.max(0, Math.min(MAX_MANUAL_ZOOM_LEVEL, level))] ?? 1;
    const baseSpan = Math.max(MIN_LOOP_SECONDS, baseRange.end - baseRange.start);
    const targetSpan = Math.max(MIN_MANUAL_VIEW_SPAN_SEC, baseSpan * zoomFactor);
    const center = (start + end) * 0.5;
    const nextStart = Math.max(0, Math.min(trackDuration - targetSpan, center - targetSpan * 0.5));
    const nextEnd = Math.min(trackDuration, nextStart + targetSpan);
    return {
      start: nextStart,
      end: Math.max(nextStart + MIN_LOOP_SECONDS, nextEnd)
    };
  };

  const centerRangeOnLoop = (
    trackDuration: number,
    start: number,
    end: number,
    targetSpan: number
  ) => {
    const span = Math.max(MIN_MANUAL_VIEW_SPAN_SEC, targetSpan);
    const center = (start + end) * 0.5;
    const nextStart = Math.max(0, Math.min(trackDuration - span, center - span * 0.5));
    const nextEnd = Math.min(trackDuration, nextStart + span);
    return {
      start: nextStart,
      end: Math.max(nextStart + MIN_LOOP_SECONDS, nextEnd)
    };
  };

  const keepLoopWithinViewRange = (
    range: { start: number; end: number },
    trackDuration: number,
    start: number,
    end: number
  ) => {
    const span = Math.max(MIN_MANUAL_VIEW_SPAN_SEC, range.end - range.start);
    const edgeBuffer = Math.max(0.14, span * 0.08);
    let nextStart = Math.max(0, Math.min(trackDuration - span, range.start));
    let nextEnd = Math.min(trackDuration, nextStart + span);
    if (start < nextStart + edgeBuffer) {
      nextStart = Math.max(0, Math.min(trackDuration - span, start - edgeBuffer));
      nextEnd = Math.min(trackDuration, nextStart + span);
    }
    if (end > nextEnd - edgeBuffer) {
      nextEnd = Math.min(trackDuration, Math.max(span, end + edgeBuffer));
      nextStart = Math.max(0, nextEnd - span);
    }
    return {
      start: nextStart,
      end: Math.max(nextStart + MIN_LOOP_SECONDS, nextEnd)
    };
  };

  const buildWindowedViewRange = (
    trackDuration: number,
    start: number,
    end: number,
    options?: {
      bufferRatio?: number;
      minBufferSec?: number;
      maxScale?: number;
      tinyLoopMinSpanSec?: number;
      tinyLoopBufferRatio?: number;
      tinyLoopMinBufferSec?: number;
    }
  ) => {
    const loopSpan = end - start;
    const isTinyLoop = loopSpan <= LOOP_VIEW_TINY_LOOP_THRESHOLD_SEC;
    const bufferRatio = isTinyLoop
      ? options?.tinyLoopBufferRatio ?? options?.bufferRatio ?? LOOP_VIEW_TINY_BUFFER_RATIO
      : options?.bufferRatio ?? LOOP_VIEW_BUFFER_RATIO;
    const minBufferSec = isTinyLoop
      ? options?.tinyLoopMinBufferSec ?? options?.minBufferSec ?? LOOP_VIEW_TINY_MIN_BUFFER_SEC
      : options?.minBufferSec ?? LOOP_VIEW_MIN_BUFFER_SEC;
    const buffer = Math.max(minBufferSec, loopSpan * bufferRatio);
    const desiredSpan = loopSpan + buffer * 2;
    const maxScale = options?.maxScale ?? MAX_LOOP_VIEW_SCALE;
    const fallbackMinSpan = loopSpan + buffer * 2;
    const tinyLoopMinSpan = options?.tinyLoopMinSpanSec ?? LOOP_VIEW_TINY_MIN_SPAN_SEC;
    const minimumReadableSpan = isTinyLoop
      ? Math.max(fallbackMinSpan, tinyLoopMinSpan)
      : Math.max(fallbackMinSpan, trackDuration / maxScale);
    const targetSpan = Math.max(desiredSpan, minimumReadableSpan);
    const center = (start + end) * 0.5;
    const nextStart = Math.max(0, Math.min(trackDuration - targetSpan, center - targetSpan * 0.5));
    const nextEnd = Math.min(trackDuration, nextStart + targetSpan);
    return {
      start: nextStart,
      end: Math.max(nextStart + MIN_LOOP_SECONDS, nextEnd)
    };
  };

  const waveRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragSnapshotRef = useRef<{ start: number; end: number } | null>(null);
  const dragViewSpanRef = useRef<number | null>(null);
  const zoomTimerRef = useRef<number | null>(null);
  const committedLoopDragRef = useRef(false);
  const prevCommittedLoopRef = useRef<{ start: number; end: number; active: boolean } | null>(null);
  const suppressSeekOnPointerUpRef = useRef(false);
  const pendingDragRef = useRef<{ handle: Handle; clientX: number; clientY: number } | null>(null);
  const dragPointerRangeRef = useRef<{ start: number; end: number } | null>(null);
  const prevEditingRef = useRef(loopRegion.editing);

  const [peaks, setPeaks] = useState<number[]>(() => fallbackPeaks());
  const [pendingHandle, setPendingHandle] = useState<Handle | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<Handle | null>(null);
  const [hasAdjustedLoop, setHasAdjustedLoop] = useState(false);
  const [manualZoomLevel, setManualZoomLevel] = useState(0);
  const [hasUnlockedManualZoom, setHasUnlockedManualZoom] = useState(false);
  const [showManualZoomControls, setShowManualZoomControls] = useState(false);
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [draftLoopRange, setDraftLoopRange] = useState<{ start: number; end: number } | null>(null);
  const [editViewportMode, setEditViewportMode] = useState<EditViewportMode>("fit");
  const [shouldPreserveViewRange, setShouldPreserveViewRange] = useState(false);
  const lockedViewRangeRef = useRef<{ start: number; end: number } | null>(null);
  const editingViewRangeRef = useRef<{ start: number; end: number } | null>(null);
  const isLightTheme =
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";

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
  const displayStart = loopRegion.editing && draftLoopRange ? draftLoopRange.start : safeStart;
  const displayEnd = loopRegion.editing && draftLoopRange ? draftLoopRange.end : safeEnd;
  const hasDisplayLoopRange = hasDuration && displayEnd > displayStart;
  const safeViewRange = hasDuration && viewRange.end > viewRange.start ? viewRange : { start: 0, end: duration || 0 };
  const viewSpan = Math.max(MIN_LOOP_SECONDS, safeViewRange.end - safeViewRange.start);
  const rawStartPct = hasDuration ? ((displayStart - safeViewRange.start) / viewSpan) * 100 : 0;
  const rawEndPct = hasDuration ? ((displayEnd - safeViewRange.start) / viewSpan) * 100 : 0;
  const startPct = Math.max(0, Math.min(100, rawStartPct));
  const endPct = Math.max(startPct, Math.min(100, rawEndPct));
  const rangeWidthPct = Math.max(0, endPct - startPct);
  const waveClasses = ["pc-wave"];
  if (loopRegion.active && hasLoopRange) waveClasses.push("is-loop-active");
  if (loopRegion.editing) waveClasses.push("is-loop-editing");
  if (viewSpan < (duration || 0) - MIN_LOOP_SECONDS) waveClasses.push("is-loop-zoomed");

  const secondsFromClientX = (clientX: number): number => {
    if (!hasDuration || !waveRef.current) return 0;
    const rect = waveRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return safeViewRange.start + ratio * viewSpan;
  };

  const secondsFromClientXInRange = (clientX: number, range: { start: number; end: number }): number => {
    if (!hasDuration || !waveRef.current) return 0;
    const rect = waveRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const span = Math.max(MIN_LOOP_SECONDS, range.end - range.start);
    return range.start + ratio * span;
  };

  const toggleManualZoomControls = () => {
    setShowManualZoomControls((prev) => {
      return !prev;
    });
  };

  const canZoomOut =
    hasDuration &&
    loopRegion.active &&
    loopRegion.editing &&
    viewRange.end > viewRange.start &&
    viewRange.end - viewRange.start < duration - 0.0001;

  const adjustManualZoomLevel = (direction: -1 | 1) => {
    setManualZoomLevel((prev) => {
      const nextLevel = Math.max(0, Math.min(MAX_MANUAL_ZOOM_LEVEL, prev + direction));
      if (hasDuration && loopRegion.active && hasLoopRange && loopRegion.editing && viewRange.end > viewRange.start) {
        const currentSpan = Math.max(MIN_LOOP_SECONDS, viewRange.end - viewRange.start);
        let nextRange: { start: number; end: number } | null = null;
        if (nextLevel !== prev) {
          const currentFactor = MANUAL_ZOOM_FACTORS[Math.max(0, Math.min(MAX_MANUAL_ZOOM_LEVEL, prev))] ?? 1;
          const nextFactor = MANUAL_ZOOM_FACTORS[nextLevel] ?? 1;
          const nextSpan = Math.max(MIN_MANUAL_VIEW_SPAN_SEC, currentSpan * (nextFactor / currentFactor));
          nextRange = centerRangeOnLoop(duration, displayStart, displayEnd, nextSpan);
        } else if (direction < 0 && currentSpan < duration - 0.0001) {
          const baseOutFactor = MANUAL_ZOOM_FACTORS[1] ?? 0.86;
          const nextSpan = Math.min(duration, currentSpan / baseOutFactor);
          nextRange = centerRangeOnLoop(duration, displayStart, displayEnd, nextSpan);
        }
        if (nextRange) {
          setEditViewportMode("manual");
          editingViewRangeRef.current = nextRange;
          setViewRange(nextRange);
        } else {
          return prev;
        }
      }
      return nextLevel;
    });
  };

  const fitLoopToView = () => {
    if (!hasDuration || !loopRegion.active || !hasDisplayLoopRange || !loopRegion.editing) return;
    const loopSpan = Math.max(MIN_LOOP_SECONDS, displayEnd - displayStart);
    const fittedSpan = Math.max(MIN_MANUAL_VIEW_SPAN_SEC, loopSpan * (1 + LOOP_FIT_BUFFER_RATIO * 2));
    const nextRange = centerRangeOnLoop(duration, displayStart, displayEnd, fittedSpan);
    setEditViewportMode("fit");
    editingViewRangeRef.current = nextRange;
    setManualZoomLevel(0);
    setViewRange(nextRange);
  };

  const buildEditingFocusRange = () =>
    buildWindowedViewRange(duration, displayStart, displayEnd, {
      bufferRatio: DRAG_VIEW_BUFFER_RATIO,
      minBufferSec: DRAG_VIEW_MIN_BUFFER_SEC,
      maxScale: MAX_DRAG_VIEW_SCALE,
      tinyLoopMinSpanSec: DRAG_VIEW_TINY_MIN_SPAN_SEC,
      tinyLoopBufferRatio: DRAG_VIEW_TINY_BUFFER_RATIO,
      tinyLoopMinBufferSec: DRAG_VIEW_TINY_MIN_BUFFER_SEC
    });

  useEffect(() => {
    if (!loopRegion.editing || !hasLoopRange) {
      setDraftLoopRange(null);
      return;
    }
    if (draggingHandle || pendingHandle) return;
    setDraftLoopRange((prev) => {
      if (
        prev &&
        Math.abs(prev.start - safeStart) <= 0.0001 &&
        Math.abs(prev.end - safeEnd) <= 0.0001
      ) {
        return prev;
      }
      return { start: safeStart, end: safeEnd };
    });
  }, [draggingHandle, hasLoopRange, loopRegion.editing, pendingHandle, safeEnd, safeStart]);

  useEffect(() => {
    if (!track?.id) {
      setHasAdjustedLoop(false);
      setManualZoomLevel(0);
      setEditViewportMode("fit");
      setHasUnlockedManualZoom(false);
      dragViewSpanRef.current = null;
      committedLoopDragRef.current = false;
      prevCommittedLoopRef.current = null;
      return;
    }
    const prev = prevCommittedLoopRef.current;
    const nextSnapshot = { start: safeStart, end: safeEnd, active: loopRegion.active };
    prevCommittedLoopRef.current = nextSnapshot;
    if (!prev) return;
    const changed =
      prev.active !== loopRegion.active ||
      Math.abs(prev.start - safeStart) > 0.0001 ||
      Math.abs(prev.end - safeEnd) > 0.0001;
    if (!changed) return;
    if (committedLoopDragRef.current) {
      committedLoopDragRef.current = false;
      return;
    }
    setHasAdjustedLoop(false);
  }, [loopRegion.active, safeEnd, safeStart, track?.id]);

  useEffect(() => {
    if (
      shouldPreserveViewRange &&
      !loopRegion.editing &&
      loopRegion.active &&
      hasLoopRange &&
      lockedViewRangeRef.current
    ) {
      const { start, end } = lockedViewRangeRef.current;
      if (Math.abs(start - viewRange.start) > 0.0001 || Math.abs(end - viewRange.end) > 0.0001) {
        setViewRange({ start, end });
      }
      return;
    }
    if (!hasDuration) {
      setViewRange({ start: 0, end: 0 });
      return;
    }
    if (loopRegion.editing && draggingHandle && editingViewRangeRef.current) {
      const lockedDragRange = editingViewRangeRef.current;
      if (
        Math.abs(lockedDragRange.start - viewRange.start) > 0.0001 ||
        Math.abs(lockedDragRange.end - viewRange.end) > 0.0001
      ) {
        setViewRange(lockedDragRange);
      }
      return;
    }
    if (loopRegion.editing && loopRegion.active && hasDisplayLoopRange) {
      const baseEditingRange =
        editViewportMode === "fit"
          ? editingViewRangeRef.current ?? buildEditingFocusRange()
          : editingViewRangeRef.current ?? { start: viewRange.start, end: viewRange.end };
      const nextEditingRange =
        editViewportMode === "locked"
          ? baseEditingRange
          : keepLoopWithinViewRange(baseEditingRange, duration, displayStart, displayEnd);
      editingViewRangeRef.current = nextEditingRange;
      if (
        Math.abs(nextEditingRange.start - viewRange.start) > 0.0001 ||
        Math.abs(nextEditingRange.end - viewRange.end) > 0.0001
      ) {
        setViewRange(nextEditingRange);
      }
      return;
    }
    if (zoomTimerRef.current !== null) {
      window.clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = null;
    }
    if (!loopRegion.active || !hasLoopRange || !hasAdjustedLoop) {
      if (!loopRegion.active || !hasLoopRange) {
        setManualZoomLevel(0);
        dragViewSpanRef.current = null;
      }
      setViewRange({ start: 0, end: duration });
      return;
    }
    zoomTimerRef.current = window.setTimeout(() => {
      const baseRange = buildWindowedViewRange(duration, displayStart, displayEnd);
      setViewRange(applyManualZoomToRange(baseRange, duration, displayStart, displayEnd, manualZoomLevel));
      zoomTimerRef.current = null;
    }, LOOP_VIEW_ZOOM_DELAY_MS);
    return () => {
      if (zoomTimerRef.current !== null) {
        window.clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = null;
      }
    };
  }, [
    draggingHandle,
    duration,
    editViewportMode,
    hasAdjustedLoop,
    hasDuration,
    hasDisplayLoopRange,
    loopRegion.active,
    loopRegion.editing,
    manualZoomLevel,
    displayEnd,
    displayStart,
    shouldPreserveViewRange,
    viewRange.end,
    viewRange.start
  ]);

  useEffect(() => {
    if (loopRegion.editing) {
      const loopSpan = Math.max(MIN_LOOP_SECONDS, displayEnd - displayStart);
      const currentSpan = viewRange.end > viewRange.start ? viewRange.end - viewRange.start : 0;
      const shouldRefocusEditingRange =
        !editingViewRangeRef.current ||
        currentSpan <= 0 ||
        currentSpan > Math.max(loopSpan * 5, MIN_MANUAL_VIEW_SPAN_SEC * 2.5);
      const nextEditingRange = shouldRefocusEditingRange
        ? buildEditingFocusRange()
        : keepLoopWithinViewRange(
            editingViewRangeRef.current ?? { start: viewRange.start, end: viewRange.end },
            duration,
            displayStart,
            displayEnd
          );
      if (!prevEditingRef.current) {
        setEditViewportMode("fit");
      }
      lockedViewRangeRef.current = nextEditingRange;
      editingViewRangeRef.current = nextEditingRange;
      if (
        Math.abs(nextEditingRange.start - viewRange.start) > 0.0001 ||
        Math.abs(nextEditingRange.end - viewRange.end) > 0.0001
      ) {
        setViewRange(nextEditingRange);
      }
      setShouldPreserveViewRange(false);
    } else if (
      prevEditingRef.current &&
      !loopRegion.editing &&
      loopRegion.active &&
      hasLoopRange &&
      lockedViewRangeRef.current
    ) {
      setShouldPreserveViewRange(true);
    }
    prevEditingRef.current = loopRegion.editing;
  }, [displayEnd, displayStart, duration, hasDisplayLoopRange, loopRegion.editing, loopRegion.active, viewRange.start, viewRange.end]);

  useEffect(() => {
    if (!loopRegion.active) {
      setShouldPreserveViewRange(false);
      lockedViewRangeRef.current = null;
      editingViewRangeRef.current = null;
      setEditViewportMode("fit");
      setHasUnlockedManualZoom(false);
      setDraftLoopRange(null);
    }
  }, [loopRegion.active]);

  useEffect(() => {
    if (!loopRegion.editing) {
      setShowManualZoomControls(false);
      setHasUnlockedManualZoom(false);
      setEditViewportMode("fit");
      editingViewRangeRef.current = null;
      dragPointerRangeRef.current = null;
      dragSnapshotRef.current = null;
    }
  }, [loopRegion.editing]);

  useEffect(() => {
    let canceled = false;

    if (track?.waveformPeaks?.length) {
      setPeaks(track.waveformPeaks);
      return;
    }

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
  }, [track?.id, track?.audioBlob, track?.waveformPeaks]);

  useEffect(() => {
    const canvas = canvasRef.current;
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
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < bars; i += 1) {
      const centerRatio = Math.max(0, Math.min(1, (i + 0.5) / Math.max(1, bars)));
      const sampleTime = safeViewRange.start + centerRatio * viewSpan;
      const peakRatio = duration > 0 ? sampleTime / duration : 0;
      const peakIndex = peaks.length > 1 ? Math.round(peakRatio * (peaks.length - 1)) : 0;
      const magnitude = peaks[peakIndex] ?? 0.3;
      const h = Math.max(4, magnitude * height * 0.98);
      const x = i * (barWidth + gap);
      const y = (height - h) / 2;
      const inLoop = loopRegion.active && hasDisplayLoopRange && sampleTime >= displayStart && sampleTime <= displayEnd;

      ctx.fillStyle = inLoop
        ? isLightTheme
          ? "rgba(232, 181, 86, 0.98)"
          : "rgba(255, 214, 92, 0.95)"
        : isLightTheme
          ? "rgba(141, 101, 124, 0.4)"
          : "rgba(120, 70, 180, 0.55)";

      ctx.fillRect(x, y, barWidth, h);
    }
  }, [displayEnd, displayStart, duration, hasDisplayLoopRange, isLightTheme, loopRegion.active, peaks, safeViewRange.start, viewSpan]);

  useEffect(() => {
    const canvas = decorCanvasRef.current;
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
    const visibleProgress = viewSpan > 0 ? Math.max(0, Math.min(1, (currentTime - safeViewRange.start) / viewSpan)) : 0;
    ctx.clearRect(0, 0, width, height);

    const progressGrad = ctx.createLinearGradient(0, 0, width, 0);
    if (isLightTheme) {
      progressGrad.addColorStop(0, "rgba(162, 98, 128, 0.92)");
      progressGrad.addColorStop(1, "rgba(207, 111, 130, 0.94)");
    } else {
      progressGrad.addColorStop(0, "rgba(125, 224, 255, 0.95)");
      progressGrad.addColorStop(1, "rgba(255, 128, 200, 0.9)");
    }

    const loopGrad = ctx.createLinearGradient(0, 0, width, 0);
    if (isLightTheme) {
      loopGrad.addColorStop(0, "rgba(236, 196, 120, 0.98)");
      loopGrad.addColorStop(1, "rgba(214, 156, 70, 0.96)");
    } else {
      loopGrad.addColorStop(0, "rgba(255, 230, 150, 0.98)");
      loopGrad.addColorStop(1, "rgba(255, 196, 76, 0.94)");
    }

    for (let i = 0; i < bars; i += 1) {
      const centerRatio = Math.max(0, Math.min(1, (i + 0.5) / Math.max(1, bars)));
      const sampleTime = safeViewRange.start + centerRatio * viewSpan;
      const peakRatio = duration > 0 ? sampleTime / duration : 0;
      const peakIndex = peaks.length > 1 ? Math.round(peakRatio * (peaks.length - 1)) : 0;
      const magnitude = peaks[peakIndex] ?? 0.3;
      const h = Math.max(4, magnitude * height * 0.98);
      const x = i * (barWidth + gap);
      if (centerRatio > visibleProgress) continue;
      const y = (height - h) / 2;
      const inLoop = loopRegion.active && hasDisplayLoopRange && sampleTime >= displayStart && sampleTime <= displayEnd;
      ctx.fillStyle = inLoop ? loopGrad : progressGrad;
      ctx.fillRect(x, y, barWidth, h);
    }

    const playheadX = visibleProgress * width;
    const glow = isPlaying ? 7 : 5;
    ctx.fillStyle = isLightTheme
      ? "rgba(207, 111, 130, 0.28)"
      : "rgba(255, 65, 186, 0.42)";
    ctx.fillRect(playheadX - glow / 2, 0, glow, height);
    ctx.fillStyle = isLightTheme
      ? "rgba(91, 46, 68, 0.9)"
      : "rgba(255, 180, 235, 0.95)";
    ctx.fillRect(playheadX - 1, 0, 2, height);
  }, [
    currentTime,
    duration,
    hasDisplayLoopRange,
    isLightTheme,
    isPlaying,
    loopRegion.active,
    peaks,
    displayEnd,
    displayStart,
    safeViewRange.start,
    viewSpan
  ]);

  useEffect(() => {
    if (!pendingHandle && !draggingHandle) return;

    const onPointerMove = (event: PointerEvent) => {
      if (!hasDuration) return;
      event.preventDefault();
      let activeHandle = draggingHandle;
      if (!activeHandle && pendingHandle) {
        const pending = pendingDragRef.current;
        if (!pending) return;
        const dx = event.clientX - pending.clientX;
        const dy = event.clientY - pending.clientY;
        if (Math.hypot(dx, dy) < DRAG_START_DEADZONE_PX) return;
        activeHandle = pending.handle;
        dragSnapshotRef.current = { start: displayStart, end: displayEnd };
        const fallbackDragRange = buildWindowedViewRange(duration, displayStart, displayEnd);
        const nextEditingRange =
          viewRange.end > viewRange.start ? { start: viewRange.start, end: viewRange.end } : fallbackDragRange;
        editingViewRangeRef.current = nextEditingRange;
        dragPointerRangeRef.current = nextEditingRange;
        dragViewSpanRef.current = Math.max(MIN_LOOP_SECONDS, nextEditingRange.end - nextEditingRange.start);
        pendingDragRef.current = null;
        setPendingHandle(null);
        setDraggingHandle(activeHandle);
        setEditViewportMode("locked");
        setHasUnlockedManualZoom(true);
        setShowManualZoomControls(true);
        onLoopDragStart?.();
      }
      if (!activeHandle) return;
      const dragRange = dragPointerRangeRef.current ?? editingViewRangeRef.current ?? safeViewRange;
      const seconds = secondsFromClientXInRange(event.clientX, dragRange);
      const snapshot = dragSnapshotRef.current ?? { start: displayStart, end: displayEnd };
      if (activeHandle === "start") {
        const nextStart = Math.min(seconds, snapshot.end - MIN_LOOP_SECONDS);
        const nextDraft = { start: nextStart, end: snapshot.end };
        dragSnapshotRef.current = nextDraft;
        setDraftLoopRange(nextDraft);
      } else {
        const nextEnd = Math.max(seconds, snapshot.start + MIN_LOOP_SECONDS);
        const nextDraft = { start: snapshot.start, end: nextEnd };
        dragSnapshotRef.current = nextDraft;
        setDraftLoopRange(nextDraft);
      }
    };

    const onPointerUp = () => {
      if (pendingDragRef.current) {
        pendingDragRef.current = null;
        setPendingHandle(null);
      }
      const snapshot = dragSnapshotRef.current;
      if (snapshot) {
        committedLoopDragRef.current = true;
        setHasAdjustedLoop(true);
        setDraftLoopRange(snapshot);
        onSetLoopRange(snapshot.start, snapshot.end, true, { persist: true, editing: true });
        onLoopDragCommit?.(snapshot.start);
      }
      dragSnapshotRef.current = null;
      dragPointerRangeRef.current = null;
      dragViewSpanRef.current = null;
      setEditViewportMode("manual");
      setDraggingHandle(null);
      window.requestAnimationFrame(() => {
        suppressSeekOnPointerUpRef.current = false;
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [displayEnd, displayStart, draggingHandle, hasDuration, onLoopDragCommit, onLoopDragStart, onSetLoopRange, pendingHandle, safeEnd, safeStart]);

  useEffect(() => {
    if (!enableAuraPulse) return;
    const onAuraTrigger = () => {
      const wave = waveRef.current;
      if (!wave) return;
      wave.classList.remove("is-aura-pulse");
      void wave.offsetWidth;
      wave.classList.add("is-aura-pulse");
    };
    window.addEventListener("polyplay:aura-trigger", onAuraTrigger);
    return () => window.removeEventListener("polyplay:aura-trigger", onAuraTrigger);
  }, [enableAuraPulse]);

  useEffect(() => {
    if (!pendingHandle && !draggingHandle) return;
    const root = document.documentElement;
    const body = document.body;
    const prevRootUserSelect = root.style.userSelect;
    const prevBodyUserSelect = body.style.userSelect;
    const prevRootWebkitUserSelect = root.style.webkitUserSelect;
    const prevBodyWebkitUserSelect = body.style.webkitUserSelect;

    root.style.userSelect = "none";
    body.style.userSelect = "none";
    root.style.webkitUserSelect = "none";
    body.style.webkitUserSelect = "none";

    return () => {
      root.style.userSelect = prevRootUserSelect;
      body.style.userSelect = prevBodyUserSelect;
      root.style.webkitUserSelect = prevRootWebkitUserSelect;
      body.style.webkitUserSelect = prevBodyWebkitUserSelect;
    };
  }, [draggingHandle, pendingHandle]);

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
          if (draggingHandle || dragSnapshotRef.current || suppressSeekOnPointerUpRef.current) return;
          onSeek(secondsFromClientX(event.clientX));
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="pc-wave__viewport">
          <canvas ref={canvasRef} className={`pc-wave__canvas ${track ? "is-ready" : "is-loading"}`} />
          <div className="pc-wave__decor" aria-hidden="true">
            <canvas ref={decorCanvasRef} className={`pc-wave__canvas ${track ? "is-ready" : "is-loading"}`} />
          </div>
        </div>
        <div className="pc-wave__loop-overlay" aria-hidden="true">
          <div className="pc-wave__loop-view-window">
            <div className="pc-wave__loop-range" style={{ left: `${startPct}%`, width: `${rangeWidthPct}%` }} />
            {loopRegion.editing && (
              <>
                <div className="pc-wave__loop-marker is-start" style={{ left: `${startPct}%` }} />
                <div className="pc-wave__loop-marker is-end" style={{ left: `${endPct}%` }} />
                <button
                  className="pc-wave__loop-handle is-start"
                  style={{ left: `${startPct}%` }}
                  aria-label="Loop start"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    suppressSeekOnPointerUpRef.current = true;
                    pendingDragRef.current = { handle: "start", clientX: event.clientX, clientY: event.clientY };
                    setPendingHandle("start");
                  }}
                />
                <button
                  className="pc-wave__loop-handle is-end"
                  style={{ left: `${endPct}%` }}
                  aria-label="Loop end"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    suppressSeekOnPointerUpRef.current = true;
                    pendingDragRef.current = { handle: "end", clientX: event.clientX, clientY: event.clientY };
                    setPendingHandle("end");
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
      {loopRegion.active && hasLoopRange && loopRegion.editing && hasUnlockedManualZoom && (
        <div className="pc-wave-toolbar" aria-label="Loop zoom controls">
          <button
            type="button"
            className={`pc-wave-toolbar__toggle ${showManualZoomControls ? "is-active" : ""}`.trim()}
            aria-label={showManualZoomControls ? "Hide zoom controls" : "Show zoom controls"}
            aria-pressed={showManualZoomControls}
            onClick={toggleManualZoomControls}
          >
            <span className="pc-wave-toolbar__glass" aria-hidden="true">
              ⌕
            </span>
          </button>
          <button
            type="button"
            className="pc-wave-toolbar__fit"
            aria-label="Zoom to fit active loop"
            onClick={fitLoopToView}
          >
            Fit
          </button>
          <div className={`pc-wave-toolbar__controls ${showManualZoomControls ? "is-open" : ""}`.trim()}>
            <span className="pc-wave-toolbar__label">Loop Zoom</span>
            <button
              type="button"
              className="pc-wave-toolbar__btn"
              aria-label="Zoom out loop editor"
              onClick={() => adjustManualZoomLevel(-1)}
              disabled={!canZoomOut}
            >
              -
            </button>
            <button
              type="button"
              className="pc-wave-toolbar__btn"
              aria-label="Zoom in loop editor"
              onClick={() => adjustManualZoomLevel(1)}
              disabled={manualZoomLevel >= MAX_MANUAL_ZOOM_LEVEL}
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  );
}
