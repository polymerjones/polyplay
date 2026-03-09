import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getGratitudeBackupFilename, serializeGratitudeJson } from "../lib/backup";
import {
  DEFAULT_GRATITUDE_SETTINGS,
  GRATITUDE_ENTRIES_KEY,
  createEntry,
  deleteEntry,
  listEntries,
  saveGratitudeSettings,
  type GratitudeEntry,
  type GratitudeSettings,
  updateEntry
} from "../lib/gratitude";

type Props = {
  open: boolean;
  onClose: () => void;
};

type JournalBackground = {
  id: "1" | "2";
  src: string;
};
type Sparkle = {
  id: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
};

const JOURNAL_BG_TOGGLE_KEY = "polyplay_journalBgToggle_v1";
const JOURNAL_VERSE_INDEX_KEY = "polyplay_journalVerseIndex_v1";
const JOURNAL_LOOP_START_SEC = 0.08;
const JOURNAL_LOOP_END_GUARD_SEC = 0.06;

const JOURNAL_BACKGROUNDS: JournalBackground[] = [
  { id: "1", src: "/clouds1.mov" },
  { id: "2", src: "/clouds2waudio.mov?v=20260307" }
];

const DEFAULT_JOURNAL_VERSES = [
  "Be still, and know that I am God. — Psalm 46:10",
  "I can do all things through Christ who strengthens me. — Philippians 4:13",
  "The Lord is my shepherd; I shall not want. — Psalm 23:1",
  "Let all that you do be done in love. — 1 Corinthians 16:14",
  "Rejoice in hope, be patient in tribulation, be constant in prayer. — Romans 12:12"
];

type GratitudeBackupImportPayload = {
  settings: GratitudeSettings;
  entries: GratitudeEntry[];
};

function pickAlternatingBackground(): JournalBackground {
  let nextId: "1" | "2" = "1";
  try {
    const last = localStorage.getItem(JOURNAL_BG_TOGGLE_KEY);
    nextId = last === "1" ? "2" : "1";
    localStorage.setItem(JOURNAL_BG_TOGGLE_KEY, nextId);
  } catch {
    nextId = "1";
  }
  return JOURNAL_BACKGROUNDS.find((bg) => bg.id === nextId) || JOURNAL_BACKGROUNDS[0];
}

function formatDateLabel(entry: GratitudeEntry): string {
  const base = entry.updatedAt || entry.createdAt;
  const date = new Date(base);
  if (!Number.isFinite(date.getTime())) return base;
  return date.toLocaleString();
}

function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function saveTextWithBestEffort(content: string, filename: string, mime: string): Promise<"shared" | "save-dialog" | "downloaded"> {
  const blob = new Blob([content], { type: mime });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
  };
  if (typeof nav.share === "function" && typeof File !== "undefined") {
    try {
      const file = new File([blob], filename, { type: mime });
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({ title: filename, files: [file] });
        return "shared";
      }
    } catch {
      // Share canceled/unsupported in current context; continue with fallback.
    }
  }

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
        types: [{ description: "Gratitude Backup", accept: { "application/json": [".json"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "save-dialog";
    } catch {
      // User canceled or picker unsupported in this context; continue with download fallback.
    }
  }

  downloadBlobFile(blob, filename);
  return "downloaded";
}

function shouldUseLightJournalFx(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  const isCoarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = typeof navigator !== "undefined" && "connection" in navigator
    ? Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    : false;
  return isCoarse || reduced || saveData;
}

function createSparkles(count: number): Sparkle[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `sparkle-${index}-${Math.random().toString(36).slice(2, 7)}`,
    left: Math.round(Math.random() * 100),
    top: Math.round(Math.random() * 100),
    size: Number((1.8 + Math.random() * 3.2).toFixed(2)),
    delay: Number((Math.random() * 8).toFixed(2)),
    duration: Number((8 + Math.random() * 8).toFixed(2)),
    drift: Number((8 + Math.random() * 20).toFixed(2))
  }));
}

function normalizeImportedGratitudeSettings(value: unknown): GratitudeSettings {
  if (!value || typeof value !== "object") return DEFAULT_GRATITUDE_SETTINGS;
  const row = value as Partial<GratitudeSettings>;
  const frequency =
    row.frequency === "daily" || row.frequency === "weekly" || row.frequency === "launch" || row.frequency === "off"
      ? row.frequency
      : DEFAULT_GRATITUDE_SETTINGS.frequency;
  return {
    enabled: row.enabled !== false,
    frequency,
    doNotSaveText: Boolean(row.doNotSaveText),
    doNotPromptAgain: Boolean(row.doNotPromptAgain)
  };
}

