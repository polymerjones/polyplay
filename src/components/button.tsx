import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "border-white/25 bg-[radial-gradient(circle_at_30%_24%,#855de2_0%,#6f44d1_56%,#4b2d9a_100%)] text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.24),inset_0_-10px_22px_rgba(0,0,0,0.25),0_10px_22px_rgba(34,16,70,0.35)] hover:brightness-110 active:scale-[1.02]",
  secondary:
    "border-slate-300/20 bg-slate-800/70 text-slate-100 hover:bg-slate-700/70 active:bg-slate-600/70",
  ghost:
    "border-slate-300/20 bg-transparent text-slate-100 hover:bg-slate-800/50 active:bg-slate-700/50",
  danger:
    "border-red-300/30 bg-red-500/20 text-red-100 hover:bg-red-500/30 active:bg-red-500/40"
};

export function Button({
  className,
  variant = "secondary",
  fullWidth = false,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        fullWidth && "w-full",
        className
      )}
      {...props}
    />
  );
}
