import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import logo from "../logo.png";
import { quickTipsContent } from "./content/quickTips";
import { APP_TITLE, APP_VERSION } from "./config/version";
import { AmbientFxCanvas, type AmbientFxCanvasHandle } from "./components/AmbientFxCanvas";
import { EmptyLibraryWelcome } from "./components/EmptyLibraryWelcome";
import { BubbleLayer } from "./components/BubbleLayer";
import { FullscreenPlayer } from "./components/FullscreenPlayer";
import { GratitudePrompt } from "./components/GratitudePrompt";
import { JournalModal } from "./components/JournalModal";
import { MiniPlayerBar } from "./components/MiniPlayerBar";
import { PolyOracleOrb } from "./components/PolyOracleOrb";
import { QuickTipsModal } from "./components/QuickTipsModal";
import { SplashOverlay } from "./components/SplashOverlay";
import { TrackGrid } from "./components/TrackGrid";
import { clearTracksInDb, getTracksFromDb, saveAuraToDb } from "./lib/db";
import {
  exportFullBackup,
  getNextDefaultPolyplaylistName,
  getFullBackupFilename,
  importFullBackup
} from "./lib/backup";
import { seedDemoTracksIfNeeded } from "./lib/demoSeed";
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
import {
  getLibrary,
  getLibraryKeyUsed,
  getLibraryStorageCandidates,
  migrateLegacyLibraryKeys,
  normalizeLibrary,
  setLibrary
} from "./lib/library";
import { revokeAllMediaUrls } from "./lib/player/media";
import { createPlaylistInLibrary, ensureActivePlaylist, setActivePlaylistInLibrary } from "./lib/playlistState";
import type { LibraryState } from "./lib/storage/library";
import type { LoopMode, LoopRegion, Track } from "./types";
import type { AmbientFxMode, AmbientFxQuality } from "./fx/ambientFxEngine";

type DimMode = "normal" | "dim" | "mute";
type ThemeMode = "light" | "dark" | "custom";
type CustomThemeSlot = "crimson" | "teal" | "amber";
type SafeTapVariant = "bubble" | "ring" | "blob" | "sparkle";
type SafeTapBurst = {
  id: number;
  x: number;
  y: number;
  size: number;
  variant: SafeTapVariant;
  color: string;
  durationMs: number;
  opacity: number;
  sparkleCount: number;
};
type VaultPlaylistInfo = { id: string; name: string; trackCount: number };
type VaultLibraryInspector = {
  libraryKey: string;
  runtimeTracksByIdCount: number;
  storageTracksByIdCount: number;
  runtimePlaylistsByIdCount: number;
  storagePlaylistsByIdCount: number;
  runtimeActivePlaylistId: string | null;
  storageActivePlaylistId: string | null;
  runtimeActivePlaylistTrackCount: number;
  storageActivePlaylistTrackCount: number;
  runtimeIdSample: string[];
  storageIdSample: string[];
  candidateKeys: string[];
  migratedFromKey: string | null;
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
const APP_STATE_KEY = "polyplay_app_state_v1";
const SCRATCH_SFX_PATHS = ["/hyper-notif.wav#s1", "/hyper-notif.wav#s2", "/hyper-notif.wav#s3"];
const SAFE_TAP_BASE_SIZE = 120;
const SAFE_TAP_MAX_SIZE = 420;
const SAFE_TAP_MAX_ACTIVE = 12;
const SAFE_TAP_SPAWN_THROTTLE_MS = 40;
const FX_ENABLED_KEY = "polyplay_fxEnabled_v1";
const FX_MODE_KEY = "polyplay_fxMode_v1";
const FX_QUALITY_KEY = "polyplay_fxQuality_v1";
const FX_INTERACTIVE_GUARD_SELECTORS = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "label",
  "[role='button']",
  "[role='menuitem']",
  "[contenteditable='true']",
  ".playerbar",
  ".player-controls",
  ".modal",
  ".panel",
  ".admin",
  ".vault",
  ".journal",
  ".topbar",
  ".trackRow",
  ".tile-hit",
  ".now-playing",
  ".controls",
  ".aux",
  ".app-overlay",
  ".app-overlay-card",
  ".fullscreen-player",
  ".quick-tips-modal",
  ".journal-shell",
  ".journal-modal-shell",
  ".vault-card",
  ".safe-tap-layer",
  ".ambient-fx-canvas",
  ".bubble-layer",
  "[data-bubble-safe='off']"
].join(", ");

