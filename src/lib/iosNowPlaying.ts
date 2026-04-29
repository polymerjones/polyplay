type NowPlayingPlugin = {
  setNowPlayingItem(options: {
    title: string;
    subtitle?: string;
    artworkDataUrl?: string;
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

async function rasterizeArtworkBlob(blob: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode artwork image"));
      image.src = objectUrl;
    });

    const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
    const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
    const maxEdge = 512;
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return blob;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const nextBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return nextBlob && nextBlob.size > 0 ? nextBlob : blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to load artwork image"));
    image.src = url;
  });
  return image;
}

async function imageToJpegDataUrl(image: CanvasImageSource): Promise<string> {
  let width = 512;
  let height = 512;
  if (image instanceof HTMLImageElement) {
    const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
    const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
    const scale = Math.min(1, 512 / Math.max(sourceWidth, sourceHeight));
    width = Math.max(1, Math.round(sourceWidth * scale));
    height = Math.max(1, Math.round(sourceHeight * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Unable to create artwork canvas");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

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
  const preparedBlob = await rasterizeArtworkBlob(blob).catch(() => blob);
  const objectUrl = URL.createObjectURL(preparedBlob);
  try {
    const image = await loadImageFromUrl(objectUrl);
    const dataUrl = await imageToJpegDataUrl(image);
    artworkDataUrlCache.set(blob, dataUrl);
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function urlToDataUrl(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  const image = await loadImageFromUrl(url);
  return await imageToJpegDataUrl(image);
}

export async function getNowPlayingArtworkDataUrl(options: {
  artBlob?: Blob;
  artUrl?: string;
}): Promise<string | undefined> {
  if (options.artBlob) return await blobToDataUrl(options.artBlob);
  if (options.artUrl) return await urlToDataUrl(options.artUrl).catch(() => undefined);
  return undefined;
}

export async function setIosNowPlayingItem(options: {
  title: string;
  subtitle?: string;
  artBlob?: Blob;
  artUrl?: string;
}): Promise<void> {
  const plugin = getNowPlayingPlugin();
  if (!plugin) return;
  const artworkDataUrl = await getNowPlayingArtworkDataUrl(options);
  await plugin.setNowPlayingItem({
    title: options.title,
    subtitle: options.subtitle,
    artworkDataUrl
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
