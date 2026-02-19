import type { Track } from "../types";

const BASE_WEIGHT = 1;
const AURA_MULTIPLIER = 0.35;
const TEN_MIN_MS = 10 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getCooldownFactor(lastPlayedAt: number | undefined, now: number): number {
  if (!lastPlayedAt || lastPlayedAt <= 0) return 1;
  const elapsed = Math.max(0, now - lastPlayedAt);
  if (elapsed <= TEN_MIN_MS) return 0.1;
  if (elapsed <= ONE_HOUR_MS) return 0.4;
  if (elapsed <= ONE_DAY_MS) return 0.8;
  return 1;
}

export function computeShuffleWeight(track: Track, now: number, lastPlayedAt?: number): number {
  const aura = Math.max(0, Math.min(5, Math.round(track.aura || 0)));
  const auraWeight = 1 + aura * AURA_MULTIPLIER;
  const cooldownFactor = getCooldownFactor(lastPlayedAt, now);
  return Math.max(0.0001, BASE_WEIGHT * auraWeight * cooldownFactor);
}

export function pickAuraWeightedTrack(
  tracks: Track[],
  currentTrackId: string | null,
  lastPlayedAtByTrackId: Record<string, number>,
  now = Date.now()
): string | null {
  const playable = tracks.filter((track) => Boolean(track.audioUrl) && !track.missingAudio);
  if (!playable.length) return null;
  if (playable.length === 1) return playable[0]?.id ?? null;

  const pool = playable.filter((track) => track.id !== currentTrackId);
  const candidates = pool.length ? pool : playable;

  const weights = candidates.map((track) =>
    computeShuffleWeight(track, now, lastPlayedAtByTrackId[track.id])
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return candidates[0]?.id ?? null;

  let cursor = Math.random() * total;
  for (let i = 0; i < candidates.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return candidates[i]?.id ?? null;
  }
  return candidates[candidates.length - 1]?.id ?? null;
}
