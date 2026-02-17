import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "border-sky-300/60 bg-sky-400 text-slate-950 hover:bg-sky-300 active:bg-sky-500",
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
