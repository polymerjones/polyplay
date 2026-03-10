type Props = {
  onUploadFirstTrack: () => void;
  onOpenTips: () => void;
  onClose: () => void;
};

export function EmptyLibraryWelcome({ onUploadFirstTrack, onOpenTips, onClose }: Props) {
  return (
    <section className="empty-library-card" role="region" aria-label="Welcome">
      <button type="button" className="empty-library-card__close" aria-label="Close welcome" onClick={onClose}>
        ✕
      </button>
      <h2 className="empty-library-card__title">Hey new person! Welcome to Polyplay.</h2>
      <p className="empty-library-card__body">
        Start by uploading your first track. Once you add music, aura controls and loop tools unlock.
      </p>
      <div className="empty-library-card__actions">
        <button type="button" className="empty-library-card__primary" onClick={onUploadFirstTrack}>
          Upload your first track
        </button>
        <button type="button" className="empty-library-card__secondary" onClick={onOpenTips}>
          Learn how it works
        </button>
      </div>
    </section>
  );
}
