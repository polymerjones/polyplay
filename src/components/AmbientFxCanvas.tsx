import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  init,
  readThemeTokensFromCss,
  type AmbientFxMode,
  type AmbientFxQuality,
  type EngineOptions
} from "../fx/ambientFxEngine";

export type AmbientFxCanvasHandle = {
  onTap: (x: number, y: number) => void;
  onPointerMove: (x: number, y: number) => void;
  clear: () => void;
};

type Props = {
  allowed: boolean;
  mode: AmbientFxMode;
  quality: AmbientFxQuality;
  reducedMotion: boolean;
  auraRgb?: string | null;
  themeRefreshKey?: string;
};

function parseAuraRgb(input: string | null | undefined): [number, number, number] | null {
  if (!input) return null;
  const parts = input.split(",").map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return [
    Math.max(0, Math.min(255, Math.round(parts[0] || 0))),
    Math.max(0, Math.min(255, Math.round(parts[1] || 0))),
    Math.max(0, Math.min(255, Math.round(parts[2] || 0)))
  ];
}

function readResolvedThemeTokens(auraRgb: string | null | undefined) {
  const auraTuple = parseAuraRgb(auraRgb);
  return {
    ...readThemeTokensFromCss(),
    ...(auraTuple ? { auraRgb: auraTuple } : {})
  };
}

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

export const AmbientFxCanvas = forwardRef<AmbientFxCanvasHandle, Props>(function AmbientFxCanvas(
  { allowed, mode, quality, reducedMotion, auraRgb, themeRefreshKey = "" },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const options: EngineOptions = {
      mode,
      quality,
      reducedMotion,
      isMobile: isCoarsePointer()
    };

    const engine = init(canvas, options);
    engine.setThemeTokens(readResolvedThemeTokens(auraRgb));
    engineRef.current = engine;

    const onResize = () => {
      engine.resize();
      engine.setThemeTokens(readResolvedThemeTokens(auraRgb));
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setThemeTokens(readResolvedThemeTokens(auraRgb));
  }, [mode, quality, reducedMotion, auraRgb, themeRefreshKey]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (allowed && (typeof document === "undefined" || !document.hidden)) {
      engine.start();
      return;
    }
    engine.stop();
    engine.clear();
  }, [allowed]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const onVisibilityChange = () => {
      if (!allowed) return;
      if (document.hidden) {
        engine.stop();
        return;
      }
      engine.start();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [allowed]);

  useImperativeHandle(
    ref,
    () => ({
      onTap: (x: number, y: number) => engineRef.current?.onTap(x, y),
      onPointerMove: (x: number, y: number) => engineRef.current?.onPointerMove(x, y),
      clear: () => engineRef.current?.clear()
    }),
    []
  );

  return <canvas ref={canvasRef} className="ambient-fx-canvas" aria-hidden="true" />;
});
