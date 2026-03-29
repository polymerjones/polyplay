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
import { getAllTracksFromDb, hardResetLibraryInDb, saveAuraToDb } from "./lib/db";
import {
  BackupSizeError,
  countNonDemoTracksForFullBackup,
  exportFullBackup,
  formatByteCount,
  getFullBackupFilename,
  MIN_FULL_BACKUP_USER_TRACKS,
  importFullBackup
} from "./lib/backup";
import { normalizeDemoLibrary, restoreDemoTracks, seedDemoTracksIfNeeded } from "./lib/demoSeed";
import {
  DEFAULT_GRATITUDE_SETTINGS,
  GRATITUDE_ENTRIES_KEY,
  GRATITUDE_LAST_PROMPT_KEY,
  GRATITUDE_SETTINGS_KEY,
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
  normalizeLibrary,
  setLibrary
} from "./lib/library";
import {
  addIosNowPlayingRemoteCommandListener,
  clearIosNowPlaying,
  setIosNowPlayingItem,
  updateIosNowPlayingPlaybackState
} from "./lib/iosNowPlaying";
import { fireAuraHaptic, fireHeavyHaptic, fireLightHaptic, fireSuccessHaptic } from "./lib/haptics";
import { bindMediaSessionTransportActions, syncMediaSessionItem, syncMediaSessionPlaybackState } from "./lib/mediaSession";
import { revokeAllMediaUrls } from "./lib/player/media";
import {
  createPlaylistInLibrary,
  ensureActivePlaylist,
  getVisibleTracksFromLibrary,
  setActivePlaylistInLibrary
} from "./lib/playlistState";
import { saveBlobWithBestEffort } from "./lib/saveBlob";
import type { LibraryState } from "./lib/storage/library";
import type { LoopMode, LoopRegion, RepeatTrackMode, Track } from "./types";
import type { AmbientFxMode, AmbientFxQuality } from "./fx/ambientFxEngine";

type DimMode = "normal" | "dim" | "mute";
type ThemeMode = "light" | "dark" | "custom";
type CustomThemeSlot = "crimson" | "teal" | "amber";
type ThemeSelection = "dark" | "light" | "amber" | "teal" | "crimson";
type QuickTourPhase = "create-playlist" | "upload-track" | null;
type VaultToastTone = "info" | "success" | "error";
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
const EMPTY_LOOP: LoopRegion = { start: 0, end: 0, active: false, editing: false };
const SPLASH_SEEN_KEY = "polyplay_hasSeenSplash";
const SPLASH_SESSION_KEY = "polyplay_hasSeenSplashSession";
const DEMO_PLAYLIST_ID = "polyplaylist-demo";
const DEMO_PLAYLIST_NAME = "demo playlist";
const DEMO_TRACK_IDS = new Set(["first-run-demo", "first-run-demo-1", "first-run-demo-2"]);
const OPEN_STATE_SEEN_KEY = "polyplay_open_state_seen_v102";
const LAYOUT_MODE_KEY = "polyplay_layoutMode";
const THEME_MODE_KEY = "polyplay_themeMode";
const CUSTOM_THEME_SLOT_KEY = "polyplay_customThemeSlot_v1";
const AURA_COLOR_KEY = "polyplay_auraColor_v1";
const SHUFFLE_ENABLED_KEY = "polyplay_shuffleEnabled";
const REPEAT_TRACK_KEY = "polyplay_repeatTrackMode";
const DIM_MODE_KEY = "polyplay_dimMode_v1";
const NOVELTY_MODE_KEY = "polyplay_noveltyMode_v1";
const LOOP_REGION_KEY = "polyplay_loopByTrack";
const LOOP_MODE_KEY = "polyplay_loopModeByTrack";
const SPLASH_FADE_MS = 420;
const HAS_IMPORTED_KEY = "polyplay_hasImported";
const HAS_ONBOARDED_KEY = "polyplay_hasOnboarded_v1";
const ACTIVE_PLAYLIST_DIRTY_KEY = "polyplay_activePlaylistDirty_v1";
const LAST_EXPORTED_PLAYLIST_ID_KEY = "polyplay_lastExportedPlaylistId";
const LAST_EXPORTED_AT_KEY = "polyplay_lastExportedAt";
const FULLSCREEN_ART_HINT_SEEN_KEY = "polyplay_hasSeenFullscreenArtHint_v1";
const PLAYER_COMPACT_HINT_SEEN_KEY = "polyplay_hasSeenPlayerCompactHint_v1";
const PLAYER_VIBE_HINT_SEEN_KEY = "polyplay_hasSeenPlayerVibeHint_v1";
const PLAYER_DIM_HINT_SEEN_KEY = "polyplay_hasSeenPlayerDimHint_v1";
const LAYOUT_TOGGLE_HINT_SEEN_KEY = "polyplay_hasSeenLayoutToggleHint_v1";
const NEW_PLAYLIST_HINT_SEEN_KEY = "polyplay_hasSeenNewPlaylistHint_v1";
const UPLOAD_HINT_SEEN_KEY = "polyplay_hasSeenUploadHint_v1";
const APP_STATE_KEY = "polyplay_app_state_v1";
const SCRATCH_SFX_PATHS = ["/hyper-notif.wav#s1", "/hyper-notif.wav#s2", "/hyper-notif.wav#s3"];
const SAFE_TAP_BASE_SIZE = 120;
const SAFE_TAP_MAX_SIZE = 420;
const SAFE_TAP_MAX_ACTIVE = 12;
const SAFE_TAP_SPAWN_THROTTLE_MS = 40;
const UI_CURRENT_TIME_THROTTLE_MS = 80;
const UI_CURRENT_TIME_MIN_DELTA_SEC = 0.08;
const FX_ENABLED_KEY = "polyplay_fxEnabled_v1";
const FX_MODE_KEY = "polyplay_fxMode_v1";
const FX_QUALITY_KEY = "polyplay_fxQuality_v1";
const CURRENT_TRACK_ID_KEY = "polyplay_currentTrackId_v1";
const IOS_NOW_PLAYING_APP_TITLE = "PolyPlay Audio";
const THEME_PACK_AURA_COLORS: Record<CustomThemeSlot, string> = {
  crimson: "#cf6f82",
  teal: "#42c7c4",
  amber: "#f0b35b"
};
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
  return Math.max(0, Math.min(10, Math.round(value)));
}

function normalizeAuraColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

