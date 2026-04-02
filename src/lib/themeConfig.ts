export type ThemeMode = "light" | "dark" | "custom";

export const CUSTOM_THEME_DEFINITIONS = {
  amber: {
    label: "Amber",
    aura: "#f0b35b"
  },
  teal: {
    label: "Teal",
    aura: "#42c7c4"
  },
  crimson: {
    label: "Crimson",
    aura: "#cf6f82"
  },
  merica: {
    label: "Merica",
    aura: "#B31942"
  },
  mx: {
    label: "MX",
    aura: "#FFFFFF"
  },
  rasta: {
    label: "Rasta",
    aura: "#FCDD09"
  }
} as const;

export type CustomThemeSlot = keyof typeof CUSTOM_THEME_DEFINITIONS;
export type ThemeSelection = "dark" | "light" | CustomThemeSlot;

export const CUSTOM_THEME_ORDER: CustomThemeSlot[] = [
  "amber",
  "teal",
  "crimson",
  "merica",
  "mx",
  "rasta"
];

export const THEME_SELECTION_ORDER: ThemeSelection[] = ["dark", "light", ...CUSTOM_THEME_ORDER];

export const THEME_SELECTION_LABELS: Record<ThemeSelection, string> = {
  dark: "Default (Dark)",
  light: "Light",
  amber: CUSTOM_THEME_DEFINITIONS.amber.label,
  teal: CUSTOM_THEME_DEFINITIONS.teal.label,
  crimson: CUSTOM_THEME_DEFINITIONS.crimson.label,
  merica: CUSTOM_THEME_DEFINITIONS.merica.label,
  mx: CUSTOM_THEME_DEFINITIONS.mx.label,
  rasta: CUSTOM_THEME_DEFINITIONS.rasta.label
};

export const THEME_PACK_AURA_COLORS: Record<CustomThemeSlot, string> = {
  amber: CUSTOM_THEME_DEFINITIONS.amber.aura,
  teal: CUSTOM_THEME_DEFINITIONS.teal.aura,
  crimson: CUSTOM_THEME_DEFINITIONS.crimson.aura,
  merica: CUSTOM_THEME_DEFINITIONS.merica.aura,
  mx: CUSTOM_THEME_DEFINITIONS.mx.aura,
  rasta: CUSTOM_THEME_DEFINITIONS.rasta.aura
};

export function isCustomThemeSlot(value: unknown): value is CustomThemeSlot {
  return typeof value === "string" && value in CUSTOM_THEME_DEFINITIONS;
}

export function parseCustomThemeSlot(value: unknown, fallback: CustomThemeSlot = "crimson"): CustomThemeSlot {
  return isCustomThemeSlot(value) ? value : fallback;
}

export function isThemeSelection(value: unknown): value is ThemeSelection {
  return value === "dark" || value === "light" || isCustomThemeSlot(value);
}

export function getThemeSelection(mode: ThemeMode, slot: CustomThemeSlot): ThemeSelection {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return slot;
}

export function getThemeLabel(selection: ThemeSelection): string {
  return THEME_SELECTION_LABELS[selection];
}

export function getThemeSelectionFromState(themeMode: string | null, slot: CustomThemeSlot): ThemeSelection {
  if (themeMode === "light") return "light";
  if (themeMode === "custom") return slot;
  return "dark";
}

export function getCustomThemeClassName(slot: CustomThemeSlot): string {
  return `theme-custom-${slot}`;
}
