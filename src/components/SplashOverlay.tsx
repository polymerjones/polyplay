import { useEffect, useRef, useState } from "react";
import logoVideo from "../../polyplay_splashvideo_logo480.mp4";

type Props = {
  mode: "intro" | "returning";
  isDismissing: boolean;
  onComplete: () => void;
};

export function SplashOverlay({ mode, isDismissing, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [needsUserStart, setNeedsUserStart] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (mode === "returning") {
      const seekToLastFrame = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (duration <= 0) return;
        video.currentTime = Math.max(0, duration - 0.05);
      };
      video.muted = true;
      video.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) seekToLastFrame();
      else video.addEventListener("loadedmetadata", seekToLastFrame, { once: true });
      setNeedsUserStart(false);
      return;
    }

    const startPlayback = async () => {
      try {
        await video.play();
        setNeedsUserStart(false);
      } catch {
        setNeedsUserStart(true);
      }
    };

    void startPlayback();
  }, [mode]);

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
    >
      <video
        ref={videoRef}
        className="splash-overlay__video"
        src={logoVideo}
        autoPlay={mode === "intro"}
        playsInline
        preload="auto"
        onEnded={mode === "intro" ? onComplete : undefined}
      />
      {mode === "intro" && (
        <button type="button" className="splash-overlay__skip" onClick={onComplete}>
          Skip
        </button>
      )}
      {mode === "intro" && needsUserStart && (
        <div className="splash-overlay__tap-wrap">
          <button type="button" className="splash-overlay__tap" onClick={() => void startFromTap()}>
            Tap to Start
          </button>
        </div>
      )}
    </section>
  );
}
