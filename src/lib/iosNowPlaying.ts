type NowPlayingPlugin = {
  setNowPlayingItem(options: {
    title: string;
    subtitle?: string;
    artworkDataUrl?: string;
    artworkUrl?: string;
  }): Promise<void>;
  updatePlaybackState(options: {
    elapsedTime: number;
    duration: number;
    isPlaying: boolean;
  }): Promise<void>;
  clearNowPlaying(): Promise<void>;
  addListener(
    eventName: "remoteCommand",
    listener: (event: { command?: "play" | "pause" | "togglePlayPause" | "previousTrack" | "nextTrack" }) => void
  ): Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
};

type CapacitorLike = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  registerPlugin?: <T>(pluginName: string) => T;
  Plugins?: Record<string, unknown>;
};

declare global {
  interface Window {
    Capacitor?: CapacitorLike;
  }
}

let nowPlayingPluginCache: NowPlayingPlugin | null | undefined;
const artworkDataUrlCache = new WeakMap<Blob, string>();

function getNowPlayingPlugin(): NowPlayingPlugin | null {
  if (nowPlayingPluginCache !== undefined) return nowPlayingPluginCache;
  if (typeof window === "undefined") return null;
  const capacitor = window.Capacitor;
  if (!capacitor) {
    nowPlayingPluginCache = null;
    return null;
  }
  const platform = typeof capacitor.getPlatform === "function" ? capacitor.getPlatform() : "";
  const isNative =
    typeof capacitor.isNativePlatform === "function"
      ? capacitor.isNativePlatform()
      : platform === "ios" || platform === "android";
  if (!isNative || platform !== "ios") {
    nowPlayingPluginCache = null;
    return null;
  }

  if (typeof capacitor.registerPlugin === "function") {
    nowPlayingPluginCache = capacitor.registerPlugin<NowPlayingPlugin>("NowPlaying");
    return nowPlayingPluginCache;
  }

  const plugin = capacitor.Plugins?.NowPlaying;
  nowPlayingPluginCache = plugin ? (plugin as NowPlayingPlugin) : null;
  return nowPlayingPluginCache;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const cached = artworkDataUrlCache.get(blob);
  if (cached) return cached;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read artwork blob as data URL"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read artwork blob"));
    reader.readAsDataURL(blob);
  });

  artworkDataUrlCache.set(blob, dataUrl);
  return dataUrl;
}

export async function setIosNowPlayingItem(options: {
  title: string;
  subtitle?: string;
  artBlob?: Blob;
  artUrl?: string;
}): Promise<void> {
  const plugin = getNowPlayingPlugin();
  if (!plugin) return;
  const artworkDataUrl = options.artBlob ? await blobToDataUrl(options.artBlob) : undefined;
  await plugin.setNowPlayingItem({
    title: options.title,
    subtitle: options.subtitle,
    artworkDataUrl,
    artworkUrl: artworkDataUrl ? undefined : options.artUrl
  });
}

export async function updateIosNowPlayingPlaybackState(options: {
  elapsedTime: number;
  duration: number;
  isPlaying: boolean;
}): Promise<void> {
  const plugin = getNowPlayingPlugin();
  if (!plugin) return;
  await plugin.updatePlaybackState({
    elapsedTime: Number.isFinite(options.elapsedTime) ? Math.max(0, options.elapsedTime) : 0,
    duration: Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0,
    isPlaying: options.isPlaying
  });
}

export async function clearIosNowPlaying(): Promise<void> {
  const plugin = getNowPlayingPlugin();
  if (!plugin) return;
  await plugin.clearNowPlaying();
}

export async function addIosNowPlayingRemoteCommandListener(
  listener: (event: { command?: "play" | "pause" | "togglePlayPause" | "previousTrack" | "nextTrack" }) => void
): Promise<null | { remove: () => Promise<void> }> {
  const plugin = getNowPlayingPlugin();
  if (!plugin?.addListener) return null;
  return await plugin.addListener("remoteCommand", listener);
}
