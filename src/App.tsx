import { useEffect, useMemo, useRef, useState } from "react";
import logo from "../logo.png";
import { FullscreenPlayer } from "./components/FullscreenPlayer";
import { MiniPlayerBar } from "./components/MiniPlayerBar";
import { TrackGrid } from "./components/TrackGrid";
import { sampleTracks } from "./data/sampleTracks";
import { getTracksFromDb, saveAuraToDb } from "./lib/db";
import { revokeAllMediaUrls } from "./lib/player/media";
import type { LoopRegion, Track } from "./types";

const EMPTY_LOOP: LoopRegion = { start: 0, end: 0, active: false, editing: false };

function clampAura(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function getNextTrackId(tracks: Track[], currentTrackId: string | null, dir: 1 | -1): string | null {
  if (!tracks.length) return null;
  const currentIndex = tracks.findIndex((track) => track.id === currentTrackId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const next = (safeIndex + dir + tracks.length) % tracks.length;
  return tracks[next]?.id ?? null;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopByTrack, setLoopByTrack] = useState<Record<string, LoopRegion>>({});
  const [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen] = useState(false);
  const [overlayPage, setOverlayPage] = useState<"help" | "settings" | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAutoPlayRef = useRef(false);

  const refreshTracks = async () => {
    const dbTracks = await getTracksFromDb();
    const loaded = dbTracks.length ? dbTracks : sampleTracks;
    setTracks(loaded);
    setCurrentTrackId((prev) => {
      if (prev && loaded.some((track) => track.id === prev)) return prev;
      return loaded[0]?.id ?? null;
    });
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await refreshTracks();
      } catch {
        if (!mounted) return;
        setTracks(sampleTracks);
        setCurrentTrackId(sampleTracks[0]?.id ?? null);
      }
    })();

    return () => {
      mounted = false;
      revokeAllMediaUrls();
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "polyplay:upload-success") return;

      setOverlayPage(null);
      void refreshTracks();

      try {
        const audio = new Audio("/hyper-notif.wav");
        audio.volume = 0.85;
        void audio.play();
      } catch {
        // Ignore notification sound failures.
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentTrackId) ?? null,
    [tracks, currentTrackId]
  );
  const currentAudioUrl = currentTrack?.audioUrl ?? null;

  const currentLoop = useMemo(() => {
    if (!currentTrackId) return EMPTY_LOOP;
    return loopByTrack[currentTrackId] ?? EMPTY_LOOP;
  }, [currentTrackId, loopByTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentAudioUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    audio.src = currentAudioUrl;
    audio.load();
    setCurrentTime(0);
    setDuration(0);

    if (pendingAutoPlayRef.current) {
      pendingAutoPlayRef.current = false;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [currentTrackId, currentAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const nextTime = audio.currentTime || 0;
      const loopRegion = currentTrackId ? loopByTrack[currentTrackId] : undefined;
      if (loopRegion && loopRegion.active && loopRegion.end > loopRegion.start) {
        if (nextTime >= loopRegion.end || nextTime < loopRegion.start) {
          audio.currentTime = loopRegion.start;
          setCurrentTime(loopRegion.start);
          return;
        }
      }
      setCurrentTime(nextTime);
    };

    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [currentTrackId, loopByTrack]);

  const updateAura = async (trackId: string, delta: number) => {
    let nextAuraForDb: number | null = null;
    let persistedId: string | null = null;

    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const aura = clampAura(track.aura + delta);
        nextAuraForDb = aura;
        persistedId = track.persistedId ?? null;
        return { ...track, aura };
      })
    );

    if (persistedId !== null && nextAuraForDb !== null) {
      try {
        await saveAuraToDb(persistedId, nextAuraForDb);
      } catch {}
    }
  };

  const selectTrack = (trackId: string, autoPlay = true) => {
    const selectedTrack = tracks.find((track) => track.id === trackId) ?? null;
    const canPlay = Boolean(selectedTrack?.audioUrl) && !selectedTrack?.missingAudio;
    if (trackId === currentTrackId) {
      if (autoPlay && canPlay) {
        const audio = audioRef.current;
        if (audio && audio.paused) {
          void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      }
      return;
    }
    pendingAutoPlayRef.current = autoPlay && canPlay;
    setCurrentTrackId(trackId);
  };

  const playPrev = () => {
    const prevId = getNextTrackId(tracks, currentTrackId, -1);
    if (prevId) selectTrack(prevId, true);
  };

  const playNext = () => {
    const nextId = getNextTrackId(tracks, currentTrackId, 1);
    if (nextId) selectTrack(nextId, true);
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, Math.min(duration || 0, seconds));
    setCurrentTime(audio.currentTime);
  };

  const skip = (delta: number) => seekTo((audioRef.current?.currentTime || 0) + delta);

  const setLoopRange = (start: number, end: number, active: boolean) => {
    if (!currentTrackId) return;
    const safeStart = Math.max(0, Math.min(duration || 0, start));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(duration || 0, end));
    setLoopByTrack((prev) => ({
      ...prev,
      [currentTrackId]: { start: safeStart, end: safeEnd, active, editing: false }
    }));
  };

  const setLoopFromCurrent = () => {
    if (!currentTrackId || duration <= 0) return;
    const now = audioRef.current?.currentTime || 0;
    const safeStart = Math.max(0, Math.min(duration, now));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(duration, safeStart + 5));
    setLoopByTrack((prev) => ({
      ...prev,
      [currentTrackId]: { start: safeStart, end: safeEnd, active: true, editing: false }
    }));
  };

  const toggleLoopActive = () => {
    if (!currentTrackId) return;
    setLoopByTrack((prev) => {
      const current = prev[currentTrackId] ?? EMPTY_LOOP;
      if (current.end <= current.start) return prev;
      return {
        ...prev,
        [currentTrackId]: { ...current, active: !current.active, editing: false }
      };
    });
  };

  const clearLoop = () => {
    if (!currentTrackId) return;
    setLoopByTrack((prev) => ({ ...prev, [currentTrackId]: EMPTY_LOOP }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreenPlayerOpen(false);
        setOverlayPage(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div
        className={`track-backdrop ${currentTrack?.artUrl || currentTrack?.artGrad ? "is-visible" : ""}`.trim()}
        style={{
          backgroundImage: currentTrack?.artUrl
            ? `url('${currentTrack.artUrl}')`
            : currentTrack?.artGrad || "none"
        }}
        aria-hidden="true"
      />
      <div className="app touch-clean">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src={logo} alt="Polyplay logo" />
            <span>Polyplay Music App Beta v102</span>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="help-link nav-action-btn"
              aria-label="Open help panel"
              onClick={() => setOverlayPage("help")}
            >
              <span className="help-icon" aria-hidden="true">
                ?
              </span>
            </button>
            <button
              type="button"
              className="gear-link nav-action-btn"
              aria-label="Open settings panel"
              onClick={() => setOverlayPage("settings")}
            >
              <span className="gear-icon" aria-hidden="true">
                ⚙
              </span>
            </button>
          </div>
          <div className="hint">Tap tiles to play • Tap artwork to build aura</div>
        </header>

        <TrackGrid
          tracks={tracks}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          onSelectTrack={(trackId) => selectTrack(trackId, true)}
          onAuraUp={(trackId) => {
            void updateAura(trackId, 1);
          }}
        />
      </div>

      <MiniPlayerBar
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        loopRegion={currentLoop}
        onPrev={playPrev}
        onPlayPause={togglePlayPause}
        onNext={playNext}
        onAuraUp={() => {
          if (currentTrackId) void updateAura(currentTrackId, 1);
        }}
        onSeek={seekTo}
        onSkip={skip}
        onSetLoopRange={setLoopRange}
        onSetLoop={setLoopFromCurrent}
        onToggleLoopActive={toggleLoopActive}
        onClearLoop={clearLoop}
        onOpenFullscreen={() => {
          if (currentTrack) setIsFullscreenPlayerOpen(true);
        }}
      />

      {currentTrack && isFullscreenPlayerOpen && (
        <FullscreenPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          loopRegion={currentLoop}
          onClose={() => setIsFullscreenPlayerOpen(false)}
          onPrev={playPrev}
          onPlayPause={togglePlayPause}
          onNext={playNext}
          onSeek={seekTo}
          onSetLoop={setLoopFromCurrent}
          onToggleLoopActive={toggleLoopActive}
          onClearLoop={clearLoop}
          onAuraUp={() => {
            if (currentTrackId) void updateAura(currentTrackId, 1);
          }}
          onSkip={skip}
        />
      )}

      {overlayPage && (
        <section className="app-overlay" role="dialog" aria-modal="true" aria-label={`${overlayPage} panel`}>
          <div className="app-overlay-card">
            <div className="app-overlay-head">
              <div className="app-overlay-title">{overlayPage === "help" ? "Help" : "Settings"}</div>
              <button
                type="button"
                className="app-overlay-close"
                aria-label="Close panel"
                onClick={() => setOverlayPage(null)}
              >
                ✕
              </button>
            </div>
            <iframe
              title={overlayPage === "help" ? "Help" : "Settings"}
              src={overlayPage === "help" ? "/help.html" : "/admin.html"}
              className="app-overlay-frame"
            />
          </div>
        </section>
      )}

      <audio ref={audioRef} preload="metadata" />
    </>
  );
}
