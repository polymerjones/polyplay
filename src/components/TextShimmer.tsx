import type { CSSProperties, ReactNode } from "react";

type TextShimmerProps = {
  children: ReactNode;
  className?: string;
  duration?: number;
};

export function TextShimmer({ children, className, duration = 1.3 }: TextShimmerProps) {
  const style = {
    "--text-shimmer-duration": `${duration}s`
  } as CSSProperties & { ["--text-shimmer-duration"]?: string };
  return (
    <span className={["text-shimmer", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </span>
  );
}
