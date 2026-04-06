import type { CustomThemeSlot, ThemeSelection } from "./themeConfig";

export type WaveformThemePalette = {
  idleFill: string;
  decorStops: [string, string, string];
  progressStops: [string, string, string];
  loopStops: [string, string, string];
  playheadGlow: string;
  playheadCore: string;
  artwork: {
    bgStart: string;
    bgMid: string;
    bgEnd: string;
    glow: string;
    barTop: string;
    barMid: string;
    barBottom: string;
  };
};

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim();
  const sized = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  if (sized.length !== 6) return [188, 132, 255];
  const parsed = Number.parseInt(sized, 16);
  if (!Number.isFinite(parsed)) return [188, 132, 255];
  return [
    (parsed >> 16) & 0xff,
    (parsed >> 8) & 0xff,
    parsed & 0xff
  ];
}

function mixRgb(a: [number, number, number], b: [number, number, number], ratio: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, ratio));
  return [
    clampByte(a[0] + (b[0] - a[0]) * t),
    clampByte(a[1] + (b[1] - a[1]) * t),
    clampByte(a[2] + (b[2] - a[2]) * t)
  ];
}

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function paletteFromThemeColors(
  colors: [string, string, string],
  options?: {
    idleMix?: number;
    idleAlpha?: number;
    glowAlpha?: number;
    progressAlpha?: number;
    loopAlpha?: number;
    coreAlpha?: number;
    bgStart?: string;
    bgMid?: string;
    bgEnd?: string;
  }
): WaveformThemePalette {
  const [a, b, c] = colors.map(hexToRgb) as [[number, number, number], [number, number, number], [number, number, number]];
  const white: [number, number, number] = [255, 255, 255];
  const idleMix = options?.idleMix ?? 0.42;
  const idleAlpha = options?.idleAlpha ?? 0.48;
  const glowAlpha = options?.glowAlpha ?? 0.34;
  const progressAlpha = options?.progressAlpha ?? 0.94;
  const loopAlpha = options?.loopAlpha ?? 0.98;
  const coreAlpha = options?.coreAlpha ?? 0.98;
  const idle = mixRgb(mixRgb(a, b, 0.5), white, idleMix);
  const loopA = mixRgb(a, white, 0.5);
  const loopB = mixRgb(b, white, 0.28);
  const loopC = mixRgb(c, white, 0.34);

  return {
    idleFill: rgba(idle, idleAlpha),
    decorStops: [rgba(a, 0.46), rgba(b, 0.42), rgba(c, 0.4)],
    progressStops: [rgba(a, progressAlpha), rgba(b, progressAlpha), rgba(c, progressAlpha)],
    loopStops: [rgba(loopA, loopAlpha), rgba(loopB, loopAlpha), rgba(loopC, loopAlpha)],
    playheadGlow: rgba(mixRgb(c, white, 0.2), glowAlpha),
    playheadCore: rgba(mixRgb(b, white, 0.38), coreAlpha),
    artwork: {
      bgStart: options?.bgStart ?? rgba(mixRgb(a, [10, 14, 23], 0.72), 1),
      bgMid: options?.bgMid ?? rgba(mixRgb(b, [18, 21, 34], 0.78), 1),
      bgEnd: options?.bgEnd ?? rgba(mixRgb(c, [7, 10, 18], 0.82), 1),
      glow: rgba(mixRgb(b, white, 0.12), 0.38),
      barTop: rgba(mixRgb(a, white, 0.56), 0.98),
      barMid: rgba(mixRgb(b, white, 0.18), 0.94),
      barBottom: rgba(mixRgb(c, [18, 18, 24], 0.12), 0.9)
    }
  };
}

function resolveThemeSelection(): ThemeSelection {
  if (typeof document === "undefined") return "dark";
  const root = document.documentElement;
  const theme = root.getAttribute("data-theme");
  const slot = root.getAttribute("data-theme-slot");
  if (theme === "light") return "light";
  if (
    theme === "custom" &&
    slot &&
    ["amber", "teal", "crimson", "merica", "mx", "rasta"].includes(slot)
  ) {
    return slot as CustomThemeSlot;
  }
  return "dark";
}

export function getWaveformThemePalette(selection = resolveThemeSelection()): WaveformThemePalette {
  switch (selection) {
    case "light":
      return paletteFromThemeColors(["#B06D82", "#F6D8E4", "#7B5BA8"], {
        idleMix: 0.24,
        idleAlpha: 0.4,
        glowAlpha: 0.28,
        bgStart: "#f6dbe8",
        bgMid: "#eec8df",
        bgEnd: "#d9e2f2"
      });
    case "amber":
      return paletteFromThemeColors(["#FFE2A7", "#F0B35B", "#A45B16"], {
        idleMix: 0.24,
        bgStart: "#2b1808",
        bgMid: "#3a2410",
        bgEnd: "#0f1118"
      });
    case "teal":
      return paletteFromThemeColors(["#CFFFF8", "#42C7C4", "#167A86"], {
        idleMix: 0.28,
        bgStart: "#0d2130",
        bgMid: "#123443",
        bgEnd: "#07131b"
      });
    case "crimson":
      return paletteFromThemeColors(["#FFE2EB", "#CF6F82", "#7B2948"], {
        idleMix: 0.24,
        bgStart: "#2a121c",
        bgMid: "#3a1826",
        bgEnd: "#0f1019"
      });
    case "merica":
      return paletteFromThemeColors(["#0A3161", "#FFFFFF", "#B31942"], {
        idleMix: 0.16,
        idleAlpha: 0.82,
        bgStart: "#081a3d",
        bgMid: "#213a6a",
        bgEnd: "#3b1426"
      });
    case "mx":
      return paletteFromThemeColors(["#006341", "#FFFFFF", "#C8102E"], {
        idleMix: 0.28,
        idleAlpha: 0.5,
        bgStart: "#06301f",
        bgMid: "#32483f",
        bgEnd: "#3a0f1a"
      });
    case "rasta":
      return paletteFromThemeColors(["#078930", "#FCDD09", "#DA121A"], {
        idleMix: 0.2,
        idleAlpha: 0.52,
        bgStart: "#101008",
        bgMid: "#2b200b",
        bgEnd: "#2e0c10"
      });
    case "dark":
    default:
      return paletteFromThemeColors(["#7DE0FF", "#B06EFF", "#FF70D6"], {
        idleMix: 0.18,
        idleAlpha: 0.55,
        bgStart: "#1f1336",
        bgMid: "#23174a",
        bgEnd: "#09101d"
      });
  }
}
