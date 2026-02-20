import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import logo from "../../logo.png";
import { TransferLaneDropZone } from "./TransferLaneDropZone";
import { GratitudeEntriesModal } from "./GratitudeEntriesModal";
import { GratitudeHubPanel } from "./GratitudeHubPanel";
import {
  addTrackToDb,
  clearTracksInDb,
  createPlaylistInDb,
  deletePlaylistInDb,
  getStorageUsageSummary,
  getPlaylistsFromDb,
  getTrackStorageRows,
  getTrackRowsFromDb,
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
import { validateVideoArtworkFile } from "../lib/artwork/videoValidation";
import { DEMO_PACK_VERSION_KEY, installDemoPackIfNeeded } from "../lib/demoPack";
import {
  DEFAULT_GRATITUDE_SETTINGS,
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
  applyImportedPolyplaylistConfig,
  BackupSizeError,
  applyImportedConfig,
  buildConfigSnapshot,
  exportFullBackup,
  getConfigExportFilename,
  getFullBackupFilename,
  getNextDefaultPolyplaylistName,
  getPolyplaylistConfigFilename,
  importFullBackup,
  parseConfigImportText,
  serializePolyplaylistConfig,
  serializeConfig
} from "../lib/backup";
import { titleFromFilename } from "../lib/title";
import { Button } from "../components/button";

const HAS_IMPORTED_KEY = "polyplay_hasImported";
const HAS_ONBOARDED_KEY = "polyplay_hasOnboarded_v1";
const THEME_MODE_KEY = "polyplay_themeMode";

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
    name.endsWith(".mp4")
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

export function AdminApp() {
  const [tracks, setTracks] = useState<DbTrackRecord[]>([]);
  const [status, setStatus] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAudio, setUploadAudio] = useState<File | null>(null);
  const [uploadArt, setUploadArt] = useState<File | null>(null);
  const [uploadArtPreviewUrl, setUploadArtPreviewUrl] = useState("");
  const [uploadArtDuration, setUploadArtDuration] = useState(0);
  const [uploadArtFrameTime, setUploadArtFrameTime] = useState(0);
  const [uploadArtPosterBlob, setUploadArtPosterBlob] = useState<Blob | null>(null);

  const [selectedArtworkTrackId, setSelectedArtworkTrackId] = useState<string>("");
  const [selectedArtworkFile, setSelectedArtworkFile] = useState<File | null>(null);
  const [selectedArtPreviewUrl, setSelectedArtPreviewUrl] = useState("");
  const [selectedArtDuration, setSelectedArtDuration] = useState(0);
  const [selectedArtFrameTime, setSelectedArtFrameTime] = useState(0);
  const [selectedArtPosterBlob, setSelectedArtPosterBlob] = useState<Blob | null>(null);

  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string>("");
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedTransferTrackId, setSelectedTransferTrackId] = useState<string>("");
  const [audioTransferMode, setAudioTransferMode] = useState<"create" | "replace">("create");
  const [isAudioLaneBusy, setIsAudioLaneBusy] = useState(false);
  const [isArtworkLaneBusy, setIsArtworkLaneBusy] = useState(false);
  const [laneToast, setLaneToast] = useState<string | null>(null);

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
  const [sortLargestFirst, setSortLargestFirst] = useState(true);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackTitle, setEditingTrackTitle] = useState("");
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; openManageStorage?: boolean } | null>(
    null
  );
  const [isNukePromptOpen, setIsNukePromptOpen] = useState(false);
  const [nukeCountdownMs, setNukeCountdownMs] = useState(2000);
  const [isNukeRunning, setIsNukeRunning] = useState(false);
  const nukeTimerRef = useRef<number | null>(null);
  const manageStorageRef = useRef<HTMLElement | null>(null);
  const importConfigInputRef = useRef<HTMLInputElement | null>(null);
  const importBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importPolyplaylistInputRef = useRef<HTMLInputElement | null>(null);
  const [backupProgress, setBackupProgress] = useState("");
  const [isBackupBusy, setIsBackupBusy] = useState(false);

  const hasTracks = tracks.length > 0;

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

      const first = String(rows[0].id);
      setSelectedArtworkTrackId((prev) => prev || first);
      setSelectedAudioTrackId((prev) => prev || first);
      setSelectedRemoveTrackId((prev) => prev || first);
      setSelectedTransferTrackId((prev) => prev || first);
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
    void refreshTracks();
    void refreshStorage();
    void refreshPlaylists();
  }, []);

  useEffect(() => {
    setGratitudeSettings(loadGratitudeSettings());
    setGratitudeEntries(getGratitudeEntries());
  }, []);

  useEffect(() => {
    const applyTheme = (next: "light" | "dark") => {
      document.body.classList.toggle("theme-dark", next === "dark");
    };
    const saved = localStorage.getItem(THEME_MODE_KEY);
    applyTheme(saved === "dark" ? "dark" : "light");

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_MODE_KEY) return;
      applyTheme(event.newValue === "dark" ? "dark" : "light");
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "polyplay:theme-changed") return;
      const next = event.data?.themeMode === "dark" ? "dark" : "light";
      applyTheme(next);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
      document.body.classList.remove("theme-dark");
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
    };
  }, [selectedArtPreviewUrl, uploadArtPreviewUrl]);

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

  const notifyUserImported = () => {
    try {
      localStorage.setItem(HAS_IMPORTED_KEY, "true");
    } catch {
      // Ignore storage failures.
    }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:user-imported" }, window.location.origin);
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

  const runAudioLaneTransfer = async (file: File) => {
    const mime = file.type.toLowerCase();
    if (mime.startsWith("image/") || mime.startsWith("video/")) {
      setLaneToast("That’s artwork — drop it in Artwork.");
      return;
    }
    setIsAudioLaneBusy(true);
    try {
      if (!selectedTransferTrackId || audioTransferMode === "create") {
        await addTrackToDb({
          title: titleFromFilename(file.name),
          sub: "Uploaded",
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
    posterBlob: Blob | null
  ): Promise<{ artPoster: Blob | null; artVideo: Blob | null; posterCaptureFailed: boolean }> => {
    if (!file) return { artPoster: null, artVideo: null, posterCaptureFailed: false };
    if (!isVideoArtwork(file)) return { artPoster: file, artVideo: null, posterCaptureFailed: false };
    let effectivePoster = posterBlob;
    if (!effectivePoster) {
      effectivePoster = await capturePosterFrame(file, 0.45).catch(() => null);
    }
    return { artPoster: effectivePoster ?? null, artVideo: file, posterCaptureFailed: !effectivePoster };
  };

  const captureUploadFrame = async () => {
    if (!uploadArt || !isVideoArtwork(uploadArt)) return;
    setStatus("Capturing artwork frame...");
    try {
      const poster = await capturePosterFrame(uploadArt, uploadArtFrameTime);
      setUploadArtPosterBlob(poster);
      setStatus("Frame captured.");
    } catch {
      setStatus("Could not capture frame from artwork video.");
    }
  };

  const captureSelectedFrame = async () => {
    if (!selectedArtworkFile || !isVideoArtwork(selectedArtworkFile)) return;
    setStatus("Capturing artwork frame...");
    try {
      const poster = await capturePosterFrame(selectedArtworkFile, selectedArtFrameTime);
      setSelectedArtPosterBlob(poster);
      setStatus("Frame captured.");
    } catch {
      setStatus("Could not capture frame from artwork video.");
    }
  };

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupportedTrackFile(uploadAudio)) {
      setStatus("Select a track file (.wav, .mp3, .m4a, or .mp4).");
      return;
    }

    const derivedTitle = uploadTitle.trim() || titleFromFilename(uploadAudio.name);
    setStatus("Uploading...");

    try {
      const artwork = await buildArtworkPayload(uploadArt, uploadArtPosterBlob);
      await addTrackToDb({
        title: derivedTitle,
        sub: "Uploaded",
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
          ? "Upload complete. Video artwork added (poster frame unavailable on this browser)."
          : "Upload complete."
      );
      await refreshTracks();
      await refreshStorage();
      await notifyUploadSuccess();
    } catch (error) {
      if (isStorageCapError(error)) {
        setInfoModal({
          title: "Storage Almost Full",
          message: "Storage is almost full. Manage storage to free space before uploading.",
          openManageStorage: true
        });
        return;
      }
      setStatus("Upload failed.");
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

    setStatus("Updating artwork...");
    try {
      const artwork = await buildArtworkPayload(selectedArtworkFile, selectedArtPosterBlob);
      await updateArtworkInDb(selectedArtworkTrackId, artwork);
      notifyUserImported();
      setSelectedArtworkAssetFile(null);
      setStatus(
        artwork.posterCaptureFailed
          ? "Artwork updated. Video artwork added (poster frame unavailable on this browser)."
          : "Artwork updated."
      );
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

  const onRemoveTrack = async () => {
    if (!selectedRemoveTrackId) {
      setStatus("Select a track to remove.");
      return;
    }

    if (!window.confirm("Remove this track?")) return;
    setStatus("Removing track...");
    try {
      await removeTrackFromDb(selectedRemoveTrackId);
      setStatus("Track removed.");
      await refreshTracks();
      await refreshStorage();
    } catch {
      setStatus("Track remove failed.");
    }
  };

  const onResetAura = async () => {
    if (!window.confirm("Reset aura for all tracks?")) return;

    setStatus("Resetting aura...");
    try {
      const updated = await resetAuraInDb();
      setStatus(`Aura reset for ${updated} track${updated === 1 ? "" : "s"}.`);
      await refreshTracks();
    } catch {
      setStatus("Aura reset failed.");
    }
  };

  const runNuke = async () => {
    if (isNukeRunning) return;
    setIsNukeRunning(true);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "polyplay:nuke-request" }, window.location.origin);
        setStatus("Nuking app data...");
        window.setTimeout(() => {
          void refreshTracks();
        }, 1000);
      } catch {
        setStatus("Nuke request failed.");
      }
      setIsNukeRunning(false);
      return;
    }

    setStatus("Clearing playlist...");
    try {
      await clearTracksInDb();
      setStatus("All tracks deleted.");
      await refreshTracks();
      await refreshStorage();
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

  const onResetOnboarding = () => {
    if (!window.confirm("Reset onboarding and splash for this browser?")) return;
    try {
      localStorage.removeItem("polyplay_hasSeenSplash");
      localStorage.removeItem("polyplay_open_state_seen_v102");
      localStorage.removeItem(HAS_IMPORTED_KEY);
      localStorage.removeItem(HAS_ONBOARDED_KEY);
      setStatus("Onboarding reset. Reload the player to see the splash again.");
    } catch {
      setStatus("Could not reset onboarding.");
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
    deleteGratitudeEntry(entry.id);
    setGratitudeEntries(getGratitudeEntries());
    if (selectedGratitudeEntry?.id === entry.id) setSelectedGratitudeEntry(null);
    setStatus("Gratitude entry deleted.");
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

  const onExportGratitudeTxt = () => {
    const payload = formatGratitudeExport(gratitudeEntries);
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `polyplay-gratitude-${stamp}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("Gratitude .txt exported.");
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

  const onExportConfig = () => {
    try {
      const content = serializeConfig(buildConfigSnapshot());
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      downloadBlobFile(blob, getConfigExportFilename());
      setStatus("Config exported.");
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
    try {
      const result = await exportFullBackup((progress) => {
        setBackupProgress(progress.label);
      });
      downloadBlobFile(result.blob, getFullBackupFilename());
      setStatus(`Full backup exported (${result.trackCount} tracks).`);
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
    const suggestedName = getNextDefaultPolyplaylistName();
    const userInput = window.prompt("Name your PolyPlaylist", suggestedName);
    if (userInput === null) return;
    const playlistName = userInput.trim() || suggestedName;
    try {
      const content = serializePolyplaylistConfig(playlistName);
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      downloadBlobFile(blob, getPolyplaylistConfigFilename());
      setStatus(`PolyPlaylist exported as "${playlistName}".`);
    } catch (error) {
      setStatus(`PolyPlaylist export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const onImportPolyplaylistFile = async (file: File | null) => {
    if (!file) return;
    try {
      const content = await file.text();
      const summary = applyImportedPolyplaylistConfig(content);
      await refreshTracks();
      await refreshPlaylists();
      await refreshStorage();
      const missingPreview =
        summary.missingTrackIds.length > 0
          ? ` Missing IDs: ${summary.missingTrackIds.slice(0, 5).join(", ")}${
              summary.missingTrackIds.length > 5 ? "…" : ""
            }.`
          : "";
      setStatus(
        `PolyPlaylist applied. Updated ${summary.updatedTrackCount} tracks. Missing ${summary.missingTrackIds.length} tracks.${missingPreview}`
      );
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:config-imported" }, window.location.origin);
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch (error) {
      setStatus(`PolyPlaylist import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const onRemoveDemoTracks = async () => {
    if (!window.confirm("Remove all demo tracks?")) return;
    try {
      const removed = await removeDemoTracksInDb();
      localStorage.removeItem(DEMO_PACK_VERSION_KEY);
      setStatus(`Removed ${removed} demo track${removed === 1 ? "" : "s"}.`);
      await refreshTracks();
      await refreshStorage();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch {
      setStatus("Failed to remove demo tracks.");
    }
  };

  const onRestoreDemoTracks = async () => {
    try {
      localStorage.removeItem(DEMO_PACK_VERSION_KEY);
      const seeded = await installDemoPackIfNeeded();
      setStatus(
        seeded.installed > 0
          ? `Restored ${seeded.installed} demo track${seeded.installed === 1 ? "" : "s"}.`
          : "Demo tracks are already restored."
      );
      await refreshTracks();
      await refreshStorage();
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "polyplay:library-updated" }, window.location.origin);
      }
    } catch {
      setStatus("Failed to restore demo tracks.");
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
    if (!window.confirm(`Delete "${playlist.name}"? Tracks only in this playlist will also be removed.`)) return;
    setPlaylistBusyId(playlist.id);
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
      setStatus(`Playlist delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setPlaylistBusyId(null);
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

  return (
    <div
      className={`admin-v1 touch-clean mx-auto min-h-screen w-full max-w-5xl px-3 pb-5 pt-3 sm:px-4 ${
        isNukePromptOpen ? "admin-v1--nuke-arming" : ""
      }`.trim()}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-300/20 bg-slate-900/85 p-3 shadow-glow backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={logo}
            alt="Polyplay logo"
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-300/20"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-100">Polyplay Admin</h1>
            <p className="truncate text-xs text-slate-400">React + TypeScript</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/index.html"
            className="rounded-xl border border-slate-300/20 bg-slate-800/70 px-3 py-2 text-sm text-slate-100"
            onClick={onBackToPlayer}
          >
            Back to Player
          </a>
        </div>
      </header>

      <section className="admin-v1-section grid gap-3 lg:grid-cols-2">
        <form onSubmit={onUpload} className="admin-v1-card rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
          <h2 className="mb-2 text-base font-semibold text-slate-100">Upload Track</h2>
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
              label="Audio (.wav/.mp3)"
              tooltip="Fallback uploader for direct track creation."
              accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,video/mp4,.wav,.mp3,.m4a,.aac,.mp4"
              selectedFileName={uploadAudio?.name}
              onFileSelected={(file) => void onPickUploadAudio(file)}
            />

            <TransferLaneDropZone
              label="Artwork (image, mp4, or mov, optional)"
              tooltip="Fallback artwork picker for manual upload flow."
              accept="image/*,video/mp4,video/quicktime,.mov"
              selectedFileName={uploadArt?.name}
              onFileSelected={(file) => void onPickUploadArtwork(file)}
            />
            {uploadArtPreviewUrl && (
              <div className="video-frame-picker">
                <label className="text-xs text-slate-300">Poster frame for static artwork</label>
                <video
                  className="frame-video"
                  src={uploadArtPreviewUrl}
                  muted
                  playsInline
                  controls
                  onLoadedMetadata={(event) => {
                    const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                    setUploadArtDuration(duration);
                    setUploadArtFrameTime(getDefaultVideoFrameTime(duration));
                  }}
                />
                <input
                  className="frame-slider"
                  type="range"
                  min={0}
                  max={Math.max(0, uploadArtDuration)}
                  step={0.05}
                  value={Math.min(uploadArtFrameTime, Math.max(0, uploadArtDuration))}
                  onChange={(event) => setUploadArtFrameTime(Number(event.currentTarget.value))}
                />
                <div className="text-xs text-slate-400">Frame: {uploadArtFrameTime.toFixed(2)}s</div>
                <Button variant="primary" onClick={() => void captureUploadFrame()}>
                  Use This Frame
                </Button>
              </div>
            )}

            <Button variant="primary" type="submit" className="admin-upload-submit">
              Upload
            </Button>
          </div>
        </form>

        <div className="admin-v1-card rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
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
                accept="image/*,video/mp4,video/quicktime,.mov"
                selectedFileName={selectedArtworkFile?.name}
                onFileSelected={(file) => void onPickSelectedArtwork(file)}
                disabled={!hasTracks}
              />
              {selectedArtPreviewUrl && (
                <div className="video-frame-picker">
                  <label className="text-xs text-slate-300">Poster frame for static artwork</label>
                  <video
                    className="frame-video"
                    src={selectedArtPreviewUrl}
                    muted
                    playsInline
                    controls
                    onLoadedMetadata={(event) => {
                      const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                      setSelectedArtDuration(duration);
                      setSelectedArtFrameTime(getDefaultVideoFrameTime(duration));
                    }}
                  />
                  <input
                    className="frame-slider"
                    type="range"
                    min={0}
                    max={Math.max(0, selectedArtDuration)}
                    step={0.05}
                    value={Math.min(selectedArtFrameTime, Math.max(0, selectedArtDuration))}
                    onChange={(event) => setSelectedArtFrameTime(Number(event.currentTarget.value))}
                  />
                  <div className="text-xs text-slate-400">Frame: {selectedArtFrameTime.toFixed(2)}s</div>
                  <Button variant="primary" onClick={() => void captureSelectedFrame()}>
                    Use This Frame
                  </Button>
                </div>
              )}
              <Button variant="primary" onClick={onUpdateArtwork} disabled={!hasTracks}>
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
                accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,video/mp4,.wav,.mp3,.m4a,.aac,.mp4"
                selectedFileName={selectedAudioFile?.name}
                onFileSelected={(file) => void onPickSelectedAudio(file)}
                disabled={!hasTracks}
              />
              <Button variant="primary" onClick={onReplaceAudio} disabled={!hasTracks}>
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
              accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.wav,.mp3,.m4a,.aac,.mp4"
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
      </section>

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
                    onClick={() => void onDeletePlaylist(playlist)}
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
          accept=".polyplaylist.json,application/json,.json"
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
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300/15 bg-slate-900/55 px-3 py-2"
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
                onClick={async () => {
                  if (!window.confirm(`Remove "${row.title}" to free storage?`)) return;
                  await removeTrackFromDb(row.id);
                  await refreshTracks();
                  await refreshStorage();
                  setStatus("Track removed.");
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          {!visibleTrackStorageRows.length && <div className="text-sm text-slate-400">No tracks stored.</div>}
        </div>
      </section>

      <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Demo Tracks</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRestoreDemoTracks}>
            Restore Demo Tracks
          </Button>
          <Button variant="danger" onClick={onRemoveDemoTracks}>
            Remove Demo Tracks
          </Button>
        </div>
      </section>

      <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Danger Zone</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void refreshTracks()}>
            Refresh Tracks
          </Button>
          <Button variant="secondary" onClick={onResetOnboarding}>
            Reset Onboarding
          </Button>
          <Button variant="danger" onClick={onResetAura} disabled={!hasTracks}>
            Reset Aura
          </Button>
          <Button variant="danger" onClick={onNuke} disabled={!hasTracks}>
            Nuke Playlist
          </Button>
        </div>
      </section>

      <p className="mt-3 rounded-xl border border-slate-300/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
        {status || "Ready."}
      </p>
      {laneToast && (
        <div className="admin-lane-toast" role="status" aria-live="polite">
          {laneToast}
        </div>
      )}

      {isNukePromptOpen && (
        <section className="admin-nuke-modal" role="dialog" aria-modal="true" aria-label="Nuke countdown">
          <div className="admin-nuke-modal__card">
            <h3 className="admin-nuke-modal__title">Nuke Playlist Armed</h3>
            <p className="admin-nuke-modal__sub">Clearing all tracks in</p>
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
    </div>
  );
}
