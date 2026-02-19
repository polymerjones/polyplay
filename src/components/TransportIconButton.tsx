import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type Props = {
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  size?: "sm" | "md";
};

export function TransportIconButton({ icon, active, onClick, ariaLabel, size = "md" }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "pc-btn pc-btn--icon pc-transport-btn",
        size === "sm" ? "pc-transport-btn--sm" : "pc-transport-btn--md",
        active && "pc-transport-btn--active"
      )}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={ariaLabel}
    >
      {icon}
    </button>
  );
}
