import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type Props = {
  label: string;
  accept: string;
  tooltip: string;
  iconType?: "audio" | "artwork";
  compact?: boolean;
  hint?: string;
  selectedFileName?: string;
  disabled?: boolean;
  busy?: boolean;
  armed?: boolean;
  onClearRequest?: () => void | Promise<void>;
  clearLabel?: string;
  onPickRequest?: (fallbackPick: () => void) => void | Promise<void>;
  onFileSelected: (file: File | null) => void | Promise<void>;
};

export function TransferLaneDropZone({
  label,
  accept,
  tooltip,
  iconType,
  compact = false,
  hint,
  selectedFileName,
  disabled = false,
  busy = false,
  armed,
  onClearRequest,
  clearLabel,
  onPickRequest,
  onFileSelected
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [hasSeenTipPulse, setHasSeenTipPulse] = useState(false);
  const isArmed = Boolean(armed ?? selectedFileName);
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
    if (onPickRequest) {
      void onPickRequest(() => inputRef.current?.click());
      return;
    }
    inputRef.current?.click();
  };

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await onFileSelected(event.currentTarget.files?.[0] || null);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || busy) return;
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (disabled || busy) return;
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0] || null;
    await onFileSelected(file);
  };

  return (
    <div className={`transfer-lane ${iconType ? `transfer-lane--${iconType}` : ""} ${compact ? "transfer-lane--compact" : ""}`.trim()}>
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
      <div
        role="button"
        tabIndex={disabled || busy ? -1 : 0}
        className={`transfer-lane__zone ${isDragOver ? "is-drag-over" : ""} ${isArmed ? "is-armed" : ""}`.trim()}
        onClick={pick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(event) => void onDrop(event)}
        onKeyDown={(event) => {
          if (disabled || busy) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pick();
          }
        }}
        aria-disabled={disabled || busy}
      >
        {isArmed && onClearRequest && !disabled && !busy && (
          <button
            type="button"
            className="transfer-lane__clear-btn"
            aria-label={clearLabel || `Clear ${label}`}
            title={clearLabel || `Clear ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              void onClearRequest();
            }}
          >
            ✕
          </button>
        )}
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
        <span className="transfer-lane__policy">
          Supports audio, image, and video artwork.
          <br />
          Import media you own or have permission to use.
          {iconType === "artwork" && (
            <>
              <br />
              If you skip artwork, PolyPlay generates auto art.
            </>
          )}
        </span>
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={(event) => void onChange(event)} className="transfer-lane__input" />
    </div>
  );
}
