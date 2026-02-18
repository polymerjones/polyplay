import { useEffect } from "react";
import type { QuickTip } from "../content/quickTips";

type Props = {
  open: boolean;
  onClose: () => void;
  tips: QuickTip[];
};

export function QuickTipsModal({ open, onClose, tips }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <section
      className="quick-tips-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Quick tips"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="quick-tips-modal__card">
        <div className="quick-tips-modal__head">
          <h3>Quick Tips</h3>
          <button type="button" className="quick-tips-modal__x" aria-label="Close quick tips" onClick={onClose}>
            ✕
          </button>
        </div>
        <ul>
          {tips.map((tip) => (
            <li key={tip.id}>{tip.text}</li>
          ))}
        </ul>
        <button type="button" className="quick-tips-modal__close" onClick={onClose}>
          Got it
        </button>
      </div>
    </section>
  );
}
