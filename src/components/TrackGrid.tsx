import type { CSSProperties } from "react";
import { DEFAULT_ARTWORK_URL } from "../lib/defaultArtwork";
import type { Track } from "../types";
import { TrackRow } from "./TrackRow";

type Props = {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  layoutMode: "grid" | "list";
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
};

function auraClass(aura: number): string {
  if (aura >= 4) return "aura-hot";
  if (aura >= 2) return "aura-med";
  return "aura-low";
}

export function TrackGrid({ tracks, currentTrackId, isPlaying, layoutMode, onSelectTrack, onAuraUp }: Props) {
  return (
    <main className={`track-grid ${layoutMode === "list" ? "track-grid--list" : ""}`.trim()} id="grid">
      {tracks.map((track) => {
        const active = track.id === currentTrackId;
        if (layoutMode === "list") {
          return (
            <TrackRow
              key={track.id}
              track={track}
              active={active}
              isPlaying={isPlaying}
              onSelectTrack={onSelectTrack}
              onAuraUp={onAuraUp}
            />
          );
        }

        const auraLevel = Math.max(0, Math.min(1, track.aura / 5));
        const glowHue = 275 + 35 * auraLevel;
        const glowBoost = Math.min(180, track.aura * 36);
        const missingAudio = Boolean(track.missingAudio);
        const missingArt = Boolean(track.missingArt);
        const artStyle = track.artUrl
          ? { backgroundImage: `url('${track.artUrl}')` }
          : { backgroundImage: track.artGrad || `url('${DEFAULT_ARTWORK_URL}')` };

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
            {track.artworkSource === "auto" && <div className="track-art-badge track-art-badge--tile">AUTO ART</div>}
            <button type="button" className="tile-hit" onClick={() => onSelectTrack(track.id)} aria-label={`Play ${track.title}`}>
              <div className="art art-grad" style={artStyle} />
              <div className="meta">
                <div className="title">{track.title}</div>
                <div className="sub">{track.sub || "Uploaded"}</div>
                {missingAudio && <div className="sub">Missing audio</div>}
                {missingArt && <div className="sub">Missing artwork</div>}
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
                const tile = button.closest(".tile");
                const art = tile?.querySelector(".art");
                if (art instanceof HTMLElement) {
                  art.classList.remove("is-aura-flash");
                  void art.offsetWidth;
                  art.classList.add("is-aura-flash");
                }
                button.classList.remove("aura-like--burst");
                void button.offsetWidth;
                button.classList.add("aura-like--burst");
                const burst = document.createElement("span");
                burst.className = "aura-burst";
                for (let i = 0; i < 7; i += 1) {
                  const sparkle = document.createElement("span");
                  sparkle.className = "aura-burst__spark";
                  const angle = (i / 7) * Math.PI * 2;
                  sparkle.style.setProperty("--tx", `${Math.cos(angle) * 26}px`);
                  sparkle.style.setProperty("--ty", `${Math.sin(angle) * 26}px`);
                  sparkle.style.setProperty("--delay", `${i * 34}ms`);
                  burst.appendChild(sparkle);
                }
                button.appendChild(burst);
                burst.addEventListener("animationend", () => burst.remove(), { once: true });
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
