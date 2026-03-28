import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import logo from "../../logo.png";
import { TransferLaneDropZone } from "./TransferLaneDropZone";
import { GratitudeEntriesModal } from "./GratitudeEntriesModal";
import { GratitudeHubPanel } from "./GratitudeHubPanel";
import {
  addTrackToDb,
  clearPlaylistInDb,
  createPlaylistInDb,
  deletePlaylistInDb,
  getStorageUsageSummary,
  getPlaylistsFromDb,
  getTrackStorageRows,
  getTrackRowsFromDb,
  IMPORT_REQUIRES_PLAYLIST_MESSAGE,
  hardResetLibraryInDb,
  isStorageCapError,
  removeDemoTracksInDb,
  removeTrackFromDb,
  renamePlaylistInDb,
  renameTrackInDb,
  replaceAudioInDb,
  resetAuraInDb,
  setActivePlaylistInDb,
  type PlaylistRow,
  type StorageUsageSummary,
  type TrackStorageRow,
  updateArtworkInDb,
  type DbTrackRecord
} from "../lib/db";
import { generateVideoPoster } from "../lib/artwork/videoPoster";
import { normalizeStillImage } from "../lib/artwork/normalizeStillImage";
import { validateVideoArtworkFile } from "../lib/artwork/videoValidation";
import { restoreDemoTracks } from "../lib/demoSeed";
import {
  DEFAULT_GRATITUDE_SETTINGS,
  GRATITUDE_ENTRIES_KEY,
  GRATITUDE_LAST_PROMPT_KEY,
  GRATITUDE_SETTINGS_KEY,
  deleteGratitudeEntry,
  formatGratitudeExport,
  getGratitudeEntries,
  type GratitudeFrequency,
  type GratitudeEntry,
  type GratitudeSettings,
  loadGratitudeSettings,
  saveGratitudeSettings
} from "../lib/gratitude";
import {
  BackupSizeError,
  applyImportedConfig,
  buildConfigSnapshot,
  exportFullBackup,
  exportPolyplaylist,
  getConfigExportFilename,
  getFullBackupFilename,
  getPolyplaylistFilename,
  importFullBackup,
  importPolyplaylist,
  parseConfigImportText,
  serializeConfig
} from "../lib/backup";
import { saveBlobWithBestEffort } from "../lib/saveBlob";
import { titleFromFilename } from "../lib/title";
import { Button } from "../components/button";

const HAS_IMPORTED_KEY = "polyplay_hasImported";
const HAS_ONBOARDED_KEY = "polyplay_hasOnboarded_v1";
const SPLASH_SEEN_KEY = "polyplay_hasSeenSplash";
const SPLASH_SESSION_KEY = "polyplay_hasSeenSplashSession";
const OPEN_STATE_SEEN_KEY = "polyplay_open_state_seen_v102";
const THEME_MODE_KEY = "polyplay_themeMode";
const CUSTOM_THEME_SLOT_KEY = "polyplay_customThemeSlot_v1";
const AURA_COLOR_KEY = "polyplay_auraColor_v1";
const LAYOUT_MODE_KEY = "polyplay_layoutMode";
const SHUFFLE_ENABLED_KEY = "polyplay_shuffleEnabled";
const REPEAT_TRACK_KEY = "polyplay_repeatTrackEnabled";
const DIM_MODE_KEY = "polyplay_dimMode_v1";
const CURRENT_TRACK_ID_KEY = "polyplay_currentTrackId_v1";
const LOOP_REGION_KEY = "polyplay_loopByTrack";
const LOOP_MODE_KEY = "polyplay_loopModeByTrack";
const THEME_PACK_AURA_COLORS: Record<"crimson" | "teal" | "amber", string> = {
  crimson: "#cf6f82",
  teal: "#42c7c4",
  amber: "#f0b35b"
};
const PRIVACY_POLICY_URL = "/privacy-policy.html";
const TERMS_AND_CONDITIONS_URL = "/terms-and-conditions.html";
type ThemeSelection = "dark" | "light" | "amber" | "teal" | "crimson";
type AdminConfirmState =
  | {
      kind: "delete-playlist";
      playlist: PlaylistRow;
    }
  | {
      kind: "remove-track";
      trackId: string;
      message: string;
    }
  | {
      kind: "remove-demo-tracks";
    };

function normalizeAuraColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

function getDefaultAuraByTheme(themeMode: string | null, slot: "crimson" | "teal" | "amber"): string {
  if (themeMode === "light") return "#a066f8";
  if (themeMode === "custom") return THEME_PACK_AURA_COLORS[slot];
  return "#bc84ff";
}

function getThemeSelectionFromState(themeMode: string | null, slot: "crimson" | "teal" | "amber"): ThemeSelection {
  if (themeMode === "light") return "light";
  if (themeMode === "custom") return slot;
  return "dark";
}

function formatTrackLabel(track: DbTrackRecord): string {
  const shortId = track.id.slice(0, 8);
  const missing = [track.missingAudio ? "Missing audio" : "", track.missingArt ? "Missing artwork" : ""]
    .filter(Boolean)
    .join(", ");
  const suffix = missing ? ` • ${missing}` : "";
  return `${track.title?.trim() || `Track ${shortId}`} (#${shortId})${suffix}`;
}

function isVideoArtwork(file: File | null): boolean {
  return Boolean(file?.type?.startsWith("video/"));
}

function isSupportedTrackFile(file: File | null): file is File {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (
    type.startsWith("audio/") ||
    type === "video/mp4" ||
    type === "video/quicktime" ||
    type === "audio/mp4" ||
    type === "audio/x-m4a" ||
    type === "audio/aac"
  ) {
    return true;
  }
  return (
    name.endsWith(".wav") ||
    name.endsWith(".mp3") ||
    name.endsWith(".m4a") ||
    name.endsWith(".aac") ||
    name.endsWith(".mp4") ||
    name.endsWith(".mov")
  );
}

function getDefaultVideoFrameTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0.2;
  const candidate = duration * 0.28;
  const min = Math.min(0.2, Math.max(0, duration - 0.08));
  const max = Math.max(0, duration - 0.08);
  return Math.max(min, Math.min(max, candidate));
}

