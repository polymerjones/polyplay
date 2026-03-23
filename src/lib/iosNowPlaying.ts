type NowPlayingPlugin = {
  setNowPlayingItem(options: {
    title: string;
    subtitle?: string;
  }): Promise<void>;
  updatePlaybackState(options: {
    elapsedTime: number;
    duration: number;
    isPlaying: boolean;
  }): Promise<void>;
  clearNowPlaying(): Promise<void>;
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

export async function setIosNowPlayingItem(options: {
  title: string;
  subtitle?: string;
}): Promise<void> {
  const plugin = getNowPlayingPlugin();
  if (!plugin) return;
  await plugin.setNowPlayingItem({
    title: options.title,
    subtitle: options.subtitle
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
