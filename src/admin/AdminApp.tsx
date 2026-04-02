import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { parseBuffer, type IPicture } from "music-metadata-browser";
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
  replaceAudioInDb,
  resetAuraInDb,
  setActivePlaylistInDb,
  type PlaylistRow,
  type StorageUsageSummary,
  type TrackStorageRow,
  updateTrackTextMetadataInDb,
  updateArtworkInDb,
  type DbTrackRecord
} from "../lib/db";
import { generateVideoPoster } from "../lib/artwork/videoPoster";
import { normalizeStillImage } from "../lib/artwork/normalizeStillImage";
import { validateVideoArtworkFile } from "../lib/artwork/videoValidation";
import { restoreDemoTracks } from "../lib/demoSeed";
import {
  clearGratitudeEntries,
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
  formatByteCount,
  getConfigExportFilename,
  getFullBackupFilename,
  getPolyplaylistFilename,
  importFullBackup,
  importPolyplaylist,
  parseConfigImportText,
  serializeConfig
} from "../lib/backup";
import { fireHeavyHaptic, fireLightHaptic, fireMediumHaptic, fireSuccessHaptic } from "../lib/haptics";
import { canUseIosNativeAudioImport, pickIosNativeAudioFile, pickIosNativeArtworkFile } from "../lib/iosMediaImport";
import { promptForSaveFilename, saveBlobWithBestEffort } from "../lib/saveBlob";
import {
  CUSTOM_THEME_ORDER,
  THEME_PACK_AURA_COLORS,
  THEME_SELECTION_ORDER,
  getThemeLabel,
  getThemeSelectionFromState,
  isCustomThemeSlot,
  isThemeSelection,
  parseCustomThemeSlot,
  type CustomThemeSlot,
  type ThemeSelection
} from "../lib/themeConfig";
import { titleFromFilename } from "../lib/title";
import { Button } from "../components/button";
import { TextShimmer } from "../components/TextShimmer";
import { isBusyToastMessage } from "../lib/toastUtils";

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
const REPEAT_TRACK_KEY = "polyplay_repeatTrackMode";
const THREEPEAT_REMAINING_KEY = "polyplay_threepeatRemaining_v1";
const DIM_MODE_KEY = "polyplay_dimMode_v1";
const CURRENT_TRACK_ID_KEY = "polyplay_currentTrackId_v1";
const LOOP_REGION_KEY = "polyplay_loopByTrack";
const LOOP_MODE_KEY = "polyplay_loopModeByTrack";
const PRIVACY_POLICY_URL = "/privacy-policy.html";
const TERMS_AND_CONDITIONS_URL = "/terms-and-conditions.html";
const SUPPORT_URL = "/support.html";
const CAN_USE_IOS_NATIVE_AUDIO_IMPORT = canUseIosNativeAudioImport();
const CAN_USE_IOS_NATIVE_ARTWORK_IMPORT = canUseIosNativeAudioImport();
const ARTIST_MEMORY_KEY = "polyplay_importArtist_v1";
type AdminHapticTone = "success" | "heavy";
type UploadArtworkSource = "manual" | "metadata";
type UploadMetadataPhase = "idle" | "loading" | "ready" | "skipped";
type UploadMetadataResult = {
  phase: UploadMetadataPhase;
  parseSucceeded: boolean;
  embeddedArtworkFound: boolean;
  artworkApplied: boolean;
  titleFound: boolean;
  titleApplied: boolean;
  artistFound: boolean;
  artistApplied: boolean;
  error: string | null;
};
type UploadMetadataStatusDescriptor = {
  tone: "neutral" | "loading" | "danger" | "warning" | "success";
  label: string;
  detail: string;
};
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

function getDefaultAuraByTheme(themeMode: string | null, slot: CustomThemeSlot): string {
  if (themeMode === "light") return "#a066f8";
  if (themeMode === "custom") return THEME_PACK_AURA_COLORS[slot];
  return "#bc84ff";
}

type CapacitorBrowserPlugin = {
  open: (options: { url: string }) => Promise<void>;
};

function getCapacitorBrowserPlugin(): CapacitorBrowserPlugin | null {
  if (typeof window === "undefined") return null;
  const capacitor = (window as Window & {
    Capacitor?: {
      registerPlugin?: <T>(name: string) => T;
      Plugins?: Record<string, unknown>;
    };
  }).Capacitor;
  if (!capacitor) return null;
  if (typeof capacitor.registerPlugin === "function") {
    try {
      return capacitor.registerPlugin<CapacitorBrowserPlugin>("Browser");
    } catch {
      // ignore missing plugin registration
    }
  }
  return (capacitor.Plugins?.Browser ?? null) as CapacitorBrowserPlugin | null;
}

function openAdminExternalUrl(url: string) {
  if (typeof window === "undefined") return;
  let resolvedUrl = url;
  let isSameOrigin = false;
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const currentMode = new URLSearchParams(window.location.search).get("mode")?.trim();
    if (parsedUrl.origin === window.location.origin) {
      const returnToUrl = new URL("/admin.html", window.location.origin);
      if (currentMode) returnToUrl.searchParams.set("mode", currentMode);
      parsedUrl.searchParams.set("returnTo", `${returnToUrl.pathname}${returnToUrl.search}`);
    }
    resolvedUrl = parsedUrl.toString();
    isSameOrigin = parsedUrl.origin === window.location.origin;
  } catch {
    // fall back to the provided string
  }
  if (isSameOrigin) {
    window.location.assign(resolvedUrl);
    return;
  }
  const plugin = getCapacitorBrowserPlugin();
  if (plugin?.open) {
    void plugin.open({ url: resolvedUrl });
    return;
  }
  window.open(resolvedUrl, "_blank", "noopener,noreferrer");
}

function markAdminImportCompleted() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HAS_IMPORTED_KEY, "true");
  } catch {
    // Ignore storage failures.
  }
}

function handleAdminLinkClick(url: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openAdminExternalUrl(url);
  };
}

function getStoredArtistName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(ARTIST_MEMORY_KEY) ?? "";
  } catch {
    return "";
  }
}

function cleanMetadataText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function createUploadMetadataResult(
  phase: UploadMetadataPhase,
  overrides: Partial<Omit<UploadMetadataResult, "phase">> = {}
): UploadMetadataResult {
  return {
    phase,
    parseSucceeded: false,
    embeddedArtworkFound: false,
    artworkApplied: false,
    titleFound: false,
    titleApplied: false,
    artistFound: false,
    artistApplied: false,
    error: null,
    ...overrides
  };
}

function getUploadMetadataStatusDescriptor(
  result: UploadMetadataResult,
  hasAudio: boolean,
  ignoreMetadata: boolean
): UploadMetadataStatusDescriptor {
  if (!hasAudio) {
    return {
      tone: "neutral",
      label: "Metadata idle",
      detail: "Select an audio file to inspect title, artist, and embedded artwork."
    };
  }
  if (ignoreMetadata) {
    return {
      tone: "neutral",
      label: "Metadata skipped",
      detail: "Metadata import is disabled for the current file."
    };
  }
  if (result.phase === "loading") {
    return {
      tone: "loading",
      label: "Reading metadata",
      detail: "Inspecting the selected file for title, artist, and embedded artwork."
    };
  }
  if (result.error) {
    return {
      tone: "danger",
      label: "Metadata parse failed",
      detail: result.error
    };
  }
  if (!result.parseSucceeded) {
    return {
      tone: "neutral",
      label: "Metadata idle",
      detail: "No metadata parse has run yet for this file."
    };
  }
  const foundArtwork = result.embeddedArtworkFound;
  const foundText = result.titleFound || result.artistFound;
  if (foundArtwork && foundText) {
    return {
      tone: "success",
      label: "Full metadata found",
      detail: "Embedded artwork and text metadata were detected."
    };
  }
  if (foundArtwork) {
    return {
      tone: "success",
      label: "Artwork found only",
      detail: "Embedded artwork was detected, but no title/artist text metadata was found."
    };
  }
  if (foundText) {
    return {
      tone: "warning",
      label: "Text found only",
      detail: "Title and/or artist metadata was detected, but no embedded artwork was found."
    };
  }
  return {
    tone: "warning",
    label: "Metadata found nothing",
    detail: "The parser ran, but it did not return usable title, artist, or artwork metadata."
  };
}

function sniffEmbeddedArtworkMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }
  return null;
}

function resolveEmbeddedArtworkMimeType(format: string, bytes: Uint8Array): string | null {
  const normalized = format.toLowerCase();
  if (normalized.startsWith("image/")) return normalized;

  const shorthandMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jpe: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp"
  };
  if (normalized in shorthandMap) {
    return shorthandMap[normalized];
  }
  return sniffEmbeddedArtworkMimeType(bytes);
}

function buildEmbeddedArtworkFile(picture: IPicture | null | undefined): File | null {
  if (!picture?.data?.length) return null;
  const bytes = new Uint8Array(picture.data);
  const mimeType = resolveEmbeddedArtworkMimeType(cleanMetadataText(picture.format), bytes);
  if (!mimeType?.startsWith("image/")) return null;
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "jpg";
  return new File([bytes], `embedded-artwork.${extension}`, { type: mimeType });
}

function selectEmbeddedArtworkPicture(pictures: IPicture[] | null | undefined): IPicture | null {
  if (!Array.isArray(pictures) || pictures.length === 0) return null;
  const preferredName = new Set(["front", "cover", "cover (front)"]);
  const preferredType = new Set(["cover (front)", "front cover", "front"]);
  const preferred = pictures.find((picture) => {
    const name = cleanMetadataText((picture as IPicture & { name?: string }).name).toLowerCase();
    const type = cleanMetadataText((picture as IPicture & { type?: string }).type).toLowerCase();
    return preferredName.has(name) || preferredType.has(type);
  });
  return preferred ?? pictures[0] ?? null;
}

