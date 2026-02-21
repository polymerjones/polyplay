import { useEffect, useRef, useState } from "react";
import logoVideo from "../../polyplay_splashvideo_logo480.mp4";

type Props = {
  isDismissing: boolean;
  onComplete: () => void;
};

export function SplashOverlay({ isDismissing, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const lastTapAtRef = useRef(0);
  const [needsUserStart, setNeedsUserStart] = useState(false);

  const completeOnce = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
        className="splash-overlay__video"
        src={logoVideo}
        autoPlay
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          const safeDuration = Number.isFinite(video.duration) ? video.duration : 0;
          if (safeDuration <= 1) return;
          if (video.currentTime >= safeDuration - 1) completeOnce();
        }}
        onEnded={completeOnce}
      />
      <button type="button" className="splash-overlay__skip" onClick={completeOnce}>
        Skip
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
