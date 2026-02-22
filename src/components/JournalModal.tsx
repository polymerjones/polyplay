import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getGratitudeBackupFilename, serializeGratitudeJson } from "../lib/backup";
import {
  createEntry,
  deleteEntry,
  exportEntriesAsText,
  listEntries,
  type GratitudeEntry,
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

const JOURNAL_BACKGROUNDS: JournalBackground[] = [
  { id: "1", src: "/clouds1.mov" },
  { id: "2", src: "/clouds2waudio.mov" }
];

const DEFAULT_JOURNAL_VERSES = [
  "Be still, and know that I am God. — Psalm 46:10",
  "I can do all things through Christ who strengthens me. — Philippians 4:13",
  "The Lord is my shepherd; I shall not want. — Psalm 23:1",
  "Let all that you do be done in love. — 1 Corinthians 16:14",
  "Rejoice in hope, be patient in tribulation, be constant in prayer. — Romans 12:12"
];

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

function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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

export function JournalModal({ open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [selectedBgId, setSelectedBgId] = useState<"1" | "2">(JOURNAL_BACKGROUNDS[0]?.id || "1");
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
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newEntryText, setNewEntryText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [miniToast, setMiniToast] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(listEntries());
    setEditingEntryId(null);
    setIsComposerOpen(false);
    setNewEntryText("");
    setDraftText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selected = pickAlternatingBackground();
    setSelectedBgId(selected.id);
    setVideoFailed(false);
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
    };
  }, []);

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
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const sparkles = useMemo(() => (reducedMotion ? [] : createSparkles(14)), [reducedMotion, selectedBgId]);
  const currentVerse = verses[verseIndex % Math.max(1, verses.length)] || DEFAULT_JOURNAL_VERSES[0];

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video || !open) return;
    video.muted = true;
    video.volume = 0;
    video.load();
    void video.play().catch(() => undefined);
  }, [selectedBgId, open]);

  if (!open) return null;

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
        className="journalVideoLayer"
        src={selectedBackground.src}
        autoPlay
        loop
        playsInline
        muted
        aria-hidden="true"
        onError={() => setVideoFailed(true)}
        onCanPlay={() => setVideoFailed(false)}
      />
      {videoFailed && <div className="journalVideoFallback" aria-hidden="true" />}
      <div className="journalScrimLayer" aria-hidden="true" />
      <div className="journalAmbientLayer" aria-hidden="true" />
      {!reducedMotion && (
        <div className="journalStreaksLayer" aria-hidden="true">
          <span className="journalStreak journalStreak--one" />
          <span className="journalStreak journalStreak--two" />
        </div>
      )}
      {!reducedMotion && (
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
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(exportEntriesAsText());
                    setMiniToast("Copied");
                  } catch {
                    setMiniToast("Export coming soon");
                  }
                }}
              >
                Export
              </button>
              <button
                type="button"
                className="journal-modal__export"
                onClick={() => {
                  try {
                    downloadTextFile(
                      serializeGratitudeJson(),
                      getGratitudeBackupFilename(),
                      "application/json;charset=utf-8"
                    );
                    setMiniToast("Backup saved");
                  } catch {
                    setMiniToast("Backup failed");
                  }
                }}
              >
                Save Backup
              </button>
              <button type="button" className="journal-modal__close" aria-label="Close Journal" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>
          <div className="journalControlRow">
            <div className="journalVerseCard">
              <strong>Verse</strong>
              <p>{currentVerse}</p>
              <button
                type="button"
                className="journalVerseBtn"
                onClick={() => setVerseIndex((prev) => (prev + 1) % Math.max(1, verses.length))}
              >
                New Verse
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

        {isComposerOpen && (
          <div className="journal-compose">
            <textarea
              ref={composerRef}
              className="journal-entry__editor"
              rows={4}
              placeholder="Write a new gratitude entry..."
              value={newEntryText}
              onChange={(event) => setNewEntryText(event.currentTarget.value)}
            />
            <div className="journal-entry__editor-actions">
              <button
                type="button"
                className="journal-entry__save"
                onClick={() => {
                  const trimmed = newEntryText.trim();
                  if (!trimmed) return;
                  createEntry(trimmed, currentVerse);
                  setEntries(listEntries());
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
              return (
                <article
                  key={entry.id}
                  className={`journal-entry ${savedEntryId === entry.id ? "is-saved" : ""} ${
                    isDeleting ? "is-deleting" : ""
                  }`.trim()}
                >
                  <div className="journal-entry__meta">
                    <span>{formatDateLabel(entry)}</span>
                    <div className="journal-entry__actions">
                      <button
                        type="button"
                        className="journal-entry__lock"
                        aria-label={isEditing ? "Lock entry" : "Unlock entry"}
                        disabled={isDeleting}
                        onClick={() => {
                          if (isEditing) {
                            setEditingEntryId(null);
                            setDraftText("");
                            return;
                          }
                          setEditingEntryId(entry.id);
                          setIsComposerOpen(false);
                          setDraftText(entry.text);
                        }}
                      >
                        {isEditing ? (
                          <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                            <path d="M17 11H7a2 2 0 0 0-2 2v6h14v-6a2 2 0 0 0-2-2Z" />
                            <path d="M9 11V8a3 3 0 0 1 6 0" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                            <path d="M17 11H7a2 2 0 0 0-2 2v6h14v-6a2 2 0 0 0-2-2Z" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="journal-entry__edit"
                        aria-label="Edit entry"
                        disabled={isDeleting}
                        onClick={() => {
                          setEditingEntryId(entry.id);
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
          {miniToast && <div className="journal-modal__toast">{miniToast}</div>}
        </div>
      </div>
    </section>
  );
}
