import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  allowAutofocus?: boolean;
  doNotSaveText: boolean;
  doNotPromptAgain: boolean;
  onDoNotSaveTextChange: (next: boolean) => void;
  onDoNotPromptAgainChange: (next: boolean) => void;
  onPersist: (payload: { text: string; doNotSaveText: boolean; doNotPromptAgain: boolean }) => void;
  onComplete: () => void;
};

export function GratitudePrompt({
  open,
  allowAutofocus = true,
  doNotSaveText,
  doNotPromptAgain,
  onDoNotSaveTextChange,
  onDoNotPromptAgainChange,
  onPersist,
  onComplete
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pulseTimeoutRef = useRef<number | null>(null);
  const keyPulseTimeoutRef = useRef<number | null>(null);
  const [text, setText] = useState("");
  const [pulseMode, setPulseMode] = useState<"save" | "skip" | null>(null);
  const [isKeyPulseActive, setIsKeyPulseActive] = useState(false);

  useEffect(() => {
    if (!open) {
      setText("");
      setPulseMode(null);
      return;
    }
    setText("");
    setPulseMode(null);
  }, [open]);

  useEffect(() => {
    if (!open || !allowAutofocus) return;
    const raf = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, allowAutofocus]);

  useEffect(() => {
    if (allowAutofocus) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (document.activeElement === textarea) textarea.blur();
  }, [allowAutofocus]);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current !== null) {
        window.clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
      if (keyPulseTimeoutRef.current !== null) {
        window.clearTimeout(keyPulseTimeoutRef.current);
        keyPulseTimeoutRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  const onContinue = () => {
    onPersist({ text, doNotSaveText, doNotPromptAgain });
    setText("");
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

  const triggerKeyPulse = () => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;
    setIsKeyPulseActive(false);
    window.requestAnimationFrame(() => setIsKeyPulseActive(true));
    if (keyPulseTimeoutRef.current !== null) window.clearTimeout(keyPulseTimeoutRef.current);
    keyPulseTimeoutRef.current = window.setTimeout(() => {
      setIsKeyPulseActive(false);
      keyPulseTimeoutRef.current = null;
    }, 170);
  };

  return (
    <section className="gratitude-modal" role="dialog" aria-modal="true" aria-label="Gratitude prompt">
      <div
        className={`gratitude-modal__card ${pulseMode ? `is-pulse-${pulseMode}` : ""} ${
          isKeyPulseActive ? "is-keypress-pulse" : ""
        }`.trim()}
      >
        <div className="gratitude-modal__clouds" aria-hidden="true" />
        <h3 className="gratitude-modal__title">What are you grateful for right now?</h3>
        <textarea
          ref={textareaRef}
          className="gratitude-modal__textarea"
          placeholder="A song, a person, a win, a tiny moment..."
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value);
            triggerKeyPulse();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.stopPropagation();
            if (event.shiftKey || event.repeat || event.nativeEvent.isComposing) return;
            event.preventDefault();
            onContinue();
          }}
          rows={4}
        />
        <div className="gratitude-modal__footer">
          <div className="gratitude-modal__choices">
            <label className="gratitude-modal__privacy">
              <input
                type="checkbox"
                checked={doNotSaveText}
                onChange={(event) => onDoNotSaveTextChange(event.currentTarget.checked)}
              />
              <span>Do not save my text</span>
            </label>
            <label className="gratitude-modal__privacy">
              <input
                type="checkbox"
                checked={doNotPromptAgain}
                onChange={(event) => onDoNotPromptAgainChange(event.currentTarget.checked)}
              />
              <span>Do not prompt me again</span>
            </label>
          </div>
          <button type="button" className="gratitude-modal__continue" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </section>
  );
}
