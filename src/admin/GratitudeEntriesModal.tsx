import type { GratitudeEntry } from "../lib/gratitude";

type Props = {
  open: boolean;
  entry: GratitudeEntry | null;
  onClose: () => void;
};

export function GratitudeEntriesModal({ open, entry, onClose }: Props) {
  if (!open || !entry) return null;

  const localDate = new Date(entry.createdAt);
  const dateLabel = Number.isFinite(localDate.getTime())
    ? `${localDate.toLocaleDateString()} ${localDate.toLocaleTimeString()}`
    : entry.createdAt;

  return (
    <section className="gratitude-entries-modal" role="dialog" aria-modal="true" aria-label="Gratitude entry">
      <div className="gratitude-entries-modal__card">
        <div className="gratitude-entries-modal__head">
          <h3>Gratitude Entry</h3>
          <button type="button" className="gratitude-entries-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="gratitude-entries-modal__date">{dateLabel}</p>
        <p className="gratitude-entries-modal__body">{entry.text}</p>
      </div>
    </section>
  );
}
