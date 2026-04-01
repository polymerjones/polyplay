import { useEffect, useMemo } from "react";
import type { DimMode, Track } from "../types";
import { TrackRow } from "./TrackRow";
import { TrackTile } from "./TrackTile";

type Props = {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  layoutMode: "grid" | "list";
  dimMode: DimMode;
  onSelectTrack: (trackId: string) => void;
  onAuraUp: (trackId: string) => void;
};

export function TrackGrid({ tracks, currentTrackId, isPlaying, layoutMode, dimMode, onSelectTrack, onAuraUp }: Props) {
  const realTracks = useMemo(
    () => tracks.filter((track): track is Track => Boolean(track && (track as Track).id !== undefined)),
    [tracks]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const last = realTracks[realTracks.length - 1];
    console.log("[tiles:debug]", {
      count: realTracks.length,
      lastTrackId: last?.id !== undefined ? String(last.id) : null,
      lastTrackTitle: last?.title ?? null,
      lastTrackHasArt: Boolean(last?.artUrl)
    });
  }, [realTracks]);

  if (layoutMode === "list") {
    return (
      <main className="track-grid track-grid--list" id="grid">
        {realTracks.map((track) => {
          const active = String(track.id) === String(currentTrackId);
          return (
            <TrackRow
              key={String(track.id)}
              track={track}
              active={active}
              isPlaying={isPlaying}
              dimMode={dimMode}
              onSelectTrack={(trackId) => onSelectTrack(String(trackId))}
              onAuraUp={(trackId) => onAuraUp(String(trackId))}
            />
          );
        })}
      </main>
    );
  }

  return (
    <main className="ytm-grid" id="grid">
      {realTracks.map((track) => {
        const isCurrent = String(track.id) === String(currentTrackId);
        return (
          <TrackTile
            key={String(track.id)}
            track={track}
            trackId={String(track.id)}
            active={isCurrent && isPlaying}
            isCurrentTrack={isCurrent}
            dimMode={dimMode}
            isPlaying={isPlaying}
            onSelectTrack={onSelectTrack}
            onAuraUp={onAuraUp}
          />
        );
      })}
    </main>
  );
}
