import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { MouseEvent } from "react";

type Props = {
  icon: ReactNode;
  active: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
};

export function TransportIconButton({ icon, active, onClick, ariaLabel, size = "md", className }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "pc-btn pc-btn--icon pc-transport-btn",
        size === "sm" ? "pc-transport-btn--sm" : "pc-transport-btn--md",
        active && "pc-transport-btn--active",
        className
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