function normalizeImportedGratitudeEntries(value: unknown): GratitudeEntry[] {
  if (!Array.isArray(value)) return [];
  const normalized: GratitudeEntry[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index];
    if (!row || typeof row !== "object") continue;
    const entry = row as Partial<GratitudeEntry>;
    if (typeof entry.text !== "string") continue;
    const trimmed = entry.text.trim();
    if (!trimmed) continue;
    const createdAt = typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString();
    const id = typeof entry.id === "string" && entry.id ? entry.id : `imported-${createdAt}-${index}`;
    normalized.push({
      id,
      text: trimmed,
      verse: typeof entry.verse === "string" && entry.verse.trim() ? entry.verse.trim() : undefined,
      createdAt,
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : undefined,
      privateMode: Boolean(entry.privateMode)
    });
  }
  return normalized;
}

function parseGratitudeBackupImportText(content: string): GratitudeBackupImportPayload {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) {
    return {
      settings: DEFAULT_GRATITUDE_SETTINGS,
      entries: normalizeImportedGratitudeEntries(parsed)
    };
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup file.");
  }
  const payload = parsed as {
    kind?: unknown;
    settings?: unknown;
    entries?: unknown;
  };
  if (typeof payload.kind === "string" && payload.kind !== "polyplay-gratitude") {
    throw new Error("Unsupported backup file type.");
  }
  return {
    settings: normalizeImportedGratitudeSettings(payload.settings),
    entries: normalizeImportedGratitudeEntries(payload.entries)
  };
}

