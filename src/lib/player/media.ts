import { getBlob } from "../storage/db";

const urlCache = new Map<string, string>();

export async function getMediaUrl(blobKey: string | null | undefined): Promise<string | undefined> {
  if (!blobKey) return undefined;
  const cached = urlCache.get(blobKey);
  if (cached) return cached;

  const blob = await getBlob(blobKey);
  if (!blob) return undefined;

  const url = URL.createObjectURL(blob);
  urlCache.set(blobKey, url);
  return url;
}

export function revokeMediaUrl(blobKey: string | null | undefined): void {
  if (!blobKey) return;
  const cached = urlCache.get(blobKey);
  if (!cached) return;
  URL.revokeObjectURL(cached);
  urlCache.delete(blobKey);
}

export function revokeAllMediaUrls(): void {
  for (const url of urlCache.values()) {
    URL.revokeObjectURL(url);
  }
  urlCache.clear();
}

