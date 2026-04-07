import { useEffect, useRef, useState } from "react";
import logoVideo from "../../polyplay_splashvideo_logo480.mp4";
import logoImage from "../../logo.png";

type Props = {
  isDismissing: boolean;
  onClose: () => void;
  onSkip: (skipEveryTime: boolean) => void;
  skipLabel?: string;
};

export function SplashOverlay({ isDismissing, onClose, onSkip, skipLabel = "Skip" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const lastTapAtRef = useRef(0);
  const [needsUserStart, setNeedsUserStart] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hasVisibleVideo, setHasVisibleVideo] = useState(false);

  const markVideoVisible = () => {
    setHasVisibleVideo(true);
  };

  const completeOnce = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onClose();
  };

  const skipOnce = () => {
    if (completedRef.current) return;
    const skipEveryTime =
      typeof window !== "undefined" ? window.confirm("Skip every time? You can change this later by resetting app defaults.") : false;
    completedRef.current = true;
    onSkip(skipEveryTime);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startPlayback = async () => {
      try {
        await video.play();
        setNeedsUserStart(false);
        if (video.currentTime > 0.02) markVideoVisible();
      } catch {
        setNeedsUserStart(true);
      }
    };

    void startPlayback();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
        return;
      }
      void video.play()
        .then(() => {
          if (video.currentTime > 0.02) markVideoVisible();
        })
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const startFromTap = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsUserStart(false);
      if (video.currentTime > 0.02) markVideoVisible();
    } catch {
      setNeedsUserStart(true);
    }
  };

  const toggleSound = async () => {
    const video = videoRef.current;
    if (!video) return;
    const nextEnabled = !soundEnabled;
    try {
      video.muted = !nextEnabled;
      if (nextEnabled) video.volume = 1;
      await video.play();
      setSoundEnabled(nextEnabled);
      setNeedsUserStart(false);
      if (video.currentTime > 0.02) markVideoVisible();
    } catch {
      video.muted = true;
      setSoundEnabled(false);
    }
  };

  return (
    <section
      className={`splash-overlay ${isDismissing ? "is-dismissing" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label="PolyPlay splash"
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest("button, input, textarea, select, a, [role='button']")) return;
        const now = Date.now();
        if (now - lastTapAtRef.current <= 360) {
          lastTapAtRef.current = 0;
          completeOnce();
          return;
        }
        lastTapAtRef.current = now;
      }}
    >
      <video
        ref={videoRef}
        className={`splash-overlay__video ${hasVisibleVideo ? "is-ready" : ""}`.trim()}
        src={logoVideo}
        poster={logoImage}
        autoPlay
        muted
        playsInline
        preload="auto"
        onPlaying={(event) => {
          if (event.currentTarget.currentTime > 0.02) markVideoVisible();
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (video.currentTime > 0.02) markVideoVisible();
          const safeDuration = Number.isFinite(video.duration) ? video.duration : 0;
          if (safeDuration <= 1) return;
          if (video.currentTime >= safeDuration - 1) completeOnce();
        }}
        onEnded={completeOnce}
      />
      {!hasVisibleVideo && (
        <div className="splash-overlay__fallback" aria-hidden="true">
          <img src={logoImage} alt="" className="splash-overlay__fallback-logo" />
          <div className="splash-overlay__fallback-wordmark">PolyPlay</div>
        </div>
      )}
      <button type="button" className="splash-overlay__close" aria-label="Close welcome" onClick={completeOnce}>
        ✕
      </button>
      <button type="button" className="splash-overlay__skip" onClick={skipOnce}>
        {skipLabel}
      </button>
      <button
        type="button"
        className={`splash-overlay__sound ${soundEnabled ? "is-enabled" : "is-muted"}`.trim()}
        aria-label={soundEnabled ? "Mute splash sound" : "Unmute splash sound"}
        aria-pressed={soundEnabled}
        title={soundEnabled ? "Mute splash sound" : "Unmute splash sound"}
        onClick={() => void toggleSound()}
      >
        <span className="splash-overlay__sound-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="splash-overlay__sound-svg">
            <path d="M5 14h3.5l4.5 4V6L8.5 10H5z" />
            {soundEnabled ? (
              <>
                <path d="M16 9.2a4.2 4.2 0 0 1 0 5.6" />
                <path d="M18.7 6.8a7.6 7.6 0 0 1 0 10.4" />
              </>
            ) : (
              <path d="m16 8 5 8M21 8l-5 8" />
            )}
          </svg>
        </span>
      </button>
      {needsUserStart && (
        <div className="splash-overlay__tap-wrap">
          <button type="button" className="splash-overlay__tap" onClick={() => void startFromTap()}>
            Tap to Start
          </button>
        </div>
      )}
    </section>
  );
}
