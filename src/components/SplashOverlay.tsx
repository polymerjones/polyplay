import { useEffect, useRef, useState } from "react";
import logoVideo from "../../polyplaylogoanimate.mp4";

type Props = {
  isDismissing: boolean;
  onComplete: () => void;
};

export function SplashOverlay({ isDismissing, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [needsUserStart, setNeedsUserStart] = useState(false);

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
    >
      <video
        ref={videoRef}
        className="splash-overlay__video"
        src={logoVideo}
        autoPlay
        playsInline
        preload="auto"
        onEnded={onComplete}
      />
      <button type="button" className="splash-overlay__skip" onClick={onComplete}>
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
