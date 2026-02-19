import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import logo from "../../logo.png";
import {
  addTrackToDb,
  clearTracksInDb,
  getTrackRowsFromDb,
  removeTrackFromDb,
  replaceAudioInDb,
  resetAuraInDb,
  updateArtworkInDb,
  type DbTrackRecord
} from "../lib/db";
import { titleFromFilename } from "../lib/title";
import { Button } from "../components/button";

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

function getDefaultVideoFrameTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0.2;
  const candidate = duration * 0.28;
  const min = Math.min(0.2, Math.max(0, duration - 0.08));
  const max = Math.max(0, duration - 0.08);
  return Math.max(min, Math.min(max, candidate));
}

async function capturePosterFrame(videoFile: File, timeSec: number): Promise<Blob> {
  const objectUrl = URL.createObjectURL(videoFile);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const onLoadedMeta = () => {
        video.removeEventListener("loadedmetadata", onLoadedMeta);
        video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("loadedmetadata", onLoadedMeta);
        video.removeEventListener("error", onError);
        reject(new Error("Unable to load video metadata"));
      };
      video.addEventListener("loadedmetadata", onLoadedMeta);
      video.addEventListener("error", onError);
    });

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await new Promise<void>((resolve) => {
        const onLoadedData = () => {
          video.removeEventListener("loadeddata", onLoadedData);
          resolve();
        };
        video.addEventListener("loadeddata", onLoadedData, { once: true });
      });
    }

    const safeDuration = Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0;
    const desiredTime = Number.isFinite(timeSec) && timeSec > 0 ? timeSec : getDefaultVideoFrameTime(safeDuration);
    const safeTime = Math.max(0, Math.min(Math.max(0, safeDuration - 0.05), desiredTime));
    const needsSeek = Math.abs(video.currentTime - safeTime) > 0.02;
    if (needsSeek) {
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const cleanup = () => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
          if (timer !== null) window.clearTimeout(timer);
        };
        const finish = () => {
          if (done) return;
          done = true;
          cleanup();
          resolve();
        };
        const fail = (message: string) => {
          if (done) return;
          done = true;
          cleanup();
          reject(new Error(message));
        };
        const onSeeked = () => finish();
        const onError = () => fail("Unable to seek video frame");
        const timer = window.setTimeout(() => finish(), 550);
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);
        video.currentTime = safeTime;
      });
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await new Promise<void>((resolve) => {
        const onLoadedData = () => resolve();
        video.addEventListener("loadeddata", onLoadedData, { once: true });
      });
    }

    const sourceWidth = Math.max(1, video.videoWidth || 1);
    const sourceHeight = Math.max(1, video.videoHeight || 1);
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to render poster frame");
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Unable to export poster frame");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

  const [selectedRemoveTrackId, setSelectedRemoveTrackId] = useState<string>("");
  const [isNukePromptOpen, setIsNukePromptOpen] = useState(false);
  const [nukeCountdownMs, setNukeCountdownMs] = useState(2000);
  const [isNukeRunning, setIsNukeRunning] = useState(false);
  const nukeTimerRef = useRef<number | null>(null);

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
        return;
      }

      const first = String(rows[0].id);
      setSelectedArtworkTrackId((prev) => prev || first);
      setSelectedAudioTrackId((prev) => prev || first);
      setSelectedRemoveTrackId((prev) => prev || first);
    } catch {
      setStatus("Failed to load tracks.");
    }
  };

  useEffect(() => {
    void refreshTracks();
  }, []);

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

  const buildArtworkPayload = async (
    file: File | null,
    frameTime: number,
    posterBlob: Blob | null
  ): Promise<{ artPoster: Blob | null; artVideo: Blob | null }> => {
    if (!file) return { artPoster: null, artVideo: null };
    if (!isVideoArtwork(file)) return { artPoster: file, artVideo: null };
    const poster = posterBlob ?? (await capturePosterFrame(file, frameTime));
    return { artPoster: poster, artVideo: file };
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
    if (!uploadAudio) {
      setStatus("Select an audio file.");
      return;
    }

    const derivedTitle = uploadTitle.trim() || titleFromFilename(uploadAudio.name);
    setStatus("Uploading...");

    try {
      const artwork = await buildArtworkPayload(uploadArt, uploadArtFrameTime, uploadArtPosterBlob);
      await addTrackToDb({
        title: derivedTitle,
        sub: "Uploaded",
        audio: uploadAudio,
        artPoster: artwork.artPoster,
        artVideo: artwork.artVideo
      });
      setUploadTitle("");
      setUploadAudio(null);
      setUploadArtworkFile(null);
      setStatus("Upload complete.");
      await refreshTracks();
      await notifyUploadSuccess();
    } catch {
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
      const artwork = await buildArtworkPayload(selectedArtworkFile, selectedArtFrameTime, selectedArtPosterBlob);
      await updateArtworkInDb(selectedArtworkTrackId, artwork);
      setSelectedArtworkAssetFile(null);
      setStatus("Artwork updated.");
      await refreshTracks();
    } catch {
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
      setSelectedAudioFile(null);
      setStatus("Audio replaced.");
      await refreshTracks();
    } catch {
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

            <label className="admin-upload-field grid gap-1 text-sm text-slate-300">
              Audio (.wav/.mp3)
              <input
                type="file"
                accept="audio/wav,audio/x-wav,audio/mpeg"
                onChange={(event) => setUploadAudio(event.currentTarget.files?.[0] || null)}
                className="admin-upload-input admin-upload-file rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="admin-upload-field grid gap-1 text-sm text-slate-300">
              Artwork (image, mp4, or mov, optional)
              <input
                type="file"
                accept="image/*,video/mp4,video/quicktime,.mov"
                onChange={(event) => setUploadArtworkFile(event.currentTarget.files?.[0] || null)}
                className="admin-upload-input admin-upload-file rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>
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
              <input
                type="file"
                accept="image/*,video/mp4,video/quicktime,.mov"
                onChange={(event) => setSelectedArtworkAssetFile(event.currentTarget.files?.[0] || null)}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
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
              <input
                type="file"
                accept="audio/wav,audio/x-wav,audio/mpeg"
                onChange={(event) => setSelectedAudioFile(event.currentTarget.files?.[0] || null)}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
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
    </div>
  );
}
