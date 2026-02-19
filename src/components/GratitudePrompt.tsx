import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  doNotSaveText: boolean;
  onDoNotSaveTextChange: (next: boolean) => void;
  onTyping: () => void;
  onPersist: (payload: { text: string; doNotSaveText: boolean }) => void;
  onComplete: () => void;
};

export function GratitudePrompt({
  open,
  doNotSaveText,
  onDoNotSaveTextChange,
  onTyping,
  onPersist,
  onComplete
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pulseTimeoutRef = useRef<number | null>(null);
  const [text, setText] = useState("");
  const [pulseMode, setPulseMode] = useState<"save" | "skip" | null>(null);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current !== null) {
        window.clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  const onContinue = () => {
    onPersist({ text, doNotSaveText });
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }
    setPulseMode(doNotSaveText ? "skip" : "save");
    if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = window.setTimeout(() => {
      setPulseMode(null);
      pulseTimeoutRef.current = null;
      onComplete();
    }, 290);
  };

  return (
    <section className="gratitude-modal" role="dialog" aria-modal="true" aria-label="Gratitude prompt">
      <div className={`gratitude-modal__card ${pulseMode ? `is-pulse-${pulseMode}` : ""}`.trim()}>
        <h3 className="gratitude-modal__title">What are you grateful for right now?</h3>
        <textarea
          ref={textareaRef}
          className="gratitude-modal__textarea"
          placeholder="A song, a person, a win, a tiny moment..."
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value);
            onTyping();
          }}
          rows={4}
        />
        <label className="gratitude-modal__privacy">
          <input
            type="checkbox"
            checked={doNotSaveText}
            onChange={(event) => onDoNotSaveTextChange(event.currentTarget.checked)}
          />
          <span>Do not save my text</span>
        </label>
        <button type="button" className="gratitude-modal__continue" onClick={onContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}
