import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import { buildPeaksFromAudioBlob, fallbackPeaks } from "../lib/artwork/waveformArtwork";
import { formatTime } from "../lib/time";
import type { LoopMode, LoopRegion, Track } from "../types";
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
  onClose: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  shuffleEnabled: boolean;
  repeatTrackEnabled: boolean;
  onToggleShuffle: () => void;
  onToggleRepeatTrack: () => void;
  onCycleDimMode: () => void;
  onSetLoopRange: (start: number, end: number, active: boolean) => void;
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
  onClose,
  onPrev,
  onPlayPause,
  onNext,
  onSeek,
  shuffleEnabled,
  repeatTrackEnabled,
  onToggleShuffle,
  onToggleRepeatTrack,
  onCycleDimMode,
  onSetLoopRange,
  onSetLoop,
  onToggleLoopMode,
  onClearLoop,
  onAuraUp,
  onSkip
}: Props) {
  const artRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const artworkVideoRef = useRef<HTMLVideoElement | null>(null);
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || `url('${DEFAULT_ARTWORK_URL}')` } as CSSProperties);
  const hasArtworkVideo = Boolean(track.artVideoUrl);
  const shouldAnimateGenerated = track.artworkSource === "auto" && !hasArtworkVideo;
  const showLoopEditor = loopMode === "region" && loopRegion.active;
  const [peaks, setPeaks] = useState<number[]>(() => fallbackPeaks(120));

  useEffect(() => {
    const currentVideo = artworkVideoRef.current;
    if (!currentVideo) return;
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
    return () => {
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
    const art = artRef.current;
    if (!art) return;
    art.classList.remove("is-aura-flash");
    void art.offsetWidth;
    art.classList.add("is-aura-flash");
  };

  return (
    <section className="fullscreen-player-shell" role="dialog" aria-modal="true" aria-label="Fullscreen player">
      <div className="fullscreen-player-shell__bg" style={artStyle} aria-hidden="true" />

      <button className="fullscreen-player-shell__close" aria-label="Close fullscreen player" onClick={onClose}>
        ✕
      </button>

      <div className="fullscreen-player-shell__content">
        <div
          className={`fullscreen-player-shell__art ${hasArtworkVideo ? "has-video" : ""}`}
          ref={artRef}
          style={hasArtworkVideo ? undefined : artStyle}
        >
          {shouldAnimateGenerated && <canvas ref={canvasRef} className="fullscreen-player-shell__art-canvas" />}
          {hasArtworkVideo && (
            <video
              key={track.artVideoUrl}
              ref={artworkVideoRef}
              className="fullscreen-player-shell__art-video"
              src={track.artVideoUrl}
              muted
              loop
              autoPlay
              playsInline
            />
          )}
        </div>

        <div className="fullscreen-player-shell__meta">
          <h2>{track.title}</h2>
          <p>
            {formatTime(currentTime)} / {formatTime(duration)} • Aura {track.aura}/5
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
          onPrev={onPrev}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onSeek={onSeek}
          shuffleEnabled={shuffleEnabled}
          repeatTrackEnabled={repeatTrackEnabled}
          onToggleShuffle={onToggleShuffle}
          onToggleRepeatTrack={onToggleRepeatTrack}
          onCycleDimMode={onCycleDimMode}
          onSetLoop={onSetLoop}
          onToggleLoopMode={onToggleLoopMode}
          onClearLoop={onClearLoop}
          onAuraUp={() => {
            triggerArtworkFlash();
            onAuraUp();
          }}
          onSkip={onSkip}
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
          />
        )}
      </div>
    </section>
  );
}
