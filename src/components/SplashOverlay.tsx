import { useEffect, useRef, useState } from "react";
import logoVideo from "../../polyplay_splashvideo_logo480.mp4";
import logoImage from "../../logo.png";

type Props = {
  isDismissing: boolean;
  onClose: () => void;
  onSkip: (skipEveryTime: boolean) => void;
};

export function SplashOverlay({ isDismissing, onClose, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const lastTapAtRef = useRef(0);
  const [needsUserStart, setNeedsUserStart] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

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
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) setIsVideoReady(true);

    const startPlayback = async () => {
      try {
        await video.play();
        setNeedsUserStart(false);
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
      void video.play().catch(() => undefined);
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
    } catch {
      setNeedsUserStart(true);
    }
  };

  const enableSound = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = false;
      video.volume = 1;
      await video.play();
      setSoundEnabled(true);
      setNeedsUserStart(false);
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
      aria-label="Polyplay splash"
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
        className={`splash-overlay__video ${isVideoReady ? "is-ready" : ""}`.trim()}
        src={logoVideo}
        poster={logoImage}
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedData={() => setIsVideoReady(true)}
        onCanPlay={() => setIsVideoReady(true)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          const safeDuration = Number.isFinite(video.duration) ? video.duration : 0;
          if (safeDuration <= 1) return;
          if (video.currentTime >= safeDuration - 1) completeOnce();
        }}
        onEnded={completeOnce}
      />
      {!isVideoReady && (
        <div className="splash-overlay__fallback" aria-hidden="true">
          <img src={logoImage} alt="" className="splash-overlay__fallback-logo" />
          <div className="splash-overlay__fallback-wordmark">PolyPlay</div>
        </div>
      )}
      <button type="button" className="splash-overlay__close" aria-label="Close welcome" onClick={completeOnce}>
        ✕
      </button>
      <button type="button" className="splash-overlay__skip" onClick={skipOnce}>
        Skip
      </button>
      {!soundEnabled && (
        <button type="button" className="splash-overlay__sound" onClick={() => void enableSound()}>
          Tap for sound
        </button>
      )}
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
