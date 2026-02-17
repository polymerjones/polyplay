import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { Button } from "../components/button";

function formatTrackLabel(track: DbTrackRecord): string {
  return `${track.title?.trim() || `Track ${track.id}`} (#${track.id})`;
}

export function AdminApp() {
  const [tracks, setTracks] = useState<DbTrackRecord[]>([]);
  const [status, setStatus] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAudio, setUploadAudio] = useState<File | null>(null);
  const [uploadArt, setUploadArt] = useState<File | null>(null);

  const [selectedArtworkTrackId, setSelectedArtworkTrackId] = useState<string>("");
  const [selectedArtworkFile, setSelectedArtworkFile] = useState<File | null>(null);

  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string>("");
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  const [selectedRemoveTrackId, setSelectedRemoveTrackId] = useState<string>("");

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

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!uploadAudio) {
      setStatus("Select an audio file.");
      return;
    }

    const derivedTitle = uploadTitle.trim() || uploadAudio.name.replace(/\.[^/.]+$/, "").trim() || "Untitled";
    setStatus("Uploading...");

    try {
      await addTrackToDb({
        title: derivedTitle,
        sub: "Uploaded",
        audio: uploadAudio,
        art: uploadArt
      });
      setUploadTitle("");
      setUploadAudio(null);
      setUploadArt(null);
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
      setStatus("Select an artwork image.");
      return;
    }

    setStatus("Updating artwork...");
    try {
      await updateArtworkInDb(Number(selectedArtworkTrackId), selectedArtworkFile);
      setSelectedArtworkFile(null);
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
      await replaceAudioInDb(Number(selectedAudioTrackId), selectedAudioFile);
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
      await removeTrackFromDb(Number(selectedRemoveTrackId));
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

  const onNuke = async () => {
    if (!window.confirm("Delete all tracks from this device?")) return;

    setStatus("Clearing playlist...");
    try {
      await clearTracksInDb();
      setStatus("All tracks deleted.");
      await refreshTracks();
    } catch {
      setStatus("Nuke failed.");
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/20 bg-slate-900/85 p-4 shadow-glow backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
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
          >
            Back to Player
          </a>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onUpload} className="rounded-2xl border border-slate-300/20 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-100">Upload Track</h2>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm text-slate-300">
              Title
              <input
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.currentTarget.value)}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Audio (.wav/.mp3)
              <input
                type="file"
                accept="audio/wav,audio/x-wav,audio/mpeg"
                onChange={(event) => setUploadAudio(event.currentTarget.files?.[0] || null)}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-300">
              Artwork (optional)
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setUploadArt(event.currentTarget.files?.[0] || null)}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
            </label>

            <Button variant="primary" type="submit">
              Upload
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-300/20 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-100">Track Operations</h2>

          <div className="grid gap-3">
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
                accept="image/*"
                onChange={(event) => setSelectedArtworkFile(event.currentTarget.files?.[0] || null)}
                className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
              />
              <Button onClick={onUpdateArtwork} disabled={!hasTracks}>
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
              <Button onClick={onReplaceAudio} disabled={!hasTracks}>
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

      <section className="mt-4 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-100">Danger Zone</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void refreshTracks()}>
            Refresh Tracks
          </Button>
          <Button variant="danger" onClick={onResetAura} disabled={!hasTracks}>
            Reset Aura
          </Button>
          <Button variant="danger" onClick={onNuke} disabled={!hasTracks}>
            Nuke Playlist
          </Button>
        </div>
      </section>

      <p className="mt-4 rounded-xl border border-slate-300/20 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
        {status || "Ready."}
      </p>
    </div>
  );
}