async function capturePosterFrame(videoFile: File, timeSec: number): Promise<Blob> {
  return generateVideoPoster(videoFile, { timeSec });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getPreferredCurrentTrackId(rows: DbTrackRecord[]): string {
  if (!rows.length) return "";
  try {
    const currentTrackId = localStorage.getItem(CURRENT_TRACK_ID_KEY);
    if (currentTrackId && rows.some((track) => track.id === currentTrackId)) {
      return currentTrackId;
    }
  } catch {
    // Ignore storage failures.
  }
  return String(rows[0].id);
}

export function AdminApp() {
  const [isInitialHydrationPending, setIsInitialHydrationPending] = useState(true);
  const [tracks, setTracks] = useState<DbTrackRecord[]>([]);
  const [status, setStatus] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAudio, setUploadAudio] = useState<File | null>(null);
  const [uploadArt, setUploadArt] = useState<File | null>(null);
  const [uploadArtPreviewUrl, setUploadArtPreviewUrl] = useState("");
  const [uploadArtDuration, setUploadArtDuration] = useState(0);
  const [uploadArtFrameTime, setUploadArtFrameTime] = useState(0);
  const [uploadArtPosterBlob, setUploadArtPosterBlob] = useState<Blob | null>(null);
  const [isUploadPreviewPlaying, setIsUploadPreviewPlaying] = useState(false);
  const uploadFormRef = useRef<HTMLFormElement | null>(null);

  const [selectedArtworkTrackId, setSelectedArtworkTrackId] = useState<string>("");
  const [selectedArtworkFile, setSelectedArtworkFile] = useState<File | null>(null);
  const [selectedArtPreviewUrl, setSelectedArtPreviewUrl] = useState("");
  const [selectedArtDuration, setSelectedArtDuration] = useState(0);
  const [selectedArtFrameTime, setSelectedArtFrameTime] = useState(0);
  const [selectedArtPosterBlob, setSelectedArtPosterBlob] = useState<Blob | null>(null);
  const [isSelectedPreviewPlaying, setIsSelectedPreviewPlaying] = useState(false);

  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string>("");
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedTransferTrackId, setSelectedTransferTrackId] = useState<string>("");
  const [audioTransferMode, setAudioTransferMode] = useState<"create" | "replace">("create");
  const [isAudioLaneBusy, setIsAudioLaneBusy] = useState(false);
  const [isArtworkLaneBusy, setIsArtworkLaneBusy] = useState(false);
  const [laneToast, setLaneToast] = useState<string | null>(null);
  const [uploadSuccessNotice, setUploadSuccessNotice] = useState<string | null>(null);

  const [selectedRemoveTrackId, setSelectedRemoveTrackId] = useState<string>("");
  const [gratitudeSettings, setGratitudeSettings] = useState<GratitudeSettings>(DEFAULT_GRATITUDE_SETTINGS);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeEntry[]>([]);
  const [selectedGratitudeEntry, setSelectedGratitudeEntry] = useState<GratitudeEntry | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsageSummary | null>(null);
  const [trackStorageRows, setTrackStorageRows] = useState<TrackStorageRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingPlaylistName, setEditingPlaylistName] = useState("");
  const [playlistBusyId, setPlaylistBusyId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<AdminConfirmState | null>(null);
  const [sortLargestFirst, setSortLargestFirst] = useState(true);
  const uploadPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const selectedPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [customThemeSlot, setCustomThemeSlot] = useState<"crimson" | "teal" | "amber">(() => {
    try {
      const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
      return slot === "teal" || slot === "amber" ? slot : "crimson";
    } catch {
      return "crimson";
    }
  });
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>(() => {
    try {
      const themeMode = localStorage.getItem(THEME_MODE_KEY);
      const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
      const safeSlot: "crimson" | "teal" | "amber" = slot === "teal" || slot === "amber" ? slot : "crimson";
      return getThemeSelectionFromState(themeMode, safeSlot);
    } catch {
      return "dark";
    }
  });
  const [auraColor, setAuraColor] = useState<string>(() => {
    try {
      return normalizeAuraColor(localStorage.getItem(AURA_COLOR_KEY)) || "#bc84ff";
    } catch {
      return "#bc84ff";
    }
  });
  const [savedAuraColor, setSavedAuraColor] = useState<string>(() => {
    try {
      return normalizeAuraColor(localStorage.getItem(AURA_COLOR_KEY)) || "#bc84ff";
    } catch {
      return "#bc84ff";
    }
  });
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackTitle, setEditingTrackTitle] = useState("");
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [removingTrackIds, setRemovingTrackIds] = useState<string[]>([]);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; openManageStorage?: boolean } | null>(
    null
  );
  const [isNukePromptOpen, setIsNukePromptOpen] = useState(false);
  const [nukeCountdownMs, setNukeCountdownMs] = useState(2000);
  const [isNukeRunning, setIsNukeRunning] = useState(false);
  const nukeTimerRef = useRef<number | null>(null);
  const uploadSuccessNoticeTimeoutRef = useRef<number | null>(null);
  const manageStorageRef = useRef<HTMLElement | null>(null);
  const importConfigInputRef = useRef<HTMLInputElement | null>(null);
  const importBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importPolyplaylistInputRef = useRef<HTMLInputElement | null>(null);
  const [backupProgress, setBackupProgress] = useState("");
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const SHOW_TRANSFER_LANES = false;
  const SHOW_DEMO_TRACKS_SECTION = false;

  const hasTracks = tracks.length > 0;

  const emitLibraryUpdated = () => {
    window.dispatchEvent(new CustomEvent("polyplay:library-updated"));
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
    }
  };

  const trackOptions = useMemo(
    () => tracks.map((track) => ({ value: String(track.id), label: formatTrackLabel(track) })),
    [tracks]
  );

  const refreshTracks = async () => {
    try {
      const rows = await getTrackRowsFromDb();
      setTracks(rows);
      if (!rows.length) {
        setSelectedArtworkTrackId("");
        setSelectedAudioTrackId("");
        setSelectedRemoveTrackId("");
        setSelectedTransferTrackId("");
        return;
      }

      const preferred = getPreferredCurrentTrackId(rows);
      setSelectedArtworkTrackId((prev) =>
        prev && rows.some((track) => track.id === prev) ? prev : preferred
      );
      setSelectedAudioTrackId((prev) =>
        prev && rows.some((track) => track.id === prev) ? prev : preferred
      );
      setSelectedRemoveTrackId((prev) =>
        prev && rows.some((track) => track.id === prev) ? prev : preferred
      );
      setSelectedTransferTrackId((prev) =>
        prev && rows.some((track) => track.id === prev) ? prev : preferred
      );
    } catch {
      setStatus("Failed to load tracks.");
    }
  };

  const refreshStorage = async () => {
    try {
      const [usage, rows] = await Promise.all([getStorageUsageSummary(), getTrackStorageRows()]);
      setStorageUsage(usage);
      setTrackStorageRows(rows);
    } catch {
      setStorageUsage(null);
      setTrackStorageRows([]);
    }
  };

  const refreshPlaylists = async () => {
    try {
      const rows = await getPlaylistsFromDb();
      setPlaylists(rows);
    } catch {
      setPlaylists([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.allSettled([refreshTracks(), refreshStorage(), refreshPlaylists()]);
      if (cancelled) return;
      setIsInitialHydrationPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setGratitudeSettings(loadGratitudeSettings());
    setGratitudeEntries(getGratitudeEntries());
  }, []);

  useEffect(() => {
    const applyTheme = (mode: string | null, slot: "crimson" | "teal" | "amber") => {
      const nextMode = mode === "dark" || mode === "custom" ? mode : "light";
      const root = document.documentElement;
      root.setAttribute("data-theme", nextMode);
      root.setAttribute("data-theme-slot", slot);
      document.body.classList.toggle("theme-dark", nextMode === "dark");
      document.body.classList.toggle("theme-custom", nextMode === "custom");
      document.body.classList.toggle("theme-custom-crimson", nextMode === "custom" && slot === "crimson");
      document.body.classList.toggle("theme-custom-teal", nextMode === "custom" && slot === "teal");
      document.body.classList.toggle("theme-custom-amber", nextMode === "custom" && slot === "amber");
    };
    const saved = localStorage.getItem(THEME_MODE_KEY);
    try {
      const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
      const safeSlot: "crimson" | "teal" | "amber" = slot === "teal" || slot === "amber" ? slot : "crimson";
      applyTheme(saved, safeSlot);
      if (slot === "crimson" || slot === "teal" || slot === "amber") setCustomThemeSlot(slot);
      setThemeSelection(getThemeSelectionFromState(localStorage.getItem(THEME_MODE_KEY), safeSlot));
      const savedAura = normalizeAuraColor(localStorage.getItem(AURA_COLOR_KEY));
      if (savedAura) {
        setAuraColor(savedAura);
        setSavedAuraColor(savedAura);
      }
    } catch {
      // Ignore storage read failures.
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_MODE_KEY) {
        const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
        const safeSlot: "crimson" | "teal" | "amber" = slot === "teal" || slot === "amber" ? slot : "crimson";
        applyTheme(event.newValue, safeSlot);
      }
      if (event.key === CUSTOM_THEME_SLOT_KEY) {
        const slot = event.newValue;
        if (slot === "crimson" || slot === "teal" || slot === "amber") setCustomThemeSlot(slot);
      }
      if (event.key === THEME_MODE_KEY || event.key === CUSTOM_THEME_SLOT_KEY) {
        const mode = localStorage.getItem(THEME_MODE_KEY);
        const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
        const safeSlot: "crimson" | "teal" | "amber" = slot === "teal" || slot === "amber" ? slot : "crimson";
        applyTheme(mode, safeSlot);
        setThemeSelection(getThemeSelectionFromState(mode, safeSlot));
      }
      if (event.key === AURA_COLOR_KEY) {
        const next = normalizeAuraColor(event.newValue);
        if (next) {
          setAuraColor(next);
          setSavedAuraColor(next);
        } else {
          setAuraColor("#bc84ff");
          setSavedAuraColor("#bc84ff");
        }
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "polyplay:theme-changed") return;
      const mode = event.data?.themeMode;
      const slot = event.data?.customThemeSlot;
      const safeSlot: "crimson" | "teal" | "amber" = slot === "teal" || slot === "amber" || slot === "crimson"
        ? slot
        : (localStorage.getItem(CUSTOM_THEME_SLOT_KEY) === "teal" || localStorage.getItem(CUSTOM_THEME_SLOT_KEY) === "amber"
            ? (localStorage.getItem(CUSTOM_THEME_SLOT_KEY) as "teal" | "amber")
            : "crimson");
      applyTheme(mode, safeSlot);
      setThemeSelection(getThemeSelectionFromState(mode, safeSlot));
      if (safeSlot) setCustomThemeSlot(safeSlot);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
      document.body.classList.remove("theme-dark");
      document.body.classList.remove("theme-custom");
      document.body.classList.remove("theme-custom-crimson");
      document.body.classList.remove("theme-custom-teal");
      document.body.classList.remove("theme-custom-amber");
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.removeAttribute("data-theme-slot");
    };
  }, []);

  useEffect(() => {
    const refreshEntries = () => setGratitudeEntries(getGratitudeEntries());
    window.addEventListener("focus", refreshEntries);
    window.addEventListener("storage", refreshEntries);
    return () => {
      window.removeEventListener("focus", refreshEntries);
      window.removeEventListener("storage", refreshEntries);
    };
  }, []);

  useEffect(() => {
    const preventWindowDropNavigation = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", preventWindowDropNavigation);
    window.addEventListener("drop", preventWindowDropNavigation);
    return () => {
      window.removeEventListener("dragover", preventWindowDropNavigation);
      window.removeEventListener("drop", preventWindowDropNavigation);
    };
  }, []);

  useEffect(() => {
    if (!laneToast) return;
    const timer = window.setTimeout(() => setLaneToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [laneToast]);

  useEffect(() => {
    if (!selectedTransferTrackId) {
      setAudioTransferMode("create");
      return;
    }
    setAudioTransferMode("replace");
  }, [selectedTransferTrackId]);

  useEffect(() => {
    return () => {
      if (uploadArtPreviewUrl) URL.revokeObjectURL(uploadArtPreviewUrl);
      if (selectedArtPreviewUrl) URL.revokeObjectURL(selectedArtPreviewUrl);
      if (nukeTimerRef.current !== null) {
        window.clearInterval(nukeTimerRef.current);
        nukeTimerRef.current = null;
      }
      if (uploadSuccessNoticeTimeoutRef.current !== null) {
        window.clearTimeout(uploadSuccessNoticeTimeoutRef.current);
        uploadSuccessNoticeTimeoutRef.current = null;
      }
    };
  }, [selectedArtPreviewUrl, uploadArtPreviewUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (window.parent === window) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        window.parent.postMessage({ type: "polyplay:close-settings" }, window.location.origin);
      } catch {
        // Ignore cross-document messaging failures.
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const notifyUploadSuccess = async () => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:upload-success" }, window.location.origin);
      } else {
        try {
          const audio = new Audio("/hyper-notif.wav");
          audio.volume = 0.85;
          await audio.play();
        } catch {
          // Ignore autoplay restrictions and continue.
        }
        window.location.href = "/index.html";
      }
    } catch {
      // Keep admin page open if messaging/navigation fails.
    }
  };

  const showSuccessNotice = (message: string) => {
    setUploadSuccessNotice(message);
    if (uploadSuccessNoticeTimeoutRef.current !== null) {
      window.clearTimeout(uploadSuccessNoticeTimeoutRef.current);
    }
    uploadSuccessNoticeTimeoutRef.current = window.setTimeout(() => {
      setUploadSuccessNotice(null);
      uploadSuccessNoticeTimeoutRef.current = null;
    }, 2600);
  };

  const notifyUserImported = () => {
    try {
      localStorage.setItem(HAS_IMPORTED_KEY, "true");
    } catch {
      // Ignore storage failures.
    }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:user-imported" }, window.location.origin);
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch {
      // Ignore postMessage failures.
    }
  };

  const setUploadArtworkFile = (file: File | null) => {
    setUploadArt(file);
    setUploadArtPosterBlob(null);
    setUploadArtDuration(0);
    setUploadArtFrameTime(0);
    if (uploadArtPreviewUrl) URL.revokeObjectURL(uploadArtPreviewUrl);
    setUploadArtPreviewUrl(file && isVideoArtwork(file) ? URL.createObjectURL(file) : "");
  };

  const setSelectedArtworkAssetFile = (file: File | null) => {
    setSelectedArtworkFile(file);
    setSelectedArtPosterBlob(null);
    setSelectedArtDuration(0);
    setSelectedArtFrameTime(0);
    if (selectedArtPreviewUrl) URL.revokeObjectURL(selectedArtPreviewUrl);
    setSelectedArtPreviewUrl(file && isVideoArtwork(file) ? URL.createObjectURL(file) : "");
  };

  const onPickUploadAudio = (file: File | null) => {
    setUploadAudio(file);
  };

  const onPickUploadArtwork = async (file: File | null) => {
    if (!file) {
      setUploadArtworkFile(null);
      return;
    }
    if (!uploadAudio) {
      setUploadArtworkFile(null);
      setStatus("Add an audio source to complete this track.");
      return;
    }
    if (isVideoArtwork(file)) {
      const validation = await validateVideoArtworkFile(file);
      if (!validation.ok) {
        setInfoModal({
          title: "Artwork Video Limit",
          message: validation.reason
        });
        setUploadArtworkFile(null);
        return;
      }
    }
    setUploadArtworkFile(file);
  };

  const onPickSelectedArtwork = async (file: File | null) => {
    if (!file) {
      setSelectedArtworkAssetFile(null);
      return;
    }
    const selectedTrack = tracks.find((track) => track.id === selectedArtworkTrackId);
    if (selectedTrack?.missingAudio) {
      setSelectedArtworkAssetFile(null);
      setStatus("Add an audio source to complete this track.");
      return;
    }
    if (isVideoArtwork(file)) {
      const validation = await validateVideoArtworkFile(file);
      if (!validation.ok) {
        setInfoModal({
          title: "Artwork Video Limit",
          message: validation.reason
        });
        setSelectedArtworkAssetFile(null);
        return;
      }
    }
    setSelectedArtworkAssetFile(file);
  };

  const onPickSelectedAudio = (file: File | null) => {
    setSelectedAudioFile(file);
  };

  const seekPreviewVideo = (video: HTMLVideoElement | null, timeSec: number) => {
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const maxTime = Math.max(0, duration - 0.05);
    const nextTime = Math.max(0, Math.min(timeSec, maxTime));
    try {
      video.currentTime = nextTime;
      video.pause();
    } catch {
      // Ignore transient media seek failures.
    }
  };

  const togglePreviewPlayback = async (video: HTMLVideoElement | null) => {
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        // Ignore transient playback failures in preview mode.
      }
      return;
    }
    video.pause();
  };

  const runAudioLaneTransfer = async (file: File) => {
    const mime = file.type.toLowerCase();
    if (mime.startsWith("image/") || mime.startsWith("video/")) {
      setLaneToast("That’s artwork — drop it in Artwork.");
      return;
    }
    if ((!selectedTransferTrackId || audioTransferMode === "create") && playlists.length === 0) {
      setInfoModal({
        title: "Create a Playlist First",
        message: IMPORT_REQUIRES_PLAYLIST_MESSAGE,
        openManageStorage: false
      });
      return;
    }
    setIsAudioLaneBusy(true);
    try {
      if (!selectedTransferTrackId || audioTransferMode === "create") {
        await addTrackToDb({
          title: titleFromFilename(file.name),
          sub: "Imported",
          audio: file
        });
        setStatus("New track created from Audio Track lane.");
      } else {
        await replaceAudioInDb(selectedTransferTrackId, file);
        setStatus("Selected track audio replaced.");
      }
      notifyUserImported();
      await refreshTracks();
      await refreshStorage();
    } catch (error) {
      if (isStorageCapError(error)) {
        setInfoModal({
          title: "Storage Almost Full",
          message: "Storage is almost full. Manage storage to free space before this transfer.",
          openManageStorage: true
        });
      } else if (error instanceof Error && error.message === IMPORT_REQUIRES_PLAYLIST_MESSAGE) {
        setInfoModal({
          title: "Create a Playlist First",
          message: error.message,
          openManageStorage: false
        });
      } else {
        setStatus("Audio transfer failed.");
      }
    } finally {
      setIsAudioLaneBusy(false);
    }
  };

  const runArtworkLaneTransfer = async (file: File) => {
    const mime = file.type.toLowerCase();
    if (mime.startsWith("audio/")) {
      setLaneToast("That’s audio — drop it in Audio Track.");
      return;
    }
    if (!selectedTransferTrackId) {
      setInfoModal({
        title: "Choose a Track",
        message: "Select a track first, then drop artwork.",
        openManageStorage: false
      });
      return;
    }
    if (isVideoArtwork(file)) {
      const validation = await validateVideoArtworkFile(file);
      if (!validation.ok) {
        setInfoModal({ title: "Artwork Video Limit", message: validation.reason });
        return;
      }
    }
    setIsArtworkLaneBusy(true);
    try {
      const artwork = await buildArtworkPayload(file, null);
      await updateArtworkInDb(selectedTransferTrackId, artwork);
      notifyUserImported();
      await refreshTracks();
      await refreshStorage();
      setStatus("Artwork applied from Artwork lane.");
    } catch (error) {
      if (isStorageCapError(error)) {
        setInfoModal({
          title: "Storage Almost Full",
          message: "Storage is almost full. Manage storage to free space before this transfer.",
          openManageStorage: true
        });
      } else {
        setStatus("Artwork transfer failed.");
      }
    } finally {
      setIsArtworkLaneBusy(false);
    }
  };

  const buildArtworkPayload = async (
    file: File | null,
    posterBlob: Blob | null,
    frameTimeSec?: number | null
  ): Promise<{ artPoster: Blob | null; artVideo: Blob | null; posterCaptureFailed: boolean }> => {
    if (!file) return { artPoster: null, artVideo: null, posterCaptureFailed: false };
    if (!isVideoArtwork(file)) {
      const normalizedPoster = await normalizeStillImage(file).catch(() => file);
      return { artPoster: normalizedPoster, artVideo: null, posterCaptureFailed: false };
    }
    let effectivePoster = posterBlob;
    if (!effectivePoster) {
      const requestedFrameTime =
        Number.isFinite(frameTimeSec) && (frameTimeSec ?? 0) >= 0 ? Number(frameTimeSec) : 0.45;
      effectivePoster = await capturePosterFrame(file, requestedFrameTime).catch(() => null);
    }
    return { artPoster: effectivePoster ?? null, artVideo: file, posterCaptureFailed: !effectivePoster };
  };

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupportedTrackFile(uploadAudio)) {
      setStatus("Select a track file (.wav, .mp3, .m4a, .mp4, or .mov).");
      return;
    }
    if (playlists.length === 0) {
      setInfoModal({
        title: "Create a Playlist First",
        message: IMPORT_REQUIRES_PLAYLIST_MESSAGE,
        openManageStorage: false
      });
      return;
    }

    const derivedTitle = uploadTitle.trim() || titleFromFilename(uploadAudio.name);
    setStatus("Importing...");

    try {
      const artwork = await buildArtworkPayload(uploadArt, uploadArtPosterBlob, uploadArtFrameTime);
      await addTrackToDb({
        title: derivedTitle,
        sub: "Imported",
        audio: uploadAudio,
        artPoster: artwork.artPoster,
        artVideo: artwork.artVideo
      });
      notifyUserImported();
      setUploadTitle("");
      setUploadAudio(null);
      setUploadArtworkFile(null);
      setStatus(
        artwork.posterCaptureFailed
          ? "Import complete. Video artwork added (poster frame unavailable on this browser)."
          : "Import complete."
      );
      showSuccessNotice(
        artwork.posterCaptureFailed
          ? "Import complete. Video artwork added."
          : "Import complete."
      );
      await refreshTracks();
      await refreshStorage();
      await notifyUploadSuccess();
    } catch (error) {
      if (isStorageCapError(error)) {
        setInfoModal({
          title: "Storage Almost Full",
          message: "Storage is almost full. Manage storage to free space before importing.",
          openManageStorage: true
        });
        return;
      }
      if (error instanceof Error && error.message === IMPORT_REQUIRES_PLAYLIST_MESSAGE) {
        setInfoModal({
          title: "Create a Playlist First",
          message: error.message,
          openManageStorage: false
        });
        return;
      }
      setStatus("Import failed.");
    }
  };

  const onUpdateArtwork = async () => {
    if (!selectedArtworkTrackId) {
      setStatus("Select a track to update artwork.");
      return;
    }
    if (!selectedArtworkFile) {
      setStatus("Select an artwork file.");
      return;
    }
    const selectedTrack = tracks.find((track) => track.id === selectedArtworkTrackId);
    if (selectedTrack?.missingAudio) {
      setStatus("Add an audio source to complete this track.");
      return;
    }

    setStatus("Updating artwork...");
    try {
      const artwork = await buildArtworkPayload(selectedArtworkFile, selectedArtPosterBlob, selectedArtFrameTime);
      await updateArtworkInDb(selectedArtworkTrackId, artwork);
      notifyUserImported();
      setSelectedArtworkAssetFile(null);
      const successMessage = artwork.posterCaptureFailed
        ? "Artwork updated. Video artwork added (poster frame unavailable on this browser)."
        : "Artwork updated.";
      setStatus(successMessage);
      showSuccessNotice(successMessage);
      await refreshTracks();
      await refreshStorage();
    } catch (error) {
      if (isStorageCapError(error)) {
        setInfoModal({
          title: "Storage Almost Full",
          message: "Storage is almost full. Manage storage to free space before updating artwork.",
          openManageStorage: true
        });
        return;
      }
      setStatus("Artwork update failed.");
    }
  };

  const onReplaceAudio = async () => {
    if (!selectedAudioTrackId) {
      setStatus("Select a track to replace audio.");
      return;
    }
    if (!selectedAudioFile) {
      setStatus("Select a replacement audio file.");
      return;
    }

    setStatus("Replacing audio...");
    try {
      await replaceAudioInDb(selectedAudioTrackId, selectedAudioFile);
      notifyUserImported();
      setSelectedAudioFile(null);
      setStatus("Audio replaced.");
      showSuccessNotice("Audio replaced.");
      await refreshTracks();
      await refreshStorage();
    } catch (error) {
      if (isStorageCapError(error)) {
        setInfoModal({
          title: "Storage Almost Full",
          message: "Storage is almost full. Manage storage to free space before replacing audio.",
          openManageStorage: true
        });
        return;
      }
      setStatus("Audio replace failed.");
    }
  };

  const removeTrackWithStatus = async (trackId: string) => {
    setStatus("Removing track...");
    try {
      setRemovingTrackIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
      await new Promise((resolve) => window.setTimeout(resolve, 170));
      await removeTrackFromDb(trackId);
      setStatus("Track removed.");
      showSuccessNotice("Track removed.");
      await refreshTracks();
      await refreshStorage();
      emitLibraryUpdated();
    } catch {
      setStatus("Track remove failed.");
    } finally {
      setRemovingTrackIds((prev) => prev.filter((id) => id !== trackId));
    }
  };

  const onRemoveTrack = async () => {
    if (!selectedRemoveTrackId) {
      setStatus("Select a track to remove.");
      return;
    }
    setConfirmState({
      kind: "remove-track",
      trackId: selectedRemoveTrackId,
      message: "Remove this track?"
    });
  };

  const onResetAura = async () => {
    if (!window.confirm("Reset aura for all tracks?")) return;

    setStatus("Resetting aura...");
    try {
      const updated = await resetAuraInDb();
      setStatus(`Aura reset for ${updated} track${updated === 1 ? "" : "s"}.`);
      showSuccessNotice(`Aura reset for ${updated} track${updated === 1 ? "" : "s"}.`);
      await refreshTracks();
      emitLibraryUpdated();
    } catch {
      setStatus("Aura reset failed.");
    }
  };

  const runNuke = async () => {
    if (isNukeRunning) return;
    setIsNukeRunning(true);
    try {
      const activePlaylist = playlists.find((playlist) => playlist.isActive);
      if (!activePlaylist) throw new Error("No active playlist");
      const result = await clearPlaylistInDb(activePlaylist.id);
      setStatus(
        result.deletedTracks > 0
          ? `Playlist cleared. Removed ${result.deletedTracks} unshared track${result.deletedTracks === 1 ? "" : "s"}.`
          : "Playlist cleared."
      );
      await refreshTracks();
      await refreshStorage();
      await refreshPlaylists();
      emitLibraryUpdated();
    } catch {
      setStatus("Nuke failed.");
    }
    setIsNukeRunning(false);
  };

  const onNuke = () => {
    if (!hasTracks || isNukeRunning || isNukePromptOpen) return;
    setNukeCountdownMs(2000);
    setIsNukePromptOpen(true);
    setStatus("Nuke armed. Abort within 2 seconds.");
  };

  const abortNuke = () => {
    if (nukeTimerRef.current !== null) {
      window.clearInterval(nukeTimerRef.current);
      nukeTimerRef.current = null;
    }
    setIsNukePromptOpen(false);
    setNukeCountdownMs(2000);
    setStatus("Nuke aborted.");
  };

  useEffect(() => {
    if (!isNukePromptOpen) return;
    const startedAt = Date.now();
    nukeTimerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, 2000 - (Date.now() - startedAt));
      setNukeCountdownMs(remaining);
      if (remaining <= 0) {
        if (nukeTimerRef.current !== null) {
          window.clearInterval(nukeTimerRef.current);
          nukeTimerRef.current = null;
        }
        setIsNukePromptOpen(false);
        void runNuke();
      }
    }, 50);
    return () => {
      if (nukeTimerRef.current !== null) {
        window.clearInterval(nukeTimerRef.current);
        nukeTimerRef.current = null;
      }
    };
  }, [isNukePromptOpen]);

  const onFactoryReset = async () => {
    if (!window.confirm("Factory Reset will delete all playlists and tracks, and reset onboarding. Continue?")) return;
    setStatus("Running factory reset...");
    try {
      await hardResetLibraryInDb();
      await restoreDemoTracks({ preferDemoActive: true });
      localStorage.setItem(THEME_MODE_KEY, "dark");
      localStorage.setItem(CUSTOM_THEME_SLOT_KEY, "crimson");
      localStorage.removeItem(AURA_COLOR_KEY);
      localStorage.setItem(LAYOUT_MODE_KEY, "grid");
      localStorage.setItem(SHUFFLE_ENABLED_KEY, "false");
      localStorage.setItem(REPEAT_TRACK_KEY, "false");
      localStorage.setItem(DIM_MODE_KEY, "normal");
      localStorage.removeItem(LOOP_REGION_KEY);
      localStorage.removeItem(LOOP_MODE_KEY);
      localStorage.removeItem(SPLASH_SEEN_KEY);
      localStorage.removeItem(OPEN_STATE_SEEN_KEY);
      localStorage.removeItem(HAS_IMPORTED_KEY);
      localStorage.removeItem(HAS_ONBOARDED_KEY);
      localStorage.removeItem(GRATITUDE_ENTRIES_KEY);
      localStorage.removeItem(GRATITUDE_LAST_PROMPT_KEY);
      localStorage.setItem(GRATITUDE_SETTINGS_KEY, JSON.stringify(DEFAULT_GRATITUDE_SETTINGS));
      sessionStorage.removeItem(SPLASH_SESSION_KEY);
      setCustomThemeSlot("crimson");
      setAuraColor("#bc84ff");
      setSavedAuraColor("#bc84ff");
      setGratitudeSettings(DEFAULT_GRATITUDE_SETTINGS);
      setGratitudeEntries([]);
      setSelectedGratitudeEntry(null);
      await refreshTracks();
      await refreshStorage();
      await refreshPlaylists();
      emitLibraryUpdated();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:factory-reset" }, window.location.origin);
      }
      setStatus("Factory reset complete. Defaults and demo tracks restored.");
    } catch {
      setStatus("Factory reset failed.");
    }
  };

  const onBackToPlayer = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!(window.parent && window.parent !== window)) return;
    event.preventDefault();
    try {
      window.parent.postMessage({ type: "polyplay:close-settings" }, window.location.origin);
    } catch {
      // If messaging fails, allow normal nav fallback next click.
    }
  };

  const updateGratitudeSettings = (next: GratitudeSettings) => {
    setGratitudeSettings(next);
    saveGratitudeSettings(next);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:gratitude-settings-updated" }, window.location.origin);
      }
    } catch {
      // Ignore postMessage failures.
    }
  };

  const onChangeGratitudeFrequency = (value: GratitudeFrequency) => {
    const nextFrequency: GratitudeFrequency =
      value === "daily" || value === "weekly" || value === "launch" || value === "off" ? value : "daily";
    updateGratitudeSettings({ ...gratitudeSettings, frequency: nextFrequency });
    setStatus("Gratitude prompt frequency updated.");
  };

  const onDeleteGratitudeEntry = (entry: GratitudeEntry) => {
    if (!window.confirm("Delete this gratitude entry?")) return;
    const previousEntries = gratitudeEntries.slice();
    setGratitudeEntries((prev) => prev.filter((item) => item.id !== entry.id));
    if (selectedGratitudeEntry?.id === entry.id) setSelectedGratitudeEntry(null);
    try {
      deleteGratitudeEntry(entry.id);
      setStatus("Gratitude entry deleted.");
    } catch {
      setGratitudeEntries(previousEntries);
      setStatus("Failed to delete gratitude entry.");
    }
  };

  const onCopyAllGratitude = async () => {
    const payload = formatGratitudeExport(gratitudeEntries);
    try {
      await navigator.clipboard.writeText(payload);
      setStatus("Gratitude entries copied.");
    } catch {
      setStatus("Copy failed. Clipboard permissions blocked.");
    }
  };

  const onExportGratitudeTxt = async () => {
    const payload = formatGratitudeExport(gratitudeEntries);
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `polyplay-gratitude-${stamp}.txt`;
    try {
      const saveMode = await saveBlobWithBestEffort(blob, filename, {
        description: "Gratitude Export",
        accept: { "text/plain": [".txt"] }
      });
      setStatus(
        saveMode === "shared"
          ? "Gratitude .txt ready to share."
          : saveMode === "opened-preview"
            ? "Gratitude .txt opened. Use Share or Save to Files."
            : "Gratitude .txt exported."
      );
    } catch {
      setStatus("Gratitude .txt export failed.");
    }
  };

  const onExportConfig = async () => {
    try {
      setStatus("Preparing download…");
      const content = serializeConfig(buildConfigSnapshot());
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const filename = getConfigExportFilename();
      const saveMode = await saveBlobWithBestEffort(blob, filename, {
        description: "PolyPlay Config",
        accept: { "application/json": [".json"] }
      });
      setStatus(
        saveMode === "shared"
          ? `Share sheet opened for ${filename}.`
          : saveMode === "save-dialog"
            ? `Saved to selected location: ${filename}.`
            : saveMode === "opened-preview"
              ? `Config opened for ${filename}. Use Share and Save to Files on iPhone.`
              : `Download started for ${filename}.`
      );
    } catch {
      setStatus("Config export failed.");
    }
  };

  const onImportConfigFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseConfigImportText(text);
      const result = applyImportedConfig(parsed);
      await refreshTracks();
      setStatus(
        result.skippedTrackCount > 0
          ? `Config imported. ${result.appliedTrackCount} tracks updated, ${result.skippedTrackCount} skipped (not found).`
          : `Config imported. ${result.appliedTrackCount} tracks updated.`
      );
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:config-imported" }, window.location.origin);
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`Config import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const onExportFullBackup = async () => {
    if (isBackupBusy) return;
    setIsBackupBusy(true);
    setBackupProgress("Preparing backup…");
    setStatus("Preparing download…");
    try {
      const result = await exportFullBackup((progress) => {
        setBackupProgress(progress.label);
      });
      const filename = getFullBackupFilename();
      const saveMode = await saveBlobWithBestEffort(result.blob, filename, {
        description: "PolyPlay Full Backup",
        accept: { "application/zip": [".zip"] }
      });
      setStatus(
        saveMode === "shared"
          ? `Share sheet opened for ${filename}.`
          : saveMode === "save-dialog"
            ? `Saved to selected location: ${filename}.`
            : saveMode === "opened-preview"
              ? `Backup opened for ${filename}. Use Share and Save to Files on iPhone.`
              : `Download started (${result.trackCount} tracks).`
      );
      setBackupProgress("");
    } catch (error) {
      if (error instanceof BackupSizeError) {
        setInfoModal({
          title: "Backup Too Large",
          message: `Backup estimate exceeds 250MB (${formatBytes(error.estimatedBytes)}). Remove tracks or use Export Config.`
        });
      } else {
        setStatus(`Full backup export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
      setBackupProgress("");
    } finally {
      setIsBackupBusy(false);
    }
  };

  const onImportFullBackupFile = async (file: File | null) => {
    if (!file || isBackupBusy) return;
    setIsBackupBusy(true);
    setBackupProgress("Importing backup…");
    try {
      const summary = await importFullBackup(file);
      await refreshTracks();
      await refreshStorage();
      setStatus(
        `Backup imported. Restored ${summary.restoredTracks} tracks and ${summary.restoredMediaFiles} media files.`
      );
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:config-imported" }, window.location.origin);
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`Full backup import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setBackupProgress("");
      setIsBackupBusy(false);
    }
  };

  const onExportPolyplaylist = async () => {
    try {
      setIsBackupBusy(true);
      setStatus("Preparing download…");
      const result = await exportPolyplaylist();
      const filename = getPolyplaylistFilename(result.playlistName);
      const saveMode = await saveBlobWithBestEffort(result.blob, filename, {
        description: "PolyPlaylist Export",
        accept: { "application/zip": [".polyplaylist", ".zip"] }
      });
      setStatus(
        saveMode === "shared"
          ? `Share sheet opened for ${filename}.`
          : saveMode === "save-dialog"
            ? `Saved to selected location: ${filename}.`
            : saveMode === "opened-preview"
              ? `PolyPlaylist opened for ${filename}. Use Share and Save to Files on iPhone.`
              : `PolyPlaylist exported: ${result.trackCount} track${result.trackCount === 1 ? "" : "s"} from "${result.playlistName}".`
      );
    } catch (error) {
      setStatus(`PolyPlaylist export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsBackupBusy(false);
    }
  };

  const onImportPolyplaylistFile = async (file: File | null) => {
    if (!file) return;
    try {
      setIsBackupBusy(true);
      const summary = await importPolyplaylist(file);
      await refreshTracks();
      await refreshPlaylists();
      await refreshStorage();
      setStatus(
        `PolyPlaylist imported to "${summary.playlistName}" (${summary.importedTracks} track${
          summary.importedTracks === 1 ? "" : "s"
        }, ${summary.importedMediaFiles} media files).`
      );
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:config-imported" }, window.location.origin);
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`PolyPlaylist import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsBackupBusy(false);
    }
  };

  const onRemoveDemoTracks = async () => {
    try {
      const removed = await removeDemoTracksInDb();
      setStatus(`Removed ${removed} demo track${removed === 1 ? "" : "s"}.`);
      await refreshTracks();
      await refreshStorage();
      emitLibraryUpdated();
    } catch {
      setStatus("Failed to remove demo tracks.");
    }
  };

  const onRestoreDemoTracks = async () => {
    try {
      const result = await restoreDemoTracks({ preferDemoActive: true });
      setStatus(
        result.failed > 0 && result.restored === 0
          ? `Restore failed for ${result.failed} demo track${result.failed === 1 ? "" : "s"}.`
          : result.restored > 0
          ? `Restored ${result.restored} demo track${result.restored === 1 ? "" : "s"}.${
              result.repaired > 0 ? ` Repaired ${result.repaired} poster${result.repaired === 1 ? "" : "s"}.` : ""
            }`
          : result.repaired > 0
            ? `Demo tracks already existed. Repaired ${result.repaired} poster${result.repaired === 1 ? "" : "s"}.`
            : result.failed > 0
              ? `Demo restore partial: ${result.failed} failed, ${result.skipped} skipped.`
              : "Demo tracks are already restored."
      );
      await refreshTracks();
      await refreshStorage();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`Failed to restore demo tracks: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const onCreatePlaylist = async () => {
    const proposed = newPlaylistName.trim();
    setPlaylistBusyId("create");
    try {
      await createPlaylistInDb(proposed || `Playlist ${playlists.length + 1}`);
      setNewPlaylistName("");
      setStatus("Playlist created.");
      await refreshPlaylists();
      await refreshTracks();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`Playlist create failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setPlaylistBusyId(null);
    }
  };

  const onActivatePlaylist = async (playlistId: string) => {
    setPlaylistBusyId(playlistId);
    try {
      await setActivePlaylistInDb(playlistId);
      setStatus("Active playlist changed.");
      await refreshPlaylists();
      await refreshTracks();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`Playlist switch failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setPlaylistBusyId(null);
    }
  };

  const onSavePlaylistRename = async (playlistId: string) => {
    const trimmed = editingPlaylistName.trim();
    if (!trimmed) {
      setStatus("Playlist name can't be empty.");
      return;
    }
    setPlaylistBusyId(playlistId);
    try {
      await renamePlaylistInDb(playlistId, trimmed);
      setEditingPlaylistId(null);
      setEditingPlaylistName("");
      setStatus("Playlist renamed.");
      await refreshPlaylists();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`Playlist rename failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setPlaylistBusyId(null);
    }
  };

  const onDeletePlaylist = async (playlist: PlaylistRow) => {
    setPlaylistBusyId(playlist.id);
    const previousPlaylists = playlists.slice();
    setPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
    try {
      const result = await deletePlaylistInDb(playlist.id);
      setStatus(
        result.deletedTracks > 0
          ? `Playlist deleted. Removed ${result.deletedTracks} unreferenced track${result.deletedTracks === 1 ? "" : "s"}.`
          : "Playlist deleted."
      );
      await refreshPlaylists();
      await refreshTracks();
      await refreshStorage();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setPlaylists(previousPlaylists);
      setStatus(`Playlist delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setPlaylistBusyId(null);
    }
  };

  const confirmCurrentAction = async () => {
    const current = confirmState;
    if (!current) return;
    setConfirmState(null);
    if (current.kind === "delete-playlist") {
      await onDeletePlaylist(current.playlist);
      return;
    }
    if (current.kind === "remove-track") {
      await removeTrackWithStatus(current.trackId);
      return;
    }
    if (current.kind === "remove-demo-tracks") {
      await onRemoveDemoTracks();
    }
  };

  const onStartTrackRename = (trackId: string, title: string) => {
    setEditingTrackId(trackId);
    setEditingTrackTitle(title);
  };

  const onCancelTrackRename = () => {
    setEditingTrackId(null);
    setEditingTrackTitle("");
  };

  const onSaveTrackRename = async (trackId: string) => {
    const trimmed = editingTrackTitle.trim();
    if (!trimmed) {
      setStatus("Title can't be empty.");
      return;
    }
    setRenamingTrackId(trackId);
    try {
      await renameTrackInDb(trackId, trimmed);
      setStatus("Track renamed.");
      onCancelTrackRename();
      await refreshTracks();
      await refreshStorage();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`Track rename failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setRenamingTrackId(null);
    }
  };

  const visibleTrackStorageRows = useMemo(() => {
    const next = trackStorageRows.slice();
    if (sortLargestFirst) return next.sort((a, b) => b.totalBytes - a.totalBytes);
    return next.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sortLargestFirst, trackStorageRows]);

  const adminMode = useMemo<"upload" | "manage">(() => {
    if (typeof window === "undefined") return "manage";
    const mode = new URLSearchParams(window.location.search).get("mode");
    return mode === "upload" ? "upload" : "manage";
  }, []);
  const showUploadTrackSection = adminMode === "upload";
  const showManageSections = adminMode !== "upload";
  const showBackupsSection = false;
  const isImportArmed = Boolean(uploadAudio);
  const isUpdateArtworkArmed = Boolean(selectedArtworkFile);
  const isReplaceAudioArmed = Boolean(selectedAudioFile);

  return (
    <div
      className={`admin-v1 touch-clean mx-auto w-full max-w-5xl px-3 pt-3 sm:px-4 ${
        isNukePromptOpen ? "admin-v1--nuke-arming" : ""
      }`.trim()}
    >
      {uploadSuccessNotice && (
        <div className="admin-upload-success-toast" role="status" aria-live="polite">
          {uploadSuccessNotice}
        </div>
      )}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-300/20 bg-slate-900/85 p-3 shadow-glow backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={logo}
            alt="PolyPlay logo"
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-300/20"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-100">PolyPlay Admin</h1>
            <p className="truncate text-xs text-slate-400">
              {adminMode === "upload" ? "Import Track" : "Manage Library"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/index.html"
            className="admin-back-link rounded-xl border border-slate-300/20 bg-slate-800/70 px-3 py-2 text-sm text-slate-100"
            onClick={onBackToPlayer}
          >
            <span className="admin-back-link__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </span>
            <span>Back to Player</span>
          </a>
        </div>
      </header>

      {isInitialHydrationPending ? (
        <section className="admin-v1-card min-h-[420px] rounded-2xl border border-slate-300/20 bg-slate-900/70 p-4">
          <div className="flex min-h-[388px] flex-col items-center justify-center gap-3 text-center">
            <div className="text-lg font-semibold text-slate-100">Loading PolyPlay Admin…</div>
            <p className="max-w-md text-sm text-slate-400">
              Restoring tracks, playlists, and storage details before showing settings.
            </p>
          </div>
        </section>
      ) : (
      <>
      <div className="admin-content">
      <section className={`admin-v1-section grid gap-3 ${showManageSections ? "lg:grid-cols-2" : ""}`.trim()}>
        {showUploadTrackSection && (
        <form
          ref={uploadFormRef}
          onSubmit={onUpload}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (!uploadAudio) return;
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName ?? "";
            if (tagName === "TEXTAREA" || tagName === "SELECT" || tagName === "BUTTON") return;
            if (target instanceof HTMLInputElement && (target.type === "range" || target.type === "file")) return;
            event.preventDefault();
            uploadFormRef.current?.requestSubmit();
          }}
          className="admin-v1-card rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3"
        >
          <h2 className="mb-2 text-base font-semibold text-slate-100">Import Track</h2>
          <div className="admin-v1-fields admin-upload-stack grid gap-2">
            <label className="grid gap-1 text-sm text-slate-300">
              Title
              <input
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.currentTarget.value)}
                className="admin-upload-input rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>

            <TransferLaneDropZone
              label="Audio (.wav/.mp3/.mov)"
              tooltip="Fallback importer for direct track creation."
              iconType="audio"
              accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,video/mp4,video/quicktime,.wav,.mp3,.m4a,.aac,.mp4,.mov"
              selectedFileName={uploadAudio?.name}
              armed={Boolean(uploadAudio)}
              onFileSelected={(file) => void onPickUploadAudio(file)}
            />

            <TransferLaneDropZone
              label="Artwork (image, mp4, or mov, optional)"
              tooltip="Fallback artwork picker for manual import flow."
              iconType="artwork"
              accept="image/*,video/mp4,video/quicktime,.mov"
              selectedFileName={uploadArt?.name}
              armed={Boolean(uploadArt)}
              onFileSelected={(file) => void onPickUploadArtwork(file)}
              disabled={!uploadAudio}
            />
            {uploadArtPreviewUrl && (
              <div className="video-frame-picker">
                <label className="text-xs text-slate-300">Poster frame for static artwork</label>
                <div className="frame-video-shell">
                  <video
                    ref={uploadPreviewVideoRef}
                    className="frame-video"
                    src={uploadArtPreviewUrl}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(event) => {
                      const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                      const frameTime = getDefaultVideoFrameTime(duration);
                      setUploadArtDuration(duration);
                      setUploadArtFrameTime(frameTime);
                      seekPreviewVideo(event.currentTarget, frameTime);
                    }}
                    onPlay={() => setIsUploadPreviewPlaying(true)}
                    onPause={() => setIsUploadPreviewPlaying(false)}
                    onEnded={() => setIsUploadPreviewPlaying(false)}
                  />
                  <button
                    type="button"
                    className="frame-video-toggle"
                    aria-label={isUploadPreviewPlaying ? "Pause artwork preview" : "Play artwork preview"}
                    onClick={() => void togglePreviewPlayback(uploadPreviewVideoRef.current)}
                  >
                    {isUploadPreviewPlaying ? "❚❚" : "▶"}
                  </button>
                </div>
                <input
                  className="frame-slider"
                  type="range"
                  min={0}
                  max={Math.max(0, uploadArtDuration)}
                  step={0.05}
                  value={Math.min(uploadArtFrameTime, Math.max(0, uploadArtDuration))}
                  onChange={(event) => {
                    const nextTime = Number(event.currentTarget.value);
                    setUploadArtFrameTime(nextTime);
                    seekPreviewVideo(uploadPreviewVideoRef.current, nextTime);
                  }}
                />
                <div className="text-xs text-slate-400">Frame: {uploadArtFrameTime.toFixed(2)}s</div>
              </div>
            )}

            <Button
              variant="primary"
              type="submit"
              className={`admin-upload-submit ${isImportArmed ? "admin-action-armed" : ""}`.trim()}
            >
              Import
            </Button>
          </div>
        </form>
        )}

        {showManageSections && (
        <div className="admin-v1-card admin-track-ops rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
          <h2 className="mb-2 text-base font-semibold text-slate-100">Track Operations</h2>

          <div className="admin-v1-fields grid gap-2">
            <label className="grid gap-1 text-sm text-slate-300">
              Update artwork
              <select
                value={selectedArtworkTrackId}
                onChange={(event) => setSelectedArtworkTrackId(event.currentTarget.value)}
                disabled={!hasTracks}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              >
                {trackOptions.map((option) => (
                  <option key={`art-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <TransferLaneDropZone
                label="New artwork file"
                tooltip="Manual replace: choose artwork for the selected track."
                iconType="artwork"
                accept="image/*,video/mp4,video/quicktime,.mov"
                compact
                selectedFileName={selectedArtworkFile?.name}
                armed={Boolean(selectedArtworkFile)}
                onFileSelected={(file) => void onPickSelectedArtwork(file)}
                disabled={!hasTracks}
              />
              {selectedArtPreviewUrl && (
                <div className="video-frame-picker">
                  <label className="text-xs text-slate-300">Poster frame for static artwork</label>
                  <div className="frame-video-shell">
                    <video
                      ref={selectedPreviewVideoRef}
                      className="frame-video"
                      src={selectedArtPreviewUrl}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(event) => {
                        const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                        const frameTime = getDefaultVideoFrameTime(duration);
                        setSelectedArtDuration(duration);
                        setSelectedArtFrameTime(frameTime);
                        seekPreviewVideo(event.currentTarget, frameTime);
                      }}
                      onPlay={() => setIsSelectedPreviewPlaying(true)}
                      onPause={() => setIsSelectedPreviewPlaying(false)}
                      onEnded={() => setIsSelectedPreviewPlaying(false)}
                    />
                    <button
                      type="button"
                      className="frame-video-toggle"
                      aria-label={isSelectedPreviewPlaying ? "Pause artwork preview" : "Play artwork preview"}
                      onClick={() => void togglePreviewPlayback(selectedPreviewVideoRef.current)}
                    >
                      {isSelectedPreviewPlaying ? "❚❚" : "▶"}
                    </button>
                  </div>
                  <input
                    className="frame-slider"
                    type="range"
                    min={0}
                    max={Math.max(0, selectedArtDuration)}
                    step={0.05}
                    value={Math.min(selectedArtFrameTime, Math.max(0, selectedArtDuration))}
                    onChange={(event) => {
                      const nextTime = Number(event.currentTarget.value);
                      setSelectedArtFrameTime(nextTime);
                      seekPreviewVideo(selectedPreviewVideoRef.current, nextTime);
                    }}
                  />
                  <div className="text-xs text-slate-400">Frame: {selectedArtFrameTime.toFixed(2)}s</div>
                </div>
              )}
              <Button
                variant="primary"
                onClick={onUpdateArtwork}
                disabled={!hasTracks}
                className={isUpdateArtworkArmed ? "admin-action-armed" : ""}
              >
                Update Artwork
              </Button>
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Replace audio
              <select
                value={selectedAudioTrackId}
                onChange={(event) => setSelectedAudioTrackId(event.currentTarget.value)}
                disabled={!hasTracks}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              >
                {trackOptions.map((option) => (
                  <option key={`audio-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <TransferLaneDropZone
                label="Replacement audio file"
                tooltip="Manual replace: choose new audio for the selected track."
                iconType="audio"
                accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,video/mp4,video/quicktime,.wav,.mp3,.m4a,.aac,.mp4,.mov"
                compact
                selectedFileName={selectedAudioFile?.name}
                armed={Boolean(selectedAudioFile)}
                onFileSelected={(file) => void onPickSelectedAudio(file)}
                disabled={!hasTracks}
              />
              <Button
                variant="primary"
                onClick={onReplaceAudio}
                disabled={!hasTracks}
                className={isReplaceAudioArmed ? "admin-action-armed" : ""}
              >
                Replace Audio
              </Button>
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Remove track
              <select
                value={selectedRemoveTrackId}
                onChange={(event) => setSelectedRemoveTrackId(event.currentTarget.value)}
                disabled={!hasTracks}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              >
                {trackOptions.map((option) => (
                  <option key={`remove-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button variant="danger" onClick={onRemoveTrack} disabled={!hasTracks}>
                Remove Track
              </Button>
            </label>
          </div>
        </div>
        )}

        {showManageSections && SHOW_TRANSFER_LANES && (
        <div className="admin-v1-card rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3 lg:col-span-2">
          <h2 className="mb-2 text-base font-semibold text-slate-100">Transfer Lanes</h2>
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-300">
              Target Track
              <select
                value={selectedTransferTrackId}
                onChange={(event) => setSelectedTransferTrackId(event.currentTarget.value)}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              >
                <option value="">No track selected (create new on audio drop)</option>
                {trackOptions.map((option) => (
                  <option key={`lane-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="grid gap-1 text-sm text-slate-300">
              <legend className="text-sm text-slate-300">Audio drop behavior</legend>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={audioTransferMode === "create"}
                  onChange={() => setAudioTransferMode("create")}
                />
                <span>Create new track</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  checked={audioTransferMode === "replace"}
                  onChange={() => setAudioTransferMode("replace")}
                  disabled={!selectedTransferTrackId}
                />
                <span>Replace selected track audio</span>
              </label>
            </fieldset>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            <TransferLaneDropZone
              label="Audio Track"
              tooltip="Drop audio files here to create a new track or replace the selected track’s audio."
              iconType="audio"
              accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,video/mp4,video/quicktime,.wav,.mp3,.m4a,.aac,.mp4,.mov"
              selectedFileName={audioTransferMode === "replace" ? selectedAudioFile?.name : uploadAudio?.name}
              busy={isAudioLaneBusy}
              onFileSelected={async (file) => {
                if (!file) return;
                if (audioTransferMode === "replace") setSelectedAudioFile(file);
                else setUploadAudio(file);
                await runAudioLaneTransfer(file);
              }}
            />
            <TransferLaneDropZone
              label="Artwork (Image or Video Artwork Loop)"
              tooltip="Drop images or short video loops here to set artwork for the selected track."
              iconType="artwork"
              hint="Video loops ≤20s • ≤60MB mobile"
              accept="image/*,video/mp4,video/quicktime,.mov,.jpg,.jpeg,.png,.webp"
              selectedFileName={selectedArtworkFile?.name || uploadArt?.name}
              busy={isArtworkLaneBusy}
              onFileSelected={async (file) => {
                if (!file) return;
                setSelectedArtworkFile(file);
                await runArtworkLaneTransfer(file);
              }}
            />
          </div>
        </div>
        )}
      </section>

      {showManageSections && (
      <>
      <div hidden aria-hidden="true">
        <GratitudeHubPanel
          settings={gratitudeSettings}
          entries={gratitudeEntries}
          onChangeEnabled={(enabled) => {
            updateGratitudeSettings({ ...gratitudeSettings, enabled });
            setStatus(`Gratitude prompt ${enabled ? "enabled" : "disabled"}.`);
          }}
          onChangeFrequency={onChangeGratitudeFrequency}
          onOpenEntry={setSelectedGratitudeEntry}
          onDeleteEntry={onDeleteGratitudeEntry}
          onCopyAll={onCopyAllGratitude}
          onExportTxt={onExportGratitudeTxt}
        />
      </div>

      <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3 playlist-manager">
        <div className="playlist-manager__head">
          <h2 className="text-base font-semibold text-slate-100">Polyplaylist Manager</h2>
          <p className="playlist-manager__sub">Switch galleries fast, rename cleanly, and keep imported packs organized.</p>
        </div>
        <div className="playlist-manager__create">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void onCreatePlaylist();
            }}
            className="playlist-manager__input"
            placeholder="New playlist name"
          />
          <Button variant="primary" onClick={() => void onCreatePlaylist()} disabled={playlistBusyId === "create"}>
            New Playlist
          </Button>
        </div>
        <div className="playlist-manager__list">
          {playlists.map((playlist) => {
            const isEditing = editingPlaylistId === playlist.id;
            const isBusy = playlistBusyId === playlist.id;
            return (
              <article
                key={playlist.id}
                className={`playlist-row ${playlist.isActive ? "is-active" : ""} ${isBusy ? "is-busy" : ""}`.trim()}
              >
                <div className="playlist-row__main">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingPlaylistName}
                      onChange={(event) => setEditingPlaylistName(event.currentTarget.value)}
                      className="playlist-row__rename"
                      autoFocus
                    />
                  ) : (
                    <h3>{playlist.name}</h3>
                  )}
                  <p>
                    {playlist.trackCount} track{playlist.trackCount === 1 ? "" : "s"}
                    {playlist.isActive ? " • Active" : ""}
                  </p>
                </div>
                <div className="playlist-row__actions">
                  {!playlist.isActive && (
                    <Button variant="secondary" onClick={() => void onActivatePlaylist(playlist.id)} disabled={Boolean(playlistBusyId)}>
                      Activate
                    </Button>
                  )}
                  {isEditing ? (
                    <>
                      <Button variant="primary" onClick={() => void onSavePlaylistRename(playlist.id)} disabled={isBusy}>
                        Save
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingPlaylistId(null);
                          setEditingPlaylistName("");
                        }}
                        disabled={isBusy}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingPlaylistId(playlist.id);
                        setEditingPlaylistName(playlist.name);
                      }}
                      disabled={Boolean(playlistBusyId)}
                    >
                      Rename
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={() => setConfirmState({ kind: "delete-playlist", playlist })}
                    disabled={playlists.length <= 1 || Boolean(playlistBusyId)}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
          {!playlists.length && <div className="playlist-manager__empty">No playlists found.</div>}
        </div>
      </section>

      <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Theme</h2>
        <div className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
          <label className="text-sm text-slate-200" htmlFor="theme-selection">
            Theme selection
          </label>
          <select
            id="theme-selection"
            className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            value={themeSelection}
            onChange={(event) => {
              const selected = event.currentTarget.value as ThemeSelection;
              if (selected !== "dark" && selected !== "light" && selected !== "amber" && selected !== "teal" && selected !== "crimson") return;
              const nextMode = selected === "dark" ? "dark" : selected === "light" ? "light" : "custom";
              const nextSlot: "crimson" | "teal" | "amber" =
                selected === "amber" || selected === "teal" || selected === "crimson" ? selected : customThemeSlot;
              setThemeSelection(selected);
              setCustomThemeSlot(nextSlot);
              try {
                localStorage.setItem(CUSTOM_THEME_SLOT_KEY, nextSlot);
                localStorage.setItem(THEME_MODE_KEY, nextMode);
              } catch {
                // Ignore localStorage failures.
              }
              if (nextMode === "custom") {
                const auraForSlot = THEME_PACK_AURA_COLORS[nextSlot];
                setAuraColor(auraForSlot);
                setSavedAuraColor(auraForSlot);
                try {
                  localStorage.setItem(AURA_COLOR_KEY, auraForSlot);
                } catch {
                  // Ignore localStorage failures.
                }
              } else if (selected === "dark") {
                setAuraColor("#bc84ff");
                setSavedAuraColor("#bc84ff");
                try {
                  localStorage.removeItem(AURA_COLOR_KEY);
                } catch {
                  // Ignore localStorage failures.
                }
              }
              try {
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: "polyplay:theme-mode-updated", themeMode: nextMode }, window.location.origin);
                  window.parent.postMessage({ type: "polyplay:custom-theme-slot-updated", slot: nextSlot }, window.location.origin);
                  if (nextMode === "custom") {
                    window.parent.postMessage({ type: "polyplay:aura-color-updated", color: THEME_PACK_AURA_COLORS[nextSlot] }, window.location.origin);
                  } else if (selected === "dark") {
                    window.parent.postMessage({ type: "polyplay:aura-color-updated", color: null }, window.location.origin);
                  }
                }
              } catch {
                // Ignore postMessage failures.
              }
              setStatus(
                nextMode === "custom"
                  ? `Theme set to ${nextSlot}. Aura matched to pack.`
                  : `Theme set to ${nextMode === "dark" ? "Default (Dark)" : "Light"}.`
              );
            }}
          >
            <option value="dark">Default (Dark Mode)</option>
            <option value="light">Light Mode</option>
            <option value="amber">Amber</option>
            <option value="teal">Teal</option>
            <option value="crimson">Crimson</option>
          </select>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
          <label className="text-sm text-slate-200" htmlFor="aura-color-picker">
            Aura Color
          </label>
          <div className="grid gap-2">
            <input
              id="aura-color-picker"
              type="color"
              className="h-10 w-16 cursor-pointer rounded-xl border border-slate-300/20 bg-slate-950/70 p-1"
              value={auraColor}
              onChange={(event) => {
                const next = normalizeAuraColor(event.currentTarget.value);
                if (!next) return;
                setAuraColor(next);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                disabled={auraColor === savedAuraColor}
                onClick={() => {
                  const next = normalizeAuraColor(auraColor);
                  if (!next) return;
                  setSavedAuraColor(next);
                  try {
                    localStorage.setItem(AURA_COLOR_KEY, next);
                  } catch {
                    // Ignore localStorage failures.
                  }
                  try {
                    if (window.parent && window.parent !== window) {
                      window.parent.postMessage({ type: "polyplay:aura-color-updated", color: next }, window.location.origin);
                    }
                  } catch {
                    // Ignore postMessage failures.
                  }
                  setStatus(`Aura color applied: ${next}.`);
                }}
              >
                Save / Apply
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const fallback = getDefaultAuraByTheme(localStorage.getItem(THEME_MODE_KEY), customThemeSlot);
                  setAuraColor(fallback);
                  setSavedAuraColor(fallback);
                  try {
                    localStorage.removeItem(AURA_COLOR_KEY);
                  } catch {
                    // Ignore localStorage failures.
                  }
                  try {
                    if (window.parent && window.parent !== window) {
                      window.parent.postMessage({ type: "polyplay:aura-color-updated", color: null }, window.location.origin);
                    }
                  } catch {
                    // Ignore postMessage failures.
                  }
                  setStatus("Aura color reset to default.");
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </section>

      {showBackupsSection && (
      <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Backups</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void onExportPolyplaylist()} disabled={isBackupBusy}>
            Export PolyPlaylist
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              importPolyplaylistInputRef.current?.click();
            }}
            disabled={isBackupBusy}
          >
            Import PolyPlaylist
          </Button>
          <Button variant="primary" onClick={onExportConfig}>
            Export Config
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              importConfigInputRef.current?.click();
            }}
          >
            Import Config
          </Button>
          <Button variant="primary" onClick={() => void onExportFullBackup()} disabled={isBackupBusy}>
            Export Full Backup (.zip)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              importBackupInputRef.current?.click();
            }}
            disabled={isBackupBusy}
          >
            Import Full Backup (.zip)
          </Button>
        </div>
        <input
          ref={importPolyplaylistInputRef}
          type="file"
          accept=".polyplaylist,application/zip,.zip"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            void onImportPolyplaylistFile(file);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={importConfigInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            void onImportConfigFile(file);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={importBackupInputRef}
          type="file"
          accept="application/zip,.zip"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            void onImportFullBackupFile(file);
            event.currentTarget.value = "";
          }}
        />
        {backupProgress && <div className="mt-2 text-sm text-slate-300">{backupProgress}</div>}
      </section>
      )}

      <section
        ref={manageStorageRef}
        className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-100">Manage Storage</h2>
          <button
            type="button"
            className="rounded-xl border border-slate-300/20 bg-slate-800/70 px-3 py-2 text-sm text-slate-200"
            onClick={() => setSortLargestFirst((prev) => !prev)}
          >
            {sortLargestFirst ? "Sort: Largest Items" : "Sort: Most Recent"}
          </button>
        </div>

        <div className="mt-2 text-sm text-slate-300">
          Used: {formatBytes(storageUsage?.totalBytes ?? 0)} / {formatBytes(storageUsage?.capBytes ?? 0)}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800/90">
          <div
            className="h-full rounded-full bg-violet-400/80"
            style={{
              width: `${
                storageUsage && storageUsage.capBytes > 0
                  ? Math.min(100, (storageUsage.totalBytes / storageUsage.capBytes) * 100)
                  : 0
              }%`
            }}
          />
        </div>
        <div className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-3">
          <div>Audio: {formatBytes(storageUsage?.audioBytes ?? 0)}</div>
          <div>Artwork/Posters: {formatBytes((storageUsage?.imageBytes ?? 0) + (storageUsage?.videoBytes ?? 0))}</div>
          <div>Video artwork: {formatBytes(storageUsage?.videoBytes ?? 0)}</div>
        </div>

        <div className="mt-3 grid gap-2">
          {visibleTrackStorageRows.slice(0, 20).map((row) => (
            <div
              key={`storage-${row.id}`}
              className={`admin-track-row flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300/15 bg-slate-900/55 px-3 py-2 ${
                removingTrackIds.includes(row.id) ? "is-removing" : ""
              }`.trim()}
            >
              <div className="min-w-0">
                {editingTrackId === row.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      className="min-w-[220px] rounded-lg border border-slate-300/25 bg-slate-950/85 px-2 py-1 text-sm font-semibold text-slate-100"
                      value={editingTrackTitle}
                      autoFocus
                      onChange={(event) => setEditingTrackTitle(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void onSaveTrackRename(row.id);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          onCancelTrackRename();
                        }
                      }}
                    />
                    <Button variant="primary" onClick={() => void onSaveTrackRename(row.id)} disabled={renamingTrackId === row.id}>
                      Save
                    </Button>
                    <Button variant="secondary" onClick={onCancelTrackRename} disabled={renamingTrackId === row.id}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-slate-100">{row.title}</div>
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300/20 bg-slate-800/70 px-2 text-xs font-semibold text-slate-100"
                      title="Rename"
                      aria-label={`Rename ${row.title}`}
                      onClick={() => onStartTrackRename(row.id, row.title)}
                    >
                      <span aria-hidden="true">✎</span>
                      Rename
                    </button>
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  {formatBytes(row.totalBytes)} • updated {new Date(row.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmState({
                    kind: "remove-track",
                    trackId: row.id,
                    message: `Remove "${row.title}" to free storage?`
                  });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          {!visibleTrackStorageRows.length && <div className="text-sm text-slate-400">No tracks stored.</div>}
        </div>
      </section>

      {SHOW_DEMO_TRACKS_SECTION && (
        <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
          <h2 className="mb-2 text-base font-semibold text-slate-100">Demo Tracks</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onRestoreDemoTracks}>
              Restore Demo Tracks
            </Button>
            <Button variant="danger" onClick={() => setConfirmState({ kind: "remove-demo-tracks" })}>
              Remove Demo Tracks
            </Button>
          </div>
        </section>
      )}

      <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Danger Zone</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void onFactoryReset()}>
            Factory Reset
          </Button>
          <Button variant="danger" onClick={onResetAura} disabled={!hasTracks}>
            Reset Aura
          </Button>
          <Button variant="danger" onClick={onNuke} disabled={!hasTracks}>
            Nuke Playlist
          </Button>
        </div>
      </section>
      </>
      )}

      <p className="mt-3 rounded-xl border border-slate-300/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
        {status || "Ready."}
      </p>
      <div className="mt-4 flex justify-center pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-300/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 backdrop-blur-sm">
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 font-medium text-slate-100 underline decoration-slate-400/60 underline-offset-4"
          >
            Privacy Policy
          </a>
          <a
            href={TERMS_AND_CONDITIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 font-medium text-slate-100 underline decoration-slate-400/60 underline-offset-4"
          >
            Terms & Conditions
          </a>
        </div>
      </div>
      </div>
      </>
      )}
      {laneToast && (
        <div className="admin-lane-toast" role="status" aria-live="polite">
          {laneToast}
        </div>
      )}

      {isNukePromptOpen && (
        <section className="admin-nuke-modal" role="dialog" aria-modal="true" aria-label="Nuke countdown">
          <div className="admin-nuke-modal__card">
            <h3 className="admin-nuke-modal__title">Nuke Playlist Armed</h3>
            <p className="admin-nuke-modal__sub">Clearing the current playlist in</p>
            <div className="admin-nuke-modal__count">{(nukeCountdownMs / 1000).toFixed(1)}s</div>
            <Button variant="secondary" onClick={abortNuke}>
              Abort
            </Button>
          </div>
        </section>
      )}
      <GratitudeEntriesModal
        open={Boolean(selectedGratitudeEntry)}
        entry={selectedGratitudeEntry}
        onClose={() => setSelectedGratitudeEntry(null)}
      />
      {infoModal && (
        <section className="admin-nuke-modal" role="dialog" aria-modal="true" aria-label="Notice">
          <div className="admin-nuke-modal__card">
            <h3 className="admin-nuke-modal__title">{infoModal.title}</h3>
            <p className="admin-nuke-modal__sub">{infoModal.message}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {infoModal.openManageStorage && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setInfoModal(null);
                    manageStorageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Open Manage Storage
                </Button>
              )}
              <Button variant="secondary" onClick={() => setInfoModal(null)}>
                OK
              </Button>
            </div>
          </div>
        </section>
      )}
      {confirmState && (
        <section
          className="admin-nuke-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmState(null);
          }}
        >
          <div className="admin-nuke-modal__card">
            <h3 className="admin-nuke-modal__title">
              {confirmState.kind === "delete-playlist"
                ? "Delete Playlist?"
                : confirmState.kind === "remove-demo-tracks"
                  ? "Remove Demo Tracks?"
                  : "Remove Track?"}
            </h3>
            <p className="admin-nuke-modal__sub">
              {confirmState.kind === "delete-playlist"
                ? `Delete "${confirmState.playlist.name}"? Tracks only in this playlist will also be removed.`
                : confirmState.kind === "remove-demo-tracks"
                  ? "Remove all demo tracks?"
                  : confirmState.message}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => setConfirmState(null)} disabled={Boolean(playlistBusyId)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void confirmCurrentAction()}
                disabled={Boolean(playlistBusyId)}
              >
                {confirmState.kind === "remove-demo-tracks" ? "Remove" : "Delete"}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
