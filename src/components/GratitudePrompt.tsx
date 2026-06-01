import { useEffect, useRef, useState, type CSSProperties } from "react";
import { fireSuccessHaptic } from "../lib/haptics";

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
  const dismissFlashTimeoutRef = useRef<number | null>(null);
  const [text, setText] = useState("");
  const [isWritingMode, setIsWritingMode] = useState(false);
  const [pulseMode, setPulseMode] = useState<"save" | "skip" | null>(null);
  const [isKeyPulseActive, setIsKeyPulseActive] = useState(false);
  const [isDismissFlashActive, setIsDismissFlashActive] = useState(false);
  const [isKeyboardOverlayActive, setIsKeyboardOverlayActive] = useState(false);
  const [keyboardOverlapPx, setKeyboardOverlapPx] = useState(0);

  useEffect(() => {
    if (!open) {
      setText("");
      setIsWritingMode(false);
      setPulseMode(null);
      setIsDismissFlashActive(false);
      setIsKeyboardOverlayActive(false);
      setKeyboardOverlapPx(0);
      return;
    }
    setText("");
    setIsWritingMode(false);
    setPulseMode(null);
    setIsDismissFlashActive(false);
    setIsKeyboardOverlayActive(false);
    setKeyboardOverlapPx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isWritingMode) return;
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    const recomputeKeyboardState = () => {
      const focusedEditable = document.activeElement === textareaRef.current;
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const keyboardLikelyOpen = focusedEditable && visibleHeight < window.innerHeight - 120;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const keyboardOverlap = keyboardLikelyOpen ? Math.max(0, window.innerHeight - visibleHeight - viewportOffsetTop) : 0;
      setIsKeyboardOverlayActive(keyboardLikelyOpen);
      setKeyboardOverlapPx(keyboardOverlap);
    };
    const onFocusChange = () => {
      window.setTimeout(recomputeKeyboardState, 0);
    };

    recomputeKeyboardState();
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    viewport?.addEventListener("resize", recomputeKeyboardState);
    viewport?.addEventListener("scroll", recomputeKeyboardState);
    window.addEventListener("resize", recomputeKeyboardState);

    return () => {
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
      viewport?.removeEventListener("resize", recomputeKeyboardState);
      viewport?.removeEventListener("scroll", recomputeKeyboardState);
      window.removeEventListener("resize", recomputeKeyboardState);
    };
  }, [open, isWritingMode]);

  useEffect(() => {
    if (!open || !isWritingMode) return;
    const raf = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, isWritingMode]);

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
      if (dismissFlashTimeoutRef.current !== null) {
        window.clearTimeout(dismissFlashTimeoutRef.current);
        dismissFlashTimeoutRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  const startWriting = () => {
    setIsWritingMode(true);
  };

  const onSkip = () => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }
    setPulseMode("skip");
    if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = window.setTimeout(() => {
      setPulseMode(null);
      pulseTimeoutRef.current = null;
      onComplete();
    }, 220);
  };

  const onContinue = () => {
    setIsWritingMode(false);
    setIsDismissFlashActive(true);
    fireSuccessHaptic();
    onPersist({ text, doNotSaveText, doNotPromptAgain });
    setText("");
    if (dismissFlashTimeoutRef.current !== null) window.clearTimeout(dismissFlashTimeoutRef.current);
    dismissFlashTimeoutRef.current = window.setTimeout(() => {
      setIsDismissFlashActive(false);
      dismissFlashTimeoutRef.current = null;
      onComplete();
    }, 150);
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
    <section
      className={`gratitude-modal ${isWritingMode ? "is-writing-mode" : "is-compact-mode"} ${
        isKeyboardOverlayActive ? "is-keyboard-active" : ""
      } ${isDismissFlashActive ? "is-dismiss-flash" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label="Gratitude prompt"
      style={{ "--gratitude-keyboard-offset": `${Math.round(keyboardOverlapPx)}px` } as CSSProperties}
    >
      <div
        className={`gratitude-modal__card ${pulseMode ? `is-pulse-${pulseMode}` : ""} ${
          isKeyPulseActive ? "is-keypress-pulse" : ""
        }`.trim()}
      >
        <div className="gratitude-modal__clouds" aria-hidden="true" />
        <h3 className="gratitude-modal__title">What are you grateful for right now?</h3>
        {isWritingMode ? (
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
        ) : (
          <button type="button" className="gratitude-modal__tap-input" onClick={startWriting}>
            Tap to write...
          </button>
        )}
        <div className="gratitude-modal__footer">
          {isWritingMode && (
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
          )}
          <button type="button" className="gratitude-modal__continue" onClick={isWritingMode ? onContinue : onSkip}>
            {isWritingMode ? "Continue" : "Skip"}
          </button>
        </div>
      </div>
    </section>
  );
}
