type Props = {
  onUploadFirstTrack: () => void;
  primaryButtonLabel?: string;
  primaryButtonClassName?: string;
  showPrimaryButton?: boolean;
  bodyText?: string;
  tipText?: string;
  onOpenTips: () => void;
  onClose: () => void;
};

export function EmptyLibraryWelcome({
  onUploadFirstTrack,
  primaryButtonLabel = "Upload your first track",
  primaryButtonClassName,
  showPrimaryButton = true,
  bodyText = "Start by uploading your first track. Once you add music, aura controls and loop tools unlock.",
  tipText,
  onOpenTips,
  onClose
}: Props) {
  return (
    <section className="empty-library-card" role="region" aria-label="Welcome">
      <button type="button" className="empty-library-card__close" aria-label="Close welcome" onClick={onClose}>
        ✕
      </button>
      <h2 className="empty-library-card__title">Hey new person! Welcome to Polyplay.</h2>
      <p className="empty-library-card__body">{bodyText}</p>
      {tipText && (
        <div className="empty-library-card__tip onboarding-tooltip" role="note">
          {tipText}
        </div>
      )}
      <div className="empty-library-card__actions">
        {showPrimaryButton && (
          <button
            type="button"
            className={`empty-library-card__primary ${primaryButtonClassName ?? ""}`.trim()}
            onClick={onUploadFirstTrack}
          >
            {primaryButtonLabel}
          </button>
        )}
        <button type="button" className="empty-library-card__secondary" onClick={onOpenTips}>
          Learn how it works
        </button>
      </div>
    </section>
  );
}
