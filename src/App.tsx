import { useEffect, useMemo, useRef, useState } from "react";
import logo from "../logo.png";
import { quickTipsContent } from "./content/quickTips";
import { APP_TITLE, APP_VERSION } from "./config/version";
import { EmptyLibraryWelcome } from "./components/EmptyLibraryWelcome";
import { FullscreenPlayer } from "./components/FullscreenPlayer";
import { MiniPlayerBar } from "./components/MiniPlayerBar";
import { QuickTipsModal } from "./components/QuickTipsModal";
import { SplashOverlay } from "./components/SplashOverlay";
import { TrackGrid } from "./components/TrackGrid";
import { clearTracksInDb, getTracksFromDb, saveAuraToDb } from "./lib/db";
import { revokeAllMediaUrls } from "./lib/player/media";
import type { LoopMode, LoopRegion, Track } from "./types";

const EMPTY_LOOP: LoopRegion = { start: 0, end: 0, active: false, editing: false };
const SPLASH_SEEN_KEY = "polyplay_hasSeenSplash";
const OPEN_STATE_SEEN_KEY = "polyplay_open_state_seen_v102";
const LAYOUT_MODE_KEY = "polyplay_layoutMode";
const SPLASH_FADE_MS = 420;

function clampAura(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function getSafeDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getAdjacentTrackId(
  tracks: Track[],
  currentTrackId: string | null,
  dir: 1 | -1,
  wrap = true
): string | null {
  if (!tracks.length) return null;
  const currentIndex = tracks.findIndex((track) => track.id === currentTrackId);
  if (currentIndex === -1) return tracks[0]?.id ?? null;
  const nextIndex = currentIndex + dir;
  if (!wrap && (nextIndex < 0 || nextIndex >= tracks.length)) return null;
  const safeIndex = wrap ? (nextIndex + tracks.length) % tracks.length : nextIndex;
  return tracks[safeIndex]?.id ?? null;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopByTrack, setLoopByTrack] = useState<Record<string, LoopRegion>>({});
  const [loopModeByTrack, setLoopModeByTrack] = useState<Record<string, LoopMode>>({});
  const [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen] = useState(false);
  const [overlayPage, setOverlayPage] = useState<"settings" | null>(null);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [showOpenState, setShowOpenState] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [isSplashDismissing, setIsSplashDismissing] = useState(false);
  const [isNuking, setIsNuking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const audioSrcRef = useRef<string | null>(null);
  const splashTimeoutRef = useRef<number | null>(null);
  const nukeTimeoutRef = useRef<number | null>(null);
  const isNukingRef = useRef(false);
  const nukeFinalizeStartedRef = useRef(false);
  const teardownAudioListenersRef = useRef<(() => void) | null>(null);
  const audioInstanceSeqRef = useRef(0);
  const audioInstanceIdRef = useRef(0);

  const logAudioDebug = (event: string, details?: Record<string, unknown>) => {
    try {
      if (localStorage.getItem("polyplay_debugAudio") !== "true") return;
    } catch {
      return;
    }
    console.log("[polyplay:audio]", {
      event,
      currentTrackId,
      audioInstanceId: audioInstanceIdRef.current,
      ...details
    });
  };

  const refreshTracks = async () => {
    const dbTracks = await getTracksFromDb();
    const loaded = dbTracks;
    setTracks(loaded);
    setCurrentTrackId((prev) => {
      if (prev && loaded.some((track) => track.id === prev)) return prev;
      return loaded[0]?.id ?? null;
    });
  };

  const teardownCurrentAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    logAudioDebug("teardown:start");
    teardownAudioListenersRef.current?.();
    teardownAudioListenersRef.current = null;
    logAudioDebug("pause() called", { reason: "teardown" });
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Safari can throw when media state is transient; safe to ignore.
    }
    logAudioDebug("src cleared");
    audio.removeAttribute("src");
    audio.load();
    audioSrcRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    logAudioDebug("teardown:end");
  };

  const nukeAppData = async () => {
    logAudioDebug("nukeAppData:start");
    try {
      await clearTracksInDb();
      logAudioDebug("nukeAppData:storage-cleared");
    } catch (error) {
      logAudioDebug("nukeAppData:storage-clear-failed", { error: String(error) });
    }
    setTracks([]);
    setCurrentTrackId(null);
    setLoopByTrack({});
    setLoopModeByTrack({});
    setIsFullscreenPlayerOpen(false);
    setOverlayPage(null);
    setIsTipsOpen(false);
    setShowOpenState(false);
    logAudioDebug("nukeAppData:end");
  };

  const beginNukeSequence = () => {
    if (isNukingRef.current) return;
    isNukingRef.current = true;
    nukeFinalizeStartedRef.current = false;
    teardownCurrentAudio();
    pendingAutoPlayRef.current = false;
    setIsNuking(true);
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationMs = prefersReducedMotion ? 140 : 860;
    if (nukeTimeoutRef.current !== null) {
      window.clearTimeout(nukeTimeoutRef.current);
    }
    nukeTimeoutRef.current = window.setTimeout(() => {
      void completeNukeSequence("fallback-timeout");
    }, animationMs);
  };

  const completeNukeSequence = async (source: "animationend" | "fallback-timeout") => {
    if (nukeFinalizeStartedRef.current) return;
    nukeFinalizeStartedRef.current = true;
    if (nukeTimeoutRef.current !== null) {
      window.clearTimeout(nukeTimeoutRef.current);
      nukeTimeoutRef.current = null;
    }
    logAudioDebug("nuke:complete", { source });
    await nukeAppData();
    setIsNuking(false);
    isNukingRef.current = false;
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await refreshTracks();
      } catch {
        if (!mounted) return;
        setTracks([]);
        setCurrentTrackId(null);
      }
    })();

    return () => {
      mounted = false;
      if (nukeTimeoutRef.current !== null) {
        window.clearTimeout(nukeTimeoutRef.current);
        nukeTimeoutRef.current = null;
        isNukingRef.current = false;
      }
      revokeAllMediaUrls();
    };
  }, []);

  useEffect(() => {
    document.title = APP_TITLE;
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(SPLASH_SEEN_KEY) !== "true") setShowSplash(true);
    } catch {
      setShowSplash(true);
    }
    return () => {
      if (splashTimeoutRef.current !== null) {
        window.clearTimeout(splashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_MODE_KEY);
      if (saved === "grid" || saved === "list") setLayoutMode(saved);
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_STATE_SEEN_KEY) !== "1") setShowOpenState(true);
    } catch {
      setShowOpenState(true);
    }
  }, []);

  const finishSplash = () => {
    if (!showSplash || isSplashDismissing) return;
    setIsSplashDismissing(true);
    try {
      localStorage.setItem(SPLASH_SEEN_KEY, "true");
    } catch {
      // Ignore localStorage failures.
    }
    splashTimeoutRef.current = window.setTimeout(() => {
      setShowSplash(false);
      setIsSplashDismissing(false);
      splashTimeoutRef.current = null;
    }, SPLASH_FADE_MS);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const type = event.data?.type;
      if (type === "polyplay:upload-success") {
        setOverlayPage(null);
        void refreshTracks();

        try {
          const audio = new Audio("/hyper-notif.wav");
          audio.volume = 0.85;
          void audio.play();
        } catch {
          // Ignore notification sound failures.
        }
        return;
      }
      if (type === "polyplay:nuke-request" || type === "polyplay:nuke-success") {
        beginNukeSequence();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentTrackId) ?? null,
    [tracks, currentTrackId]
  );
  const hasTracks = tracks.length > 0;
  const currentAudioUrl = currentTrack?.audioUrl ?? null;

  const currentLoop = useMemo(() => {
    if (!currentTrackId) return EMPTY_LOOP;
    return loopByTrack[currentTrackId] ?? EMPTY_LOOP;
  }, [currentTrackId, loopByTrack]);
  const currentLoopMode = useMemo<LoopMode>(() => {
    if (!currentTrackId) return "off";
    return loopModeByTrack[currentTrackId] ?? "off";
  }, [currentTrackId, loopModeByTrack]);

  const dismissOpenState = () => {
    if (!showOpenState) return;
    setShowOpenState(false);
    try {
      localStorage.setItem(OPEN_STATE_SEEN_KEY, "1");
    } catch {
      // Ignore localStorage failures.
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextUrl = currentAudioUrl ?? null;

    if (!nextUrl) {
      logAudioDebug("effect:no-src");
      logAudioDebug("pause() called", { reason: "no-src" });
      audio.pause();
      logAudioDebug("src cleared");
      audio.removeAttribute("src");
      audio.load();
      audioSrcRef.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audioSrcRef.current !== nextUrl) {
      logAudioDebug("pause() called", { reason: "switch-src" });
      audio.pause();
      audio.src = nextUrl;
      audioInstanceSeqRef.current += 1;
      audioInstanceIdRef.current = audioInstanceSeqRef.current;
      logAudioDebug("new src assigned", { src: nextUrl });
      audio.load();
      audioSrcRef.current = nextUrl;
      setCurrentTime(0);
      setDuration(0);
    }

    if (pendingAutoPlayRef.current) {
      pendingAutoPlayRef.current = false;
      logAudioDebug("play() called", { reason: "pending-autoplay" });
      audio
        .play()
        .then(() => {
          logAudioDebug("play() resolved", { reason: "pending-autoplay" });
          setIsPlaying(true);
        })
        .catch((error) => {
          logAudioDebug("play() rejected", { reason: "pending-autoplay", error: String(error) });
          setIsPlaying(false);
        });
    }
  }, [currentTrackId, currentAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = currentLoopMode === "track";
  }, [currentLoopMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const nextTime = audio.currentTime || 0;
      const loopRegion = currentTrackId ? loopByTrack[currentTrackId] : undefined;
      if (currentLoopMode === "region" && loopRegion && loopRegion.end > loopRegion.start) {
        if (nextTime >= loopRegion.end || nextTime < loopRegion.start) {
          audio.currentTime = loopRegion.start;
          setCurrentTime(loopRegion.start);
          return;
        }
      }
      setCurrentTime(nextTime);
    };

    const syncDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      setDuration(nextDuration);
    };
    const onMeta = () => syncDuration();
    const onDurationChange = () => syncDuration();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => setIsPlaying(false);
    const onEnded = () => {
      const loopRegion = currentTrackId ? loopByTrack[currentTrackId] : undefined;
      if (currentLoopMode === "region" && loopRegion && loopRegion.end > loopRegion.start) {
        audio.currentTime = loopRegion.start;
        setCurrentTime(loopRegion.start);
        void audio.play().catch(() => setIsPlaying(false));
        return;
      }
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    logAudioDebug("listeners attached", {
      listeners: ["timeupdate", "loadedmetadata", "durationchange", "play", "pause", "error", "ended"]
    });

    const detachListeners = () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
      logAudioDebug("listeners detached", {
        listeners: ["timeupdate", "loadedmetadata", "durationchange", "play", "pause", "error", "ended"]
      });
    };
    teardownAudioListenersRef.current = detachListeners;

    return () => {
      if (teardownAudioListenersRef.current === detachListeners) {
        teardownAudioListenersRef.current = null;
      }
      detachListeners();
    };
  }, [currentTrackId, loopByTrack, currentLoopMode]);

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

  const playTrack = (trackId: string, autoPlay = true) => {
    logAudioDebug("playTrack() called", { trackId, autoPlay });
    dismissOpenState();
    const selectedTrack = tracks.find((track) => track.id === trackId) ?? null;
    const canPlay = Boolean(selectedTrack?.audioUrl) && !selectedTrack?.missingAudio;
    const audio = audioRef.current;

    if (trackId === currentTrackId) {
      if (autoPlay && canPlay) {
        if (audio && audio.paused) {
          logAudioDebug("play() called", { reason: "same-track" });
          void audio
            .play()
            .then(() => {
              logAudioDebug("play() resolved", { reason: "same-track" });
              setIsPlaying(true);
            })
            .catch((error) => {
              logAudioDebug("play() rejected", { reason: "same-track", error: String(error) });
              setIsPlaying(false);
            });
        }
      }
      return;
    }

    teardownCurrentAudio();
    pendingAutoPlayRef.current = autoPlay && canPlay;
    setCurrentTrackId(trackId);
  };

  const playPrev = () => {
    const prevId = getAdjacentTrackId(tracks, currentTrackId, -1, true);
    if (prevId) playTrack(prevId, true);
  };

  const playNext = () => {
    const nextId = getAdjacentTrackId(tracks, currentTrackId, 1, true);
    if (nextId) playTrack(nextId, true);
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;
    dismissOpenState();

    if (audio.paused) {
      try {
        logAudioDebug("play() called", { reason: "toggle-play" });
        await audio.play();
        logAudioDebug("play() resolved", { reason: "toggle-play" });
      } catch {
        logAudioDebug("play() rejected", { reason: "toggle-play" });
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const effectiveDuration = getSafeDuration(duration) || getSafeDuration(audio.duration);
    audio.currentTime = Math.max(0, Math.min(effectiveDuration, seconds));
    setCurrentTime(audio.currentTime);
  };

  const skip = (delta: number) => seekTo((audioRef.current?.currentTime || 0) + delta);

  const setLoopRange = (start: number, end: number, active: boolean) => {
    if (!currentTrackId) return;
    const audio = audioRef.current;
    const effectiveDuration = getSafeDuration(duration) || getSafeDuration(audio?.duration || 0);
    if (effectiveDuration <= 0) return;
    const safeStart = Math.max(0, Math.min(effectiveDuration, start));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(effectiveDuration, end));
    if (active) {
      if (audio && (audio.currentTime < safeStart || audio.currentTime > safeEnd)) {
        audio.currentTime = safeStart;
        setCurrentTime(safeStart);
      }
    }
    setLoopByTrack((prev) => ({
      ...prev,
      [currentTrackId]: { start: safeStart, end: safeEnd, active: true, editing: false }
    }));
    setLoopModeByTrack((prev) => ({
      ...prev,
      [currentTrackId]: active ? "region" : "off"
    }));
  };

  const setLoopFromCurrent = () => {
    if (!currentTrackId) return;
    const audio = audioRef.current;
    const effectiveDuration = getSafeDuration(duration) || getSafeDuration(audio?.duration || 0);
    if (effectiveDuration <= 0) {
      // iOS/Safari can briefly report unknown duration; fall back to full-track loop.
      setLoopModeByTrack((prev) => ({ ...prev, [currentTrackId]: "track" }));
      setLoopByTrack((prev) => {
        const current = prev[currentTrackId] ?? EMPTY_LOOP;
        return { ...prev, [currentTrackId]: { ...current, active: false, editing: false } };
      });
      return;
    }
    const now = audioRef.current?.currentTime || 0;
    const safeStart = Math.max(0, Math.min(effectiveDuration, now));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(effectiveDuration, safeStart + 5));
    seekTo(safeStart);
    setLoopByTrack((prev) => ({
      ...prev,
      [currentTrackId]: { start: safeStart, end: safeEnd, active: true, editing: false }
    }));
    setLoopModeByTrack((prev) => ({ ...prev, [currentTrackId]: "region" }));
  };

  const toggleLoopMode = () => {
    if (!currentTrackId) return;
    const hasRegion = currentLoop.end > currentLoop.start;
    const nextMode: LoopMode =
      currentLoopMode === "off" ? "track" : currentLoopMode === "track" ? (hasRegion ? "region" : "off") : "off";

    setLoopModeByTrack((prev) => ({ ...prev, [currentTrackId]: nextMode }));
    setLoopByTrack((prev) => {
      const current = prev[currentTrackId] ?? EMPTY_LOOP;
      return {
        ...prev,
        [currentTrackId]: { ...current, active: nextMode === "region", editing: false }
      };
    });

    if (nextMode === "region" && hasRegion) {
      const audio = audioRef.current;
      if (audio && (audio.currentTime < currentLoop.start || audio.currentTime > currentLoop.end)) {
        audio.currentTime = currentLoop.start;
        setCurrentTime(currentLoop.start);
      }
    }
  };

  const clearLoop = () => {
    if (!currentTrackId) return;
    setLoopByTrack((prev) => ({ ...prev, [currentTrackId]: EMPTY_LOOP }));
    setLoopModeByTrack((prev) => ({ ...prev, [currentTrackId]: "off" }));
  };

  const toggleLayoutMode = () => {
    setLayoutMode((prev) => {
      const next = prev === "grid" ? "list" : "grid";
      try {
        localStorage.setItem(LAYOUT_MODE_KEY, next);
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreenPlayerOpen(false);
        setOverlayPage(null);
        setIsTipsOpen(false);
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
      <div
        className={`app touch-clean ${isNuking ? "is-nuking" : ""}`.trim()}
        onAnimationEnd={(event) => {
          if (!isNuking) return;
          if (event.target !== event.currentTarget) return;
          void completeNukeSequence("animationend");
        }}
      >
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src={logo} alt="Polyplay logo" />
            <span>{APP_TITLE}</span>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="help-link nav-action-btn"
              aria-label="Open quick tips"
              onClick={() => setIsTipsOpen(true)}
            >
              <span className="help-icon" aria-hidden="true">
                ?
              </span>
            </button>
            <button
              type="button"
              className="layout-link nav-action-btn"
              aria-label={`Switch to ${layoutMode === "grid" ? "list" : "grid"} layout`}
              onClick={toggleLayoutMode}
            >
              <span className="layout-icon" aria-hidden="true">
                {layoutMode === "grid" ? "≡" : "▦"}
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
          <div className="hint">
            {hasTracks ? "Tap tiles to play • Tap artwork to build aura" : "Upload your first track to get started"}
          </div>
        </header>

        {showOpenState && hasTracks && (
          <section className="open-state-card" role="region" aria-label="Welcome">
            <div className="open-state-card__title">{`Welcome to Polyplay Beta ${APP_VERSION}`}</div>
            <p className="open-state-card__body">Tap a tile to start playback, then use Loop modes from the player bar.</p>
            <button type="button" className="open-state-card__dismiss" onClick={dismissOpenState}>
              Start Listening
            </button>
          </section>
        )}

        {hasTracks ? (
          <TrackGrid
            tracks={tracks}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            layoutMode={layoutMode}
            onSelectTrack={(trackId) => playTrack(trackId, true)}
            onAuraUp={(trackId) => {
              void updateAura(trackId, 1);
            }}
          />
        ) : (
          <EmptyLibraryWelcome
            onUploadFirstTrack={() => setOverlayPage("settings")}
            onOpenTips={() => setIsTipsOpen(true)}
          />
        )}
      </div>

      {hasTracks && (
        <MiniPlayerBar
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          loopRegion={currentLoop}
          loopMode={currentLoopMode}
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
          onToggleLoopMode={toggleLoopMode}
          onClearLoop={clearLoop}
          onOpenFullscreen={() => {
            if (currentTrack) setIsFullscreenPlayerOpen(true);
          }}
        />
      )}

      {currentTrack && isFullscreenPlayerOpen && (
        <FullscreenPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          loopRegion={currentLoop}
          loopMode={currentLoopMode}
          onClose={() => setIsFullscreenPlayerOpen(false)}
          onPrev={playPrev}
          onPlayPause={togglePlayPause}
          onNext={playNext}
          onSeek={seekTo}
          onSetLoopRange={setLoopRange}
          onSetLoop={setLoopFromCurrent}
          onToggleLoopMode={toggleLoopMode}
          onClearLoop={clearLoop}
          onAuraUp={() => {
            if (currentTrackId) void updateAura(currentTrackId, 1);
          }}
          onSkip={skip}
        />
      )}

      {overlayPage && (
        <section className="app-overlay" role="dialog" aria-modal="true" aria-label="settings panel">
          <div className="app-overlay-card">
            <div className="app-overlay-head">
              <div className="app-overlay-title">Settings</div>
              <button
                type="button"
                className="app-overlay-close"
                aria-label="Close panel"
                onClick={() => setOverlayPage(null)}
              >
                ✕
              </button>
            </div>
            <iframe title="Settings" src="/admin.html" className="app-overlay-frame" />
          </div>
        </section>
      )}

      <audio ref={audioRef} preload="metadata" playsInline />

      <QuickTipsModal open={isTipsOpen} onClose={() => setIsTipsOpen(false)} tips={quickTipsContent} />
      {showSplash && <SplashOverlay isDismissing={isSplashDismissing} onComplete={finishSplash} />}
    </>
  );
}
