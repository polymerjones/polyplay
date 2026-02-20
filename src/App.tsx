import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import logo from "../logo.png";
import { quickTipsContent } from "./content/quickTips";
import { APP_TITLE, APP_VERSION } from "./config/version";
import { EmptyLibraryWelcome } from "./components/EmptyLibraryWelcome";
import { FullscreenPlayer } from "./components/FullscreenPlayer";
import { GratitudePrompt } from "./components/GratitudePrompt";
import { JournalModal } from "./components/JournalModal";
import { MiniPlayerBar } from "./components/MiniPlayerBar";
import { QuickTipsModal } from "./components/QuickTipsModal";
import { SplashOverlay } from "./components/SplashOverlay";
import { TrackGrid } from "./components/TrackGrid";
import { clearTracksInDb, getTracksFromDb, saveAuraToDb } from "./lib/db";
import {
  applyImportedPolyplaylistConfig,
  getNextDefaultPolyplaylistName,
  getPolyplaylistConfigFilename,
  serializePolyplaylistConfig
} from "./lib/backup";
import { installDemoPackIfNeeded } from "./lib/demoPack";
import {
  appendGratitudeEntry,
  loadGratitudeSettings,
  loadLastGratitudePromptAt,
  markGratitudePromptShown,
  saveGratitudeSettings,
  shouldShowGratitudePrompt,
  type GratitudeSettings
} from "./lib/gratitude";
import { pickAuraWeightedTrack } from "./lib/aura";
import { getLibrary, getLibraryKeyUsed } from "./lib/library";
import { revokeAllMediaUrls } from "./lib/player/media";
import { loadLibrary } from "./lib/storage/library";
import type { LoopMode, LoopRegion, Track } from "./types";

type DimMode = "normal" | "dim" | "mute";
type ThemeMode = "light" | "dark" | "custom";
type CustomThemeSlot = "crimson" | "teal" | "amber";
type VaultPlaylistInfo = { id: string; name: string; trackCount: number };
type VaultLibraryInspector = {
  libraryKey: string;
  hasLibraryObject: boolean;
  tracksByIdCount: number;
  playlistsByIdCount: number;
  activePlaylistId: string | null;
  activePlaylistTrackCount: number;
  localIdSample: string[];
  playlists: VaultPlaylistInfo[];
};

const EMPTY_LOOP: LoopRegion = { start: 0, end: 0, active: false, editing: false };
const SPLASH_SEEN_KEY = "polyplay_hasSeenSplash";
const SPLASH_SESSION_KEY = "polyplay_hasSeenSplashSession";
const OPEN_STATE_SEEN_KEY = "polyplay_open_state_seen_v102";
const LAYOUT_MODE_KEY = "polyplay_layoutMode";
const THEME_MODE_KEY = "polyplay_themeMode";
const CUSTOM_THEME_SLOT_KEY = "polyplay_customThemeSlot_v1";
const SHUFFLE_ENABLED_KEY = "polyplay_shuffleEnabled";
const REPEAT_TRACK_KEY = "polyplay_repeatTrackEnabled";
const DIM_MODE_KEY = "polyplay_dimMode_v1";
const LOOP_REGION_KEY = "polyplay_loopByTrack";
const LOOP_MODE_KEY = "polyplay_loopModeByTrack";
const SPLASH_FADE_MS = 420;
const HAS_IMPORTED_KEY = "polyplay_hasImported";
const HAS_ONBOARDED_KEY = "polyplay_hasOnboarded_v1";
const ACTIVE_PLAYLIST_DIRTY_KEY = "polyplay_activePlaylistDirty_v1";
const LAST_EXPORTED_PLAYLIST_ID_KEY = "polyplay_lastExportedPlaylistId";
const LAST_EXPORTED_AT_KEY = "polyplay_lastExportedAt";
const SCRATCH_SFX_PATHS = ["/hyper-notif.wav#s1", "/hyper-notif.wav#s2", "/hyper-notif.wav#s3"];

function clampAura(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function getSafeDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function parseLoopByTrack(raw: string | null): Record<string, LoopRegion> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, LoopRegion> = {};
    for (const [trackId, value] of Object.entries(parsed || {})) {
      if (!value || typeof value !== "object") continue;
      const row = value as Partial<LoopRegion>;
      const start = Number(row.start);
      const end = Number(row.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      next[trackId] = {
        start: Math.max(0, start),
        end: Math.max(start + 0.1, end),
        active: Boolean(row.active),
        editing: Boolean(row.editing)
      };
    }
    return next;
  } catch {
    return {};
  }
}

