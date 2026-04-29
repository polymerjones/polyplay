import { useEffect, useRef, type CSSProperties, type MouseEvent, type TouchEvent } from "react";
import type { DimMode, Track } from "../types";
import { BorderTrail } from "./BorderTrail";

const REPEAT_TAP_MAX_DELAY_MS = 280;
const REPEAT_TAP_MAX_TRAVEL_PX = 18;
const INTERACTIVE_EXCLUSION_SELECTOR = [
  "button",
  "[role='button']",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "[role='menuitem']",
  ".trackRow__playButton",
  ".trackRow__auraButton"
].join(", ");

type Props = {
  track: Track;
  active: boolean;
  isPlaying: boolean;
  dimMode: DimMode;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
  onOpenFullscreen: (trackId: string) => void;
};

export function TrackRow({ track, active, isPlaying, dimMode, onSelectTrack, onAuraUp, onOpenFullscreen }: Props) {
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const repeatTapRef = useRef<{ at: number; x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const rowFallbackArtwork =
    "radial-gradient(140px 120px at 22% 18%, rgba(150,108,244,.52), rgba(150,108,244,0) 62%), radial-gradient(160px 130px at 84% 82%, rgba(88,176,255,.34), rgba(88,176,255,0) 64%), linear-gradient(145deg, #1a2133, #0f1522)";
  const artStyle = track.artUrl
    ? ({ backgroundImage: `url('${track.artUrl}')` } as CSSProperties)
    : ({ backgroundImage: track.artGrad || rowFallbackArtwork } as CSSProperties);
  const auraLevel = Math.max(0, Math.min(1, track.aura / 10));
  const hasAura = track.aura > 0;
  const artist = track.artist?.trim();
  const sourceLabel = (track.sub || "").trim();
  const displaySub = sourceLabel && sourceLabel !== "Imported" ? sourceLabel : "";

  useEffect(() => {
    const onAuraArtHit = (event: Event) => {
      const custom = event as CustomEvent<{ trackId?: string }>;
      if (custom.detail?.trackId !== track.id) return;
      const thumb = thumbRef.current;
      if (!thumb) return;
      thumb.classList.remove("is-aura-flash");
      void thumb.offsetWidth;
      thumb.classList.add("is-aura-flash");
    };

    window.addEventListener("polyplay:aura-art-hit", onAuraArtHit as EventListener);
    return () => window.removeEventListener("polyplay:aura-art-hit", onAuraArtHit as EventListener);
  }, [track.id]);

  const isInteractiveTarget = (target: EventTarget | null, root: HTMLElement | null): boolean => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    const interactive = element.closest(INTERACTIVE_EXCLUSION_SELECTOR);
    return Boolean(interactive && interactive !== root);
  };

  const openFullscreenFromRepeatTap = () => {
    onOpenFullscreen(track.id);
  };

  const onRepeatTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onRepeatTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    const root = event.currentTarget;
    if (isInteractiveTarget(event.target, root)) {
      touchStartRef.current = null;
      repeatTapRef.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!touch || !start) return;
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > REPEAT_TAP_MAX_TRAVEL_PX) {
      repeatTapRef.current = null;
      return;
    }
    const now = Date.now();
    const previousTap = repeatTapRef.current;
    if (
      previousTap &&
      now - previousTap.at <= REPEAT_TAP_MAX_DELAY_MS &&
      Math.hypot(touch.clientX - previousTap.x, touch.clientY - previousTap.y) <= REPEAT_TAP_MAX_TRAVEL_PX
    ) {
      repeatTapRef.current = null;
      openFullscreenFromRepeatTap();
      return;
    }
    repeatTapRef.current = { at: now, x: touch.clientX, y: touch.clientY };
  };

  const onRepeatDoubleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isInteractiveTarget(event.target, event.currentTarget)) return;
    openFullscreenFromRepeatTap();
  };

  return (
    <article
      className={`trackRow ${active && isPlaying ? "is-playing" : ""} ${hasAura ? "rowAuraGlow" : ""}`.trim()}
      data-track-id={track.id}
      data-aura={String(track.aura)}
      style={{ "--row-aura-level": auraLevel.toFixed(2) } as CSSProperties}
    >
      <BorderTrail variant="row" isVisible={active} isPlaying={isPlaying} dimMode={dimMode} />
      <div className="rowAuraAccent" aria-hidden="true" />
      <button
        type="button"
        className="trackRow__art"
        onClick={() => onSelectTrack(track.id)}
        onDoubleClick={onRepeatDoubleClick}
        onTouchStart={onRepeatTouchStart}
        onTouchEnd={onRepeatTouchEnd}
        onTouchCancel={() => {
          touchStartRef.current = null;
        }}
        aria-label={`Play ${track.title}`}
      >
        <div ref={thumbRef} className="trackRow__thumb" style={artStyle} />
        <div className="trackRow__artBadges" aria-hidden="true">
          {track.isDemo && <div className="track-art-badge track-art-badge--row track-art-badge--demo">DEMO</div>}
          {track.artworkSource === "auto" && <div className="track-art-badge track-art-badge--row track-art-badge--auto">AUTO</div>}
        </div>
      </button>
      <button
        type="button"
        className="trackRow__metaHit"
        onClick={() => onSelectTrack(track.id)}
        onDoubleClick={onRepeatDoubleClick}
        onTouchStart={onRepeatTouchStart}
        onTouchEnd={onRepeatTouchEnd}
        onTouchCancel={() => {
          touchStartRef.current = null;
        }}
        aria-label={`Play ${track.title}`}
      >
        <div className="trackRow__meta">
          <div className="trackRow__title">{track.title}</div>
          {artist && <div className="trackRow__sub">{artist}</div>}
          {displaySub && <div className="trackRow__sub">{displaySub}</div>}
          <div className="trackRow__aura">Aura {track.aura}/10</div>
        </div>
      </button>
      <div className="trackRow__controls">
        <button
          type="button"
          className="trackRow__playButton"
          onClick={() => onSelectTrack(track.id)}
          aria-label={`Play ${track.title}`}
        >
          {active && isPlaying ? "Playing" : "Play"}
        </button>
        <button
          className="trackRow__auraButton"
          type="button"
          aria-label="Give aura"
          onClick={(event) => {
            event.stopPropagation();
            const button = event.currentTarget;
            button.classList.remove("trackRow__auraButton--burst");
            void button.offsetWidth;
            button.classList.add("trackRow__auraButton--burst");
            onAuraUp(track.id);
          }}
        >
          Aura +
        </button>
      </div>
    </article>
  );
}
