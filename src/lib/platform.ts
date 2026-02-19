function getUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function isIosSafari(): boolean {
  const ua = getUserAgent();
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  const isWebKit = /WebKit/.test(ua);
  const isExcluded = /CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isWebKit && !isExcluded;
}

export function isConstrainedMobileDevice(): boolean {
  if (isIosSafari()) return true;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    if (window.matchMedia("(max-width: 820px)").matches) return true;
  }
  return false;
}
