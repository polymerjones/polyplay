type MediaImportPlugin = {
  pickAudioFile: () => Promise<{ cancelled?: boolean; path?: string; name?: string; mimeType?: string }>;
};

type CapacitorLike = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  registerPlugin?: <T>(pluginName: string) => T;
  convertFileSrc?: (filePath: string) => string;
};

let mediaImportPluginCache: MediaImportPlugin | null = null;

function getCapacitor(): CapacitorLike | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { Capacitor?: CapacitorLike }).Capacitor ?? null;
}

export function canUseIosNativeAudioImport(): boolean {
  const capacitor = getCapacitor();
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function" && !capacitor.isNativePlatform()) return false;
  return capacitor.getPlatform?.() === "ios" && typeof capacitor.registerPlugin === "function";
}

function getMediaImportPlugin(): MediaImportPlugin | null {
  if (mediaImportPluginCache) return mediaImportPluginCache;
  const capacitor = getCapacitor();
  if (!capacitor || typeof capacitor.registerPlugin !== "function") return null;
  mediaImportPluginCache = capacitor.registerPlugin<MediaImportPlugin>("MediaImport");
  return mediaImportPluginCache;
}

export async function pickIosNativeAudioFile(): Promise<File | null> {
  const plugin = getMediaImportPlugin();
  const capacitor = getCapacitor();
  if (!plugin || !capacitor || typeof capacitor.convertFileSrc !== "function") return null;
  const picked = await plugin.pickAudioFile();
  if (picked.cancelled || !picked.path || !picked.name) return null;
  const response = await fetch(capacitor.convertFileSrc(picked.path));
  if (!response.ok) throw new Error(`Failed to read imported file (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], picked.name, { type: picked.mimeType || blob.type || "application/octet-stream" });
}
