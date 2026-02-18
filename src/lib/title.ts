export function titleFromFilename(filename: string): string {
  const trimmed = (filename || "").trim();
  if (!trimmed) return "Untitled";
  const withoutPath = trimmed.split(/[\\/]/).pop() || trimmed;
  const withoutExt = withoutPath.replace(/\.[^/.]+$/, "").trim();
  return withoutExt || "Untitled";
}