function clampAura(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function getSafeDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutQuad(value: number): number {
  const clamped = clamp01(value);
  return 1 - (1 - clamped) * (1 - clamped);
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
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
  const [overlayPage, setOverlayPage] = useState<"settings" | "vault" | "playlists" | null>(null);
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
  const [fxEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(FX_ENABLED_KEY);
      return raw !== "false";
    } catch {
      return true;
    }
  });
  const [fxMode, setFxMode] = useState<AmbientFxMode>(() => {
    try {
      const raw = localStorage.getItem(FX_MODE_KEY);
      if (raw === "gravity" || raw === "pop" || raw === "splatter") return raw;
    } catch {
      // Ignore localStorage failures.
    }
    return "gravity";
  });
  const [fxQuality] = useState<AmbientFxQuality>(() => {
    try {
      const raw = localStorage.getItem(FX_QUALITY_KEY);
      if (raw === "auto" || raw === "lite" || raw === "high") return raw;
    } catch {
      // Ignore localStorage failures.
    }
    return "auto";
  });
  const [fxToast, setFxToast] = useState<string | null>(null);
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
      localPlaylistsByIdCount: number;
      matchedCount: number;
      missingCount: number;
      importedIdSample: string[];
      localIdSample: string[];
      resultingOrderSample: string[];
      activePlaylistId: string | null;
    };
    sourceMismatch: boolean;
  } | null>(null);
  const [showMissingIds, setShowMissingIds] = useState(false);
  const [vaultSelectedPlaylistId, setVaultSelectedPlaylistId] = useState<string | null>(null);
  const [vaultInspector, setVaultInspector] = useState<VaultLibraryInspector | null>(null);
  const [runtimeLibrary, setRuntimeLibrary] = useState<LibraryState | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_EXPORTED_AT_KEY);
    } catch {
      return null;
    }
  });
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("polyplaylist1");
  const [isPlaylistRequired, setIsPlaylistRequired] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scratchPlayersRef = useRef<HTMLAudioElement[]>([]);
  const activeScratchRef = useRef<HTMLAudioElement | null>(null);
  const importUniverseInputRef = useRef<HTMLInputElement | null>(null);
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
  const safeTapHeatRef = useRef(0);
  const safeTapHeatLastUpdatedAtRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now()
  );
  const safeTapLastSpawnAtRef = useRef(0);
  const [safeTapBursts, setSafeTapBursts] = useState<SafeTapBurst[]>([]);
  const ambientFxRef = useRef<AmbientFxCanvasHandle | null>(null);
  const fxToastTimeoutRef = useRef<number | null>(null);
  const activePlaylistId = runtimeLibrary?.activePlaylistId ?? null;

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

  const readStorageLibrarySnapshot = (): LibraryState => {
    try {
      const raw = localStorage.getItem(getLibraryKeyUsed());
      if (!raw) return normalizeLibrary(null);
      return normalizeLibrary(JSON.parse(raw) as unknown);
    } catch {
      return normalizeLibrary(null);
    }
  };

  const persistAppStateSnapshot = (library: LibraryState) => {
    try {
      const playlists = Object.values(library.playlistsById).map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        trackIds: playlist.trackIds
      }));
      localStorage.setItem(
        APP_STATE_KEY,
        JSON.stringify({
          version: APP_VERSION,
          playlists,
          tracksById: library.tracksById,
          lastActivePlaylistId: library.activePlaylistId,
          ui: {
            viewMode: layoutMode,
            dim: dimMode !== "normal",
            theme: themeMode,
            fxMode
          }
        })
      );
    } catch {
      // Ignore localStorage failures.
    }
  };

  const buildInspectorPayload = (runtimeSource: LibraryState, storageSource: LibraryState, migratedFromKey: string | null): VaultLibraryInspector => {
    const playlists = Object.values(runtimeSource.playlistsById).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      trackCount: playlist.trackIds.filter((trackId) => Boolean(runtimeSource.tracksById[trackId])).length
    }));
    const runtimeActiveId = runtimeSource.activePlaylistId;
    const runtimeActiveTrackCount =
      runtimeActiveId && runtimeSource.playlistsById[runtimeActiveId]
        ? runtimeSource.playlistsById[runtimeActiveId].trackIds.filter((trackId) => Boolean(runtimeSource.tracksById[trackId])).length
        : 0;
    const storageActiveId = storageSource.activePlaylistId;
    const storageActiveTrackCount =
      storageActiveId && storageSource.playlistsById[storageActiveId]
        ? storageSource.playlistsById[storageActiveId].trackIds.filter((trackId) => Boolean(storageSource.tracksById[trackId])).length
        : 0;
    return {
      libraryKey: getLibraryKeyUsed(),
      runtimeTracksByIdCount: Object.keys(runtimeSource.tracksById || {}).length,
      storageTracksByIdCount: Object.keys(storageSource.tracksById || {}).length,
      runtimePlaylistsByIdCount: Object.keys(runtimeSource.playlistsById || {}).length,
      storagePlaylistsByIdCount: Object.keys(storageSource.playlistsById || {}).length,
      runtimeActivePlaylistId: runtimeActiveId,
      storageActivePlaylistId: storageActiveId,
      runtimeActivePlaylistTrackCount: runtimeActiveTrackCount,
      storageActivePlaylistTrackCount: storageActiveTrackCount,
      runtimeIdSample: Object.keys(runtimeSource.tracksById || {}).slice(0, 5),
      storageIdSample: Object.keys(storageSource.tracksById || {}).slice(0, 5),
      candidateKeys: getLibraryStorageCandidates().map((candidate) => candidate.key),
      migratedFromKey,
      playlists
    };
  };

  const refreshVaultInspector = async () => {
    const storageLibrary = readStorageLibrarySnapshot();
    const runtimeSource = runtimeLibrary ?? (await getLibrary());
    let resolvedRuntime = runtimeSource;
    let migratedFromKey: string | null = null;
    if (Object.keys(runtimeSource.tracksById || {}).length > 0 && Object.keys(storageLibrary.tracksById || {}).length === 0) {
      setVaultStatus("Tracks exist in memory but not persisted yet - persisting now...");
      setLibrary(runtimeSource);
      resolvedRuntime = runtimeSource;
      migratedFromKey = "runtime-persist";
    }
    const refreshedStorage = readStorageLibrarySnapshot();
    const payload = buildInspectorPayload(resolvedRuntime, refreshedStorage, migratedFromKey);
    setVaultInspector(payload);
    setVaultSelectedPlaylistId((prev) => {
      if (prev && resolvedRuntime.playlistsById[prev]) return prev;
      return resolvedRuntime.activePlaylistId;
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
    let librarySnapshot = await getLibrary();
    const ensured = ensureActivePlaylist(librarySnapshot);
    librarySnapshot = ensured.library;
    if (ensured.changed) setLibrary(librarySnapshot);
    const playlistIds = Object.keys(librarySnapshot.playlistsById || {});
    const loaded = librarySnapshot.activePlaylistId ? await getTracksFromDb() : [];
    setRuntimeLibrary(librarySnapshot);
    setTracks(loaded);
    setIsPlaylistRequired(playlistIds.length === 0);
    if (playlistIds.length === 0) {
      setIsCreatePlaylistModalOpen(true);
      setNewPlaylistName("polyplaylist1");
    }
    void refreshVaultInspector();
    setCurrentTrackId((prev) => {
      if (prev && loaded.some((track) => track.id === prev)) return prev;
      if (prev && !loaded.some((track) => track.id === prev)) {
        teardownCurrentAudio();
      }
      return loaded[0]?.id ?? null;
    });
  };

  const setActivePlaylist = async (playlistId: string) => {
    const source = await getLibrary();
    const applied = setActivePlaylistInLibrary(source, playlistId);
    setLibrary(applied.library);
    window.dispatchEvent(new CustomEvent("polyplay:library-updated"));
    await refreshTracks();
  };

  const createPlaylist = async (name: string) => {
    const nextName = name.trim() || getNextDefaultPolyplaylistName();
    const source = await getLibrary();
    const created = createPlaylistInLibrary(source, nextName);
    setLibrary(created.library);
    setIsCreatePlaylistModalOpen(false);
    setIsPlaylistRequired(false);
    setNewPlaylistName(getNextDefaultPolyplaylistName());
    window.dispatchEvent(new CustomEvent("polyplay:library-updated"));
    await refreshTracks();
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
        const seedResult = await seedDemoTracksIfNeeded().catch(() => ({ seeded: false, reason: "seed-failed" }));
        if (seedResult.seeded) await refreshTracks();
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
    try {
      localStorage.setItem(FX_ENABLED_KEY, fxEnabled ? "true" : "false");
      localStorage.setItem(FX_MODE_KEY, fxMode);
      localStorage.setItem(FX_QUALITY_KEY, fxQuality);
    } catch {
      // Ignore localStorage failures.
    }
  }, [fxEnabled, fxMode, fxQuality]);

  useEffect(() => {
    if (!runtimeLibrary) return;
    persistAppStateSnapshot(runtimeLibrary);
  }, [runtimeLibrary, layoutMode, dimMode, themeMode, fxMode]);

  useEffect(() => {
    if (!fxToast) return;
    if (fxToastTimeoutRef.current !== null) window.clearTimeout(fxToastTimeoutRef.current);
    fxToastTimeoutRef.current = window.setTimeout(() => {
      setFxToast(null);
      fxToastTimeoutRef.current = null;
    }, 800);
    return () => {
      if (fxToastTimeoutRef.current !== null) {
        window.clearTimeout(fxToastTimeoutRef.current);
        fxToastTimeoutRef.current = null;
      }
    };
  }, [fxToast]);

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
    const root = document.documentElement;
    root.setAttribute("data-theme", themeMode);
    root.setAttribute("data-theme-slot", customThemeSlot);
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
      root.removeAttribute("data-theme");
      root.removeAttribute("data-theme-slot");
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
    const isMuted = dimMode === "mute";
    document.body.classList.toggle("dim-vibe", isDimVibe);
    document.body.classList.toggle("mute-freeze", isMuted);
    return () => {
      document.body.classList.remove("dim-vibe");
      document.body.classList.remove("mute-freeze");
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
    const onLibraryUpdated = () => {
      syncPlayerStateFromStorage();
      void refreshTracks();
    };
    window.addEventListener("polyplay:library-updated", onLibraryUpdated as EventListener);
    return () => window.removeEventListener("polyplay:library-updated", onLibraryUpdated as EventListener);
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

  const cycleTheme = (event?: MouseEvent<HTMLButtonElement>) => {
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

  const decaySafeTapHeat = (now: number) => {
    const elapsed = Math.max(0, now - safeTapHeatLastUpdatedAtRef.current);
    if (elapsed <= 0) return safeTapHeatRef.current;
    const decayFactor = Math.pow(0.9, elapsed / 60);
    safeTapHeatRef.current = clamp01(safeTapHeatRef.current * decayFactor);
    safeTapHeatLastUpdatedAtRef.current = now;
    return safeTapHeatRef.current;
  };

  const pickSafeTapVariant = (heat: number): SafeTapVariant => {
    const roll = Math.random();
    if (roll < 0.42) return "bubble";
    if (roll < 0.68) return "ring";
    if (roll < 0.9) return "blob";
    return heat > 0.25 ? "sparkle" : "bubble";
  };

  const pickSafeTapColor = (heat: number): string => {
    const coolPalette = ["#9f7cff", "#b38dff", "#adc8ff"];
    const warmPalette = ["#b68bff", "#ce88ff", "#ef97ff", "#9fc7ff"];
    const palette = heat >= 0.62 ? warmPalette : heat >= 0.34 ? [...warmPalette, ...coolPalette] : coolPalette;
    return palette[Math.floor(Math.random() * palette.length)] ?? "#b38dff";
  };

  const spawnSafeTapBurstAt = (clientX: number, clientY: number) => {
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    decaySafeTapHeat(now);
    safeTapHeatRef.current = clamp01(safeTapHeatRef.current + 0.18);
    if (now - safeTapLastSpawnAtRef.current < SAFE_TAP_SPAWN_THROTTLE_MS) return;
    safeTapLastSpawnAtRef.current = now;
    const heat = safeTapHeatRef.current;
    const easedHeat = easeOutQuad(heat);
    const jitter = Math.round((Math.random() - 0.5) * 28);
    const size = Math.max(SAFE_TAP_BASE_SIZE, Math.min(SAFE_TAP_MAX_SIZE, Math.round(SAFE_TAP_BASE_SIZE + (SAFE_TAP_MAX_SIZE - SAFE_TAP_BASE_SIZE) * easedHeat + jitter)));
    const variant = pickSafeTapVariant(heat);
    const durationMs = Math.max(460, Math.min(820, Math.round(560 + easedHeat * 200 + (Math.random() - 0.5) * 120)));
    const opacity = Math.max(0.1, Math.min(0.35, 0.14 + easedHeat * 0.18 + (Math.random() - 0.5) * 0.03));
    const sparkleCount = variant === "sparkle" ? Math.max(4, Math.min(10, 4 + Math.round(easedHeat * 4) + Math.round(Math.random() * 2))) : 0;
    const id = ++safeTapSeqRef.current;
    const color = pickSafeTapColor(heat);
    setSafeTapBursts((prev) => {
      const next = [
        ...prev.slice(-14),
        { id, x: clientX, y: clientY, size, variant, color, durationMs, opacity, sparkleCount }
      ];
      if (next.length <= SAFE_TAP_MAX_ACTIVE) return next;
      return next.slice(next.length - SAFE_TAP_MAX_ACTIVE);
    });
    window.setTimeout(() => {
      setSafeTapBursts((prev) => prev.filter((burst) => burst.id !== id));
    }, durationMs + 80);
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

  const saveBlobWithBestEffort = async (
    blob: Blob,
    filename: string,
    options?: { accept?: Record<string, string[]>; description?: string }
  ): Promise<"save-dialog" | "downloaded"> => {
    const pickerHost = window as typeof window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    if (typeof pickerHost.showSaveFilePicker === "function") {
      try {
        const handle = await pickerHost.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: options?.description || "Polyplay Backup",
              accept: options?.accept || { "application/octet-stream": [".zip"] }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return "save-dialog";
      } catch {
        // User cancelled or picker unsupported in this context; use browser download fallback.
      }
    }

    downloadBlobFile(blob, filename);
    return "downloaded";
  };

  const saveUniverseBackup = async (): Promise<boolean> => {
    try {
      const payload = await exportFullBackup();
      const filename = getFullBackupFilename();
      const saveMode = await saveBlobWithBestEffort(payload.blob, filename, {
        description: "Polyplay Universe Backup",
        accept: { "application/zip": [".zip"] }
      });
      const stamp = new Date().toISOString();
      setLastExportedAt(stamp);
      try {
        localStorage.setItem(LAST_EXPORTED_AT_KEY, stamp);
        if (activePlaylistId) localStorage.setItem(LAST_EXPORTED_PLAYLIST_ID_KEY, activePlaylistId);
      } catch {
        // Ignore localStorage failures.
      }
      clearActivePlaylistDirty();
      setVaultStatus(
        saveMode === "save-dialog"
          ? `Universe saved as ${filename}.`
          : `Universe saved as ${filename}. Check your browser Downloads folder (or chosen download location).`
      );
      return true;
    } catch (error) {
      setVaultStatus(`Save Universe failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    importUniverseInputRef.current?.click();
  };

  const openSettingsPanel = () => {
    markHasOnboarded();
    setOverlayPage("settings");
  };

  const onLoadUniverseFile = async (file: File | null) => {
    if (!file) return;
    try {
      setImportSummary(null);
      setShowMissingIds(false);
      const summary = await importFullBackup(file);
      window.dispatchEvent(new CustomEvent("polyplay:library-updated"));
      syncPlayerStateFromStorage();
      await refreshTracks();
      await refreshVaultInspector();
      clearActivePlaylistDirty();
      setVaultStatus(
        `Universe loaded. Restored ${summary.restoredTracks} tracks and ${summary.restoredMediaFiles} media files.`
      );
    } catch (error) {
      setImportSummary(null);
      setVaultStatus(`Load Universe failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
  }, [overlayPage, runtimeLibrary]);

  const isAnyModalOpen = Boolean(
    overlayPage || isTipsOpen || isJournalOpen || isGratitudeOpen || showSplash || isFullscreenPlayerOpen || isCreatePlaylistModalOpen
  );
  const bubblesEnabled = false;
  const isMainPlayerView = !isAnyModalOpen;
  const fxAllowed = isMainPlayerView && !isNuking && fxEnabled;

  useEffect(() => {
    if (!fxAllowed) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(FX_INTERACTIVE_GUARD_SELECTORS)) return;
      ambientFxRef.current?.onTap(event.clientX, event.clientY);
    };

    const enablePointerMove = !isCoarsePointer();
    const onPointerMove = (event: PointerEvent) => {
      if (fxMode !== "gravity") return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(FX_INTERACTIVE_GUARD_SELECTORS)) return;
      ambientFxRef.current?.onPointerMove(event.clientX, event.clientY);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    if (enablePointerMove) document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      if (enablePointerMove) document.removeEventListener("pointermove", onPointerMove);
    };
  }, [fxAllowed, fxMode]);

  const cycleFxMode = () => {
    const order: AmbientFxMode[] = ["gravity", "pop", "splatter"];
    const currentIndex = order.indexOf(fxMode);
    const next = order[(currentIndex + 1) % order.length] ?? "gravity";
    setFxMode(next);
    const label = next === "gravity" ? "Gravity" : next === "pop" ? "Pop" : "Splatter";
    setFxToast(`FX: ${label}`);
  };

  return (
    <>
      <div className="app-shell">
        <div className="effects-layer" aria-hidden="true">
          <AmbientFxCanvas
            ref={ambientFxRef}
            allowed={fxAllowed}
            mode={fxMode}
            quality={fxQuality}
            reducedMotion={
              typeof window !== "undefined" &&
              typeof window.matchMedia === "function" &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
            }
          />
          <div
            className={`track-backdrop ${currentTrack?.artUrl || currentTrack?.artGrad ? "is-visible" : ""}`.trim()}
            style={{
              backgroundImage: currentTrack?.artUrl
                ? `url('${currentTrack.artUrl}')`
                : currentTrack?.artGrad || "none"
            }}
          />
          <BubbleLayer enabled={bubblesEnabled} paused={!bubblesEnabled} onSpark={spawnSafeTapBurstAt} />
          {safeTapBursts.length > 0 && (
            <div className="safe-tap-layer">
              {safeTapBursts.map((burst) => (
                <span
                  key={burst.id}
                  className={`safe-tap-burst safe-tap-burst--${burst.variant}`.trim()}
                  style={
                    {
                      left: burst.x,
                      top: burst.y,
                      "--tap-size": `${burst.size}px`,
                      "--tap-color": burst.color,
                      "--tap-duration": `${burst.durationMs}ms`,
                      "--tap-opacity": String(burst.opacity)
                    } as CSSProperties
                  }
                >
                  {burst.sparkleCount > 0 &&
                    Array.from({ length: burst.sparkleCount }).map((_, index) => {
                      const angle = (index / burst.sparkleCount) * Math.PI * 2;
                      const drift = Math.round(18 + (burst.size / 420) * 28);
                      return (
                        <span
                          // eslint-disable-next-line react/no-array-index-key
                          key={`${burst.id}-spark-${index}`}
                          className="safe-tap-burst__spark"
                          style={
                            {
                              "--spark-delay": `${index * 22}ms`,
                              "--spark-x": `${Math.cos(angle) * drift}px`,
                              "--spark-y": `${Math.sin(angle) * drift}px`
                            } as CSSProperties
                          }
                        />
                      );
                    })}
                </span>
              ))}
            </div>
          )}
          {dimMode === "dim" && <div className="effects-dim-overlay" />}
          {dimMode === "mute" && <div className="effects-mute-overlay" />}
        </div>
        <div className="main-ui-layer">
          <div
            className={`app touch-clean ${isNuking ? "is-nuking" : ""}`.trim()}
            onAnimationEnd={(event) => {
              if (!isNuking) return;
              if (event.target !== event.currentTarget) return;
              void completeNukeSequence("animationend");
            }}
          >
        <header className="topbar topbar--two-tier">
          <div className="topbar-tier topbar-tier--primary">
            <div className="brand">
              <img className="brand-logo" src={logo} alt="Polyplay logo" />
            </div>
            <div className="topbar-title">{APP_TITLE}</div>
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
          <div className="topbar-tier topbar-tier--controls">
            <button
              type="button"
              className={`theme-switch ${themeToggleAnim ? `is-anim-${themeToggleAnim}` : ""} ${
                themeBloomActive ? "is-bloom" : ""
              }`.trim()}
              aria-label={`Theme: ${themeMode}`}
              title={`Theme: ${themeMode === "custom" ? `Custom (${customThemeSlot})` : themeMode}`}
              onClick={(event) => cycleTheme(event)}
            >
              <span className="theme-switch__icon" aria-hidden="true">
                {themeMode === "light" ? "☀" : themeMode === "dark" ? "◑" : "✦"}
              </span>
            </button>
            <button
              type="button"
              className={`fx-link nav-action-btn header-icon-btn--hero ${fxEnabled ? "is-active" : ""}`.trim()}
              aria-label={`Ambient FX mode: ${fxMode}`}
              title={`FX: ${fxMode}`}
              onClick={cycleFxMode}
              data-ui="true"
            >
              <span className="fx-icon" aria-hidden="true">FX</span>
            </button>
            <button
              type="button"
              className={`journal-link nav-action-btn header-icon-btn--hero ${
                isJournalOpen ? "is-active" : ""
              }`.trim()}
              aria-label="Open Notes"
              title="Notes"
              onClick={openJournal}
            >
              <span className="journal-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="journal-icon-svg">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
                  <path d="M8 7h8M8 10h8M8 13h6" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              className={`vault-link nav-action-btn header-icon-btn--hero ${
                overlayPage === "vault" ? "is-active" : ""
              }`.trim()}
              aria-label="Save or Load Universe"
              title="Save / Load Universe"
              onClick={() => {
                setVaultStatus("");
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
            </button>
            <PolyOracleOrb />
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
          </div>
          <div className="hint">
            {hasTracks ? "Tap tiles to play • Tap artwork to build aura" : "Create/select a playlist, then upload tracks."}
          </div>
        </header>

        {runtimeLibrary && Object.keys(runtimeLibrary.playlistsById || {}).length > 0 && (
          <section className="playlist-selector" data-ui="true">
            <label htmlFor="current-playlist-select">Current Playlist</label>
            <select
              id="current-playlist-select"
              value={activePlaylistId || ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (value === "__create__") {
                  setNewPlaylistName(getNextDefaultPolyplaylistName());
                  setIsCreatePlaylistModalOpen(true);
                  return;
                }
                void setActivePlaylist(value);
              }}
            >
              {Object.values(runtimeLibrary.playlistsById).map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
              <option value="__create__">Create new playlist…</option>
            </select>
          </section>
        )}

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

      {isCreatePlaylistModalOpen && (
        <section className="app-overlay" role="dialog" aria-modal="true" aria-label="Create playlist">
          <div className="app-overlay-card playlist-create-card">
            <div className="app-overlay-head">
              <div className="app-overlay-title">Create your first playlist</div>
              {!isPlaylistRequired && (
                <button
                  type="button"
                  className="app-overlay-close"
                  aria-label="Close create playlist"
                  onClick={() => setIsCreatePlaylistModalOpen(false)}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="playlist-create-body">
              <p className="playlist-create-copy">
                {isPlaylistRequired
                  ? "Create your first playlist to begin."
                  : "Create a new playlist and set it active."}
              </p>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
                placeholder="polyplaylist1"
                autoFocus
                data-ui="true"
              />
              <div className="playlist-create-actions">
                {!isPlaylistRequired && (
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={() => setIsCreatePlaylistModalOpen(false)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className="vault-btn vault-btn--primary"
                  onClick={() => void createPlaylist(newPlaylistName)}
                >
                  Create Playlist
                </button>
              </div>
            </div>
          </div>
        </section>
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
                  <div>Runtime tracksById count: {vaultInspector?.runtimeTracksByIdCount ?? 0}</div>
                  <div>Storage tracksById count: {vaultInspector?.storageTracksByIdCount ?? 0}</div>
                  <div>Runtime playlistsById count: {vaultInspector?.runtimePlaylistsByIdCount ?? 0}</div>
                  <div>Storage playlistsById count: {vaultInspector?.storagePlaylistsByIdCount ?? 0}</div>
                  <div>Runtime activePlaylistId: {vaultInspector?.runtimeActivePlaylistId || "none"}</div>
                  <div>Storage activePlaylistId: {vaultInspector?.storageActivePlaylistId || "none"}</div>
                  <div>Runtime active track count: {vaultInspector?.runtimeActivePlaylistTrackCount ?? 0}</div>
                  <div>Storage active track count: {vaultInspector?.storageActivePlaylistTrackCount ?? 0}</div>
                  <div>Runtime ID sample: {vaultInspector?.runtimeIdSample.join(", ") || "none"}</div>
                  <div>Storage ID sample: {vaultInspector?.storageIdSample.join(", ") || "none"}</div>
                  <div>Candidate keys: {vaultInspector?.candidateKeys.join(", ") || "none"}</div>
                  <div>Migrated from: {vaultInspector?.migratedFromKey || "none"}</div>
                </div>
                <div className="vault-inspector__actions">
                  <button type="button" className="vault-btn vault-btn--ghost" onClick={() => void refreshVaultInspector()}>
                    Refresh Library
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      const source = runtimeLibrary ?? (await getLibrary());
                      setLibrary(source);
                      setVaultStatus("Library persisted to canonical storage key.");
                      await refreshVaultInspector();
                    }}
                  >
                    Persist Now
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      const migration = migrateLegacyLibraryKeys();
                      setVaultStatus(
                        migration.migrated && migration.fromKey
                          ? `Migrated legacy key "${migration.fromKey}" into ${getLibraryKeyUsed()}.`
                          : "No legacy migration needed."
                      );
                      const latest = await getLibrary();
                      setRuntimeLibrary(latest);
                      await refreshVaultInspector();
                    }}
                  >
                    Migrate Legacy Keys
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      await refreshTracks();
                      await refreshVaultInspector();
                      setVaultStatus("Library hard refresh complete.");
                    }}
                  >
                    Hard Refresh Library
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      const shouldReload = window.confirm(
                        "Hard refresh did not reconcile state. Reload the app now as fallback?"
                      );
                      if (!shouldReload) return;
                      window.location.reload();
                    }}
                  >
                    Reload Fallback
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      const payload = {
                        libraryKey: vaultInspector?.libraryKey || getLibraryKeyUsed(),
                        runtimeTracksByIdCount: vaultInspector?.runtimeTracksByIdCount ?? 0,
                        storageTracksByIdCount: vaultInspector?.storageTracksByIdCount ?? 0,
                        runtimePlaylistsByIdCount: vaultInspector?.runtimePlaylistsByIdCount ?? 0,
                        storagePlaylistsByIdCount: vaultInspector?.storagePlaylistsByIdCount ?? 0,
                        runtimeActivePlaylistId: vaultInspector?.runtimeActivePlaylistId ?? null,
                        storageActivePlaylistId: vaultInspector?.storageActivePlaylistId ?? null,
                        runtimeIdSample: vaultInspector?.runtimeIdSample ?? [],
                        storageIdSample: vaultInspector?.storageIdSample ?? [],
                        candidateKeys: vaultInspector?.candidateKeys ?? [],
                        migratedFromKey: vaultInspector?.migratedFromKey ?? null
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
                  <span className="vault-summary__label">Active vs Selected</span>
                  <strong>{activePlaylistId || "none"} → {vaultSelectedPlaylistId || "none"}</strong>
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
                <button type="button" className="vault-btn vault-btn--primary" onClick={() => void saveUniverseBackup()}>
                  Save Universe
                </button>
                <button type="button" className="vault-btn vault-btn--secondary" onClick={onStartImportPolyplaylist}>
                  Load Universe
                </button>
                <input
                  ref={importUniverseInputRef}
                  type="file"
                  accept="application/zip,.zip"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    void onLoadUniverseFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              {showImportWarning && (
                <div className="vault-warning" role="alertdialog" aria-modal="true">
                  <p>Your current playlist has changes not saved to a Universe backup.</p>
                  <div className="vault-warning__actions">
                    <button
                      type="button"
                      className="vault-btn vault-btn--primary"
                      onClick={async () => {
                        const didExport = await saveUniverseBackup();
                        if (!didExport) return;
                        setShowImportWarning(false);
                        importUniverseInputRef.current?.click();
                      }}
                    >
                      Save universe first
                    </button>
                    <button
                      type="button"
                      className="vault-btn vault-btn--danger"
                      onClick={() => {
                        setShowImportWarning(false);
                        importUniverseInputRef.current?.click();
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
                  <div>Local playlists count: {importSummary.debug.localPlaylistsByIdCount}</div>
                  <div>Active playlist ID: {importSummary.debug.activePlaylistId || "none"}</div>
                  <div>Imported ID sample: {importSummary.debug.importedIdSample.join(", ") || "none"}</div>
                  <div>Local ID sample: {importSummary.debug.localIdSample.join(", ") || "none"}</div>
                  <div>Resulting order sample: {importSummary.debug.resultingOrderSample.join(", ") || "none"}</div>
                  <button
                    type="button"
                    className="vault-btn vault-btn--ghost"
                    onClick={async () => {
                      const payload = {
                        playlistId: importSummary.targetPlaylistId,
                        importedTrackOrderCount: importSummary.debug.importedTrackOrderCount,
                        localTracksByIdCount: importSummary.debug.localTracksByIdCount,
                        localPlaylistsByIdCount: importSummary.debug.localPlaylistsByIdCount,
                        matchedCount: importSummary.debug.matchedCount,
                        missingCount: importSummary.debug.missingCount,
                        importedIdSample: importSummary.debug.importedIdSample,
                        localIdSample: importSummary.debug.localIdSample,
                        resultingOrderSample: importSummary.debug.resultingOrderSample,
                        activePlaylistId: importSummary.debug.activePlaylistId
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
      {fxToast && <div className="fx-toast">{fxToast}</div>}
        </div>
      </div>
    </>
  );
}
