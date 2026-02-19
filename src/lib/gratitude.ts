export type GratitudeFrequency = "daily" | "weekly" | "launch" | "off";

export type GratitudeSettings = {
  enabled: boolean;
  frequency: GratitudeFrequency;
  doNotSaveText: boolean;
};

export type GratitudeEntry = {
  text: string;
  createdAt: string;
};

export const GRATITUDE_SETTINGS_KEY = "gratitude_settings";
export const GRATITUDE_LAST_PROMPT_KEY = "gratitude_lastPromptAt";
export const GRATITUDE_ENTRIES_KEY = "gratitude_entries";

export const DEFAULT_GRATITUDE_SETTINGS: GratitudeSettings = {
  enabled: true,
  frequency: "daily",
  doNotSaveText: false
};

function parseFrequency(value: unknown): GratitudeFrequency {
  if (value === "daily" || value === "weekly" || value === "launch" || value === "off") return value;
  return DEFAULT_GRATITUDE_SETTINGS.frequency;
}

function getLocalDateStamp(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString();
}

export function loadGratitudeSettings(): GratitudeSettings {
  try {
    const raw = localStorage.getItem(GRATITUDE_SETTINGS_KEY);
    if (!raw) return DEFAULT_GRATITUDE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GratitudeSettings> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_GRATITUDE_SETTINGS;
    return {
      enabled: parsed.enabled !== false,
      frequency: parseFrequency(parsed.frequency),
      doNotSaveText: Boolean(parsed.doNotSaveText)
    };
  } catch {
    return DEFAULT_GRATITUDE_SETTINGS;
  }
}

export function saveGratitudeSettings(next: GratitudeSettings): void {
  try {
    localStorage.setItem(GRATITUDE_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
}

export function loadLastGratitudePromptAt(): string | null {
  try {
    return localStorage.getItem(GRATITUDE_LAST_PROMPT_KEY);
  } catch {
    return null;
  }
}

export function markGratitudePromptShown(isoNow: string): void {
  try {
    localStorage.setItem(GRATITUDE_LAST_PROMPT_KEY, isoNow);
  } catch {
    // Ignore storage failures.
  }
}

export function shouldShowGratitudePrompt(
  settings: GratitudeSettings,
  lastPromptAtIso: string | null,
  nowMs: number
): boolean {
  if (!settings.enabled || settings.frequency === "off") return false;
  if (settings.frequency === "launch") return true;
  if (!lastPromptAtIso) return true;
  const lastMs = Date.parse(lastPromptAtIso);
  if (!Number.isFinite(lastMs)) return true;
  if (settings.frequency === "daily") {
    return getLocalDateStamp(lastMs) !== getLocalDateStamp(nowMs);
  }
  return nowMs - lastMs >= 7 * 24 * 60 * 60 * 1000;
}

export function appendGratitudeEntry(text: string, nowIso: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  try {
    const raw = localStorage.getItem(GRATITUDE_ENTRIES_KEY);
    const parsed = raw ? (JSON.parse(raw) as GratitudeEntry[]) : [];
    const safeEntries = Array.isArray(parsed) ? parsed : [];
    const next: GratitudeEntry[] = [{ text: trimmed, createdAt: nowIso }, ...safeEntries].slice(0, 50);
    localStorage.setItem(GRATITUDE_ENTRIES_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
}
