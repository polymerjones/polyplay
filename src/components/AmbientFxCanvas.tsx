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
};

function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

export const AmbientFxCanvas = forwardRef<AmbientFxCanvasHandle, Props>(function AmbientFxCanvas(
  { allowed, mode, quality, reducedMotion },
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
    engine.setThemeTokens(readThemeTokensFromCss());
    engineRef.current = engine;

    const onResize = () => {
      engine.resize();
      engine.setThemeTokens(readThemeTokensFromCss());
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
    engine.setThemeTokens(readThemeTokensFromCss());
  }, [mode, quality, reducedMotion]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (allowed) {
      engine.start();
      return;
    }
    engine.stop();
    engine.clear();
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
