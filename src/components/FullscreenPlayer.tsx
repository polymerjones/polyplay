import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
  onAuraUp,
  onSkip
}: Props) {
  const FULLSCREEN_AURA_FLASH_COOLDOWN_MS = 220;
  const FULLSCREEN_SWIPE_CLOSE_DISTANCE_PX = 140;
  const FULLSCREEN_SWIPE_CLOSE_MAX_SIDEWAYS_PX = 72;
  const FULLSCREEN_SWIPE_CLOSE_MIN_VELOCITY = 0.42;
  const artRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const artworkVideoRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const lastAuraFlashAtRef = useRef(0);
  const swipeStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || `url('${DEFAULT_ARTWORK_URL}')` } as CSSProperties);
  const hasArtworkVideo = Boolean(track.artVideoUrl);
  const shouldAnimateGenerated = track.artworkSource === "auto" && !hasArtworkVideo;
  const showLoopEditor = loopMode === "region" && loopRegion.active;
  const [peaks, setPeaks] = useState<number[]>(() => fallbackPeaks(120));
  const [isArtworkVideoReady, setIsArtworkVideoReady] = useState(false);

  useEffect(() => {
    setIsArtworkVideoReady(false);
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
        prev.removeAttribute("src");
        prev.load();
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
        currentVideo.removeAttribute("src");
        currentVideo.load();
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
    onClose();
  };

  const beginSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now()
    };
  };

  const endSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy <= 0) return;
    if (Math.abs(dx) > FULLSCREEN_SWIPE_CLOSE_MAX_SIDEWAYS_PX) return;
    const elapsedMs = Math.max(1, performance.now() - start.at);
    const velocity = dy / elapsedMs;
    if (dy >= FULLSCREEN_SWIPE_CLOSE_DISTANCE_PX || velocity >= FULLSCREEN_SWIPE_CLOSE_MIN_VELOCITY) {
      dismissFullscreenWithFeedback();
    }
  };

  const canStartSwipeDismiss = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    return Boolean(
      element.closest(
        ".fullscreen-player-shell__swipe-zone, .fullscreen-player-shell__close, .fullscreen-player-shell__meta"
      )
    );
  };

  return (
    <section
      className="fullscreen-player-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen player"
      onTouchStart={(event) => {
        if (event.touches.length !== 1) {
          swipeStartRef.current = null;
          return;
        }
        if (!canStartSwipeDismiss(event.target)) {
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
        const target = event.target as HTMLElement | null;
        if (!target?.closest(".fullscreen-player-shell__content")) onClose();
      }}
    >
      <div className="fullscreen-player-shell__bg" style={artStyle} aria-hidden="true" />

      <button className="fullscreen-player-shell__close" aria-label="Close fullscreen player" onClick={onClose}>
        ✕
      </button>

      <div className="fullscreen-player-shell__content">
        <div className="fullscreen-player-shell__swipe-zone" aria-hidden="true" />
        <div
          className={`fullscreen-player-shell__art ${hasArtworkVideo ? "has-video" : ""}`}
          ref={artRef}
          style={hasArtworkVideo ? undefined : artStyle}
        >
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

        <div className="fullscreen-player-shell__meta">
          <h2>{track.title}</h2>
          <p>
            {formatTime(currentTime)} / {formatTime(duration)} • Aura {track.aura}/10
          </p>
          {track.missingAudio && <p>Missing audio</p>}
          {track.missingArt && <p>Missing artwork</p>}
        </div>

        <PlayerControls
          variant="fullscreen"
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          loopMode={loopMode}
          dimMode={dimMode}
          dimControlSkipsSoftDim={dimControlSkipsSoftDim}
          noveltyMode={noveltyMode}
          onPrev={onPrev}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onSeek={onSeek}
          shuffleEnabled={shuffleEnabled}
          repeatTrackMode={repeatTrackMode}
          onToggleShuffle={onToggleShuffle}
          onToggleRepeatTrack={onToggleRepeatTrack}
          onCycleDimMode={onCycleDimMode}
          onCycleNoveltyMode={onCycleNoveltyMode}
          onVinylScratch={onVinylScratch}
          onSetLoop={onSetLoop}
          onToggleLoopMode={onToggleLoopMode}
          onClearLoop={onClearLoop}
          onAuraUp={() => {
            triggerArtworkFlash();
            onAuraUp();
          }}
          onSkip={onSkip}
          enableAuraPulse={false}
        />

        {showLoopEditor && (
          <WaveformLoop
            track={track}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            loopRegion={loopRegion}
            onSeek={onSeek}
            onSetLoopRange={onSetLoopRange}
            onLoopDragStart={onLoopDragStart}
            onLoopDragCommit={onLoopDragCommit}
            enableAuraPulse={false}
          />
        )}

        <button
          type="button"
          className="fullscreen-player-shell__close-bottom"
          aria-label="Close fullscreen player"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </section>
  );
}