export function JournalModal({ open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [selectedBgId, setSelectedBgId] = useState<"1" | "2">(JOURNAL_BACKGROUNDS[0]?.id || "1");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [verses, setVerses] = useState<string[]>(DEFAULT_JOURNAL_VERSES);
  const [verseIndex, setVerseIndex] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(JOURNAL_VERSE_INDEX_KEY);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed % DEFAULT_JOURNAL_VERSES.length;
    } catch {
      // Ignore localStorage failures.
    }
    return 0;
  });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newEntryText, setNewEntryText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [miniToast, setMiniToast] = useState<string | null>(null);
  const [verseFxActive, setVerseFxActive] = useState(false);
  const [verseFxBurstKey, setVerseFxBurstKey] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteTimerRef = useRef<number | null>(null);
  const verseFxTimerRef = useRef<number | null>(null);
  const verseFxRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(listEntries());
    setEditingEntryId(null);
    setExpandedEntryId(null);
    setIsComposerOpen(false);
    setNewEntryText("");
    setDraftText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selected = pickAlternatingBackground();
    setSelectedBgId(selected.id);
    setIsVideoReady(false);
    setVideoFailed(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previous = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflowY = "hidden";
    return () => {
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.body.style.overflowY = previous.overflowY;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!isComposerOpen) return;
    composerRef.current?.focus();
  }, [isComposerOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/content/journal-verses.json", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) return;
        const next = payload
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        if (!next.length || cancelled) return;
        setVerses(next);
      } catch {
        // Keep fallback verses.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVerseIndex((prev) => {
      const safeLength = Math.max(1, verses.length);
      return prev % safeLength;
    });
  }, [verses]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isComposerOpen) {
          event.preventDefault();
          setNewEntryText("");
          setIsComposerOpen(false);
          return;
        }
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusables = card.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      const visible = Array.from(focusables).filter((node) => !node.hasAttribute("disabled"));
      if (!visible.length) return;
      const first = visible[0];
      const last = visible[visible.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isComposerOpen]);

  useEffect(() => {
    if (!miniToast) return;
    const timer = window.setTimeout(() => setMiniToast(null), 1200);
    return () => window.clearTimeout(timer);
  }, [miniToast]);

  useEffect(() => {
    try {
      localStorage.setItem(JOURNAL_VERSE_INDEX_KEY, String(verseIndex));
    } catch {
      // Ignore storage failures.
    }
  }, [verseIndex]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current !== null) {
        window.clearTimeout(deleteTimerRef.current);
      }
      if (verseFxTimerRef.current !== null) {
        window.clearTimeout(verseFxTimerRef.current);
      }
      if (verseFxRafRef.current !== null) {
        window.cancelAnimationFrame(verseFxRafRef.current);
      }
    };
  }, []);

  const triggerVerseFeedback = () => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;
    }
    if (verseFxRafRef.current !== null) {
      window.cancelAnimationFrame(verseFxRafRef.current);
    }
    setVerseFxActive(false);
    verseFxRafRef.current = window.requestAnimationFrame(() => {
      setVerseFxActive(true);
      setVerseFxBurstKey((prev) => prev + 1);
    });
    if (verseFxTimerRef.current !== null) {
      window.clearTimeout(verseFxTimerRef.current);
    }
    verseFxTimerRef.current = window.setTimeout(() => {
      setVerseFxActive(false);
      verseFxTimerRef.current = null;
    }, 520);
  };

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => entry.text.toLowerCase().includes(q));
  }, [entries, query]);

  const selectedBackground = useMemo(
    () => JOURNAL_BACKGROUNDS.find((bg) => bg.id === selectedBgId) || JOURNAL_BACKGROUNDS[0],
    [selectedBgId]
  );

  const isWritingActive = isComposerOpen || editingEntryId !== null;
  const lightFxMode = useMemo(() => shouldUseLightJournalFx(), []);
  const sparkles = useMemo(() => (lightFxMode ? [] : createSparkles(10)), [lightFxMode, selectedBgId]);
  const currentVerse = verses[verseIndex % Math.max(1, verses.length)] || DEFAULT_JOURNAL_VERSES[0];

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video || !open) return;
    video.muted = true;
    video.volume = 0;
    video.load();
    const jumpToSafeStart = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return;
      const safeStart = Math.min(JOURNAL_LOOP_START_SEC, Math.max(0, duration - 0.12));
      if (video.currentTime < safeStart) {
        video.currentTime = safeStart;
      }
    };
    const onTimeUpdate = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return;
      if (video.currentTime >= duration - JOURNAL_LOOP_END_GUARD_SEC) {
        const safeStart = Math.min(JOURNAL_LOOP_START_SEC, Math.max(0, duration - 0.12));
        video.currentTime = safeStart;
      }
    };
    const onEnded = () => {
      jumpToSafeStart();
      void video.play().catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
    };
    video.addEventListener("loadedmetadata", jumpToSafeStart);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setIsVideoReady(true);
    }
    void video.play().catch(() => undefined);
    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", jumpToSafeStart);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [selectedBgId, open]);

  if (!open) return null;

  const canSaveNewEntry = newEntryText.trim().length > 0;

  return (
    <section
      className="journal-modal journalScene"
      role="dialog"
      aria-modal="true"
      aria-label="Gratitude Journal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <video
        key={selectedBackground.id}
        ref={backgroundVideoRef}
        className={`journalVideoLayer ${isVideoReady && !videoFailed ? "is-ready" : ""}`.trim()}
        src={selectedBackground.src}
        preload="auto"
        autoPlay
        loop
        playsInline
        muted
        aria-hidden="true"
        onError={() => {
          setVideoFailed(true);
          setIsVideoReady(false);
        }}
        onLoadedData={() => {
          setVideoFailed(false);
          setIsVideoReady(true);
        }}
        onCanPlay={() => {
          setVideoFailed(false);
          setIsVideoReady(true);
        }}
      />
      <div className={`journalVideoFallback ${isVideoReady && !videoFailed ? "is-hidden" : ""}`.trim()} aria-hidden="true" />
      <div className="journalScrimLayer" aria-hidden="true" />
      <div className={`journalAmbientLayer ${lightFxMode ? "is-light-fx" : ""}`.trim()} aria-hidden="true" />
      {!lightFxMode && (
        <div className="journalStreaksLayer" aria-hidden="true">
          <span className="journalStreak journalStreak--one" />
          <span className="journalStreak journalStreak--two" />
        </div>
      )}
      {!lightFxMode && (
        <div className="journalSparklesLayer" aria-hidden="true">
          {sparkles.map((sparkle) => (
            <span
              key={sparkle.id}
              className="journalSparkle"
              style={
                {
                  "--left": `${sparkle.left}%`,
                  "--top": `${sparkle.top}%`,
                  "--size": `${sparkle.size}px`,
                  "--delay": `${sparkle.delay}s`,
                  "--duration": `${sparkle.duration}s`,
                  "--drift": `${sparkle.drift}px`
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div
        className="journalUI"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className={`journal-modal__card journalGlassPanel ${isWritingActive ? "is-writing" : ""}`.trim()} ref={cardRef}>
          <div className="journalRim" aria-hidden="true" />
          <div className="journal-modal__head">
            <h3>Gratitude Journal</h3>
            <div className="journal-modal__head-actions">
              <button
                type="button"
                className="journal-modal__export"
                onClick={() => {
                  void (async () => {
                    try {
                      const saveMode = await saveTextWithBestEffort(
                        serializeGratitudeJson(),
                        getGratitudeBackupFilename(),
                        "application/json;charset=utf-8"
                      );
                      setMiniToast(saveMode === "shared" ? "Backup ready to share" : "Backup saved");
                    } catch {
                      setMiniToast("Backup failed");
                    }
                  })();
                }}
              >
                Save Backup
              </button>
              <button
                type="button"
                className="journal-modal__export"
                onClick={() => importInputRef.current?.click()}
              >
                Import Backup
              </button>
              <button type="button" className="journal-modal__close" aria-label="Close Journal" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              void (async () => {
                try {
                  const content = await file.text();
                  const payload = parseGratitudeBackupImportText(content);
                  if (payload.entries.length === 0) {
                    throw new Error("Backup has no entries.");
                  }
                  const hasExisting = entries.length > 0;
                  if (hasExisting) {
                    const confirmed = window.confirm(
                      "Import Backup will replace your current Gratitude Journal entries on this device. Continue?"
                    );
                    if (!confirmed) return;
                  }
                  saveGratitudeSettings(payload.settings);
                  localStorage.setItem(GRATITUDE_ENTRIES_KEY, JSON.stringify(payload.entries));
                  setEntries(listEntries());
                  setMiniToast(`Backup imported (${payload.entries.length} entries)`);
                } catch {
                  setMiniToast("Import failed");
                }
              })();
            }}
          />
          <div className="journalControlRow">
            <div className={`journalVerseCard ${verseFxActive ? "is-verse-flash" : ""}`.trim()}>
              <strong>Verse</strong>
              <p>{currentVerse}</p>
              {verseFxActive && (
                <div key={verseFxBurstKey} className="journalVerseBurst" aria-hidden="true">
                  <span className="journalVerseSpark journalVerseSpark--1" />
                  <span className="journalVerseSpark journalVerseSpark--2" />
                  <span className="journalVerseSpark journalVerseSpark--3" />
                  <span className="journalVerseSpark journalVerseSpark--4" />
                </div>
              )}
              <button
                type="button"
                className="journalVerseBtn"
                aria-label="Next verse"
                onClick={() => {
                  setVerseIndex((prev) => (prev + 1) % Math.max(1, verses.length));
                  triggerVerseFeedback();
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.4 5.4l2.2 2.2M16.4 16.4l2.2 2.2M18.6 5.4l-2.2 2.2M7.6 16.4l-2.2 2.2" />
                </svg>
                <span>Verse</span>
              </button>
            </div>
            <div className="journalPrimaryActionWrap">
              <button
                type="button"
                className="journal-modal__new journal-modal__new--primary"
                aria-label="New Journal Entry"
                onClick={() => {
                  setIsComposerOpen(true);
                  setEditingEntryId(null);
                }}
              >
                <svg viewBox="0 0 24 24" className="journal-modal__icon-svg">
                  <path d="M4 20l4-1 9-9-3-3-9 9-1 4Z" />
                  <path d="M13 6l3 3M3 21h18" />
                </svg>
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="journal-modal__content">
            {isComposerOpen && (
              <div className="journal-compose">
                <textarea
                  ref={composerRef}
                  className="journal-entry__editor"
                  rows={4}
                  placeholder="Write a new gratitude entry..."
                  value={newEntryText}
                  onChange={(event) => setNewEntryText(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.stopPropagation();
                  }}
                />
                <div className="journal-entry__editor-actions">
                  <button
                    type="button"
                    className="journal-entry__save"
                    disabled={!canSaveNewEntry}
                    onClick={() => {
                      const trimmed = newEntryText.trim();
                      if (!trimmed) return;
                      createEntry(trimmed, currentVerse);
                      setEntries(listEntries());
                      setExpandedEntryId(null);
                      setNewEntryText("");
                      setIsComposerOpen(false);
                      setMiniToast("Saved");
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                      <path d="M5 12.5 9.2 17 19 7.5" />
                    </svg>
                    Save
                  </button>
                  <button
                    type="button"
                    className="journal-entry__cancel"
                    onClick={() => {
                      setNewEntryText("");
                      setIsComposerOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                      <path d="M6 6 18 18M18 6 6 18" />
                    </svg>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="journalSearchBarWrap journalSearchBarWrap--list">
              <span className="journalSearchIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16 20 20" />
                </svg>
              </span>
              <input
                className="journalSearchInput"
                type="search"
                placeholder="Search journal entries..."
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {query.trim().length > 0 && (
                <button type="button" className="journalSearchClear" aria-label="Clear search" onClick={() => setQuery("")}>
                  ×
                </button>
              )}
            </div>

            <div className="journal-modal__list">
              {filteredEntries.length ? (
                filteredEntries.map((entry) => {
                  const isEditing = editingEntryId === entry.id;
                  const isDeleting = deletingEntryId === entry.id;
                  const isExpanded = isEditing || expandedEntryId === entry.id;
                  return (
                    <article
                      key={entry.id}
                      className={`journal-entry ${isExpanded ? "is-expanded" : ""} ${isEditing ? "is-editing" : ""} ${
                        savedEntryId === entry.id ? "is-saved" : ""
                      } ${isDeleting ? "is-deleting" : ""}`.trim()}
                      aria-expanded={isExpanded}
                      onClick={(event) => {
                        const target = event.target as HTMLElement | null;
                        if (target?.closest("button, input, textarea, select, a, label")) return;
                        if (isEditing) return;
                        setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id));
                      }}
                    >
                  <div className="journal-entry__meta">
                    <span>{formatDateLabel(entry)}</span>
                    <div className="journal-entry__actions">
                      <button
                        type="button"
                        className="journal-entry__edit"
                        aria-label="Edit entry"
                        disabled={isDeleting}
                        onClick={() => {
                          setEditingEntryId(entry.id);
                          setExpandedEntryId(entry.id);
                          setIsComposerOpen(false);
                          setDraftText(entry.text);
                        }}
                      >
                        <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                          <path d="m4 20 4-1 9-9-3-3-9 9-1 4Z" />
                          <path d="m13 6 3 3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="journal-entry__delete"
                        aria-label="Delete entry"
                        disabled={isDeleting}
                        onClick={() => {
                          if (isDeleting) return;
                          const previousEntries = entries.slice();
                          setDeletingEntryId(entry.id);
                          if (editingEntryId === entry.id) {
                            setEditingEntryId(null);
                            setDraftText("");
                          }
                          if (expandedEntryId === entry.id) setExpandedEntryId(null);
                          if (deleteTimerRef.current !== null) window.clearTimeout(deleteTimerRef.current);
                          deleteTimerRef.current = window.setTimeout(() => {
                            try {
                              deleteEntry(entry.id);
                              setEntries(listEntries());
                              setMiniToast("Deleted");
                            } catch {
                              setEntries(previousEntries);
                              setMiniToast("Delete failed");
                            } finally {
                              setDeletingEntryId((prev) => (prev === entry.id ? null : prev));
                            }
                            deleteTimerRef.current = null;
                          }, 220);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <>
                      <textarea
                        className="journal-entry__editor"
                        value={draftText}
                        onChange={(event) => setDraftText(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.stopPropagation();
                        }}
                        rows={4}
                      />
                      <div className="journal-entry__editor-actions">
                        <button
                          type="button"
                          className="journal-entry__save"
                          onClick={() => {
                            const trimmed = draftText.trim();
                            if (!trimmed) return;
                            updateEntry(entry.id, trimmed);
                            const next = listEntries();
                            setEntries(next);
                            setSavedEntryId(entry.id);
                            window.setTimeout(() => setSavedEntryId(null), 420);
                            setEditingEntryId(null);
                            setDraftText("");
                          }}
                          disabled={draftText.trim().length === 0}
                        >
                          <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                            <path d="M5 12.5 9.2 17 19 7.5" />
                          </svg>
                          Save
                        </button>
                        <button
                          type="button"
                          className="journal-entry__cancel"
                          onClick={() => {
                            setEditingEntryId(null);
                            setDraftText("");
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                            <path d="M6 6 18 18M18 6 6 18" />
                          </svg>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="journal-entry__text">{entry.text}</p>
                  )}
                  </article>
                  );
                })
              ) : (
                <div className="journal-modal__emptyHint">
                  <p className="journal-modal__empty">No entries yet. Tap New.</p>
                </div>
              )}
            </div>
          </div>
          {miniToast && <div className="journal-modal__toast">{miniToast}</div>}
        </div>
      </div>
    </section>
  );
}
