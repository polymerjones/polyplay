import type { MouseEvent } from "react";

const ORACLE_URL_SCHEME = "polyoracle://";
const ORACLE_APP_STORE_URL = "https://apps.apple.com/app/poly-oracle/id6760079845";
const ORACLE_FALLBACK_DELAY_MS = 1400;
const ORACLE_SECONDARY_ATTEMPT_DELAY_MS = 260;

function isLikelyIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isTouchMac = /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return isAppleMobile || isTouchMac;
}

function getSchemeCandidates(rawScheme: string): string[] {
  const trimmed = rawScheme.trim();
  if (!trimmed) return [];
  const withColon = trimmed.includes(":") ? trimmed : `${trimmed}:`;
  const withSlashes = withColon.endsWith("//") ? withColon : withColon.endsWith(":") ? `${withColon}//` : withColon;
  const withoutTrailingSlashes = withSlashes.replace(/\/+$/, "");
  return Array.from(new Set([withSlashes, withoutTrailingSlashes]));
}

function tryOpenViaIframe(url: string): void {
  if (typeof document === "undefined") return;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.setAttribute("aria-hidden", "true");
  frame.src = url;
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 520);
}

export function PolyOracleOrb() {
  const onOpenOracle = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isLikelyIOSDevice()) return;
    event.preventDefault();
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const candidates = getSchemeCandidates(ORACLE_URL_SCHEME);
    const primary = candidates[0];
    if (!primary) {
      window.location.href = ORACLE_APP_STORE_URL;
      return;
    }
    const secondary = candidates[1];

    let didLeavePage = false;
    let fallbackTimer: number | null = null;
    let secondaryAttemptTimer: number | null = null;

    const cleanup = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onBlur);
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (secondaryAttemptTimer !== null) {
        window.clearTimeout(secondaryAttemptTimer);
        secondaryAttemptTimer = null;
      }
    };

    const markLeft = () => {
      didLeavePage = true;
      cleanup();
    };

    const onPageHide = () => markLeft();
    const onBlur = () => markLeft();
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      markLeft();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide, { once: true });
    window.addEventListener("blur", onBlur, { once: true });

    fallbackTimer = window.setTimeout(() => {
      cleanup();
      if (didLeavePage) return;
      window.location.href = ORACLE_APP_STORE_URL;
    }, ORACLE_FALLBACK_DELAY_MS);

    window.location.assign(primary);
    tryOpenViaIframe(primary);

    if (secondary && secondary !== primary) {
      secondaryAttemptTimer = window.setTimeout(() => {
        if (didLeavePage) return;
        window.location.assign(secondary);
        tryOpenViaIframe(secondary);
      }, ORACLE_SECONDARY_ATTEMPT_DELAY_MS);
    }
  };

  return (
    <a
      href={ORACLE_APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open PolyOracle"
      title="Open PolyOracle"
      className="pp-oracle-link nav-action-btn"
      data-ui="true"
      onClick={onOpenOracle}
    >
      <span className="pp-oracle-orb" />
    </a>
  );
}
