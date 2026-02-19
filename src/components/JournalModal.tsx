import { useEffect, useMemo, useRef, useState } from "react";
import {
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

export function JournalModal({ open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [query, setQuery] = useState("");
  const [unlockedEntryId, setUnlockedEntryId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [miniToast, setMiniToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(listEntries());
    setUnlockedEntryId(null);
    setDraftText("");
  }, [open]);

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
        <div className="journal-modal__clouds" aria-hidden="true" />
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

        <div className="journal-modal__list">
          {filteredEntries.length ? (
            filteredEntries.map((entry) => {
              const isUnlocked = unlockedEntryId === entry.id;
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
                        aria-label={isUnlocked ? "Lock entry" : "Unlock entry"}
                        onClick={() => {
                          if (isUnlocked) {
                            setUnlockedEntryId(null);
                            setDraftText("");
                            return;
                          }
                          setUnlockedEntryId(entry.id);
                          setDraftText(entry.text);
                        }}
                      >
                        {isUnlocked ? "🔓" : "🔒"}
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
                          if (unlockedEntryId === entry.id) {
                            setUnlockedEntryId(null);
                            setDraftText("");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isUnlocked ? (
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
                            setUnlockedEntryId(null);
                            setDraftText("");
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="journal-entry__cancel"
                          onClick={() => {
                            setUnlockedEntryId(null);
                            setDraftText("");
                          }}
                        >
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
            <p className="journal-modal__empty">No entries yet. Your next session will create one.</p>
          )}
        </div>
        {miniToast && <div className="journal-modal__toast">{miniToast}</div>}
      </div>
    </section>
  );
}