function storeArtistName(value: string): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      localStorage.setItem(ARTIST_MEMORY_KEY, value);
    } else {
      localStorage.removeItem(ARTIST_MEMORY_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const safeMax = Math.max(8, maxLength);
  const head = Math.max(4, Math.ceil((safeMax - 1) * 0.7));
  const tail = Math.max(3, safeMax - head - 1);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatTrackOptionLabel(track: DbTrackRecord): string {
  const shortId = track.id.slice(0, 8);
  const title = truncateMiddle(track.title?.trim() || `Track ${shortId}`, 32);
  const missing = [track.missingAudio ? "Missing audio" : "", track.missingArt ? "Missing artwork" : ""]
    .filter(Boolean)
    .join(", ");
  const suffix = missing ? ` • ${truncateMiddle(missing, 18)}` : "";
  return `${title} (#${shortId})${suffix}`;
}

function formatTrackStorageLabel(row: TrackStorageRow, preferredTitle?: string | null): string {
  const fallback = `Track ${row.id.slice(0, 8)}`;
  return truncateMiddle(preferredTitle?.trim() || row.title?.trim() || fallback, 44);
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

function inferAudioMetadataMimeType(file: File): string {
  const explicitType = cleanMetadataText(file.type).toLowerCase();
  if (explicitType) return explicitType;
  const name = cleanMetadataText(file.name).toLowerCase();
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".aac")) return "audio/aac";
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
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
  const SETTINGS_HERO_SWIPE_CLOSE_DISTANCE_PX = 120;
  const SETTINGS_HERO_SWIPE_CLOSE_MAX_SIDEWAYS_PX = 72;
  const SETTINGS_HERO_SWIPE_CLOSE_MIN_VELOCITY = 0.38;
  const [isInitialHydrationPending, setIsInitialHydrationPending] = useState(true);
  const [tracks, setTracks] = useState<DbTrackRecord[]>([]);
  const [status, setStatus] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadArtist, setUploadArtist] = useState("");
  const [artistMemoryValue, setArtistMemoryValue] = useState(() => getStoredArtistName());
  const [uploadAudio, setUploadAudio] = useState<File | null>(null);
  const [uploadArt, setUploadArt] = useState<File | null>(null);
  const [uploadArtSource, setUploadArtSource] = useState<UploadArtworkSource>("manual");
  const [uploadArtPreviewUrl, setUploadArtPreviewUrl] = useState("");
  const [uploadArtDuration, setUploadArtDuration] = useState(0);
  const [uploadArtFrameTime, setUploadArtFrameTime] = useState(0);
  const [uploadArtPosterBlob, setUploadArtPosterBlob] = useState<Blob | null>(null);
  const [isUploadPreviewPlaying, setIsUploadPreviewPlaying] = useState(false);
  const [ignoreUploadMetadata, setIgnoreUploadMetadata] = useState(false);
  const [uploadMetadataResult, setUploadMetadataResult] = useState<UploadMetadataResult>(() =>
    createUploadMetadataResult("idle")
  );
  const uploadFormRef = useRef<HTMLFormElement | null>(null);
  const uploadTitleInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTitleTouchedRef = useRef(false);
  const uploadArtistTouchedRef = useRef(false);
  const uploadTitleAutofilledRef = useRef(false);
  const uploadArtistAutofilledRef = useRef(false);
  const uploadTitleValueRef = useRef("");
  const uploadArtistValueRef = useRef("");
  const uploadArtworkAutofilledRef = useRef(false);
  const uploadArtRef = useRef<File | null>(null);
  const uploadMetadataRequestIdRef = useRef(0);

  const [selectedArtworkTrackId, setSelectedArtworkTrackId] = useState<string>("");
  const [selectedArtworkFile, setSelectedArtworkFile] = useState<File | null>(null);
  const [selectedArtPreviewUrl, setSelectedArtPreviewUrl] = useState("");
  const [selectedArtDuration, setSelectedArtDuration] = useState(0);
  const [selectedArtFrameTime, setSelectedArtFrameTime] = useState(0);
  const [selectedArtPosterBlob, setSelectedArtPosterBlob] = useState<Blob | null>(null);
  const [isSelectedPreviewPlaying, setIsSelectedPreviewPlaying] = useState(false);
  const uploadMetadataStatus = getUploadMetadataStatusDescriptor(
    uploadMetadataResult,
    Boolean(uploadAudio),
    ignoreUploadMetadata
  );

  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string>("");
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedTransferTrackId, setSelectedTransferTrackId] = useState<string>("");
  const [audioTransferMode, setAudioTransferMode] = useState<"create" | "replace">("create");
  const [isAudioLaneBusy, setIsAudioLaneBusy] = useState(false);
  const [isArtworkLaneBusy, setIsArtworkLaneBusy] = useState(false);
  const [laneToast, setLaneToast] = useState<string | null>(null);
  const [uploadSuccessNotice, setUploadSuccessNotice] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [keepImportPageOpen, setKeepImportPageOpen] = useState(false);

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
  const [customThemeSlot, setCustomThemeSlot] = useState<CustomThemeSlot>(() => {
    try {
      return parseCustomThemeSlot(localStorage.getItem(CUSTOM_THEME_SLOT_KEY));
    } catch {
      return "crimson";
    }
  });
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>(() => {
    try {
      const themeMode = localStorage.getItem(THEME_MODE_KEY);
      const safeSlot = parseCustomThemeSlot(localStorage.getItem(CUSTOM_THEME_SLOT_KEY));
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
  const [editingTrackArtist, setEditingTrackArtist] = useState("");
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [removingTrackIds, setRemovingTrackIds] = useState<string[]>([]);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; openManageStorage?: boolean } | null>(
    null
  );
  const [isNukePromptOpen, setIsNukePromptOpen] = useState(false);
  const [nukeCountdownMs, setNukeCountdownMs] = useState(2000);
  const [isNukeRunning, setIsNukeRunning] = useState(false);
  const [isJournalNukePromptOpen, setIsJournalNukePromptOpen] = useState(false);
  const [journalNukeCountdownMs, setJournalNukeCountdownMs] = useState(2000);
  const [isJournalNukeRunning, setIsJournalNukeRunning] = useState(false);
  const nukeTimerRef = useRef<number | null>(null);
  const journalNukeTimerRef = useRef<number | null>(null);
  const nukeGenerationRef = useRef(0);
  const journalNukeGenerationRef = useRef(0);
  const uploadSuccessNoticeTimeoutRef = useRef<number | null>(null);
  const importNoticeTimeoutRef = useRef<number | null>(null);
  const settingsHeroSwipeStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
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
    () => tracks.map((track) => ({ value: String(track.id), label: formatTrackOptionLabel(track) })),
    [tracks]
  );
  const trackTitleById = useMemo(
    () =>
      tracks.reduce<Record<string, string>>((acc, track) => {
        acc[track.id] = track.title?.trim() || "";
        return acc;
      }, {}),
    [tracks]
  );
  const trackArtById = useMemo(
    () =>
      tracks.reduce<Record<string, string>>((acc, track) => {
        if (track.artUrl) acc[track.id] = track.artUrl;
        return acc;
      }, {}),
    [tracks]
  );
  const trackArtistById = useMemo(
    () =>
      tracks.reduce<Record<string, string>>((acc, track) => {
        acc[track.id] = track.artist?.trim() || "";
        return acc;
      }, {}),
    [tracks]
  );
  const artistSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: string[] = [];
    const push = (value: string | null | undefined) => {
      const next = cleanMetadataText(value);
      if (!next) return;
      const key = next.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      suggestions.push(next);
    };
    push(artistMemoryValue);
    tracks.forEach((track) => push(track.artist));
    return suggestions;
  }, [artistMemoryValue, tracks]);

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
    const applyTheme = (mode: string | null, slot: CustomThemeSlot) => {
      const nextMode = mode === "dark" || mode === "custom" ? mode : "light";
      const root = document.documentElement;
      root.setAttribute("data-theme", nextMode);
      root.setAttribute("data-theme-slot", slot);
      document.body.classList.toggle("theme-dark", nextMode === "dark");
      document.body.classList.toggle("theme-custom", nextMode === "custom");
      CUSTOM_THEME_ORDER.forEach((themeSlot) => {
        document.body.classList.toggle(`theme-custom-${themeSlot}`, nextMode === "custom" && slot === themeSlot);
      });
    };
    const saved = localStorage.getItem(THEME_MODE_KEY);
    try {
      const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
      const safeSlot = parseCustomThemeSlot(slot);
      applyTheme(saved, safeSlot);
      if (isCustomThemeSlot(slot)) setCustomThemeSlot(slot);
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
        const safeSlot = parseCustomThemeSlot(slot);
        applyTheme(event.newValue, safeSlot);
      }
      if (event.key === CUSTOM_THEME_SLOT_KEY) {
        const slot = event.newValue;
        if (isCustomThemeSlot(slot)) setCustomThemeSlot(slot);
      }
      if (event.key === THEME_MODE_KEY || event.key === CUSTOM_THEME_SLOT_KEY) {
        const mode = localStorage.getItem(THEME_MODE_KEY);
        const slot = localStorage.getItem(CUSTOM_THEME_SLOT_KEY);
        const safeSlot = parseCustomThemeSlot(slot);
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
      const safeSlot = parseCustomThemeSlot(slot, parseCustomThemeSlot(localStorage.getItem(CUSTOM_THEME_SLOT_KEY)));
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
      CUSTOM_THEME_ORDER.forEach((slot) => {
        document.body.classList.remove(`theme-custom-${slot}`);
      });
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
    if (!uploadAudio) return;
    if (typeof window === "undefined") return;
    if (!ignoreUploadMetadata && uploadMetadataResult.phase === "loading") return;
    if (!ignoreUploadMetadata && uploadMetadataResult.titleFound) return;
    const input = uploadTitleInputRef.current;
    if (!input) return;
    const timer = window.setTimeout(() => {
      input.focus();
      input.select();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [ignoreUploadMetadata, uploadAudio, uploadMetadataResult.phase, uploadMetadataResult.titleFound]);

  useEffect(() => {
    if (!uploadAudio) return;
    void runUploadMetadataPipeline(uploadAudio, ignoreUploadMetadata);
  }, [ignoreUploadMetadata]);

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
      if (importNoticeTimeoutRef.current !== null) {
        window.clearTimeout(importNoticeTimeoutRef.current);
        importNoticeTimeoutRef.current = null;
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

  const requestCloseSettings = () => {
    if (window.parent === window) return;
    try {
      window.parent.postMessage({ type: "polyplay:close-settings" }, window.location.origin);
    } catch {
      // Ignore cross-document messaging failures.
    }
  };

  const beginSettingsHeroSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    settingsHeroSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now()
    };
  };

  const endSettingsHeroSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    const start = settingsHeroSwipeStartRef.current;
    settingsHeroSwipeStartRef.current = null;
    if (!start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy <= 0) return;
    if (Math.abs(dx) > SETTINGS_HERO_SWIPE_CLOSE_MAX_SIDEWAYS_PX) return;
    const elapsedMs = Math.max(1, performance.now() - start.at);
    const velocity = dy / elapsedMs;
    if (dy >= SETTINGS_HERO_SWIPE_CLOSE_DISTANCE_PX || velocity >= SETTINGS_HERO_SWIPE_CLOSE_MIN_VELOCITY) {
      requestCloseSettings();
    }
  };

  const notifyUploadSuccess = async () => {
    if (keepImportPageOpen) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:import-complete" }, window.location.origin);
      } else {
        markAdminImportCompleted();
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
    setImportNotice(null);
    setUploadSuccessNotice(message);
    if (uploadSuccessNoticeTimeoutRef.current !== null) {
      window.clearTimeout(uploadSuccessNoticeTimeoutRef.current);
    }
    uploadSuccessNoticeTimeoutRef.current = window.setTimeout(() => {
      setUploadSuccessNotice(null);
      uploadSuccessNoticeTimeoutRef.current = null;
    }, 2600);
  };

  const showImportNotice = (message: string) => {
    setUploadSuccessNotice(null);
    setImportNotice(message);
    if (importNoticeTimeoutRef.current !== null) {
      window.clearTimeout(importNoticeTimeoutRef.current);
      importNoticeTimeoutRef.current = null;
    }
  };

  const clearImportNotice = () => {
    setImportNotice(null);
    if (importNoticeTimeoutRef.current !== null) {
      window.clearTimeout(importNoticeTimeoutRef.current);
      importNoticeTimeoutRef.current = null;
    }
  };

  const dismissEditingFocus = async () => {
    try {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        active.blur();
      }
    } catch {
      // Ignore focus-management failures.
    }
    await new Promise<void>((resolve) => {
      if (typeof window === "undefined") {
        resolve();
        return;
      }
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolve());
      } else {
        window.setTimeout(() => resolve(), 0);
      }
    });
  };

  const readLiveUploadTitle = (): string => {
    return uploadTitleInputRef.current?.value ?? uploadTitle;
  };

  const setUploadTitleValue = (value: string) => {
    uploadTitleValueRef.current = value;
    setUploadTitle(value);
  };

  const setUploadArtistValue = (value: string) => {
    uploadArtistValueRef.current = value;
    setUploadArtist(value);
  };

  const requestParentHaptic = (tone: AdminHapticTone) => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:haptic", tone }, window.location.origin);
      }
    } catch {
      // Ignore cross-document messaging failures.
    }
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

  const setUploadArtworkFile = (file: File | null, source: UploadArtworkSource = "manual") => {
    uploadArtRef.current = file;
    setUploadArt(file);
    setUploadArtSource(file ? source : "manual");
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

  const applyMetadataArtworkIfAllowed = (file: File | null): boolean => {
    if (!file) return false;
    if (uploadArtRef.current && !uploadArtworkAutofilledRef.current) return false;
    uploadArtworkAutofilledRef.current = true;
    setUploadArtworkFile(file, "metadata");
    return true;
  };

  const applyMetadataTitleIfAllowed = (value: string): boolean => {
    if (!value || uploadTitleTouchedRef.current) return false;
    const canApply = uploadTitleAutofilledRef.current || uploadTitleValueRef.current.trim() === "";
    if (!canApply) return false;
    uploadTitleAutofilledRef.current = true;
    setUploadTitleValue(value);
    return true;
  };

  const applyMetadataArtistIfAllowed = (value: string): boolean => {
    if (!value || uploadArtistTouchedRef.current) return false;
    const canApply = uploadArtistAutofilledRef.current || uploadArtistValueRef.current.trim() === "";
    if (!canApply) return false;
    uploadArtistAutofilledRef.current = true;
    setUploadArtistValue(value);
    return true;
  };

  const clearAutofilledUploadMetadata = () => {
    if (uploadTitleAutofilledRef.current) {
      uploadTitleAutofilledRef.current = false;
      setUploadTitleValue("");
    }
    if (uploadArtistAutofilledRef.current) {
      uploadArtistAutofilledRef.current = false;
      setUploadArtistValue("");
    }
    if (uploadArtworkAutofilledRef.current) {
      uploadArtworkAutofilledRef.current = false;
      setUploadArtworkFile(null);
    }
  };

  const runUploadMetadataPipeline = async (file: File | null, shouldIgnoreMetadata: boolean) => {
    const requestId = uploadMetadataRequestIdRef.current + 1;
    uploadMetadataRequestIdRef.current = requestId;

    if (!file) {
      setUploadMetadataResult(createUploadMetadataResult("idle"));
      return;
    }

    if (shouldIgnoreMetadata) {
      clearAutofilledUploadMetadata();
      setUploadMetadataResult(createUploadMetadataResult("skipped"));
      return;
    }

    setUploadMetadataResult(createUploadMetadataResult("loading"));
    const nextResult = createUploadMetadataResult("ready");

    try {
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const effectiveMimeType = inferAudioMetadataMimeType(file);
      const metadata = await parseBuffer(fileBytes, {
        mimeType: effectiveMimeType,
        path: file.name,
        size: file.size
      });
      if (uploadMetadataRequestIdRef.current !== requestId) return;
      nextResult.parseSucceeded = true;
      const pictureCount = Array.isArray(metadata.common.picture) ? metadata.common.picture.length : 0;
      const firstPicture = pictureCount > 0 ? metadata.common.picture?.[0] ?? null : null;
      console.debug("[artwork:metadata-import]", {
        phase: "parse-result",
        fileName: file.name,
        fileType: file.type || null,
        inferredMime: effectiveMimeType,
        parseSucceeded: true,
        commonTitle: cleanMetadataText(metadata.common.title) || null,
        commonArtist: cleanMetadataText(metadata.common.artist || metadata.common.albumartist) || null,
        pictureCount,
        firstPictureFormat: cleanMetadataText(firstPicture?.format) || null,
        firstPictureType: cleanMetadataText((firstPicture as IPicture & { type?: string } | null)?.type) || null,
        firstPictureByteLength: firstPicture?.data?.length ?? 0
      });
      try {
        const embeddedPicture = selectEmbeddedArtworkPicture(metadata.common.picture);
        const embeddedArtwork = buildEmbeddedArtworkFile(embeddedPicture);
        nextResult.embeddedArtworkFound = Boolean(embeddedArtwork);
        if (embeddedArtwork) {
          console.debug("[artwork:metadata-import]", {
            phase: "selected-embedded-art",
            fileName: file.name,
            fileType: file.type || null,
            effectiveMimeType,
            fileBytes: file.size || 0,
            pictureType: cleanMetadataText((embeddedPicture as IPicture & { type?: string } | null)?.type),
            pictureName: cleanMetadataText((embeddedPicture as IPicture & { name?: string } | null)?.name),
            declaredFormat: cleanMetadataText(embeddedPicture?.format),
            resolvedMime: embeddedArtwork.type || null,
            originalByteLength: embeddedArtwork.size || 0,
            normalizationRan: false
          });
          nextResult.artworkApplied = applyMetadataArtworkIfAllowed(embeddedArtwork);
        }
      } catch (artworkError) {
        console.debug("[artwork:metadata-import]", {
          phase: "selected-embedded-art-failed",
          fileName: file.name,
          error: String(artworkError)
        });
      }

      let metadataTitle = "";
      let metadataArtist = "";
      try {
        metadataTitle = cleanMetadataText(metadata.common.title);
        metadataArtist = cleanMetadataText(metadata.common.artist || metadata.common.albumartist);
      } catch (textMetadataError) {
        console.debug("[artwork:metadata-import]", {
          phase: "text-metadata-failed",
          fileName: file.name,
          error: String(textMetadataError)
        });
      }

      nextResult.titleFound = Boolean(metadataTitle);
      nextResult.artistFound = Boolean(metadataArtist);
      nextResult.titleApplied = applyMetadataTitleIfAllowed(metadataTitle);
      nextResult.artistApplied = applyMetadataArtistIfAllowed(metadataArtist);
    } catch (parseError) {
      if (uploadMetadataRequestIdRef.current !== requestId) return;
      nextResult.error = String(parseError);
      console.debug("[artwork:metadata-import]", {
        phase: "parse-failed",
        fileName: file.name,
        fileType: file.type || null,
        inferredMime: inferAudioMetadataMimeType(file),
        parseSucceeded: false,
        fileBytes: file.size || 0,
        error: nextResult.error
      });
    }

    if (uploadMetadataRequestIdRef.current !== requestId) return;
    console.debug("[artwork:metadata-import]", {
      phase: "pipeline-finished",
      fileName: file.name,
      parseSucceeded: nextResult.parseSucceeded,
      embeddedArtworkFound: nextResult.embeddedArtworkFound,
      artworkApplied: nextResult.artworkApplied,
      titleFound: nextResult.titleFound,
      titleApplied: nextResult.titleApplied,
      artistFound: nextResult.artistFound,
      artistApplied: nextResult.artistApplied,
      error: nextResult.error
    });
    setUploadMetadataResult(nextResult);
  };

  const resetUploadDraftForNewAudio = (
    file: File | null,
    options?: { preserveManualArtwork?: boolean }
  ) => {
    uploadMetadataRequestIdRef.current += 1;
    uploadTitleTouchedRef.current = false;
    uploadArtistTouchedRef.current = false;
    uploadTitleAutofilledRef.current = false;
    uploadArtistAutofilledRef.current = false;
    uploadArtworkAutofilledRef.current = false;
    setUploadTitleValue("");
    setUploadArtistValue("");
    if (!options?.preserveManualArtwork) {
      setUploadArtworkFile(null);
    }
    if (!file) {
      setUploadMetadataResult(createUploadMetadataResult("idle"));
    }
  };

  const onPickUploadAudio = async (file: File | null) => {
    const preserveManualArtwork = Boolean(file && !uploadAudio && uploadArtRef.current && !uploadArtworkAutofilledRef.current);
    resetUploadDraftForNewAudio(file, { preserveManualArtwork });
    setUploadAudio(file);
    await runUploadMetadataPipeline(file, ignoreUploadMetadata);
  };

  const onPickUploadAudioNative = async (fallbackPick?: () => void) => {
    try {
      const file = await pickIosNativeAudioFile();
      if (!file) {
        fallbackPick?.();
        return;
      }
      const preserveManualArtwork = Boolean(file && !uploadAudio && uploadArtRef.current && !uploadArtworkAutofilledRef.current);
      resetUploadDraftForNewAudio(file, { preserveManualArtwork });
      setUploadAudio(file);
      await runUploadMetadataPipeline(file, ignoreUploadMetadata);
    } catch {
      fallbackPick?.();
    }
  };

  const onPickUploadArtwork = async (file: File | null) => {
    if (!file) {
      setUploadArtworkFile(null);
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
    uploadArtworkAutofilledRef.current = false;
    setUploadArtworkFile(file);
    if (!uploadAudio) {
      setStatus("Artwork ready. Add an audio source to complete import.");
    }
  };

  const onPickUploadArtworkNative = async (fallbackPick?: () => void) => {
    try {
      const file = await pickIosNativeArtworkFile();
      if (!file) {
        fallbackPick?.();
        return;
      }
      await onPickUploadArtwork(file);
    } catch {
      fallbackPick?.();
    }
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

  const onPickSelectedArtworkNative = async (fallbackPick?: () => void) => {
    try {
      const file = await pickIosNativeArtworkFile();
      if (!file) {
        fallbackPick?.();
        return;
      }
      await onPickSelectedArtwork(file);
    } catch {
      fallbackPick?.();
    }
  };

  const onPickSelectedAudio = (file: File | null) => {
    setSelectedAudioFile(file);
  };

  const onPickSelectedAudioNative = async (fallbackPick?: () => void) => {
    try {
      const file = await pickIosNativeAudioFile();
      if (!file) {
        fallbackPick?.();
        return;
      }
      setSelectedAudioFile(file);
    } catch {
      fallbackPick?.();
    }
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
    if (mime.startsWith("image/")) {
      setLaneToast("That’s artwork — drop it in Artwork.");
      return;
    }
    if (!isSupportedTrackFile(file)) {
      setLaneToast("That file type is not supported for audio import.");
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
        fireSuccessHaptic();
        requestParentHaptic("success");
      } else {
        await replaceAudioInDb(selectedTransferTrackId, file);
        setStatus("Selected track audio replaced.");
        fireSuccessHaptic();
        requestParentHaptic("success");
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
    setLaneToast("Applying artwork...");
    setIsArtworkLaneBusy(true);
    try {
      const artwork = await buildArtworkPayload(file, null);
      await updateArtworkInDb(selectedTransferTrackId, artwork);
      notifyUserImported();
      await refreshTracks();
      await refreshStorage();
      const successMessage = "Artwork applied from Artwork lane.";
      setStatus(successMessage);
      setLaneToast(successMessage);
      fireSuccessHaptic();
      requestParentHaptic("success");
    } catch (error) {
      if (isStorageCapError(error)) {
        setInfoModal({
          title: "Storage Almost Full",
          message: "Storage is almost full. Manage storage to free space before this transfer.",
          openManageStorage: true
        });
      } else {
        const failureMessage = "Artwork transfer failed.";
        setStatus(failureMessage);
        setLaneToast(failureMessage);
      }
    } finally {
      setIsArtworkLaneBusy(false);
    }
  };

  const buildArtworkPayload = async (
    file: File | null,
    posterBlob: Blob | null,
    frameTimeSec?: number | null,
    source: UploadArtworkSource = "manual"
  ): Promise<{ artPoster: Blob | null; artVideo: Blob | null; posterCaptureFailed: boolean }> => {
    if (!file) return { artPoster: null, artVideo: null, posterCaptureFailed: false };
    if (!isVideoArtwork(file)) {
      if (source === "metadata") {
        console.debug("[artwork:metadata-import]", {
          phase: "build-artwork-payload",
          source,
          normalizationRan: false,
          finalMime: file.type || null,
          finalBytes: file.size || 0
        });
        return { artPoster: file, artVideo: null, posterCaptureFailed: false };
      }
      const normalizedPoster = await normalizeStillImage(file).catch(() => file);
      console.debug("[artwork:metadata-import]", {
        phase: "build-artwork-payload",
        source,
        normalizationRan: true,
        originalMime: file.type || null,
        originalBytes: file.size || 0,
        finalMime: normalizedPoster.type || null,
        finalBytes: normalizedPoster.size || 0
      });
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
    await dismissEditingFocus();
    const liveTitle = readLiveUploadTitle();
    if (liveTitle !== uploadTitle) {
      setUploadTitleValue(liveTitle);
    }
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

    const derivedTitle = liveTitle.trim() || titleFromFilename(uploadAudio.name);
    const derivedArtist = uploadArtist.trim();
    setStatus("Importing...");
    showImportNotice("IMPORTING TRACK...");

    try {
      const artwork = await buildArtworkPayload(uploadArt, uploadArtPosterBlob, uploadArtFrameTime, uploadArtSource);
      if (uploadArt && !artwork.artPoster && !artwork.artVideo) {
        throw new Error("Armed artwork could not be prepared for import.");
      }
      await addTrackToDb({
        title: derivedTitle,
        artist: derivedArtist || null,
        sub: "Imported",
        audio: uploadAudio,
        artPoster: artwork.artPoster,
        artVideo: artwork.artVideo
      });
      markAdminImportCompleted();
      storeArtistName(derivedArtist);
      setArtistMemoryValue(derivedArtist);
      setUploadTitleValue("");
      setUploadArtistValue("");
      setUploadAudio(null);
      setUploadArtworkFile(null);
      setIgnoreUploadMetadata(false);
      setUploadMetadataResult(createUploadMetadataResult("idle"));
      uploadTitleTouchedRef.current = false;
      uploadArtistTouchedRef.current = false;
      uploadTitleAutofilledRef.current = false;
      uploadArtistAutofilledRef.current = false;
      uploadArtworkAutofilledRef.current = false;
      setStatus(
        artwork.posterCaptureFailed
          ? "Import complete. Video artwork added (poster frame unavailable on this browser)."
          : "Import complete."
      );
      fireSuccessHaptic();
      requestParentHaptic("success");
      showSuccessNotice(
        artwork.posterCaptureFailed
          ? "Import complete. Video artwork added."
          : "Import complete."
      );
      await refreshTracks();
      await refreshStorage();
      await notifyUploadSuccess();
    } catch (error) {
      clearImportNotice();
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

    const updatingMessage = "Updating artwork…";
    setStatus(updatingMessage);
    setLaneToast(updatingMessage);
    try {
      const artwork = await buildArtworkPayload(selectedArtworkFile, selectedArtPosterBlob, selectedArtFrameTime);
      await updateArtworkInDb(selectedArtworkTrackId, artwork);
      notifyUserImported();
      setSelectedArtworkAssetFile(null);
      const successMessage = artwork.posterCaptureFailed
        ? "Artwork updated. Video artwork added (poster frame unavailable on this browser)."
        : "Artwork updated.";
      setStatus(successMessage);
      setLaneToast(successMessage);
      fireSuccessHaptic();
      requestParentHaptic("success");
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
      const failureMessage = "Artwork update failed.";
      setStatus(failureMessage);
      setLaneToast(failureMessage);
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
    if (!isSupportedTrackFile(selectedAudioFile)) {
      setStatus("Select a supported replacement audio file (.wav, .mp3, .m4a, .mp4, or .mov).");
      return;
    }

    setStatus("Replacing audio...");
    try {
      await replaceAudioInDb(selectedAudioTrackId, selectedAudioFile);
      notifyUserImported();
      setSelectedAudioFile(null);
      setStatus("Audio replaced.");
      fireSuccessHaptic();
      requestParentHaptic("success");
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
      fireHeavyHaptic();
      requestParentHaptic("heavy");
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
      fireHeavyHaptic();
      requestParentHaptic("heavy");
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
    nukeGenerationRef.current += 1;
    setNukeCountdownMs(2000);
    setIsNukePromptOpen(true);
    setStatus("Nuke Playlist arming.");
    fireLightHaptic();
    requestParentHaptic("success");
  };

  const abortNuke = () => {
    nukeGenerationRef.current += 1;
    if (nukeTimerRef.current !== null) {
      window.clearInterval(nukeTimerRef.current);
      nukeTimerRef.current = null;
    }
    setIsNukePromptOpen(false);
    setNukeCountdownMs(2000);
    setStatus("Nuke aborted.");
  };

  const runJournalNuke = async () => {
    if (isJournalNukeRunning) return;
    setIsJournalNukeRunning(true);
    try {
      clearGratitudeEntries();
      setGratitudeEntries([]);
      setSelectedGratitudeEntry(null);
      setStatus("Gratitude Journal cleared.");
      fireHeavyHaptic();
      requestParentHaptic("heavy");
      showSuccessNotice("Gratitude Journal cleared.");
    } catch {
      setStatus("Nuke Journal failed.");
    }
    setIsJournalNukeRunning(false);
  };

  const onNukeJournal = () => {
    if (gratitudeEntries.length === 0 || isJournalNukeRunning || isJournalNukePromptOpen) return;
    journalNukeGenerationRef.current += 1;
    setJournalNukeCountdownMs(2000);
    setIsJournalNukePromptOpen(true);
    setStatus("Nuke Journal arming.");
    fireLightHaptic();
    requestParentHaptic("success");
  };

  const abortJournalNuke = () => {
    journalNukeGenerationRef.current += 1;
    if (journalNukeTimerRef.current !== null) {
      window.clearInterval(journalNukeTimerRef.current);
      journalNukeTimerRef.current = null;
    }
    setIsJournalNukePromptOpen(false);
    setJournalNukeCountdownMs(2000);
    setStatus("Nuke Journal aborted.");
  };

  useEffect(() => {
    if (!isNukePromptOpen) return;
    const generation = nukeGenerationRef.current;
    const startedAt = Date.now();
    let lastBucket = -1;
    nukeTimerRef.current = window.setInterval(() => {
      if (generation !== nukeGenerationRef.current) {
        if (nukeTimerRef.current !== null) {
          window.clearInterval(nukeTimerRef.current);
          nukeTimerRef.current = null;
        }
        return;
      }
      const remaining = Math.max(0, 2000 - (Date.now() - startedAt));
      setNukeCountdownMs(remaining);
      const bucket =
        remaining <= 0 ? 5 : remaining <= 180 ? 4 : remaining <= 420 ? 3 : remaining <= 800 ? 2 : remaining <= 1300 ? 1 : 0;
      if (bucket > lastBucket) {
        lastBucket = bucket;
        if (bucket >= 4) {
          fireHeavyHaptic();
          requestParentHaptic("heavy");
        } else if (bucket >= 2) {
          fireMediumHaptic();
          requestParentHaptic("success");
        } else if (bucket >= 1) {
          fireLightHaptic();
          requestParentHaptic("success");
        }
      }
      if (remaining <= 0) {
        if (nukeTimerRef.current !== null) {
          window.clearInterval(nukeTimerRef.current);
          nukeTimerRef.current = null;
        }
        if (generation !== nukeGenerationRef.current) return;
        setStatus("Nuke Playlist armed. Confirm or cancel.");
      }
    }, 50);
    return () => {
      if (nukeTimerRef.current !== null) {
        window.clearInterval(nukeTimerRef.current);
        nukeTimerRef.current = null;
      }
    };
  }, [isNukePromptOpen]);

  useEffect(() => {
    if (!isJournalNukePromptOpen) return;
    const generation = journalNukeGenerationRef.current;
    const startedAt = Date.now();
    let lastBucket = -1;
    journalNukeTimerRef.current = window.setInterval(() => {
      if (generation !== journalNukeGenerationRef.current) {
        if (journalNukeTimerRef.current !== null) {
          window.clearInterval(journalNukeTimerRef.current);
          journalNukeTimerRef.current = null;
        }
        return;
      }
      const remaining = Math.max(0, 2000 - (Date.now() - startedAt));
      setJournalNukeCountdownMs(remaining);
      const bucket =
        remaining <= 0 ? 5 : remaining <= 180 ? 4 : remaining <= 420 ? 3 : remaining <= 800 ? 2 : remaining <= 1300 ? 1 : 0;
      if (bucket > lastBucket) {
        lastBucket = bucket;
        if (bucket >= 4) {
          fireHeavyHaptic();
          requestParentHaptic("heavy");
        } else if (bucket >= 2) {
          fireMediumHaptic();
          requestParentHaptic("success");
        } else if (bucket >= 1) {
          fireLightHaptic();
          requestParentHaptic("success");
        }
      }
      if (remaining <= 0) {
        if (journalNukeTimerRef.current !== null) {
          window.clearInterval(journalNukeTimerRef.current);
          journalNukeTimerRef.current = null;
        }
        if (generation !== journalNukeGenerationRef.current) return;
        setStatus("Nuke Journal armed. Confirm or cancel.");
      }
    }, 50);
    return () => {
      if (journalNukeTimerRef.current !== null) {
        window.clearInterval(journalNukeTimerRef.current);
        journalNukeTimerRef.current = null;
      }
    };
  }, [isJournalNukePromptOpen, isJournalNukeRunning, gratitudeEntries.length]);

  const onFactoryReset = async () => {
    fireHeavyHaptic();
    requestParentHaptic("heavy");
    fireLightHaptic();
    requestParentHaptic("success");
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
      localStorage.setItem(REPEAT_TRACK_KEY, "off");
      localStorage.removeItem(THREEPEAT_REMAINING_KEY);
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
      fireHeavyHaptic();
      requestParentHaptic("heavy");
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
          ? "Gratitude .txt ready."
          : saveMode === "opened-preview"
            ? "Gratitude .txt ready. Use iPhone save options to keep the file."
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
      const filename = promptForSaveFilename(getConfigExportFilename(), {
        message: "Name this config export before saving.",
        requiredExtension: ".json"
      });
      if (!filename) {
        setStatus("Config export canceled.");
        return;
      }
      const saveMode = await saveBlobWithBestEffort(blob, filename, {
        description: "PolyPlay Config",
        accept: { "application/json": [".json"] }
      });
      setStatus(
        saveMode === "shared"
          ? "Config ready."
          : saveMode === "save-dialog"
            ? `Saved to selected location: ${filename}.`
            : saveMode === "opened-preview"
              ? `Config ready for ${filename}. Use iPhone save options to keep the file.`
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
      const filename = promptForSaveFilename(getFullBackupFilename(), {
        message: "Name this backup before saving.",
        requiredExtension: ".zip"
      });
      if (!filename) {
        setStatus("Full backup export canceled.");
        setBackupProgress("");
        return;
      }
      const saveMode = await saveBlobWithBestEffort(result.blob, filename, {
        description: "PolyPlay Full Backup",
        accept: { "application/zip": [".zip"] }
      });
      setStatus(
        saveMode === "shared"
          ? "Vault backup ready."
          : saveMode === "save-dialog"
            ? `Saved to selected location: ${filename}.`
            : saveMode === "opened-preview"
              ? `Backup ready for ${filename}. Use iPhone save options to keep the file.`
              : `Download started for ${filename}.`
      );
      setBackupProgress("");
    } catch (error) {
      if (error instanceof BackupSizeError) {
        setInfoModal({
          title: "Backup Too Large",
          message: `Backup estimate ${formatByteCount(error.estimatedBytes)} exceeds this device's export limit of ${formatByteCount(error.capBytes)}. Remove large media or use Export Config.`
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
      const filename = promptForSaveFilename(getPolyplaylistFilename(result.playlistName), {
        message: "Name this PolyPlaylist before saving.",
        requiredExtension: ".polyplaylist"
      });
      if (!filename) {
        setStatus("PolyPlaylist export canceled.");
        return;
      }
      const saveMode = await saveBlobWithBestEffort(result.blob, filename, {
        description: "PolyPlaylist Export",
        accept: { "application/zip": [".polyplaylist", ".zip"] }
      });
      setStatus(
        saveMode === "shared"
          ? "PolyPlaylist ready."
          : saveMode === "save-dialog"
            ? `Saved to selected location: ${filename}.`
            : saveMode === "opened-preview"
              ? `PolyPlaylist ready for ${filename}. Use iPhone save options to keep the file.`
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

  const onStartTrackRename = (trackId: string, title: string, artist: string) => {
    setEditingTrackId(trackId);
    setEditingTrackTitle(title);
    setEditingTrackArtist(artist);
  };

  const onCancelTrackRename = () => {
    setEditingTrackId(null);
    setEditingTrackTitle("");
    setEditingTrackArtist("");
  };

  const onSaveTrackRename = async (trackId: string) => {
    const trimmedTitle = editingTrackTitle.trim();
    const trimmedArtist = editingTrackArtist.trim();
    if (!trimmedTitle) {
      setStatus("Title can't be empty.");
      return;
    }
    setRenamingTrackId(trackId);
    try {
      await updateTrackTextMetadataInDb(trackId, {
        title: trimmedTitle,
        artist: trimmedArtist || null
      });
      setStatus("Track info updated.");
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
        {importNotice && (
        <div className="admin-import-toast" role="status" aria-live="polite">
          <div className="admin-import-toast__eyebrow">PolyPlay Import</div>
          <div className="admin-import-toast__title">
            {isBusyToastMessage(importNotice) ? (
              <TextShimmer duration={1.4}>{importNotice}</TextShimmer>
            ) : (
              importNotice
            )}
          </div>
          <div className="admin-import-toast__sub">Please keep this window open while media is being stored.</div>
        </div>
        )}
      <header
        className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-300/20 bg-slate-900/85 p-3 shadow-glow backdrop-blur"
        onTouchStart={(event) => {
          if (event.touches.length !== 1) {
            settingsHeroSwipeStartRef.current = null;
            return;
          }
          beginSettingsHeroSwipeDismiss(event.touches[0]);
        }}
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0];
          if (!touch) return;
          endSettingsHeroSwipeDismiss(touch);
        }}
        onTouchCancel={() => {
          settingsHeroSwipeStartRef.current = null;
        }}
      >
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
            if (tagName === "TEXTAREA" || tagName === "SELECT") return;
            if (target instanceof HTMLInputElement && (target.type === "range" || target.type === "file")) return;
            if (target?.closest(".transfer-lane__tip-btn, .frame-video-toggle, .admin-upload-submit")) return;
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
                ref={uploadTitleInputRef}
                value={uploadTitle}
                onChange={(event) => {
                  uploadTitleTouchedRef.current = true;
                  uploadTitleAutofilledRef.current = false;
                  setUploadTitleValue(event.currentTarget.value);
                }}
                className="admin-upload-input rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Artist Name
              <input
                list="admin-artist-suggestions"
                value={uploadArtist}
                onChange={(event) => {
                  uploadArtistTouchedRef.current = true;
                  uploadArtistAutofilledRef.current = false;
                  setUploadArtistValue(event.currentTarget.value);
                }}
                placeholder="Start typing to see artist suggestions"
                className="admin-upload-input rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>
            <datalist id="admin-artist-suggestions">
              {artistSuggestions.map((artist) => (
                <option key={artist} value={artist} />
              ))}
            </datalist>

            <TransferLaneDropZone
              label="Audio (.wav/.mp3/.mov)"
              tooltip="Fallback importer for direct track creation."
              iconType="audio"
              accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.wav,.mp3,.m4a,.aac,.mp4,.mov"
              selectedFileName={uploadAudio?.name}
              armed={Boolean(uploadAudio)}
              onPickRequest={CAN_USE_IOS_NATIVE_AUDIO_IMPORT ? (fallbackPick) => void onPickUploadAudioNative(fallbackPick) : undefined}
              onFileSelected={(file) => void onPickUploadAudio(file)}
            />

            <TransferLaneDropZone
              label="Artwork (image, mp4, or mov, optional)"
              tooltip="Fallback artwork picker for manual import flow."
              iconType="artwork"
              accept="image/*,video/mp4,video/quicktime,.mov"
              selectedFileName={uploadArt?.name}
              armed={Boolean(uploadArt)}
              onPickRequest={CAN_USE_IOS_NATIVE_ARTWORK_IMPORT ? (fallbackPick) => void onPickUploadArtworkNative(fallbackPick) : undefined}
              onFileSelected={(file) => void onPickUploadArtwork(file)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={ignoreUploadMetadata}
                onChange={(event) => setIgnoreUploadMetadata(event.currentTarget.checked)}
                className="admin-upload-checkbox h-4 w-4 rounded border border-slate-300/30 bg-slate-950/70"
              />
              Do not import metadata
            </label>
            <div
              className={`rounded-xl border px-3 py-2 text-xs ${
                uploadMetadataStatus.tone === "danger"
                  ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
                  : uploadMetadataStatus.tone === "success"
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : uploadMetadataStatus.tone === "warning"
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                      : uploadMetadataStatus.tone === "loading"
                        ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                        : "border-slate-300/20 bg-slate-950/50 text-slate-300"
              }`.trim()}
              role="status"
              aria-live="polite"
            >
              <div className="font-semibold">{uploadMetadataStatus.label}</div>
              <div className="mt-1 opacity-90">{uploadMetadataStatus.detail}</div>
            </div>
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
              className={`admin-upload-submit min-h-[54px] px-5 text-base font-semibold ${isImportArmed ? "admin-action-armed" : ""}`.trim()}
            >
              Import
            </Button>

            <label className="flex items-center gap-3 text-base font-semibold text-slate-200">
              <input
                type="checkbox"
                checked={keepImportPageOpen}
                onChange={(event) => setKeepImportPageOpen(event.currentTarget.checked)}
                className="admin-upload-checkbox h-5 w-5 rounded border border-slate-300/30 bg-slate-950/70"
              />
              Keep me on Import page
            </label>
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
                onPickRequest={CAN_USE_IOS_NATIVE_ARTWORK_IMPORT ? (fallbackPick) => void onPickSelectedArtworkNative(fallbackPick) : undefined}
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
                accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.wav,.mp3,.m4a,.aac,.mp4,.mov"
                compact
                selectedFileName={selectedAudioFile?.name}
                armed={Boolean(selectedAudioFile)}
                onPickRequest={CAN_USE_IOS_NATIVE_AUDIO_IMPORT ? (fallbackPick) => void onPickSelectedAudioNative(fallbackPick) : undefined}
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
              accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.wav,.mp3,.m4a,.aac,.mp4,.mov"
              selectedFileName={audioTransferMode === "replace" ? selectedAudioFile?.name : uploadAudio?.name}
              busy={isAudioLaneBusy}
              onPickRequest={
                CAN_USE_IOS_NATIVE_AUDIO_IMPORT
                  ? async (fallbackPick) => {
                      try {
                        const file = await pickIosNativeAudioFile();
                        if (!file) {
                          fallbackPick();
                          return;
                        }
                        if (audioTransferMode === "replace") setSelectedAudioFile(file);
                        else setUploadAudio(file);
                        await runAudioLaneTransfer(file);
                      } catch {
                        fallbackPick();
                      }
                    }
                  : undefined
              }
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
              onPickRequest={
                CAN_USE_IOS_NATIVE_ARTWORK_IMPORT
                  ? async (fallbackPick) => {
                      try {
                        const file = await pickIosNativeArtworkFile();
                        if (!file) {
                          fallbackPick();
                          return;
                        }
                        setSelectedArtworkFile(file);
                        await runArtworkLaneTransfer(file);
                      } catch {
                        fallbackPick();
                      }
                    }
                  : undefined
              }
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
          <h2 className="text-base font-semibold text-slate-100">PolyPlaylist Manager</h2>
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
              if (!isThemeSelection(selected)) return;
              const nextMode = selected === "dark" ? "dark" : selected === "light" ? "light" : "custom";
              const nextSlot: CustomThemeSlot = isCustomThemeSlot(selected) ? selected : customThemeSlot;
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
                  ? `Theme set to ${getThemeLabel(nextSlot)}. Aura matched to pack.`
                  : `Theme set to ${getThemeLabel(selected)}.`
              );
              fireSuccessHaptic();
              requestParentHaptic("success");
              showSuccessNotice(
                nextMode === "custom"
                  ? `Theme set to ${getThemeLabel(nextSlot)}. Aura matched to pack.`
                  : `Theme set to ${getThemeLabel(selected)}.`
              );
            }}
          >
            {THEME_SELECTION_ORDER.map((selection) => (
              <option key={selection} value={selection}>
                {selection === "dark" ? "Default (Dark Mode)" : selection === "light" ? "Light Mode" : getThemeLabel(selection)}
              </option>
            ))}
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
                  fireSuccessHaptic();
                  requestParentHaptic("success");
                  showSuccessNotice(`Aura color applied: ${next}.`);
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
                  showSuccessNotice("Aura color reset to default.");
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
        {backupProgress && (
          <div className="mt-2 text-sm text-slate-300">
            {isBusyToastMessage(backupProgress) ? (
              <TextShimmer duration={1.3}>{backupProgress}</TextShimmer>
            ) : (
              backupProgress
            )}
          </div>
        )}
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
              className={`admin-track-row rounded-xl border border-slate-300/15 bg-slate-900/55 px-3 py-2 ${
                removingTrackIds.includes(row.id) ? "is-removing" : ""
              }`.trim()}
            >
              <div className="admin-track-row__thumb" aria-hidden="true">
                {trackArtById[row.id] ? (
                  <img src={trackArtById[row.id]} alt="" loading="lazy" />
                ) : (
                  <span className="admin-track-row__thumb-fallback">♪</span>
                )}
              </div>
              <div className="admin-track-row__main min-w-0">
                {editingTrackId === row.id ? (
                  <div className="admin-track-row__edit flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      type="text"
                      className="admin-track-row__edit-input rounded-lg border border-slate-300/25 bg-slate-950/85 px-2 py-1 text-sm font-semibold text-slate-100"
                      value={editingTrackTitle}
                      autoFocus
                      placeholder="Title"
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
                    <input
                      type="text"
                      className="admin-track-row__edit-input rounded-lg border border-slate-300/25 bg-slate-950/85 px-2 py-1 text-sm text-slate-200"
                      value={editingTrackArtist}
                      placeholder="Artist"
                      onChange={(event) => setEditingTrackArtist(event.currentTarget.value)}
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
                    <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" onClick={() => void onSaveTrackRename(row.id)} disabled={renamingTrackId === row.id}>
                      Save
                    </Button>
                    <Button variant="secondary" onClick={onCancelTrackRename} disabled={renamingTrackId === row.id}>
                      Cancel
                    </Button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-track-row__title-stack">
                    <div
                      className="admin-track-row__title text-sm font-semibold text-slate-100"
                      title={trackTitleById[row.id] || row.title}
                    >
                      {formatTrackStorageLabel(row, trackTitleById[row.id])}
                    </div>
                    {(trackArtistById[row.id] || row.artist) && (
                      <div className="text-xs text-slate-300" title={trackArtistById[row.id] || row.artist || ""}>
                        {trackArtistById[row.id] || row.artist}
                      </div>
                    )}
                    <button
                      type="button"
                      className="admin-track-row__rename inline-flex h-7 items-center gap-1 rounded-md border border-slate-300/20 bg-slate-800/70 px-2 text-xs font-semibold text-slate-100"
                      title="Rename"
                      aria-label={`Rename ${trackTitleById[row.id] || row.title}`}
                      onClick={() =>
                        onStartTrackRename(row.id, trackTitleById[row.id] || row.title, trackArtistById[row.id] || row.artist || "")
                      }
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
                className="admin-track-row__remove"
                variant="danger"
                onClick={() => {
                  setConfirmState({
                    kind: "remove-track",
                    trackId: row.id,
                    message: `Remove "${trackTitleById[row.id] || row.title}" to free storage?`
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
          <Button variant="danger" onClick={onNukeJournal} disabled={gratitudeEntries.length === 0}>
            Nuke Journal
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
            onClick={handleAdminLinkClick(PRIVACY_POLICY_URL)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 font-medium text-slate-100 underline decoration-slate-400/60 underline-offset-4"
          >
            Privacy Policy
          </a>
          <a
            href={TERMS_AND_CONDITIONS_URL}
            onClick={handleAdminLinkClick(TERMS_AND_CONDITIONS_URL)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 font-medium text-slate-100 underline decoration-slate-400/60 underline-offset-4"
          >
            Terms & Conditions
          </a>
          <a
            href="/support"
            onClick={handleAdminLinkClick(SUPPORT_URL)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 font-medium text-slate-100 underline decoration-slate-400/60 underline-offset-4"
          >
            Support
          </a>
        </div>
      </div>
      </div>
      </>
      )}
      {laneToast && (
        <div className="admin-lane-toast" role="status" aria-live="polite">
          {isBusyToastMessage(laneToast) ? (
            <TextShimmer duration={1.3}>{laneToast}</TextShimmer>
          ) : (
            laneToast
          )}
        </div>
      )}

      {isNukePromptOpen && (
        <section
          className="admin-nuke-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Nuke countdown"
          onClick={(event) => {
            if (event.target === event.currentTarget) abortNuke();
          }}
        >
          <div className="admin-nuke-modal__card">
            <h3 className="admin-nuke-modal__title">Nuke Playlist Armed</h3>
            <p className="admin-nuke-modal__sub">
              {nukeCountdownMs > 0 ? "Arming playlist clear in" : "Playlist clear is armed."}
            </p>
            <div className="admin-nuke-modal__count">
              {nukeCountdownMs > 0 ? `${(nukeCountdownMs / 1000).toFixed(1)}s` : "READY"}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={abortNuke}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void runNuke()} disabled={nukeCountdownMs > 0 || isNukeRunning}>
                Nuke Playlist
              </Button>
            </div>
          </div>
        </section>
      )}
      {isJournalNukePromptOpen && (
        <section
          className="admin-nuke-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Nuke Journal countdown"
          onClick={(event) => {
            if (event.target === event.currentTarget) abortJournalNuke();
          }}
        >
          <div className="admin-nuke-modal__card">
            <h3 className="admin-nuke-modal__title">Nuke Journal Armed</h3>
            <p className="admin-nuke-modal__sub">
              {journalNukeCountdownMs > 0 ? "Arming journal clear in" : "Journal clear is armed."}
            </p>
            <div className="admin-nuke-modal__count">
              {journalNukeCountdownMs > 0 ? `${(journalNukeCountdownMs / 1000).toFixed(1)}s` : "READY"}
            </div>
            <p className="admin-nuke-modal__sub">Tracks, playlists, artwork, settings, and Vaults are not affected.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={abortJournalNuke}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void runJournalNuke()} disabled={journalNukeCountdownMs > 0 || isJournalNukeRunning}>
                Nuke Journal
              </Button>
            </div>
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