function auraHexToRgb(value: string): string {
  const normalized = normalizeAuraColor(value);
  if (!normalized) return "188, 132, 255";
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function getThemeSelection(mode: ThemeMode, slot: CustomThemeSlot): ThemeSelection {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return slot;
}

function getThemeLabel(selection: ThemeSelection): string {
  if (selection === "dark") return "Default (Dark)";
  if (selection === "light") return "Light";
  if (selection === "amber") return "Amber";
  if (selection === "teal") return "Teal";
  return "Crimson";
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

function normalizeDimModeForPlatform(mode: DimMode, isIOS: boolean): DimMode {
  if (isIOS && mode === "dim") return "normal";
  return mode;
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

function isFxReducedMotionContext(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  const saveData =
    typeof navigator !== "undefined" && "connection" in navigator
      ? Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
      : false;
  return saveData && isCoarsePointer();
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

function parseRepeatTrackMode(raw: string | null): RepeatTrackMode {
  if (raw === "threepeat") return "threepeat";
  if (raw === "loop-one" || raw === "true") return "loop-one";
  return "off";
}

function getStoredRepeatTrackMode(): RepeatTrackMode {
  try {
    const next = localStorage.getItem(REPEAT_TRACK_KEY);
    if (next !== null) return parseRepeatTrackMode(next);
    return parseRepeatTrackMode(localStorage.getItem("polyplay_repeatTrackEnabled"));
  } catch {
    return "off";
  }
}

export default function App() {
  const VAULT_SWIPE_CLOSE_DISTANCE_PX = 140;
  const VAULT_SWIPE_CLOSE_MAX_SIDEWAYS_PX = 72;
  const VAULT_SWIPE_CLOSE_MIN_VELOCITY = 0.42;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopByTrack, setLoopByTrack] = useState<Record<string, LoopRegion>>({});
  const [loopModeByTrack, setLoopModeByTrack] = useState<Record<string, LoopMode>>({});
  const [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen] = useState(false);
  const [overlayPage, setOverlayPage] = useState<"settings" | "vault" | "playlists" | null>(null);
  const [settingsPanelMode, setSettingsPanelMode] = useState<"upload" | "manage">("upload");
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [gratitudeSettings, setGratitudeSettings] = useState<GratitudeSettings>(() => loadGratitudeSettings());
  const [isGratitudeOpen, setIsGratitudeOpen] = useState(false);
  const [isGratitudeReactive, setIsGratitudeReactive] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [showJournalTapToast, setShowJournalTapToast] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [customThemeSlot, setCustomThemeSlot] = useState<CustomThemeSlot>("crimson");
  const [auraColor, setAuraColor] = useState<string | null>(() => {
    try {
      return normalizeAuraColor(localStorage.getItem(AURA_COLOR_KEY));
    } catch {
      return null;
    }
  });
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
  const [allTracksCatalog, setAllTracksCatalog] = useState<Track[]>([]);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(() =>
    typeof document === "undefined" ? true : !document.hidden
  );
  const [isPlayerCompact, setIsPlayerCompact] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(min-width: 900px)").matches;
  });
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [repeatTrackMode, setRepeatTrackMode] = useState<RepeatTrackMode>(() => getStoredRepeatTrackMode());
  const [dimMode, setDimMode] = useState<DimMode>("normal");
  const [noveltyMode, setNoveltyMode] = useState<DimMode>("normal");
  const [showOpenState, setShowOpenState] = useState(false);
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const splashSkipLabel = isIOS ? "Double Tap to Skip" : "Double Click to Skip";
  const headerTitle = "PolyPlay Audio";
  const headerVersion = APP_VERSION;
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HAS_ONBOARDED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      const hasImported = localStorage.getItem(HAS_IMPORTED_KEY) === "true";
      const hasOnboarded = localStorage.getItem(HAS_ONBOARDED_KEY) === "true";
      if (!hasImported && !hasOnboarded) return true;
      const skipAlways = localStorage.getItem(SPLASH_SEEN_KEY) === "true";
      const seenSession = sessionStorage.getItem(SPLASH_SESSION_KEY) === "true";
      return !skipAlways && !seenSession;
    } catch {
      return true;
    }
  });
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
  const [vaultToast, setVaultToastState] = useState<{ message: string; tone: VaultToastTone } | null>(null);
  const [vaultImportCloseCountdownMs, setVaultImportCloseCountdownMs] = useState<number | null>(null);
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
  const [runtimeLibrary, setRuntimeLibrary] = useState<LibraryState | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_EXPORTED_AT_KEY);
    } catch {
      return null;
    }
  });
  const [hasSeenFullscreenArtHint, setHasSeenFullscreenArtHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(FULLSCREEN_ART_HINT_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hasSeenPlayerCompactHint, setHasSeenPlayerCompactHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PLAYER_COMPACT_HINT_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hasSeenPlayerVibeHint, setHasSeenPlayerVibeHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PLAYER_VIBE_HINT_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hasSeenPlayerDimHint, setHasSeenPlayerDimHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PLAYER_DIM_HINT_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hasSeenLayoutToggleHint, setHasSeenLayoutToggleHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LAYOUT_TOGGLE_HINT_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hasSeenNewPlaylistHint, setHasSeenNewPlaylistHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NEW_PLAYLIST_HINT_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hasSeenUploadHint, setHasSeenUploadHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(UPLOAD_HINT_SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isPlaylistRequired, setIsPlaylistRequired] = useState(false);
  const [isEmptyWelcomeDismissed, setIsEmptyWelcomeDismissed] = useState(false);
  const [quickTourPhase, setQuickTourPhase] = useState<QuickTourPhase>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playbackGainNodeRef = useRef<GainNode | null>(null);
  const scratchPlayersRef = useRef<HTMLAudioElement[]>([]);
  const activeScratchRef = useRef<HTMLAudioElement | null>(null);
  const importUniverseInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const pendingAutoPlayTrackIdRef = useRef<string | null>(null);
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
  const vaultToastTimeoutRef = useRef<number | null>(null);
  const vaultImportCloseTimeoutRef = useRef<number | null>(null);
  const vaultImportCloseIntervalRef = useRef<number | null>(null);
  const vaultSwipeStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const loopDragResumeTimeoutRef = useRef<number | null>(null);
  const loopDragWasPlayingRef = useRef(false);
  const playbackResyncInFlightRef = useRef(false);
  const playbackResyncTimeoutRef = useRef<number | null>(null);
  const lastPlaybackResyncAtRef = useRef(0);
  const lastUiCurrentTimeCommitAtRef = useRef(0);
  const lastUiCurrentTimeValueRef = useRef(0);
  const currentTrackIdRef = useRef<string | null>(null);
  const allTracksRef = useRef<Track[]>([]);
  const threepeatRemainingRef = useRef(0);
  const nowPlayingItemSyncSeqRef = useRef(0);
  const lastNowPlayingPlaybackSyncRef = useRef<{
    trackId: string | null;
    elapsedTime: number;
    duration: number;
    isPlaying: boolean;
  } | null>(null);
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
  const returnToCompactAfterClearRef = useRef(false);
  const activePlaylistId = runtimeLibrary?.activePlaylistId ?? null;
  const activePlaylistName =
    (activePlaylistId && runtimeLibrary?.playlistsById?.[activePlaylistId]?.name) || "None";

  useEffect(() => {
    currentTrackIdRef.current = currentTrackId;
  }, [currentTrackId]);

  useEffect(() => {
    try {
      if (currentTrackId) {
        localStorage.setItem(CURRENT_TRACK_ID_KEY, currentTrackId);
      } else {
        localStorage.removeItem(CURRENT_TRACK_ID_KEY);
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, [currentTrackId]);

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

  const refreshVaultInspector = async () => {
    const storageLibrary = readStorageLibrarySnapshot();
    const runtimeSource = runtimeLibrary ?? (await getLibrary());
    if (Object.keys(runtimeSource.tracksById || {}).length > 0 && Object.keys(storageLibrary.tracksById || {}).length === 0) {
      setVaultStatus("Tracks exist in memory but not persisted yet - persisting now...");
      setLibrary(runtimeSource);
    }
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
      setAuraColor(normalizeAuraColor(localStorage.getItem(AURA_COLOR_KEY)));
      setIsShuffleEnabled(localStorage.getItem(SHUFFLE_ENABLED_KEY) === "true");
      setRepeatTrackMode(getStoredRepeatTrackMode());
      const savedDimMode = localStorage.getItem(DIM_MODE_KEY);
      if (savedDimMode === "normal" || savedDimMode === "dim" || savedDimMode === "mute") {
        setDimMode(normalizeDimModeForPlatform(savedDimMode, isIOS));
      }
      const savedNoveltyMode = localStorage.getItem(NOVELTY_MODE_KEY);
      if (savedNoveltyMode === "normal" || savedNoveltyMode === "dim" || savedNoveltyMode === "mute") {
        setNoveltyMode(savedNoveltyMode);
      }
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

  const refreshTracks = async (options?: { allowEmptyDemoFallback?: boolean }) => {
    const allowEmptyDemoFallback = options?.allowEmptyDemoFallback !== false;
    let librarySnapshot = await getLibrary();
    const ensured = ensureActivePlaylist(librarySnapshot);
    librarySnapshot = ensured.library;
    if (ensured.changed) setLibrary(librarySnapshot);
    const playlistIds = Object.keys(librarySnapshot.playlistsById || {});
    const allTracks = await getAllTracksFromDb();
    const allTracksById = allTracks.reduce<Record<string, Track>>((acc, track) => {
      acc[track.id] = track;
      return acc;
    }, {});
    allTracksRef.current = allTracks;
    setAllTracksCatalog(allTracks);
    let loaded = getVisibleTracksFromLibrary(librarySnapshot, allTracksById);
    if (loaded.length === 0 && allTracks.length > 0) {
      // Recovery path: only correct invalid active playlist pointers.
      // Do not auto-inject all tracks into empty playlists (breaks playlist isolation).
      const activeId = librarySnapshot.activePlaylistId;
      const hasValidActive = Boolean(activeId && librarySnapshot.playlistsById[activeId]);
      if (!hasValidActive) {
        const firstPlaylistId = Object.keys(librarySnapshot.playlistsById || {})[0] ?? null;
        if (firstPlaylistId) {
          librarySnapshot = {
            ...librarySnapshot,
            activePlaylistId: firstPlaylistId
          };
          setLibrary(librarySnapshot);
          loaded = getVisibleTracksFromLibrary(librarySnapshot, allTracksById);
        }
      } else if (activeId && allowEmptyDemoFallback) {
        const activePlaylist = librarySnapshot.playlistsById[activeId];
        const activeName = (activePlaylist?.name || "").trim().toLowerCase();
        const isEmptyDemo = activePlaylist?.trackIds?.length === 0 && (activeId === DEMO_PLAYLIST_ID || activeName === DEMO_PLAYLIST_NAME);
        if (isEmptyDemo) {
          const fallback = Object.values(librarySnapshot.playlistsById || {}).find(
            (playlist) => playlist.id !== activeId && playlist.trackIds.some((trackId) => Boolean(allTracksById[trackId]))
          );
          if (fallback) {
            librarySnapshot = {
              ...librarySnapshot,
              activePlaylistId: fallback.id
            };
            setLibrary(librarySnapshot);
            loaded = getVisibleTracksFromLibrary(librarySnapshot, allTracksById);
          }
        }
      }
    }
    setRuntimeLibrary(librarySnapshot);
    setTracks(loaded);
    setIsPlaylistRequired(playlistIds.length === 0);
    if (playlistIds.length === 0) {
      setIsCreatePlaylistModalOpen(true);
      setNewPlaylistName("");
    }
    void refreshVaultInspector();
    setCurrentTrackId((prev) => {
      if (prev && allTracksById[prev]) {
        return prev;
      }
      if (prev) {
        teardownCurrentAudio();
      }
      return loaded[0]?.id ?? null;
    });
  };

  const setActivePlaylist = async (playlistId: string) => {
    const source = await getLibrary();
    const applied = setActivePlaylistInLibrary(source, playlistId);
    if (!applied.library.playlistsById[playlistId]) return;
    setLibrary(applied.library);
    setRuntimeLibrary(applied.library);
    window.dispatchEvent(new CustomEvent("polyplay:library-updated"));
    await refreshTracks({ allowEmptyDemoFallback: false });
  };

  const createPlaylist = async (name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    const source = await getLibrary();
    const existingUserPlaylistCount = Object.values(source.playlistsById || {}).filter((playlist) => {
      const normalizedName = playlist.name.trim().toLowerCase();
      return playlist.id !== DEMO_PLAYLIST_ID && normalizedName !== DEMO_PLAYLIST_NAME;
    }).length;
    const isFirstPlaylistInTracklessOnboardingState =
      quickTourPhase === null &&
      !hasOnboarded &&
      !isEmptyWelcomeDismissed &&
      tracks.length === 0 &&
      existingUserPlaylistCount === 0;
    const created = createPlaylistInLibrary(source, nextName);
    const createdPlaylist = created.library.playlistsById[created.createdPlaylistId];
    setLibrary(created.library);
    setRuntimeLibrary(created.library);
    if (!createdPlaylist?.trackIds?.length) {
      setTracks([]);
    }
    setIsCreatePlaylistModalOpen(false);
    setIsPlaylistRequired(false);
    setNewPlaylistName("");
    setQuickTourPhase((current) => {
      if (current === "create-playlist") return "upload-track";
      if (current === null && isFirstPlaylistInTracklessOnboardingState) return "upload-track";
      return current;
    });
    if (isFirstPlaylistInTracklessOnboardingState || quickTourPhase === "create-playlist") {
      fireSuccessHaptic();
    }
    window.dispatchEvent(new CustomEvent("polyplay:library-updated"));
    await refreshTracks();
  };

  const ensureDemoTracksForFirstRun = async (options?: { preferDemoActive?: boolean }) => {
    await seedDemoTracksIfNeeded().catch((error) => {
      console.error("[demo-seed]", {
        event: "seed:swallowed-error",
        error: error instanceof Error ? error.message : String(error)
      });
      return { seeded: false, reason: "seed-failed" };
    });
    await restoreDemoTracks({ preferDemoActive: Boolean(options?.preferDemoActive) }).catch((error) => {
      console.error("[demo-seed]", {
        event: "restore:swallowed-error",
        error: error instanceof Error ? error.message : String(error)
      });
      return { restored: 0, skipped: 0, repaired: 0, failed: 0 };
    });
    const normalization = await normalizeDemoLibrary({ preferDemoActive: Boolean(options?.preferDemoActive) }).catch(() => ({
      normalized: false,
      removedTrackIds: [],
      canonicalTrackIds: []
    }));
    let latest = await getLibrary();
    const startingActivePlaylist =
      latest.activePlaylistId && latest.playlistsById[latest.activePlaylistId]
        ? latest.playlistsById[latest.activePlaylistId]
        : null;
    const demoTrackIds = Object.values(latest.tracksById || {})
      .filter((track) => Boolean(track.isDemo) || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .map((track) => track.id);
    const officialDemoTracks = Object.values(latest.tracksById || {})
      .filter((track) => (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
      .map((track) => ({ id: track.id, demoId: track.demoId }));
    console.debug("[demo-seed]", {
      event: "post-reconcile",
      officialDemoTracks,
      activePlaylistId: latest.activePlaylistId,
      activePlaylistName: startingActivePlaylist?.name ?? null
    });
    const hasDemo = demoTrackIds.length > 0;
    console.debug("[first-run] startup reconcile begin", {
      preferDemoActive: Boolean(options?.preferDemoActive),
      activePlaylistId: latest.activePlaylistId,
      activePlaylistName: startingActivePlaylist?.name ?? null,
      normalization,
      officialDemoTracks,
      demoTrackIds
    });
    if (options?.preferDemoActive && hasDemo) {
      const demoPlaylistById = latest.playlistsById[DEMO_PLAYLIST_ID];
      const demoPlaylistByName = Object.values(latest.playlistsById || {}).find(
        (playlist) => playlist.name.trim().toLowerCase() === DEMO_PLAYLIST_NAME
      );
      const demoPlaylist = demoPlaylistById || demoPlaylistByName;
      if (demoPlaylist) {
        const beforeTrackIds = Array.isArray(demoPlaylist.trackIds) ? [...demoPlaylist.trackIds] : [];
        const demoTrackIdSet = new Set(demoTrackIds);
        const nextPlaylistsById = { ...latest.playlistsById };
        let playlistsTouched = false;
        for (const [playlistId, playlist] of Object.entries(nextPlaylistsById)) {
          if (playlistId === demoPlaylist.id) continue;
          const nextTrackIds = (playlist.trackIds || []).filter((trackId) => !demoTrackIdSet.has(trackId));
          if (nextTrackIds.length !== (playlist.trackIds || []).length) {
            nextPlaylistsById[playlistId] = { ...playlist, trackIds: nextTrackIds, updatedAt: Date.now() };
            playlistsTouched = true;
          }
        }
        const currentDemoPlaylist = nextPlaylistsById[demoPlaylist.id] || demoPlaylist;
        const existingTrackIds = Array.isArray(currentDemoPlaylist.trackIds) ? currentDemoPlaylist.trackIds : [];
        const missingDemoTrackIds = demoTrackIds.filter((trackId) => !existingTrackIds.includes(trackId));
        const repairedTrackIds = missingDemoTrackIds.length > 0 ? [...existingTrackIds, ...missingDemoTrackIds] : existingTrackIds;
        const needsRepair = missingDemoTrackIds.length > 0;
        const needsActiveSwitch = latest.activePlaylistId !== demoPlaylist.id;
        if (needsRepair || needsActiveSwitch || playlistsTouched) {
          latest = {
            ...latest,
            activePlaylistId: demoPlaylist.id,
            playlistsById: {
              ...nextPlaylistsById,
              [demoPlaylist.id]: needsRepair
                ? { ...currentDemoPlaylist, trackIds: repairedTrackIds, updatedAt: Date.now() }
                : currentDemoPlaylist
            }
          };
          setLibrary(latest);
        }
        const finalDemoPlaylist = latest.playlistsById[demoPlaylist.id];
        console.debug("[first-run] startup reconcile demo playlist", {
          beforeTrackIds,
          afterTrackIds: Array.isArray(finalDemoPlaylist?.trackIds) ? [...finalDemoPlaylist.trackIds] : [],
          activePlaylistId: latest.activePlaylistId,
          activePlaylistName: finalDemoPlaylist?.name ?? null,
          needsRepair,
          needsActiveSwitch,
          playlistsTouched
        });
      }
    } else if (options?.preferDemoActive) {
      const activePlaylist =
        latest.activePlaylistId && latest.playlistsById[latest.activePlaylistId]
          ? latest.playlistsById[latest.activePlaylistId]
          : null;
      const activeName = (activePlaylist?.name || "").trim().toLowerCase();
      const activeIsDemo = Boolean(activePlaylist && (activePlaylist.id === DEMO_PLAYLIST_ID || activeName === DEMO_PLAYLIST_NAME));
      if (activeIsDemo) {
        const fallbackPlaylist = Object.values(latest.playlistsById || {}).find((playlist) => {
          const normalizedName = (playlist.name || "").trim().toLowerCase();
          const isDemoPlaylist = playlist.id === DEMO_PLAYLIST_ID || normalizedName === DEMO_PLAYLIST_NAME;
          return !isDemoPlaylist;
        });
        if (fallbackPlaylist && fallbackPlaylist.id !== latest.activePlaylistId) {
          latest = {
            ...latest,
            activePlaylistId: fallbackPlaylist.id
          };
          setLibrary(latest);
        }
      }
    }
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
    pendingAutoPlayTrackIdRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    logAudioDebug("teardown:end");
  };

  const nukeAppData = async () => {
    logAudioDebug("nukeAppData:start");
    try {
      await hardResetLibraryInDb();
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
        let preferDemoActive = true;
        try {
          const library = await getLibrary();
          const nonDemoTrackCount = Object.values(library.tracksById || {}).filter(
            (track) => !(track.isDemo || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
          ).length;
          preferDemoActive =
            nonDemoTrackCount === 0 ||
            (localStorage.getItem(HAS_IMPORTED_KEY) !== "true" && localStorage.getItem(HAS_ONBOARDED_KEY) !== "true");
        } catch {
          preferDemoActive = true;
        }
        await ensureDemoTracksForFirstRun({ preferDemoActive });
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
      if (vaultToastTimeoutRef.current !== null) {
        window.clearTimeout(vaultToastTimeoutRef.current);
        vaultToastTimeoutRef.current = null;
      }
      clearVaultImportSuccessCountdown();
      revokeAllMediaUrls();
    };
  }, []);

  const setVaultStatus = (message: string, tone: VaultToastTone = "info") => {
    if (vaultToastTimeoutRef.current !== null) {
      window.clearTimeout(vaultToastTimeoutRef.current);
      vaultToastTimeoutRef.current = null;
    }
    if (!message) {
      setVaultToastState(null);
      return;
    }
    setVaultToastState({ message, tone });
    vaultToastTimeoutRef.current = window.setTimeout(() => {
      setVaultToastState((current) => (current?.message === message ? null : current));
      vaultToastTimeoutRef.current = null;
    }, tone === "error" ? 5400 : 3800);
  };

  const clearVaultImportSuccessCountdown = () => {
    if (vaultImportCloseTimeoutRef.current !== null) {
      window.clearTimeout(vaultImportCloseTimeoutRef.current);
      vaultImportCloseTimeoutRef.current = null;
    }
    if (vaultImportCloseIntervalRef.current !== null) {
      window.clearInterval(vaultImportCloseIntervalRef.current);
      vaultImportCloseIntervalRef.current = null;
    }
    setVaultImportCloseCountdownMs(null);
  };

  const closeVaultOverlay = () => {
    clearVaultImportSuccessCountdown();
    setShowImportWarning(false);
    setOverlayPage(null);
  };

  const beginVaultSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    vaultSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now()
    };
  };

  const endVaultSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    const start = vaultSwipeStartRef.current;
    vaultSwipeStartRef.current = null;
    if (!start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy <= 0) return;
    if (Math.abs(dx) > VAULT_SWIPE_CLOSE_MAX_SIDEWAYS_PX) return;
    const elapsedMs = Math.max(1, performance.now() - start.at);
    const velocity = dy / elapsedMs;
    if (dy >= VAULT_SWIPE_CLOSE_DISTANCE_PX || velocity >= VAULT_SWIPE_CLOSE_MIN_VELOCITY) {
      closeVaultOverlay();
    }
  };

  const startVaultImportSuccessCountdown = () => {
    clearVaultImportSuccessCountdown();
    const startedAt = Date.now();
    const totalMs = 2000;
    setVaultImportCloseCountdownMs(totalMs);
    vaultImportCloseIntervalRef.current = window.setInterval(() => {
      const remaining = Math.max(0, totalMs - (Date.now() - startedAt));
      setVaultImportCloseCountdownMs(remaining);
    }, 100);
    vaultImportCloseTimeoutRef.current = window.setTimeout(() => {
      clearVaultImportSuccessCountdown();
      setShowImportWarning(false);
      setOverlayPage((current) => (current === "vault" ? null : current));
      pulseAuraAfterVaultClose();
    }, totalMs);
  };

  useEffect(() => {
    document.title = isIOS ? IOS_NOW_PLAYING_APP_TITLE : APP_TITLE;
  }, [isIOS]);

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
      const hasImported = localStorage.getItem(HAS_IMPORTED_KEY) === "true";
      const hasOnboarded = localStorage.getItem(HAS_ONBOARDED_KEY) === "true";
      if (!hasImported && !hasOnboarded) {
        setShowSplash(true);
        return;
      }
      const skipAlways = localStorage.getItem(SPLASH_SEEN_KEY) === "true";
      const seenSession = sessionStorage.getItem(SPLASH_SESSION_KEY) === "true";
      if (!skipAlways && !seenSession) setShowSplash(true);
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
      if (saved === "light" || saved === "dark" || saved === "custom") {
        setThemeMode(saved);
      } else {
        setThemeMode("dark");
        localStorage.setItem(THEME_MODE_KEY, "dark");
      }
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
      if (Object.values(loopByTrack).some((loop) => loop?.editing)) return;
      localStorage.setItem(LOOP_REGION_KEY, JSON.stringify(loopByTrack));
    } catch {
      // Ignore localStorage failures.
    }
  }, [loopByTrack]);

  useEffect(() => {
    try {
      if (Object.values(loopByTrack).some((loop) => loop?.editing)) return;
      localStorage.setItem(LOOP_MODE_KEY, JSON.stringify(loopModeByTrack));
    } catch {
      // Ignore localStorage failures.
    }
  }, [loopByTrack, loopModeByTrack]);

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
    const root = document.documentElement;
    const syncPlayerHeightVar = () => {
      const player = document.getElementById("polyPlayer");
      if (!player) return;
      const height = Math.ceil(player.getBoundingClientRect().height);
      root.style.setProperty("--playerH", `${height}px`);
    };
    window.requestAnimationFrame(syncPlayerHeightVar);
    window.addEventListener("load", syncPlayerHeightVar);
    window.addEventListener("resize", syncPlayerHeightVar);

    const playerEl = document.getElementById("polyPlayer");
    const observer =
      playerEl && "ResizeObserver" in window ? new ResizeObserver(() => syncPlayerHeightVar()) : null;
    observer?.observe(playerEl as Element);

    return () => {
      window.removeEventListener("load", syncPlayerHeightVar);
      window.removeEventListener("resize", syncPlayerHeightVar);
      observer?.disconnect();
    };
  }, [tracks.length, isPlayerCompact, overlayPage]);

  useEffect(() => {
    if (!isFullscreenPlayerOpen) return;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
      overscrollBehavior: document.body.style.overscrollBehavior
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflowY = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      document.body.style.overflowY = prev.overflowY;
      document.body.style.overscrollBehavior = prev.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isFullscreenPlayerOpen]);

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
    const onVisibilityChange = () => setIsPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

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
      setRepeatTrackMode(getStoredRepeatTrackMode());
      const savedDimMode = localStorage.getItem(DIM_MODE_KEY);
      if (savedDimMode === "normal" || savedDimMode === "dim" || savedDimMode === "mute") {
        setDimMode(normalizeDimModeForPlatform(savedDimMode, isIOS));
      }
      const savedNoveltyMode = localStorage.getItem(NOVELTY_MODE_KEY);
      if (savedNoveltyMode === "normal" || savedNoveltyMode === "dim" || savedNoveltyMode === "mute") {
        setNoveltyMode(savedNoveltyMode);
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
    const nextAuraColor = auraColor;
    if (nextAuraColor) {
      root.style.setProperty("--aura-rgb", auraHexToRgb(nextAuraColor));
    } else {
      root.style.removeProperty("--aura-rgb");
    }
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
  }, [themeMode, customThemeSlot, auraColor]);

  useEffect(() => {
    const isDimVibe = noveltyMode === "dim";
    const isMuted = noveltyMode === "mute";
    document.body.classList.toggle("dim-vibe", isDimVibe);
    document.body.classList.toggle("mute-freeze", isMuted);
    return () => {
      document.body.classList.remove("dim-vibe");
      document.body.classList.remove("mute-freeze");
    };
  }, [noveltyMode]);

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

  const finishSplash = (skipEveryTime = false) => {
    if (!showSplash || isSplashDismissing) return;
    setIsSplashDismissing(true);
    try {
      if (skipEveryTime) {
        localStorage.setItem(SPLASH_SEEN_KEY, "true");
      } else {
        localStorage.removeItem(SPLASH_SEEN_KEY);
      }
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
      if (type === "polyplay:theme-mode-updated") {
        const nextMode = event.data?.themeMode;
        if (nextMode === "light" || nextMode === "dark" || nextMode === "custom") {
          setThemeMode(nextMode);
          try {
            localStorage.setItem(THEME_MODE_KEY, nextMode);
          } catch {
            // Ignore localStorage failures.
          }
        }
        return;
      }
      if (type === "polyplay:aura-color-updated") {
        const color = normalizeAuraColor(event.data?.color);
        setAuraColor(color);
        try {
          if (color) {
            localStorage.setItem(AURA_COLOR_KEY, color);
          } else {
            localStorage.removeItem(AURA_COLOR_KEY);
          }
        } catch {
          // Ignore localStorage failures.
        }
        return;
      }
      if (type === "polyplay:haptic") {
        const tone = event.data?.tone;
        if (tone === "heavy") fireHeavyHaptic();
        else fireSuccessHaptic();
        return;
      }
      if (type === "polyplay:factory-reset") {
        try {
          localStorage.removeItem(THEME_MODE_KEY);
          localStorage.removeItem(CUSTOM_THEME_SLOT_KEY);
          localStorage.removeItem(AURA_COLOR_KEY);
          localStorage.removeItem(SHUFFLE_ENABLED_KEY);
          localStorage.removeItem(REPEAT_TRACK_KEY);
          localStorage.removeItem(LAYOUT_MODE_KEY);
          localStorage.removeItem(DIM_MODE_KEY);
          localStorage.removeItem(NOVELTY_MODE_KEY);
          localStorage.removeItem(LOOP_REGION_KEY);
          localStorage.removeItem(LOOP_MODE_KEY);
          localStorage.removeItem(HAS_IMPORTED_KEY);
          localStorage.removeItem(HAS_ONBOARDED_KEY);
          localStorage.removeItem(PLAYER_COMPACT_HINT_SEEN_KEY);
          localStorage.removeItem(PLAYER_VIBE_HINT_SEEN_KEY);
          localStorage.removeItem(PLAYER_DIM_HINT_SEEN_KEY);
          localStorage.removeItem(LAYOUT_TOGGLE_HINT_SEEN_KEY);
          localStorage.removeItem(NEW_PLAYLIST_HINT_SEEN_KEY);
          localStorage.removeItem(UPLOAD_HINT_SEEN_KEY);
          localStorage.removeItem(GRATITUDE_ENTRIES_KEY);
          localStorage.removeItem(GRATITUDE_LAST_PROMPT_KEY);
          localStorage.setItem(GRATITUDE_SETTINGS_KEY, JSON.stringify(DEFAULT_GRATITUDE_SETTINGS));
          localStorage.removeItem(OPEN_STATE_SEEN_KEY);
          sessionStorage.removeItem(SPLASH_SESSION_KEY);
        } catch {
          // Ignore storage failures.
        }
        setThemeMode("dark");
        setCustomThemeSlot("crimson");
        setAuraColor(null);
        setLayoutMode("grid");
        setIsShuffleEnabled(false);
        setRepeatTrackMode("off");
        threepeatRemainingRef.current = 0;
        setDimMode("normal");
        setNoveltyMode("normal");
        setLoopByTrack({});
        setLoopModeByTrack({});
        setHasOnboarded(false);
        setHasSeenPlayerCompactHint(false);
        setHasSeenLayoutToggleHint(false);
        setHasSeenNewPlaylistHint(false);
        setHasSeenUploadHint(false);
        setHasSeenPlayerVibeHint(false);
        setHasSeenPlayerDimHint(false);
        setIsEmptyWelcomeDismissed(false);
        setShowOpenState(false);
        setOverlayPage(null);
        setIsTipsOpen(false);
        setIsJournalOpen(false);
        setIsGratitudeOpen(false);
        gratitudeEvaluatedRef.current = false;
        setGratitudeSettings(DEFAULT_GRATITUDE_SETTINGS);
        setIsFullscreenPlayerOpen(false);
        setShowSplash(true);
        setIsSplashDismissing(false);
        teardownCurrentAudio();
        pendingAutoPlayRef.current = false;
        void (async () => {
          revokeAllMediaUrls();
          setTracks([]);
          setRuntimeLibrary(null);
          setCurrentTrackId(null);
          setCurrentTime(0);
          setDuration(0);
          setIsPlaying(false);
          setLoopByTrack({});
          setLoopModeByTrack({});
          syncPlayerStateFromStorage();
          await ensureDemoTracksForFirstRun({ preferDemoActive: true });
          setShowOpenState(true);
        })();
        return;
      }
      if (type === "polyplay:config-imported") {
        exitFreshUserOnboardingState();
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
    () => allTracksCatalog.find((track) => track.id === currentTrackId) ?? null,
    [allTracksCatalog, currentTrackId]
  );
  const hasTracks = tracks.length > 0;
  const isInitialDemoFirstRunState = useMemo(() => {
    if (hasOnboarded) return false;
    const activePlaylist =
      activePlaylistId && runtimeLibrary?.playlistsById ? runtimeLibrary.playlistsById[activePlaylistId] : null;
    const activeName = (activePlaylist?.name || "").trim().toLowerCase();
    const activeIsDemo = Boolean(activePlaylist && (activePlaylist.id === DEMO_PLAYLIST_ID || activeName === DEMO_PLAYLIST_NAME));
    if (!activeIsDemo) return false;
    let hasImported = false;
    try {
      hasImported = localStorage.getItem(HAS_IMPORTED_KEY) === "true";
    } catch {
      hasImported = false;
    }
    const runtimeTracks = Object.values(runtimeLibrary?.tracksById || {});
    const demoTrackCount = runtimeTracks.filter(
      (track) => Boolean(track.isDemo) || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false)
    ).length;
    const nonDemoTrackCount = runtimeTracks.filter(
      (track) => !(track.isDemo || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
    ).length;
    return !hasImported && demoTrackCount > 0 && nonDemoTrackCount === 0;
  }, [activePlaylistId, hasOnboarded, runtimeLibrary]);
  const isPristineDemoLibraryState = useMemo(() => {
    const activePlaylist =
      activePlaylistId && runtimeLibrary?.playlistsById ? runtimeLibrary.playlistsById[activePlaylistId] : null;
    const activeName = (activePlaylist?.name || "").trim().toLowerCase();
    const activeIsDemo = Boolean(activePlaylist && (activePlaylist.id === DEMO_PLAYLIST_ID || activeName === DEMO_PLAYLIST_NAME));
    if (!activeIsDemo) return false;
    const runtimeTracks = Object.values(runtimeLibrary?.tracksById || {});
    const demoTrackCount = runtimeTracks.filter(
      (track) => Boolean(track.isDemo) || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false)
    ).length;
    const nonDemoTrackCount = runtimeTracks.filter(
      (track) => !(track.isDemo || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
    ).length;
    return demoTrackCount > 0 && nonDemoTrackCount === 0;
  }, [activePlaylistId, runtimeLibrary]);
  const derivedQuickTourPhase = useMemo<QuickTourPhase>(() => {
    if (quickTourPhase) return quickTourPhase;
    return null;
  }, [quickTourPhase]);
  const canCreatePolyplaylist = newPlaylistName.trim().length > 0;
  const currentAudioUrl = currentTrack?.audioUrl ?? null;

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const auraLevel = clamp01((currentTrack?.aura ?? 0) / 10);
    rootStyle.setProperty("--fx-aura-level", auraLevel.toFixed(2));
    rootStyle.setProperty("--glow-intensity", (1 + auraLevel * 0.55).toFixed(2));
    return () => {
      rootStyle.removeProperty("--fx-aura-level");
      rootStyle.removeProperty("--glow-intensity");
    };
  }, [currentTrack?.id, currentTrack?.aura]);

  useEffect(() => {
    let cancelled = false;
    nowPlayingItemSyncSeqRef.current += 1;
    const syncSeq = nowPlayingItemSyncSeqRef.current;

    if (!currentTrack?.audioUrl || currentTrack.missingAudio) {
      lastNowPlayingPlaybackSyncRef.current = null;
      void clearIosNowPlaying();
      void syncMediaSessionItem(null);
      return () => {
        cancelled = true;
      };
    }

    const syncNowPlayingItem = async () => {
      if (cancelled || nowPlayingItemSyncSeqRef.current !== syncSeq) return;

      await setIosNowPlayingItem({
        title: currentTrack.title || "Untitled",
        subtitle: IOS_NOW_PLAYING_APP_TITLE,
        artBlob: currentTrack.artBlob,
        artUrl: currentTrack.artUrl
      });
      await syncMediaSessionItem(currentTrack);
    };

    void syncNowPlayingItem();

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.sub,
    currentTrack?.artBlob,
    currentTrack?.artUrl,
    currentTrack?.audioUrl,
    currentTrack?.missingAudio
  ]);

  useEffect(() => {
    if (!currentTrack?.audioUrl || currentTrack.missingAudio) {
      lastNowPlayingPlaybackSyncRef.current = null;
      syncMediaSessionPlaybackState({ elapsedTime: 0, duration: 0, isPlaying: false });
      return;
    }

    const nextState = {
      trackId: currentTrack.id,
      elapsedTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
      isPlaying
    };
    const previousState = lastNowPlayingPlaybackSyncRef.current;
    const shouldSync =
      !previousState ||
      previousState.trackId !== nextState.trackId ||
      previousState.isPlaying !== nextState.isPlaying ||
      Math.abs(previousState.duration - nextState.duration) >= 0.5 ||
      Math.abs(previousState.elapsedTime - nextState.elapsedTime) >= 0.9;

    if (!shouldSync) return;

    lastNowPlayingPlaybackSyncRef.current = nextState;
    void updateIosNowPlayingPlaybackState(nextState);
    syncMediaSessionPlaybackState(nextState);
  }, [currentTrack?.id, currentTrack?.audioUrl, currentTrack?.missingAudio, currentTime, duration, isPlaying]);

  const commitUiCurrentTime = (nextTime: number, options?: { force?: boolean }) => {
    const safeNextTime = Number.isFinite(nextTime) ? Math.max(0, nextTime) : 0;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = now - lastUiCurrentTimeCommitAtRef.current;
    const delta = Math.abs(safeNextTime - lastUiCurrentTimeValueRef.current);
    if (!options?.force && elapsed < UI_CURRENT_TIME_THROTTLE_MS && delta < UI_CURRENT_TIME_MIN_DELTA_SEC) {
      return;
    }
    lastUiCurrentTimeCommitAtRef.current = now;
    lastUiCurrentTimeValueRef.current = safeNextTime;
    setCurrentTime(safeNextTime);
  };

  const clearLoopDragResumeTimeout = () => {
    if (loopDragResumeTimeoutRef.current !== null) {
      window.clearTimeout(loopDragResumeTimeoutRef.current);
      loopDragResumeTimeoutRef.current = null;
    }
  };

  const pauseForLoopDrag = () => {
    const audio = audioRef.current;
    clearLoopDragResumeTimeout();
    if (!audio) {
      loopDragWasPlayingRef.current = false;
      return;
    }
    loopDragWasPlayingRef.current = !audio.paused;
    if (!audio.paused) {
      logAudioDebug("pause() called", { reason: "loop-drag-start" });
      audio.pause();
    }
  };

  const resumeAfterLoopDrag = (start: number) => {
    const audio = audioRef.current;
    const shouldResume = loopDragWasPlayingRef.current;
    loopDragWasPlayingRef.current = false;
    clearLoopDragResumeTimeout();
    if (!audio) return;

    const effectiveDuration = getSafeDuration(duration) || getSafeDuration(audio.duration);
    const safeStart = Math.max(0, Math.min(effectiveDuration, start));
    audio.currentTime = safeStart;
    setCurrentTime(safeStart);

    if (!shouldResume) return;

    loopDragResumeTimeoutRef.current = window.setTimeout(() => {
      loopDragResumeTimeoutRef.current = null;
      void ensurePlaybackGainRouting(true);
      logAudioDebug("play() called", { reason: "loop-drag-end" });
      void audio.play().catch(() => setIsPlaying(false));
    }, 90);
  };

  useEffect(() => {
    lastUiCurrentTimeValueRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => () => clearLoopDragResumeTimeout(), []);

  useEffect(() => {
    if (!isPristineDemoLibraryState) return;
    let hadStaleFlags = false;
    try {
      if (localStorage.getItem(HAS_IMPORTED_KEY) === "true") {
        localStorage.removeItem(HAS_IMPORTED_KEY);
        hadStaleFlags = true;
      }
      if (localStorage.getItem(HAS_ONBOARDED_KEY) === "true") {
        localStorage.removeItem(HAS_ONBOARDED_KEY);
        hadStaleFlags = true;
      }
    } catch {
      return;
    }
    if (!hadStaleFlags) return;
    setHasOnboarded(false);
    setIsEmptyWelcomeDismissed(false);
    setShowOpenState(false);
  }, [isPristineDemoLibraryState]);

  useEffect(() => {
    const activePlaylist =
      activePlaylistId && runtimeLibrary?.playlistsById ? runtimeLibrary.playlistsById[activePlaylistId] : null;
    const activeName = (activePlaylist?.name || "").trim().toLowerCase();
    const activeIsDemo = Boolean(activePlaylist && (activePlaylist.id === DEMO_PLAYLIST_ID || activeName === DEMO_PLAYLIST_NAME));
    const runtimeTracks = Object.values(runtimeLibrary?.tracksById || {});
    const officialDemoTracks = runtimeTracks
      .filter((track) => (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
      .map((track) => ({ id: track.id, demoId: track.demoId }));
    const nonDemoTrackCount = runtimeTracks.filter(
      (track) => !(track.isDemo || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
    ).length;
    let hasImported = false;
    try {
      hasImported = localStorage.getItem(HAS_IMPORTED_KEY) === "true";
    } catch {
      hasImported = false;
    }
    console.debug("[first-run] isInitialDemoFirstRunState", {
      activePlaylistId,
      activePlaylistName: activePlaylist?.name ?? null,
      activeIsDemo,
      hasImported,
      hasOnboarded,
      officialDemoTracks,
      nonDemoTrackCount,
      isInitialDemoFirstRunState
    });
  }, [activePlaylistId, hasOnboarded, isInitialDemoFirstRunState, runtimeLibrary]);

  useEffect(() => {
    if (quickTourPhase !== "upload-track") return;
    let hasImported = false;
    try {
      hasImported = localStorage.getItem(HAS_IMPORTED_KEY) === "true";
    } catch {
      hasImported = false;
    }
    const hasUserTracks = Object.values(runtimeLibrary?.tracksById || {}).some(
      (track) => !(track.isDemo || (track.demoId ? DEMO_TRACK_IDS.has(track.demoId) : false))
    );
    if (hasOnboarded || hasImported || hasUserTracks) {
      setQuickTourPhase(null);
    }
  }, [hasOnboarded, quickTourPhase, runtimeLibrary]);

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

  const exitFreshUserOnboardingState = () => {
    try {
      localStorage.setItem(HAS_IMPORTED_KEY, "true");
      localStorage.setItem(HAS_ONBOARDED_KEY, "true");
      localStorage.setItem(OPEN_STATE_SEEN_KEY, "1");
    } catch {
      // Ignore localStorage failures.
    }
    setHasOnboarded(true);
    setQuickTourPhase(null);
    setIsEmptyWelcomeDismissed(true);
    setShowOpenState(false);
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
      const targetTrackId = currentTrackId;
      const attemptPlay = (reason: "pending-autoplay") => {
        logAudioDebug("play() called", { reason, targetTrackId, readyState: audio.readyState });
        return audio.play();
      };
      const finalizePendingAutoPlay = () => {
        pendingAutoPlayRef.current = false;
        pendingAutoPlayTrackIdRef.current = null;
      };

      finalizePendingAutoPlay();
      void attemptPlay("pending-autoplay")
        .then(() => {
          logAudioDebug("play() resolved", { reason: "pending-autoplay", targetTrackId });
          setIsPlaying(true);
        })
        .catch((error) => {
          logAudioDebug("play() rejected", {
            reason: "pending-autoplay",
            targetTrackId,
            readyState: audio.readyState,
            error: String(error)
          });
          if (!isIOS || !targetTrackId || currentTrackId !== targetTrackId) {
            setIsPlaying(false);
            return;
          }
          pendingAutoPlayTrackIdRef.current = targetTrackId;
        });
    }
  }, [currentTrackId, currentAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = currentLoopMode === "track";
  }, [currentLoopMode]);

  const teardownPlaybackGainRouting = async () => {
    const source = playbackSourceNodeRef.current;
    const gain = playbackGainNodeRef.current;
    const ctx = playbackAudioContextRef.current;
    playbackSourceNodeRef.current = null;
    playbackGainNodeRef.current = null;
    playbackAudioContextRef.current = null;
    try {
      source?.disconnect();
    } catch {
      // Ignore disconnect failures.
    }
    try {
      gain?.disconnect();
    } catch {
      // Ignore disconnect failures.
    }
    try {
      if (ctx && ctx.state !== "closed") {
        await ctx.close();
      }
    } catch {
      // Ignore close failures.
    }
  };

  const applyDimMode = (audio: HTMLAudioElement | null, mode: DimMode) => {
    if (!audio) return;
    const effectiveMode = normalizeDimModeForPlatform(mode, isIOS);
    const targetVolume = effectiveMode === "mute" ? 0 : effectiveMode === "dim" ? 0.3 : 1;
    const gainNode = playbackGainNodeRef.current;
    if (gainNode && !isIOS) {
      audio.muted = false;
      audio.volume = 1;
      gainNode.gain.value = targetVolume;
      return;
    }
    if (effectiveMode === "mute") {
      audio.muted = true;
      audio.volume = 1;
      return;
    }
    audio.muted = false;
    audio.volume = targetVolume;
  };

  const getDimAudioState = (mode: DimMode): { muted: boolean; volume: number } => {
    if (mode === "mute") return { muted: true, volume: 0 };
    if (mode === "dim") return { muted: false, volume: 0.3 };
    return { muted: false, volume: 1 };
  };

  const ensurePlaybackGainRouting = async (_resumeContext = false) => {
    const audio = audioRef.current;
    if (!audio) return false;
    if (isIOS) {
      if (playbackSourceNodeRef.current || playbackGainNodeRef.current || playbackAudioContextRef.current) {
        await teardownPlaybackGainRouting();
      }
      applyDimMode(audio, dimMode);
      return true;
    }
    applyDimMode(audio, dimMode);
    return true;
  };

  const resyncPlaybackAfterInterruption = async (
    reason: "visibility-return" | "window-focus" | "vault-save-return" | "vault-import-return"
  ) => {
    if (playbackResyncInFlightRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    playbackResyncInFlightRef.current = true;
    try {
      const hasTrackSource = Boolean(currentTrack?.audioUrl && audioSrcRef.current);
      const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      const nextTime = Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
      setDuration(nextDuration);
      commitUiCurrentTime(nextTime, { force: true });

      if (!hasTrackSource) {
        setIsPlaying(false);
        logAudioDebug("resync:inactive", { reason, paused: audio.paused, currentTime: nextTime });
        return;
      }

      const elementPlaying = !audio.paused && !audio.ended;
      let routingReady = true;
      if (isIOS) {
        routingReady = await ensurePlaybackGainRouting(elementPlaying);
      }

      if (elementPlaying && isIOS) {
        if (!routingReady) {
          logAudioDebug("resync:routing-unavailable", { reason, currentTime: nextTime });
          audio.pause();
          setIsPlaying(false);
          return;
        }
        try {
          logAudioDebug("play() called", { reason: `resync-${reason}` });
          await audio.play();
          logAudioDebug("play() resolved", { reason: `resync-${reason}` });
        } catch (error) {
          logAudioDebug("play() rejected", { reason: `resync-${reason}`, error: String(error) });
          audio.pause();
          setIsPlaying(false);
          return;
        }
      }

      const syncedTime = Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : nextTime;
      commitUiCurrentTime(syncedTime, { force: true });
      setIsPlaying(!audio.paused && !audio.ended && (!isIOS || routingReady));
      lastPlaybackResyncAtRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
      logAudioDebug("resync:complete", {
        reason,
        paused: audio.paused,
        currentTime: syncedTime,
        routingReady
      });
    } finally {
      playbackResyncInFlightRef.current = false;
    }
  };

  const schedulePlaybackResync = (
    reason: "visibility-return" | "window-focus" | "vault-save-return" | "vault-import-return"
  ) => {
    if (
      (reason === "visibility-return" || reason === "window-focus") &&
      typeof document !== "undefined" &&
      document.hidden
    ) {
      return;
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (reason === "window-focus" && now - lastPlaybackResyncAtRef.current < 500) {
      return;
    }
    if (playbackResyncTimeoutRef.current !== null) {
      window.clearTimeout(playbackResyncTimeoutRef.current);
    }
    const delayMs = reason === "visibility-return" || reason === "window-focus" ? 180 : 0;
    playbackResyncTimeoutRef.current = window.setTimeout(() => {
      playbackResyncTimeoutRef.current = null;
      void resyncPlaybackAfterInterruption(reason);
    }, delayMs);
  };

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) return;
      schedulePlaybackResync("visibility-return");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [currentTrack?.audioUrl, isIOS]);

  useEffect(() => {
    const onWindowFocus = () => {
      schedulePlaybackResync("window-focus");
    };
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [currentTrack?.audioUrl, isIOS]);

  useEffect(() => {
    return () => {
      if (playbackResyncTimeoutRef.current !== null) {
        window.clearTimeout(playbackResyncTimeoutRef.current);
        playbackResyncTimeoutRef.current = null;
      }
    };
  }, []);

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
          commitUiCurrentTime(loopRegion.start, { force: true });
          return;
        }
      }
      commitUiCurrentTime(nextTime);
    };

    const syncDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      setDuration(nextDuration);
    };
    const retryPendingAutoPlayIfNeeded = (reason: "loadedmetadata" | "durationchange" | "canplay") => {
      const pendingTrackId = pendingAutoPlayTrackIdRef.current;
      if (!pendingTrackId || pendingTrackId !== currentTrackId) return;
      if (audioSrcRef.current !== currentAudioUrl || !currentAudioUrl) return;
      if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      pendingAutoPlayTrackIdRef.current = null;
      logAudioDebug("play() called", { reason: `pending-autoplay-${reason}`, readyState: audio.readyState, pendingTrackId });
      void audio.play()
        .then(() => {
          logAudioDebug("play() resolved", { reason: `pending-autoplay-${reason}`, pendingTrackId });
          setIsPlaying(true);
        })
        .catch((error) => {
          logAudioDebug("play() rejected", {
            reason: `pending-autoplay-${reason}`,
            pendingTrackId,
            readyState: audio.readyState,
            error: String(error)
          });
          setIsPlaying(false);
        });
    };
    const onMeta = () => {
      syncDuration();
      retryPendingAutoPlayIfNeeded("loadedmetadata");
    };
    const onCanPlay = () => retryPendingAutoPlayIfNeeded("canplay");
    const onDurationChangeWithRetry = () => {
      syncDuration();
      retryPendingAutoPlayIfNeeded("durationchange");
    };
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
        applyDimMode(audio, dimMode);
        void audio.play().catch(() => setIsPlaying(false));
        return;
      }
      if (repeatTrackMode === "loop-one" && currentLoopMode === "off") {
        audio.currentTime = 0;
        setCurrentTime(0);
        applyDimMode(audio, dimMode);
        void audio.play().catch(() => setIsPlaying(false));
        return;
      }
      if (repeatTrackMode === "threepeat" && currentLoopMode === "off") {
        if (threepeatRemainingRef.current > 0) {
          threepeatRemainingRef.current -= 1;
          audio.currentTime = 0;
          setCurrentTime(0);
          applyDimMode(audio, dimMode);
          void audio.play().catch(() => setIsPlaying(false));
          return;
        }
        setRepeatTrackMode("off");
        threepeatRemainingRef.current = 0;
        try {
          localStorage.setItem(REPEAT_TRACK_KEY, "off");
        } catch {
          // Ignore localStorage failures.
        }
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
      const nextId = getAdjacentTrackId(tracks, currentTrackId, 1, true);
      if (nextId) {
        playTrack(nextId, true);
        return;
      }
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onDurationChangeWithRetry);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    logAudioDebug("listeners attached", {
      listeners: ["timeupdate", "loadedmetadata", "durationchange", "canplay", "play", "pause", "error", "ended"]
    });

    const detachListeners = () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onDurationChangeWithRetry);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
      logAudioDebug("listeners detached", {
        listeners: ["timeupdate", "loadedmetadata", "durationchange", "canplay", "play", "pause", "error", "ended"]
      });
    };
    teardownAudioListenersRef.current = detachListeners;

    return () => {
      if (teardownAudioListenersRef.current === detachListeners) {
        teardownAudioListenersRef.current = null;
      }
      detachListeners();
    };
  }, [currentTrackId, loopByTrack, currentLoopMode, repeatTrackMode, isShuffleEnabled, tracks, dimMode]);

  const updateAura = async (trackId: string, delta: number, options?: { skipHaptic?: boolean }) => {
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

    if (nextAuraForDb !== null && delta > 0 && options?.skipHaptic !== true) {
      fireAuraHaptic(nextAuraForDb);
    }

    if (persistedId !== null && nextAuraForDb !== null) {
      try {
        await saveAuraToDb(persistedId, nextAuraForDb);
        markActivePlaylistDirty();
      } catch {}
    }
  };

  const triggerAuraPulseForTrack = (trackId: string) => {
    window.dispatchEvent(new CustomEvent("polyplay:aura-art-hit", { detail: { trackId } }));
    if (!currentTrackId || currentTrackId !== trackId) return;
    window.dispatchEvent(new CustomEvent("polyplay:aura-trigger"));
  };

  const handleAuraUp = (trackId: string) => {
    const targetTrack = tracks.find((track) => track.id === trackId);
    const nextAura = clampAura((targetTrack?.aura ?? 0) + 1);
    fireAuraHaptic(nextAura);
    triggerAuraPulseForTrack(trackId);
    void updateAura(trackId, 1, { skipHaptic: true });
  };

  const pulseAuraAfterVaultClose = () => {
    const trackId = currentTrackIdRef.current;
    if (!trackId) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        triggerAuraPulseForTrack(trackId);
      });
    });
  };

  const playTrack = (trackId: string, autoPlay = true) => {
    logAudioDebug("playTrack() called", { trackId, autoPlay });
    dismissOpenState();
    const selectedTrack = allTracksRef.current.find((track) => track.id === trackId) ?? null;
    const canPlay = Boolean(selectedTrack?.audioUrl) && !selectedTrack?.missingAudio;
    if (autoPlay && canPlay) {
      void ensurePlaybackGainRouting(true);
    }
    const audio = audioRef.current;

    if (trackId === currentTrackId) {
      if (autoPlay && canPlay) {
        if (audio && audio.paused) {
          void resumeCurrentTrackPlayback("same-track");
        }
      }
      return;
    }

    if (repeatTrackMode === "threepeat") {
      setRepeatTrackMode("off");
      threepeatRemainingRef.current = 0;
      try {
        localStorage.setItem(REPEAT_TRACK_KEY, "off");
      } catch {
        // Ignore localStorage failures.
      }
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

  const resumeCurrentTrackPlayback = async (reason: "toggle-play" | "same-track" | "remote-play") => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;
    try {
      await ensurePlaybackGainRouting(true);
      const fallbackResumeTime = Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : currentTime;
      const effectiveDuration = getSafeDuration(duration) || getSafeDuration(audio.duration);
      if (effectiveDuration > 0 && fallbackResumeTime >= Math.max(0, effectiveDuration - 0.05)) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }

      if (audioSrcRef.current !== currentTrack.audioUrl) {
        logAudioDebug("resume:src-repair", { reason, expectedSrc: currentTrack.audioUrl, actualSrc: audioSrcRef.current });
        audio.pause();
        audio.src = currentTrack.audioUrl;
        audioSrcRef.current = currentTrack.audioUrl;
        audio.load();
      } else if (!audio.currentSrc || audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        logAudioDebug("resume:load-refresh", {
          reason,
          readyState: audio.readyState,
          networkState: audio.networkState,
          currentSrc: audio.currentSrc
        });
        audio.load();
      }

      logAudioDebug("play() called", { reason, readyState: audio.readyState });
      await audio.play();
      logAudioDebug("play() resolved", { reason });
      setIsPlaying(true);
      return;
    } catch (error) {
      logAudioDebug("play() rejected", { reason, error: String(error) });
    }

    if (!isIOS) {
      setIsPlaying(false);
      return;
    }

    try {
      const resumeTime = Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : currentTime;
      logAudioDebug("resume:ios-recovery", {
        reason,
        readyState: audio.readyState,
        networkState: audio.networkState,
        resumeTime
      });
      audio.pause();
      audio.src = currentTrack.audioUrl;
      audioSrcRef.current = currentTrack.audioUrl;
      audio.load();

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          audio.removeEventListener("loadedmetadata", onReady);
          audio.removeEventListener("canplay", onReady);
          audio.removeEventListener("error", onError);
          window.clearTimeout(timeoutId);
        };
        const onReady = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };
        const onError = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error("audio-reload-failed"));
        };
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error("audio-reload-timeout"));
        }, 1800);
        audio.addEventListener("loadedmetadata", onReady);
        audio.addEventListener("canplay", onReady);
        audio.addEventListener("error", onError);
      });

      const recoveredDuration = getSafeDuration(audio.duration) || getSafeDuration(duration);
      if (resumeTime > 0 && recoveredDuration > 0) {
        const safeResumeTime = Math.max(0, Math.min(recoveredDuration - 0.05, resumeTime));
        if (safeResumeTime > 0) {
          try {
            audio.currentTime = safeResumeTime;
            commitUiCurrentTime(safeResumeTime, { force: true });
          } catch {
            // Ignore transient seek failures during iOS resume recovery.
          }
        }
      }

      logAudioDebug("play() called", { reason: `${reason}-recovery`, readyState: audio.readyState });
      await audio.play();
      logAudioDebug("play() resolved", { reason: `${reason}-recovery` });
      setIsPlaying(true);
    } catch (recoveryError) {
      logAudioDebug("play() rejected", { reason: `${reason}-recovery`, error: String(recoveryError) });
      setIsPlaying(false);
    }
  };

  const pauseCurrentTrackPlayback = (reason: "toggle-pause" | "remote-pause") => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    commitUiCurrentTime(Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : currentTime, { force: true });
    logAudioDebug("pause() called", { reason });
    audio.pause();
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;
    dismissOpenState();

    if (audio.paused) {
      await resumeCurrentTrackPlayback("toggle-play");
    } else {
      pauseCurrentTrackPlayback("toggle-pause");
    }
  };

  const resumeCurrentTrack = () => {
    const audio = audioRef.current;
    if (!audio || !audio.paused) return;
    void resumeCurrentTrackPlayback("remote-play");
  };

  useEffect(() => {
    const cleanupMediaSession = bindMediaSessionTransportActions({
      onPlay: resumeCurrentTrack,
      onPause: () => {
        pauseCurrentTrackPlayback("remote-pause");
      },
      onTogglePlayPause: () => {
        void togglePlayPause();
      },
      onPreviousTrack: playPrev,
      onNextTrack: playNext
    });

    let isCancelled = false;
    let listenerHandle: null | { remove: () => Promise<void> } = null;

    void addIosNowPlayingRemoteCommandListener((event) => {
      switch (event.command) {
        case "play":
          resumeCurrentTrack();
          break;
        case "togglePlayPause":
          void togglePlayPause();
          break;
        case "pause": {
          pauseCurrentTrackPlayback("remote-pause");
          break;
        }
        case "previousTrack":
          playPrev();
          break;
        case "nextTrack":
          playNext();
          break;
        default:
          break;
      }
    }).then((handle) => {
      if (isCancelled) {
        void handle?.remove();
        return;
      }
      listenerHandle = handle;
    });

    return () => {
      isCancelled = true;
      cleanupMediaSession();
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [playNext, playPrev, resumeCurrentTrack, togglePlayPause]);

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const effectiveDuration = getSafeDuration(duration) || getSafeDuration(audio.duration);
    audio.currentTime = Math.max(0, Math.min(effectiveDuration, seconds));
    setCurrentTime(audio.currentTime);
  };

  const skip = (delta: number) => seekTo((audioRef.current?.currentTime || 0) + delta);

  const setLoopRange = (
    start: number,
    end: number,
    active: boolean,
    options?: { persist?: boolean; editing?: boolean }
  ) => {
    if (!currentTrackId) return;
    const audio = audioRef.current;
    const effectiveDuration = getSafeDuration(duration) || getSafeDuration(audio?.duration || 0);
    if (effectiveDuration <= 0) return;
    const shouldPersist = options?.persist !== false;
    const isEditing = options?.editing === true;
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
      [currentTrackId]: { start: safeStart, end: safeEnd, active: true, editing: isEditing }
    }));
    setLoopModeByTrack((prev) => {
      const nextMode: LoopMode = active ? "region" : "off";
      if (prev[currentTrackId] === nextMode) return prev;
      return {
        ...prev,
        [currentTrackId]: nextMode
      };
    });
    if (shouldPersist) markActivePlaylistDirty();
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
    fireLightHaptic();
    setLoopByTrack((prev) => ({ ...prev, [currentTrackId]: EMPTY_LOOP }));
    setLoopModeByTrack((prev) => ({ ...prev, [currentTrackId]: "off" }));
    markActivePlaylistDirty();
  };

  const setLoopFromCurrentWithExpand = () => {
    if (isPlayerCompact) {
      returnToCompactAfterClearRef.current = true;
      setIsPlayerCompact(false);
    } else {
      returnToCompactAfterClearRef.current = false;
    }
    setLoopFromCurrent();
  };

  const clearLoopWithCompactRestore = () => {
    clearLoop();
    if (returnToCompactAfterClearRef.current) {
      setIsPlayerCompact(true);
      returnToCompactAfterClearRef.current = false;
    }
  };

  const markLayoutToggleHintSeen = () => {
    if (hasSeenLayoutToggleHint) return;
    setHasSeenLayoutToggleHint(true);
    try {
      localStorage.setItem(LAYOUT_TOGGLE_HINT_SEEN_KEY, "true");
    } catch {
      // Ignore non-critical onboarding persistence failures.
    }
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
    setRepeatTrackMode((prev) => {
      const next: RepeatTrackMode = prev === "off" ? "loop-one" : prev === "loop-one" ? "threepeat" : "off";
      if (next === "threepeat") {
        threepeatRemainingRef.current = 3;
        fireHeavyHaptic();
        setFxToast("3PEAT Activated");
      } else {
        threepeatRemainingRef.current = 0;
        fireLightHaptic();
      }
      try {
        localStorage.setItem(REPEAT_TRACK_KEY, next);
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
  };

  const cycleDimMode = () => {
    void ensurePlaybackGainRouting(true);
    setDimMode((prev) => {
      const next: DimMode = isIOS
        ? prev === "mute"
          ? "normal"
          : "mute"
        : prev === "normal"
          ? "dim"
          : prev === "dim"
            ? "mute"
            : "normal";
      try {
        localStorage.setItem(DIM_MODE_KEY, next);
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
  };

  const cycleNoveltyMode = () => {
    setNoveltyMode((prev) => {
      const next: DimMode = prev === "normal" ? "dim" : prev === "dim" ? "mute" : "normal";
      try {
        localStorage.setItem(NOVELTY_MODE_KEY, next);
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
    setFxToast("Vibe switch.");
  };

  const setThemeModeExplicit = (nextSelection: ThemeSelection, event?: MouseEvent<HTMLButtonElement>) => {
    const nextMode: ThemeMode = nextSelection === "dark" ? "dark" : nextSelection === "light" ? "light" : "custom";
    const nextSlot: CustomThemeSlot = nextSelection === "amber" || nextSelection === "teal" || nextSelection === "crimson"
      ? nextSelection
      : customThemeSlot;
    const nextAuraColor = nextMode === "custom" ? THEME_PACK_AURA_COLORS[nextSlot] : nextSelection === "dark" ? null : auraColor;
    setThemeMode(nextMode);
    setCustomThemeSlot(nextSlot);
    if (nextMode === "custom") {
      setAuraColor(nextAuraColor);
    } else if (nextSelection === "dark") {
      setAuraColor(null);
    }
    try {
      localStorage.setItem(THEME_MODE_KEY, nextMode);
      localStorage.setItem(CUSTOM_THEME_SLOT_KEY, nextSlot);
      if (nextMode === "custom" && nextAuraColor) {
        localStorage.setItem(AURA_COLOR_KEY, nextAuraColor);
      } else if (nextSelection === "dark") {
        localStorage.removeItem(AURA_COLOR_KEY);
      }
    } catch {
      // Ignore localStorage failures.
    }
    markActivePlaylistDirty();
    try {
      const overlayFrame = document.querySelector<HTMLIFrameElement>(".app-overlay-frame");
      overlayFrame?.contentWindow?.postMessage(
        { type: "polyplay:theme-changed", themeMode: nextMode, customThemeSlot: nextSlot },
        window.location.origin
      );
    } catch {
      // Ignore cross-document messaging failures.
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      setThemeToggleAnim(nextMode === "light" ? "off" : "on");
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
    const order: ThemeSelection[] = ["dark", "light", "amber", "teal", "crimson"];
    const current = getThemeSelection(themeMode, customThemeSlot);
    const currentIndex = order.indexOf(current);
    const next = order[(currentIndex + 1) % order.length] ?? "dark";
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

  const triggerOnboardingSparkle = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spawnSafeTapBurstAt(centerX, centerY);
    window.setTimeout(() => {
      spawnSafeTapBurstAt(centerX + Math.min(16, rect.width * 0.14), centerY - Math.min(8, rect.height * 0.12));
    }, 36);
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
    setIsGratitudeReactive((prev) => (prev ? prev : true));
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

  const saveUniverseBackup = async (): Promise<boolean> => {
    try {
      const library = await getLibrary();
      const nonDemoTrackCount = countNonDemoTracksForFullBackup(library);
      if (nonDemoTrackCount < MIN_FULL_BACKUP_USER_TRACKS) {
        setVaultStatus(
          `Add at least ${MIN_FULL_BACKUP_USER_TRACKS} imported track before saving a Universe backup.`,
          "error"
        );
        return false;
      }
      setVaultStatus("Zipping backup now.");
      const payload = await exportFullBackup();
      const filename = getFullBackupFilename();
      const saveMode = await saveBlobWithBestEffort(payload.blob, filename, {
        description: "PolyPlay Universe Backup",
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
        saveMode === "shared"
          ? "Vault backup ready to share."
          : saveMode === "save-dialog"
            ? `Saved to selected location: ${filename}.`
            : saveMode === "opened-preview"
              ? `Backup ready for ${filename}. Use Share and Save to Files on iPhone.`
              : `Download started for ${filename}.`,
        "success"
      );
      schedulePlaybackResync("vault-save-return");
      return true;
    } catch (error) {
      if (error instanceof BackupSizeError) {
        setVaultStatus(
          `Save Universe failed: backup estimate ${formatByteCount(error.estimatedBytes)} exceeds this device's export limit of ${formatByteCount(error.capBytes)}.`,
          "error"
        );
      } else {
        setVaultStatus(`Save Universe failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      }
      schedulePlaybackResync("vault-save-return");
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

  const openSettingsPanel = (mode: "upload" | "manage" = "upload") => {
    markHasOnboarded();
    setSettingsPanelMode(mode);
    setOverlayPage("settings");
  };

  const openFullscreenFromPlaybarArt = () => {
    if (!currentTrack) return;
    setIsFullscreenPlayerOpen(true);
    if (hasSeenFullscreenArtHint) return;
    setHasSeenFullscreenArtHint(true);
    try {
      localStorage.setItem(FULLSCREEN_ART_HINT_SEEN_KEY, "true");
    } catch {
      // Ignore non-critical onboarding persistence failures.
    }
  };

  const markPlayerCompactHintSeen = () => {
    if (hasSeenPlayerCompactHint) return;
    setHasSeenPlayerCompactHint(true);
    try {
      localStorage.setItem(PLAYER_COMPACT_HINT_SEEN_KEY, "true");
    } catch {
      // Ignore non-critical onboarding persistence failures.
    }
  };

  const markPlayerVibeHintSeen = () => {
    if (hasSeenPlayerVibeHint) return;
    setHasSeenPlayerVibeHint(true);
    try {
      localStorage.setItem(PLAYER_VIBE_HINT_SEEN_KEY, "true");
    } catch {
      // Ignore non-critical onboarding persistence failures.
    }
  };

  const markPlayerDimHintSeen = () => {
    if (hasSeenPlayerDimHint) return;
    setHasSeenPlayerDimHint(true);
    try {
      localStorage.setItem(PLAYER_DIM_HINT_SEEN_KEY, "true");
    } catch {
      // Ignore non-critical onboarding persistence failures.
    }
  };

  const markNewPlaylistHintSeen = () => {
    if (hasSeenNewPlaylistHint) return;
    setHasSeenNewPlaylistHint(true);
    try {
      localStorage.setItem(NEW_PLAYLIST_HINT_SEEN_KEY, "true");
    } catch {
      // Ignore non-critical onboarding persistence failures.
    }
  };

  const markUploadHintSeen = () => {
    if (hasSeenUploadHint) return;
    setHasSeenUploadHint(true);
    try {
      localStorage.setItem(UPLOAD_HINT_SEEN_KEY, "true");
    } catch {
      // Ignore non-critical onboarding persistence failures.
    }
  };

  const openUploadPanel = () => {
    markUploadHintSeen();
    openSettingsPanel("upload");
  };

  const onLoadUniverseFile = async (file: File | null) => {
    if (!file) return;
    try {
      setImportSummary(null);
      setShowMissingIds(false);
      const summary = await importFullBackup(file);
      teardownCurrentAudio();
      pendingAutoPlayRef.current = false;
      revokeAllMediaUrls();
      setCurrentTrackId(null);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      exitFreshUserOnboardingState();
      window.dispatchEvent(new CustomEvent("polyplay:library-updated"));
      syncPlayerStateFromStorage();
      await refreshTracks();
      await refreshVaultInspector();
      clearActivePlaylistDirty();
      setVaultStatus(
        `Universe loaded. Restored ${summary.restoredTracks} tracks and ${summary.restoredMediaFiles} media files.`,
        "success"
      );
      startVaultImportSuccessCountdown();
    } catch (error) {
      clearVaultImportSuccessCountdown();
      setImportSummary(null);
      setVaultStatus(`Load Universe failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    } finally {
      schedulePlaybackResync("vault-import-return");
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable === true;
      const isInteractiveTarget = Boolean(
        target?.closest("button, a, summary, [role='button'], [role='link'], iframe")
      );

      if (event.key === "Escape") {
        setIsFullscreenPlayerOpen(false);
        setOverlayPage(null);
        setIsTipsOpen(false);
        return;
      }

      if (event.code === "Space") {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
        if (isEditableTarget || isInteractiveTarget) return;
        event.preventDefault();
        void togglePlayPause();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlayPause]);

  useEffect(() => {
    if (!overlayPage) return;
    setIsFullscreenPlayerOpen(false);
  }, [overlayPage]);

  useEffect(() => {
    if (overlayPage !== "vault") return;
    void refreshVaultInspector();
  }, [overlayPage, runtimeLibrary]);

  useEffect(() => {
    if (overlayPage === "vault") return;
    clearVaultImportSuccessCountdown();
  }, [overlayPage]);

  const isAnyModalOpen = Boolean(
    overlayPage || isTipsOpen || isJournalOpen || isGratitudeOpen || showSplash || isFullscreenPlayerOpen || isCreatePlaylistModalOpen
  );
  // Collision prep exists in the bubble engine, but bubbles remain release-disabled here.
  const bubblesEnabled = false;
  const isMainPlayerView = !isAnyModalOpen;
  const fxAllowed = isMainPlayerView && !isNuking && fxEnabled && isPageVisible;
  const fxReducedMotion = isFxReducedMotionContext();

  useEffect(() => {
    if (!fxAllowed) return;

    const isFxBlockedAtPoint = (x: number, y: number, fallbackTarget: EventTarget | null): boolean => {
      const pointTarget =
        typeof document !== "undefined" && typeof document.elementFromPoint === "function"
          ? document.elementFromPoint(x, y)
          : null;
      const candidate = pointTarget ?? (fallbackTarget instanceof Element ? fallbackTarget : null);
      return Boolean(candidate?.closest(FX_INTERACTIVE_GUARD_SELECTORS));
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isCoarsePointer()) return;
      if (isFxBlockedAtPoint(event.clientX, event.clientY, event.target)) return;
      ambientFxRef.current?.onTap(event.clientX, event.clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (fxMode !== "gravity") return;
      if (isCoarsePointer()) return;
      if (isFxBlockedAtPoint(event.clientX, event.clientY, event.target)) return;
      ambientFxRef.current?.onPointerMove(event.clientX, event.clientY);
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      if (isFxBlockedAtPoint(touch.clientX, touch.clientY, event.target)) return;
      ambientFxRef.current?.onTap(touch.clientX, touch.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (fxMode !== "gravity") return;
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) return;
      if (isFxBlockedAtPoint(touch.clientX, touch.clientY, event.target)) return;
      ambientFxRef.current?.onPointerMove(touch.clientX, touch.clientY);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
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

  const activeThemeSelection = getThemeSelection(themeMode, customThemeSlot);
  const ambientAuraRgb = auraHexToRgb(auraColor ?? "#bc84ff");
  const fxThemeRefreshKey = `${themeMode}:${customThemeSlot}:${auraColor ?? "default"}:${currentTrack?.id ?? "none"}:${currentTrack?.aura ?? 0}`;
  const showHeaderUploadButton = true;
  const isPreTourState = isInitialDemoFirstRunState && quickTourPhase === null;
  const isCreatePlaylistGuidanceActive = quickTourPhase === "create-playlist";
  const shouldShowNewPlaylistHint = isCreatePlaylistGuidanceActive && !hasSeenNewPlaylistHint;
  const shouldShowUploadHint = derivedQuickTourPhase === "upload-track" && !hasSeenUploadHint;
  const shouldShowLayoutToggleHint = !hasSeenLayoutToggleHint;
  const shouldHighlightQuickTourStart = isPreTourState;
  const shouldHighlightWelcomeUpload = derivedQuickTourPhase === "upload-track";
  const welcomePhase = isCreatePlaylistGuidanceActive
    ? "create-playlist"
    : derivedQuickTourPhase === "upload-track"
      ? "upload-track"
      : "pre-tour";

  return (
    <>
      <div className="app-shell">
        <div className="effects-layer" aria-hidden="true">
          <AmbientFxCanvas
            ref={ambientFxRef}
            allowed={fxAllowed}
            mode={fxMode}
            quality={fxQuality}
            reducedMotion={fxReducedMotion}
            auraRgb={ambientAuraRgb}
            themeRefreshKey={fxThemeRefreshKey}
          />
          <div
            className={`track-backdrop ${currentTrack?.artUrl || currentTrack?.artGrad ? "is-visible" : ""}`.trim()}
            style={{
              backgroundImage: currentTrack?.artUrl
                ? `url('${currentTrack.artUrl}')`
                : currentTrack?.artGrad || "none"
            }}
          />
          {bubblesEnabled && <BubbleLayer enabled paused={false} onSpark={spawnSafeTapBurstAt} />}
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
            id="appScroll"
            className={`app touch-clean ${isNuking ? "is-nuking" : ""} ${
              showOpenState && hasTracks && !showSplash && !isSplashDismissing && !isGratitudeOpen && !isInitialDemoFirstRunState
                ? "has-open-state-card"
                : "no-open-state-card"
            }`.trim()}
            onAnimationEnd={(event) => {
              if (!isNuking) return;
              if (event.target !== event.currentTarget) return;
              void completeNukeSequence("animationend");
            }}
          >
        <header className="topbar topbar--two-tier">
          <div className="topbar-tier topbar-tier--primary">
            <div className="brand">
              <img className="brand-logo" src={logo} alt="PolyPlay logo" />
            </div>
            <div className="topbar-title">
              <span className="topbar-title__main">{headerTitle}</span>
              <span className="topbar-title__sub">{headerVersion}</span>
            </div>
            <div className="topbar-primary-actions">
              <button
                type="button"
                className="upload-link upload-link--icon nav-action-btn"
                aria-label="Open admin tools"
                title="Admin"
                onClick={() => openSettingsPanel("manage")}
              >
                <span className="gear-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="gear-icon-svg">
                    <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
                    <path d="M10.6 2.9h2.8l.5 2.2c.5.14.96.33 1.4.58l1.9-1.2 2 2-1.2 1.9c.25.44.44.9.58 1.4l2.2.5v2.8l-2.2.5c-.14.5-.33.96-.58 1.4l1.2 1.9-2 2-1.9-1.2c-.44.25-.9.44-1.4.58l-.5 2.2h-2.8l-.5-2.2a7.1 7.1 0 0 1-1.4-.58l-1.9 1.2-2-2 1.2-1.9a7.1 7.1 0 0 1-.58-1.4l-2.2-.5v-2.8l2.2-.5c.14-.5.33-.96.58-1.4l-1.2-1.9 2-2 1.9 1.2c.44-.25.9-.44 1.4-.58l.5-2.2Z" />
                  </svg>
                </span>
              </button>
              {showHeaderUploadButton && (
                <button
                  type="button"
                  className={`upload-link nav-action-btn onboarding-action ${
                    shouldShowUploadHint ? "guided-cta is-onboarding-target" : ""
                  }`.trim()}
                  aria-label="Import tracks"
                  title="Import"
                  onClick={() => openUploadPanel()}
                >
                  Import
                </button>
              )}
            </div>
          </div>
          <div className="topbar-tier topbar-tier--controls">
            <button
              type="button"
              className={`theme-switch ${themeToggleAnim ? `is-anim-${themeToggleAnim}` : ""} ${
                themeBloomActive ? "is-bloom" : ""
              }`.trim()}
              aria-label={`Theme: ${getThemeLabel(activeThemeSelection)}`}
              title={`Theme: ${getThemeLabel(activeThemeSelection)}`}
              onClick={(event) => cycleTheme(event)}
            >
              <span className="theme-switch__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="theme-switch-svg">
                  {themeMode === "light" ? (
                    <>
                      <circle cx="12" cy="12" r="4.2" className="theme-switch-core" />
                      <path
                        d="M12 2.5v3.1M12 18.4v3.1M21.5 12h-3.1M5.6 12H2.5M18.7 5.3l-2.2 2.2M7.5 16.5l-2.2 2.2M18.7 18.7l-2.2-2.2M7.5 7.5 5.3 5.3"
                        className="theme-switch-ray"
                      />
                    </>
                  ) : themeMode === "dark" ? (
                    <path
                      d="M14.9 2.6a8.9 8.9 0 1 0 6.5 14.8A9.5 9.5 0 0 1 14.9 2.6Z"
                      className="theme-switch-core"
                    />
                  ) : (
                    <>
                      <path
                        d="M12 3.2 13.9 8l5.1.4-3.9 3.1 1.3 5-4.4-2.7-4.4 2.7 1.3-5L5 8.4 10.1 8 12 3.2Z"
                        className="theme-switch-core"
                      />
                      <circle cx="18.2" cy="6.2" r="1.4" className="theme-switch-spark" />
                    </>
                  )}
                </svg>
              </span>
            </button>
            <button
              type="button"
              className={`fx-link fx-link--${fxMode} nav-action-btn header-icon-btn--hero ${fxEnabled ? "is-active" : ""}`.trim()}
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
                  <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z" />
                  <path d="M8 8h6M8 11h6M8 14h5" />
                  <path d="m14.5 16.5 4.2-4.2 1.5 1.5-4.2 4.2-2.2.7z" />
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
              className={`layout-link nav-action-btn onboarding-action ${shouldShowLayoutToggleHint ? "has-onboarding-hint" : ""}`.trim()}
              aria-label={`Switch to ${layoutMode === "grid" ? "list" : "grid"} layout`}
              onClick={(event) => {
                if (shouldShowLayoutToggleHint) {
                  triggerOnboardingSparkle(event);
                  markLayoutToggleHintSeen();
                }
                toggleLayoutMode();
              }}
            >
              <span className="layout-icon" aria-hidden="true">
                {layoutMode === "grid" ? "≡" : "▦"}
              </span>
            </button>
          </div>
          <div className="hint">
            {hasTracks ? "Tap tiles to play • Tap playbar art for fullscreen" : "Create/select a playlist, then import tracks."}
          </div>
        </header>

        {runtimeLibrary && Object.keys(runtimeLibrary.playlistsById || {}).length > 0 && (
          <section
            className={`playlist-selector ${isCreatePlaylistGuidanceActive ? "playlist-selector--guided" : ""}`.trim()}
            data-ui="true"
          >
            <label htmlFor="current-playlist-select">Current Playlist</label>
            <div className="playlist-selector__controls">
              <select
                id="current-playlist-select"
                value={activePlaylistId || ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (value === "__create__") {
                    setNewPlaylistName("");
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
                <option value="__create__">Create new PolyPlaylist…</option>
              </select>
              <div className="playlist-selector__action-wrap">
                <button
                  type="button"
                  className={`playlist-selector__action onboarding-action ${
                    shouldShowNewPlaylistHint ? "guided-cta is-onboarding-target" : ""
                  }`.trim()}
                  onClick={(event) => {
                    if (shouldShowNewPlaylistHint) {
                      fireLightHaptic();
                      triggerOnboardingSparkle(event);
                      markNewPlaylistHintSeen();
                    }
                    setNewPlaylistName("");
                    setIsCreatePlaylistModalOpen(true);
                  }}
                >
                  New
                </button>
                {shouldShowNewPlaylistHint && (
                  <div className="playlist-selector__tutorial-tip onboarding-tooltip" role="note">
                    Start by creating a new PolyPlaylist.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {showOpenState && hasTracks && !showSplash && !isSplashDismissing && !isGratitudeOpen && !isInitialDemoFirstRunState && (
          <section className="open-state-card" role="region" aria-label="Welcome">
            <button
              type="button"
              className="open-state-card__close"
              aria-label="Close welcome"
              onClick={dismissOpenState}
            >
              ✕
            </button>
            <div className="open-state-card__title">{`Welcome to PolyPlay ${APP_VERSION}`}</div>
            <p className="open-state-card__body">Tap a tile to start playback, then use Loop modes from the player bar.</p>
            <button type="button" className="open-state-card__dismiss" onClick={dismissOpenState}>
              Start Listening
            </button>
          </section>
        )}

        {!hasOnboarded && !isEmptyWelcomeDismissed && (!hasTracks || isInitialDemoFirstRunState) && (
          <EmptyLibraryWelcome
            phase={welcomePhase}
            onStartQuickTour={() => {
              fireLightHaptic();
              setQuickTourPhase("create-playlist");
            }}
            onUploadFirstTrack={() => openUploadPanel()}
            onPrimaryButtonClick={triggerOnboardingSparkle}
            primaryButtonLabel={welcomePhase === "pre-tour" ? "Start Quick Tour" : "Import your first track"}
            bodyText={
              welcomePhase === "create-playlist"
                ? "Create your first PolyPlaylist to get started."
                : welcomePhase === "upload-track"
                  ? "Now import your first track."
                  : "Take a quick tour to create your first PolyPlaylist and add your own music."
            }
            primaryButtonClassName={
              shouldHighlightQuickTourStart || shouldHighlightWelcomeUpload ? "is-onboarding-target" : undefined
            }
            onClose={() => setIsEmptyWelcomeDismissed(true)}
          />
        )}

        {hasTracks ? (
          <TrackGrid
            tracks={tracks}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            layoutMode={layoutMode}
            onSelectTrack={(trackId) => playTrack(trackId, true)}
            onAuraUp={handleAuraUp}
          />
        ) : null}
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
            handleAuraUp(currentTrackId);
          }}
          onSeek={seekTo}
          onSkip={skip}
          shuffleEnabled={isShuffleEnabled}
          repeatTrackMode={repeatTrackMode}
          dimMode={dimMode}
          dimControlSkipsSoftDim={isIOS}
          noveltyMode={noveltyMode}
          onToggleShuffle={toggleShuffle}
          onToggleRepeatTrack={toggleRepeatTrack}
          onVinylScratch={playVinylScratch}
          onSetLoopRange={setLoopRange}
          onSetLoop={setLoopFromCurrentWithExpand}
          onToggleLoopMode={toggleLoopMode}
          onClearLoop={clearLoopWithCompactRestore}
          onOpenFullscreen={openFullscreenFromPlaybarArt}
          showFullscreenHintCue={!hasSeenFullscreenArtHint}
          showCompactHintCue={!hasSeenPlayerCompactHint}
          showVibeHintCue={!hasSeenPlayerVibeHint}
          showDimHintCue={!hasSeenPlayerDimHint}
          isCompact={isPlayerCompact}
          onToggleCompact={() => {
            setIsPlayerCompact((prev) => !prev);
            markPlayerCompactHintSeen();
          }}
          onCycleNoveltyMode={() => {
            cycleNoveltyMode();
            markPlayerVibeHintSeen();
          }}
          onCycleDimMode={() => {
            cycleDimMode();
            markPlayerDimHintSeen();
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
          repeatTrackMode={repeatTrackMode}
          dimMode={dimMode}
          dimControlSkipsSoftDim={isIOS}
          noveltyMode={noveltyMode}
          onToggleShuffle={toggleShuffle}
          onToggleRepeatTrack={toggleRepeatTrack}
          onCycleDimMode={cycleDimMode}
          onCycleNoveltyMode={cycleNoveltyMode}
          onVinylScratch={playVinylScratch}
          onSetLoopRange={setLoopRange}
          onLoopDragStart={pauseForLoopDrag}
          onLoopDragCommit={resumeAfterLoopDrag}
          onSetLoop={setLoopFromCurrent}
          onToggleLoopMode={toggleLoopMode}
          onClearLoop={clearLoop}
          onAuraUp={() => {
            if (!currentTrackId) return;
            handleAuraUp(currentTrackId);
          }}
          onSkip={skip}
        />
      )}

      {isCreatePlaylistModalOpen && (
        <section className="app-overlay" role="dialog" aria-modal="true" aria-label="Create PolyPlaylist">
          <div className="app-overlay-card playlist-create-card">
            <div className="app-overlay-head">
              <div className="app-overlay-title">
                {isPlaylistRequired ? "Create your first PolyPlaylist" : "Create a new PolyPlaylist"}
              </div>
              {!isPlaylistRequired && (
                <button
                  type="button"
                  className="app-overlay-close"
                  aria-label="Close create PolyPlaylist"
                  onClick={() => setIsCreatePlaylistModalOpen(false)}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="playlist-create-body">
              <p className="playlist-create-copy">
                {isPlaylistRequired
                  ? "Create your first PolyPlaylist to begin."
                  : "Create a new PolyPlaylist and set it active."}
              </p>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (!canCreatePolyplaylist) return;
                  void createPlaylist(newPlaylistName);
                }}
                placeholder="PolyPlaylist name"
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
                  disabled={!canCreatePolyplaylist}
                  onClick={() => void createPlaylist(newPlaylistName)}
                >
                  Create PolyPlaylist
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {overlayPage === "settings" && (
        <section className="app-overlay app-overlay--settings" role="dialog" aria-modal="true" aria-label="settings panel">
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
            <iframe
              title="Settings"
              src={`/admin.html?mode=${settingsPanelMode}`}
              className="app-overlay-frame"
            />
          </div>
        </section>
      )}

      {overlayPage === "vault" && (
        <section
          className="app-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Vault — Full Backup"
          onTouchStart={(event) => {
            if (event.touches.length !== 1) {
              vaultSwipeStartRef.current = null;
              return;
            }
            beginVaultSwipeDismiss(event.touches[0]);
          }}
          onTouchEnd={(event) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            endVaultSwipeDismiss(touch);
          }}
          onTouchCancel={() => {
            vaultSwipeStartRef.current = null;
          }}
        >
          <div className="app-overlay-card vault-card">
            <div className="app-overlay-head">
              <div className="app-overlay-title">Vault — Full Backup</div>
              <button
                type="button"
                className="app-overlay-close"
                aria-label="Close vault"
                onClick={closeVaultOverlay}
              >
                ✕
              </button>
            </div>
            <div className="vault-body">
              {vaultImportCloseCountdownMs !== null && (
                <div className="vault-success-countdown" role="status" aria-live="polite">
                  <h3 className="vault-success-countdown__title">Vault imported successfully</h3>
                  <p className="vault-success-countdown__sub">Closing in</p>
                  <div className="vault-success-countdown__count">
                    {Math.max(1, Math.ceil(vaultImportCloseCountdownMs / 1000))}...
                  </div>
                  <button type="button" className="vault-btn vault-btn--ghost" onClick={closeVaultOverlay}>
                    Close now
                  </button>
                </div>
              )}
              <div className="vault-summary">
                <div>
                  <span className="vault-summary__label">Active Playlist</span>
                  <strong>{activePlaylistName}</strong>
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
                <button
                  type="button"
                  className="vault-btn vault-btn--primary"
                  onClick={() => {
                    void saveUniverseBackup();
                  }}
                >
                  Export Full Backup
                </button>
                <button type="button" className="vault-btn vault-btn--secondary" onClick={onStartImportPolyplaylist}>
                  Import Full Backup
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
              <div className="vault-helper-block">
                <p className="vault-helper">
                  Vault backups contain your personal playlists, imported media, and app settings.
                </p>
                <p className="vault-helper">Only restore backups you trust.</p>
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
              <p className="vault-status vault-status--meta">Full backup includes library metadata and media currently stored in this browser.</p>
              {importSummary && (
                <div className="vault-import-summary">
                  <div>Updated tracks: {importSummary.updatedTrackCount}</div>
                  <div>Missing track IDs: {importSummary.missingTrackIds.length}</div>
                  <div>Reordered count: {importSummary.reorderedCount}</div>
                  <div>Applied playlist ID: {importSummary.targetPlaylistId}</div>
                  {importSummary.debug.matchedCount === 0 && (
                    <p className="vault-import-summary__zero">
                      Imported file applied 0 matching track updates on this device.
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
      {showSplash && (
        <SplashOverlay
          isDismissing={isSplashDismissing}
          onClose={() => finishSplash(false)}
          onSkip={(skipEveryTime) => finishSplash(skipEveryTime)}
          skipLabel={splashSkipLabel}
        />
      )}
      <JournalModal open={isJournalOpen} onClose={() => setIsJournalOpen(false)} />
      <GratitudePrompt
        open={isGratitudeOpen}
        allowAutofocus={!showSplash && !isSplashDismissing}
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
      {vaultToast && (
        <div className={`vault-toast vault-toast--${vaultToast.tone}`.trim()} role="status" aria-live="polite">
          {vaultToast.message}
        </div>
      )}
        </div>
      </div>
    </>
  );
}