function parseLoopModeByTrack(raw: string | null): Record<string, LoopMode> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, LoopMode> = {};
    for (const [trackId, value] of Object.entries(parsed || {})) {
      if (value === "off" || value === "track" || value === "region") next[trackId] = value;
    }
    return next;
  } catch {
    return {};
  }
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
  const [overlayPage, setOverlayPage] = useState<"settings" | "vault" | null>(null);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [gratitudeSettings, setGratitudeSettings] = useState<GratitudeSettings>(() => loadGratitudeSettings());
  const [isGratitudeOpen, setIsGratitudeOpen] = useState(false);
  const [isGratitudeReactive, setIsGratitudeReactive] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [showJournalTapToast, setShowJournalTapToast] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [customThemeSlot, setCustomThemeSlot] = useState<CustomThemeSlot>("crimson");
  const [themeToggleAnim, setThemeToggleAnim] = useState<"on" | "off" | null>(null);
  const [themeBloomActive, setThemeBloomActive] = useState(false);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [isRepeatTrackEnabled, setIsRepeatTrackEnabled] = useState(false);
  const [dimMode, setDimMode] = useState<DimMode>("normal");
  const [showOpenState, setShowOpenState] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HAS_ONBOARDED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [showSplash, setShowSplash] = useState(false);
  const [isSplashDismissing, setIsSplashDismissing] = useState(false);
  const [isNuking, setIsNuking] = useState(false);
  const [isActivePlaylistDirty, setIsActivePlaylistDirty] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ACTIVE_PLAYLIST_DIRTY_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [vaultStatus, setVaultStatus] = useState("");
  const [importSummary, setImportSummary] = useState<{
    playlistName: string;
    updatedTrackCount: number;
    missingTrackIds: string[];
    reorderedCount: number;
    foundLocallyCount: number;
    totalTrackOrderCount: number;
    targetPlaylistId: string;
    debug: {
      importedTrackOrderCount: number;
      localTracksByIdCount: number;
      matchedCount: number;
      missingCount: number;
      importedIdSample: string[];
      localIdSample: string[];
    };
    sourceMismatch: boolean;
  } | null>(null);
  const [showMissingIds, setShowMissingIds] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [vaultSelectedPlaylistId, setVaultSelectedPlaylistId] = useState<string | null>(null);
  const [vaultInspector, setVaultInspector] = useState<VaultLibraryInspector | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_EXPORTED_AT_KEY);
    } catch {
      return null;
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scratchPlayersRef = useRef<HTMLAudioElement[]>([]);
  const activeScratchRef = useRef<HTMLAudioElement | null>(null);
  const importPolyplaylistInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const audioSrcRef = useRef<string | null>(null);
  const splashTimeoutRef = useRef<number | null>(null);
  const nukeTimeoutRef = useRef<number | null>(null);
  const isNukingRef = useRef(false);
  const nukeFinalizeStartedRef = useRef(false);
  const teardownAudioListenersRef = useRef<(() => void) | null>(null);
  const lastPlayedAtByTrackRef = useRef<Record<string, number>>({});
  const audioInstanceSeqRef = useRef(0);
  const audioInstanceIdRef = useRef(0);
  const themeToggleCooldownRef = useRef(0);
  const themeAnimTimeoutRef = useRef<number | null>(null);
  const themeBloomTimeoutRef = useRef<number | null>(null);
  const gratitudeTypingTimeoutRef = useRef<number | null>(null);
  const journalToastTimeoutRef = useRef<number | null>(null);
  const gratitudeEvaluatedRef = useRef(false);
  const safeTapSeqRef = useRef(0);
  const [safeTapBursts, setSafeTapBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const markActivePlaylistDirty = () => {
    setIsActivePlaylistDirty(true);
    try {
      localStorage.setItem(ACTIVE_PLAYLIST_DIRTY_KEY, "true");
    } catch {
      // Ignore localStorage failures.
    }
  };

  const clearActivePlaylistDirty = () => {
    setIsActivePlaylistDirty(false);
    try {
      localStorage.setItem(ACTIVE_PLAYLIST_DIRTY_KEY, "false");
    } catch {
      // Ignore localStorage failures.
    }
  };

  const refreshActivePlaylistInfo = () => {
    try {
      const library = loadLibrary();
      const activePlaylist = library.activePlaylistId ? library.playlistsById[library.activePlaylistId] : null;
      setActivePlaylistId(activePlaylist?.id || null);
    } catch {
      setActivePlaylistId(null);
    }
  };

  const refreshVaultInspector = async () => {
    const library = await getLibrary();
    const playlists = Object.values(library.playlistsById).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      trackCount: playlist.trackIds.filter((trackId) => Boolean(library.tracksById[trackId])).length
    }));
    const activeId = library.activePlaylistId;
    const activeTrackCount =
      activeId && library.playlistsById[activeId]
        ? library.playlistsById[activeId].trackIds.filter((trackId) => Boolean(library.tracksById[trackId])).length
        : 0;
    setVaultInspector({
      libraryKey: getLibraryKeyUsed(),
      hasLibraryObject: Boolean(library),
      tracksByIdCount: Object.keys(library.tracksById || {}).length,
      playlistsByIdCount: Object.keys(library.playlistsById || {}).length,
      activePlaylistId: activeId,
      activePlaylistTrackCount: activeTrackCount,
      localIdSample: Object.keys(library.tracksById || {}).slice(0, 5),
      playlists
    });
    setVaultSelectedPlaylistId((prev) => {
      if (prev && library.playlistsById[prev]) return prev;
      return activeId;
    });
  };

  const syncPlayerStateFromStorage = () => {
    try {
      const savedLayout = localStorage.getItem(LAYOUT_MODE_KEY);
      if (savedLayout === "grid" || savedLayout === "list") setLayoutMode(savedLayout);
      const savedTheme = localStorage.getItem(THEME_MODE_KEY);
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "custom") {
        setThemeMode(savedTheme);
      }
      const savedCustomThemeSlot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
      if (savedCustomThemeSlot === "crimson" || savedCustomThemeSlot === "teal" || savedCustomThemeSlot === "amber") {
        setCustomThemeSlot(savedCustomThemeSlot);
      }
      setIsShuffleEnabled(localStorage.getItem(SHUFFLE_ENABLED_KEY) === "true");
      setIsRepeatTrackEnabled(localStorage.getItem(REPEAT_TRACK_KEY) === "true");
      setLoopByTrack(parseLoopByTrack(localStorage.getItem(LOOP_REGION_KEY)));
      setLoopModeByTrack(parseLoopModeByTrack(localStorage.getItem(LOOP_MODE_KEY)));
      setGratitudeSettings(loadGratitudeSettings());
    } catch {
      // Ignore localStorage failures.
    }
  };

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
    refreshActivePlaylistInfo();
    void refreshVaultInspector();
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
    clearActivePlaylistDirty();
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
        const seeded = await installDemoPackIfNeeded().catch(() => ({ installed: 0, skipped: 0 }));
        if (seeded.installed > 0) await refreshTracks();
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
      if (gratitudeTypingTimeoutRef.current !== null) {
        window.clearTimeout(gratitudeTypingTimeoutRef.current);
        gratitudeTypingTimeoutRef.current = null;
      }
      if (journalToastTimeoutRef.current !== null) {
        window.clearTimeout(journalToastTimeoutRef.current);
        journalToastTimeoutRef.current = null;
      }
      revokeAllMediaUrls();
    };
  }, []);

  useEffect(() => {
    document.title = APP_TITLE;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; addEventListener?: (type: string, cb: () => void) => void; removeEventListener?: (type: string, cb: () => void) => void };
    };
    const mqSmall = window.matchMedia("(max-width: 900px)");
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = nav.connection;

    const syncPerfMode = () => {
      const useLite = mqSmall.matches || mqReduced.matches || Boolean(connection?.saveData);
      document.body.classList.toggle("perf-lite", useLite);
    };

    const addMqlListener = (mq: MediaQueryList, fn: () => void) => {
      if (typeof mq.addEventListener === "function") mq.addEventListener("change", fn);
      else (mq as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(fn);
    };
    const removeMqlListener = (mq: MediaQueryList, fn: () => void) => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", fn);
      else (mq as MediaQueryList & { removeListener: (cb: () => void) => void }).removeListener(fn);
    };

    syncPerfMode();
    addMqlListener(mqSmall, syncPerfMode);
    addMqlListener(mqReduced, syncPerfMode);
    connection?.addEventListener?.("change", syncPerfMode);

    return () => {
      removeMqlListener(mqSmall, syncPerfMode);
      removeMqlListener(mqReduced, syncPerfMode);
      connection?.removeEventListener?.("change", syncPerfMode);
    };
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_SESSION_KEY) !== "true") setShowSplash(true);
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
      const saved = localStorage.getItem(THEME_MODE_KEY);
      if (saved === "light" || saved === "dark" || saved === "custom") setThemeMode(saved);
      const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
      if (slot === "crimson" || slot === "teal" || slot === "amber") setCustomThemeSlot(slot);
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    try {
      setLoopByTrack(parseLoopByTrack(localStorage.getItem(LOOP_REGION_KEY)));
      setLoopModeByTrack(parseLoopModeByTrack(localStorage.getItem(LOOP_MODE_KEY)));
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOOP_REGION_KEY, JSON.stringify(loopByTrack));
    } catch {
      // Ignore localStorage failures.
    }
  }, [loopByTrack]);

  useEffect(() => {
    try {
      localStorage.setItem(LOOP_MODE_KEY, JSON.stringify(loopModeByTrack));
    } catch {
      // Ignore localStorage failures.
    }
  }, [loopModeByTrack]);

  useEffect(() => {
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      document.body.classList.remove("gratitude-reactive");
      return;
    }
    document.body.classList.toggle("gratitude-reactive", isGratitudeReactive);
    return () => {
      document.body.classList.remove("gratitude-reactive");
    };
  }, [isGratitudeReactive]);

  useEffect(() => {
    try {
      setIsShuffleEnabled(localStorage.getItem(SHUFFLE_ENABLED_KEY) === "true");
      setIsRepeatTrackEnabled(localStorage.getItem(REPEAT_TRACK_KEY) === "true");
      const savedDimMode = localStorage.getItem(DIM_MODE_KEY);
      if (savedDimMode === "normal" || savedDimMode === "dim" || savedDimMode === "mute") {
        setDimMode(savedDimMode);
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", themeMode === "dark");
    document.body.classList.toggle("theme-custom", themeMode === "custom");
    document.body.classList.toggle("theme-custom-crimson", themeMode === "custom" && customThemeSlot === "crimson");
    document.body.classList.toggle("theme-custom-teal", themeMode === "custom" && customThemeSlot === "teal");
    document.body.classList.toggle("theme-custom-amber", themeMode === "custom" && customThemeSlot === "amber");
    return () => {
      document.body.classList.remove("theme-dark");
      document.body.classList.remove("theme-custom");
      document.body.classList.remove("theme-custom-crimson");
      document.body.classList.remove("theme-custom-teal");
      document.body.classList.remove("theme-custom-amber");
      if (themeAnimTimeoutRef.current !== null) {
        window.clearTimeout(themeAnimTimeoutRef.current);
        themeAnimTimeoutRef.current = null;
      }
      if (themeBloomTimeoutRef.current !== null) {
        window.clearTimeout(themeBloomTimeoutRef.current);
        themeBloomTimeoutRef.current = null;
      }
    };
  }, [themeMode, customThemeSlot]);

  useEffect(() => {
    const isDimVibe = dimMode === "dim";
    document.body.classList.toggle("dim-vibe", isDimVibe);
    return () => {
      document.body.classList.remove("dim-vibe");
    };
  }, [dimMode]);

  useEffect(() => {
    try {
      if (localStorage.getItem(HAS_ONBOARDED_KEY) === "true") {
        setShowOpenState(false);
        return;
      }
      const hasImported = localStorage.getItem(HAS_IMPORTED_KEY) === "true";
      if (!hasImported && localStorage.getItem(OPEN_STATE_SEEN_KEY) !== "1") setShowOpenState(true);
    } catch {
      setShowOpenState(true);
    }
  }, []);

  const finishSplash = () => {
    if (!showSplash || isSplashDismissing) return;
    setIsSplashDismissing(true);
    try {
      localStorage.setItem(SPLASH_SEEN_KEY, "true");
      sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
    } catch {
      // Ignore storage failures.
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
        try {
          localStorage.setItem(HAS_IMPORTED_KEY, "true");
        } catch {
          // Ignore localStorage failures.
        }
        markHasOnboarded();
        dismissOpenState();
        setOverlayPage(null);
        markActivePlaylistDirty();
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
        return;
      }
      if (type === "polyplay:close-settings") {
        setOverlayPage(null);
        return;
      }
      if (type === "polyplay:user-imported") {
        try {
          localStorage.setItem(HAS_IMPORTED_KEY, "true");
        } catch {
          // Ignore localStorage failures.
        }
        markHasOnboarded();
        dismissOpenState();
        markActivePlaylistDirty();
        void refreshTracks();
        return;
      }
      if (type === "polyplay:library-updated") {
        markActivePlaylistDirty();
        void refreshTracks();
        return;
      }
      if (type === "polyplay:gratitude-settings-updated") {
        const next = loadGratitudeSettings();
        setGratitudeSettings(next);
        return;
      }
      if (type === "polyplay:custom-theme-slot-updated") {
        const slot = event.data?.slot;
        if (slot === "crimson" || slot === "teal" || slot === "amber") {
          setCustomThemeSlot(slot);
          try {
            localStorage.setItem(CUSTOM_THEME_SLOT_KEY, slot);
          } catch {
            // Ignore localStorage failures.
          }
        }
        return;
      }
      if (type === "polyplay:config-imported") {
        syncPlayerStateFromStorage();
        void refreshTracks();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (gratitudeEvaluatedRef.current) return;
    if (showSplash || isSplashDismissing || isNuking) return;
    const now = Date.now();
    if (shouldShowGratitudePrompt(gratitudeSettings, loadLastGratitudePromptAt(), now)) {
      markGratitudePromptShown(new Date(now).toISOString());
      setIsGratitudeOpen(true);
    }
    gratitudeEvaluatedRef.current = true;
  }, [gratitudeSettings, isNuking, isSplashDismissing, showSplash]);

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

  const markHasOnboarded = () => {
    setHasOnboarded(true);
    try {
      localStorage.setItem(HAS_ONBOARDED_KEY, "true");
    } catch {
      // Ignore localStorage failures.
    }
    dismissOpenState();
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
    audio.loop = currentLoopMode === "track" || (isRepeatTrackEnabled && currentLoopMode !== "region");
  }, [currentLoopMode, isRepeatTrackEnabled]);

  const applyDimMode = (audio: HTMLAudioElement | null, mode: DimMode) => {
    if (!audio) return;
    if (mode === "mute") {
      audio.muted = true;
      return;
    }
    audio.muted = false;
    audio.volume = mode === "dim" ? 0.12 : 1;
  };

  const getDimAudioState = (mode: DimMode): { muted: boolean; volume: number } => {
    if (mode === "mute") return { muted: true, volume: 0 };
    if (mode === "dim") return { muted: false, volume: 0.12 };
    return { muted: false, volume: 1 };
  };

  useEffect(() => {
    const players = SCRATCH_SFX_PATHS.map((src) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      return audio;
    });
    scratchPlayersRef.current = players;
    return () => {
      for (const audio of players) {
        audio.pause();
        audio.src = "";
      }
      activeScratchRef.current = null;
      scratchPlayersRef.current = [];
    };
  }, []);

  const playVinylScratch = () => {
    const players = scratchPlayersRef.current;
    if (!players.length) return;
    const next = players[Math.floor(Math.random() * players.length)];
    const active = activeScratchRef.current;
    if (active) {
      active.pause();
      try {
        active.currentTime = 0;
      } catch {
        // Ignore scrub failures.
      }
    }
    const audioState = getDimAudioState(dimMode);
    next.muted = audioState.muted;
    next.volume = audioState.volume;
    try {
      next.currentTime = 0;
    } catch {
      // Ignore scrub failures.
    }
    void next.play().catch(() => undefined);
    activeScratchRef.current = next;
  };

  useEffect(() => {
    applyDimMode(audioRef.current, dimMode);
  }, [dimMode, currentTrackId, currentAudioUrl]);

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
    const onPlay = () => {
      setIsPlaying(true);
      if (currentTrackId) {
        lastPlayedAtByTrackRef.current[currentTrackId] = Date.now();
      }
    };
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
      if (isRepeatTrackEnabled && currentLoopMode === "off") {
        audio.currentTime = 0;
        setCurrentTime(0);
        void audio.play().catch(() => setIsPlaying(false));
        return;
      }
      if (isShuffleEnabled) {
        const nextId = pickAuraWeightedTrack(
          tracks,
          currentTrackId,
          lastPlayedAtByTrackRef.current,
          Date.now()
        );
        if (nextId) {
          playTrack(nextId, true);
          return;
        }
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
  }, [currentTrackId, loopByTrack, currentLoopMode, isRepeatTrackEnabled, isShuffleEnabled, tracks]);

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
        markActivePlaylistDirty();
      } catch {}
    }
  };

  const triggerAuraPulseForTrack = (trackId: string) => {
    if (!isPlaying) return;
    if (!currentTrackId || currentTrackId !== trackId) return;
    window.dispatchEvent(new CustomEvent("polyplay:aura-trigger"));
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
    const nextId = isShuffleEnabled
      ? pickAuraWeightedTrack(
          tracks,
          currentTrackId,
          lastPlayedAtByTrackRef.current,
          Date.now()
        )
      : getAdjacentTrackId(tracks, currentTrackId, 1, true);
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
    markActivePlaylistDirty();
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
      markActivePlaylistDirty();
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
    markActivePlaylistDirty();
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
    markActivePlaylistDirty();
  };

  const clearLoop = () => {
    if (!currentTrackId) return;
    setLoopByTrack((prev) => ({ ...prev, [currentTrackId]: EMPTY_LOOP }));
    setLoopModeByTrack((prev) => ({ ...prev, [currentTrackId]: "off" }));
    markActivePlaylistDirty();
  };

  const toggleLayoutMode = () => {
    setLayoutMode((prev) => {
      const next = prev === "grid" ? "list" : "grid";
      try {
        localStorage.setItem(LAYOUT_MODE_KEY, next);
      } catch {
        // Ignore localStorage failures.
      }
      markActivePlaylistDirty();
      return next;
    });
  };

  const toggleShuffle = () => {
    setIsShuffleEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SHUFFLE_ENABLED_KEY, next ? "true" : "false");
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
  };

  const toggleRepeatTrack = () => {
    setIsRepeatTrackEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(REPEAT_TRACK_KEY, next ? "true" : "false");
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
  };

  const cycleDimMode = () => {
    setDimMode((prev) => {
      const next: DimMode = prev === "normal" ? "dim" : prev === "dim" ? "mute" : "normal";
      try {
        localStorage.setItem(DIM_MODE_KEY, next);
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
  };

  const setThemeModeExplicit = (next: ThemeMode, event?: MouseEvent<HTMLButtonElement>) => {
    setThemeMode(next);
    try {
      localStorage.setItem(THEME_MODE_KEY, next);
    } catch {
      // Ignore localStorage failures.
    }
    markActivePlaylistDirty();
    try {
      const overlayFrame = document.querySelector<HTMLIFrameElement>(".app-overlay-frame");
      overlayFrame?.contentWindow?.postMessage({ type: "polyplay:theme-changed", themeMode: next }, window.location.origin);
    } catch {
      // Ignore cross-document messaging failures.
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      setThemeToggleAnim(next === "light" ? "off" : "on");
      if (themeAnimTimeoutRef.current !== null) window.clearTimeout(themeAnimTimeoutRef.current);
      themeAnimTimeoutRef.current = window.setTimeout(() => {
        setThemeToggleAnim(null);
        themeAnimTimeoutRef.current = null;
      }, 170);
    }

    const now = Date.now();
    if (now - themeToggleCooldownRef.current < 320) return;
    themeToggleCooldownRef.current = now;

    setThemeBloomActive(true);
    if (themeBloomTimeoutRef.current !== null) window.clearTimeout(themeBloomTimeoutRef.current);
    themeBloomTimeoutRef.current = window.setTimeout(() => {
      setThemeBloomActive(false);
      themeBloomTimeoutRef.current = null;
    }, 320);

    if (!event) return;
    const button = event.currentTarget;
    const burst = document.createElement("span");
    burst.className = "pc-aura-burst";
    for (let i = 0; i < 5; i += 1) {
      const sparkle = document.createElement("span");
      sparkle.className = "pc-aura-burst__spark";
      const angle = (i / 5) * Math.PI * 2;
      sparkle.style.setProperty("--tx", `${Math.cos(angle) * 16}px`);
      sparkle.style.setProperty("--ty", `${Math.sin(angle) * 16}px`);
      sparkle.style.setProperty("--delay", `${i * 28}ms`);
      burst.appendChild(sparkle);
    }
    button.appendChild(burst);
    burst.addEventListener("animationend", () => burst.remove(), { once: true });
  };

  const cycleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const order: ThemeMode[] = ["light", "dark", "custom"];
    const currentIndex = order.indexOf(themeMode);
    const next = order[(currentIndex + 1) % order.length];
    setThemeModeExplicit(next, event);
  };

  const openJournal = (event: MouseEvent<HTMLButtonElement>) => {
    setIsJournalOpen(true);

    const button = event.currentTarget;
    const burst = document.createElement("span");
    burst.className = "pc-aura-burst";
    for (let i = 0; i < 5; i += 1) {
      const sparkle = document.createElement("span");
      sparkle.className = "pc-aura-burst__spark";
      const angle = (i / 5) * Math.PI * 2;
      sparkle.style.setProperty("--tx", `${Math.cos(angle) * 12}px`);
      sparkle.style.setProperty("--ty", `${Math.sin(angle) * 12}px`);
      sparkle.style.setProperty("--delay", `${i * 20}ms`);
      burst.appendChild(sparkle);
    }
    button.appendChild(burst);
    burst.addEventListener("animationend", () => burst.remove(), { once: true });

    const isCoarsePointer =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (!isCoarsePointer) return;
    setShowJournalTapToast(true);
    if (journalToastTimeoutRef.current !== null) window.clearTimeout(journalToastTimeoutRef.current);
    journalToastTimeoutRef.current = window.setTimeout(() => {
      setShowJournalTapToast(false);
      journalToastTimeoutRef.current = null;
    }, 900);
  };

  const onSafeTap = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'button, input, textarea, select, a, [role="button"], .player-controls, .mini-player-bar, .topbar, .track-grid, .app-overlay, .journal-modal, .fullscreen-player-shell'
      )
    ) {
      return;
    }
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const id = ++safeTapSeqRef.current;
    setSafeTapBursts((prev) => [...prev, { id, x: event.clientX, y: event.clientY }]);
    window.setTimeout(() => {
      setSafeTapBursts((prev) => prev.filter((burst) => burst.id !== id));
    }, 520);
  };

  const onGratitudeDoNotSaveChange = (next: boolean) => {
    setGratitudeSettings((prev) => {
      const updated = { ...prev, doNotSaveText: next };
      saveGratitudeSettings(updated);
      return updated;
    });
  };

  const onGratitudeDoNotPromptAgainChange = (next: boolean) => {
    setGratitudeSettings((prev) => {
      const updated = { ...prev, doNotPromptAgain: next };
      saveGratitudeSettings(updated);
      return updated;
    });
  };

  const onGratitudeTyping = () => {
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    setIsGratitudeReactive(true);
    if (gratitudeTypingTimeoutRef.current !== null) window.clearTimeout(gratitudeTypingTimeoutRef.current);
    gratitudeTypingTimeoutRef.current = window.setTimeout(() => {
      setIsGratitudeReactive(false);
      gratitudeTypingTimeoutRef.current = null;
    }, 1000);
  };

  const onGratitudePersist = ({
    text,
    doNotSaveText,
    doNotPromptAgain
  }: {
    text: string;
    doNotSaveText: boolean;
    doNotPromptAgain: boolean;
  }) => {
    const nowIso = new Date().toISOString();
    if (!doNotSaveText) appendGratitudeEntry(text, nowIso);
    setGratitudeSettings((prev) => {
      const updated = { ...prev, doNotSaveText, doNotPromptAgain };
      saveGratitudeSettings(updated);
      return updated;
    });
  };

  const downloadBlobFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportCurrentPolyplaylist = async (): Promise<boolean> => {
    const suggestedName = getNextDefaultPolyplaylistName();
    const input = window.prompt("Name your PolyPlaylist", suggestedName);
    if (input === null) return false;
    const playlistName = input.trim() || suggestedName;
    try {
      const targetPlaylistId = vaultSelectedPlaylistId || activePlaylistId;
      const content = await serializePolyplaylistConfig(playlistName, { playlistId: targetPlaylistId });
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      downloadBlobFile(blob, getPolyplaylistConfigFilename());
      const stamp = new Date().toISOString();
      setLastExportedAt(stamp);
      try {
        localStorage.setItem(LAST_EXPORTED_AT_KEY, stamp);
        if (targetPlaylistId) localStorage.setItem(LAST_EXPORTED_PLAYLIST_ID_KEY, targetPlaylistId);
      } catch {
        // Ignore localStorage failures.
      }
      clearActivePlaylistDirty();
      setVaultStatus(`Exported "${playlistName}".`);
      return true;
    } catch (error) {
      setVaultStatus(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  };

  const onStartImportPolyplaylist = () => {
    const dirty = (() => {
      try {
        return localStorage.getItem(ACTIVE_PLAYLIST_DIRTY_KEY) === "true";
      } catch {
        return isActivePlaylistDirty;
      }
    })();
    if (dirty) {
      setShowImportWarning(true);
      return;
    }
    importPolyplaylistInputRef.current?.click();
  };

  const openSettingsPanel = () => {
    markHasOnboarded();
    setOverlayPage("settings");
  };

  const onImportPolyplaylistFile = async (file: File | null) => {
    if (!file) return;
    try {
      setImportSummary(null);
      setShowMissingIds(false);
      const librarySnapshot = await getLibrary();
      if (tracks.length > 0 && Object.keys(librarySnapshot.tracksById).length === 0) {
        console.warn("[polyplaylist] Import reading empty library — source mismatch bug", {
          renderedTrackCount: tracks.length,
          localTracksByIdCount: 0
        });
        setVaultStatus("Import blocked: library source mismatch (empty tracksById while UI has tracks).");
        return;
      }
      const content = await file.text();
      const targetPlaylistId = vaultSelectedPlaylistId || activePlaylistId || librarySnapshot.activePlaylistId;
      const summary = await applyImportedPolyplaylistConfig(content, { targetPlaylistId });
      syncPlayerStateFromStorage();
      await refreshTracks();
      await refreshVaultInspector();
      clearActivePlaylistDirty();
      setImportSummary({
        playlistName: summary.playlistName,
        updatedTrackCount: summary.updatedTrackCount,
        missingTrackIds: summary.missingTrackIds,
        reorderedCount: summary.reorderedCount,
        foundLocallyCount: summary.foundLocallyCount,
        totalTrackOrderCount: summary.totalTrackOrderCount,
        targetPlaylistId: summary.targetPlaylistId,
        debug: summary.debug,
        sourceMismatch: summary.sourceMismatch
      });
      setShowMissingIds(false);
      if (summary.sourceMismatch) {
        setVaultStatus("Vault cannot see local tracks. This is a library source mismatch. Press Refresh Library.");
        return;
      }
      setVaultStatus(
        summary.updatedTrackCount === 0 && summary.reorderedCount === 0
          ? "Imported file applied 0 changes. Likely reason: none of the track IDs in this file exist on this device."
          : `PolyPlaylist applied. Updated ${summary.updatedTrackCount} tracks. Missing ${summary.missingTrackIds.length} tracks. Reordered ${summary.reorderedCount}.`
      );
    } catch (error) {
      setImportSummary(null);
      setVaultStatus(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
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

  useEffect(() => {
    if (!overlayPage) return;
    setIsFullscreenPlayerOpen(false);
  }, [overlayPage]);

  useEffect(() => {
    if (overlayPage !== "vault") return;
    void refreshVaultInspector();
  }, [overlayPage]);

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
        onClick={onSafeTap}
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
            <div
              className={`theme-triad ${themeToggleAnim ? `is-anim-${themeToggleAnim}` : ""} ${
                themeBloomActive ? "is-bloom" : ""
              }`.trim()}
              role="group"
              aria-label="Theme mode"
            >
              <button
                type="button"
                className={`theme-triad__btn ${themeMode === "light" ? "is-active" : ""}`.trim()}
                onClick={(event) => setThemeModeExplicit("light", event)}
                aria-label="Theme light"
              >
                Light
              </button>
              <button
                type="button"
                className={`theme-triad__btn ${themeMode === "dark" ? "is-active" : ""}`.trim()}
                onClick={(event) => setThemeModeExplicit("dark", event)}
                aria-label="Theme dark"
              >
                Dark
              </button>
              <button
                type="button"
                className={`theme-triad__btn ${themeMode === "custom" ? "is-active" : ""}`.trim()}
                onClick={(event) => setThemeModeExplicit("custom", event)}
                onDoubleClick={cycleTheme}
                aria-label="Theme custom"
              >
                Custom
              </button>
            </div>
            <button
              type="button"
              className={`journal-link nav-action-btn header-icon-btn--hero ${
                isJournalOpen ? "is-active" : ""
              }`.trim()}
              aria-label="Open Journal"
              title="Journal"
              onClick={openJournal}
            >
              <span className="journal-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="journal-icon-svg">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
                  <path d="M8 7h8M8 10h8M8 13h6" />
                </svg>
              </span>
              <span className="journal-tooltip" aria-hidden="true">
                Journal
              </span>
            </button>
            <button
              type="button"
              className={`vault-link nav-action-btn header-icon-btn--hero ${
                overlayPage === "vault" ? "is-active" : ""
              }`.trim()}
              aria-label="Open PolyPlaylist Vault"
              title="Vault"
              onClick={() => {
                setVaultStatus("");
                refreshActivePlaylistInfo();
                setOverlayPage("vault");
              }}
            >
              <span className="vault-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="vault-icon-svg">
                  <path d="M4 4h16v16H4z" />
                  <path d="M7 4h10v6H7z" />
                  <path d="M8 14h8" />
                </svg>
              </span>
              <span className="vault-tooltip" aria-hidden="true">
                Vault
              </span>
            </button>
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
              onClick={openSettingsPanel}
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
              triggerAuraPulseForTrack(trackId);
              void updateAura(trackId, 1);
            }}
          />
        ) : (
          !hasOnboarded && (
            <EmptyLibraryWelcome
              onUploadFirstTrack={openSettingsPanel}
              onOpenTips={() => setIsTipsOpen(true)}
            />
          )
        )}
      </div>

      {hasTracks && !overlayPage && (
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
            if (!currentTrackId) return;
            triggerAuraPulseForTrack(currentTrackId);
            void updateAura(currentTrackId, 1);
          }}
          onSeek={seekTo}
          onSkip={skip}
          shuffleEnabled={isShuffleEnabled}
          repeatTrackEnabled={isRepeatTrackEnabled}
          dimMode={dimMode}
          onToggleShuffle={toggleShuffle}
          onToggleRepeatTrack={toggleRepeatTrack}
          onCycleDimMode={cycleDimMode}
          onVinylScratch={playVinylScratch}
          onSetLoopRange={setLoopRange}
          onSetLoop={setLoopFromCurrent}
          onToggleLoopMode={toggleLoopMode}
          onClearLoop={clearLoop}
          onOpenFullscreen={() => {
            if (currentTrack) setIsFullscreenPlayerOpen(true);
          }}
        />
      )}

      {currentTrack && isFullscreenPlayerOpen && !overlayPage && (
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
          shuffleEnabled={isShuffleEnabled}
          repeatTrackEnabled={isRepeatTrackEnabled}
          dimMode={dimMode}
          onToggleShuffle={toggleShuffle}
          onToggleRepeatTrack={toggleRepeatTrack}
          onCycleDimMode={cycleDimMode}
          onVinylScratch={playVinylScratch}
          onSetLoopRange={setLoopRange}
          onSetLoop={setLoopFromCurrent}
          onToggleLoopMode={toggleLoopMode}
          onClearLoop={clearLoop}
          onAuraUp={() => {
            if (!currentTrackId) return;
            triggerAuraPulseForTrack(currentTrackId);
            void updateAura(currentTrackId, 1);
          }}
          onSkip={skip}
        />
      )}

      {overlayPage === "settings" && (
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

      {overlayPage === "vault" && (
        <section className="app-overlay" role="dialog" aria-modal="true" aria-label="PolyPlaylist Vault">
          <div className="app-overlay-card vault-card">
            <div className="app-overlay-head">
              <div className="app-overlay-title">PolyPlaylist Vault</div>
              <button
                type="button"
                className="app-overlay-close"
                aria-label="Close vault"
                onClick={() => {
                  setShowImportWarning(false);
                  setOverlayPage(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="vault-body">
              <details className="vault-inspector">
                <summary>Library Inspector</summary>
                <div className="vault-inspector__grid">
                  <div>Library key in use: {vaultInspector?.libraryKey || getLibraryKeyUsed()}</div>
                  <div>Has library object: {vaultInspector ? String(vaultInspector.hasLibraryObject) : "false"}</div>
                  <div>tracksById count: {vaultInspector?.tracksByIdCount ?? 0}</div>
                  <div>playlistsById count: {vaultInspector?.playlistsByIdCount ?? 0}</div>
                  <div>activePlaylistId: {vaultInspector?.activePlaylistId || "none"}</div>
                  <div>active playlist track count: {vaultInspector?.activePlaylistTrackCount ?? 0}</div>
                  <div>Local ID sample: {vaultInspector?.localIdSample.join(", ") || "none"}</div>
                </div>
                <div className="vault-inspector__actions">
                  <button type="button" className="vault-btn vault-btn--ghost" onClick={() => void refreshVaultInspector()}>
                    Refresh Library
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      const payload = {
                        libraryKey: vaultInspector?.libraryKey || getLibraryKeyUsed(),
                        hasLibraryObject: vaultInspector?.hasLibraryObject ?? false,
                        tracksByIdCount: vaultInspector?.tracksByIdCount ?? 0,
                        playlistsByIdCount: vaultInspector?.playlistsByIdCount ?? 0,
                        activePlaylistId: vaultInspector?.activePlaylistId ?? null,
                        activePlaylistTrackCount: vaultInspector?.activePlaylistTrackCount ?? 0,
                        localIdSample: vaultInspector?.localIdSample ?? []
                      };
                      try {
                        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        setVaultStatus("Library debug copied.");
                      } catch {
                        setVaultStatus("Copy library debug failed.");
                      }
                    }}
                  >
                    Copy Library Debug
                  </button>
                </div>
              </details>

              <div className="vault-summary">
                <div>
                  <span className="vault-summary__label">Apply Target Playlist</span>
                  <select
                    className="vault-summary__select"
                    value={vaultSelectedPlaylistId || ""}
                    onChange={(event) => setVaultSelectedPlaylistId(event.currentTarget.value || null)}
                  >
                    {(vaultInspector?.playlists || []).map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.name} ({playlist.trackCount})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="vault-summary__label">View</span>
                  <strong>
                    {layoutMode === "grid" ? "Tiles" : "Rows"} ·{" "}
                    {themeMode === "dark" ? "Dark" : themeMode === "custom" ? `Custom (${customThemeSlot})` : "Light"}
                  </strong>
                </div>
                <div>
                  <span className="vault-summary__label">Last Export</span>
                  <strong>{lastExportedAt ? new Date(lastExportedAt).toLocaleString() : "Not exported yet"}</strong>
                </div>
              </div>

              <div className="vault-actions">
                <button type="button" className="vault-btn vault-btn--primary" onClick={() => void exportCurrentPolyplaylist()}>
                  Export PolyPlaylist
                </button>
                <button type="button" className="vault-btn vault-btn--secondary" onClick={onStartImportPolyplaylist}>
                  Import PolyPlaylist
                </button>
                <input
                  ref={importPolyplaylistInputRef}
                  type="file"
                  accept=".polyplaylist.json,application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    void onImportPolyplaylistFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              {showImportWarning && (
                <div className="vault-warning" role="alertdialog" aria-modal="true">
                  <p>Your current playlist has changes not saved to a PolyPlaylist file.</p>
                  <div className="vault-warning__actions">
                    <button
                      type="button"
                      className="vault-btn vault-btn--primary"
                      onClick={async () => {
                        const didExport = await exportCurrentPolyplaylist();
                        if (!didExport) return;
                        setShowImportWarning(false);
                        importPolyplaylistInputRef.current?.click();
                      }}
                    >
                      Export current first
                    </button>
                    <button
                      type="button"
                      className="vault-btn vault-btn--danger"
                      onClick={() => {
                        setShowImportWarning(false);
                        importPolyplaylistInputRef.current?.click();
                      }}
                    >
                      Continue without saving
                    </button>
                    <button
                      type="button"
                      className="vault-btn vault-btn--ghost"
                      onClick={() => setShowImportWarning(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {vaultStatus && <p className="vault-status">{vaultStatus}</p>}
              {importSummary && (
                <div className="vault-import-summary">
                  <div>Updated tracks: {importSummary.updatedTrackCount}</div>
                  <div>Missing track IDs: {importSummary.missingTrackIds.length}</div>
                  <div>Reordered count: {importSummary.reorderedCount}</div>
                  <div>Applied playlist ID: {importSummary.targetPlaylistId}</div>
                  <div>
                    Import/local/matched/missing: {importSummary.debug.importedTrackOrderCount}/
                    {importSummary.debug.localTracksByIdCount}/{importSummary.debug.matchedCount}/
                    {importSummary.debug.missingCount}
                  </div>
                  <div>Imported ID sample: {importSummary.debug.importedIdSample.join(", ") || "none"}</div>
                  <div>Local ID sample: {importSummary.debug.localIdSample.join(", ") || "none"}</div>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      const payload = {
                        playlistId: importSummary.targetPlaylistId,
                        importedTrackOrderCount: importSummary.debug.importedTrackOrderCount,
                        localTracksByIdCount: importSummary.debug.localTracksByIdCount,
                        matchedCount: importSummary.debug.matchedCount,
                        missingCount: importSummary.debug.missingCount,
                        importedIdSample: importSummary.debug.importedIdSample,
                        localIdSample: importSummary.debug.localIdSample
                      };
                      try {
                        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                        setVaultStatus("Import debug copied.");
                      } catch {
                        setVaultStatus("Copy debug failed.");
                      }
                    }}
                  >
                    Copy Debug
                  </button>
                  {importSummary.debug.matchedCount === 0 && (
                    <p className="vault-import-summary__zero">
                      {importSummary.sourceMismatch
                        ? "Vault cannot see local tracks. This is a library source mismatch. Press Refresh Library."
                        : "0 matching IDs found — ID mismatch bug"}
                    </p>
                  )}
                  {!importSummary.sourceMismatch &&
                    importSummary.updatedTrackCount === 0 &&
                    importSummary.reorderedCount === 0 && (
                    <p className="vault-import-summary__zero">
                      Imported file applied 0 changes. Likely reason: none of the track IDs in this file exist on this device.
                    </p>
                    )}
                  {importSummary.missingTrackIds.length > 0 && (
                    <div className="vault-import-summary__missing">
                      <button
                        type="button"
                        className="vault-btn vault-btn--ghost"
                        onClick={() => setShowMissingIds((prev) => !prev)}
                      >
                        {showMissingIds ? "Hide missing IDs" : "View missing IDs"}
                      </button>
                      {showMissingIds && (
                        <pre className="vault-import-summary__ids">{importSummary.missingTrackIds.join("\n")}</pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <audio ref={audioRef} preload="metadata" playsInline />

      <QuickTipsModal open={isTipsOpen} onClose={() => setIsTipsOpen(false)} tips={quickTipsContent} />
      {showSplash && <SplashOverlay isDismissing={isSplashDismissing} onComplete={finishSplash} />}
      <JournalModal open={isJournalOpen} onClose={() => setIsJournalOpen(false)} />
      <GratitudePrompt
        open={isGratitudeOpen}
        doNotSaveText={gratitudeSettings.doNotSaveText}
        doNotPromptAgain={gratitudeSettings.doNotPromptAgain}
        onDoNotSaveTextChange={onGratitudeDoNotSaveChange}
        onDoNotPromptAgainChange={onGratitudeDoNotPromptAgainChange}
        onTyping={onGratitudeTyping}
        onPersist={onGratitudePersist}
        onComplete={() => {
          setIsGratitudeOpen(false);
          setIsGratitudeReactive(false);
        }}
      />
      {showJournalTapToast && <div className="journal-tap-toast">Journal</div>}
      {safeTapBursts.length > 0 && (
        <div className="safe-tap-layer" aria-hidden="true">
          {safeTapBursts.map((burst) => (
            <span key={burst.id} className="safe-tap-burst" style={{ left: burst.x, top: burst.y }} />
          ))}
        </div>
      )}
    </>
  );
}
