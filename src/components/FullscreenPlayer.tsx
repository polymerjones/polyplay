import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import { buildPeaksFromAudioBlob, fallbackPeaks } from "../lib/artwork/waveformArtwork";
import { fireLightHaptic } from "../lib/haptics";
import { formatTime } from "../lib/time";
import type { LoopMode, LoopRegion, RepeatTrackMode, Track } from "../types";
import { PlayerControls } from "./PlayerControls";
import { WaveformLoop } from "./WaveformLoop";

type Props = {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loopRegion: LoopRegion;
  loopMode: LoopMode;
  dimMode: "normal" | "dim" | "mute";
  dimControlSkipsSoftDim?: boolean;
  noveltyMode: "normal" | "dim" | "mute";
  onClose: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  shuffleEnabled: boolean;
  repeatTrackMode: RepeatTrackMode;
  threepeatDisplayCount: number;
  repeatFlashTick: number;
  onToggleShuffle: () => void;
  onToggleRepeatTrack: () => void;
  onCycleDimMode: () => void;
  onCycleNoveltyMode: () => void;
  onVinylScratch: () => void;
  onSetLoopRange: (
    start: number,
    end: number,
    active: boolean,
    options?: { persist?: boolean; editing?: boolean }
  ) => void;
  onLoopDragStart?: () => void;
  onLoopDragCommit?: (start: number) => void;
  onSetLoop: () => void;
  onToggleLoopMode: () => void;
  onClearLoop: () => void;
  onBeginLoopAdjustment: () => void;
  onFinishLoopAdjustment: () => void;
  canCropAudio?: boolean;
  onOpenCropAudioPrompt?: () => void;
  onAuraUp: () => void;
  onSkip: (delta: number) => void;
};

