import { useEffect, useRef } from "react";

type Props = {
  isPlaying: boolean;
};

export function ControlsVisualizer({ isPlaying }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      const bars = 96;
      const gap = 2;
      const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars);
      const t = performance.now() / 1000;

      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "rgba(122, 88, 214, 0.50)");
      grad.addColorStop(0.5, "rgba(106, 228, 255, 0.34)");
      grad.addColorStop(1, "rgba(255, 112, 207, 0.50)");

      for (let i = 0; i < bars; i += 1) {
        const x = i * (barWidth + gap);
        const base = 0.24 + 0.32 * Math.abs(Math.sin(i * 0.31));
        const motion = isPlaying ? 0.35 * (0.5 + 0.5 * Math.sin(i * 0.2 + t * 5.5)) : 0;
        const h = Math.max(3, (base + motion) * height);
        const y = (height - h) / 2;

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, h);
      }

      const pulse = isPlaying ? 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(t * 6)) : 0.12;
      ctx.fillStyle = `rgba(255,255,255,${pulse.toFixed(3)})`;
      ctx.fillRect(0, 0, width, 1);
    };

    const loop = () => {
      draw();
      rafId = window.requestAnimationFrame(loop);
    };

    loop();
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying]);

  return <canvas ref={canvasRef} className="controls-visualizer" aria-hidden="true" />;
}
