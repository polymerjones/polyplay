const ORACLE_SCHEME_URL = "polyoracle://";
const ORACLE_APP_STORE_URL = "https://apps.apple.com/app/poly-oracle/id6760079845";

function isLikelyIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isTouchMac = /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return isAppleMobile || isTouchMac;
}

export function PolyOracleOrb() {
  const onOpenOracle = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isLikelyIOSDevice()) return;
    event.preventDefault();
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let didLeavePage = false;
    let fallbackTimer: number | null = null;

    const cleanup = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const onPageHide = () => {
      didLeavePage = true;
      cleanup();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      didLeavePage = true;
      cleanup();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide, { once: true });

    fallbackTimer = window.setTimeout(() => {
      cleanup();
      if (didLeavePage) return;
      window.location.href = ORACLE_APP_STORE_URL;
    }, 1200);

    window.location.href = ORACLE_SCHEME_URL;
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
import type { MouseEvent } from "react";
