import type { CSSProperties } from "react";
import type { Track } from "../types";

type Props = {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
};

function auraClass(aura: number): string {
  if (aura >= 4) return "aura-hot";
  if (aura >= 2) return "aura-med";
  return "aura-low";
}

export function TrackGrid({ tracks, currentTrackId, isPlaying, onSelectTrack, onAuraUp }: Props) {
  return (
    <main className="grid" id="grid">
      {tracks.map((track) => {
        const active = track.id === currentTrackId;
        const auraLevel = Math.max(0, Math.min(1, track.aura / 5));
        const glowHue = 275 + 35 * auraLevel;
        const glowBoost = Math.min(180, track.aura * 36);
        const artStyle = track.artUrl
          ? { backgroundImage: `url('${track.artUrl}')` }
          : { backgroundImage: track.artGrad || "linear-gradient(135deg,#2f3b50,#1a2432)" };

        return (
          <div
            key={track.id}
            className={`tile ${auraClass(track.aura)} ${active && isPlaying ? "is-playing" : ""}`.trim()}
            data-track-id={track.id}
            data-aura={String(track.aura)}
            style={
              {
                "--aura-level": auraLevel.toFixed(2),
                "--glow-hue": glowHue.toFixed(1),
                "--glow-boost": `${glowBoost}px`
              } as CSSProperties
            }
          >
            <button type="button" className="tile-hit" onClick={() => onSelectTrack(track.id)} aria-label={`Play ${track.title}`}>
              <div className="art art-grad" style={artStyle} />
              <div className="meta">
                <div className="title">{track.title}</div>
                <div className="sub">{track.sub || "Uploaded"}</div>
                <div className="aura-meter">Aura {track.aura}/5</div>
              </div>
            </button>
            <button
              className="aura-like"
              type="button"
              aria-label="Give aura"
              onContextMenu={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                const button = event.currentTarget;
                button.classList.remove("aura-bounce");
                void button.offsetWidth;
                button.classList.add("aura-bounce");
                const sparkle = document.createElement("span");
                sparkle.className = "aura-sparkle";
                button.appendChild(sparkle);
                sparkle.addEventListener("animationend", () => sparkle.remove(), { once: true });
                if (navigator.vibrate) navigator.vibrate(12);
                onAuraUp(track.id);
              }}
            >
              <span className="aura-icon" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </main>
  );
}
