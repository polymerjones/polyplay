export type GratitudeFrequency = "daily" | "weekly" | "launch" | "off";

export type GratitudeSettings = {
  enabled: boolean;
  frequency: GratitudeFrequency;
  doNotSaveText: boolean;
  doNotPromptAgain: boolean;
};

export type GratitudeEntry = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  privateMode?: boolean;
};

export const GRATITUDE_SETTINGS_KEY = "gratitude_settings";
export const GRATITUDE_LAST_PROMPT_KEY = "gratitude_lastPromptAt";
export const GRATITUDE_ENTRIES_KEY = "gratitude_entries";

export const DEFAULT_GRATITUDE_SETTINGS: GratitudeSettings = {
  enabled: true,
  frequency: "daily",
  doNotSaveText: false,
  doNotPromptAgain: false
};

function parseFrequency(value: unknown): GratitudeFrequency {
  if (value === "daily" || value === "weekly" || value === "launch" || value === "off") return value;
  return DEFAULT_GRATITUDE_SETTINGS.frequency;
}

function getLocalDateStamp(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString();
}

function makeEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEntries(entries: unknown): GratitudeEntry[] {
  if (!Array.isArray(entries)) return [];
  const mapped: Array<GratitudeEntry | null> = entries.map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Partial<GratitudeEntry> & { createdAt?: unknown; text?: unknown };
      if (typeof item.text !== "string") return null;
      const createdAt = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
      const id = typeof item.id === "string" && item.id ? item.id : `legacy-${createdAt}`;
      const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : undefined;
      const normalized: GratitudeEntry = {
        id,
        text: item.text,
        createdAt,
        privateMode: Boolean(item.privateMode)
      };
      if (updatedAt) normalized.updatedAt = updatedAt;
      return normalized;
    });
  return mapped.filter((entry): entry is GratitudeEntry => entry !== null);
}

function writeEntries(entries: GratitudeEntry[]): void {
  try {
    localStorage.setItem(GRATITUDE_ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures.
  }
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
      doNotSaveText: Boolean(parsed.doNotSaveText),
      doNotPromptAgain: Boolean(parsed.doNotPromptAgain)
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
  if (!settings.enabled || settings.frequency === "off" || settings.doNotPromptAgain) return false;
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
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const safeEntries = normalizeEntries(parsed);
    const next: GratitudeEntry[] = [
      { id: makeEntryId(), text: trimmed, createdAt: nowIso, updatedAt: nowIso, privateMode: false },
      ...safeEntries
    ].slice(0, 50);
    writeEntries(next);
  } catch {
    // Ignore storage failures.
  }
}

export function createEntry(text: string): void {
  appendGratitudeEntry(text, new Date().toISOString());
}

export function getGratitudeEntries(): GratitudeEntry[] {
  try {
    const raw = localStorage.getItem(GRATITUDE_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeEntries(parsed);
    return normalized
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
}

export function deleteGratitudeEntry(entryId: string): void {
  try {
    const next = getGratitudeEntries().filter((entry) => entry.id !== entryId);
    writeEntries(next);
  } catch {
    // Ignore storage failures.
  }
}

export function updateGratitudeEntry(entryId: string, newText: string): void {
  const trimmed = newText.trim();
  if (!trimmed) return;
  const nowIso = new Date().toISOString();
  const next = getGratitudeEntries().map((entry) =>
    entry.id === entryId ? { ...entry, text: trimmed, updatedAt: nowIso } : entry
  );
  writeEntries(next);
}

export function formatGratitudeExport(entries: GratitudeEntry[]): string {
  if (!entries.length) return "No gratitude entries yet.";
  const lines: string[] = ["Polyplay Gratitude Journal", ""];
  for (const entry of entries) {
    const localDate = new Date(entry.createdAt);
    const heading = Number.isFinite(localDate.getTime())
      ? localDate.toISOString().slice(0, 10)
      : entry.createdAt;
    lines.push(heading);
    lines.push(`- What I'm grateful for: ${entry.text.trim()}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function listEntries(): GratitudeEntry[] {
  return getGratitudeEntries();
}

export function updateEntry(id: string, newText: string): void {
  updateGratitudeEntry(id, newText);
}

export function deleteEntry(id: string): void {
  deleteGratitudeEntry(id);
}

export function exportEntriesAsText(): string {
  return formatGratitudeExport(getGratitudeEntries());
}