export function FullscreenPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  loopRegion,
  loopMode,
  dimMode,
  dimControlSkipsSoftDim = false,
  noveltyMode,
  onClose,
  onPrev,
  onPlayPause,
  onNext,
  onSeek,
  shuffleEnabled,
  repeatTrackMode,
  threepeatDisplayCount,
  repeatFlashTick,
  onToggleShuffle,
  onToggleRepeatTrack,
  onCycleDimMode,
  onCycleNoveltyMode,
  onVinylScratch,
  onSetLoopRange,
  onLoopDragStart,
  onLoopDragCommit,
  onSetLoop,
  onToggleLoopMode,
  onClearLoop,
  onBeginLoopAdjustment,
  onFinishLoopAdjustment,
  canCropAudio = false,
  onOpenCropAudioPrompt,
  onAuraUp,
  onSkip
}: Props) {
  const FULLSCREEN_AURA_FLASH_COOLDOWN_MS = 220;
  const FULLSCREEN_SWIPE_CLOSE_DISTANCE_PX = 140;
  const CINEMA_EXIT_SWIPE_DISTANCE_PX = 96;
  const FULLSCREEN_SWIPE_CLOSE_MAX_SIDEWAYS_PX = 72;
  const FULLSCREEN_SWIPE_CLOSE_MIN_VELOCITY = 0.42;
  const CINEMA_OUTSIDE_DOUBLE_TAP_MS = 320;
  const LOOP_GESTURE_SUPPRESS_MS = 260;
  const artRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const artworkVideoRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const lastAuraFlashAtRef = useRef(0);
  const swipeStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastCinemaOutsideTapAtRef = useRef(0);
  const loopGestureActiveRef = useRef(false);
  const loopGestureSuppressUntilRef = useRef(0);
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || `url('${DEFAULT_ARTWORK_URL}')` } as CSSProperties);
  const cinemaStillSrc = track.artUrl || DEFAULT_ARTWORK_URL;
  const hasArtworkVideo = Boolean(track.artVideoUrl);
  const shouldAnimateGenerated = track.artworkSource === "auto" && !hasArtworkVideo;
  const showLoopEditor = loopMode === "region" && loopRegion.active;
  const [peaks, setPeaks] = useState<number[]>(() => fallbackPeaks(120));
  const [isArtworkVideoReady, setIsArtworkVideoReady] = useState(false);
  const [isCinemaMode, setIsCinemaMode] = useState(false);

  useEffect(() => {
    setIsArtworkVideoReady(false);
    setIsCinemaMode(false);
  }, [track.artVideoUrl, track.id]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const currentVideo = artworkVideoRef.current;
    if (!currentVideo) return;
    const markReady = () => setIsArtworkVideoReady(true);
    if (currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setIsArtworkVideoReady(true);
    }
    const prev = (window as Window & { __polyplayActiveArtworkVideo?: HTMLVideoElement | null })
      .__polyplayActiveArtworkVideo;
    if (prev && prev !== currentVideo) {
      try {
        prev.pause();
      } catch {}
    }
    (window as Window & { __polyplayActiveArtworkVideo?: HTMLVideoElement | null }).__polyplayActiveArtworkVideo =
      currentVideo;

    const onVisibilityChange = () => {
      if (document.hidden) {
        currentVideo.pause();
        return;
      }
      if (!isPlayingRef.current) return;
      void currentVideo.play().catch(() => undefined);
    };
    currentVideo.addEventListener("loadeddata", markReady);
    currentVideo.addEventListener("canplay", markReady);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      currentVideo.removeEventListener("loadeddata", markReady);
      currentVideo.removeEventListener("canplay", markReady);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      try {
        currentVideo.pause();
      } catch {}
      const active = (window as Window & { __polyplayActiveArtworkVideo?: HTMLVideoElement | null })
        .__polyplayActiveArtworkVideo;
      if (active === currentVideo) {
        (window as Window & { __polyplayActiveArtworkVideo?: HTMLVideoElement | null }).__polyplayActiveArtworkVideo =
          null;
      }
    };
  }, [track.artVideoUrl]);

  useEffect(() => {
    const currentVideo = artworkVideoRef.current;
    if (!currentVideo) return;
    if (document.hidden || !isPlaying) {
      currentVideo.pause();
      return;
    }
    void currentVideo.play().catch(() => undefined);
  }, [isPlaying, track.artVideoUrl]);

  useEffect(() => {
    let canceled = false;
    if (!shouldAnimateGenerated || !track.audioBlob) {
      setPeaks(fallbackPeaks(120));
      return;
    }
    buildPeaksFromAudioBlob(track.audioBlob, 120)
      .then((next) => {
        if (!canceled) setPeaks(next);
      })
      .catch(() => {
        if (!canceled) setPeaks(fallbackPeaks(120));
      });
    return () => {
      canceled = true;
    };
  }, [shouldAnimateGenerated, track.audioBlob, track.id]);

  useEffect(() => {
    if (!shouldAnimateGenerated) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastFrame = 0;
    let prevWidth = 0;
    let prevHeight = 0;
    const loopMs = 4000;
    const maxFps = 30;
    const frameBudget = 1000 / maxFps;

    const draw = (timestamp: number) => {
      raf = window.requestAnimationFrame(draw);
      if (timestamp - lastFrame < frameBudget) return;
      lastFrame = timestamp;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      if (width !== prevWidth || height !== prevHeight) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        prevWidth = width;
        prevHeight = height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const t = ((timestamp % loopMs) / loopMs) * Math.PI * 2;
      const bars = Math.min(90, peaks.length);
      const gap = 2;
      const barWidth = (width - (bars - 1) * gap) / bars;
      const centerY = height * 0.5;
      const sway = Math.sin(t) * 0.08 + 1;

      const grad = ctx.createLinearGradient(0, centerY - height * 0.24, 0, centerY + height * 0.24);
      grad.addColorStop(0, "rgba(124, 229, 255, 0.45)");
      grad.addColorStop(0.6, "rgba(176, 110, 255, 0.4)");
      grad.addColorStop(1, "rgba(255, 112, 214, 0.35)");
      ctx.fillStyle = grad;

      for (let i = 0; i < bars; i += 1) {
        const idx = bars > 1 ? Math.round((i / (bars - 1)) * (peaks.length - 1)) : 0;
        const peak = Math.max(0.03, peaks[idx] ?? 0.15);
        const pulse = 0.75 + 0.25 * Math.sin(t + i * 0.11);
        const barHeight = Math.max(8, height * 0.36 * peak * pulse * sway);
        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, height * 0.22, width * 0.5, height * 0.5, height * 0.8);
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.28)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    };

    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [shouldAnimateGenerated, peaks]);

  const triggerArtworkFlash = () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastAuraFlashAtRef.current < FULLSCREEN_AURA_FLASH_COOLDOWN_MS) return;
    lastAuraFlashAtRef.current = now;
    const art = artRef.current;
    if (!art) return;
    const artCanvas = canvasRef.current;
    art.classList.remove("is-aura-flash");
    void art.offsetWidth;
    art.classList.add("is-aura-flash");
    if (artCanvas) {
      artCanvas.classList.remove("is-aura-flash-canvas");
      void artCanvas.offsetWidth;
      artCanvas.classList.add("is-aura-flash-canvas");
    }
  };

  const dismissFullscreenWithFeedback = () => {
    fireLightHaptic();
    if (loopRegion.editing) {
      onFinishLoopAdjustment();
    }
    onClose();
  };

  const exitCinemaMode = () => {
    setIsCinemaMode(false);
    fireLightHaptic();
  };

  const isLoopGestureSuppressed = () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    return loopGestureActiveRef.current || now < loopGestureSuppressUntilRef.current;
  };
  const exitHintText = "Exit Fullscreen";

  const armLoopGestureCooldown = () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    loopGestureSuppressUntilRef.current = now + LOOP_GESTURE_SUPPRESS_MS;
    swipeStartRef.current = null;
  };

  const beginSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    if (isLoopGestureSuppressed()) return;
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now()
    };
  };

  const endSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    if (isLoopGestureSuppressed()) {
      swipeStartRef.current = null;
      return;
    }
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > FULLSCREEN_SWIPE_CLOSE_MAX_SIDEWAYS_PX) return;
    const elapsedMs = Math.max(1, performance.now() - start.at);
    const velocity = dy / elapsedMs;
    if (isCinemaMode) {
      if (Math.abs(dy) >= CINEMA_EXIT_SWIPE_DISTANCE_PX || Math.abs(velocity) >= FULLSCREEN_SWIPE_CLOSE_MIN_VELOCITY) {
        exitCinemaMode();
      }
      return;
    }
    if (dy <= 0) return;
    if (dy >= FULLSCREEN_SWIPE_CLOSE_DISTANCE_PX || velocity >= FULLSCREEN_SWIPE_CLOSE_MIN_VELOCITY) {
      dismissFullscreenWithFeedback();
    }
  };

  const canStartSwipeDismiss = (target: EventTarget | null, clientY: number) => {
    if (isLoopGestureSuppressed()) return false;
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.closest("button, input, textarea, select, a, label")) return false;
    if (isCinemaMode) {
      return !element.closest(".pc-progress");
    }
    if (element.closest(".player-controls, .pc-progress, .pc-row, .pc-loop-row, .pc-wave")) return false;
    const withinMidDismissBand = typeof window !== "undefined" && clientY <= window.innerHeight * 0.72;
    return Boolean(
      withinMidDismissBand ||
        element.closest(
          ".fullscreen-player-shell__swipe-zone, .fullscreen-player-shell__close, .fullscreen-player-shell__meta"
        )
    );
  };

  const handleCinemaOutsidePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!isCinemaMode) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".fullscreen-player-shell__art, .pc-progress")) return;
    const isDesktopPointer = event.pointerType === "mouse";
    if (isDesktopPointer && typeof window !== "undefined" && event.clientY > window.innerHeight * 0.5) {
      lastCinemaOutsideTapAtRef.current = 0;
      return;
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastCinemaOutsideTapAtRef.current <= CINEMA_OUTSIDE_DOUBLE_TAP_MS) {
      lastCinemaOutsideTapAtRef.current = 0;
      exitCinemaMode();
      return;
    }
    lastCinemaOutsideTapAtRef.current = now;
  };

  return (
    <section
      className={`fullscreen-player-shell ${isCinemaMode ? "is-cinema-mode" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen player"
      onTouchStart={(event) => {
        if (event.touches.length !== 1) {
          swipeStartRef.current = null;
          return;
        }
        if (isLoopGestureSuppressed()) {
          swipeStartRef.current = null;
          return;
        }
        if (!canStartSwipeDismiss(event.target, event.touches[0].clientY)) {
          swipeStartRef.current = null;
          return;
        }
        beginSwipeDismiss(event.touches[0]);
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        endSwipeDismiss(touch);
      }}
      onTouchCancel={() => {
        swipeStartRef.current = null;
      }}
      onPointerDown={(event) => {
        if (isCinemaMode) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest(".fullscreen-player-shell__close, .fullscreen-player-shell__close-bottom")) return;
        if (!target?.closest(".fullscreen-player-shell__content")) dismissFullscreenWithFeedback();
      }}
      onPointerUp={handleCinemaOutsidePointerUp}
    >
      <div className="fullscreen-player-shell__bg" style={artStyle} aria-hidden="true" />

      {!isCinemaMode && (
        <button
          className="fullscreen-player-shell__close"
          aria-label={exitHintText}
          title={exitHintText}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={() => {
            dismissFullscreenWithFeedback();
          }}
        >
          ✕
        </button>
      )}

      <div className={`fullscreen-player-shell__content ${isCinemaMode ? "is-cinema-mode" : ""}`.trim()}>
        {!isCinemaMode && <div className="fullscreen-player-shell__swipe-zone" aria-hidden="true" />}
          <div
            className={`fullscreen-player-shell__art ${hasArtworkVideo ? "has-video" : ""} ${
              isCinemaMode ? "is-cinema-mode" : ""
            }`.trim()}
            ref={artRef}
            style={hasArtworkVideo ? undefined : artStyle}
            onClick={() => {
            if (isCinemaMode) return;
            setIsCinemaMode(true);
            }}
          >
          {!hasArtworkVideo && isCinemaMode && (
            <img
              className="fullscreen-player-shell__art-image"
              src={cinemaStillSrc}
              alt={`${track.title} artwork`}
              draggable={false}
            />
          )}
          {hasArtworkVideo && !isArtworkVideoReady && (
            <div className="fullscreen-player-shell__art-poster" style={artStyle} aria-hidden="true" />
          )}
          {shouldAnimateGenerated && <canvas ref={canvasRef} className="fullscreen-player-shell__art-canvas" />}
          {hasArtworkVideo && (
            <video
              key={track.artVideoUrl}
              ref={artworkVideoRef}
              className={`fullscreen-player-shell__art-video ${isArtworkVideoReady ? "is-ready" : ""}`.trim()}
              src={track.artVideoUrl}
              muted
              loop
              autoPlay
              playsInline
              preload="auto"
            />
          )}
        </div>

        {!isCinemaMode && (
          <div className="fullscreen-player-shell__meta">
            <h2>{track.title}</h2>
            <p>
              {formatTime(currentTime)} / {formatTime(duration)} • Aura {track.aura}/10
            </p>
            {track.missingAudio && <p>Missing audio</p>}
            {track.missingArt && <p>Missing artwork</p>}
          </div>
        )}

        <PlayerControls
          variant="fullscreen"
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          loopMode={loopMode}
          loopRegion={loopRegion}
          dimMode={dimMode}
          dimControlSkipsSoftDim={dimControlSkipsSoftDim}
          noveltyMode={noveltyMode}
          onPrev={onPrev}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onSeek={onSeek}
          shuffleEnabled={shuffleEnabled}
          repeatTrackMode={repeatTrackMode}
          threepeatDisplayCount={threepeatDisplayCount}
          repeatFlashTick={repeatFlashTick}
          cinemaMode={isCinemaMode}
          onToggleShuffle={onToggleShuffle}
          onToggleRepeatTrack={onToggleRepeatTrack}
          onCycleDimMode={onCycleDimMode}
          onCycleNoveltyMode={onCycleNoveltyMode}
          onVinylScratch={onVinylScratch}
          onSetLoop={onSetLoop}
          onToggleLoopMode={onToggleLoopMode}
          onClearLoop={onClearLoop}
          onBeginLoopAdjustment={onBeginLoopAdjustment}
          onFinishLoopAdjustment={onFinishLoopAdjustment}
          canCropAudio={canCropAudio}
          onOpenCropAudioPrompt={onOpenCropAudioPrompt}
          onAuraUp={() => {
            triggerArtworkFlash();
            onAuraUp();
          }}
          onSkip={onSkip}
          enableAuraPulse={false}
        />

        {!isCinemaMode && showLoopEditor && (
          <WaveformLoop
            track={track}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            loopRegion={loopRegion}
            onSeek={onSeek}
            onSetLoopRange={onSetLoopRange}
            onLoopDragStart={() => {
              loopGestureActiveRef.current = true;
              armLoopGestureCooldown();
              onLoopDragStart?.();
            }}
            onLoopDragCommit={(start) => {
              loopGestureActiveRef.current = false;
              armLoopGestureCooldown();
              onLoopDragCommit?.(start);
            }}
            enableAuraPulse={false}
          />
        )}

        {!isCinemaMode && (
          <button
            type="button"
            className="fullscreen-player-shell__close-bottom"
            aria-label={exitHintText}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              dismissFullscreenWithFeedback();
            }}
          >
            Exit Fullscreen
          </button>
        )}
      </div>
    </section>
  );
}
