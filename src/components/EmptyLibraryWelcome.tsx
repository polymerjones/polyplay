import type { MouseEvent } from "react";

type WelcomePhase = "pre-tour" | "create-playlist" | "upload-track";

type Props = {
  phase: WelcomePhase;
  onStartQuickTour: () => void;
  onUploadFirstTrack: () => void;
  onPrimaryButtonClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  primaryButtonLabel?: string;
  primaryButtonClassName?: string;
  bodyText?: string;
  onClose: () => void;
};

export function EmptyLibraryWelcome({
  phase,
  onStartQuickTour,
  onUploadFirstTrack,
  onPrimaryButtonClick,
  primaryButtonLabel = "Import your first track",
  primaryButtonClassName,
  bodyText = "Tap Import, choose your first audio file, then review the details and bring it into PolyPlay.",
  onClose
}: Props) {
  const showPrimaryButton = phase === "pre-tour" || phase === "upload-track";
  const cardClassName = `empty-library-card empty-library-card--${phase}`.trim();

  return (
    <section className={cardClassName} role="region" aria-label="Welcome">
      <button type="button" className="empty-library-card__close" aria-label="Close welcome" onClick={onClose}>
        ✕
      </button>
      <h2 className="empty-library-card__title">Hey new person! Welcome to PolyPlay.</h2>
      <p className="empty-library-card__body">{bodyText}</p>
      {showPrimaryButton && (
        <div className="empty-library-card__actions">
          <button
            type="button"
            className={`empty-library-card__primary guided-cta onboarding-action ${primaryButtonClassName ?? ""}`.trim()}
            onClick={(event) => {
              onPrimaryButtonClick?.(event);
              if (phase === "pre-tour") {
                onStartQuickTour();
                return;
              }
              onUploadFirstTrack();
            }}
          >
            {primaryButtonLabel}
          </button>
        </div>
      )}
    </section>
  );
}
