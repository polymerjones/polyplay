const busyToastPatterns = [
  /importing\b/i,
  /updating artwork/i,
  /applying artwork/i,
  /preparing (vault )?backup/i,
  /collecting vault media/i,
  /opening vault backup/i,
  /importing backup/i,
  /restoring vault media/i,
  /finalizing vault restore/i,
  /building (vault )?zip/i,
  /zipping backup/i,
  /persisting\b/i
];

export function isBusyToastMessage(message?: string | null): boolean {
  if (!message) return false;
  return busyToastPatterns.some((pattern) => pattern.test(message));
}
