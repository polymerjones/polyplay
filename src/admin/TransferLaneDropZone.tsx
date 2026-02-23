import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type Props = {
  label: string;
  accept: string;
  tooltip: string;
  iconType?: "audio" | "artwork";
  hint?: string;
  selectedFileName?: string;
  disabled?: boolean;
  busy?: boolean;
  onFileSelected: (file: File | null) => void | Promise<void>;
};

export function TransferLaneDropZone({
  label,
  accept,
  tooltip,
  iconType,
  hint,
  selectedFileName,
  disabled = false,
  busy = false,
  onFileSelected
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [hasSeenTipPulse, setHasSeenTipPulse] = useState(false);

  useEffect(() => {
    try {
      setHasSeenTipPulse(localStorage.getItem(`polyplay_tip_seen_${label}`) === "1");
    } catch {
      setHasSeenTipPulse(true);
    }
  }, [label]);

  const markTipSeen = () => {
    if (hasSeenTipPulse) return;
    setHasSeenTipPulse(true);
    try {
      localStorage.setItem(`polyplay_tip_seen_${label}`, "1");
    } catch {
      // Ignore storage failures.
    }
  };

  const pick = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await onFileSelected(event.currentTarget.files?.[0] || null);
  };

  const onDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  const onDrop = async (event: DragEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0] || null;
    await onFileSelected(file);
  };

  return (
    <div className={`transfer-lane ${iconType ? `transfer-lane--${iconType}` : ""}`.trim()}>
      <div className="transfer-lane__head">
        <div className="transfer-lane__label">{label}</div>
        <button
          type="button"
          aria-label={`${label} help`}
          className={`transfer-lane__tip-btn ${!hasSeenTipPulse ? "is-tip-pulse" : ""}`.trim()}
          onMouseEnter={() => {
            markTipSeen();
            setIsTooltipOpen(true);
          }}
          onMouseLeave={() => setIsTooltipOpen(false)}
          onClick={() => {
            markTipSeen();
            setIsTooltipOpen((prev) => !prev);
          }}
        >
          ⓘ
          <span className={`transfer-lane__tooltip ${isTooltipOpen ? "is-open" : ""}`.trim()}>{tooltip}</span>
        </button>
      </div>
      {hint && <div className="transfer-lane__hint">{hint}</div>}
      <button
        type="button"
        className={`transfer-lane__zone ${isDragOver ? "is-drag-over" : ""}`.trim()}
        onClick={pick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(event) => void onDrop(event)}
        disabled={disabled || busy}
      >
        <span className="transfer-lane__icon-bg" aria-hidden="true">
          {iconType === "audio" ? (
            <svg viewBox="0 0 24 24" className="transfer-lane__icon-svg">
              <path d="M9 18V6l10-2v12" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
          ) : iconType === "artwork" ? (
            <svg viewBox="0 0 24 24" className="transfer-lane__icon-svg">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="M5 17l5-5 4 4 2-2 3 3" />
            </svg>
          ) : null}
        </span>
        <span className="transfer-lane__title">
          {busy ? "Processing..." : "Drag and drop file here or click to browse"}
        </span>
        <span className="transfer-lane__file">{selectedFileName || "No file selected"}</span>
      </button>
      <input ref={inputRef} type="file" accept={accept} onChange={(event) => void onChange(event)} className="transfer-lane__input" />
    </div>
  );
}
