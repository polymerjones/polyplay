import { useEffect, useMemo, useRef, useState } from "react";
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

export function JournalModal({ open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [query, setQuery] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newEntryText, setNewEntryText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [miniToast, setMiniToast] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(listEntries());
    setEditingEntryId(null);
    setIsComposerOpen(false);
    setNewEntryText("");
    setDraftText("");
  }, [open]);

  useEffect(() => {
    if (!isComposerOpen) return;
    composerRef.current?.focus();
  }, [isComposerOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
  }, [open, onClose]);

  useEffect(() => {
    if (!miniToast) return;
    const timer = window.setTimeout(() => setMiniToast(null), 1200);
    return () => window.clearTimeout(timer);
  }, [miniToast]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => entry.text.toLowerCase().includes(q));
  }, [entries, query]);

  if (!open) return null;

  return (
    <section
      className="journal-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Gratitude Journal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="journal-modal__card" ref={cardRef}>
        <div className="journal-heaven-bg" aria-hidden="true" />
        <div className="journal-modal__clouds" aria-hidden="true" />
        <div className="journal-modal__head">
          <h3>Gratitude Journal</h3>
          <div className="journal-modal__head-actions">
            <button
              type="button"
              className="journal-modal__new"
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
            </button>
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

        <input
          className="journal-modal__search"
          type="search"
          placeholder="Search journal entries..."
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />

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
                  createEntry(trimmed);
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

        <div className="journal-modal__list">
          {filteredEntries.length ? (
            filteredEntries.map((entry) => {
              const isEditing = editingEntryId === entry.id;
              return (
                <article
                  key={entry.id}
                  className={`journal-entry ${savedEntryId === entry.id ? "is-saved" : ""}`.trim()}
                >
                  <div className="journal-entry__meta">
                    <span>{formatDateLabel(entry)}</span>
                    <div className="journal-entry__actions">
                      <button
                        type="button"
                        className="journal-entry__lock"
                        aria-label={isEditing ? "Lock entry" : "Unlock entry"}
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
                        onClick={() => {
                          if (!window.confirm("Delete this entry?")) return;
                          deleteEntry(entry.id);
                          const next = listEntries();
                          setEntries(next);
                          if (editingEntryId === entry.id) {
                            setEditingEntryId(null);
                            setDraftText("");
                          }
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
            <p className="journal-modal__empty">No entries yet. Your next session will create one ✨</p>
          )}
        </div>
        {miniToast && <div className="journal-modal__toast">{miniToast}</div>}
      </div>
    </section>
  );
}
