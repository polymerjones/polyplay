const busyToastPatterns = [
  /importing\b/i,
  /updating artwork/i,
  /applying artwork/i,
  /preparing backup/i,
  /importing backup/i,
  /zipping backup/i,
  /persisting\b/i
];

export function isBusyToastMessage(message?: string | null): boolean {
  if (!message) return false;
  return busyToastPatterns.some((pattern) => pattern.test(message));
}
